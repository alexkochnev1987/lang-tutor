/** Завершённое занятие. По количеству таких записей считается учебный день. */
import { pg } from '@/lib/db/pg'
import { lessonSessions } from '@/lib/db/schema'
import { withUser } from '@/lib/api/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COURSE_ID = process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru'

interface Body {
  id: string
  dayNumber: number
  startedAt: string
  completedAt?: string
  plannedBudgetMs: number
  actualMs?: number
  itemsReviewed: number
  itemsCorrect: number
}

export const POST = withUser(async ({ userId, req }) => {
  const b = await req.json() as Body
  if (!b?.id || !Number.isFinite(b.dayNumber)) throw new Error('bad_session')

  await pg.insert(lessonSessions).values({
    id: b.id,
    userId,
    courseId: COURSE_ID,
    dayNumber: b.dayNumber,
    startedAt: new Date(b.startedAt),
    completedAt: b.completedAt ? new Date(b.completedAt) : null,
    plannedBudgetMs: b.plannedBudgetMs,
    actualMs: b.actualMs ?? null,
    itemsReviewed: b.itemsReviewed,
    itemsCorrect: b.itemsCorrect,
  // повторный POST того же занятия (кнопка нажата дважды) — не дубль
  }).onConflictDoNothing()

  return { ok: true }
})
