import { sql } from 'drizzle-orm'
import { withUser } from '@/lib/api/handler'
import { pg } from '@/lib/db/pg'
import vocabulary from '../../../../../content/pl-b1-ru/vocabulary.json'
import { WORD_FORMATS, wordSkill, type DailyWordAnswer } from '@/lib/engine/daily-words'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const courseId = process.env.NEXT_PUBLIC_COURSE_ID ?? vocabulary.courseId
const lexemeIds = vocabulary.items.map(({ id }) => id)
const lexemes = new Set(lexemeIds)

function calendar(userId: string) {
  return sql`SELECT statement_timestamp() AS now,
    COALESCE(settings->>'timeZone', 'Europe/Warsaw') AS zone,
    (statement_timestamp() AT TIME ZONE COALESCE(settings->>'timeZone', 'Europe/Warsaw'))::date AS day
    FROM users WHERE id = ${userId}`
}

export const GET = withUser(async ({ userId }) => {
  const { rows } = await pg.execute<{
    id: string; seen: boolean; eligible: boolean; day: string
  }>(sql`
    WITH calendar AS (${calendar(userId)}),
    skills AS (
      SELECT ref_id, bool_or(last_review IS NOT NULL) AS seen, COALESCE(min(due) FILTER (WHERE last_review IS NOT NULL), min(due)) AS due,
        max(last_review) AS last_review
      FROM study_items
      WHERE user_id = ${userId} AND course_id = ${courseId} AND kind LIKE 'lexeme-%'
      GROUP BY ref_id
    )
    SELECT pool.id, calendar.day::text AS day, COALESCE(skills.seen, false) AS seen,
      (known.lexeme_id IS NULL AND answered.lexeme_id IS NULL
        AND (skills.last_review IS NULL OR (skills.last_review AT TIME ZONE calendar.zone)::date < calendar.day)
        AND (skills.due IS NULL OR skills.due <= calendar.now)) AS eligible
    FROM jsonb_array_elements_text(${JSON.stringify(lexemeIds)}::jsonb) AS pool(id)
    CROSS JOIN calendar
    LEFT JOIN skills ON skills.ref_id = pool.id
    LEFT JOIN lexeme_status AS known ON known.user_id = ${userId} AND known.course_id = ${courseId}
      AND known.lexeme_id = pool.id AND known.status = 'known'
    LEFT JOIN daily_word_reviews AS answered ON answered.user_id = ${userId}
      AND answered.course_id = ${courseId} AND answered.day = calendar.day::text AND answered.lexeme_id = pool.id
    ORDER BY skills.due NULLS LAST, pool.id
  `)
  return {
    day: rows[0]?.day ?? "",
    learn: rows.filter((row) => row.eligible && !row.seen).map(({ id }) => id),
    review: rows.filter((row) => row.eligible && row.seen).map(({ id }) => id),
  }
})

