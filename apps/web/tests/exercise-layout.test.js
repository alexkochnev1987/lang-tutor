import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExerciseActions, ExerciseFeedback, ExercisePrompt, ExerciseSlot } from '../app/_components/exercise/ExerciseCard'

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
