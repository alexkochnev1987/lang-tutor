#!/usr/bin/env node
/**
 * Генератор программы на 182 дня.
 *
 *   node scripts/build-curriculum.mjs
 *
 * Программа НЕ пишется руками. Она выводится из трёх источников:
 *   content/pl-b1-ru/grammar-rules.json   граф правил и порядок ввода
 *   content/pl-b1-ru/competencies.json    компетенции по модулям экзамена
 *   PARAMS ниже                           фазы, ритм недели, бюджеты времени
 *
 * Так программа остаётся воспроизводимой: поменяли параметр — пересобрали,
 * а не правили 182 записи вручную.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(root, 'content/pl-b1-ru')
const read = (f) => JSON.parse(readFileSync(join(CONTENT, f), 'utf8'))

const grammar = read('grammar-rules.json')
const comps = read('competencies.json')

// ─────────────────────────────────────────────────────────────────────
// Параметры программы
// ─────────────────────────────────────────────────────────────────────
/**
 * newWordsPerDay подобран НЕ на глаз: он выведен из измеренной стоимости
 * словаря. build-vocabulary.mjs считает, сколько секунд стоит каждое слово
 * при его прозрачности, и сопоставляет с бюджетом блока повторений.
 * Измерение на реальном ядре дало вместимость ~800 слов, а не 1092.
 * См. CURRICULUM.md §6.
 */
const PARAMS = {
  totalDays: 182,
  daysPerWeek: 7,
  dailyBudgetSec: 900, // 15 минут

  /** Ритм недели: 5 дней нового, 1 закрепление, 1 недельный срез */
  weekRhythm: ['new', 'new', 'new', 'new', 'new', 'consolidation', 'weekly-check'],

  /** Каждые 28 дней — контрольный срез по всем модулям */
  checkpointEvery: 28,

  phases: [
    {
      id: 1, from: 1, to: 28,
      title: 'Фундамент',
      goal: 'Род, число, мужско-личность, базовые спряжения, первые падежи. Цель фазы — собрать простое предложение.',
      budget: { review: 180, newGrammar: 240, practice: 300, exam: 120, analysis: 60 },
      newWordsPerDay: 6,
    },
    {
      id: 2, from: 29, to: 84,
      title: 'Падежная система',
      goal: 'Все семь падежей с существительным, прилагательным и местоимением. Времена и вид глагола.',
      budget: { review: 240, newGrammar: 180, practice: 300, exam: 120, analysis: 60 },
      newWordsPerDay: 7,
    },
    {
      id: 3, from: 85, to: 140,
      title: 'Синтаксис и формат экзамена',
      goal: 'Сложные предложения, степени сравнения, числительные. Параллельно — все типы экзаменационных заданий.',
      budget: { review: 240, newGrammar: 120, practice: 240, exam: 240, analysis: 60 },
      newWordsPerDay: 6,
    },
    {
      id: 4, from: 141, to: 182,
      title: 'Экзаменационный тренинг',
      goal: 'Новой грамматики нет. Пробные модули, разбор ошибок, письменные формы, устные сценарии.',
      budget: { review: 240, newGrammar: 0, practice: 180, exam: 420, analysis: 60 },
      newWordsPerDay: 3,
    },
  ],

  /** 16 тематических областей Katalogu B — ротация лексики */
  themes: [
    { id: '7.1',  ru: 'Человек' },               { id: '7.2',  ru: 'Дом и жильё' },
    { id: '7.3',  ru: 'Повседневная жизнь' },    { id: '7.4',  ru: 'Досуг' },
    { id: '7.5',  ru: 'Путешествия' },           { id: '7.6',  ru: 'Общество' },
    { id: '7.7',  ru: 'Здоровье' },              { id: '7.8',  ru: 'Образование' },
    { id: '7.9',  ru: 'Работа' },                { id: '7.10', ru: 'Покупки' },
    { id: '7.11', ru: 'Еда и напитки' },         { id: '7.12', ru: 'Услуги' },
    { id: '7.13', ru: 'Места' },                 { id: '7.14', ru: 'Природа' },
    { id: '7.15', ru: 'Традиции и праздники' },  { id: '7.16', ru: 'Общие темы' },
  ],
}

