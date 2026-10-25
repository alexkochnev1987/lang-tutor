/**
 * Сессия пользователя.
 *
 * Прогресс лежит в Postgres, значит у каждого запроса должен быть
 * идентификатор пользователя. Он выдаётся СРАЗУ, ещё до входа через
 * Google: сервер создаёт гостевую строку в `users` и кладёт её id в
 * подписанную httpOnly-cookie.
 *
 * Почему httpOnly, а не localStorage: cookie недоступна скриптам на
 * странице, поэтому XSS не уносит сессию. По той же причине сюда не
 * попадает Google ID-токен — он нужен ровно один раз, чтобы обменяться
 * на эту cookie, и больше нигде не хранится.
 *
 * Вход через Google НЕ создаёт второго пользователя: он проставляет
 * `googleSub` текущей гостевой строке. Всё, что человек прошёл до входа,
 * остаётся при нём.
 */
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { pg } from '@/lib/db/pg'
import { users } from '@/lib/db/schema'

export const SESSION_COOKIE = 'pb1_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 365   // год: это учебный курс на полгода

function secret(): Uint8Array {
  const raw = process.env.SESSION_SECRET
  if (raw) return new TextEncoder().encode(raw)
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET не задан — сессии подписывать нечем')
  }
  // В разработке не роняем приложение из-за незаполненной переменной,
  // но пишем в лог: с этим ключом нельзя выкатываться.
  console.warn('[auth] SESSION_SECRET пуст — временный ключ только для dev')
  return new TextEncoder().encode('dev-only-insecure-secret')
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret())
}

/** userId из cookie или null. Испорченная подпись — это просто «не вошёл». */
export async function readSession(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE_SEC,
} as const

/**
 * Пользователь текущего запроса. Если cookie нет или она указывает на
 * удалённую строку — заводит гостя.
 *
 * Возвращает `setCookie: true`, когда вызывающий роут обязан положить
 * свежую cookie в ответ: выдать её может только route handler.
 */
export async function resolveUser(): Promise<{ userId: string; setCookie: boolean }> {
  const fromCookie = await readSession()
  if (fromCookie) {
    const [row] = await pg.select({ id: users.id }).from(users)
      .where(eq(users.id, fromCookie)).limit(1)
    if (row) return { userId: row.id, setCookie: false }
  }
  const userId = crypto.randomUUID()
  await pg.insert(users).values({ id: userId })
  return { userId, setCookie: true }
}
