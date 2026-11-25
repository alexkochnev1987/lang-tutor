import type { Stage, TodayPlan } from './plan'
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
  for (const id of ASSIGNED_STAGE_IDS) {
    const stored = saved[id]
    const stage = stored ?? plan.stages.find(stage => stage.id === id)
    if (stage) stages.push(stored && id === 'reading' ? await restoreReading(stage) : stage)
  }
  return { ...plan, stages, estimatedSec: stages.reduce((sum, stage) => sum + stage.estimatedSec, 0) }
}