// ─────────────────────────────────────────────────────────────────────
// Топологический порядок правил (тот же алгоритм, что в валидаторе)
// ─────────────────────────────────────────────────────────────────────
function topoOrder(rules) {
  const byId = new Map(rules.map((r) => [r.id, r]))
  const indeg = new Map(rules.map((r) => [r.id, 0]))
  const next = new Map(rules.map((r) => [r.id, []]))
  for (const r of rules)
    for (const p of r.prerequisites ?? []) {
      if (!byId.has(p)) continue
      indeg.set(r.id, indeg.get(r.id) + 1)
      next.get(p).push(r.id)
    }
  const cmp = (a, b) =>
    (byId.get(a).difficulty - byId.get(b).difficulty) || a.localeCompare(b)
  const ready = rules.filter((r) => indeg.get(r.id) === 0).map((r) => r.id).sort(cmp)
  const out = []
  while (ready.length) {
    const id = ready.shift()
    out.push(id)
    for (const n of next.get(id)) {
      indeg.set(n, indeg.get(n) - 1)
      if (indeg.get(n) === 0) { ready.push(n); ready.sort(cmp) }
    }
  }
  if (out.length !== rules.length) throw new Error('Цикл в графе грамматики')
  return out
}

const order = topoOrder(grammar.rules)
const ruleById = new Map(grammar.rules.map((r) => [r.id, r]))

// ─────────────────────────────────────────────────────────────────────
// Раскладка дней
// ─────────────────────────────────────────────────────────────────────
const phaseOf = (d) => PARAMS.phases.find((p) => d >= p.from && d <= p.to)

function dayKind(day) {
  if (day === 1) return 'diagnostic'
  if (day === PARAMS.totalDays) return 'final'
  if (day % PARAMS.checkpointEvery === 0) return 'checkpoint'
  return PARAMS.weekRhythm[(day - 1) % PARAMS.daysPerWeek]
}

// сколько дней отводится правилу: трудное получает два
const slotsFor = (r) => (r.difficulty >= 4 ? 2 : 1)

// все дни, на которые можно поставить НОВУЮ грамматику
const newDays = []
for (let d = 1; d <= PARAMS.totalDays; d++) {
  const ph = phaseOf(d)
  if (dayKind(d) === 'new' && ph.budget.newGrammar > 0) newDays.push(d)
}

// распределяем правила по этим дням пропорционально их «весу»
const totalSlots = grammar.rules.reduce((s, r) => s + slotsFor(r), 0)
const dayToRule = new Map()   // день → id правила (основное на этот день)
{
  let cursor = 0
  const perSlot = newDays.length / totalSlots
  for (const id of order) {
    const slots = slotsFor(ruleById.get(id))
    const take = Math.max(1, Math.round(slots * perSlot))
    for (let i = 0; i < take && cursor < newDays.length; i++, cursor++) {
      dayToRule.set(newDays[cursor], id)
    }
  }
  // хвост (если округления не добрали) — повторяем последние правила
  const last = order[order.length - 1]
  while (cursor < newDays.length) dayToRule.set(newDays[cursor++], last)
}

// ─────────────────────────────────────────────────────────────────────
// Сборка
// ─────────────────────────────────────────────────────────────────────
const compsByModule = {}
for (const c of comps.competencies) (compsByModule[c.moduleId] ??= []).push(c)

/** Экзаменационный модуль дня: ротация, но аудирование и чтение чаще —
 *  у них меньше поддержки от грамматики. */
const EXAM_ROTATION = ['reading', 'grammar', 'listening', 'writing', 'reading', 'speaking', 'listening']

function examFocus(day) {
  return EXAM_ROTATION[(day - 1) % EXAM_ROTATION.length]
}

