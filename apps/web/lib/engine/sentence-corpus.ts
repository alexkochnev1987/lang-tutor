import { shuffle, type Exercise } from '@polski/engine'
import { sentenceDrillVariants } from './exercises'
import type { Paradigm, SentenceGapItem, SentencePack } from '../content/curriculum'

export type CorpusSentence = SentenceGapItem & { id: string; ruleId: string; text: string }
export type SentenceCorpus = Record<string, CorpusSentence[]>

export function buildSentenceCorpus(pack: SentencePack): SentenceCorpus {
  return Object.fromEntries(Object.entries(pack).map(([ruleId, { gaps }]) => [
    ruleId,
    gaps.flatMap((gap, index) => gap.answers[0] ? [{
      ...gap,
      id: `${ruleId}.${index}`,
      ruleId,
      text: gap.pl.replace('___', gap.answers[0]),
    }] : []),
  ]))
}

export function singleGapExercises(
  entries: CorpusSentence[],
  morphology: Record<string, Paradigm>,
  mode: 'choice' | 'typed',
  seed: number,
  limit: number,
): Exercise[] {
  return shuffle(entries, seed).flatMap((entry) => {
    const gap = {
      id: entry.id,
      sentence: entry.pl,
      baseForm: entry.lemma,
      answers: entry.answers,
      distractors: entry.distractors,
      translation: entry.ru,
    }
    const exercise = sentenceDrillVariants(gap, entry.ruleId, morphology, seed)[mode]
    return exercise ? [exercise] : []
  }).slice(0, limit)
}

interface TokenForm {
  lemma: string
  tag: string
}

interface Token {
  text: string
  start: number
  end: number
}

export interface LinkedGap {
  token: number
  head?: number
  ruleId: string
  lemma: string
  accepted: string[]
  hint: string
}

export interface LinkedSentence {
  id: string
  translation: string
  parts: [string, string, string]
  gaps: [LinkedGap, LinkedGap]
}

const GOVERNMENT_RULES = ['pl.gram.v-government', 'pl.gram.c-gen-verbs']
const PRESENT_CONJUGATIONS = [
  [/ę$/, /esz$/, 'pl.gram.v-present-1'],
  [/ę$/, /[iy]sz$/, 'pl.gram.v-present-2'],
  [/am$/, /asz$/, 'pl.gram.v-present-3'],
  [/em$/, /esz$/, 'pl.gram.v-present-4'],
] as const
const CASES: Record<string, string> = {
  gen: 'родительный', dat: 'дательный', acc: 'винительный',
  inst: 'творительный', loc: 'местный',
}
const PERSONS: Record<string, string> = { pri: '1-е', sec: '2-е', ter: '3-е' }
const normalize = (text: string) => text.normalize('NFC').toLocaleLowerCase('pl')

function indexFiniteForms(morphology: Record<string, Paradigm>) {
  const forms = new Map<string, TokenForm[]>()
  for (const [lemma, paradigm] of Object.entries(morphology)) {
    for (const [tag, variants] of Object.entries(paradigm)) {
      if (!tag.startsWith('fin:')) continue
      for (const variant of variants) {
        const key = normalize(variant)
        const analyses = forms.get(key) ?? []
        analyses.push({ lemma, tag })
        forms.set(key, analyses)
      }
    }
  }
  return forms
}

function conjugation(paradigm: Paradigm) {
  const first = paradigm['fin:sg:pri:imperf'] ?? []
  const second = paradigm['fin:sg:sec:imperf'] ?? []
  return PRESENT_CONJUGATIONS.find(([ending1, ending2]) =>
    first.some((form) => ending1.test(form)) && second.some((form) => ending2.test(form)),
  )?.[2]
}

export function buildLinkedSentences(
  corpus: SentenceCorpus,
  morphology: Record<string, Paradigm>,
): LinkedSentence[] {
  const finiteForms = indexFiniteForms(morphology)
  const cards: LinkedSentence[] = []
  const seen = new Set<string>()
  for (const ruleId of GOVERNMENT_RULES) {
    for (const entry of corpus[ruleId] ?? []) {
      if (!entry.ru?.trim() || !entry.lemma || entry.answers.some((answer) => !/^\p{L}+$/u.test(answer))) continue
      const tokens: Token[] = [...entry.text.matchAll(/\p{L}+/gu)].map((match) => ({
        text: match[0], start: match.index, end: match.index + match[0].length,
      }))
      const target = tokens.findIndex(({ start }) => start === entry.pl.indexOf('___'))
      const noun = tokens[target]
      if (!noun) continue

      // The source rule already identifies the gap as governed by a verb.
      // Resolve its head only when the clause has one unambiguous finite verb.
      const verbs = tokens.flatMap((token, index) => {
        const forms = finiteForms.get(normalize(token.text))
        return forms ? [{ token, index, forms }] : []
      })
      const verb = verbs[0]
      const form = verb?.forms[0]
      if (verbs.length !== 1 || verb.forms.length !== 1 || !form || verb.index >= target) continue
      const between = entry.text.slice(verb.token.end, noun.start)
      if (/[,;:]/.test(between) || /\b(?:na|o|do|od|z|ze|w|we|za|po|przez|dla|pod|nad|przed|u|bez|ku)\b/iu.test(between)) continue

      const [, number, person, aspect] = form.tag.split(':')
      const verbRule = conjugation(morphology[form.lemma])
      if (aspect !== 'imperf' || !verbRule || !PERSONS[person]) continue
      const nounCases = new Set(Object.entries(morphology[entry.lemma] ?? {}).flatMap(([tag, variants]) =>
        tag.startsWith('subst:') && variants.some((variant) => normalize(variant) === normalize(noun.text))
          ? [tag.split(':')[2]] : [],
      ))
      const nounCase = ruleId === 'pl.gram.c-gen-verbs' && nounCases.has('gen')
        ? 'gen' : nounCases.size === 1 ? [...nounCases][0] : ''
      if (!CASES[nounCase]) continue

      const key = [ruleId, verbRule, normalize(entry.text)].join('|')
      if (seen.has(key)) continue
      seen.add(key)
      const governor = form.lemma + (/^\s+się(?:\s|$)/u.test(between) ? ' się' : '')
      cards.push({
        id: entry.id,
        translation: entry.ru,
        parts: [entry.text.slice(0, verb.token.start), between, entry.text.slice(noun.end)],
        gaps: [
          {
            token: verb.index,
            ruleId: verbRule,
            lemma: governor,
            accepted: [verb.token.text],
            hint: `Настоящее время, ${PERSONS[person]} лицо, ${number === 'sg' ? 'единственное' : 'множественное'} число.`,
          },
          {
            token: target,
            head: verb.index,
            ruleId,
            lemma: entry.lemma,
            accepted: entry.answers,
            hint: `В этом сочетании глагол ${governor} требует ${CASES[nounCase]} падеж.`,
          },
        ],
      })
    }
  }
  return cards
}

export function matchesRulePair(card: LinkedSentence, firstRuleId: string, secondRuleId: string) {
  const [first, second] = card.gaps
  return (first.head === second.token || second.head === first.token) &&
    ((first.ruleId === firstRuleId && second.ruleId === secondRuleId) ||
      (first.ruleId === secondRuleId && second.ruleId === firstRuleId))
}
