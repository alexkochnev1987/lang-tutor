import { readingFilename, selectReadingEntry } from '../lib/content/reading-catalog'

const legacy = { id: 'old', status: 'legacy', title: 'Old', file: 'legacy-001.json' }
const daily = { id: 'day54', day: 54, status: 'approved', title: 'Daily', file: 'day-054.json' }
const preview = { id: 'day55', day: 55, status: 'preview', title: 'Preview', file: 'day-055.json' }

describe('reading selection and lazy paths', () => {
  it('prefers exact approved day, never a preview or another daily text', () => {
    expect(selectReadingEntry([legacy, daily, preview], 54)).toBe(daily)
    expect(selectReadingEntry([legacy, daily, preview], 55)).toBe(legacy)
    expect(selectReadingEntry([daily, preview], 55)).toBeUndefined()
    expect(selectReadingEntry([daily], 0)).toBeUndefined()
  })
  it('preserves the legacy rotation when a day is not published', () => {
    const second = { ...legacy, id: 'second', file: 'legacy-002.json' }
    expect(selectReadingEntry([legacy, daily, second], 2)).toBe(second)
    expect(selectReadingEntry([legacy, daily, second], 3)).toBe(legacy)
  })
  it('only accepts expected filenames and matching days', () => {
    expect(readingFilename(daily)).toBe('day-054.json')
    expect(readingFilename(legacy)).toBe('legacy-001.json')
    expect(() => readingFilename({ ...daily, file: '../reading.json' })).toThrow()
    expect(() => readingFilename({ ...daily, file: 'day-055.json' })).toThrow()
  })
})
