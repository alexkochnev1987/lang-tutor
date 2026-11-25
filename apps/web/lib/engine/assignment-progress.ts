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

export const GRAMMAR_PRACTICE_PREFIX = 'grammar-practice:'
export function sourceExerciseId(id: string) {
  return id.startsWith(GRAMMAR_PRACTICE_PREFIX) ? id.slice(GRAMMAR_PRACTICE_PREFIX.length) : id
}
export function isHistoricalGrammarId(id: string) {
  return /^ex\.(sgap|swrite|form|infl|collocation)\./.test(sourceExerciseId(id))
}
export function needsReview(row: Pick<ExerciseResultRow, 'correct' | 'attempts'>) {
  return !row.correct || row.attempts > 1
}
export type ReviewArchiveRow = Omit<ExerciseResultRow,'completedAt'> & { completedAt: Date | string }
export type AssignmentReviewData = { summaries: AssignmentSummary[]; archive?: ReviewArchiveRow[] }
export function latestReviewResults(results: readonly ReviewArchiveRow[]) {
  const latest = new Map<string, ReviewArchiveRow>()
  for (const row of results) {
    const id = row.exerciseId.startsWith(ASSIGNMENT_REVIEW_PREFIX) ? row.exerciseId.slice(ASSIGNMENT_REVIEW_PREFIX.length) : row.exerciseId
    const key = row.dayNumber + ':' + id
    const prev = latest.get(key)
    if (!prev || new Date(row.completedAt).getTime() >= new Date(prev.completedAt).getTime()) latest.set(key, row)
  }
  return latest
}

export function assignmentReviewRows(summaries: readonly AssignmentSummary[], results: readonly ExerciseResultRow[], completedDays: ReadonlySet<number>, archive: readonly ReviewArchiveRow[] = []) {
  const latest = latestReviewResults([...archive, ...results])
  const byDay = new Map<number, Set<string>>()
  for (const summary of summaries) {
    if (!completedDays.has(summary.dayNumber)) continue
    byDay.set(summary.dayNumber, new Set(summary.exerciseIds.filter(id => !id.startsWith('ex.reading.'))))
  }
  // Include saved historical errors even if the lesson was never snapshotted.
  // Do not invent missing assignments for historical days.
  for (const [key,row] of latest) {
    const id = key.slice(key.indexOf(':') + 1)
    if (!isHistoricalGrammarId(id) || !needsReview(row)) continue
    const ids = byDay.get(row.dayNumber) ?? new Set<string>()
    ids.add(id); byDay.set(row.dayNumber, ids)
  }
  return [...byDay].sort(([a],[b]) => b-a).map(([dayNumber, set]) => {
    const ids = [...set]
    const missing = ids.filter(id => !latest.has(dayNumber + ':' + id))
    const mistakes = ids.filter(id => {
      const row = latest.get(dayNumber + ':' + id)
      return row ? needsReview(row) : false
    })
    return { dayNumber, ids, missing, mistakes }
  }).filter(row => row.ids.length > 0)
}

/** Skip unavailable items and keep looking until a usable batch is filled. */
export async function collectReviewBatch<T>(ids: readonly string[], resolve: (id: string) => Promise<T | null>, limit = 10) {
  const items: T[] = []
  const unavailable: string[] = []
  for (const id of new Set(ids)) {
    if (items.length >= limit) break
    const item = await resolve(id)
    if (item) items.push(item)
    else unavailable.push(id)
  }
  return { items, unavailable }
}
