'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { SENTENCE_ATTEMPTS, shuffle } from '@polski/engine'
import { Button, Card, Row, Stack } from '@polski/ui'
import { usePronounce } from '@/lib/speech/usePronounce'
import { ExerciseCard, ExerciseFeedback, ExerciseOptions } from './exercise/ExerciseCard'
import { annotatedLinkedSentence, sampleAnnotated } from '@/lib/engine/annotated-corpus'
import type { CorpusIndex, Paradigm } from '@/lib/content/curriculum'
import { linkedGapOptions, matchesRulePair, normalizeLinkedAnswer, type LinkedSentence } from '@/lib/engine/sentence-corpus'

interface Props {
  cards: LinkedSentence[]
  corpus: CorpusIndex | null
  morphology?: Record<string, Paradigm>
  titles: ReadonlyMap<string, string>
  limit: number
  onChangeFormat: () => void
}

type Difficulty = 'easy' | 'hard'
type PairExamples = { legacy: LinkedSentence[]; annotated: number[] }

function buildPracticePairs(cards: LinkedSentence[], corpus: CorpusIndex | null) {
  const pairs = new Map<string, Map<string, PairExamples>>()

  function connect(first: string, second: string) {
    const forward = pairs.get(first) ?? new Map<string, PairExamples>()
    const backward = pairs.get(second) ?? new Map<string, PairExamples>()
    const examples = forward.get(second) ?? { legacy: [], annotated: [] }
    forward.set(second, examples)
    backward.set(first, examples)
    pairs.set(first, forward)
    pairs.set(second, backward)
    return examples
  }

  for (const card of cards) {
    const [left, right] = card.gaps
    if (left.ruleId !== right.ruleId && matchesRulePair(card, left.ruleId, right.ruleId)) {
      connect(left.ruleId, right.ruleId).legacy.push(card)
    }
  }
  for (const [key, ids] of Object.entries(corpus?.pairs ?? {})) {
    const [left, right] = key.split('|')
    connect(left, right).annotated = ids
  }
  return pairs
}

