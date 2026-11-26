import type { Stage, Step, TodayPlan } from './plan'
import { loadState } from '@/lib/data/store'
import { contextualizeLegacy, isLegacyForm, legacyExpected, sentenceSourceKey } from './contextual-exercises'
import type { Exercise } from '@polski/engine'
import { loadLiveReadingCatalog, loadLiveReadingText } from '@/lib/content/curriculum'

import { ASSIGNED_STAGE_IDS, isAssignedStage, stageExerciseIds, type AssignmentMap } from './assignment-progress'
export { assignmentProgress, isAssignedStage, stageExerciseIds } from './assignment-progress'
export type { AssignmentMap } from './assignment-progress'

function assignmentMap(plan: TodayPlan): AssignmentMap {
  const out: AssignmentMap = {}
  for (const stage of plan.stages) {
    if (!isAssignedStage(stage.id) || !stageExerciseIds(stage).length || stage.missingContent) continue
    // Reading passages are static CDN assets; store the assigned question, not another copy of the passage.
    out[stage.id] = stage.id === 'reading' ? { ...stage, steps: stage.steps.map(step =>
      step.kind === 'exercise' && step.ex.kind === 'reading-choice' && step.ex.mode === 'choice'
        ? { ...step, ex: { ...step.ex, readingText: undefined } } : step) } : stage
  }
  return out
}

async function restoreReading(stage: Stage): Promise<Stage> {
  const entries = await loadLiveReadingCatalog()
  const passages = new Map<string, string>()
  const relevant = entries.filter(entry => stageExerciseIds(stage).some(id => id.startsWith('ex.reading.' + entry.id + '.')))
  await Promise.all(relevant.map(async entry => {
    const text = await loadLiveReadingText(entry)
    passages.set(entry.id, text.title + '\n\n' + text.text)
  }))
  return { ...stage, steps: stage.steps.map(step => {
    if (step.kind !== 'exercise' || step.ex.kind !== 'reading-choice' || step.ex.mode !== 'choice') return step
    const id = step.ex.id
    const entry = relevant.find(entry => id.startsWith('ex.reading.' + entry.id + '.'))
    const readingText = entry && passages.get(entry.id)
    if (!readingText) throw new Error('assigned_reading_unavailable')
    return { ...step, ex: { ...step.ex, readingText } }
  }) }
}

/** Project old snapshots without mutating assignments or historical results.
 * Persisted exercise IDs remain slot keys across devices and reloads. */
async function restoreLegacyStage(stage: Stage, day: number, expectedById: ReadonlyMap<string, string>): Promise<Stage> {
  const used = new Set(stage.steps.flatMap(step => step.kind === 'exercise' ? [step.ex] : step.kind === 'exercise-batch' ? step.exercises : [])
    .filter(ex => !isLegacyForm(ex)).map(sentenceSourceKey))
  let missing = false
  let changed = false
  async function restore(ex: Exercise): Promise<Exercise | null> {
    if (!isLegacyForm(ex)) return ex
    changed = true
    const previous = expectedById.get(ex.id)
    const replacement = await contextualizeLegacy(ex.id, day, ex.grammarRuleIds, legacyExpected(ex), used).catch(() => null)
    // Reserve the same replacement on every reload, even if the old answer
    // must be displayed with its original prompt.
    if (replacement) used.add(sentenceSourceKey(replacement))
    // Never attach an already saved answer to a different expected form.
    if (previous !== undefined && (!replacement || legacyExpected(replacement)[0] !== previous)) return ex
    if (!replacement) { missing = true; return null }
    return { ...replacement, attemptsAllowed: ex.attemptsAllowed ?? 1 }
  }
  const steps: Step[] = []
  for (const step of stage.steps) {
    if (step.kind === 'exercise') {
      const ex = await restore(step.ex)
      if (ex) steps.push(ex === step.ex ? step : { ...step, ex, variants: undefined })
    } else if (step.kind === 'exercise-batch') {
      const exercises: Exercise[] = []
      for (const old of step.exercises) {
        const ex = await restore(old)
        if (ex) exercises.push(ex)
      }
      if (exercises.length) steps.push({ ...step, exercises })
    } else steps.push(step)
  }
  if (!changed) return stage
  const estimatedSec = steps.reduce((sum, step) => sum + (step.kind === 'exercise' ? step.ex.estimatedSec : step.kind === 'exercise-batch' ? step.exercises.reduce((seconds, ex) => seconds + ex.estimatedSec, 0) : step.kind === 'rule-intro' ? 60 : 0), 0)
  return { ...stage, steps, estimatedSec, missingContent: missing ? 'Nie udało się dobrać zdania do części zapisanych zadań.' : stage.missingContent }
}

/** Reading the dashboard does not assign anything; starting a lesson does. */
export async function reconcileLessonAssignments(plan: TodayPlan, persist: boolean): Promise<TodayPlan> {
  if (plan.day.kind === 'diagnostic') return plan
  const candidate = assignmentMap(plan)
  const response = await fetch('/api/lesson-assignments/?day=' + plan.dayNumber, {
    method: persist ? 'POST' : 'GET',
    cache: 'no-store',
    ...(persist ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(candidate) } : {}),
  })
  if (!response.ok) throw new Error('lesson_assignments_unavailable')
  const { stages: saved } = await response.json() as { stages: AssignmentMap }
  const stages = plan.stages.filter(stage => !isAssignedStage(stage.id))
  const state = await loadState()
  const expectedById = new Map(state.exerciseResults.filter(row => row.dayNumber === plan.dayNumber).map(row => [row.exerciseId, row.expected]))
  for (const id of ASSIGNED_STAGE_IDS) {
    const stored = saved[id]
    const stage = stored ?? plan.stages.find(stage => stage.id === id)
    if (stage) stages.push(stored ? id === 'reading' ? await restoreReading(stage) : await restoreLegacyStage(stage, plan.dayNumber, expectedById) : stage)
  }
  return { ...plan, stages, estimatedSec: stages.reduce((sum, stage) => sum + stage.estimatedSec, 0) }
}
