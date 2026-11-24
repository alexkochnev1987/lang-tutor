import type { ReactNode } from 'react'
import { Card, OptionRow, Row, Stack } from '@polski/ui'

/** Shared presentation only: grading, persistence and navigation stay with the exercise. */
export function ExerciseCard({ children, tone = 'neutral', metadata, metadataLabel, metadataVisible = true, practice = false, bare = false }: {
  children: ReactNode
  tone?: 'neutral' | 'correct' | 'wrong'
  metadata?: ReactNode
  /** Practice puts secondary controls in a collapsed section below the answer. */
  metadataLabel?: string
  metadataVisible?: boolean
  practice?: boolean
  bare?: boolean
}) {
  if (bare) return <>{children}</>
  const metadataContent = metadata && <div className="flex flex-wrap items-center justify-between gap-3">{metadata}</div>
  const content = <>
    {!metadataLabel && metadataContent && <div className="mb-2">{metadataContent}</div>}
    {children}
    {metadataLabel && metadataContent && (
      <ExerciseSlot visible={metadataVisible} className="mt-2 text-sm text-muted">
        <details>
          <summary className="min-h-10 cursor-pointer py-2">{metadataLabel}</summary>
          {metadataContent}
        </details>
      </ExerciseSlot>
    )}
  </>
  if (practice) return <div data-exercise-card="" data-practice-card="" className="mx-auto w-full min-w-0 max-w-(--container-exercise)">{content}</div>
  return <Card tone={tone} data-exercise-card="">{content}</Card>
}

/** The prompt keeps its footprint regardless of keyboard or grading state. */
export function ExercisePromptArea({ children, practice = false }: { children: ReactNode; practice?: boolean }) {
  return practice
    ? <div data-exercise-prompt-area="" className="flex min-h-16 w-full min-w-0 flex-col justify-center rounded-card bg-soft px-3 py-2">{children}</div>
    : <>{children}</>
}

/** The input stays in the card; the shared footer submits it by form ID. */
export function ExerciseAnswerForm({ children, formId, onSubmit }: { children: ReactNode; formId?: string; onSubmit: () => void }) {
  if (!formId) return <>{children}</>
  return <form id={formId} className="w-full min-w-0" onSubmit={(event) => {
    event.preventDefault()
    onSubmit()
  }}>{children}</form>
}

export function ExerciseContent({ children, compact = false, practice = false }: { children: ReactNode; compact?: boolean; practice?: boolean }) {
  return <Stack gap={practice ? 'sm' : compact ? 'xs' : 'lg'} className="w-full min-w-0">{children}</Stack>
}

/** Layout is decided from answer text, never from grading state. Long labels
 * get the entire row; source order stays the same for reading and tabbing. */
export function isWideExerciseOption(option: string): boolean {
  return Array.from(option.trim()).length > 22 || option.trim().split(/\s+/).some(word => Array.from(word).length > 16)
}

export function ExerciseOptions({ options, practice = false, outcomeFor, disabledFor, onSelect }: {
  options: string[]
  practice?: boolean
  outcomeFor: (option: string) => 'none' | 'correct' | 'wrong'
  disabledFor: (option: string) => boolean
  onSelect: (option: string) => void
}) {
  return <div data-exercise-options="" className={practice ? 'grid grid-cols-2 items-stretch gap-2' : 'grid gap-1'}>
    {options.map(option => (
      <div key={option} className={practice && isWideExerciseOption(option) ? 'col-span-2 min-w-0' : 'min-w-0'}>
        <OptionRow compact={practice} selected={false} outcome={outcomeFor(option)}
          disabled={disabledFor(option)} onClick={() => onSelect(option)}>
          {option}
        </OptionRow>
      </div>
    ))}
  </div>
}

/** Keep a control's footprint while unavailable; invisible controls cannot be focused or tapped. */
export function ExerciseSlot({ children, visible = true, className = '', as: Tag = 'div' }: {
  children: ReactNode; visible?: boolean; className?: string; as?: 'div' | 'span'
}) {
  return <Tag className={`${className} ${visible ? '' : 'invisible pointer-events-none'}`} aria-hidden={!visible || undefined} inert={!visible}>{children}</Tag>
}

export function ExercisePrompt({ children, audio, audioVisible = true, placement = 'side', numbered = false, compact = false }: {
  children?: ReactNode
  audio?: ReactNode
  audioVisible?: boolean
  placement?: 'side' | 'inline' | 'center'
  numbered?: boolean
  compact?: boolean
}) {
  if (placement === 'center') return <ExerciseSlot visible={audioVisible} className="flex min-h-12 justify-center items-center" >{audio}</ExerciseSlot>
  if (placement === 'side' && audio) return (
    <div data-exercise-prompt="" className="relative flex min-h-12 w-full min-w-0 items-center justify-center px-14 [&>span]:min-w-0 [&>span]:break-words">
      {children}
      <ExerciseSlot visible={audioVisible} className="absolute right-0 top-1/2 -translate-y-1/2">{audio}</ExerciseSlot>
    </div>
  )
  return <Row gap="sm" justify={numbered ? 'start' : 'center'} align="baseline" className={numbered || audio ? 'w-full' : undefined}>
    {children}
    {audio && <ExerciseSlot visible={audioVisible} className={`shrink-0 self-start ${compact ? 'min-w-10' : 'min-w-12'}`}>{audio}</ExerciseSlot>}
  </Row>
}

/** Reserve common one/two-line feedback; longer accessible content may naturally grow. */
export function ExerciseFeedback({ children, reserve, size = 'single', className = '' }: {
  children?: ReactNode; reserve?: ReactNode; size?: 'single' | 'double' | 'speech'; className?: string
}) {
  const height = size === 'speech' ? 'min-h-20' : size === 'double' ? 'min-h-12' : 'min-h-7'
  return <div data-exercise-feedback="" className={`grid ${height} text-sm break-words ${className}`}>
    {reserve && <ExerciseSlot visible={false} className="col-start-1 row-start-1">{reserve}</ExerciseSlot>}
    <div role="status" aria-live="polite" className="col-start-1 row-start-1">{children}</div>
  </div>
}

/** Alternative action states occupy the same responsive grid area. */
export function ExerciseActions({ children, completed, finished = false }: {
  children: ReactNode; completed: ReactNode; finished?: boolean
}) {
  return <div className="grid min-w-0">
    <ExerciseSlot visible={!finished} className="col-start-1 row-start-1">{children}</ExerciseSlot>
    <ExerciseSlot visible={finished} className="col-start-1 row-start-1">{completed}</ExerciseSlot>
  </div>
}
