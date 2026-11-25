import { createPracticeKeyboardTracker } from '../app/_components/exercise/practiceKeyboard'

describe('practice keyboard footer visibility', () => {
  it('keeps the footer hidden during keyboard recovery and reveals it at rest', () => {
    const track = createPracticeKeyboardTracker(800, 800)
    expect(track(800, 800).blocked).toBe(false)
    expect(track(480, 800).blocked).toBe(true)
    expect(track(650, 800).blocked).toBe(true)
    expect(track(755, 800)).toEqual({ blocked: true, settling: true })
    expect(track(780, 800).blocked).toBe(true)
    expect(track(800, 800).blocked).toBe(true)
    expect(track(800, 800).blocked).toBe(true)
    expect(track(800, 800).blocked).toBe(true)
    expect(track(800, 800).blocked).toBe(false)
  })

  it('handles a viewport that resizes both layout and visual heights', () => {
    const track = createPracticeKeyboardTracker(800, 800)
    expect(track(450, 450).blocked).toBe(true)
    expect(track(800, 800).blocked).toBe(true)
    for (let i = 0; i < 3; i++) track(800, 800)
    expect(track(800, 800).blocked).toBe(false)
  })

  it('handles mounting with the keyboard already open on Safari', () => {
    const track = createPracticeKeyboardTracker(480, 800)
    expect(track(480, 800).blocked).toBe(true)
    expect(track(600, 800).blocked).toBe(true)
    expect(track(800, 800).blocked).toBe(true)
    for (let i = 0; i < 3; i++) track(800, 800)
    expect(track(800, 800).blocked).toBe(false)
  })

  it('does not block for small browser chrome changes', () => {
    const track = createPracticeKeyboardTracker(800, 800)
    expect(track(755, 800).blocked).toBe(false)
    expect(track(800, 800).blocked).toBe(false)
  })

  it('cancels recovery if the keyboard opens again', () => {
    const track = createPracticeKeyboardTracker(800, 800)
    track(450, 800)
    track(800, 800)
    track(800, 800)
    expect(track(450, 800)).toEqual({ blocked: true, settling: false })
  })
})
