export type SessionStatus = 'planned' | 'completed'

export type TrainingSession = {
  id: string
  title: string
  status: SessionStatus
  startsAt: string
}

export type SessionFilter = 'all' | SessionStatus

export type SessionFormValues = {
  title: string
  startsAt: string
}

export function filterSessions(
  sessions: TrainingSession[],
  filter: SessionFilter,
): TrainingSession[] {
  return filter === 'all' ? sessions : sessions.filter((session) => session.status === filter)
}

export function validateSessionForm(
  values: SessionFormValues,
  now = new Date(),
): Partial<Record<keyof SessionFormValues, string>> {
  const errors: Partial<Record<keyof SessionFormValues, string>> = {}
  const title = values.title.trim()

  if (title.length < 3 || title.length > 80) {
    errors.title = 'Название должно содержать от 3 до 80 символов.'
  }

  const startsAt = new Date(values.startsAt)
  if (!values.startsAt || Number.isNaN(startsAt.getTime()) || startsAt <= now) {
    errors.startsAt = 'Укажите дату и время в будущем.'
  }

  return errors
}
