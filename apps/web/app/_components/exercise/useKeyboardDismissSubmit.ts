'use client'

import { useEffect, useRef, type RefObject } from 'react'

/**
 * iOS can dismiss the software keyboard without blurring its input.
 * Only submit after a substantial viewport contraction has been observed
 * and the viewport returns to its previous height. Ignore zoom and rotation.
 */
export function useKeyboardDismissSubmit(
  input: RefObject<HTMLInputElement | null>,
  onSubmit: (value: string) => void,
  enabled: boolean,
) {
  const latestSubmit = useRef(onSubmit)
  useEffect(() => { latestSubmit.current = onSubmit }, [onSubmit])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!enabled || !viewport || !window.matchMedia('(pointer: coarse)').matches) return
    let width = viewport.width
    let baseline = Math.max(viewport.height, document.documentElement.clientHeight)
    let keyboardSeen = baseline - viewport.height >= 120
    const onResize = () => {
      if (viewport.scale !== 1 || Math.abs(viewport.width - width) > 20) {
        width = viewport.width
        baseline = Math.max(viewport.height, document.documentElement.clientHeight)
        keyboardSeen = false
        return
      }
      baseline = Math.max(baseline, viewport.height, document.documentElement.clientHeight)
      const element = input.current
      if (!element || element.disabled || document.activeElement !== element) {
        keyboardSeen = false
        return
      }
      const gap = baseline - viewport.height
      if (gap >= 120) keyboardSeen = true
      if (keyboardSeen && gap <= 60) {
        keyboardSeen = false
        if (element.value.trim()) latestSubmit.current(element.value)
      }
    }
    viewport.addEventListener('resize', onResize)
    return () => viewport.removeEventListener('resize', onResize)
  }, [enabled, input])
}
