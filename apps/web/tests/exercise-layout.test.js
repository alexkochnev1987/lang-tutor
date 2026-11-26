import { paginateText } from '../app/_components/PaginatedText'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { exerciseLayout, ExerciseActions, ExerciseAnswerForm, ExerciseCard, ExerciseFeedback, ExerciseOptions, ExercisePrompt, ExercisePromptArea, ExerciseResultMark, ExerciseSlot } from '../app/_components/exercise/ExerciseCard'

const render = (component, props, children) => renderToStaticMarkup(h(component, props, children))
const audio = h('button', { type: 'button' }, 'Play')
const expected = h('p', null, 'Expected answer')

describe('stable exercise presentation', () => {
  it('keeps the same audio slot for unanswered and answered prompts', () => {
    const before = render(ExercisePrompt, { audio, audioVisible: false }, h('span', null, 'Question'))
    const after = render(ExercisePrompt, { audio, audioVisible: true }, h('span', null, 'Question'))
    for (const markup of [before, after]) {
      expect(markup).toContain('min-h-12')
      expect(markup).toContain('px-14')
      expect(markup).toContain('absolute right-0')
      expect(markup).toContain('Play')
    }
    expect(before).toContain('inert=""')
    expect(before).toContain('aria-hidden="true"')
    expect(after).not.toContain('inert=""')
  })

  it('reserves space for listening controls and inline hints', () => {
    const centered = render(ExercisePrompt, { audio, placement: 'center', audioVisible: false })
    expect(centered).toContain('min-h-12')
    expect(centered).toContain('inert=""')
    const hint = render(ExerciseSlot, { as: 'span', visible: false }, audio)
    expect(hint).toMatch(/^<span /)
    expect(hint).toContain('invisible')
  })

  it('keeps the answer feedback placeholder in the same grid cell', () => {
    const before = render(ExerciseFeedback, { reserve: expected, size: 'double' })
    const after = render(ExerciseFeedback, { reserve: expected, size: 'double' }, expected)
    for (const markup of [before, after]) {
      expect(markup).toContain('min-h-12')
      expect(markup).toContain('inert=""')
      expect(markup).toContain('aria-live="polite"')
      expect(markup).toContain('Expected answer')
      expect(markup.match(/col-start-1 row-start-1/g)).toHaveLength(2)
    }
  })

  it('keeps both speech action states mounted in one layout area', () => {
    for (const finished of [false, true]) {
      const markup = render(ExerciseActions, { completed: h('button', null, 'Next'), finished }, h('button', null, 'Record'))
      expect(markup).toContain('Record')
      expect(markup).toContain('Next')
      expect(markup.match(/inert=""/g)).toHaveLength(1)
      expect(markup.match(/col-start-1 row-start-1/g)).toHaveLength(2)
    }
  })
})

describe('shared full-screen practice slots', () => {
  it('keeps word metadata visible and above the input throughout practice', () => {
    const markup = render(ExerciseCard, { practice: true, metadata: h('span', null, 'Mastery'), layout: 'fixed-input' }, h('input', { 'data-word-answer': '' }))
    expect(markup.indexOf('Mastery')).toBeLessThan(markup.indexOf('data-word-answer'))
    expect(markup).toContain('data-exercise-metadata')
    expect(markup).toContain('mb-2 flex min-h-11 shrink-0')
    expect(markup).not.toContain('inert=""')
    expect(markup).not.toContain('<details')
  })
  it('uses a fixed prompt slot only for short text exercises', () => {
    for (const kind of ['translate-production', 'listen-write']) {
      expect(exerciseLayout({ kind, mode: 'typed' }, true)).toBe('fixed-input')
      expect(exerciseLayout({ kind, mode: 'typed' }, false)).toBe('adaptive')
    }
    for (const [kind, mode] of [['translate-production', 'choice'], ['sentence-write', 'typed'], ['sentence-typed', 'typed'], ['inflect', 'typed'], ['pronunciation', 'typed'], ['reading-choice', 'choice'], ['spelling', 'assemble'], ['listen-choice', 'choice']]) {
      expect(exerciseLayout({ kind, mode }, true)).toBe('adaptive')
    }
    expect(exerciseLayout({ kind: 'translate-production', mode: 'typed', baseForm: 'test' }, true)).toBe('adaptive')
    const fixed = render(ExercisePromptArea, { practice: true, layout: 'fixed-input' }, expected)
    expect(fixed).toContain('h-24 shrink-0')
    expect(fixed).toContain('overflow-y-auto')
    expect(fixed).toContain('Expected answer')
    const adaptive = render(ExercisePromptArea, { practice: true }, expected)
    expect(adaptive).toContain('min-h-16')
    expect(adaptive).not.toContain('h-24')
  })
  it('uses the same prompt area for word and audio exercises', () => {
    for (const child of [h('span', null, 'silk'), audio]) {
      const markup = render(ExercisePromptArea, { practice: true }, child)
      expect(markup).toContain('data-exercise-prompt-area')
      expect(markup).toContain('min-h-16')
    }
    expect(render(ExercisePromptArea, {}, expected)).not.toContain('data-exercise-prompt-area')
  })
  it('owns the answer form locally without an external form id', () => {
    const input = h('input', { 'data-word-answer': '' })
    const markup = render(ExerciseAnswerForm, { onSubmit: () => {} }, input)
    expect(markup).toMatch(/^<form /)
    expect(markup).not.toContain(' id=')
    expect(markup).toContain('data-word-answer')
    expect(markup).toContain('noValidate=""')
    expect(markup).toMatch(/<\/form>$/)
  })
})


