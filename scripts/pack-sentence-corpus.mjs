import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CHUNK_SIZE = 20
const textKey = (text) => text.normalize('NFC').toLocaleLowerCase('pl').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const CASE_RULES = {
  nom: 'c-nom', acc: 'c-acc', gen: 'c-gen', dat: 'c-dat',
  loc: 'c-loc', inst: 'c-instr', voc: 'c-voc',
}

function addCaseHits(nodes, hits) {
  const expanded = { ...hits }
  for (const [index, node] of nodes.entries()) {
    const tag = node[3]
    const [partOfSpeech, number, grammaticalCase] = tag?.split(':') ?? []
    if (partOfSpeech !== 'subst' || !CASE_RULES[grammaticalCase]) continue
    const rule = grammaticalCase === 'gen' && number === 'pl' ? 'c-gen-pl' : CASE_RULES[grammaticalCase]
    expanded[`pl.gram.${rule}`] ??= index
  }
  return expanded
}

function areRelatedTargets(nodes, token, target, firstRule, secondRule) {
  if (token === target) return false
  if (nodes[token][1] === target || nodes[target][1] === token) return true
  // The object and an adverb of manner can train two rules on the same action.
  return firstRule === 'pl.gram.c-acc' && secondRule === 'pl.gram.k-adverb' &&
    nodes[token][2] === 'obj' && nodes[target][2] === 'advmod' &&
    nodes[token][1] !== null && nodes[token][1] === nodes[target][1]
}

export function packSentenceCorpus(source, destination) {
  const input = readFileSync(join(source, 'sentence-corpus.json'))
  const { sentences: authored } = JSON.parse(input)
  const sentences = authored.map((sentence) => ({ ...sentence, hits: addCaseHits(sentence.nodes, sentence.hits) }))
  const { rules } = JSON.parse(readFileSync(join(source, 'grammar-rules.json'), 'utf8'))
  const ruleIds = new Set(rules.map(({ id }) => id))
  const legacy = JSON.parse(readFileSync(join(source, 'grammar-sentences.json'), 'utf8')).rules
  const legacyTexts = new Set(Object.values(legacy).flatMap(({ gaps }) =>
    gaps.flatMap(({ pl, answers }) => answers.map((answer) => textKey(pl.replace('___', answer)))),
  ))
  const texts = new Set()
  const ids = new Set()
  const indexedRules = {}
  const pairs = {}
  const version = createHash('sha256').update(JSON.stringify(sentences)).digest('hex').slice(0, 12)
  const dir = join(destination, 'sentence-corpus')
  const files = []

  for (const [i, item] of sentences.entries()) {
    const { id, pl, ru, nodes, hits } = item
    const words = [...pl.matchAll(/\p{L}+/gu)]
    const uniqueText = textKey(pl)
    if (!ru.trim() || !uniqueText || legacyTexts.has(uniqueText) || texts.has(uniqueText) || ids.has(id) || nodes.length !== words.length ||
        nodes.filter(([, head]) => head === null).length !== 1) {
      throw new Error(`Invalid or duplicate corpus sentence: ${id}`)
    }
    texts.add(uniqueText)
    ids.add(id)
    for (const [start, [lemma, , relation]] of nodes.entries()) {
      const seen = new Set()
      let slot = start
      if (!lemma || !relation) throw new Error(`Invalid node in ${id}: ${start}`)
      while (slot !== null) {
        if (!nodes[slot] || seen.has(slot)) throw new Error(`Invalid dependency in ${id}: ${start}`)
        seen.add(slot)
        slot = nodes[slot][1]
      }
    }

    const chunk = Math.floor(i / CHUNK_SIZE)
    const rulesForSentence = Object.keys(hits).sort()
    for (const rule of rulesForSentence) {
      const token = hits[rule]
      if (!ruleIds.has(rule) || !Number.isInteger(token) || !nodes[token]) {
        throw new Error(`Invalid rule target in ${id}: ${rule}`)
      }
      ;(indexedRules[rule] ??= []).push(i)
      for (const other of rulesForSentence.filter((candidate) => candidate > rule)) {
        const target = hits[other]
        if (nodes[target] && areRelatedTargets(nodes, token, target, rule, other)) {
          ;(pairs[`${rule}|${other}`] ??= []).push(i)
        }
      }
    }
    files[chunk] ??= []
    files[chunk].push(item)
  }

  mkdirSync(dir, { recursive: true })
  files.forEach((items, chunk) => writeFileSync(join(dir, `${version}-${chunk}.json`), JSON.stringify(items)))
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ version, chunkSize: CHUNK_SIZE, rules: indexedRules, pairs }))
  const coverage = Object.fromEntries([...ruleIds].map((rule) => [rule, indexedRules[rule]?.length ?? 0]))
  const counts = Object.values(coverage)
  const remaining = counts.reduce((sum, count) => sum + Math.max(0, 100 - count), 0)
  const pairCounts = Object.values(pairs).map((examples) => examples.length)
  const pairTarget = 40
  const remainingPairHits = pairCounts.reduce((sum, count) => sum + Math.max(0, pairTarget - count), 0)
  console.log(`  сочетания: ${pairCounts.filter((count) => count >= pairTarget).length}/${pairCounts.length} пар с ≥${pairTarget}, ещё нужно ${remainingPairHits} привязок`)
  console.log(`  корпус: ${sentences.length} предложений, ${files.length} частей, ${counts.filter((count) => count >= 100).length}/${counts.length} правил с ≥100, ещё нужно ${remaining} привязок`)
}