export function LinkedSentencePractice({ cards, corpus, morphology, titles, limit, onChangeFormat }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [firstRule, setFirstRule] = useState('')
  const [secondRule, setSecondRule] = useState('')
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [session, setSession] = useState<{ cards: LinkedSentence[]; index: number; correct: number; difficulty: Difficulty; seed: number } | null>(null)
  const pairs = useMemo(() => buildPracticePairs(cards, corpus), [cards, corpus])
  const partners = pairs.get(firstRule)

  async function start() {
    const examples = partners?.get(secondRule)
    if (!examples) return
    const seed = Date.now()
    setUnavailable(false)
    setLoading(true)
    try {
      const annotated = corpus && examples.annotated.length
        ? await sampleAnnotated(corpus, examples.annotated, limit, seed, [firstRule, secondRule]).catch(() => [])
        : []
      const generated = annotated.map((sentence) => annotatedLinkedSentence(sentence, firstRule, secondRule))
      const selected = shuffle([...examples.legacy, ...generated], seed).slice(0, limit)
      if (selected.length) setSession({ cards: selected, index: 0, correct: 0, difficulty, seed })
      else setUnavailable(true)
    } finally {
      setLoading(false)
    }
  }

  if (session) {
    const card = session.cards[session.index]
    return (
      <Stack gap="md">
        <Row justify="between" wrap>
          <Button variant="ghost" onClick={() => setSession(null)}>К выбору правил</Button>
          {card && <span className="text-sm text-muted">{session.index + 1} / {session.cards.length}</span>}
        </Row>
        {card ? (
          <LinkedSentenceCard
            key={card.id}
            card={card}
            options={session.difficulty === 'easy' ? card.gaps.map((_, index) =>
              linkedGapOptions(card, index, morphology ?? {}, session.seed)) : null}
            last={session.index + 1 === session.cards.length}
            onNext={(correct) => setSession({
              ...session, index: session.index + 1, correct: session.correct + Number(correct),
            })}
          />
        ) : (
          <Card><p>Верно {session.correct} из {session.cards.length}</p></Card>
        )}
      </Stack>
    )
  }

  return (
    <Card>
      <Stack gap="sm">
        <Button variant="ghost" onClick={onChangeFormat}>К выбору формата</Button>
        <h2 className="font-semibold">Собрать словосочетание</h2>
        {pairs.size === 0 ? <p role="status">Для этого формата пока нет заданий.</p> : (
          <>
            <label className="text-sm font-medium" htmlFor="linked-first-rule">Первое правило</label>
            <select id="linked-first-rule" className="min-h-11 w-full rounded-card border border-line bg-card px-3"
              disabled={loading} value={firstRule} onChange={(event) => { setFirstRule(event.target.value); setSecondRule('') }}>
              <option value="" disabled>Выберите правило</option>
              {[...pairs.keys()].map((id) => <option key={id} value={id}>{titles.get(id) ?? id}</option>)}
            </select>
            {firstRule && (
              <>
                <label className="text-sm font-medium" htmlFor="linked-second-rule">Второе правило</label>
                <select id="linked-second-rule" className="min-h-11 w-full rounded-card border border-line bg-card px-3"
                  disabled={loading} value={secondRule} onChange={(event) => setSecondRule(event.target.value)}>
                  <option value="" disabled>Выберите совместимое правило</option>
                  {[...(partners ?? [])].map(([id, { legacy, annotated }]) => (
                    <option key={id} value={id}>{titles.get(id) ?? id} ({legacy.length + annotated.length})</option>
                  ))}
                </select>
              </>
            )}
            <fieldset disabled={loading} className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium">Сложность</legend>
              <label className="flex cursor-pointer items-center gap-2 rounded-card border border-line px-3 py-2">
                <input type="radio" name="linked-difficulty" checked={difficulty === 'easy'} onChange={() => setDifficulty('easy')} />
                <span className="text-sm">Лёгкая · выбрать из вариантов</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-card border border-line px-3 py-2">
                <input type="radio" name="linked-difficulty" checked={difficulty === 'hard'} onChange={() => setDifficulty('hard')} />
                <span className="text-sm">Сложная · вписать</span>
              </label>
            </fieldset>
            <Button disabled={!secondRule || loading} onClick={() => void start()}>
              {loading ? 'Загружаем примеры…' : 'Начать тренировку'}
            </Button>
            {unavailable && <p role="alert" className="text-sm">Примеры недоступны. Проверьте соединение и попробуйте снова.</p>}
          </>
        )}
      </Stack>
    </Card>
  )
}

