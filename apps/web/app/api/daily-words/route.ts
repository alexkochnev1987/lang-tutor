import { sql } from 'drizzle-orm'
import { withUser } from '@/lib/api/handler'
import { pg } from '@/lib/db/pg'
import vocabulary from '../../../../../content/pl-b1-ru/vocabulary.json'
import { brainstormWordSession, WORD_FORMATS, wordSkill, type DailyWordAnswer, type DailyWordSubmission } from '@/lib/engine/daily-words'

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
  // A new word counts once on the calendar day of its first-ever review,
  // regardless of whether it was learned in the lesson or in /words.
  const learned = await pg.execute<{ total: number }>(sql`
    WITH calendar AS (${calendar(userId)})
    SELECT COUNT(*)::int AS total FROM (
      SELECT item.ref_id
      FROM study_items item
      JOIN review_logs log ON log.user_id = item.user_id AND log.study_item_id = item.id
      CROSS JOIN calendar
      WHERE item.user_id = ${userId} AND item.course_id = ${courseId}
        AND item.kind LIKE 'lexeme-%'
      GROUP BY item.ref_id, calendar.day, calendar.zone
      HAVING (MIN(log.reviewed_at) AT TIME ZONE calendar.zone)::date = calendar.day
    ) first_reviews
  `)
  return {
    day: rows[0]?.day ?? "",
    learn: rows.filter((row) => row.eligible && !row.seen).map(({ id }) => id),
    review: rows.filter((row) => row.eligible && row.seen).map(({ id }) => id),
    learnedToday: Number(learned.rows[0]?.total ?? 0),
  }
})

function validAnswer(answer: DailyWordAnswer, lexemeId: string, isBrainstorm: boolean) {
  const { format, item, log, result } = answer ?? {}
  const supportedFormat = format === 'pronunciation' ? !isBrainstorm : WORD_FORMATS.includes(format)
  return item && log && result && supportedFormat && item.refId === lexemeId
    && (format !== 'pronunciation' || (Number.isInteger(result.attempts) && result.attempts >= 1 && result.attempts <= 3))
    && item.kind === wordSkill(format) && item.id === `${item.kind}:${lexemeId}`
    && /^[0-9a-f-]{36}$/i.test(log.id) && log.studyItemId === item.id
    && Number.isInteger(result.dayNumber) && result.dayNumber >= 1
    && [result.exerciseId, result.answer, result.expected].every((value) => typeof value === 'string' && value.trim())
    && Number.isFinite(Date.parse(String(item.due))) && Number.isFinite(Date.parse(String(log.reviewedAt)))
}