function pickCompetency(moduleId, day) {
  const list = (compsByModule[moduleId] ?? []).filter((c) => !c.crossCutting)
  if (!list.length) return null
  return list[day % list.length]
}

const introduced = []        // id правил в порядке появления
const days = []

for (let d = 1; d <= PARAMS.totalDays; d++) {
  const ph = phaseOf(d)
  const kind = dayKind(d)
  const week = Math.ceil(d / PARAMS.daysPerWeek)
  const theme = PARAMS.themes[(week - 1) % PARAMS.themes.length]
  const focus = examFocus(d)
  const comp = pickCompetency(focus, d)

  const newRuleId = kind === 'new' ? dayToRule.get(d) ?? null : null
  const isFirstDayOfRule = newRuleId && !introduced.includes(newRuleId)
  if (isFirstDayOfRule) introduced.push(newRuleId)
  const rule = newRuleId ? ruleById.get(newRuleId) : null

  // повторение: последние введённые правила + одно старое «на длинную память»
  const reviewRuleIds = introduced.slice(-3, -1)
  if (introduced.length > 8) reviewRuleIds.push(introduced[d % (introduced.length - 4)])

  let budget, topic, outcome, exerciseKinds, newWords

  if (kind === 'diagnostic') {
    budget = { review: 0, newGrammar: 0, practice: 0, exam: 840, analysis: 60 }
    topic = 'Входная диагностика'
    outcome = 'Определён входной трек: A0, A2 или B1−. Программа подстроена под результат.'
    exerciseKinds = ['placement-test']
    newWords = 0
  } else if (kind === 'final') {
    budget = { review: 0, newGrammar: 0, practice: 0, exam: 780, analysis: 120 }
    topic = 'Итоговая оценка готовности'
    outcome = 'Вердикт по каждому из 5 модулей: готов / не готов. Критерий — ≥65% дважды подряд.'
    exerciseKinds = ['full-mock']
    newWords = 0
  } else if (kind === 'checkpoint') {
    budget = { review: 0, newGrammar: 0, practice: 0, exam: 840, analysis: 60 }
    topic = `Контрольный срез · неделя ${week}`
    outcome = 'Обновлён прогноз по всем пяти модулям. Слабейший получает приоритет в следующем цикле.'
    exerciseKinds = ['mini-mock-all-modules']
    newWords = 0
  } else if (kind === 'weekly-check') {
    budget = { review: 0, newGrammar: 0, practice: 180, exam: 540, analysis: 180 }
    topic = `Недельный срез: ${theme.ru}`
    outcome = 'Проверено усвоение правил и лексики недели. Ошибки поставлены в очередь на пересдачу.'
    exerciseKinds = ['mixed-review', 'exam-format']
    newWords = 0
  } else if (kind === 'consolidation') {
    budget = { review: 300, newGrammar: 0, practice: 420, exam: 120, analysis: 60 }
    topic = `Закрепление: ${theme.ru}`
    outcome = 'Правила недели отработаны на новом материале, без ввода нового.'
    exerciseKinds = ['drill', 'error-correction', 'translate-to-target']
    newWords = Math.round(ph.newWordsPerDay / 2)
  } else {
    budget = { ...ph.budget }
    topic = rule ? rule.title.ru : `Практика: ${theme.ru}`
    outcome = rule
      ? `Правило «${rule.title.ru}» введено и отработано на теме «${theme.ru}».`
      : 'Закрепление пройденного на новой лексике.'
    exerciseKinds = rule ? rule.exerciseKinds.slice(0, 3) : ['gap-fill', 'translate-to-target']
    newWords = ph.newWordsPerDay
  }

  const sum = Object.values(budget).reduce((a, b) => a + b, 0)

  days.push({
    day: d,
    week,
    phase: ph.id,
    phaseTitle: ph.title,
    kind,
    topic,
    themeId: theme.id,
    themeRu: theme.ru,
    grammarRuleIds: newRuleId ? [newRuleId] : [],
    isNewRule: Boolean(isFirstDayOfRule),
    reviewRuleIds: [...new Set(reviewRuleIds)].filter(Boolean),
    newWordCount: newWords,
    exerciseKinds,
    examFocus: focus,
    competencyIds: comp ? [comp.id] : [],
    timeBudgetSec: budget,
    totalSec: sum,
    expectedOutcome: outcome,
    interferenceRisk: rule?.interferenceRu ?? null,
  })
}

