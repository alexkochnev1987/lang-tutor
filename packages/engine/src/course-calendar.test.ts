import { describe, expect, it } from 'vitest'
import { completionPercent, courseDayStatus } from './course-calendar'

describe('course calendar', () => {
  it('marks completed, current, and upcoming program days', () => {
    const completed = new Set([1, 2, 4])

    expect(courseDayStatus(2, 4, completed)).toBe('completed')
    expect(courseDayStatus(4, 4, completed)).toBe('completed')
    expect(courseDayStatus(3, 3, completed)).toBe('current')
    expect(courseDayStatus(8, 3, completed)).toBe('upcoming')
  })

  it('returns a bounded whole-number completion percentage', () => {
    expect(completionPercent(182, new Set([1, 2, 3]))).toBe(2)
    expect(completionPercent(0, new Set([1]))).toBe(0)
  })
})
