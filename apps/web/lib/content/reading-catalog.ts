export type ReadingStatus = 'legacy' | 'approved' | 'preview'

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
  const daily = entries.find(entry => entry.status === 'approved' && entry.day === day)
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
