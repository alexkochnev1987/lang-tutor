import { translateProduction, translateRecognition, type Exercise } from '@polski/engine'
import type { Lexeme } from '@/lib/content/curriculum'
import type { AnswerPayload } from '@/lib/data/store'
import type { ExerciseResultRow, LessonSessionRow } from '@/lib/data/types'

const skills = {
  translation: 'lexeme-recognition',
  reverse: 'lexeme-production',
  writing: 'lexeme-spelling',
  listening: 'lexeme-listen-write',
  pronunciation: 'lexeme-pronunciation',
} as const

export type WordFormat = keyof typeof skills
export const WORD_FORMATS = ['translation', 'reverse', 'writing', 'listening'] as const
export const WORD_SKILL_FORMATS = [...WORD_FORMATS, 'pronunciation'] as const
export const WORD_PRACTICE_FORMATS = ['brainstorm', ...WORD_SKILL_FORMATS] as const
export type WordPracticeFormat = (typeof WORD_PRACTICE_FORMATS)[number]

export const wordSkill = (format: WordFormat) => skills[format]

export type DailyWordQueue = {
  day: string
  learn: string[]
  review: string[]
  reviewByFormat: Record<WordFormat, string[]>
  practicedToday: number
  learnedToday?: number
  /** Earliest upcoming word review, for refreshing the queue without reloading the app. */
  nextReviewAt?: string | null
}
export type DailyWordList = 'learn' | 'review'

/** Brainstorm covers the four non-speech skills. Each review count is unique by word. */
export function wordsForFormat(queue: DailyWordQueue | null, list: DailyWordList, format: WordPracticeFormat): string[] {
  if (!queue) return []
  if (list === 'learn') return queue.learn
  if (!queue.reviewByFormat) return queue.review // compatibility with an older deployment
  if (format !== 'brainstorm') return queue.reviewByFormat[format]
  const due = new Set(WORD_FORMATS.flatMap((skill) => queue.reviewByFormat[skill]))
  return queue.review.filter((id) => due.has(id))
}

export function buildDailyWordLists(rows: readonly {
  id: string; seen: boolean; known: boolean; kinds: string[] | null; due_kinds: string[] | null
}[]): Pick<DailyWordQueue, 'learn' | 'review' | 'reviewByFormat'> {
  const reviewByFormat: Record<WordFormat, string[]> = { translation: [], reverse: [], writing: [], listening: [], pronunciation: [] }
  const learn: string[] = []
  const review: string[] = []
  for (const row of rows) {
    if (row.known) continue
    if (!row.seen) { learn.push(row.id); continue }
    // Unpractised skills remain available after the first answer in another format.
    const due = WORD_SKILL_FORMATS.filter((format) =>
      !row.kinds?.includes(wordSkill(format)) || row.due_kinds?.includes(wordSkill(format)))
    if (due.length) review.push(row.id)
    for (const format of due) reviewByFormat[format].push(row.id)
  }
  return { learn, review, reviewByFormat }
}

export function reviewFormatsForWord(queue: DailyWordQueue, id: string): WordFormat[] {
  return WORD_SKILL_FORMATS.filter((format) => queue.reviewByFormat?.[format].includes(id) ?? queue.review.includes(id))
}

