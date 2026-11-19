import { NextResponse } from 'next/server'
import { validateSessionForm, type TrainingSession } from '@polski/engine'

let sessions: TrainingSession[] = [
  {
    id: 'session-1',
    title: 'Повторение грамматики B1',
    status: 'planned',
    startsAt: '2026-12-02T09:00:00.000Z',
  },
  {
    id: 'session-2',
    title: 'Разговорная практика',
    status: 'completed',
    startsAt: '2026-11-12T17:30:00.000Z',
  },
  {
    id: 'session-3',
    title: 'Письмо: формат экзамена',
    status: 'planned',
    startsAt: '2026-12-05T11:00:00.000Z',
  },
]

export async function GET() {
  return NextResponse.json({ sessions })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Partial<TrainingSession> | null
  const title = typeof body?.title === 'string' ? body.title : ''
  const startsAt = typeof body?.startsAt === 'string' ? body.startsAt : ''
  const errors = validateSessionForm({ title, startsAt })

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 })
  }

  const session: TrainingSession = {
    id: `session-${Date.now()}`,
    title: title.trim(),
    status: 'planned',
    startsAt: new Date(startsAt).toISOString(),
  }

  sessions = [session, ...sessions]
  return NextResponse.json({ session }, { status: 201 })
}
