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
  'uiLanguage', 'sourceLanguage', 'targetLanguage', 'ruleLanguage',
  'theme', 'dailyBudgetMinutes', 'newWordsPerDay', 'grammarExercisesPerDay',
  'readingTextsPerDay', 'grammarLessonFormats', 'ttsVoiceURI', 'ttsRate', 'timeZone',
])

export const PATCH = withUser(async ({ userId, req }) => {
  const patch = await req.json() as Record<string, unknown>
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([k]) => ALLOWED.has(k)),
  )
  if (clean.targetLanguage !== undefined && clean.targetLanguage !== 'pl') {
    throw new Error('unsupported_target_language')
  }
  const { dailyBudgetMinutes, newWordsPerDay, grammarExercisesPerDay, readingTextsPerDay, grammarLessonFormats, ttsRate, ttsVoiceURI, timeZone } = clean
  for (const [value, max] of [[newWordsPerDay, 10], [grammarExercisesPerDay, 20], [readingTextsPerDay, 3]] as const) {
    if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max)) {
      throw new Error('bad_lesson_settings')
    }
  }
  if (grammarLessonFormats !== undefined && (
    !Array.isArray(grammarLessonFormats) || grammarLessonFormats.length === 0
    || grammarLessonFormats.length > 3 || new Set(grammarLessonFormats).size !== grammarLessonFormats.length
    || !grammarLessonFormats.every((format) => typeof format === 'string' && ['choice', 'typed', 'write'].includes(format))
  )) throw new Error('bad_grammar_formats')
  if (timeZone !== undefined) {
    if (typeof timeZone !== 'string' || !timeZone || timeZone.startsWith('+') || timeZone.startsWith('-')) {
      throw new Error('bad_time_zone')
    }
    const { rows } = await pg.execute(sql`SELECT name FROM pg_timezone_names WHERE name = ${timeZone}`)
    if (!rows.length) throw new Error('bad_time_zone')
  }
  if (dailyBudgetMinutes !== undefined && (
    typeof dailyBudgetMinutes !== 'number' || !Number.isInteger(dailyBudgetMinutes) ||
    dailyBudgetMinutes < 5 || dailyBudgetMinutes > 90
  )) throw new Error('bad_daily_budget')
  if (ttsRate !== undefined && (
    typeof ttsRate !== 'number' || !Number.isFinite(ttsRate) || ttsRate < 0.5 || ttsRate > 1.5
  )) throw new Error('bad_speech_rate')
  if (ttsVoiceURI != null && (typeof ttsVoiceURI !== 'string' || ttsVoiceURI.length > 500)) {
    throw new Error('bad_speech_voice')
  }
  if (!Object.keys(clean).length) return { ok: true }

  // слияние на стороне Postgres: клиент присылает только изменённые ключи
  await pg.update(users)
    .set({ settings: sql`${users.settings} || ${JSON.stringify(clean)}::jsonb` })
    .where(eq(users.id, userId))

  return { ok: true }
})