function LinkedSentenceCard({ card, options, last, onNext }: {
  card: LinkedSentence
  options: string[][] | null
  last: boolean
  onNext: (correct: boolean) => void
}) {
  const [resolved, setResolved] = useState<{ word: string; revealed: boolean; missed?: string }[]>([])
  const [wrong, setWrong] = useState<string[]>([])
  const [typed, setTyped] = useState('')
  const stepTitle = useRef<HTMLHeadingElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const { pronounce, message } = usePronounce()
  const index = resolved.length
  const gap = card.gaps[index]
  const needsReveal = wrong.length === SENTENCE_ATTEMPTS
  const remaining = SENTENCE_ATTEMPTS - wrong.length

  const isChoice = options !== null
  const hadError = resolved.some(({ missed }) => missed !== undefined)
  const fullSentence = card.parts[0] + card.gaps.map((slot, position) =>
    slot.accepted[0] + card.parts[position + 1],
  ).join('')

  useEffect(() => {
    if (needsReveal || isChoice || index >= card.gaps.length) stepTitle.current?.focus()
    else input.current?.focus()
  }, [card.gaps.length, index, isChoice, needsReveal])

  function finishWord(revealed: boolean) {
    if (!gap) return
    setResolved([...resolved, { word: gap.accepted[0], revealed, missed: wrong.at(-1) }])
    if (index + 1 === card.gaps.length) pronounce(fullSentence)
    setWrong([])
    setTyped('')
  }

  function checkWord(answer: string) {
    if (!gap || needsReveal || !answer.trim()) return
    const normalized = normalizeLinkedAnswer(answer)
    if (gap.accepted.some((accepted) => normalizeLinkedAnswer(accepted) === normalized)) {
      finishWord(false)
    } else {
      setWrong((current) => [...current, answer.trim()])
      setTyped('')
      input.current?.focus()
    }
  }

  return (
    <ExerciseCard tone={gap ? 'neutral' : hadError ? 'wrong' : 'correct'}>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (!options) checkWord(typed)
      }}>
        <Stack gap="md">
          <p>{card.translation}</p>
          <p lang="pl" className="leading-8">
            {card.parts[0]}
            {card.gaps.map(({ token }, position) => {
              const result = resolved[position]
              const revealedWord = index === position && needsReveal ? gap.accepted[0] : null
              const word = result?.word ?? revealedWord
              const wrongWord = gap ? (revealedWord ? wrong.at(-1) : undefined) : result?.missed
              const correct = result && result.missed === undefined
              return (
                <span key={token}>
                  {word ? (
                    <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 rounded-card border px-2 ${correct ? 'border-ok bg-ok-bg text-ok-ink' : 'border-danger bg-danger-bg'}`}>
                      {wrongWord && <del className="text-danger-ink">{wrongWord}</del>}
                      <strong className="text-ok-ink">{word}</strong>
                    </span>
                  ) : (
                    <span
                      className={`inline-block min-w-12 rounded-card border px-2 text-center ${position === index ? 'border-primary text-primary' : 'border-line text-muted'}`}
                      aria-label={`Пропуск ${position + 1}`}
                    >…</span>
                  )}
                  {card.parts[position + 1]}
                </span>
              )
            })}
          </p>
          {gap ? (
            <Stack gap="sm" key={index}>
              <h3 ref={stepTitle} tabIndex={-1} className="text-sm font-medium">
                Слово {index + 1} из {card.gaps.length}
              </h3>
              <ExerciseFeedback size="double" className={wrong.length ? 'text-danger-ink' : 'text-muted'}>
                {needsReveal ? (
                  <>Правильный ответ — <strong lang="pl">{gap.accepted[0]}</strong>.</>
                ) : wrong.length ? (
                  <>Неверно. Осталось попыток: {remaining}.</>
                ) : (
                  <>Попыток: {remaining}.</>
                )}
              </ExerciseFeedback>
              {needsReveal ? (
                <Button type="button" onClick={() => finishWord(true)}>
                  {index + 1 === card.gaps.length ? 'К результату' : 'Следующее слово'}
                </Button>
              ) : options ? (
                <ExerciseOptions options={options[index]}
                  outcomeFor={(option) => wrong.some((answer) => normalizeLinkedAnswer(answer) === normalizeLinkedAnswer(option)) ? 'wrong' : 'none'}
                  disabledFor={(option) => wrong.some((answer) => normalizeLinkedAnswer(answer) === normalizeLinkedAnswer(option))}
                  onSelect={checkWord} />
              ) : (
                <Row gap="sm" wrap>
                  <input
                    ref={input}
                    aria-label={`Пропуск ${index + 1}: ${gap.lemma}`}
                    aria-invalid={wrong.length > 0}
                    lang="pl"
                    className="min-h-12 min-w-0 flex-1 rounded-card border border-line bg-soft px-3"
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                  />
                  <Button type="submit" disabled={!typed.trim()}>Проверить слово</Button>
                </Row>
              )}
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">Подсказка</summary>
                <p className="mt-1 text-muted"><strong lang="pl">{gap.lemma}</strong> · {gap.hint}</p>
              </details>
            </Stack>
          ) : (
            <Stack gap="sm">
              <h3 ref={stepTitle} tabIndex={-1} className="sr-only" role="status">
                {hadError ? 'В ответах были ошибки.' : 'Оба слова верны.'}
              </h3>
              <Row gap="sm" wrap>
                <Button type="button" variant="outline" onClick={() => pronounce(fullSentence)}>
                  <span aria-hidden>🔊</span> Прослушать
                </Button>
                <Button type="button" className="flex-1" onClick={() => onNext(resolved.every(({ revealed }) => !revealed))}>
                  {last ? 'Завершить' : 'Далее'}
                </Button>
              </Row>
              {message && <p className="text-sm text-muted" lang="pl" role="status">{message}</p>}
            </Stack>
          )}
        </Stack>
      </form>
    </ExerciseCard>
  )
}
