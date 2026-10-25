/**
 * Сборка занятия на день.
 *
 * Вход: план дня из программы + текущее состояние пользователя.
 * Выход: упорядоченный список активностей, который помещается в бюджет.
 *
 * Правила приоритизации, по убыванию:
 *   1. Просроченные повторения — иначе теряется уже вложенное время
 *   2. Слабейший модуль экзамена — он решает исход (D2)
 *   3. Слабые грамматические правила — дриллы
 *   4. Новый материал дня — только если осталось место
 *   5. Разбор ошибок — всегда в конце, фиксированной длины
 *
 * При завале очереди новый материал не вводится вовсе: сначала разгрести.
 */
import type { FSRS } from 'ts-fsrs'
import { buildQueue, newItemAllowance, type QueueResult } from '../srs/queue'
import { weakestRules, type MasteryConfig } from '../mastery/mastery'
import { allocateExamTime, evaluate } from '../readiness/readiness'
import type { ModuleId, ModuleScore, PassRule, RuleMastery, StudyItem } from '../types'

export interface DayPlan {
  day: number
  kind: 'diagnostic' | 'new' | 'consolidation' | 'weekly-check' | 'checkpoint' | 'final'
  grammarRuleIds: string[]
  lexemeIds: string[]
  newWordCount: number
  examFocus: ModuleId
  timeBudgetSec: {
    review: number
    newGrammar: number
    practice: number
    exam: number
    analysis: number
  }
}

export interface LessonInput {
  scheduler: FSRS
  plan: DayPlan
  items: StudyItem[]
  mastery: RuleMastery[]
  moduleScores: ModuleScore[]
  passRule: PassRule
  now: Date
  masteryConfig?: MasteryConfig
}

export type ActivityKind =
  | 'review'          // повторение по FSRS
  | 'new-grammar'     // объяснение нового правила
  | 'grammar-drill'   // дрилл по слабому правилу
  | 'new-words'       // ввод новых слов
  | 'exam-task'       // задание в формате экзамена
  | 'error-review'    // разбор ошибок

export interface Activity {
  kind: ActivityKind
  budgetSec: number
  /** Что именно показывать: id карточек, правил, лексем */
  refIds: string[]
  moduleId?: ModuleId
  /** Почему эта активность здесь — для экрана и для отладки */
  reason: string
}

export interface Lesson {
  day: number
  activities: Activity[]
  totalSec: number
  queue: QueueResult
  weakestModule: ModuleId | null
  notes: string[]
}

export function generateLesson(input: LessonInput): Lesson {
  const { scheduler, plan, items, mastery, moduleScores, passRule, now } = input
  const b = plan.timeBudgetSec
  const notes: string[] = []
  const activities: Activity[] = []

  // ── 1. Повторения, с потолком по бюджету ────────────────────────────
  const queue = buildQueue({ scheduler, items, now, budgetSec: b.review })
  if (queue.due.length) {
    activities.push({
      kind: 'review',
      budgetSec: queue.estimatedSec,
      refIds: queue.due.map((i) => i.id),
      reason: `${queue.due.length} элементов к повторению`,
    })
  }
  if (queue.deferred > 0) {
    notes.push(`Отложено ${queue.deferred} повторений — не поместились в бюджет`)
  }
  if (queue.backlog) {
    notes.push('Завал очереди: новые слова сегодня не вводятся, разгребаем старое')
  }

  // ── 2. Новая грамматика ─────────────────────────────────────────────
  if (b.newGrammar > 0 && plan.grammarRuleIds.length && !queue.backlog) {
    activities.push({
      kind: 'new-grammar',
      budgetSec: b.newGrammar,
      refIds: plan.grammarRuleIds,
      reason: 'новое правило по программе',
    })
  } else if (b.newGrammar > 0 && queue.backlog) {
    notes.push('Новое правило отложено до разгребания очереди')
  }

  // ── 3. Практика: слабые правила вперёд ──────────────────────────────
  if (b.practice > 0) {
    const weak = weakestRules(mastery, now.getTime(), 3, input.masteryConfig)
    const refIds = weak.length
      ? weak.map((m) => m.grammarRuleId)
      : plan.grammarRuleIds
    activities.push({
      kind: weak.length ? 'grammar-drill' : 'grammar-drill',
      budgetSec: b.practice,
      refIds,
      reason: weak.length
        ? `слабые правила: ${weak.map((m) => m.grammarRuleId).join(', ')}`
        : 'отработка правила дня',
    })
  }

  // ── 4. Новые слова — сколько реально потянем ────────────────────────
  const allowance = newItemAllowance(plan.newWordCount, queue, b.review)
  if (allowance > 0 && plan.lexemeIds.length) {
    activities.push({
      kind: 'new-words',
      budgetSec: allowance * 20,
      refIds: plan.lexemeIds.slice(0, allowance),
      reason: `${allowance} новых слов`,
    })
    if (allowance < plan.newWordCount) {
      notes.push(`Новых слов урезано: ${plan.newWordCount} → ${allowance}, нагрузка высокая`)
    }
  } else if (plan.newWordCount > 0) {
    notes.push('Новые слова пропущены: бюджет занят повторениями')
  }

  // ── 5. Экзаменационный блок: слабейшему модулю больше времени ───────
  if (b.exam > 0) {
    const verdict = evaluate(moduleScores, passRule)
    const alloc = allocateExamTime(moduleScores, passRule, b.exam)
    // на обычном дне — один модуль; на срезе — все
    const isCheck = plan.kind === 'checkpoint' || plan.kind === 'final'
    if (isCheck) {
      for (const [moduleId, sec] of Object.entries(alloc)) {
        if (sec <= 0) continue
        activities.push({
          kind: 'exam-task', budgetSec: sec, refIds: [], moduleId,
          reason: 'контрольный срез по всем модулям',
        })
      }
    } else {
      // слабейший перебивает ротацию из программы
      const moduleId = verdict.weakest && verdict.gap > 0 ? verdict.weakest : plan.examFocus
      activities.push({
        kind: 'exam-task', budgetSec: b.exam, refIds: [], moduleId,
        reason: moduleId === verdict.weakest
          ? `слабейший модуль, отставание ${Math.round(verdict.gap)} п.п.`
          : 'модуль по ротации программы',
      })
    }
  }

  // ── 6. Разбор ошибок — всегда в конце ───────────────────────────────
  if (b.analysis > 0) {
    activities.push({
      kind: 'error-review', budgetSec: b.analysis, refIds: [],
      reason: 'фиксация ошибок занятия',
    })
  }

  const totalSec = activities.reduce((s, a) => s + a.budgetSec, 0)
  const verdict = evaluate(moduleScores, passRule)

  return { day: plan.day, activities, totalSec, queue, weakestModule: verdict.weakest, notes }
}
