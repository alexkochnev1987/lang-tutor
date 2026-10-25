/**
 * Оценка готовности по модулям из текущей практики.
 *
 * До первого контрольного среза данных нет, а показывать пользователю
 * пять нулей бессмысленно и демотивирующе. Поэтому прогноз строится из
 * того, что уже известно: освоения правил и покрытия лексики.
 *
 * ЭТО ОЦЕНКА, А НЕ ИЗМЕРЕНИЕ. Поэтому у неё есть `confidence`, и реальный
 * балл пробника всегда её перебивает.
 */
import type { ModuleId, ModuleScore, RuleMastery } from '../types'
import { decayed } from '../mastery/mastery'

export interface EstimateInput {
  /** Освоение правил на текущий момент */
  mastery: RuleMastery[]
  /** Правило → модули, на которые оно работает (из grammar-rules.json) */
  ruleModules: Record<string, ModuleId[]>
  /** Сколько лексических карточек доведено до зрелого состояния */
  lexemesKnown: number
  /** Сколько всего лексики в курсе */
  lexemesTotal: number
  /** Реальные результаты пробников, если были — они главнее оценки */
  mockScores?: Partial<Record<ModuleId, number>>
  modules: ModuleId[]
  now: number
}

/**
 * Насколько модуль опирается на грамматику, а насколько — на словарь и
 * отдельный навык. Аудирование почти не выводится из грамматики, поэтому
 * его оценка заведомо неуверенная — и это честно отражено в confidence.
 */
const MODULE_WEIGHTS: Record<string, { grammar: number; lexis: number; ceiling: number }> = {
  grammar:   { grammar: 0.85, lexis: 0.15, ceiling: 1.0 },
  writing:   { grammar: 0.55, lexis: 0.45, ceiling: 0.9 },
  reading:   { grammar: 0.35, lexis: 0.65, ceiling: 0.9 },
  speaking:  { grammar: 0.45, lexis: 0.55, ceiling: 0.8 },
  // аудирование текстовыми упражнениями не тренируется: потолок низкий
  listening: { grammar: 0.25, lexis: 0.35, ceiling: 0.6 },
}

const DEFAULT_WEIGHTS = { grammar: 0.5, lexis: 0.5, ceiling: 0.9 }

export function estimateModuleReadiness(input: EstimateInput): ModuleScore[] {
  const { mastery, ruleModules, lexemesKnown, lexemesTotal, modules, now } = input
  const lexisShare = lexemesTotal > 0 ? Math.min(1, lexemesKnown / lexemesTotal) : 0

  return modules.map((moduleId) => {
    const mock = input.mockScores?.[moduleId]
    if (typeof mock === 'number') {
      // измерение всегда перебивает оценку
      return { moduleId, estimatedPercent: mock, confidence: 0.9 }
    }

    const w = MODULE_WEIGHTS[moduleId] ?? DEFAULT_WEIGHTS
    const relevant = mastery.filter((m) =>
      (ruleModules[m.grammarRuleId] ?? []).includes(moduleId))

    const grammarShare = relevant.length
      ? relevant.reduce((s, m) => s + decayed(m, now), 0) / relevant.length
      : 0

    const raw = (grammarShare * w.grammar + lexisShare * w.lexis) * w.ceiling

    // уверенность растёт с объёмом практики, но у аудирования упирается в потолок
    const practiced = relevant.reduce((s, m) => s + m.attempts, 0)
    const confidence = Math.min(0.7, practiced / 60) * (w.ceiling / 1.0)

    return {
      moduleId,
      estimatedPercent: Math.round(raw * 100),
      confidence: +confidence.toFixed(2),
    }
  })
}
