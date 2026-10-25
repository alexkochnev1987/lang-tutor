import { sql } from 'drizzle-orm'
import { pg } from '@/lib/db/pg'
import { lexemeStatus } from '@/lib/db/schema'
import { withUser } from '@/lib/api/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COURSE_ID = process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru'

interface Body {
  lexemeId: string
  status: 'known' | 'active'
}

export const POST = withUser(async ({ userId, req }) => {
  const { lexemeId, status } = await req.json() as Body
  if (!lexemeId || (status !== 'known' && status !== 'active')) throw new Error('bad_status')

  await pg.insert(lexemeStatus)
    .values({ userId, courseId: COURSE_ID, lexemeId, status })
    .onConflictDoUpdate({
      target: [lexemeStatus.userId, lexemeStatus.courseId, lexemeStatus.lexemeId],
      set: { status, markedAt: sql`now()`, updatedAt: sql`now()` },
    })

  return { ok: true }
})
