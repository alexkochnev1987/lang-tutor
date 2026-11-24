import { describe, expect, it } from 'vitest'
import {
  buildDailyWordLists, projectDailyWordQueue, wordsForFormat, WORD_SKILL_FORMATS, wordSkill,
} from '../../../apps/web/lib/engine/daily-words.ts'

const kinds = WORD_SKILL_FORMATS.map(wordSkill)
const now = Date.parse('2026-11-24T08:00:00Z')
const queue = (rows) => ({ day: '2026-11-24', ...buildDailyWordLists(rows), practicedToday: 0 })
const row = (id, due_kinds, extra = {}) => ({ id, seen: true, known: false, kinds, due_kinds, ...extra })
const answer = (id, format, due = now + 600_000) => ({ format, item: { refId: id, due: new Date(due) } })

describe('daily review queue by skill', () => {
  it('counts unique words and selects only outstanding formats', () => {
    const q = queue([row('a', [wordSkill('translation'), wordSkill('writing')]), row('b', [wordSkill('pronunciation')]), row('known', kinds, { known: true })])
    expect(q.review).toEqual(['a', 'b'])
    expect(wordsForFormat(q, 'review', 'translation')).toEqual(['a'])
    expect(wordsForFormat(q, 'review', 'brainstorm')).toEqual(['a'])
    expect(wordsForFormat(q, 'review', 'pronunciation')).toEqual(['b'])
  })
  it('does not treat missing skills or a new word as completed', () => {
    const q = queue([row('a', [], { kinds: [wordSkill('translation')] }), row('new', null, { seen: false, kinds: null })])
    expect(q.learn).toEqual(['new'])
    expect(q.review).toEqual(['a'])
    expect(wordsForFormat(q, 'review', 'translation')).toEqual([])
    expect(wordsForFormat(q, 'review', 'pronunciation')).toEqual(['a'])
    const next = projectDailyWordQueue(q, [answer('new', 'translation')], now)
    expect(next.learn).toEqual([])
    expect(next.review).toEqual(['a', 'new'])
    expect(next.reviewByFormat.translation).toEqual([])
    expect(next.reviewByFormat.writing).toEqual(['a', 'new'])
  })
  it('removes only the answered skill, then the word when every skill is scheduled', () => {
    const q = queue([row('a', [wordSkill('translation'), wordSkill('writing')])])
    const first = projectDailyWordQueue(q, [answer('a', 'translation')], now)
    expect(first.review).toEqual(['a'])
    expect(first.reviewByFormat.translation).toEqual([])
    expect(first.reviewByFormat.writing).toEqual(['a'])
    expect(q.reviewByFormat.translation).toEqual(['a'])
    const last = projectDailyWordQueue(first, [answer('a', 'writing')], now)
    expect(last.review).toEqual([])
    expect(last.nextReviewAt).toBe(new Date(now + 600_000).toISOString())
  })
  it('keeps an immediately due or failed skill available', () => {
    const q = queue([row('a', [wordSkill('writing')])])
    expect(projectDailyWordQueue(q, [answer('a', 'writing', now)], now).review).toEqual(['a'])
    const retry = projectDailyWordQueue(q, [answer('a', 'writing', now + 60_000)], now)
    expect(retry.review).toEqual([])
    expect(retry.nextReviewAt).toBe(new Date(now + 60_000).toISOString())
  })
})
