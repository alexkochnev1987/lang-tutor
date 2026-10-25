/** Старт курса: результат входной диагностики (трек) и дневной бюджет. */
import { sql } from 'drizzle-orm'
import { pg } from '@/lib/db/pg'
import { userCourses } from '@/lib/db/schema'
import { withUser } from '@/lib/api/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COURSE_ID = process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru'
const TRACKS = new Set(['a0', 'a2', 'b1-minus'])

export const POST = withUser(async ({ userId, req }) => {
  const body = await req.json() as { entryTrack?: string; dailyBudgetMinutes?: number }
  if (!body.entryTrack || !TRACKS.has(body.entryTrack)) throw new Error('bad_entry_track')

  await pg.insert(userCourses).values({
    userId,
    courseId: COURSE_ID,
    startedAt: new Date(),
    entryTrack: body.entryTrack,
    dailyBudgetMinutes: body.dailyBudgetMinutes ?? 15,
  }).onConflictDoUpdate({
    target: [userCourses.userId, userCourses.courseId],
    set: {
      entryTrack: body.entryTrack,
      dailyBudgetMinutes: body.dailyBudgetMinutes ?? 15,
      updatedAt: sql`now()`,
    },
  })
  return { ok: true }
})
