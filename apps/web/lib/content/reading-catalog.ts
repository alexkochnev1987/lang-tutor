export type ReadingStatus = 'legacy' | 'approved' | 'practice' | 'preview'

export interface ReadingCatalogEntry {
  id: string
  title: string
  file: string
  status: ReadingStatus
  day?: number
  level?: 'A1' | 'A2' | 'B1'
}

export interface ReadingCatalog {
  version: 1
  entries: ReadingCatalogEntry[]
}

/** Never substitute a draft or a passage assigned to a different curriculum day. */
export function selectReadingEntry(entries: ReadingCatalogEntry[], day: number): ReadingCatalogEntry | undefined {
  if (!Number.isSafeInteger(day) || day < 1) return undefined
  const daily = entries.find(entry => (entry.status === 'approved' || entry.status === 'practice') && entry.day === day)
  if (daily) return daily
  const legacy = entries.filter(entry => entry.status === 'legacy')
  return legacy[(day - 1) % legacy.length]
}

export function readingFilename(entry: ReadingCatalogEntry): string {
  const prefix = entry.status === 'legacy' ? 'legacy' : 'day'
  if (!new RegExp('^' + prefix + '-[0-9]{3,}\\.json$').test(entry.file)) throw new Error('invalid_reading_file')
  if (entry.status !== 'legacy' &&
    (!Number.isSafeInteger(entry.day) || !entry.day || entry.day < 1 ||
      entry.file !== 'day-' + String(entry.day).padStart(3, '0') + '.json')) throw new Error('invalid_reading_day')
  return entry.file
}

/** Prefer the exact curriculum day, preserve resumed passages, and rotate legacy fallbacks. */
export function selectDailyReadingEntries(entries: ReadingCatalogEntry[], day: number, count: number, seen: ReadonlySet<string>, today: ReadonlySet<string>): ReadingCatalogEntry[] {
  if (!Number.isSafeInteger(day) || day < 1 || !Number.isInteger(count) || count <= 0) return []
  const legacy = entries.filter(entry => entry.status === 'legacy')
  const offset = legacy.length ? (day - 1) % legacy.length : 0
  const approved = entries.filter(entry => (entry.status === 'approved' || entry.status === 'practice') && entry.day !== undefined && entry.day <= day).sort((a, b) => b.day! - a.day!)
  const pool = [...approved, ...legacy.slice(offset), ...legacy.slice(0, offset)]
  const exact = approved.find(entry => entry.day === day)
  const rank = (entry: ReadingCatalogEntry) => today.has(entry.id) ? 0 : entry.id === exact?.id ? 1 : !seen.has(entry.id) ? 2 : 3
  return pool.sort((a, b) => rank(a) - rank(b)).slice(0, count)
}
