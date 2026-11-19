'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Row, Stack } from '@polski/ui'
import {
  filterSessions,
  validateSessionForm,
  type SessionFilter,
  type TrainingSession,
} from '@polski/engine'

type FormValues = { title: string; startsAt: string }
type FieldErrors = Partial<Record<keyof FormValues, string>>

const EMPTY_FORM: FormValues = { title: '', startsAt: '' }

function formatStart(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function SessionsWorkspace() {
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [filter, setFilter] = useState<SessionFilter>('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [form, setForm] = useState<FormValues>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const response = await fetch('/api/sessions')
      if (!response.ok) throw new Error('load failed')
      const data = await response.json() as { sessions: TrainingSession[] }
      setSessions(data.sessions)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadSessions() }, [loadSessions])

  const visibleSessions = useMemo(() => filterSessions(sessions, filter), [sessions, filter])

  function updateForm(name: keyof FormValues, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setSubmitError('')
  }

  async function createSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const errors = validateSessionForm(form)
    setFieldErrors(errors)
    setSubmitError('')
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json() as { session?: TrainingSession; errors?: FieldErrors }
      if (!response.ok || !data.session) {
        setFieldErrors(data.errors ?? {})
        setSubmitError('Не удалось создать занятие. Проверьте данные и попробуйте ещё раз.')
        return
      }
      setSessions((current) => [data.session!, ...current])
      setForm(EMPTY_FORM)
      setFieldErrors({})
    } catch {
      setSubmitError('Сеть недоступна. Проверьте подключение и попробуйте ещё раз.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack gap="lg">
      <Card>
        <Stack gap="md">
          <Row justify="between" gap="sm">
            <h2 className="text-base font-semibold">Ближайшие занятия</h2>
            <span className="text-sm text-muted">{visibleSessions.length}</span>
          </Row>

          <div className="flex gap-2" role="group" aria-label="Фильтр занятий">
            {(['all', 'planned'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`min-h-10 rounded-pill px-4 text-sm ${filter === value ? 'bg-primary text-on-primary' : 'bg-soft text-muted hover:text-ink'}`}
              >
                {value === 'all' ? 'Все' : 'Запланированные'}
              </button>
            ))}
          </div>

          {loading && <p className="text-sm text-muted" role="status">Загружаем занятия…</p>}
          {!loading && loadError && (
            <Stack gap="sm" className="rounded-card bg-danger-bg p-3">
              <p className="text-sm text-danger-ink">Не удалось загрузить занятия.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadSessions()}>Повторить</Button>
            </Stack>
          )}
          {!loading && !loadError && visibleSessions.length === 0 && (
            <p className="text-sm text-muted">Для этого фильтра занятий пока нет.</p>
          )}
          {!loading && !loadError && visibleSessions.length > 0 && (
            <ul className="flex flex-col gap-2">
              {visibleSessions.map((session) => (
                <li key={session.id} className="rounded-card border border-line bg-soft px-3 py-3">
                  <Row justify="between" gap="sm">
                    <Stack gap="xs">
                      <strong className="text-sm">{session.title}</strong>
                      <span className="text-xs text-muted">{formatStart(session.startsAt)}</span>
                    </Stack>
                    <span className={`shrink-0 rounded-pill px-2 py-1 text-xs ${session.status === 'planned' ? 'bg-ok-bg text-ok-ink' : 'bg-soft2 text-muted'}`}>
                      {session.status === 'planned' ? 'Запланировано' : 'Завершено'}
                    </span>
                  </Row>
                </li>
              ))}
            </ul>
          )}
        </Stack>
      </Card>

      <Card>
        <form onSubmit={createSession} noValidate>
          <Stack gap="md">
            <Stack gap="xs">
              <h2 className="text-base font-semibold">Создать занятие</h2>
              <p className="text-sm text-muted">Добавьте тему и удобное время в будущем.</p>
            </Stack>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Название</span>
              <input
                name="title"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? 'session-title-error' : undefined}
                className="min-h-12 w-full rounded-card border border-line bg-bg px-3 text-ink"
                placeholder="Например, разговорная практика"
              />
              {fieldErrors.title && <span id="session-title-error" className="mt-1 block text-xs text-danger">{fieldErrors.title}</span>}
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Дата и время</span>
              <input
                type="datetime-local"
                name="startsAt"
                value={form.startsAt}
                onChange={(event) => updateForm('startsAt', event.target.value)}
                aria-invalid={Boolean(fieldErrors.startsAt)}
                aria-describedby={fieldErrors.startsAt ? 'session-start-error' : undefined}
                className="min-h-12 w-full rounded-card border border-line bg-bg px-3 text-ink"
              />
              {fieldErrors.startsAt && <span id="session-start-error" className="mt-1 block text-xs text-danger">{fieldErrors.startsAt}</span>}
            </label>
            {submitError && <p className="text-sm text-danger" role="alert">{submitError}</p>}
            <Button type="submit" size="lg" full disabled={submitting} aria-busy={submitting}>
              {submitting ? 'Создаём…' : 'Создать занятие'}
            </Button>
          </Stack>
        </form>
      </Card>
    </Stack>
  )
}
