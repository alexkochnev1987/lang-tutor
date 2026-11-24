'use client'

import { Button } from '@polski/ui'
import { WordSaveIndicator } from './WordSaveIndicator'

export function WordPracticeFooter({ label, busyLabel, onNext, disabled }: {
  label: string
  busyLabel?: string
  onNext?: () => void
  disabled?: boolean
}) {
  return (
    <footer className="word-practice-footer bg-bg px-4 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-(--container-exercise)">
        <WordSaveIndicator />
        <div className={disabled && !busyLabel ? 'invisible' : undefined} inert={Boolean(disabled && !busyLabel)}>
          <Button size="lg" full type="button" onClick={onNext}
            disabled={disabled} busy={Boolean(busyLabel)} busyLabel={busyLabel}>
            {label}
          </Button>
        </div>
      </div>
    </footer>
  )
}
