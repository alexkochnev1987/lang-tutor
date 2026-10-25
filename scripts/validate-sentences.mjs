#!/usr/bin/env node
/**
 * Validates content/pl-b1-ru/grammar-sentences.json:
 * rule ids resolve, each gap has exactly one `___`, exactly 3 distractors
 * disjoint from answers, and every answer of a lemma known to
 * morphology.json is a real SGJP form of that lemma. Prints coverage.
 *
 *   node scripts/validate-sentences.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'content/pl-b1-ru')

const rules = JSON.parse(readFileSync(join(dir, 'grammar-rules.json'), 'utf8')).rules
const ruleIds = new Set(rules.map((r) => r.id))
const paradigms = JSON.parse(readFileSync(join(dir, 'morphology.json'), 'utf8')).paradigms

let pack
try {
  pack = JSON.parse(readFileSync(join(dir, 'grammar-sentences.json'), 'utf8'))
} catch {
  console.error('✗ content/pl-b1-ru/grammar-sentences.json не читается')
  process.exit(1)
}

const errors = []
const warnings = []
const lower = (s) => String(s).toLowerCase()

for (const [ruleId, entry] of Object.entries(pack.rules ?? {})) {
  if (!ruleIds.has(ruleId)) errors.push(`${ruleId}: правила нет в grammar-rules.json`)

  const gaps = entry.gaps ?? []
  if (gaps.length < 10) warnings.push(`${ruleId}: предложений ${gaps.length}, ожидалось 10`)

  gaps.forEach((g, i) => {
    const at = `${ruleId}.gaps[${i}]`
    const holes = (String(g.pl ?? '').match(/___/g) ?? []).length
    if (holes !== 1) errors.push(`${at}: пропусков ${holes}, должен быть ровно один`)
    if (!Array.isArray(g.answers) || !g.answers.length || g.answers.some((a) => !a?.trim())) {
      errors.push(`${at}: пустые answers`)
      return
    }
    const d = g.distractors ?? []
    if (d.length !== 3) errors.push(`${at}: дистракторов ${d.length}, должно быть 3`)
    if (new Set(d.map(lower)).size !== d.length) errors.push(`${at}: дубли в дистракторах`)
    const answerSet = new Set(g.answers.map(lower))
    for (const x of d) {
      if (answerSet.has(lower(x))) errors.push(`${at}: дистрактор «${x}» совпадает с ответом`)
    }
    if (!g.ru) warnings.push(`${at}: нет русского перевода`)

    if (g.lemma && paradigms[g.lemma]) {
      const forms = new Set(Object.values(paradigms[g.lemma]).flat().map(lower))
      // SGJP stores the conditional as praet + agglutinant: kupił|by|m.
      // Accept a form if stripping the by-ending leaves a known praet form.
      const isForm = (a) => forms.has(a)
        || (/(by|bym|byś|byśmy|byście)$/.test(a)
          && forms.has(a.replace(/(by|bym|byś|byśmy|byście)$/, '')))
      for (const a of g.answers) {
        if (!isForm(lower(a))) {
          errors.push(`${at}: «${a}» не является формой леммы «${g.lemma}» по SGJP`)
        }
      }
    }
  })

  ;(entry.responses ?? []).forEach((r, i) => {
    const at = `${ruleId}.responses[${i}]`
    if (!r.question?.trim()) errors.push(`${at}: пустой вопрос`)
    if (!Array.isArray(r.answers) || !r.answers.length || r.answers.some((a) => !a?.trim())) {
      errors.push(`${at}: пустые answers`)
    }
  })
}

const covered = new Set(Object.keys(pack.rules ?? {}))
const uncovered = [...ruleIds].filter((id) => !covered.has(id))
if (uncovered.length) {
  warnings.push(`без предложений ${uncovered.length} правил: ${uncovered.join(', ')}`)
}

for (const w of warnings) console.warn(`⚠ ${w}`)
for (const e of errors) console.error(`✗ ${e}`)

const nGaps = Object.values(pack.rules ?? {}).reduce((n, r) => n + (r.gaps?.length ?? 0), 0)
const nResp = Object.values(pack.rules ?? {}).reduce((n, r) => n + (r.responses?.length ?? 0), 0)
console.log(`Правил с предложениями: ${covered.size}/${ruleIds.size}, пропусков: ${nGaps}, ответов-предложений: ${nResp}`)
if (errors.length) {
  console.error(`✗ Ошибок: ${errors.length}`)
  process.exit(1)
}
console.log('✓ Пакет предложений валиден')
