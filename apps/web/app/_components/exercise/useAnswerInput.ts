'use client'

import { useEffect, useRef, type FocusEvent, type KeyboardEvent } from 'react'

const KEYBOARD_HEIGHT = 120
const CLOSED_GAP = 60

/** Track a focused field's visible height, not a global keyboard state.
 * Recovery from the low point also covers a field mounted with the keyboard
 * already open, when layout and visual viewport heights are both reduced. */
export function createDismissTracker(height: number, layoutHeight: number) {
  let baseline = Math.max(height, layoutHeight)
  let lowest = height
  return (nextHeight: number, nextLayoutHeight: number) => {
    baseline = Math.max(baseline, nextHeight, nextLayoutHeight)
    lowest = Math.min(lowest, nextHeight)
    return baseline - lowest >= KEYBOARD_HEIGHT &&
      nextHeight - lowest >= KEYBOARD_HEIGHT &&
      baseline - nextHeight <= CLOSED_GAP
  }
}

/** Enter and blur own grading. On touch browsers that dismiss the software
 * keyboard without blurring, normalize that event to an ordinary input blur. */
export function useAnswerInput(submit: (value: string) => void, enabled: boolean) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = ref.current
    const viewport = window.visualViewport
    if (!enabled || !input || !viewport || !window.matchMedia('(pointer: coarse)').matches) return

    let width = viewport.width
    let observe = createDismissTracker(viewport.height, document.documentElement.clientHeight)
    const reset = () => {
      width = viewport.width
      observe = createDismissTracker(viewport.height, document.documentElement.clientHeight)
    }
    const onResize = () => {
      if (viewport.scale !== 1 || Math.abs(viewport.width - width) > 20 ||
          document.activeElement !== input || input.disabled) {
        reset()
        return
      }
      if (observe(viewport.height, document.documentElement.clientHeight)) {
        reset()
        input.blur()
      }
    }

    input.addEventListener('focus', reset)
    input.addEventListener('blur', reset)
    viewport.addEventListener('resize', onResize)
    return () => {
      input.removeEventListener('focus', reset)
      input.removeEventListener('blur', reset)
      viewport.removeEventListener('resize', onResize)
    }
  }, [enabled])

  const check = (input: HTMLInputElement) => {
    if (enabled && !input.disabled && input.value.trim()) submit(input.value)
  }

  return {
    ref,
    onBlur: (event: FocusEvent<HTMLInputElement>) => check(event.currentTarget),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
      event.preventDefault()
      check(event.currentTarget)
    },
  }
}
