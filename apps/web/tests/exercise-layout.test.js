import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExerciseActions, ExerciseAnswerForm, ExerciseCard, ExerciseFeedback, ExerciseOptions, ExercisePrompt, ExercisePromptArea, ExerciseResultMark, ExerciseSlot } from '../app/_components/exercise/ExerciseCard'

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
  it('reserves the same compact top row before and after grading', () => {
    for (const visible of [false, true]) {
      const markup = render(ExerciseCard, { practice: true, metadata: h('span', null, 'Mastery'), metadataVisible: visible }, h('input', { 'data-word-answer': '' }))
      expect(markup.indexOf('Mastery')).toBeLessThan(markup.indexOf('data-word-answer'))
      expect(markup).not.toContain('<details')
      expect(markup).toContain('mb-2 flex min-h-11 items-center justify-between gap-1')
      expect(markup.includes('inert=""')).toBe(!visible)
      expect(markup.includes('aria-hidden="true"')).toBe(!visible)
    }
  })
  it('uses the same prompt area for word and audio exercises', () => {
    for (const child of [h('span', null, 'silk'), audio]) {
      const markup = render(ExercisePromptArea, { practice: true }, child)
      expect(markup).toContain('data-exercise-prompt-area')
      expect(markup).toContain('min-h-16')
    }
    expect(render(ExercisePromptArea, {}, expected)).not.toContain('data-exercise-prompt-area')
  })
  it('keeps the input inside an externally submittable form', () => {
    const input = h('input', { 'data-word-answer': '' })
    const markup = render(ExerciseAnswerForm, { formId: 'practice-answer', onSubmit: () => {} }, input)
    expect(markup).toMatch(/^<form id="practice-answer"/)
    expect(markup).toContain('data-word-answer')
    expect(markup).toContain('noValidate=""')
    expect(markup).toMatch(/<\/form>$/)
    expect(render(ExerciseAnswerForm, { onSubmit: () => {} }, input)).not.toContain('<form')
  })
})


describe('compact practice', () => {
  it('uses two columns, gives long labels the full row and keeps grading geometry', () => {
    const options = ['паром', 'женщина', 'укол', 'осматривать, ходить по достопримечательностям']
    const before = render(ExerciseOptions, { options, practice: true, outcomeFor: () => 'none', disabledFor: () => false, onSelect: () => {} })
    const after = render(ExerciseOptions, { options, practice: true, outcomeFor: option => option === 'женщина' ? 'correct' : 'none', disabledFor: () => true, onSelect: () => {} })
    for (const markup of [before, after]) {
      expect(markup).toContain('grid-cols-2')
      expect(markup.match(/col-span-2/g)).toHaveLength(1)
      expect(markup.match(/min-h-12/g)).toHaveLength(4)
      for (const option of options) expect(markup).toContain(option)
    }
  })
  it('uses a flat practice card and reserves a hidden details slot before grading', () => {
    const props = { practice: true, metadata: expected }
    const before = render(ExerciseCard, { ...props, metadataVisible: false }, audio)
    const after = render(ExerciseCard, { ...props, metadataVisible: true }, audio)
    for (const markup of [before, after]) {
      expect(markup).toContain('data-practice-card')
      expect(markup).not.toContain('shadow-card')
      expect(markup).toContain('Expected answer')
    }
    expect(before).toContain('inert=""')
    expect(after).not.toContain('inert=""')
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
