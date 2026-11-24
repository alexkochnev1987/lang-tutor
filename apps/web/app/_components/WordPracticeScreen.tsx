'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Screen } from '@polski/ui'

/** Adapt only the available height. Keep header and answer anchored in normal
 * layout flow, and let the browser handle native keyboard panning. */
export function WordPracticeScreen({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const screen = root.current
    const viewport = window.visualViewport
    if (!enabled || !screen || !viewport) return
    let frame = 0
    let lastHeight = 0
    let width = viewport.width
    const captureSafeTop = () => {
      screen.style.removeProperty('--screen-safe-top')
      screen.style.setProperty('--screen-safe-top', getComputedStyle(screen).paddingTop)
    }
    captureSafeTop()
    const sync = () => {
      frame = 0
      if (viewport.scale !== 1 || viewport.height <= 0) return
      // iOS may temporarily report a different safe area while the keyboard is open.
      // Preserve the initial inset, except when the screen orientation/width changes.
      if (Math.abs(viewport.width - width) > 20) {
        width = viewport.width
        captureSafeTop()
      }
      const height = Math.round(viewport.height)
      if (height === lastHeight) return
      lastHeight = height
      screen.style.setProperty('--study-viewport-height', `${height}px`)
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(sync)
    }
    sync()
    viewport.addEventListener('resize', schedule)
    return () => {
      viewport.removeEventListener('resize', schedule)
      if (frame) window.cancelAnimationFrame(frame)
      screen.style.removeProperty('--study-viewport-height')
      screen.style.removeProperty('--screen-safe-top')
    }
  }, [enabled])

  return <Screen ref={root} className={enabled ? 'word-practice-screen' : undefined}>{children}</Screen>
}
