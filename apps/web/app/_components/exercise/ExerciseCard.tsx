import type { ReactNode } from 'react'
import { Card, Row, Stack } from '@polski/ui'

/** Shared presentation only: grading, persistence and navigation stay with the exercise. */
export function ExerciseCard({ children, tone = 'neutral', metadata, metadataLabel, bare = false }: {
  children: ReactNode
  tone?: 'neutral' | 'correct' | 'wrong'
  metadata?: ReactNode
  /** Practice puts secondary controls in a collapsed section below the answer. */
  metadataLabel?: string
  bare?: boolean
}) {
  if (bare) return <>{children}</>
  const metadataContent = metadata && <div className="flex flex-wrap items-center justify-between gap-3">{metadata}</div>
  return <Card tone={tone} data-exercise-card="">
    {!metadataLabel && metadataContent && <div className="mb-2">{metadataContent}</div>}
    {children}
    {metadataLabel && metadataContent && (
      <details className="mt-3 border-t border-line pt-2 text-sm text-muted">
        <summary className="min-h-10 cursor-pointer py-2">{metadataLabel}</summary>
        {metadataContent}
      </details>
    )}
  </Card>
}

/** The prompt keeps its footprint regardless of keyboard or grading state. */
export function ExercisePromptArea({ children, practice = false }: { children: ReactNode; practice?: boolean }) {
  return practice
    ? <div data-exercise-prompt-area="" className="flex min-h-28 w-full min-w-0 flex-col justify-center rounded-card bg-soft px-3 py-3">{children}</div>
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

export function ExerciseContent({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return <Stack gap={compact ? 'xs' : 'lg'} className="w-full min-w-0">{children}</Stack>
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
