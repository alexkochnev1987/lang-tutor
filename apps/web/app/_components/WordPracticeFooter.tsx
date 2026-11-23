'use client'

import { useEffect, useRef, type RefCallback } from 'react'
import { Button } from '@polski/ui'

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
        {answerTargetRef && <div ref={answerTargetRef} />}
        <Button size="lg" full form={formId} type={formId ? 'submit' : 'button'} onClick={formId ? undefined : onNext}
          onPointerDown={(event) => {
            // Keep the keyboard open until the submit click reaches the form.
            const input = event.currentTarget.form?.ownerDocument.activeElement
            if (input?.matches('[data-word-answer]') && event.currentTarget.form?.contains(input)) event.preventDefault()
          }}
          disabled={disabled} busy={Boolean(busyLabel)} busyLabel={busyLabel}>
          {label}
        </Button>
      </div>
    </footer>
  )
}
