import type { Exercise } from '@polski/engine'
import type { Step } from './plan'

export const GRAMMAR_FORMATS = ['choice', 'typed', 'write'] as const
export type GrammarFormat = (typeof GRAMMAR_FORMATS)[number]
type Drill = Extract<Step, { kind: 'exercise' }>
type Topic = { rule: Drill['rule']; exercises: Exercise[] }

export function grammarFormat(exercise: Exercise): GrammarFormat | null {
  if (exercise.kind === 'sentence-write') return 'write'
  if (exercise.mode === 'choice' || exercise.mode === 'typed') return exercise.mode
  return null
}

export function grammarPracticePlan(steps: readonly Step[]) {
  const exercises: Exercise[] = []
  const topics = new Map<string | null, Topic>()
  const byFormat: Record<GrammarFormat, Exercise[]> = { choice: [], typed: [], write: [] }
  const ids = new Set<string>()

  for (const step of steps) {
    if (step.kind !== 'exercise') continue
    const format = grammarFormat(step.ex)
    if (!format || ids.has(step.ex.id)) continue
    ids.add(step.ex.id)
    exercises.push(step.ex)
    byFormat[format].push(step.ex)

    const id = step.rule?.id ?? null
    const topic = topics.get(id) ?? { rule: step.rule, exercises: [] }
    topic.exercises.push(step.ex)
    topics.set(id, topic)
  }

  const quick: Exercise[] = []
  for (let index = 0; index < 5 && quick.length < Math.min(5, exercises.length); index++) {
    for (const format of GRAMMAR_FORMATS) {
      const exercise = byFormat[format][index]
      if (exercise) quick.push(exercise)
      if (quick.length === 5) break
    }
  }

  return { exercises, quick, topics: [...topics.values()] }
}
