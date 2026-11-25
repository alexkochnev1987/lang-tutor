import { readingFilename, selectReadingEntry, selectDailyReadingEntries } from '../lib/content/reading-catalog'

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


describe('daily reading selection', () => {
  it('prefers the exact day and excludes preview and future passages', () => {
    expect(selectDailyReadingEntries([legacy, daily, preview], 54, 3, new Set(), new Set()).map(e => e.id)).toEqual([daily.id, legacy.id])
    expect(selectDailyReadingEntries([legacy, daily, preview], 53, 1, new Set(), new Set())).toEqual([legacy])
  })
  it('resumes a passage already started today and supports disabling reading', () => {
    expect(selectDailyReadingEntries([legacy, daily], 54, 1, new Set([legacy.id]), new Set([legacy.id]))).toEqual([legacy])
    expect(selectDailyReadingEntries([legacy, daily], 54, 0, new Set(), new Set())).toEqual([])
  })
})


it('includes released practice passages but not preview-only passages', () => {
  const practice = { ...daily, status: 'practice' }
  expect(selectDailyReadingEntries([legacy, practice, preview], 54, 1, new Set(), new Set())).toEqual([practice])
  expect(selectReadingEntry([legacy, practice, preview], 54)).toEqual(practice)
})


import { readingProgress, readingResultIndex, readingBacklog } from '../lib/content/reading-progress'
const passage = { ...daily, questionIds: ['a','b'] }
const answer = (exerciseId, correct, time=1) => ({ exerciseId, dayNumber: 54, correct, completedAt: new Date(time) })
it('separates unfinished passages from completed mistakes and uses latest practice answer', () => {
  const first = answer('ex.reading.day54.a', false)
  expect(readingProgress(passage, readingResultIndex([first])).status).toBe('unfinished')
  const second = answer('ex.reading.day54.b', true)
  expect(readingProgress(passage, readingResultIndex([first, second])).status).toBe('mistakes')
  const fixed = answer('practice:ex.reading.day54.a', true, 2)
  expect(readingProgress(passage, readingResultIndex([fixed, first, second])).status).toBe('done')
})
it('counts only missed curriculum texts from completed days', () => {
  expect(readingBacklog([passage, {...preview, questionIds:['a']}], [], new Set([54,55]))).toEqual({missed:1, unfinished:0, mistakes:0})
  expect(readingBacklog([passage], [], new Set()).missed).toBe(0)
})
