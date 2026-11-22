import type { LessonSessionRow } from '../data/types'

export const WEEKLY_GOAL = 5

const DAY_MS = 86_400_000

/** Represent calendar dates in the study time zone as UTC midnights so date
 * arithmetic is unaffected by daylight saving time. */
function studyCalendar(timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
  })

  return (date: Date): number => {
    const parts = formatter.formatToParts(date)
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
    return Date.UTC(get('year'), get('month') - 1, get('day'))
  }
}

export function weeklyProgress(sessions: readonly LessonSessionRow[], timeZone: string, now: Date) {
  const calendarDay = studyCalendar(timeZone)
  const today = calendarDay(now)
  const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS
  const activeDays = new Set<number>()

  for (const session of sessions) {
    if (!session.completedAt || session.completedAt > now) continue
    // Diagnostic sessions have a duration but zero reviewed items. Empty
    // curriculum skips have neither. A completed word attempt counts even if it failed.
    if (session.itemsReviewed === 0 && !(session.kind === 'day' && (session.actualMs ?? 0) > 0)) continue
    const day = calendarDay(session.completedAt)
    if (day >= monday && day <= today) activeDays.add(day)
  }

  return {
    count: activeDays.size,
    todayComplete: activeDays.has(today),
    days: Array.from({ length: 7 }, (_, index) => {
      const date = monday + index * DAY_MS
      const status = activeDays.has(date) ? 'complete' : date === today ? 'today' : date < today ? 'missed' : 'upcoming'
      return { date, status, isToday: date === today } as const
    }),
  }
}
