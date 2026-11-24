import { createDismissTracker } from '../app/_components/exercise/useAnswerInput'

describe('focused answer keyboard dismissal fallback', () => {
  it('ignores opening and intermediate resize events, then detects recovery', () => {
    const observe = createDismissTracker(800, 800)
    expect(observe(690, 800)).toBe(false)
    expect(observe(500, 800)).toBe(false)
    expect(observe(650, 800)).toBe(false)
    expect(observe(750, 800)).toBe(true)
  })

  it('works when the field mounts while both viewports are already contracted', () => {
    const observe = createDismissTracker(500, 500)
    expect(observe(550, 550)).toBe(false)
    expect(observe(800, 800)).toBe(true)
  })

  it('ignores ordinary browser chrome height changes', () => {
    const observe = createDismissTracker(800, 800)
    expect(observe(740, 800)).toBe(false)
    expect(observe(800, 800)).toBe(false)
  })
})
