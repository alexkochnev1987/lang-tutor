/**
 * Освоение грамматического правила как НАВЫКА.
 *
 * Почему не FSRS (подробно — RESEARCH.md §7.3):
 *
 *   FSRS моделирует забывание одного атомарного элемента: у карточки есть
 *   stability, и по кривой считается вероятность вспомнить ИМЕННО ЕЁ.
 *
 *   Правило устроено иначе. «Dopełniacz после отрицания» применяется к
 *   бесконечному множеству предложений; знание формулировки не равно
 *   умению применить. Наблюдений много, они разнородны по сложности, и
 *   правило подкрепляется любым упражнением, где оно встретилось, а не
 *   только «своим» отзывом.
 *
 * Поэтому здесь — скользящая оценка доли верных применений с двумя
 * поправками: на сложность упражнения и на давность практики.
 */
import type { RuleMastery } from '../types'

export interface Attempt {
  correct: boolean
  /** 1..5 — сложность упражнения. Трудное весит больше */
  exerciseDifficulty: number
  at: number
}

export interface MasteryConfig {
  /** Вес нового наблюдения. Больше — быстрее реагирует, но шумнее */
  alpha: number
  /** За сколько дней без практики навык проседает на halfLifeDrop */
  decayHalfLifeDays: number
  /** На сколько проседает за один период полураспада */
  halfLifeDrop: number
  /** Ниже этого — правило считается слабым и получает дриллы */
  weakThreshold: number
  /** Выше этого — считается освоенным */
  strongThreshold: number
}

export const DEFAULT_MASTERY_CONFIG: MasteryConfig = {
  alpha: 0.25,
  decayHalfLifeDays: 30,
  halfLifeDrop: 0.15,
  weakThreshold: 0.6,
  strongThreshold: 0.85,
}

export function emptyMastery(grammarRuleId: string): RuleMastery {
  return { grammarRuleId, mastery: 0, attempts: 0, correct: 0, lastPracticedAt: null }
}

/**
 * Затухание от безделья.
 *
 * Медленнее, чем забывание слова: правило подкрепляется каждым
 * упражнением, где оно встретилось, даже если это упражнение «про другое».
 */
export function decayed(
  m: RuleMastery, now: number, cfg: MasteryConfig = DEFAULT_MASTERY_CONFIG,
): number {
  if (m.lastPracticedAt === null) return m.mastery
  const days = (now - m.lastPracticedAt) / 86_400_000
  if (days <= 0) return m.mastery
  const periods = days / cfg.decayHalfLifeDays
  return Math.max(0, m.mastery * (1 - cfg.halfLifeDrop) ** periods)
}

export function applyAttempt(
  m: RuleMastery, a: Attempt, cfg: MasteryConfig = DEFAULT_MASTERY_CONFIG,
): RuleMastery {
  const base = decayed(m, a.at, cfg)

  // Трудное упражнение информативнее лёгкого: верный ответ на difficulty 5
  // говорит о владении больше, чем верный ответ на выбор из двух вариантов.
  const weight = cfg.alpha * (0.5 + a.exerciseDifficulty / 10)
  const target = a.correct ? 1 : 0

  // Ошибка штрафует сильнее, чем вознаграждает успех: в грамматике одна
  // систематическая ошибка перевешивает несколько случайных попаданий.
  const effective = a.correct ? weight : weight * 1.5

  return {
    grammarRuleId: m.grammarRuleId,
    mastery: clamp01(base + (target - base) * Math.min(1, effective)),
    attempts: m.attempts + 1,
    correct: m.correct + (a.correct ? 1 : 0),
    lastPracticedAt: a.at,
  }
}

export const isWeak = (m: RuleMastery, now: number, cfg = DEFAULT_MASTERY_CONFIG) =>
  decayed(m, now, cfg) < cfg.weakThreshold

export const isStrong = (m: RuleMastery, now: number, cfg = DEFAULT_MASTERY_CONFIG) =>
  decayed(m, now, cfg) >= cfg.strongThreshold

/**
 * Правила, которым нужны дриллы, — слабейшие впереди.
 * Учитывается и затухание: давно не практикованное всплывает само.
 */
export function weakestRules(
  all: RuleMastery[], now: number, limit: number, cfg = DEFAULT_MASTERY_CONFIG,
): RuleMastery[] {
  return all
    .filter((m) => m.attempts > 0)
    .map((m) => ({ m, v: decayed(m, now, cfg) }))
    .filter(({ v }) => v < cfg.weakThreshold)
    .sort((a, b) => a.v - b.v)
    .slice(0, limit)
    .map(({ m }) => m)
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
