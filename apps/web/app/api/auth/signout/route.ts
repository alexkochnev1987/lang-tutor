/**
 * Выход.
 *
 * Чистим cookie — и всё. Строка пользователя в базе остаётся: прогресс
 * никуда не девается, при следующем входе через Google он вернётся.
 */
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
