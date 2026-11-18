import { createHash, randomBytes } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { pg } from '@/lib/db/pg'
import { extensionAuthCodes, users } from '@/lib/db/schema'
import { withUser } from '@/lib/api/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

function allowedRedirect(uri: string): boolean {
  try {
    const parsed = new URL(uri)
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.chromiumapp.org')) return false
    const configuredId = process.env.CHROME_EXTENSION_ID?.trim()
    return !configuredId || parsed.hostname === `${configuredId}.chromiumapp.org`
  } catch {
    return false
  }
}

export const POST = withUser(async ({ userId, req }) => {
  const [user] = await pg.select({ googleSub: users.googleSub }).from(users)
    .where(and(eq(users.id, userId), isNull(users.googleSub))).limit(1)
  if (user) throw new Error('extension_login_required')

  const body = await req.json() as { redirectUri?: string; state?: string }
  const redirectUri = body.redirectUri?.trim()
  const state = body.state?.trim()
  if (!redirectUri || !allowedRedirect(redirectUri) || !state || state.length > 200) {
    throw new Error('invalid_extension_redirect')
  }

  const code = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
  await pg.insert(extensionAuthCodes).values({
    codeHash: hashCode(code),
    userId,
    redirectUri,
    expiresAt,
  })

  const target = new URL(redirectUri)
  target.searchParams.set('code', code)
  target.searchParams.set('state', state)
  return { redirectUrl: target.toString() }
})
