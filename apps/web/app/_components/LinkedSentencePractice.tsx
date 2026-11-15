'use client'

import { useMemo, useState } from 'react'
import { shuffle } from '@polski/engine'
import { Button, Card, Row, Stack } from '@polski/ui'
import { annotatedLinkedSentence, pairKey, sampleAnnotated } from '@/lib/engine/annotated-corpus'
import type { CorpusIndex } from '@/lib/content/curriculum'
import { matchesRulePair, type LinkedSentence } from '@/lib/engine/sentence-corpus'

interface Props {
  cards: LinkedSentence[]
  corpus: CorpusIndex | null
  titles: ReadonlyMap<string, string>
  limit: number
  onChangeFormat: () => void
}

export function LinkedSentencePractice({ cards, corpus, titles, limit, onChangeFormat }: Props) {
  const [firstRule, setFirstRule] = useState('')
  const [secondRule, setSecondRule] = useState('')
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [session, setSession] = useState<{ cards: LinkedSentence[]; index: number; correct: number } | null>(null)
  const byRule = useMemo(() => {
    const index = new Map<string, LinkedSentence[]>()
    for (const card of cards) {
      for (const { ruleId } of card.gaps) {
        const examples = index.get(ruleId) ?? []
        examples.push(card)
        index.set(ruleId, examples)
      }
    }
    return index
  }, [cards])
  const partners = new Map<string, number>()
  const examples = byRule.get(firstRule) ?? []
  for (const card of examples) {
    const partner = card.gaps.find(({ ruleId }) => ruleId !== firstRule)?.ruleId
    if (partner) partners.set(partner, (partners.get(partner) ?? 0) + 1)
  }

  const firstRules = new Set(byRule.keys())
  for (const [key, ids] of Object.entries(corpus?.pairs ?? {})) {
    const [left, right] = key.split('|')
    firstRules.add(left)
    firstRules.add(right)
    const partner = firstRule === left ? right : firstRule === right ? left : null
    if (partner) partners.set(partner, (partners.get(partner) ?? 0) + ids.length)
  }

  async function start() {
    const seed = Date.now()
    const legacy = examples.filter((card) => matchesRulePair(card, firstRule, secondRule))
    const candidates = corpus?.pairs[pairKey(firstRule, secondRule)] ?? []
    setUnavailable(false)
    setLoading(true)
    try {
      const annotated = corpus && candidates.length
        ? await sampleAnnotated(corpus, candidates, limit, seed).catch(() => [])
        : []
      const generated = annotated.map((sentence) => annotatedLinkedSentence(sentence, firstRule, secondRule))
      const selected = shuffle([...legacy, ...generated], seed).slice(0, limit)
      if (selected.length) setSession({ cards: selected, index: 0, correct: 0 })
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
          <LinkedSentenceCard key={card.id} card={card} last={session.index + 1 === session.cards.length}
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
        {firstRules.size === 0 ? <p role="status">Для этого формата пока нет заданий.</p> : (
          <>
            <label className="text-sm font-medium" htmlFor="linked-first-rule">Первое правило</label>
            <select id="linked-first-rule" className="min-h-11 w-full rounded-card border border-line bg-card px-3"
              disabled={loading} value={firstRule} onChange={(event) => { setFirstRule(event.target.value); setSecondRule('') }}>
              <option value="" disabled>Выберите правило</option>
              {[...firstRules].map((id) => <option key={id} value={id}>{titles.get(id) ?? id}</option>)}
            </select>
            {firstRule && (
              <>
                <label className="text-sm font-medium" htmlFor="linked-second-rule">Второе правило</label>
                <select id="linked-second-rule" className="min-h-11 w-full rounded-card border border-line bg-card px-3"
                  disabled={loading} value={secondRule} onChange={(event) => setSecondRule(event.target.value)}>
                  <option value="" disabled>Выберите совместимое правило</option>
                  {[...partners].map(([id, count]) => <option key={id} value={id}>{titles.get(id) ?? id} ({count})</option>)}
                </select>
              </>
            )}
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

function LinkedSentenceCard({ card, last, onNext }: {
  card: LinkedSentence
  last: boolean
  onNext: (correct: boolean) => void
}) {
  const [answers, setAnswers] = useState(['', ''])
  const [checked, setChecked] = useState(false)
  const normalizeAnswer = (answer: string) => answer.trim().normalize('NFC').toLocaleLowerCase('pl')
  const results = card.gaps.map((gap, index) =>
    gap.accepted.some((answer) => normalizeAnswer(answer) === normalizeAnswer(answers[index])))

  return (
    <Card>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (checked) onNext(results.every(Boolean))
        else if (answers.every((answer) => answer.trim())) setChecked(true)
      }}>
        <Stack gap="md">
          <p>{card.translation}</p>
          <p lang="pl" className="leading-10">
            {card.parts[0]}
            {card.gaps.map((gap, index) => (
              <span key={gap.token}>
                <input
                  className="inline-block h-9 w-[min(8rem,38vw)] rounded-card border border-line bg-soft px-2"
                  aria-label={`Пропуск ${index + 1}: ${gap.lemma}`}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  readOnly={checked}
                  aria-invalid={checked && !results[index]}
                  value={answers[index]}
                  onChange={(event) => setAnswers(answers.map((answer, i) => i === index ? event.target.value : answer))}
                />
                {card.parts[index + 1]}
              </span>
            ))}
          </p>
          {card.gaps.map((gap, index) => (
            <details key={gap.token} className="text-sm">
              <summary className="cursor-pointer font-medium">Подсказка {index + 1} · <span lang="pl">{gap.lemma}</span></summary>
              <p className="mt-1 text-muted">{gap.hint}</p>
            </details>
          ))}
          {checked && (
            <div role="status" className="text-sm">
              {results.every(Boolean) ? 'Оба слова верны.' : card.gaps.map((gap, index) =>
                !results[index] && <p key={gap.token}>Пропуск {index + 1} — <strong lang="pl">{gap.accepted[0]}</strong></p>)}
            </div>
          )}
          <Button type="submit" disabled={!answers.every((answer) => answer.trim())}>
            {checked ? (last ? 'Завершить' : 'Далее') : 'Проверить'}
          </Button>
        </Stack>
      </form>
    </Card>
  )
}
