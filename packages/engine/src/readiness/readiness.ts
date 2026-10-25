/**
 * Готовность к экзамену и выбор слабейшего модуля.
 *
 * Самое важное решение всего проекта живёт здесь (PLAN.md D2):
 * у польского B1 порог 50% считается ПО КАЖДОМУ модулю отдельно, значит
 * оптимизировать надо МИНИМУМ, а не среднее. Провал одного модуля —
 * провал экзамена, даже со 100% в остальных четырёх.
 *
 * Правило сдачи приходит данными, поэтому тот же код обслужит экзамен с
 * другой логикой (средний балл, бандовая шкала) без единого `if` снаружи.
 */
import type { ModuleId, ModuleScore, PassRule } from '../types'

export interface ReadinessVerdict {
  ready: boolean
  /** Какой модуль тянуть в первую очередь */
  weakest: ModuleId | null
  /** Насколько слабейший отстаёт от цели, в процентных пунктах */
  gap: number
  perModule: { moduleId: ModuleId; percent: number; passes: boolean }[]
}

/** Запас над официальным порогом: реальный экзамен тяжелее тренировки. */
export const SAFETY_MARGIN_PP = 15

export function evaluate(
  scores: ModuleScore[], rule: PassRule, marginPp = SAFETY_MARGIN_PP,
): ReadinessVerdict {
  if (scores.length === 0) {
    return { ready: false, weakest: null, gap: 100, perModule: [] }
  }

  switch (rule.kind) {
    case 'per-module-floor': {
      const target = rule.thresholdPercent + marginPp
      const perModule = scores.map((s) => ({
        moduleId: s.moduleId,
        percent: s.estimatedPercent,
        passes: s.estimatedPercent >= target,
      }))
      const min = scores.reduce((a, b) =>
        a.estimatedPercent <= b.estimatedPercent ? a : b)
      return {
        ready: perModule.every((m) => m.passes),
        weakest: min.moduleId,
        gap: Math.max(0, target - min.estimatedPercent),
        perModule,
      }
    }

    case 'aggregate': {
      const target = rule.thresholdPercent + marginPp
      const avg = mean(scores.map((s) => s.estimatedPercent))
      const min = scores.reduce((a, b) =>
        a.estimatedPercent <= b.estimatedPercent ? a : b)
      return {
        ready: avg >= target,
        weakest: min.moduleId,
        gap: Math.max(0, target - avg),
        perModule: scores.map((s) => ({
          moduleId: s.moduleId, percent: s.estimatedPercent, passes: avg >= target,
        })),
      }
    }

    case 'weighted-average': {
      const target = rule.threshold + marginPp
      const totalW = scores.reduce((s, m) => s + (rule.weights[m.moduleId] ?? 1), 0)
      const weighted = scores.reduce(
        (s, m) => s + m.estimatedPercent * (rule.weights[m.moduleId] ?? 1), 0) / totalW
      // слабейший здесь — не минимальный, а тот, чьё отставание дороже всего
      const worst = scores.reduce((a, b) => {
        const la = (100 - a.estimatedPercent) * (rule.weights[a.moduleId] ?? 1)
        const lb = (100 - b.estimatedPercent) * (rule.weights[b.moduleId] ?? 1)
        return la >= lb ? a : b
      })
      return {
        ready: weighted >= target,
        weakest: worst.moduleId,
        gap: Math.max(0, target - weighted),
        perModule: scores.map((s) => ({
          moduleId: s.moduleId, percent: s.estimatedPercent, passes: weighted >= target,
        })),
      }
    }
  }
}

/**
 * Сколько времени экзаменационного блока отдать каждому модулю.
 *
 * Не поровну: слабейший получает больше. Но и не всё одному — иначе
 * остальные просядут, пока его подтягивают.
 */
export function allocateExamTime(
  scores: ModuleScore[], rule: PassRule, totalSec: number,
): Record<ModuleId, number> {
  const v = evaluate(scores, rule)
  const out: Record<ModuleId, number> = {}
  if (!scores.length) return out

  // вес = отставание от цели, но не меньше минимальной доли
  const MIN_SHARE = 0.08
  const gaps = scores.map((s) => {
    const m = v.perModule.find((p) => p.moduleId === s.moduleId)
    return { id: s.moduleId, gap: Math.max(1, m?.passes ? 1 : 100 - s.estimatedPercent) }
  })
  const totalGap = gaps.reduce((s, g) => s + g.gap, 0)

  let assigned = 0
  for (const g of gaps) {
    const share = Math.max(MIN_SHARE, g.gap / totalGap)
    const sec = Math.round(totalSec * share)
    out[g.id] = sec
    assigned += sec
  }
  // нормализуем, чтобы сумма сошлась ровно
  const k = totalSec / assigned
  for (const id of Object.keys(out)) out[id] = Math.round((out[id] ?? 0) * k)
  return out
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
