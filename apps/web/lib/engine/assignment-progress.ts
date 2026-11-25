import type { Stage, StageId } from './plan'
import type { ExerciseResultRow } from '../data/types'

export const ASSIGNED_STAGE_IDS = ['grammar','collocations','reading','exam'] as const
export type AssignedStageId = typeof ASSIGNED_STAGE_IDS[number]
export type AssignmentMap = Partial<Record<AssignedStageId, Stage>>
export function isAssignedStage(id: StageId): id is AssignedStageId {
  return (ASSIGNED_STAGE_IDS as readonly string[]).includes(id)
}
export function stageExerciseIds(stage: Stage): string[] {
  return stage.steps.flatMap(step => step.kind === 'exercise' ? [step.ex.id] : step.kind === 'exercise-batch' ? step.exercises.map(ex => ex.id) : [])
}
export function assignmentProgress(stages: Stage[], results: readonly ExerciseResultRow[], day: number) {
  const ids = new Set(stages.filter(stage => isAssignedStage(stage.id)).flatMap(stageExerciseIds))
  const rows = new Map(results.filter(row => row.dayNumber === day && ids.has(row.exerciseId)).map(row => [row.exerciseId, row]))
  return { total: ids.size, answered: rows.size, correct: [...rows.values()].filter(row => row.correct).length }
}

export type AssignmentSummary = { dayNumber: number; exerciseIds: string[] }
export const ASSIGNMENT_REVIEW_PREFIX = 'review:'

export function assignmentReviewRows(summaries: readonly AssignmentSummary[], results: readonly ExerciseResultRow[], completedDays: ReadonlySet<number>) {
  const latest = new Map<string, ExerciseResultRow>()
  for (const row of results) {
    const id = row.exerciseId.startsWith(ASSIGNMENT_REVIEW_PREFIX) ? row.exerciseId.slice(ASSIGNMENT_REVIEW_PREFIX.length) : row.exerciseId
    const key = row.dayNumber + ':' + id
    const prev = latest.get(key)
    if (!prev || +row.completedAt >= +prev.completedAt) latest.set(key, row)
  }
  return summaries.filter(s => completedDays.has(s.dayNumber)).sort((a,b) => b.dayNumber - a.dayNumber).map(summary => {
    const ids = [...new Set(summary.exerciseIds)].filter(id => !id.startsWith('ex.reading.'))
    const missing = ids.filter(id => !latest.has(summary.dayNumber + ':' + id))
    const mistakes = ids.filter(id => latest.get(summary.dayNumber + ':' + id)?.correct === false)
    return { dayNumber: summary.dayNumber, ids, missing, mistakes }
  }).filter(row => row.ids.length > 0)
}
