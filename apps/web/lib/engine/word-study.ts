import type { Exercise } from '@polski/engine'
import { exercisesForWord } from './exercises'
import type { Lexeme } from '@/lib/content/curriculum'

export type WordStudyStep =
  | { kind: 'word-intro'; word: Lexeme }
  | { kind: 'exercise'; word: Lexeme; ex: Exercise }

/**
 * Строит один последовательный набор слов.
 *
 * Для каждого слова есть пять этапов:
 * карточка → слово/перевод → перевод/слово → сборка → аудио-ввод.
 * Первые два этапа соседних слов чередуются, затем остальные упражнения
 * идут по кругу, чтобы одно слово не повторялось подряд.
 */
export function buildWordStudySteps(
  words: readonly Lexeme[],
  pool: readonly Lexeme[],
  exerciseIdPrefix = '',
): WordStudyStep[] {
  const queues = words.map((word) => ({
    word,
    exercises: exercisesForWord(word, [...pool]).map((ex) => ({
      ...ex,
      id: `${exerciseIdPrefix}${ex.id}`,
    })),
    nextExercise: 0,
  }))
  const steps: WordStudyStep[] = []
  const pending: typeof queues = []

  const appendNext = (queue: (typeof queues)[number]) => {
    const ex = queue.exercises[queue.nextExercise]
    queue.nextExercise += 1
    if (ex) steps.push({ kind: 'exercise', word: queue.word, ex })
  }

  for (const queue of queues) {
    steps.push({ kind: 'word-intro', word: queue.word })
    appendNext(queue)
    pending.push(queue)
    if (pending.length >= 2) {
      const next = pending.shift()!
      appendNext(next)
      if (next.nextExercise < next.exercises.length) pending.push(next)
    }
  }

  while (pending.length) {
    const next = pending.shift()!
    appendNext(next)
    if (next.nextExercise < next.exercises.length) pending.push(next)
  }

  return steps
}

export function wordExerciseIds(
  steps: readonly WordStudyStep[],
): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const step of steps) {
    if (step.kind !== 'exercise' || !step.ex.lexemeId) continue
    const ids = result.get(step.ex.lexemeId) ?? []
    ids.push(step.ex.id)
    result.set(step.ex.lexemeId, ids)
  }
  return result
}
