import type { ReactNode } from 'react'
import type { Exercise } from '@polski/engine'
import { Card, OptionRow, Row, Stack } from '@polski/ui'

export type ExerciseLayout = 'adaptive' | 'fixed-input'

/** Only standalone, short vocabulary inputs use a fixed question slot. */
export function exerciseLayout(exercise: Exercise, practice: boolean): ExerciseLayout {
  return practice && exercise.mode === 'typed' && !exercise.baseForm &&
    (exercise.kind === 'translate-production' || exercise.kind === 'listen-write')
    ? 'fixed-input' : 'adaptive'
}

/** Shared presentation only: grading, persistence and navigation stay with the exercise. */
export function ExerciseCard({ children, tone = 'neutral', metadata, practice = false, bare = false, layout = 'adaptive' }: {
  children: ReactNode
  tone?: 'neutral' | 'correct' | 'wrong'
  metadata?: ReactNode
  layout?: ExerciseLayout
  practice?: boolean
  bare?: boolean
}) {
  if (bare) return <>{children}</>
  const content = <>
    {!practice && metadata && <div className="mb-2 flex flex-wrap items-center justify-between gap-3">{metadata}</div>}
    {practice && metadata && (
      <div data-exercise-metadata="" className="mb-2 flex min-h-11 shrink-0 items-center justify-between gap-1 text-muted">
        {metadata}
      </div>
    )}
    {children}
  </>
  if (practice) return <div data-exercise-card="" data-practice-card="" data-exercise-layout={layout} className="mx-auto w-full min-w-0 max-w-(--container-exercise)">{content}</div>
  return <Card tone={tone} data-exercise-card="">{content}</Card>
}

/** The prompt keeps its footprint regardless of keyboard or grading state. */
export function ExercisePromptArea({ children, practice = false, layout = 'adaptive' }: { children: ReactNode; practice?: boolean; layout?: ExerciseLayout }) {
  if (!practice) return <>{children}</>
  if (layout === 'fixed-input') return (
    <div data-exercise-prompt-area="" data-fixed-prompt="" className="h-24 shrink-0 w-full min-w-0 overflow-y-auto overscroll-contain rounded-card bg-soft px-3 py-2" tabIndex={0}>
      <div className="flex min-h-full min-w-0 flex-col justify-center">{children}</div>
    </div>
  )
  return <div data-exercise-prompt-area="" className="flex min-h-16 w-full min-w-0 flex-col justify-center rounded-card bg-soft px-3 py-2">{children}</div>
}

/** The text exercise owns its form, independently of screen navigation. */
export function ExerciseAnswerForm({ children, onSubmit }: { children: ReactNode; onSubmit: () => void }) {
  return <form noValidate className="w-full min-w-0" onSubmit={(event) => {
    event.preventDefault()
    onSubmit()
  }}>{children}</form>
}

export function ExerciseContent({ children, compact = false, practice = false }: { children: ReactNode; compact?: boolean; practice?: boolean }) {
  return <Stack gap={practice ? 'sm' : compact ? 'xs' : 'lg'} className="w-full min-w-0">{children}</Stack>
}

/** Long labels use a single column for the whole exercise. Short labels
 * can use two columns only when the actual container has enough room. */
export function isWideExerciseOption(option: string): boolean {
  return Array.from(option.trim()).length > 12
}

export function ExerciseOptions({ options, outcomeFor, disabledFor, onSelect }: {
  options: string[]
  outcomeFor: (option: string) => 'none' | 'correct' | 'wrong'
  disabledFor: (option: string) => boolean
  onSelect: (option: string) => void
}) {
  const wide = options.some(isWideExerciseOption)
  const longest = Math.max(0, ...options.map(option => Array.from(option.trim()).length))
  // Allow at most two tracks. Reserve room for padding and the outcome
  // marker, and collapse to one track on narrow cards or large fonts.
  const columns = wide ? 'minmax(0, 1fr)' :
    `repeat(auto-fit, minmax(min(100%, max(calc(50% - 4px), calc(${longest + 2}ch + 2.5rem))), 1fr))`
  return <div data-exercise-options="" data-option-layout={wide ? 'single' : 'adaptive'} className="grid w-full min-w-0 items-stretch gap-2" style={{ gridTemplateColumns: columns }}>
    {options.map(option => (
      <div key={option} className="min-w-0">
        <OptionRow compact selected={false} outcome={outcomeFor(option)}
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
  placement?: 'side' | 'inline' | 'center' | 'stacked'
  numbered?: boolean
  compact?: boolean
}) {
  if (placement === 'center') return <ExerciseSlot visible={audioVisible} className="flex min-h-12 justify-center items-center" >{audio}</ExerciseSlot>
  if (placement === 'stacked') return (
    <div data-exercise-prompt="" className="flex w-full min-w-0 flex-col gap-2">
      {audio && <ExerciseSlot visible={audioVisible} className="flex shrink-0 justify-end">{audio}</ExerciseSlot>}
      <Row gap="sm" justify={numbered ? 'start' : 'center'} align="baseline" className="w-full min-w-0 [&>span]:max-w-full">
        {children}
      </Row>
    </div>
  )
  if (placement === 'side' && audio) return (
    <div data-exercise-prompt="" className="relative flex min-h-12 w-full min-w-0 items-center justify-center px-14 [&>span]:min-w-0 [&>span]:break-words">
      {children}
      <ExerciseSlot visible={audioVisible} className="absolute right-0 top-1/2 -translate-y-1/2">{audio}</ExerciseSlot>
    </div>
  )
  return <Row gap="sm" justify={numbered ? 'start' : 'center'} align="baseline" className="w-full min-w-0 [&>span]:max-w-full">
    {children}
    {audio && <ExerciseSlot visible={audioVisible} className={`shrink-0 self-start ${compact ? 'min-w-10' : 'min-w-12'}`}>{audio}</ExerciseSlot>}
  </Row>
}

/** A fixed-size outcome marker; no visible success/failure caption is needed. */
export function ExerciseResultMark({ correct, label }: { correct?: boolean; label?: string }) {
  return <span data-exercise-result-mark="" className={`inline-flex size-5 shrink-0 items-center justify-center font-semibold ${correct === undefined ? 'invisible' : correct ? 'text-ok-ink' : 'text-danger-ink'}`}
    role={correct === undefined ? undefined : 'img'} aria-label={correct === undefined ? undefined : label} aria-hidden={correct === undefined || !label ? true : undefined}>
    <span aria-hidden="true">{correct === false ? '×' : '✓'}</span>
  </span>
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
