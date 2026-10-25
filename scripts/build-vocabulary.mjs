#!/usr/bin/env node
/**
 * Сборка словаря и его раскладка по дням программы.
 *
 *   node scripts/build-vocabulary.mjs
 *
 * Источники — scripts/data/vocab-*.mjs. Здесь они сводятся в один формат,
 * размечаются и раскладываются по 182 дням согласно curriculum.json.
 *
 * Заодно считается главное число проекта: сколько СТОИТ выученный словарь
 * в секундах и помещается ли он в бюджет. См. CURRICULUM.md §6.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { FALSE_FRIENDS } from './data/vocab-false-friends.mjs'
import { FUNCTION_WORDS } from './data/vocab-function.mjs'
import { VERBS } from './data/vocab-verbs.mjs'
import { THEMATIC } from './data/vocab-themes.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(root, 'content/pl-b1-ru')
const curriculum = JSON.parse(readFileSync(join(CONTENT, 'curriculum.json'), 'utf8'))

/**
 * Стоимость слова в секундах за весь срок обучения.
 * Прозрачное требует 2–3 повторений (проверить, что не ложный друг),
 * непрозрачное — 8. Ложный друг дороже всех: его нужно не просто выучить,
 * а перебить уже существующую неверную ассоциацию.
 */
const COST = {
  intro: 20,
  recogSec: 6,
  prodSec: 13,
  reps: { transparent: 3, partial: 6, opaque: 8, 'false-friend': 10 },
}

const slug = (s) =>
  s.toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => 'acelnoszz'['ąćęłńóśźż'.indexOf(c)])
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const items = new Map() // id → entry, заодно дедуп

function add(entry) {
  const id = `pl.${slug(entry.lemma)}`
  if (items.has(id)) return // дубликат между источниками — первый побеждает
  items.set(id, { id, ...entry })
}

// ── источники ─────────────────────────────────────────────────────────
for (const [lemma, pos, ru, confusedWith, actuallyIs, themeId] of FALSE_FRIENDS) {
  add({
    lemma, pos, translation: ru, transparency: 'false-friend', themeId,
    interference: { confusedWith, actuallyIs },
    priority: 'critical',
  })
}

for (const [lemma, pos, ru, transparency, ruleId] of FUNCTION_WORDS) {
  add({
    lemma, pos, translation: ru, transparency, themeId: null,
    grammarRuleIds: ruleId ? [ruleId] : [],
    priority: 'high', // служебные нужны раньше всего: без них нет предложения
  })
}

for (const [ndk, dk, ru, transparency, government] of VERBS) {
  add({
    lemma: ndk, pos: 'verb', translation: ru, transparency, themeId: null,
    aspectPair: dk ? { imperfective: ndk, perfective: dk } : null,
    government,
    grammarRuleIds: government && /gen|dat|inst/.test(government)
      ? ['pl.gram.v-government'] : [],
    priority: 'high',
  })
}

for (const [themeId, list] of Object.entries(THEMATIC)) {
  for (const [lemma, pos, ru, transparency] of list) {
    add({ lemma, pos, translation: ru, transparency, themeId, priority: 'normal' })
  }
}

const vocab = [...items.values()]

// ── бюджет ────────────────────────────────────────────────────────────
function costOf(v) {
  const reps = COST.reps[v.transparency]
  // производство тренируется только у ядра: служебные, глаголы, ложные друзья
  const needsProduction = v.priority !== 'normal'
  return COST.intro + reps * (COST.recogSec + (needsProduction ? COST.prodSec : 0))
}

const byTransparency = {}
for (const v of vocab) byTransparency[v.transparency] = (byTransparency[v.transparency] ?? 0) + 1

const totalCostSec = vocab.reduce((s, v) => s + costOf(v), 0)

// сколько секунд программа реально отводит на лексику
const vocabBudgetSec = curriculum.days.reduce(
  (s, d) => s + d.timeBudgetSec.review + d.timeBudgetSec.practice * 0.4, 0)