// ─────────────────────────────────────────────────────────────────────
// Проверки
// ─────────────────────────────────────────────────────────────────────
const errors = []
for (const d of days) {
  if (d.totalSec > PARAMS.dailyBudgetSec)
    errors.push(`День ${d.day}: бюджет ${d.totalSec}с > ${PARAMS.dailyBudgetSec}с`)
  if (!d.topic) errors.push(`День ${d.day}: нет темы`)
  if (!d.expectedOutcome) errors.push(`День ${d.day}: нет ожидаемого результата`)
}
const missed = grammar.rules.filter((r) => !introduced.includes(r.id))
if (missed.length) errors.push(`Правила не попали в программу: ${missed.map((r) => r.id).join(', ')}`)

// порядок не должен нарушать зависимости
for (const r of grammar.rules) {
  const self = introduced.indexOf(r.id)
  for (const p of r.prerequisites ?? []) {
    const pre = introduced.indexOf(p)
    if (pre > self) errors.push(`День-порядок: ${r.id} идёт раньше своего prerequisite ${p}`)
  }
}

const out = {
  $schema: './curriculum.schema.json',
  courseId: 'pl-b1-ru',
  certificationTargetId: 'pl-state-b1-adults',
  version: new Date().toISOString().slice(0, 10),
  generatedBy: 'scripts/build-curriculum.mjs',
  _meta: {
    warning: 'ФАЙЛ СГЕНЕРИРОВАН. Правки вносятся в build-curriculum.mjs или в grammar-rules.json, не сюда.',
  },
  params: PARAMS,
  stats: {
    totalDays: days.length,
    rulesIntroduced: introduced.length,
    totalNewWords: days.reduce((s, d) => s + d.newWordCount, 0),
    byKind: days.reduce((a, d) => ((a[d.kind] = (a[d.kind] ?? 0) + 1), a), {}),
    totalMinutes: Math.round(days.reduce((s, d) => s + d.totalSec, 0) / 60),
  },
  days,
}

writeFileSync(join(CONTENT, 'curriculum.json'), JSON.stringify(out, null, 1) + '\n')

const C = { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', d: '\x1b[2m', x: '\x1b[0m' }
console.log(`\nДней: ${out.stats.totalDays}   правил введено: ${out.stats.rulesIntroduced}/${grammar.rules.length}`)
console.log(`Новых слов всего: ${out.stats.totalNewWords}`)
console.log(`Суммарное время: ${out.stats.totalMinutes} мин = ${(out.stats.totalMinutes / 60).toFixed(1)} ч`)
console.log(`\n${C.d}Типы дней:${C.x}`)
for (const [k, n] of Object.entries(out.stats.byKind)) console.log(`  ${k.padEnd(16)} ${n}`)
console.log(`\n${C.d}Фазы:${C.x}`)
for (const p of PARAMS.phases) {
  const inPhase = days.filter((d) => d.phase === p.id)
  const rules = new Set(inPhase.flatMap((d) => d.grammarRuleIds)).size
  console.log(`  ${p.id}. ${p.title.padEnd(32)} дни ${p.from}–${p.to}  правил ${rules}`)
}
if (errors.length) {
  console.log(`\n${C.r}ОШИБКИ (${errors.length}):${C.x}`)
  errors.slice(0, 20).forEach((e) => console.log(`  ✗ ${e}`))
  process.exit(1)
}
console.log(`\n${C.g}✓ curriculum.json собран, проверки пройдены.${C.x}\n`)
