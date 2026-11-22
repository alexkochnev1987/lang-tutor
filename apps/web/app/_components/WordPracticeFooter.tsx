'use client'

import { useEffect } from 'react'
import { Button } from '@polski/ui'

export function WordPracticeFooter({ label, busyLabel, onNext, formId, disabled }: {
  label: string
  busyLabel?: string
  onNext?: () => void
  formId?: string
  disabled?: boolean
}) {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    const resize = () => {
      if (viewport.scale !== 1) return
      root.style.setProperty('--study-viewport-height', `${viewport.height}px`)
    }
    resize()
    viewport.addEventListener('resize', resize)
    return () => {
      viewport.removeEventListener('resize', resize)
      root.style.removeProperty('--study-viewport-height')
    }
  }, [])

  return (
    <footer className="border-t border-line bg-bg px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-(--container-exercise)">
        <Button size="lg" full form={formId} type={formId ? 'submit' : 'button'} onClick={formId ? undefined : onNext} disabled={disabled} busy={Boolean(busyLabel)} busyLabel={busyLabel}>
          {label}
        </Button>
      </div>
    </footer>
  )
}
