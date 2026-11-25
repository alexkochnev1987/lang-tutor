import type { ReadingCatalogEntry } from './reading-catalog'

export const READING_PRACTICE_PREFIX = 'practice:'
export type ReadingFilter = 'all' | 'new' | 'unfinished' | 'mistakes' | 'done'
export type ReadingResult = { exerciseId: string; dayNumber: number; correct: boolean; completedAt: Date }
export function readingExerciseIds(entry: ReadingCatalogEntry): string[] {
  return (entry.questionIds ?? []).map(id => 'ex.reading.' + entry.id + '.' + id)
}

/** Latest answer per question across daily lessons and independent practice. */
export function readingResultIndex(results: readonly ReadingResult[]): Map<string, ReadingResult> {
  const latest = new Map<string, ReadingResult>()
  for (const row of results) {
    const id = row.exerciseId.startsWith(READING_PRACTICE_PREFIX) ? row.exerciseId.slice(READING_PRACTICE_PREFIX.length) : row.exerciseId
    if (!id.startsWith('ex.reading.')) continue
    const previous = latest.get(id)
    if (!previous || +row.completedAt >= +previous.completedAt) latest.set(id, row)
  }
  return latest
}

export function readingProgress(entry: ReadingCatalogEntry, latest: ReadonlyMap<string, ReadingResult>) {
  const ids = readingExerciseIds(entry)
  const remaining = ids.filter(id => !latest.has(id))
  const mistakes = ids.filter(id => latest.get(id)?.correct === false)
  const total = ids.length
  const answered = total - remaining.length
  const correct = answered - mistakes.length
  const status: Exclude<ReadingFilter, 'all'> | 'unknown' = !total ? 'unknown' : !answered ? 'new' : remaining.length ? 'unfinished' : mistakes.length ? 'mistakes' : 'done'
  return { total, answered, correct, remaining, mistakes, status }
}

export function readingBacklog(entries: readonly ReadingCatalogEntry[], results: readonly ReadingResult[], completedDays: ReadonlySet<number>) {
  const latest = readingResultIndex(results)
  let missed = 0, unfinished = 0, mistakes = 0
  for (const entry of entries) {
    if (entry.status === 'preview') continue
    const p = readingProgress(entry, latest)
    if (p.status === 'new' && entry.day && completedDays.has(entry.day)) missed++
    if (p.status === 'unfinished') unfinished++
    if (p.mistakes.length) mistakes++
  }
  return { missed, unfinished, mistakes }
}
