'use client'

import { useEffect, useRef, type RefCallback } from 'react'
import { Button } from '@polski/ui'
import { WordSaveIndicator } from './WordSaveIndicator'

export function WordPracticeFooter({ label, busyLabel, onNext, formId, disabled, answerTargetRef }: {
  label: string
  busyLabel?: string
  onNext?: () => void
  formId?: string
  disabled?: boolean
  answerTargetRef?: RefCallback<HTMLDivElement>
}) {
  const footer = useRef<HTMLElement>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    const screen = footer.current?.closest<HTMLElement>('.word-practice-screen')
    if (!viewport || !screen) return
    const sync = () => {
      if (viewport.scale !== 1) return
      screen.style.setProperty('--study-viewport-height', `${viewport.height}px`)
      screen.style.setProperty('--study-viewport-top', `${Math.max(0, viewport.offsetTop)}px`)
    }
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
      screen.style.removeProperty('--study-viewport-height')
      screen.style.removeProperty('--study-viewport-top')
    }
  }, [])

  return (
    <footer ref={footer} className="word-practice-footer border-t border-line bg-bg px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-(--container-exercise)">
        {answerTargetRef && <¶»§q«^