export const POST = withUser(async ({ userId, req }) => {
  const { format, item, log, result } = await req.json() as DailyWordAnswer
  if (!item || !log || !result || !WORD_FORMATS.includes(format) || !lexemes.has(item.refId)
    || item.kind !== wordSkill(format) || item.id !== `${item.kind}:${item.refId}`
    || !/^[0-9a-f-]{36}$/i.test(log.id) || log.studyItemId !== item.id
    || !Number.isInteger(result.dayNumber) || result.dayNumber < 1
    || !result.exerciseId?.trim() || !result.answer?.trim() || !result.expected?.trim()
    || !Number.isFinite(Date.parse(String(item.due))) || !Number.isFinite(Date.parse(String(log.reviewedAt)))) throw new Error('bad_daily_word_answer')

  // A single statement is atomic with either Postgres driver. Losing the
  // unique-key race writes neither a schedule nor an exercise result.
  const { rows } = await pg.execute<{ answered_at: string | Date | null }>(sql`
    WITH calendar AS (${calendar(userId)}),
    claimed AS (
      INSERT INTO daily_word_reviews (user_id, course_id, day, lexeme_id, answer_id, format)
      SELECT ${userId}, ${courseId}, day::text, ${item.refId}, ${log.id}, ${format}
      FROM calendar
      WHERE NOT EXISTS (SELECT 1 FROM review_logs WHERE id = ${log.id})
        AND NOT EXISTS (
          SELECT 1 FROM lexeme_status WHERE user_id = ${userId} AND course_id = ${courseId}
            AND lexeme_id = ${item.refId} AND status = 'known'
        )
        AND NOT EXISTS (
          SELECT 1 FROM study_items WHERE user_id = ${userId} AND course_id = ${courseId}
            AND ref_id = ${item.refId} AND kind LIKE 'lexeme-%'
          GROUP BY ref_id HAVING COALESCE(min(due) FILTER (WHERE last_review IS NOT NULL), min(due)) > calendar.now OR (max(last_review) AT TIME ZONE calendar.zone)::date >= calendar.day
        )
      ON CONFLICT DO NOTHING RETURNING answered_at
    ), scheduled AS (
      INSERT INTO study_items (
        id, user_id, course_id, kind, ref_id, due, stability, difficulty, elapsed_days,
        scheduled_days, learning_steps, reps, lapses, state, last_review
      )
      SELECT ${item.id}, ${userId}, ${courseId}, ${item.kind}, ${item.refId},
        answered_at + greatest(interval '0 seconds', ${String(item.due)}::timestamptz - ${String(log.reviewedAt)}::timestamptz), ${item.stability}, ${item.difficulty},
        ${item.elapsedDays}, ${item.scheduledDays}, ${item.learningSteps}, ${item.reps}, ${item.lapses},
        ${item.state}, answered_at FROM claimed
      ON CONFLICT (user_id, id) DO UPDATE SET due = excluded.due, stability = excluded.stability,
        difficulty = excluded.difficulty, elapsed_days = excluded.elapsed_days, scheduled_days = excluded.scheduled_days,
        learning_steps = excluded.learning_steps, reps = excluded.reps, lapses = excluded.lapses,
        state = excluded.state, last_review = excluded.last_review, updated_at = now()
    ), logged AS (
      INSERT INTO review_logs (id, user_id, study_item_id, rating, state, stability, difficulty,
        elapsed_days, scheduled_days, reviewed_at, exercise_id, response_ms)
      SELECT ${log.id}, ${userId}, ${item.id}, ${log.rating}, ${log.state}, ${log.stability},
        ${log.difficulty}, ${log.elapsedDays}, ${log.scheduledDays}, answered_at,
        ${result.exerciseId}, ${log.responseMs ?? null} FROM claimed
    ), recorded AS (
      INSERT INTO exercise_results (user_id, course_id, day_number, exercise_id, attempts, correct, answer, expected, error_kind, completed_at)
      SELECT ${userId}, ${courseId}, ${result.dayNumber}, ${result.exerciseId},
        ${result.attempts}, ${Number(result.correct)}, ${result.answer.slice(0, 1000)},
        ${result.expected.slice(0, 1000)}, ${result.errorKind}, answered_at FROM claimed
      ON CONFLICT (user_id, course_id, day_number, exercise_id) DO UPDATE SET attempts = excluded.attempts,
        correct = excluded.correct, answer = excluded.answer, expected = excluded.expected,
        error_kind = excluded.error_kind, completed_at = excluded.completed_at, updated_at = now()
    )
    SELECT COALESCE((SELECT answered_at FROM claimed), (
      SELECT reviewed_at FROM review_logs WHERE id = ${log.id} AND user_id = ${userId} AND study_item_id = ${item.id}
    )) AS answered_at
  `)
  if (rows[0]?.answered_at) return { answeredAt: rows[0].answered_at }

  // A retry racing the original request can miss its commit in the statement snapshot.
  const replay = await pg.execute<{ reviewed_at: string | Date }>(sql`SELECT reviewed_at FROM review_logs
    WHERE id = ${log.id} AND user_id = ${userId} AND study_item_id = ${item.id}`)
  return { answeredAt: replay.rows[0]?.reviewed_at ?? null }
})
