/**
 * Настройки интерфейса: язык, тема, голос и темп синтеза.
 *
 * Лежат в `users.settings` (jsonb), а не отдельной таблицей: это
 * небольшой объект, который всегда читается и пишется целиком.
 */
import { eq, sql } from 'drizzle-orm'
import { pg } from '@/lib/db/pg'
import { users } from '@/lib/db/schema'
import { withUser } from '@/lib/api/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = new Set([
  'uiLanguage', 'sourceLanguage', 'theme', 'dailyBudgetMinutes', 'ttsVoiceURI', 'ttsRate',
])

export const PATCH = withUser(async ({ userId, req }) => {
  const patch = await req.json() as Record<string, unknown>
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([k]) => ALLOWED.has(k)),
  )
  if (!Object.keys(clean).length) return { ok: true }

  // слияние на стороне Postgres: клиент присылает только изменённые ключи
  await pg.update(users)
    .set({ settings: sql`${users.settings} || ${JSON.stringify(clean)}::jsonb` })
    .where(eq(users.id, userId))

  return { ok: true }
})
