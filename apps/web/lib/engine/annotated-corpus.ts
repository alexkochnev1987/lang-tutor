import { sentenceChoice, sentenceTyped, shuffle } from '@polski/engine'
import { loadCorpusChunk, type CorpusIndex, type AnnotatedSentence } from '../content/curriculum'
import type { LinkedGap, LinkedSentence } from './sentence-corpus'

const HINTS: Record<string, string> = {
  'pl.gram.v-present-3': 'Выбери личную форму глагола в настоящем времени по переводу.',
  'pl.gram.v-government': 'Определи, какого падежа требует управляющий глагол.',
  'pl.gram.c-gen-verbs': 'После этого глагола употребляется родительный падеж.',
  'pl.gram.k-adj-agreement': 'Согласуй прилагательное с существительным в роде, числе и падеже.',
}

const wordSpans = (sentence: AnnotatedSentence) => [...sentence.pl.matchAll(/\p{L}+/gu)]

export const pairKey = (first: string, second: string) => [first, second].sort().join('|')

export async function sampleAnnotated(index: CorpusIndex, candidates: number[], limit: number, seed: number) {
  const chunkOf = (id: number) => Math.floor(id / index.chunkSize)
  const byChunk = new Map<number, number[]>()
  for (const id of shuffle(candidates, seed)) {
    const chunk = chunkOf(id)
    const group = byChunk.get(chunk) ?? []
    group.push(id)
    byChunk.set(chunk, group)
  }
  const selected: number[] = []
  const perChunk = Math.ceil(limit / 2)
  for (const group of byChunk.values()) {
    selected.push(...group.slice(0, Math.min(perChunk, limit - selected.length)))
    if (selected.length === limit) break
  }
  if (selected.length < limit) {
    const used = new Set(selected)
    selected.push(...[...byChunk.values()].flat().filter((id) => !used.has(id)).slice(0, limit - selected.length))
  }
  const chunks = new Map(await Promise.all([...new Set(selected.map(chunkOf))].map(async (chunk) =>
    [chunk, await loadCorpusChunk(index.version, chunk).catch(() => null)] as const,
  )))
  const samples = selected.flatMap((id) => {
    const sentence = chunks.get(chunkOf(id))?.[id % index.chunkSize]
    return sentence ? [sentence] : []
  })
  if (samples.length || !candidates.length) return samples

  // The first chunk can be installed with the PWA. Use its matching examples
  // when the randomly selected chunks are unavailable offline.
  const starter = await loadCorpusChunk(index.version, 0)
  return shuffle(candidates.filter((id) => id < index.chunkSize), seed)
    .slice(0, limit).flatMap((id) => starter[id] ? [starter[id]] : [])
}

export function annotatedLinkedSentence(sentence: AnnotatedSentence, first: string, second: string): LinkedSentence {
  const slots = [first, second].sort((left, right) => sentence.hits[left] - sentence.hits[right])
  const words = wordSpans(sentence)
  const gaps = slots.map((ruleId): LinkedGap => {
    const token = sentence.hits[ruleId]
    const [lemma, head, , morphology] = sentence.nodes[token]
    const governor = head === null ? undefined : sentence.nodes[head][0]
    return {
      token,
      head: head ?? undefined,
      ruleId,
      lemma,
      accepted: [words[token][0]],
      hint: ruleId === 'pl.gram.v-government' && governor && morphology?.split(':')[2] === 'gen'
        ? `В этом предложении после ${governor} употребляется родительный падеж.`
        : HINTS[ruleId] ?? 'Определи нужную форму по контексту предложения.',
    }
  }) as [LinkedGap, LinkedGap]
  const [left, right] = gaps.map(({ token }) => words[token])
  return {
    id: sentence.id,
    translation: sentence.ru,
    parts: [
      sentence.pl.slice(0, left.index),
      sentence.pl.slice(left.index + left[0].length, right.index),
      sentence.pl.slice(right.index + right[0].length),
    ],
    gaps,
  }
}

export function supportsAnnotatedChoice(ruleId: string) {
  return ruleId === 'pl.gram.v-present-3'
}

export function annotatedGapExercise(sentence: AnnotatedSentence, ruleId: string, mode: 'choice' | 'typed', seed: number) {
  const token = sentence.hits[ruleId]
  const match = wordSpans(sentence)[token]
  const answer = match[0]
  const gap = {
    id: `corpus.${sentence.id}.${ruleId}`,
    sentence: sentence.pl.slice(0, match.index) + '___' + sentence.pl.slice(match.index + answer.length),
    baseForm: sentence.nodes[token][0],
    answers: [answer],
    translation: sentence.ru,
  }
  if (mode === 'typed') return sentenceTyped(gap, [ruleId])
  if (!supportsAnnotatedChoice(ruleId) || sentence.nodes[token][3] !== 'fin:sg:pri:imperf' || !answer.endsWith('am')) return null
  const stem = answer.slice(0, -1)
  return sentenceChoice(gap, [stem, `${stem}sz`, `${answer}y`], { seed }, [ruleId])
}
