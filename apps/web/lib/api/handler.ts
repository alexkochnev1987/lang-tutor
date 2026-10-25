/**
 * Обвязка route handler'ов.
 *
 * Каждый роут работает от имени конкретного пользователя, и ни один из
 * них не принимает userId из тела запроса — иначе подменой одного поля
 * читался бы чужой прогресс. Идентификатор берётся только из подписанной
 * cookie, а если её нет, заводится гость и cookie ставится тут же.
 */
import { NextResponse } from 'next/server'
import { cookieOptions, resolveUser, SESSION_COOKIE, signSession } from '@/lib/auth/session'

export type Handler<T> = (ctx: { userId: string; req: Request }) => Promise<T>

export function withUser<T>(handler: Handler<T>) {
  return async (req: Request): Promise<NextResponse> => {
    let userId: string
    let setCookie: boolean
    try {
      ({ userId, setCookie } = await resolveUser())
    } catch (e) {
      // Чаще всего это незаданный DATABASE_URL или недоступная база.
      // Отдаём 503 с внятным текстом, а не падаем в generic 500.
      const message = e instanceof Error ? e.message : 'database_unavailable'
      return NextResponse.json({ error: 'database_unavailable', message }, { status: 503 })
    }

    try {
      const body = await handler({ userId, req })
      const res = NextResponse.json(body ?? { ok: true })
      if (setCookie) res.cookies.set(SESSION_COOKIE, await signSession(userId), cookieOptions)
      return res
    } catch (e) {
      const message = e instanceof Error ? e.message : 'internal_error'
      console.error('[api]', message)
      return NextResponse.json({ error: 'internal_error', message }, { status: 500 })
    }
  }
}
