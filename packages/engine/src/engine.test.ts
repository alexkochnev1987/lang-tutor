import { describe, expect, it } from 'vitest'
import { State } from 'ts-fsrs'
import {
  applyAttempt, buildQueue, createScheduler, decayed, emptyMastery,
  evaluate, generateLesson, newItem, newItemAllowance, rate, weakestRules,
  allocateExamTime, estimateModuleReadiness, Rating,
  type DayPlan, type ModuleScore, type PassRule, type StudyItem,
} from './index'

const NOW = new Date('2026-03-01T09:00:00Z')
const DAY = 86_400_000
const PL_B1: PassRule = { kind: 'per-module-floor', thresholdPercent: 50 }

function makeItems(n: number, kind: StudyItem['kind'] = 'lexeme-recognition') {
  return Array.from({ length: n }, (_, i) => newItem(`i${i}`, kind, `ref${i}`, NOW))
}

/** Прогоняет карточку через несколько ответов, чтобы она стала просроченной. */
function maturedAndDue(s: ReturnType<typeof createScheduler>, id: string, daysAgo: number) {
  let item = newItem(id, 'lexeme-recognition', id, new Date(NOW.getTime() - daysAgo * DAY))
  const r = rate(s, item, Rating.Good, new Date(NOW.getTime() - daysAgo * DAY))
  item = r.item
  return item
}

describe('FSRS-обёртка', () => {
  it('новая карточка имеет состояние New', () => {
    const item = newItem('a', 'lexeme-recognition', 'pl.dom', NOW)
    expect(item.card.state).toBe(State.New)
    expect(item.card.reps).toBe(0)
  })

  it('оценка продвигает карточку и пишет лог', () => {
    const s = createScheduler()
    const item = newItem('a', 'lexeme-recognition', 'pl.dom', NOW)
    const { item: next, log } = rate(s, item, Rating.Good, NOW)
    expect(next.card.reps).toBe(1)
    expect(next.card.due.getTime()).toBeGreaterThan(NOW.getTime())
    expect(log.rating).toBe(Rating.Good)
  })

  it('Again назначает более ранний повтор, чем Easy', () => {
    const s = createScheduler()
    const item = newItem('a', 'lexeme-recognition', 'pl.dom', NOW)
    const again = rate(s, item, Rating.Again, NOW).item
    const easy = rate(s, item, Rating.Easy, NOW).item
    expect(again.card.due.getTime()).toBeLessThan(easy.card.due.getTime())
  })
})

describe('очередь повторений', () => {
  it('никогда не превышает бюджет', () => {
    const s = createScheduler()
    const items = Array.from({ length: 200 }, (_, i) => maturedAndDue(s, `i${i}`, 60))
    const q = buildQueue({ scheduler: s, items, now: NOW, budgetSec: 180 })
    expect(q.estimatedSec).toBeLessThanOrEqual(180)
    expect(q.due.length).toBeLessThanOrEqual(30) // 180 / 6 с
  })

  it('при большом завале включает режим разгребания', () => {
    const s = createScheduler()
    const items = Array.from({ length: 300 }, (_, i) => maturedAndDue(s, `i${i}`, 90))
    const q = buildQueue({ scheduler: s, items, now: NOW, budgetSec: 180 })
    expect(q.backlog).toBe(true)
    expect(q.suppressNewItems).toBe(true)
    expect(newItemAllowance(10, q, 180)).toBe(0)
  })

  it('новые карточки в очередь не попадают', () => {
    const s = createScheduler()
    const q = buildQueue({ scheduler: s, items: makeItems(50), now: NOW, budgetSec: 600 })
    expect(q.due).toHaveLength(0)
  })

  it('ввод новых слов урезается, когда повторений много', () => {
    const s = createScheduler()
    const items = Array.from({ length: 25 }, (_, i) => maturedAndDue(s, `i${i}`, 30))
    const q = buildQueue({ scheduler: s, items, now: NOW, budgetSec: 180 })
    expect(newItemAllowance(10, q, 180)).toBeLessThan(10)
  })
})

