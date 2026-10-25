import { sql } from 'drizzle-orm'
import { pg } from '@/lib/db/pg'
import { exerciseResults } from '@/lib/db/schema'
import { withUser } from '@/lib/api/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COURSE_ID = process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru'

interface Body {
  dayNumber: number
  exerciseId: string
  attempts: number
  correct: boolean
  answer: string
  expected: string
  errorKind?: 'wrong-form' | 'diacritic' | 'typo' | 'wrong-word' | null
  completedAt?: string
}

export const POST = withUser(async ({ userId, req }) => {
  const body = await req.json() as Body
  if (!Number.isInteger(body.dayNumber) || body.dayNumber < 1) throw new Error('bad_day_number')
  if (!body.exerciseId?.trim() || !body.answer?.trim() || !body.expected?.trim()) {
    throw new Error('bad_exercise_result')
  }

  await pg.insert(exerciseResults).values({
    userId,
    courseId: COURSE_ID,
    dayNumber: body.dayNumber,
    exerciseId: body.exerciseId.trim(),
    attempts: Math.max(1, Math.min(10, Math.trunc(body.attempts))),
    correct: body.correct ? 1 : 0,
    answer: body.answer.trim().slice(0, 1000),
    expected: body.expected.trim().slice(0, 1000),
    errorKind: body.errorKind ?? null,
    completedAt: body.completedAt ? new Date(body.completedAt) : new Date(),
  }).onConflictDoUpdate({
    target: [exerciseResults.userId, exerciseResults.courseId, exerciseResults.dayNumber, exerciseResults.exerciseId],
    set: {
      attempts: Math.max(1, Math.min(10, Math.trunc(body.attempts))),
      correct: body.correct ? 1 : 0,
      answer: body.answer.trim().slice(0, 1000),
      expected: body.expected.trim().slice(0, 1000),
      errorKind: body.errorKind ?? null,
      completedAt: body.completedAt ? new Date(body.completedAt) : new Date(),
      updatedAt: sql`now()`,
    },
  })

  return { ok: true }
})
