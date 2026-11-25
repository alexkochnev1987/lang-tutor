import { and, desc, eq, sql } from 'drizzle-orm'
import { withUser } from '@/lib/api/handler'
import { pg } from '@/lib/db/pg'
import { exerciseAttempts, lessonAssignments } from '@/lib/db/schema'
import { stageExerciseIds, type AssignmentMap } from '@/lib/engine/assignment-progress'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const COURSE_ID = process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru'
const allowed = new Set(['grammar','collocations','reading','exam'])

function dayFrom(req: Request) {
  const day = Number(new URL(req.url).searchParams.get('day'))
  if (!Number.isSafeInteger(day) || day < 1 || day > 10000) throw new Error('invalid_assignment_day')
  return day
}
function key(userId: string, day: number) {
  return and(eq(lessonAssignments.userId, userId), eq(lessonAssignments.courseId, COURSE_ID), eq(lessonAssignments.dayNumber, day))
}
async function get(userId: string, day: number) {
  const [row] = await pg.select({ stages: lessonAssignments.stages }).from(lessonAssignments).where(key(userId, day)).limit(1)
  return { stages: row?.stages ?? {} }
}
export const GET = withUser(async ({ userId, req }) => {
  if (new URL(req.url).searchParams.get('summary') === '1') {
    const rows = await pg.select({ dayNumber: lessonAssignments.dayNumber, stages: lessonAssignments.stages })
      .from(lessonAssignments).where(and(eq(lessonAssignments.userId, userId), eq(lessonAssignments.courseId, COURSE_ID)))
    // Only the latest archived record for each relevant ID is needed. A
    // deleted/reset result remains recoverable, without fetching full history.
    const archived = await pg.selectDistinctOn([exerciseAttempts.dayNumber, exerciseAttempts.exerciseId]).from(exerciseAttempts)
      .where(and(eq(exerciseAttempts.userId, userId), eq(exerciseAttempts.courseId, COURSE_ID),
        sql`${exerciseAttempts.exerciseId} ~ '^(review:)?(grammar-practice:)?ex[.](sgap|swrite|form|infl|collocation)[.]'`))
      .orderBy(exerciseAttempts.dayNumber, exerciseAttempts.exerciseId, desc(exerciseAttempts.completedAt))
    return { archive: archived.map(({userId: _user, ...row}) => ({...row, correct: Boolean(row.correct)})), summaries: rows.map(row => ({
      dayNumber: row.dayNumber,
      exerciseIds: Object.entries(row.stages as AssignmentMap).filter(([id]) => id !== 'reading')
        .flatMap(([,stage]) => stage ? stageExerciseIds(stage) : []),
    })) }
  }
  return get(userId, dayFrom(req))
})
export const POST = withUser(async ({ userId, req }) => {
  const day = dayFrom(req)
  const raw = await req.text()
  if (raw.length > 500_000) throw new Error('assignment_too_large')
  const stages = JSON.parse(raw) as AssignmentMap
  if (!stages || typeof stages !== 'object' || Array.isArray(stages)) throw new Error('invalid_assignment')
  for (const [id, stage] of Object.entries(stages)) {
    if (!allowed.has(id) || !stage || stage.id !== id || !Array.isArray(stage.steps) || stage.steps.length > 200 ||
        !Number.isFinite(stage.estimatedSec) || stage.estimatedSec < 0 ||
        stage.steps.some(step => !step || !['exercise','rule-intro','exercise-batch'].includes(step.kind))) throw new Error('invalid_assignment_stage')
  }
  if (Object.keys(stages).length) {
    // Existing stage wins on conflict: another device cannot replace an assignment.
    await pg.insert(lessonAssignments).values({ userId, courseId: COURSE_ID, dayNumber: day, stages })
      .onConflictDoUpdate({ target: [lessonAssignments.userId, lessonAssignments.courseId, lessonAssignments.dayNumber],
        set: { stages: sql`excluded.stages || ${lessonAssignments.stages}` } })
  }
  return get(userId, day)
})