describe('модель освоения грамматики', () => {
  it('верные ответы поднимают mastery, неверные роняют', () => {
    let m = emptyMastery('r1')
    for (let i = 0; i < 6; i++)
      m = applyAttempt(m, { correct: true, exerciseDifficulty: 3, at: NOW.getTime() })
    const high = m.mastery
    expect(high).toBeGreaterThan(0.6)

    m = applyAttempt(m, { correct: false, exerciseDifficulty: 3, at: NOW.getTime() })
    expect(m.mastery).toBeLessThan(high)
  })

  it('ошибка штрафует сильнее, чем успех вознаграждает', () => {
    const base = emptyMastery('r')
    const up = applyAttempt({ ...base, mastery: 0.5 },
      { correct: true, exerciseDifficulty: 3, at: NOW.getTime() })
    const down = applyAttempt({ ...base, mastery: 0.5 },
      { correct: false, exerciseDifficulty: 3, at: NOW.getTime() })
    expect(up.mastery - 0.5).toBeLessThan(0.5 - down.mastery)
  })

  it('трудное упражнение весит больше лёгкого', () => {
    const base = { ...emptyMastery('r'), mastery: 0.5 }
    const easy = applyAttempt(base, { correct: true, exerciseDifficulty: 1, at: NOW.getTime() })
    const hard = applyAttempt(base, { correct: true, exerciseDifficulty: 5, at: NOW.getTime() })
    expect(hard.mastery).toBeGreaterThan(easy.mastery)
  })

  it('без практики навык проседает, но медленно', () => {
    const m = { ...emptyMastery('r'), mastery: 0.9, attempts: 10, correct: 9,
                lastPracticedAt: NOW.getTime() }
    const after30 = decayed(m, NOW.getTime() + 30 * DAY)
    const after180 = decayed(m, NOW.getTime() + 180 * DAY)
    expect(after30).toBeLessThan(0.9)
    expect(after30).toBeGreaterThan(0.7)   // за месяц не обваливается
    expect(after180).toBeLessThan(after30)
  })

  it('слабейшие правила идут первыми', () => {
    const now = NOW.getTime()
    const rules = [
      { ...emptyMastery('ok'),   mastery: 0.9, attempts: 5, lastPracticedAt: now },
      { ...emptyMastery('weak'), mastery: 0.2, attempts: 5, lastPracticedAt: now },
      { ...emptyMastery('mid'),  mastery: 0.5, attempts: 5, lastPracticedAt: now },
    ]
    const weak = weakestRules(rules, now, 2)
    expect(weak.map((m) => m.grammarRuleId)).toEqual(['weak', 'mid'])
  })
})

describe('готовность к экзамену', () => {
  const scores = (v: Record<string, number>): ModuleScore[] =>
    Object.entries(v).map(([moduleId, estimatedPercent]) =>
      ({ moduleId, estimatedPercent, confidence: 0.8 }))

  it('помодульный порог: один проваленный модуль валит всё', () => {
    const v = evaluate(scores({ listening: 40, reading: 95, grammar: 95, writing: 95, speaking: 95 }), PL_B1)
    expect(v.ready).toBe(false)
    expect(v.weakest).toBe('listening')
  })

  it('средний балл НЕ спасает при помодульном пороге', () => {
    // среднее 84%, но аудирование 40 — экзамен провален
    const v = evaluate(scores({ listening: 40, reading: 95, grammar: 95, writing: 95, speaking: 95 }), PL_B1)
    const avg = evaluate(scores({ listening: 40, reading: 95, grammar: 95, writing: 95, speaking: 95 }),
      { kind: 'aggregate', thresholdPercent: 50 })
    expect(v.ready).toBe(false)
    expect(avg.ready).toBe(true)   // другая стратегия — другой вердикт
  })

  it('учитывает запас над официальным порогом', () => {
    const v = evaluate(scores({ a: 55, b: 55 }), PL_B1)
    expect(v.ready).toBe(false)   // 55% > 50%, но меньше 50+15
  })

  it('готов, когда все модули выше цели', () => {
    const v = evaluate(scores({ a: 70, b: 70, c: 70 }), PL_B1)
    expect(v.ready).toBe(true)
    expect(v.gap).toBe(0)
  })

  it('слабейший модуль получает больше времени', () => {
    const alloc = allocateExamTime(scores({ weak: 20, ok: 90 }), PL_B1, 600)
    expect(alloc.weak!).toBeGreaterThan(alloc.ok!)
    expect(alloc.weak! + alloc.ok!).toBeCloseTo(600, -1)
  })
})

