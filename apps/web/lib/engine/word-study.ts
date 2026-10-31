import type { Exercise } from '@polski/engine'
import { exercisesForWord } from './exercises'
import type { Lexeme } from '@/lib/content/curriculum'

export type WordStudyStep =
  | { kind: 'word-intro'; word: Lexeme }
  | { kind: 'exercise'; word: Lexeme; ex: Exercise }

export type WordExerciseStep = Extract<WordStudyStep, { kind: 'exercise' }>

/** Максимум дополнительных показов одного ошибочного этапа. */
export const WORD_STAGE_RETRY_LIMIT = 2

export function oneAttemptWordSteps(steps: WordStudyStep[]): WordStudyStep[] {
  return steps.map((step) => step.kind === 'exercise'
    ? { ...step, ex: { ...step.ex, attemptsAllowed: 1 } }
    : step)
}

export function wordExerciseSteps(
  word: Lexeme, pool: readonly Lexeme[], prefix = '',
): WordExerciseStep[] {
  return oneAttemptWordSteps(buildWordStudySteps([word], pool, prefix))
    .filter((step): step is WordExerciseStep => step.kind === 'exercise')
}

export function wordStageRetryPrefix(
  basePrefix: string, wordId: string, stageIndex: number, round: number,
): string {
  return `${basePrefix}retry:${round}:${wordId}:${stageIndex}:`
}

/** Создаёт только один повторный этап, не весь цикл слова. */
export function buildWordStageRetryStep(
  word: Lexeme,
  pool: readonly Lexeme[],
  basePrefix: string,
  stageIndex: number,
  round: number,
): WordExerciseStep | null {
  const step = wordExerciseSteps(
    word,
    pool,
    wordStageRetryPrefix(basePrefix, word.id, stageIndex, round),
  )[stageIndex]
  return step ?? null
}

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
