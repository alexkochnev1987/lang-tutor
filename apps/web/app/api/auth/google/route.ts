/**
 * Вход через Google.
 *
 * Клиент получает ID-токен у Google Identity Services и присылает его
 * сюда ОДИН раз. Сервер проверяет подпись по публичным ключам Google и
 * только после этого доверяет полю `sub`.
 *
 * Без этой проверки вход был бы декоративным: payload JWT читается
 * любым, и подстановка чужого `sub` открыла бы чужой прогресс.
 *
 * `audience` проверяется обязательно — иначе примем токен, выданный
 * Google для совершенно другого приложения.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { eq, sql } from 'drizzle-orm'
import { pg } from '@/lib/db/pg'
import { users } from '@/lib/db/schema'
import { withUser } from '@/lib/api/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export const POST = withUser(async ({ userId, req, setSession }) => {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('google_auth_not_configured')

  const { idToken } = await req.json() as { idToken?: string }
  if (!idToken) throw new Error('no_id_token')

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
  })
  const sub = payload.sub
  if (!sub) throw new Error('no_sub')

  const profile = {
    email: (payload.email as string) ?? null,
    name: (payload.name as string) ?? null,
    picture: (payload.picture as string) ?? null,
  }

  // Уже есть аккаунт с этим Google? Тогда это возврат пользователя —
  // например, вход с другого устройства.
  const [existing] = await pg.select({ id: users.id }).from(users)
    .where(eq(users.googleSub, sub)).limit(1)

  if (!existing) {
    // Первый вход: привязываем Google к ТЕКУЩЕЙ (гостевой) строке.
    // Всё, что человек прошёл до входа, остаётся при нём.
    await pg.update(users)
      .set({ googleSub: sub, ...profile, lastSeenAt: sql`now()` })
      .where(eq(users.id, userId))
    return { userId, linked: true, switched: false }
  }

  if (existing.id === userId) {
    await pg.update(users).set({ ...profile, lastSeenAt: sql`now()` })
      .where(eq(users.id, userId))
    return { userId, linked: false, switched: false }
  }

  // Аккаунт существует, а сидим мы под другой (гостевой) строкой.
  // Прогресс аккаунта — главнее: переключаем сессию на него, гостевые
  // строки не трогаем и не удаляем. Сливать два набора карточек FSRS
  // автоматически нельзя: это испортило бы расписание повторений.
  //
  // Переключение — это именно новая cookie. Без неё вход выглядел бы
  // сделанным, но следующий же запрос шёл бы от гостя: человек видел бы
  // пустой курс, а занятия продолжали бы писаться мимо аккаунта.
  await pg.update(users).set({ ...profile, lastSeenAt: sql`now()` })
    .where(eq(users.id, existing.id))
  setSession(existing.id)
  return { userId: existing.id, linked: false, switched: true, switchTo: existing.id }
})
