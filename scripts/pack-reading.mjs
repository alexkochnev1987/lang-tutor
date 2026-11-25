import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SKILLS = ['main-idea', 'detail', 'cause', 'inference', 'vocabulary']
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const nonempty = value => typeof value === 'string' && value.trim().length > 0
const normalized = value => value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl')
const distinct = values => new Set(values).size === values.length
const dayName = day => 'day-' + String(day).padStart(3, '0') + '.json'
const assert = (ok, message) => { if (!ok) throw new Error('reading: ' + message) }

export function readingPreviewEnabled(env = process.env) {
  return env.VERCEL_ENV !== 'production' &&
    (env.VERCEL_ENV === 'preview' || (!env.VERCEL && env.READING_PREVIEW === '1'))
}

function validate(text, status) {
  assert(text && [text.id, text.title, text.text].every(nonempty), 'missing text fields')
  assert(Array.isArray(text.questions) && text.questions.length > 0, text.id + ': missing questions')
  if (status !== 'legacy') {
    assert(Number.isSafeInteger(text.day) && text.day >= 1, text.id + ': invalid day')
    assert(['A1', 'A2', 'B1'].includes(text.level), text.id + ': invalid level')
    assert(text.questions.length === SKILLS.length &&
      SKILLS.every(skill => text.questions.some(q => q.id === skill && q.skill === skill)), text.id + ': invalid skills')
  }
  assert(distinct(text.questions.map(q => q.id)), text.id + ': duplicate question id')
  for (const q of text.questions) {
    assert([q.id, q.question, q.answer].every(nonempty), text.id + ': invalid question')
    assert(Array.isArray(q.options) && q.options.length >= 2 && q.options.every(nonempty) &&
      distinct(q.options.map(normalized)) && q.options.filter(option => option === q.answer).length === 1,
      text.id + ': invalid options ' + q.id)
    if (status !== 'legacy') {
      assert(q.options.length === 3 && nonempty(q.explanation) && nonempty(q.evidence) && text.text.includes(q.evidence),
        text.id + ': invalid answer evidence ' + q.id)
    }
  }
}

export function makeReadingPack({ legacy = [], daily = [], status = 'approved' } = {}) {
  assert(status === 'approved' || status === 'preview', 'invalid publication status')
  assert(status !== 'preview' || legacy.length === 0, 'preview cannot contain legacy texts')
  const entries = []
  const files = new Map()
  function add(text, file, kind) {
    validate(text, kind)
    assert(!files.has(file), 'duplicate file ' + file)
    const { id, title, questions } = text
    const entry = { id, title, file, status: kind, ...(kind === 'legacy' ? {} : { day: text.day, level: text.level }) }
    entries.push(entry)
    // Runtime fields only. Do not publish author evidence, model details or reviews.
    files.set(file, {
      id, title, text: text.text,
      questions: questions.map(({ id, question, options, answer, explanation, difficulty }) =>
        ({ id, question, options, answer, explanation, difficulty })),
    })
  }
  legacy.forEach((text, i) => add(text, 'legacy-' + String(i + 1).padStart(3, '0') + '.json', 'legacy'))
  for (const text of [...daily].sort((a, b) => a.day - b.day)) add(text, dayName(text.day), status)
  assert(distinct(entries.map(e => e.id)), 'duplicate passage id')
  return { index: { version: 1, entries }, files }
}

function readApproved(source) {
  const folder = join(source, 'reading')
  if (!existsSync(folder)) return []
  return readdirSync(folder).filter(name => /^day-\d{3,}\.json$/.test(name)).sort().map(name => {
    const text = read(join(folder, name))
    assert(name === dayName(text.day), 'day and filename mismatch: ' + name)
    return text
  })
}

function readPreview(draftDir) {
  if (!existsSync(draftDir)) return []
  return readdirSync(draftDir).filter(name => name.endsWith('.json')).sort().flatMap(name => {
    const pack = read(join(draftDir, name))
    assert(pack.version === 1 && pack.status === 'draft' && Array.isArray(pack.texts), 'invalid draft ' + name)
    return pack.texts
  })
}

function writePack(target, pack) {
  mkdirSync(target, { recursive: true })
  for (const [name, text] of pack.files) writeFileSync(join(target, name), JSON.stringify(text) + '\n')
  writeFileSync(join(target, 'index.json'), JSON.stringify(pack.index) + '\n')
}

export function packReadingContent(source, target, { preview = false, draftDir } = {}) {
  const legacyPath = join(source, 'reading.json')
  const legacy = existsSync(legacyPath) ? read(legacyPath).texts : []
  const live = makeReadingPack({ legacy, daily: readApproved(source) })
  const experimental = preview && draftDir ? makeReadingPack({ daily: readPreview(draftDir), status: 'preview' }) : null
  // Generated output only. Always remove stale experimental assets on a production build.
  const liveDir = join(target, 'reading')
  const previewDir = join(target, 'reading-preview')
  rmSync(liveDir, { recursive: true, force: true })
  rmSync(previewDir, { recursive: true, force: true })
  writePack(liveDir, live)
  if (experimental) writePack(previewDir, experimental)
  return { live: live.index.entries.length, preview: experimental?.index.entries.length ?? 0 }
}
