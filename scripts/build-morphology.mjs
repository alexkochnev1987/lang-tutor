#!/usr/bin/env node
/**
 * Извлекает парадигмы наших лемм из словаря SGJP.
 *
 *   node scripts/build-morphology.mjs <путь-к-sgjp-*.tab.gz>
 *
 * ЗАЧЕМ. Morfeusz — нативная библиотека, в браузере не запускается, а
 * бэкенда у нас нет. Но SGJP публикует тот же словарь простым текстом:
 * форма ⇥ лемма ⇥ тег. Берём его один раз на этапе сборки, вырезаем
 * нужные ~330 лемм и кладём готовые таблицы в контент. Приложению
 * остаётся просмотр таблицы — никакой морфологии в рантайме.
 *
 * ГДЕ ВЗЯТЬ (41 МБ, в репозиторий не кладём):
 *   https://download.sgjp.pl/morfeusz/  → последняя дата → sgjp-*.tab.gz
 *
 * ЛИЦЕНЗИЯ: 2-clause BSD. Требуется сохранить копирайт — он переносится
 * в поле _license выходного файла и должен быть показан в «О приложении».
 */
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(root, 'content/pl-b1-ru')

const dumpPath = process.argv[2]
if (!dumpPath) {
  console.error('Укажите путь к sgjp-*.tab.gz — см. комментарий в начале файла')
  process.exit(1)
}

const vocab = JSON.parse(readFileSync(join(CONTENT, 'vocabulary.json'), 'utf8'))

/** Леммы, которые нас интересуют. Возвратные ищем без «się». */
const wanted = new Map()
for (const it of vocab.items) {
  const base = it.lemma.replace(/\s+się$/, '')
  if (!/^[\p{L}]+$/u.test(base)) continue // словосочетания пропускаем
  wanted.set(base, it)
  if (it.aspectPair?.perfective) {
    const pf = it.aspectPair.perfective.replace(/\s+się$/, '')
    if (/^[\p{L}]+$/u.test(pf)) wanted.set(pf, it)
  }
}

/**
 * Какие формы реально нужны для упражнений уровня B1.
 * Весь словарь тащить незачем: формы вроде depr или agl на B1 не проверяют.
 */
const KEEP_NOUN = /^subst:(sg|pl):(nom|gen|dat|acc|inst|loc|voc)/
const KEEP_ADJ = /^adj:(sg|pl):(nom|gen|dat|acc|inst|loc|voc)/
const KEEP_VERB = /^(fin|praet|impt|inf|ger|pcon):/
const KEEP = [KEEP_NOUN, KEEP_ADJ, KEEP_VERB]

const paradigms = new Map() // лемма → { tag → [формы] }
let scanned = 0, kept = 0

const rl = createInterface({
  input: createReadStream(dumpPath).pipe(createGunzip()),
  crlfDelay: Infinity,
})

const copyright = []
for await (const line of rl) {
  if (!line.includes('\t')) {           // шапка: копирайт и текст лицензии
    if (copyright.length < 25 && line.trim()) copyright.push(line.trim())
    continue
  }
  scanned++
  const [form, rawLemma, tag] = line.split('\t')
  if (!form || !rawLemma || !tag) continue
  // SGJP различает омонимы суффиксом: czas:S — существительное,
  // czas:V — предикатив, miasto:P — предлог. Нам нужна база.
  const lemma = rawLemma.split(':')[0]
  if (!wanted.has(lemma)) continue
  if (!KEEP.some((re) => re.test(tag))) continue

  // отбрасываем устаревшие и редкие варианты — они путают учащегося
  const qualifiers = line.split('\t')[4] ?? ''
  if (/daw\.|przest\.|rzad\.|pot\./.test(qualifiers)) continue

  const byTag = paradigms.get(lemma) ?? new Map()
  // тег вида pl:nom.acc.voc раскрываем в отдельные падежи
  for (const t of expandTag(tag)) {
    const arr = byTag.get(t) ?? []
    if (!arr.includes(form)) arr.push(form)
    byTag.set(t, arr)
  }
  paradigms.set(lemma, byTag)
  kept++
}

/** `subst:pl:nom.acc.voc:f` → три тега по одному падежу. */
function expandTag(tag) {
  const parts = tag.split(':')
  const idx = parts.findIndex((p) => p.includes('.') && /nom|gen|dat|acc|inst|loc|voc/.test(p))
  if (idx === -1) return [tag]
  return parts[idx].split('.').map((c) => {
    const copy = [...parts]
    copy[idx] = c
    return copy.join(':')
  })
}

const out = {
  $schema: './morphology.schema.json',
  languageId: 'pl',
  version: vocab.version,
  generatedBy: 'scripts/build-morphology.mjs',
  _source: {
    name: 'Słownik gramatyczny języka polskiego (SGJP) / Morfeusz 2',
    url: 'https://download.sgjp.pl/morfeusz/',
    license: '2-clause BSD',
    note: 'Копирайт обязан быть показан в разделе «О приложении».',
  },
  _license: copyright.slice(0, 12),
  stats: {
    lemmasRequested: wanted.size,
    lemmasFound: paradigms.size,
    formsKept: kept,
    linesScanned: scanned,
  },
  paradigms: Object.fromEntries(
    [...paradigms].map(([lemma, byTag]) => [lemma, Object.fromEntries(byTag)])),
}

writeFileSync(join(CONTENT, 'morphology.json'), JSON.stringify(out, null, 0) + '\n')

const C = { y: '\x1b[33m', g: '\x1b[32m', d: '\x1b[2m', x: '\x1b[0m' }
console.log(`\n${C.d}Просмотрено строк: ${scanned.toLocaleString('ru')}${C.x}`)
console.log(`Лемм запрошено:  ${wanted.size}`)
console.log(`Лемм найдено:    ${C.g}${paradigms.size}${C.x}`)
console.log(`Форм сохранено:  ${kept}`)

const missing = [...wanted.keys()].filter((l) => !paradigms.has(l))
if (missing.length) {
  console.log(`\n${C.y}Не найдено в SGJP (${missing.length}):${C.x}`)
  console.log('  ' + missing.slice(0, 20).join(', ') + (missing.length > 20 ? ' …' : ''))
}
const size = Math.round(JSON.stringify(out).length / 1024)
console.log(`\n${C.g}✓ morphology.json собран, ${size} КБ${C.x}\n`)