/** Project only the submitted skills; another outstanding skill keeps the word in review. */
export function projectDailyWordQueue(queue: DailyWordQueue, answers: readonly DailyWordAnswer[], now = Date.now()): DailyWordQueue {
  if (!queue.reviewByFormat || !answers.length) return queue
  const learn = new Set(queue.learn)
  const review = new Set(queue.review)
  const byFormat = Object.fromEntries(WORD_SKILL_FORMATS.map((format) => [format, new Set(queue.reviewByFormat[format])])) as Record<WordFormat, Set<string>>
  let nextReviewAt = queue.nextReviewAt ?? null
  for (const { item, format } of answers) {
    const id = item.refId
    if (learn.delete(id)) for (const skill of WORD_SKILL_FORMATS) byFormat[skill].add(id)
    const due = item.due.getTime()
    if (due > now) {
      byFormat[format].delete(id)
      if (!nextReviewAt || due < Date.parse(nextReviewAt)) nextReviewAt = item.due.toISOString()
    } else byFormat[format].add(id)
    if (WORD_SKILL_FORMATS.some((skill) => byFormat[skill].has(id))) review.add(id)
    else review.delete(id)
  }
  return {
    ...queue, learn: [...learn], review: [...review], nextReviewAt,
    reviewByFormat: Object.fromEntries(WORD_SKILL_FORMATS.map((format) => [format, [...byFormat[format]]])) as Record<WordFormat, string[]>,
  }
}
export type DailyWordAnswer = AnswerPayload & {
  log: NonNullable<AnswerPayload['log']>
  format: WordFormat
  result: Omit<ExerciseResultRow, 'courseId' | 'completedAt'>
}
export type DailyWordSubmission = DailyWordAnswer | {
  format: 'brainstorm'
  answers: DailyWordAnswer[]
  sessionId: string
  startedAt: string
}

export function brainstormWordSession(
  submission: Extract<DailyWordSubmission, { format: 'brainstorm' }>,
): Omit<LessonSessionRow, 'completedAt' | 'actualMs'> {
  const first = submission.answers[0]!
  const itemsReviewed = submission.answers.reduce((total, { result }) => total + result.attempts, 0)
  const itemsCorrect = submission.answers.filter(({ result }) => result.correct).length
  return {
    id: `${submission.sessionId}:word:${first.item.refId}`,
    dayNumber: first.result.dayNumber,
    kind: itemsCorrect === submission.answers.length ? 'words' : 'words-failed',
    startedAt: new Date(submission.startedAt),
    plannedBudgetMs: itemsReviewed * 20_000,
    itemsReviewed,
    itemsCorrect,
  }
}

export function dailyWordExercise(word: Lexeme, pool: readonly Lexeme[], format: WordFormat, seed: number): Exercise {
  switch (format) {
    case 'pronunciation':
      return {
        id: `ex.pronunciation.${word.id}`,
        kind: 'pronunciation',
        mode: 'typed',
        lexemeId: word.id,
        grammarRuleIds: [],
        prompt: word.translation,
        instruction: 'Powiedz słowo po polsku',
        accepted: [word.lemma],
        moduleId: 'speaking',
        difficulty: 3,
        estimatedSec: 20,
      }
    case 'reverse':
      return { ...translateProduction(word, pool.map(({ lemma }) => lemma), { seed }), attemptsAllowed: 1 }
    case 'writing':
      return {
        id: `ex.write-word.${word.id}`,
        kind: 'translate-production',
        mode: 'typed',
        lexemeId: word.id,
        grammarRuleIds: [],
        prompt: word.translation,
        instruction: 'Wpisz słowo po polsku',
        accepted: [word.lemma],
        speakText: word.lemma,
        moduleId: 'writing',
        difficulty: 3,
        estimatedSec: 15,
        attemptsAllowed: 1,
      }
    default: {
      const choice = translateRecognition(word, pool.map(({ translation }) => translation), { seed })
      return format === 'listening'
        ? { ...choice, id: `ex.listen-choice.${word.id}`, kind: 'listen-choice', prompt: '',
            speakText: word.lemma, instruction: 'Posłuchaj i wybierz tłumaczenie', moduleId: 'listening', attemptsAllowed: 1 }
        : { ...choice, attemptsAllowed: 1 }
    }
  }
}

export function formatOfWordExercise(exercise: Exercise): WordFormat {
  switch (exercise.kind) {
    case 'pronunciation':
      return 'pronunciation'
    case 'listen-choice':
    case 'listen-write':
      return 'listening'
    case 'spelling':
      return 'writing'
    case 'translate-production':
      return exercise.mode === 'typed' ? 'writing' : 'reverse'
    default:
      return 'translation'
  }
}
