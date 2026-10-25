import { and, eq, isNull } from 'drizzle-orm'
import { pg } from '@/lib/db/pg'
import { personalDict } from '@/lib/db/schema'
import { withUser } from '@/lib/api/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COURSE_ID = process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru'

interface Body {
  id?: string
  lemma: string
  translation: string
  sourceUrl?: string | null
  context?: string | null
  linkedLexemeId?: string | null
}

export const POST = withUser(async ({ userId, req }) => {
  const body = await req.json() as Body
  const lemma = body.lemma?.trim().slice(0, 120)
  const translation = body.translation?.trim().slice(0, 240)
  if (!lemma || !translation) throw new Error('bad_personal_word')

  const [existing] = await pg.select({ id: personalDict.id })
    .from(personalDict)
    .where(and(
      eq(personalDict.userId, userId),
      eq(personalDict.courseId, COURSE_ID),
      eq(personalDict.lemma, lemma),
      isNull(personalDict.deletedAt),
    ))
    .limit(1)

  if (existing) return { ok: true, id: existing.id, alreadySaved: true }

  const id = body.id?.trim() || crypto.randomUUID()
  await pg.insert(personalDict).values({
    id,
    userId,
    courseId: COURSE_ID,
    lemma,
    translation,
    sourceUrl: body.sourceUrl?.trim().slice(0, 500) || null,
    context: body.context?.trim().slice(0, 500) || null,
    linkedLexemeId: body.linkedLexemeId?.trim() || null,
  })

  return { ok: true, id, alreadySaved: false }
})
