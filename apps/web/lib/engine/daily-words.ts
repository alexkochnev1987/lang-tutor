import { translateProduction, translateRecognition, type Exercise } from '@polski/engine'
import type { Lexeme } from '@/lib/content/curriculum'
import type { AnswerPayload } from '@/lib/data/store'
import type { ExerciseResultRow } from '@/lib/data/types'

const skills = {
  translation: 'lexeme-recognition',
  reverse: 'lexeme-production',
  writing: 'lexeme-spelling',
  listening: 'lexeme-listen-write',
} as const

export type WordFormat = keyof typeof skills
export const WORD_FORMATS = ['translation', 'reverse', 'writing', 'listening'] as const

export const wordSkill = (format: WordFormat) => skills[format]

export type DailyWordQueue = { day: string; learn: string[]; review: string[] }
export type DailyWordAnswer = AnswerPayload & {
  log: NonNullable<AnswerPayload['log']>
  format: WordFormat
  result: Omit<ExerciseResultRow, 'courseId' | 'completedAt'>
}

export function dailyWordExercise(word: Lexeme, pool: readonly Lexeme[], format: WordFormat, seed: number): Exercise {
  switch (format) {
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