// ── раскладка по дням ─────────────────────────────────────────────────
// порядок: сначала критичное и служебное, потом тематическое по неделям
const PRIORITY_ORDER = { critical: 0, high: 1, normal: 2 }
const queue = [...vocab].sort(
  (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

// тематические слова стараемся ставить в «свою» неделю
const byTheme = {}
for (const v of queue) if (v.themeId) (byTheme[v.themeId] ??= []).push(v)
const generic = queue.filter((v) => !v.themeId)

let gi = 0
const assigned = new Set()
for (const day of curriculum.days) {
  const want = day.newWordCount
  if (!want) { day.lexemeIds = []; continue }
  const picked = []

  // сначала — из темы недели
  const pool = byTheme[day.themeId] ?? []
  for (const v of pool) {
    if (picked.length >= want) break
    if (assigned.has(v.id)) continue
    picked.push(v.id); assigned.add(v.id)
  }
  // добивка служебными и глаголами
  while (picked.length < want && gi < generic.length) {
    const v = generic[gi++]
    if (assigned.has(v.id)) continue
    picked.push(v.id); assigned.add(v.id)
  }
  day.lexemeIds = picked
}

const placed = assigned.size
const unplaced = vocab.length - placed
const slotsTotal = curriculum.days.reduce((s, d) => s + d.newWordCount, 0)
const daysWanting = curriculum.days.filter((d) => d.newWordCount > 0).length
const daysFilled = curriculum.days.filter((d) => d.lexemeIds.length > 0).length

// ── запись ────────────────────────────────────────────────────────────
const out = {
  $schema: './vocabulary.schema.json',
  courseId: 'pl-b1-ru',
  targetLanguageId: 'pl',
  sourceLanguageId: 'ru',
  version: curriculum.version,
  generatedBy: 'scripts/build-vocabulary.mjs',
  _meta: {
    warning: 'ФАЙЛ СГЕНЕРИРОВАН из scripts/data/vocab-*.mjs. Правки — туда.',
    costModel: COST,
  },
  stats: {
    total: vocab.length,
    byTransparency,
    byPriority: vocab.reduce((a, v) => ((a[v.priority] = (a[v.priority] ?? 0) + 1), a), {}),
    totalCostSec,
    totalCostHours: +(totalCostSec / 3600).toFixed(1),
    vocabBudgetSec: Math.round(vocabBudgetSec),
    vocabBudgetHours: +(vocabBudgetSec / 3600).toFixed(1),
    capacityAtThisMix: Math.floor(vocabBudgetSec / (totalCostSec / vocab.length)),
    placedInDays: placed,
    slotsTotal,
    slotsFilled: placed,
    daysWanting,
    daysFilled,
  },
  items: vocab,
}
writeFileSync(join(CONTENT, 'vocabulary.json'), JSON.stringify(out, null, 1) + '\n')
writeFileSync(join(CONTENT, 'curriculum.json'), JSON.stringify(curriculum, null, 1) + '\n')

// ── отчёт ─────────────────────────────────────────────────────────────
const C = { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', d: '\x1b[2m', x: '\x1b[0m' }
const s = out.stats
const pct = (n) => `${Math.round((n / s.total) * 100)}%`

console.log(`\nСловарь: ${C.g}${s.total}${C.x} единиц`)
console.log(`\n${C.d}Прозрачность для русскоязычного:${C.x}`)
for (const [k, n] of Object.entries(s.byTransparency).sort((a, b) => b[1] - a[1]))
  console.log(`  ${k.padEnd(14)} ${String(n).padStart(4)}  ${pct(n).padStart(4)}`)

const transparentShare = (s.byTransparency.transparent ?? 0) / s.total
console.log(`\n${C.d}Проверка гипотезы из CURRICULUM.md §6.3${C.x}`)
console.log(`  предполагалось прозрачных: 40%`)
console.log(`  фактически:                ${Math.round(transparentShare * 100)}%`)
console.log(transparentShare >= 0.4
  ? `  ${C.g}✓ гипотеза подтверждается${C.x}`
  : `  ${C.y}⚠ ниже ожидания — бюджет надо пересчитать${C.x}`)

console.log(`\n${C.d}Бюджет:${C.x}`)
console.log(`  стоимость этого словаря   ${s.totalCostHours} ч`)
console.log(`  программа отводит         ${s.vocabBudgetHours} ч`)
console.log(`  средняя цена слова        ${Math.round(totalCostSec / s.total)} с`)
console.log(`  вместимость при таком миксе ${C.g}${s.capacityAtThisMix}${C.x} слов`)

console.log(`\n${C.d}Раскладка по дням:${C.x}`)
console.log(`  слотов в программе        ${s.slotsTotal}`)
console.log(`  заполнено                 ${C.g}${s.slotsFilled}${C.x}`)
console.log(`  дней со словами           ${s.daysFilled} из ${s.daysWanting}`)
if (s.slotsTotal > s.slotsFilled) {
  console.log(`\n${C.y}⚠ Пустых слотов: ${s.slotsTotal - s.slotsFilled}.${C.x}`)
  console.log(`${C.y}  Ядро словаря собрано, остальное дописывается — VOCABULARY.md §7.${C.x}`)
}
if (unplaced) console.log(`${C.y}  Не размещено слов: ${unplaced}${C.x}`)

if (s.totalCostHours > s.vocabBudgetHours) {
  console.log(`\n${C.y}⚠ Словарь дороже бюджета на ${(s.totalCostHours - s.vocabBudgetHours).toFixed(1)} ч.${C.x}`)
  console.log(`${C.y}  Это нормально для ядра: часть слов осознанно остаётся на узнавании.${C.x}`)
}
console.log(`\n${C.g}✓ vocabulary.json собран, дни обновлены.${C.x}\n`)