describe('compact practice', () => {
  it('uses an adaptive grid for short labels and one column for long labels without changing grading geometry', () => {
    const options = ['паром', 'женщина', 'укол', 'осматривать, ходить по достопримечательностям']
    const before = render(ExerciseOptions, { options, practice: true, outcomeFor: () => 'none', disabledFor: () => false, onSelect: () => {} })
    const after = render(ExerciseOptions, { options, practice: true, outcomeFor: option => option === 'женщина' ? 'correct' : 'none', disabledFor: () => true, onSelect: () => {} })
    const short = render(ExerciseOptions, { options: options.slice(0, 3), outcomeFor: () => 'none', disabledFor: () => false, onSelect: () => {} })
    expect(short).toContain('data-option-layout="adaptive"')
    expect(short).toContain('repeat(auto-fit')
    for (const markup of [before, after]) {
      expect(markup).toContain('data-option-layout="single"')
      expect(markup).toContain('minmax(0, 1fr)')
      expect(markup.match(/min-h-12/g)).toHaveLength(4)
      for (const option of options) expect(markup).toContain(option)
    }
  })
  it('uses a flat practice card with always-visible metadata', () => {
    const markup = render(ExerciseCard, { practice: true, metadata: expected }, audio)
    expect(markup).toContain('data-practice-card')
    expect(markup).not.toContain('shadow-card')
    expect(markup).toContain('Expected answer')
    expect(markup).not.toContain('inert=""')
  })
})


describe('compact outcome marks', () => {
  it('reserves the same icon footprint before and after grading without visible captions', () => {
    for (const correct of [undefined, true, false]) {
      const markup = render(ExerciseResultMark, { correct, label: correct ? 'Correct' : 'Incorrect' })
      expect(markup).toContain('size-5 shrink-0')
      expect(markup.includes('invisible')).toBe(correct === undefined)
      if (correct !== undefined) {
        expect(markup).toContain(correct ? 'text-ok-ink' : 'text-danger-ink')
        expect(markup).toContain(correct ? 'aria-label="Correct"' : 'aria-label="Incorrect"')
        expect(markup).not.toContain(correct ? '>Correct<' : '>Incorrect<')
      }
    }
  })
})

describe('reading pagination', () => {
  const fits = max => value => value.length <= max
  it('keeps short text on one page', () => {
    const text = 'Krótki tekst.'
    expect(paginateText(text, fits(100))).toEqual([{ start: 0, end: text.length }])
  })
  it('prefers sentence boundaries without losing any characters', () => {
    const text = 'Pierwsze zdanie. Drugie zdanie. Trzecie zdanie.'
    const pages = paginateText(text, fits(22))
    expect(pages.map(p => text.slice(p.start, p.end)).join('')).toBe(text)
    expect(pages.map(p => text.slice(p.start, p.end).trim())).toEqual(['Pierwsze zdanie.', 'Drugie zdanie.', 'Trzecie zdanie.'])
  })
  it('splits long sentences at words and always makes progress', () => {
    const text = '   Jeden bardzo_długi_wyraz dwa trzy.'
    const pages = paginateText(text, fits(4))
    expect(pages.map(p => text.slice(p.start, p.end)).join('')).toBe(text)
    expect(pages.every(p => p.end > p.start)).toBe(true)
  })
})
