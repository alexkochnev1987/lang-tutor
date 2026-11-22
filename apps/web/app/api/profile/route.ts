import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { withUser } from '@/lib/api/handler'
import { fullProfileName, parseProfileName } from '@/lib/data/profile-name'
import { pg } from '@/lib/db/pg'
import { users } from '@/lib/db/schema'

export const runtime = 'nodejs'

export const PATCH = withUser(async ({ userId, req }) => {
  const profileName = parseProfileName(await req.json().catch(() => null))
  if (!profileName) return NextResponse.json({ error: 'invalid_profile_name' }, { status: 400 })

  const [updated] = await pg.update(users)
    .set({ settings: sql`${users.settings} || ${JSON.stringify({ profileName })}::jsonb` })
    .where(and(eq(users.id, userId), isNotNull(users.googleSub)))
    .returning()

  if (!updated) return NextResponse.json({ error: 'sign_in_required' }, { status: 403 })
  return { id: updated.id, ...profileName, name: fullProfileName(profileName) }
})
