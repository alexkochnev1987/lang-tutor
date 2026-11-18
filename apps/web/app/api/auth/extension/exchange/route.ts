import { createHash } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { pg } from '@/lib/db/pg'
import { extensionAuthCodes, users } from '@/lib/db/schema'
import { signExtensionToken } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json() as { code?: string }
    const code = body.code?.trim()
    if (!code || code.length < 30) return NextResponse.json({ error: 'invalid_code' }, { status: 400 })

    const codeHash = createHash('sha256').update(code).digest('hex')
    const now = new Date()
    const [claimed] = await pg.update(extensionAuthCodes)
      .set({ usedAt: now })
      .where(and(
        eq(extensionAuthCodes.codeHash, codeHash),
        isNull(extensionAuthCodes.usedAt),
        gt(extensionAuthCodes.expiresAt, now),
      ))
      .returning()

    if (!claimed) return NextResponse.json({ error: 'expired_or_used_code' }, { status: 401 })

    const [user] = await pg.select({ id: users.id, email: users.email, name: users.name, picture: users.picture })
      .from(users).where(eq(users.id, claimed.userId)).limit(1)
    if (!user) return NextResponse.json({ error: 'user_not_found' }, { status: 401 })

    const token = await signExtensionToken(user.id)
    return NextResponse.json({ token, user })
  } catch (error) {
    console.error('[extension-auth]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'extension_auth_failed' }, { status: 500 })
  }
}
