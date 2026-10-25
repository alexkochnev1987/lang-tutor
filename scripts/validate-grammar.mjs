#!/usr/bin/env node
/**
 * Валидатор графа грамматических правил.
 *
 *   node scripts/validate-grammar.mjs
 *
 * Проверяет:
 *   1. уникальность id
 *   2. все prerequisites разрешаются
 *   3. граф ацикличен
 *   4. нет ссылок на самого себя
 *   5. категории известны
 *   6. обязательные поля заполнены
 * И печатает топологический порядок ввода — он же порядок для CURRICULUM.md.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(readFileSync(join(root, 'content/pl-b1-ru/grammar-rules.json'), 'utf8'))
const rules = data.rules
const byId = new Map(rules.map((r) => [r.id, r]))

const errors = []
const warnings = []

// 1. уникальность
const seen = new Set()
for (const r of rules) {
  if (seen.has(r.id)) errors.push(`Дубликат id: ${r.id}`)
  seen.add(r.id)
}

// 2–4. ссылки и самоссылки
for (const r of rules) {
  for (const p of r.prerequisites ?? []) {
    if (p === r.id) errors.push(`${r.id}: ссылается на себя`)
    else if (!byId.has(p)) errors.push(`${r.id}: неизвестный prerequisite «${p}»`)
  }
}

// 5. категории
const cats = new Set(Object.keys(data.categories))
for (const r of rules) {
  if (!cats.has(r.category)) errors.push(`${r.id}: неизвестная категория «${r.category}»`)
}

// 6. обязательные поля
const REQUIRED = ['id', 'category', 'title', 'summary', 'difficulty', 'interferenceRu',
                  'examples', 'examModules', 'exerciseKinds', 'sourceRef']
for (const r of rules) {
  for (const f of REQUIRED) {
    if (r[f] === undefined || r[f] === null) errors.push(`${r.id}: нет поля «${f}»`)
  }
  if (!r.title?.pl || !r.title?.ru) errors.push(`${r.id}: title должен иметь pl и ru`)
  if (Array.isArray(r.examples) && r.examples.length === 0)
    warnings.push(`${r.id}: пустой список примеров`)
  if (r.difficulty < 1 || r.difficulty > 5) errors.push(`${r.id}: difficulty вне 1..5`)
  if (r.interferenceRu < 1 || r.interferenceRu > 5) errors.push(`${r.id}: interferenceRu вне 1..5`)
}

// 3. топологическая сортировка (Кан) — заодно детектирует цикл
const indeg = new Map(rules.map((r) => [r.id, 0]))
const next = new Map(rules.map((r) => [r.id, []]))
for (const r of rules) {
  for (const p of r.prerequisites ?? []) {
    if (!byId.has(p)) continue
    indeg.set(r.id, indeg.get(r.id) + 1)
    next.get(p).push(r.id)
  }
}
// стабильный порядок: при равных условиях — сначала проще, потом по id
const ready = rules.filter((r) => indeg.get(r.id) === 0).map((r) => r.id)
const cmp = (a, b) =>
  (byId.get(a).difficulty - byId.get(b).difficulty) || a.localeCompare(b)
ready.sort(cmp)

const order = []
while (ready.length) {
  const id = ready.shift()
  order.push(id)
  for (const n of next.get(id)) {
    indeg.set(n, indeg.get(n) - 1)
    if (indeg.get(n) === 0) {
      ready.push(n)
      ready.sort(cmp)
    }
  }
}

if (order.length !== rules.length) {
  const stuck = rules.filter((r) => !order.includes(r.id)).map((r) => r.id)
  errors.push(`ЦИКЛ в графе. Не удалось упорядочить: ${stuck.join(', ')}`)
}

// глубина = минимальный «день», раньше которого правило не ввести
const depth = new Map()
for (const id of order) {
  const prereqs = byId.get(id).prerequisites ?? []
  depth.set(id, prereqs.length ? Math.max(...prereqs.map((p) => depth.get(p) ?? 0)) + 1 : 0)
}

// ── вывод ────────────────────────────────────────────────────────────
const C = { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', d: '\x1b[2m', x: '\x1b[0m' }

console.log(`\nПравил: ${rules.length}   категорий: ${cats.size}`)

const byCat = {}
for (const r of rules) (byCat[r.category] ??= []).push(r)
for (const [c, list] of Object.entries(byCat)) {
  console.log(`  ${C.d}${c.padEnd(12)}${C.x} ${list.length}`)
}

// группируем по глубине: уровень = сколько правил минимум должно идти раньше
const byDepth = order
  .slice()
  .sort((a, b) =>
    (depth.get(a) - depth.get(b)) ||
    (byId.get(a).difficulty - byId.get(b).difficulty) ||
    a.localeCompare(b))

console.log(`\n${C.d}Порядок ввода. Уровень = глубина в графе зависимостей;`)
console.log(`внутри уровня правила независимы и могут идти в любом порядке.${C.x}`)
let lvl = -1
let n = 0
for (const id of byDepth) {
  const d = depth.get(id)
  if (d !== lvl) { lvl = d; console.log(`\n  ${C.d}── уровень ${d} ──${C.x}`) }
  const r = byId.get(id)
  const risk = r.interferenceRu >= 4 ? `${C.y}RU-риск ${r.interferenceRu}${C.x}` : ''
  console.log(`  ${String(++n).padStart(2)}. ${id.padEnd(36)} ${C.d}сл.${r.difficulty}${C.x} ${risk}`)
}
console.log(`\n  ${C.d}Критический путь: ${lvl} уровней. Это минимальное число`)
console.log(`  последовательных шагов — раньше этого программу не сжать.${C.x}`)

const hot = rules.filter((r) => r.interferenceRu >= 4).sort((a, b) => b.interferenceRu - a.interferenceRu)
console.log(`\n${C.y}Высокий риск интерференции из русского (${hot.length} правил):${C.x}`)
for (const r of hot) console.log(`  ${r.interferenceRu}  ${r.id.padEnd(36)} ${r.title.ru}`)

const mods = {}
for (const r of rules) for (const m of r.examModules) mods[m] = (mods[m] ?? 0) + 1
console.log(`\n${C.d}Покрытие модулей экзамена:${C.x}`)
for (const [m, n] of Object.entries(mods).sort((a, b) => b[1] - a[1]))
  console.log(`  ${m.padEnd(10)} ${n} правил`)

if (warnings.length) {
  console.log(`\n${C.y}Предупреждения (${warnings.length}):${C.x}`)
  warnings.forEach((w) => console.log(`  ! ${w}`))
}
if (errors.length) {
  console.log(`\n${C.r}ОШИБКИ (${errors.length}):${C.x}`)
  errors.forEach((e) => console.log(`  ✗ ${e}`))
  process.exit(1)
}
console.log(`\n${C.g}✓ Граф валиден, циклов нет.${C.x}\n`)