export const POST = withUser(async ({ userId, req }) => {
  const submission = await req.json() as DailyWordSubmission
  const isBrainstorm = submission?.format === 'brainstorm'
  const answers = isBrainstorm ? submission.answers : [submission]
  const first = Array.isArray(answers) ? answers[0] : undefined
  const lexemeId = first?.item?.refId
  if (!first || !lexemeId || !lexemes.has(lexemeId)
    || answers.length !== (isBrainstorm ? WORD_FORMATS.length : 1)
    || !answers.every((answer) => validAnswer(answer, lexemeId, isBrainstorm))
    || new Set(answers.map(({ format }) => format)).size !== answers.length
    || new Set(answers.map(({ log }) => log.id)).size !== answers.length
    || new Set(answers.map(({ result }) => result.exerciseId)).size !== answers.length
    || (isBrainstorm && (!/^[0-9a-f-]{36}$/i.test(submission.sessionId)
      || !Number.isFinite(Date.parse(submission.startedAt))
      || !answers.every(({ result }) => result.exerciseId.startsWith(`${submission.sessionId}:`)
        && result.dayNumber === first.result.dayNumber && Number.isInteger(result.attempts)
        && result.attempts >= 1 && result.attempts <= 3)))) {
    throw new Error('bad_daily_word_answer')
  }

  const { item, log } = first
  const session = isBrainstorm ? brainstormWordSession(submission) : null
  const data = answers.map(({ item, log, result }) => ({
    item_id: item.id, kind: item.kind, due: item.due, reviewed_at: log.reviewedAt,
    stability: item.stability, difficulty: item.difficulty, elapsed_days: item.elapsedDays,
    scheduled_days: item.scheduledDays, learning_steps: item.learningSteps, reps: item.reps,
    lapses: item.lapses, state: item.state, log_id: log.id, rating: log.rating,
    log_state: log.state, log_stability: log.stability, log_difficulty: log.difficulty,
    log_elapsed_days: log.elapsedDays, log_scheduled_days: log.scheduledDays,
    response_ms: log.responseMs ?? null, day_number: result.dayNumber, exercise_id: result.exerciseId,
    attempts: result.attempts, correct: Number(result.correct), answer: result.answer.slice(0, 1000),
    expected: result.expected.slice(0, 1000), error_kind: result.errorKind,
  }))
  // A single statement is atomic with either Postgres driver. Losing the
  // unique-key race writes neither a schedule nor an exercise result.
  const { rows } = await pg.execute<{ answered_at: string | Date | null }>(sql`
    WITH calendar AS (${calendar(userId)}), input AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(data)}::jsonb) AS a(
        item_id text, kind text, due timestamptz, reviewed_at timestamptz, stability real,
        difficulty real, elapsed_days integer, scheduled_days integer, learning_steps integer,
        reps integer, lapses integer, state integer, log_id text, rating integer, log_state integer,
        log_stability real, log_difficulty real, log_elapsed_days integer, log_scheduled_days integer,
        response_ms integer, day_number integer, exercise_id text, attempts integer, correct integer,
        answer text, expected text, error_kind text
      )
    ), claimed AS (
      INSERT INTO daily_word_reviews (user_id, course_id, day, lexeme_id, answer_id, format)
      SELECT ${userId}, ${courseId}, day::text, ${item.refId}, ${log.id}, ${submission.format}
      FROM calendar
      WHERE NOT EXISTS (SELECT 1 FROM review_logs JOIN input ON review_logs.id = input.log_id)
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
      SELECT item_id, ${userId}, ${courseId}, kind, ${lexemeId},
        answered_at + greatest(interval '0 seconds', due - reviewed_at),
        stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses,
        state, answered_at FROM claimed CROSS JOIN input
      ON CONFLICT (user_id, id) DO UPDATE SET due = excluded.due, stability = excluded.stability,
        difficulty = excluded.difficulty, elapsed_days = excluded.elapsed_days, scheduled_days = excluded.scheduled_days,
        learning_steps = excluded.learning_steps, reps = excluded.reps, lapses = excluded.lapses,
        state = excluded.state, last_review = excluded.last_review, updated_at = now()
    ), logged AS (
      INSERT INTO review_logs (id, user_id, study_item_id, rating, state, stability, difficulty,
        elapsed_days, scheduled_days, reviewed_at, exercise_id, response_ms)
      SELECT log_id, ${userId}, item_id, rating, log_state, log_stability, log_difficulty,
        log_elapsed_days, log_scheduled_days, answered_at, exercise_id, response_ms
      FROM claimed CROSS JOIN input
    ), recorded AS (
      INSERT INTO exercise_results (user_id, course_id, day_number, exercise_id, attempts, correct, answer, expected, error_kind, completed_at)
      SELECT ${userId}, ${courseId}, day_number, exercise_id, attempts, correct,
        answer, expected, error_kind, answered_at FROM claimed CROSS JOIN input
      ON CONFLICT (user_id, course_id, day_number, exercise_id) DO UPDATE SET attempts = excluded.attempts,
        correct = excluded.correct, answer = excluded.answer, expected = excluded.expected,
        error_kind = excluded.error_kind, completed_at = excluded.completed_at, updated_at = now()
    )${session ? sql`, completed_word AS (
      INSERT INTO lesson_sessions (id, user_id, course_id, day_number, kind, started_at,
        completed_at, planned_budget_ms, actual_ms, items_reviewed, items_correct)
      SELECT ${session.id}, ${userId}, ${courseId}, ${session.dayNumber}, ${session.kind},
        least(${session.startedAt.toISOString()}::timestamptz, answered_at), answered_at, ${session.plannedBudgetMs},
        least(2147483647, greatest(0, extract(epoch FROM answered_at - ${session.startedAt.toISOString()}::timestamptz) * 1000))::integer,
        ${session.itemsReviewed}, ${session.itemsCorrect} FROM claimed
      ON CONFLICT (user_id, id) DO NOTHING
    )` : sql.empty()}
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
