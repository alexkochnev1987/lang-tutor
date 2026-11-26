'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Screen } from '@polski/ui'
import { createPracticeKeyboardTracker, practiceViewportOffset } from './exercise/practiceKeyboard'

/** Normal-flow screen with a small visual-viewport fallback for touch keyboards.
 * Only compensate native panning when the focused field still fits. */
export function WordPracticeScreen({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const screen = root.current
    const viewport = window.visualViewport
    if (!enabled || !screen || !viewport) return
    let frame = 0
    let lastHeight = 0
    let appliedOffset = 0
    let width = viewport.width
    const touch = window.matchMedia('(any-pointer: coarse)').matches
    const layoutHeight = () => document.documentElement.clientHeight
    let trackKeyboard = createPracticeKeyboardTracker(Math.round(viewport.height), layoutHeight())
    const captureSafeTop = () => {
      screen.style.removeProperty('--screen-safe-top')
      screen.style.setProperty('--screen-safe-top', getComputedStyle(screen).paddingTop)
    }
    captureSafeTop()
    const sync = () => {
      frame = 0
      if (viewport.scale !== 1 || viewport.height <= 0) {
        screen.removeAttribute('data-keyboard-occluded')
        screen.style.removeProperty('--study-viewport-offset')
        screen.style.removeProperty('--study-viewport-height')
        appliedOffset = 0
        lastHeight = 0
        trackKeyboard = createPracticeKeyboardTracker(Math.round(viewport.height), layoutHeight())
        return
      }
      // iOS may temporarily report a different safe area while the keyboard is open.
      // Preserve the initial inset, except when the screen orientation/width changes.
      if (Math.abs(viewport.width - width) > 20) {
        width = viewport.width
        captureSafeTop()
        trackKeyboard = createPracticeKeyboardTracker(Math.round(viewport.height), layoutHeight())
      }
      const height = Math.round(viewport.height)
      if (height !== lastHeight) {
        lastHeight = height
        screen.style.setProperty('--study-viewport-height', `${height}px`)
      }
      if (touch) {
        const { blocked, settling } = trackKeyboard(height, layoutHeight())
        screen.toggleAttribute('data-keyboard-occluded', blocked)
        // Safari may pan the visual viewport without scrolling the main region.
        // Keep short exercises anchored; leave native panning alone when a
        // field genuinely needs the space (e.g. a long exercise or landscape).
        let offset = 0
        if (blocked) {
          const field = document.activeElement
          const focused = field instanceof HTMLElement && field.matches('input, textarea') && screen.contains(field)
          const rect = focused ? field.getBoundingClientRect() : null
          const rootTop = screen.getBoundingClientRect().top + window.scrollY - appliedOffset
          const fieldOrigin = rootTop + appliedOffset - window.scrollY
          offset = practiceViewportOffset(viewport.pageTop - rootTop, height,
            rect ? { top: rect.top - fieldOrigin, bottom: rect.bottom - fieldOrigin } : null)
        }
        if (offset !== appliedOffset) {
          appliedOffset = offset
          screen.style.setProperty('--study-viewport-offset', `${offset}px`)
        }
        if (settling) schedule()
      }
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(sync)
    }
    sync()
    viewport.addEventListener('resize', schedule)
    viewport.addEventListener('scroll', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    return () => {
      viewport.removeEventListener('resize', schedule)
      viewport.removeEventListener('scroll', schedule)
      window.removeEventListener('scroll', schedule)
      if (frame) window.cancelAnimationFrame(frame)
      screen.removeAttribute('data-keyboard-occluded')
      screen.style.removeProperty('--study-viewport-height')
      screen.style.removeProperty('--screen-safe-top')
      screen.style.removeProperty('--study-viewport-offset')
    }
  }, [enabled])

  return <Screen ref={root} className={enabled ? 'word-practice-screen' : undefined}>{children}</Screen>
}
