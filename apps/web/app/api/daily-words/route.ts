import { sql } from 'drizzle-orm'
import { withUser } from '@/lib/api/handler'
import { pg } from '@/lib/db/pg'
import vocabulary from '../../../../../content/pl-b1-ru/vocabulary.json'
import { brainstormWordSession, buildDailyWordLists, WORD_FORMATS, wordSkill, type DailyWordAnswer, type DailyWordSubmission } from '@/lib/engine/daily-words'

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
    id: string; seen: boolean; known: boolean; day: string; kinds: string[] | null;
    due_kinds: string[] | null; next_review_at: Date | string | null
  }>(sql`
    WITH calendar AS (${calendar(userId)}),
    skills AS (
      SELECT ref_id, bool_or(last_review IS NOT NULL) AS seen, min(due) AS due,
        jsonb_agg(kind) AS kinds,
        jsonb_agg(kind) FILTER (WHERE due <= calendar.now) AS due_kinds,
        min(due) FILTER (WHERE due > calendar.now) AS next_due
      FROM study_items CROSS JOIN calendar
      WHERE user_id = ${userId} AND course_id = ${courseId} AND kind LIKE 'lexeme-%'
      GROUP BY ref_id
    )
    SELECT pool.id, calendar.day::text AS day, COALESCE(skills.seen, false) AS seen,
      (known.lexeme_id IS NOT NULL) AS known, skills.kinds, skills.due_kinds,
      MIN(skills.next_due) FILTER (WHERE known.lexeme_id IS NULL AND skills.seen) OVER () AS next_review_at
    FROM jsonb_array_elements_text(${JSON.stringify(lexemeIds)}::jsonb) AS pool(id)
    CROSS JOIN calendar
    LEFT JOIN skills ON skills.ref_id = pool.id
    LEFT JOIN lexeme_status AS known ON known.user_id = ${userId} AND known.course_id = ${courseId}
      AND known.lexeme_id = pool.id AND known.status = 'known'
    ORDER BY skills.due NULLS LAST, pool.id
  `)
  const activity = await pg.execute<{ learned: number; practiced: number }>(sql`
    WITH calendar AS (${calendar(userId)})
    SELECT COUNT(*) FILTER (WHERE first_day = day)::int AS learned,
      COUNT(*) FILTER (WHERE last_day = day)::int AS practiced
    FROM (
      SELECT item.ref_id, calendar.day,
        (MIN(log.reviewed_at) AT TIME ZONE calendar.zone)::date AS first_day,
        (MAX(log.reviewed_at) AT TIME ZONE calendar.zone)::date AS last_day
      FROM study_items item
      JOIN review_logs log ON log.user_id = item.user_id AND log.study_item_id = item.id
      CROSS JOIN calendar
      WHERE item.user_id = ${userId} AND item.course_id = ${courseId}
        AND item.kind LIKE 'lexeme-%'
      GROUP BY item.ref_id, calendar.day, calendar.zone
    ) activity
  `)
  return {
    day: rows[0]?.day ?? '',
    ...buildDailyWordLists(rows),
    learnedToday: Number(activity.rows[0]?.learned ?? 0),
    practicedToday: Number(activity.rows[0]?.practiced ?? 0),
    nextReviewAt: rows[0]?.next_review_at ? new Date(rows[0].next_review_at).toISOString() : null,
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
    || (isBrainstorm ? answers.length < 1 || answers.length > WORD_FORMATS.length : answers.length !== 1)
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

  const { item } = first
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
  // A single statement is atomic with either Postgres driver. The guarded
  // per-skill upsert decides which results may be logged; the daily row is only activity.
  const { rows } = await pg.execute<{ id: string; reviewed_at: string | Date }>(sql`
    WITH calendar AS (${calendar(userId)}), input AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(data)}::jsonb) AS a(
        item_id text, kind text, due timestamptz, reviewed_at timestamptz, stability real,
        difficulty real, elapsed_days integer, scheduled_days integer, learning_steps integer,
        reps integer, lapses integer, state integer, log_id text, rating integer, log_state integer,
        log_stability real, log_difficulty real, log_elapsed_days integer, log_scheduled_days integer,
        response_ms integer, day_number integer, exercise_id text, attempts integer, correct integer,
        answer text, expected text, error_kind text
      )
    ), eligible AS (
      SELECT calendar.now AS answered_at, input.*
      FROM calendar CROSS JOIN input
      WHERE NOT EXISTS (SELECT 1 FROM review_logs WHERE review_logs.id = input.log_id)
        AND NOT EXISTS (
          SELECT 1 FROM lexeme_status WHERE user_id = ${userId} AND course_id = ${courseId}
            AND lexeme_id = ${item.refId} AND status = 'known'
        )
    ), scheduled AS (
      INSERT INTO study_items (
        id, user_id, course_id, kind, ref_id, due, stability, difficulty, elapsed_days,
        scheduled_days, learning_steps, reps, lapses, state, last_review
      )
      SELECT item_id, ${userId}, ${courseId}, kind, ${lexemeId},
        answered_at + greatest(interval '0 seconds', due - reviewed_at),
        stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses,
        state, answered_at FROM eligible ORDER BY item_id
      ON CONFLICT (user_id, id) DO UPDATE SET due = excluded.due, stability = excluded.stability,
        difficulty = excluded.difficulty, elapsed_days = excluded.elapsed_days, scheduled_days = excluded.scheduled_days,
        learning_steps = excluded.learning_steps, reps = excluded.reps, lapses = excluded.lapses,
        state = excluded.state, last_review = excluded.last_review, updated_at = now()
      WHERE study_items.due <= excluded.last_review
        AND (study_items.last_review IS NULL OR study_items.last_review < excluded.last_review)
      RETURNING id
    ), logged AS (
      INSERT INTO review_logs (id, user_id, study_item_id, rating, state, stability, difficulty,
        elapsed_days, scheduled_days, reviewed_at, exercise_id, response_ms)
      SELECT log_id, ${userId}, item_id, rating, log_state, log_stability, log_difficulty,
        log_elapsed_days, log_scheduled_days, answered_at, exercise_id, response_ms
      FROM eligible JOIN scheduled ON scheduled.id = eligible.item_id
      RETURNING id, reviewed_at
    ), recorded AS (
      INSERT INTO exercise_results (user_id, course_id, day_number, exercise_id, attempts, correct, answer, expected, error_kind, completed_at)
      SELECT ${userId}, ${courseId}, day_number, exercise_id, attempts, correct,
        answer, expected, error_kind, answered_at FROM eligible JOIN logged ON logged.id = eligible.log_id
      ON CONFLICT (user_id, course_id, day_number, exercise_id) DO UPDATE SET attempts = excluded.attempts,
        correct = excluded.correct, answer = excluded.answer, expected = excluded.expected,
        error_kind = excluded.error_kind, completed_at = excluded.completed_at, updated_at = now()
    ), daily_activity AS (
      INSERT INTO daily_word_reviews (user_id, course_id, day, lexeme_id, answer_id, format, answered_at)
      SELECT ${userId}, ${courseId}, calendar.day::text, ${lexemeId}, logged.id, ${submission.format}, logged.reviewed_at
      FROM logged CROSS JOIN calendar ORDER BY logged.id LIMIT 1
      ON CONFLICT (user_id, course_id, day, lexeme_id) DO UPDATE SET
        answer_id = excluded.answer_id, format = excluded.format, answered_at = excluded.answered_at
      WHERE daily_word_reviews.answered_at < excluded.answered_at
    )${session ? sql`, completed_word AS (
      INSERT INTO lesson_sessions (id, user_id, course_id, day_number, kind, started_at,
        completed_at, planned_budget_ms, actual_ms, items_reviewed, items_correct)
      SELECT ${session.id}, ${userId}, ${courseId}, ${session.dayNumber},
        CASE WHEN bool_and(eligible.correct = 1) THEN 'words' ELSE 'words-failed' END,
        least(${session.startedAt.toISOString()}::timestamptz, min(eligible.answered_at)), max(eligible.answered_at),
        sum(eligible.attempts)::integer * 20000,
        least(2147483647, greatest(0, extract(epoch FROM max(eligible.answered_at) - ${session.startedAt.toISOString()}::timestamptz) * 1000))::integer,
        sum(eligible.attempts)::integer, sum(eligible.correct)::integer
      FROM eligible JOIN logged ON logged.id = eligible.log_id
      HAVING count(*) > 0
      ON CONFLICT (user_id, id) DO NOTHING
    )` : sql.empty()}
    SELECT id, reviewed_at FROM logged
    UNION ALL
    SELECT review_logs.id, review_logs.reviewed_at FROM review_logs JOIN input ON review_logs.id = input.log_id
      AND review_logs.study_item_id = input.item_id WHERE review_logs.user_id = ${userId}

  `)
  // A concurrent idempotent retry may not see the first statement's commit.
  const accepted = rows.length ? rows : (await pg.execute<{ id: string; reviewed_at: string | Date }>(sql`
    SELECT logs.id, logs.reviewed_at FROM review_logs logs
      JOIN jsonb_to_recordset(${JSON.stringify(answers.map(({ log, item }) => ({ id: log.id, item_id: item.id })))}::jsonb)
        AS submitted(id text, item_id text) ON submitted.id = logs.id AND submitted.item_id = logs.study_item_id
      WHERE logs.user_id = ${userId}
  `)).rows
  return { answeredAt: accepted[0]?.reviewed_at ?? null, acceptedLogIds: accepted.map(({ id }) => id) }
})
