export type CourseDayStatus = 'completed' | 'current' | 'upcoming'

export function courseDayStatus(
  day: number,
  currentDay: number,
  completedDays: ReadonlySet<number>,
): CourseDayStatus {
  if (completedDays.has(day)) return 'completed'
  if (day === currentDay) return 'current'
  return 'upcoming'
}

export function completionPercent(totalDays: number, completedDays: ReadonlySet<number>): number {
  if (totalDays <= 0) return 0
  return Math.round((completedDays.size / totalDays) * 100)
}
