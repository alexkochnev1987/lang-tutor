import { sentenceChoice, sentenceTyped, shuffle } from '@polski/engine'
import { loadCorpusChunk, type CorpusIndex, type AnnotatedSentence } from '../content/curriculum'
import type { LinkedGap, LinkedSentence } from './sentence-corpus'

const HINTS: Record<string, string> = {
  'pl.gram.v-present-3': 'Выбери личную форму глагола в настоящем времени по переводу.',
  'pl.gram.v-government': 'Определи, какого падежа требует управляющий глагол.',
  'pl.gram.c-gen-verbs': 'После этого глагола употребляется родительный падеж.',
  'pl.gram.c-acc': 'Выбери форму винительного падежа. В этой фразе слово отвечает на вопрос кого? или что?',
  'pl.gram.k-adj-agreement': 'Согласуй прилагательное с существительным в роде, числе и падеже.',
}

const GOVERNED_CASES: Record<string, string> = {
  gen: 'родительный',
  dat: 'дательный',
  acc: 'винительный',
  inst: 'творительный',
  loc: 'предложный',
}

const wordSpans = (sentence: AnnotatedSentence) => [...sentence.pl.matchAll(/\p{L}+/gu)]

export function diverseSentences(
  sentences: AnnotatedSentence[],
  ruleIds: readonly string[],
  limit: number,
) {
  const seen = new Map<string, number>()
  const candidates = sentences.map((sentence) => ({
    sentence,
    lemmas: new Set(ruleIds.flatMap((rule) => {
      const node = sentence.nodes[sentence.hits[rule]]
      return node ? [node[0]] : []
    })),
  }))
  const result: AnnotatedSentence[] = []
  while (candidates.length && result.length < limit) {
    let best = 0
    let bestScore = Infinity
    for (const [index, { lemmas }] of candidates.entries()) {
      const score = [...lemmas].reduce((sum, lemma) => sum + (seen.get(lemma) ?? 0), 0)
      if (score < bestScore) {
        best = index
        bestScore = score
      }
      if (score === 0) break
    }
    const [candidate] = candidates.splice(best, 1)
    result.push(candidate.sentence)
    for (const lemma of candidate.lemmas) seen.set(lemma, (seen.get(lemma) ?? 0) + 1)
  }
  return result
}

export async function sampleAnnotated(
  index: CorpusIndex,
  candidates: number[],
  limit: number,
  seed: number,
  ruleIds: readonly string[],
) {
  const chunkOf = (id: number) => Math.floor(id / index.chunkSize)
  const shuffled = shuffle(candidates, seed)
  const byChunk = new Map<number, number>()
  for (const id of shuffled) {
    const chunk = chunkOf(id)
    byChunk.set(chunk, (byChunk.get(chunk) ?? 0) + 1)
  }

  const preferredPerChunk = Math.ceil(limit / 2)
  const rankedChunks = [...byChunk].sort(([, left], [, right]) =>
    Math.min(preferredPerChunk, right) - Math.min(preferredPerChunk, left),
  )
  const selectedChunks: number[] = []
  let available = 0
  for (const [chunk, count] of rankedChunks) {
    selectedChunks.push(chunk)
    available += count
    if (available >= limit && (selectedChunks.length >= 2 || rankedChunks.length === 1)) break
  }
  const chunks = new Map(await Promise.all(selectedChunks.map(async (chunk) =>
    [chunk, await loadCorpusChunk(index.version, chunk).catch(() => null)] as const,
  )))
  const samples = shuffled.flatMap((id) => {
    const sentence = chunks.get(chunkOf(id))?.[id % index.chunkSize]
    return sentence ? [sentence] : []
  })
  if (samples.length || !candidates.length) return diverseSentences(samples, ruleIds, limit)

  // The first chunk can be installed with the PWA. Use its matching examples
  // when the randomly selected chunks are unavailable offline.
  const starter = await loadCorpusChunk(index.version, 0)
  const offline = shuffle(candidates.filter((id) => id < index.chunkSize), seed)
    .flatMap((id) => starter[id] ? [starter[id]] : [])
  return diverseSentences(offline, ruleIds, limit)
}

export function annotatedLinkedSentence(sentence: AnnotatedSentence, first: string, second: string): LinkedSentence {
  const slots = [first, second].sort((left, right) => sentence.hits[left] - sentence.hits[right])
  const words = wordSpans(sentence)
  const gaps = slots.map((ruleId): LinkedGap => {
    const token = sentence.hits[ruleId]
    const [lemma, head, , morphology] = sentence.nodes[token]
    const governor = head === null ? undefined : sentence.nodes[head][0]
    const grammaticalCase = GOVERNED_CASES[morphology?.split(':')[2] ?? '']
    const reflexive = sentence.nodes.some(([text, parent]) => text === 'się' && parent === head)
    const verb = reflexive ? `${governor} się` : governor
    const fallbackHint = HINTS[ruleId] ?? 'Определи нужную форму по контексту предложения.'
    const hint = ruleId === 'pl.gram.k-adverb' && morphology === 'adv:com'
      ? 'Поставь наречие в сравнительную степень: оно отвечает на вопрос «как?».'
      : fallbackHint
    return {
      token,
      head: head ?? undefined,
      ruleId,
      lemma,
      accepted: [words[token][0]],
      hint: ruleId === 'pl.gram.v-government' && governor && grammaticalCase
        ? `В этом предложении после ${verb} употребляется ${grammaticalCase} падеж.`
        : hint,
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