describe('генератор занятия', () => {
  const plan: DayPlan = {
    day: 30, kind: 'new',
    grammarRuleIds: ['pl.gram.c-gen'], lexemeIds: ['pl.a', 'pl.b', 'pl.c'],
    newWordCount: 3, examFocus: 'reading',
    timeBudgetSec: { review: 240, newGrammar: 180, practice: 300, exam: 120, analysis: 60 },
  }
  const scores: ModuleScore[] = [
    { moduleId: 'listening', estimatedPercent: 30, confidence: 0.6 },
    { moduleId: 'reading', estimatedPercent: 80, confidence: 0.8 },
  ]

  it('не превышает дневной бюджет', () => {
    const s = createScheduler()
    const lesson = generateLesson({
      scheduler: s, plan, items: makeItems(10), mastery: [],
      moduleScores: scores, passRule: PL_B1, now: NOW,
    })
    expect(lesson.totalSec).toBeLessThanOrEqual(900)
  })

  it('экзаменационный блок отдаёт слабейшему модулю, а не ротации', () => {
    const s = createScheduler()
    const lesson = generateLesson({
      scheduler: s, plan, items: [], mastery: [],
      moduleScores: scores, passRule: PL_B1, now: NOW,
    })
    const exam = lesson.activities.find((a) => a.kind === 'exam-task')
    expect(exam?.moduleId).toBe('listening')   // не 'reading' из плана
    expect(lesson.weakestModule).toBe('listening')
  })

  it('при завале не вводит новое правило и новые слова', () => {
    const s = createScheduler()
    const items = Array.from({ length: 300 }, (_, i) => maturedAndDue(s, `i${i}`, 90))
    const lesson = generateLesson({
      scheduler: s, plan, items, mastery: [],
      moduleScores: scores, passRule: PL_B1, now: NOW,
    })
    expect(lesson.activities.some((a) => a.kind === 'new-grammar')).toBe(false)
    expect(lesson.activities.some((a) => a.kind === 'new-words')).toBe(false)
    expect(lesson.notes.join(' ')).toContain('Завал')
  })

  it('на контрольном срезе задействует все модули', () => {
    const s = createScheduler()
    const checkpoint: DayPlan = {
      ...plan, kind: 'checkpoint',
      timeBudgetSec: { review: 0, newGrammar: 0, practice: 0, exam: 840, analysis: 60 },
    }
    const lesson = generateLesson({
      scheduler: s, plan: checkpoint, items: [], mastery: [],
      moduleScores: scores, passRule: PL_B1, now: NOW,
    })
    const exams = lesson.activities.filter((a) => a.kind === 'exam-task')
    expect(exams).toHaveLength(2)
  })

  it('слабые правила вытесняют правило дня из практики', () => {
    const s = createScheduler()
    const mastery = [{ ...emptyMastery('pl.gram.v-government'),
      mastery: 0.15, attempts: 8, correct: 1, lastPracticedAt: NOW.getTime() }]
    const lesson = generateLesson({
      scheduler: s, plan, items: [], mastery,
      moduleScores: scores, passRule: PL_B1, now: NOW,
    })
    const drill = lesson.activities.find((a) => a.kind === 'grammar-drill')
    expect(drill?.refIds).toContain('pl.gram.v-government')
  })
})

describe('оценка готовности из практики', () => {
  const MODULES = ['listening', 'reading', 'grammar', 'writing', 'speaking']
  const ruleModules = {
    r1: ['grammar', 'writing'],
    r2: ['grammar', 'speaking'],
    r3: ['reading'],
  }
  const mastery = (v: number) =>
    Object.keys(ruleModules).map((id) => ({
      ...emptyMastery(id), mastery: v, attempts: 20, correct: 18,
      lastPracticedAt: NOW.getTime(),
    }))

  const base = {
    ruleModules, lexemesKnown: 100, lexemesTotal: 200,
    modules: MODULES, now: NOW.getTime(),
  }

  it('без практики всё около нуля', () => {
    const s = estimateModuleReadiness({ ...base, mastery: [], lexemesKnown: 0 })
    expect(s.every((m) => m.estimatedPercent === 0)).toBe(true)
  })

  it('рост освоения поднимает оценку', () => {
    const low = estimateModuleReadiness({ ...base, mastery: mastery(0.2) })
    const high = estimateModuleReadiness({ ...base, mastery: mastery(0.9) })
    const g = (xs: typeof low, id: string) =>
      xs.find((m) => m.moduleId === id)!.estimatedPercent
    expect(g(high, 'grammar')).toBeGreaterThan(g(low, 'grammar'))
  })

  it('у аудирования потолок ниже: текстом его не натренировать', () => {
    const s = estimateModuleReadiness({
      ...base, mastery: mastery(1), lexemesKnown: 200,
    })
    const listening = s.find((m) => m.moduleId === 'listening')!
    const grammar = s.find((m) => m.moduleId === 'grammar')!
    expect(listening.estimatedPercent).toBeLessThan(grammar.estimatedPercent)
    expect(listening.estimatedPercent).toBeLessThanOrEqual(60)
  })

  it('реальный пробник перебивает оценку', () => {
    const s = estimateModuleReadiness({
      ...base, mastery: mastery(0.1), mockScores: { listening: 72 },
    })
    const l = s.find((m) => m.moduleId === 'listening')!
    expect(l.estimatedPercent).toBe(72)
    expect(l.confidence).toBeGreaterThan(0.8)
  })

  it('уверенность растёт с объёмом практики', () => {
    const few = estimateModuleReadiness({
      ...base,
      mastery: [{ ...emptyMastery('r1'), mastery: 0.8, attempts: 2, lastPracticedAt: NOW.getTime() }],
    })
    const many = estimateModuleReadiness({ ...base, mastery: mastery(0.8) })
    const c = (xs: typeof few) => xs.find((m) => m.moduleId === 'grammar')!.confidence
    expect(c(many)).toBeGreaterThan(c(few))
  })
})
