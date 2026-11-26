'use client'

import { PracticeNextAction } from './exercise/ExerciseCard'
import { WordSaveIndicator } from './WordSaveIndicator'

export function WordPracticeFooter({ showAction, label, busyLabel, onNext, disabled }: {
  showAction: boolean
  label: string
  busyLabel?: string
  onNext?: () => void
  disabled?: boolean
}) {
  return (
    <footer className="word-practice-footer bg-bg px-4">
      <div className="mx-auto w-full max-w-(--container-exercise)">
        <WordSaveIndicator compact />
        <PracticeNextAction visible={showAction} label={label} disabled={disabled} busyLabel={busyLabel} onNext={onNext} />
      </div>
    </footer>
  )
}
