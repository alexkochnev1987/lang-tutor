// Match the keyboard thresholds used by the answer-input dismissal tracker.
// Keep the action slot hidden during recovery, including the blur-to-resize gap.
const KEYBOARD_HEIGHT = 120
const CLOSED_GAP = 60
const STABLE_FRAMES = 3

export function createPracticeKeyboardTracker(height: number, layoutHeight: number) {
  let baseline = layoutHeight - height >= KEYBOARD_HEIGHT ? layoutHeight : height
  let blocked = false
  let previousHeight = height
  let stableFrames = 0

  return (nextHeight: number, nextLayoutHeight: number) => {
    baseline = Math.max(baseline, nextHeight)
    // Safari may retain the layout viewport height while the keyboard is open.
    if (nextLayoutHeight - nextHeight >= KEYBOARD_HEIGHT) {
      baseline = Math.max(baseline, nextLayoutHeight)
    }

    if (baseline - nextHeight >= KEYBOARD_HEIGHT) blocked = true
    if (!blocked || baseline - nextHeight > CLOSED_GAP) {
      stableFrames = 0
    } else {
      stableFrames = nextHeight === previousHeight ? stableFrames + 1 : 0
      if (stableFrames >= STABLE_FRAMES) {
        blocked = false
        baseline = nextHeight
        stableFrames = 0
      }
    }
    previousHeight = nextHeight

    return { blocked, settling: blocked && baseline - nextHeight <= CLOSED_GAP }
  }
}
