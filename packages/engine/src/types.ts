/**
 * Типы движка.
 *
 * Здесь НЕТ ничего польского. Движок не знает, какой язык учат, к какому
 * экзамену готовятся и сколько в курсе дней — всё приходит данными.
 * Это проверяется правилом R8 из DEV_RULES.md.
 */
import type { Card, Grade } from 'ts-fsrs'

export type ModuleId = string
export type StudyItemKind = 'lexeme-recognition' | 'lexeme-production' | 'rule-card'

export interface StudyItem {
  id: string
  kind: StudyItemKind
  refId: string
  card: Card
}

/** Сколько секунд в среднем занимает один отзыв данного типа. */
export const REVIEW_COST_SEC: Record<StudyItemKind, number> = {
  'lexeme-recognition': 6,
  'lexeme-production': 13,
  'rule-card': 10,
}

export interface RuleMastery {
  grammarRuleId: string
  /** 0..1 — оценка владения правилом как навыком */
  mastery: number
  attempts: number
  correct: number
  lastPracticedAt: number | null
}

export interface ModuleScore {
  moduleId: ModuleId
  estimatedPercent: number
  confidence: number
}

/** Правило сдачи экзамена — стратегия, а не число. ARCHITECTURE.md §4.4 */
export type PassRule =
  | { kind: 'per-module-floor'; thresholdPercent: number }
  | { kind: 'aggregate'; thresholdPercent: number }
  | { kind: 'weighted-average'; weights: Record<ModuleId, number>; threshold: number }
