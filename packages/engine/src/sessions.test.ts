import { describe, expect, it } from 'vitest'
import { filterSessions, validateSessionForm, type TrainingSession } from './sessions'

const sessions: TrainingSession[] = [
  { id: '1', title: 'Повторение грамматики', status: 'planned', startsAt: '2026-12-01T09:00:00.000Z' },
  { id: '2', title: 'Разговорная практика', status: 'completed', startsAt: '2026-11-01T09:00:00.000Z' },
]

describe('training sessions', () => {
  it('filters the list by the selected status while keeping All intact', () => {
    expect(filterSessions(sessions, 'all')).toHaveLength(2)
    expect(filterSessions(sessions, 'planned')).toEqual([sessions[0]])
  })

  it('rejects invalid title and non-future start time', () => {
    const errors = validateSessionForm(
      { title: ' a ', startsAt: '2026-11-19T10:00' },
      new Date('2026-11-19T12:00:00'),
    )

    expect(errors.title).toContain('3')
    expect(errors.startsAt).toContain('будущем')
  })
})
