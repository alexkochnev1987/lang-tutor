import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeReadingPack, packReadingContent } from './pack-reading.mjs'

const text = day => ({
  id: 'pl-b1.reading.day-' + day, day, level: 'A2', title: 'Example ' + day,
  text: 'To jest tekst.',
  questions: ['main-idea', 'detail', 'cause', 'inference', 'vocabulary'].map(id =>
    ({ id, skill: id, question: id, options: ['a', 'b', 'c'], answer: 'a', explanation: 'because', evidence: 'To jest tekst.' })),
  authorModel: 'internal',
})

test('catalog contains only metadata; runtime files strip internal data and keep all questions', () => {
  const pack = makeReadingPack({ daily: [text(55), text(54)], status: 'preview' })
  assert.deepEqual(pack.index.entries.map(x => x.file), ['day-054.json', 'day-055.json'])
  assert.equal(pack.index.entries[0].status, 'preview')
  assert.equal(pack.index.entries[0].text, undefined)
  assert.equal(pack.files.get('day-054.json').questions.length, 5)
  assert.equal(pack.files.get('day-054.json').questions[0].evidence, undefined)
  assert.equal(pack.files.get('day-054.json').authorModel, undefined)
  assert.throws(() => makeReadingPack({ daily: [text(54), text(54)] }), /duplicate/)
})

test('rejects invalid keys and evidence', () => {
  const t = text(54)
  t.questions[0].answer = 'missing'
  assert.throws(() => makeReadingPack({ daily: [t] }), /invalid options/)
  t.questions[0].answer = 'a'
  t.questions[0].evidence = 'not in text'
  assert.throws(() => makeReadingPack({ daily: [t] }), /evidence/)
})

test('experimental files stay separate and can be removed when disabled', () => {
  const root = mkdtempSync(join(tmpdir(), 'reading-pack-'))
  try {
    const source = join(root, 'source'), target = join(root, 'public'), draftDir = join(root, 'drafts')
    mkdirSync(source); mkdirSync(draftDir)
    writeFileSync(join(source, 'reading.json'), JSON.stringify({ texts: [text(1)] }))
    mkdirSync(join(source, 'reading'))
    writeFileSync(join(source, 'reading/day-054.json'), JSON.stringify(text(54)))
    writeFileSync(join(draftDir, 'batch.json'), JSON.stringify({ version: 1, status: 'draft', texts: [text(55)] }))
    assert.deepEqual(packReadingContent(source, target, { preview: true, draftDir }), { live: 2, preview: 1 })
    const index = JSON.parse(readFileSync(join(target, 'reading/index.json'), 'utf8'))
    assert.deepEqual(index.entries.map(e => e.status), ['legacy', 'approved'])
    assert.deepEqual(readdirSync(join(target, 'reading')).sort(), ['day-054.json', 'index.json', 'legacy-001.json'])
    assert.equal(existsSync(join(target, 'reading-preview/day-055.json')), true)
    assert.deepEqual(packReadingContent(source, target, { draftDir }), { live: 2, preview: 0 })
    assert.equal(existsSync(join(target, 'reading-preview')), false)
    assert.equal(existsSync(join(target, 'reading/day-055.json')), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('real draft corpus is structurally valid and builds one file per day', () => {
  const draftDir = new URL('./reading-drafts/', import.meta.url)
  const daily = readdirSync(draftDir).filter(n => n.endsWith('.json')).flatMap(n =>
    JSON.parse(readFileSync(new URL(n, draftDir), 'utf8')).texts)
  const preview = makeReadingPack({ daily, status: 'preview' })
  assert.ok(daily.length >= 67)
  assert.equal(preview.files.size, daily.length)
  assert.equal(preview.files.get('day-054.json').questions.length, 5)
})
