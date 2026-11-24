'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Screen } from '@polski/ui'

/** Adapt only the available height. Keep header and answer anchored in normal
 * layout flow, and let the browser handle native keyboard panning. */
export function WordPracticeScreen({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const screen = root.current
    const viewport = window.visualViewport
    if (!enabled || !screen || !viewport) return
    let frame = 0
    let lastHeight = 0
    const sync = () => {
      frame = 0
      if (viewport.scale !== 1 || viewport.height <= 0) return
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
    }
  }, [enabled])

  return <Screen ref={root} className={enabled ? 'word-practice-screen' : undefined}>{children}</Screen>
}
