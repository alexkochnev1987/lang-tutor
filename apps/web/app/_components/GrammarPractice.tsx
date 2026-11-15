'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Row, Stack } from '@polski/ui'
import { shuffle, type Exercise } from '@polski/engine'
import { ExerciseView } from './ExerciseView'
import { RuleSheet } from './RuleSheet'
import { RuleView } from './RuleView'
import { loadCorpusIndex, loadGrammarRules, loadGrammarSentences, loadMorphology, type CorpusIndex } from '@/lib/content/curriculum'
import { isRuleLanguage, localizeRule, PACK_ORIGINAL_LANGUAGE } from '@/lib/content/rules'
import { useSettings } from '@/lib/data/store'
import { sentenceWriteDrills } from '@/lib/engine/exercises'
import { buildLinkedSentences, buildSentenceCorpus, singleGapExercises } from '@/lib/engine/sentence-corpus'
import { annotatedGapExercise, sampleAnnotated, supportsAnnotatedChoice } from '@/lib/engine/annotated-corpus'
import { LinkedSentencePractice } from './LinkedSentencePractice'

const FORMATS = [
  { id: 'choice', label: 'Выбрать форму', description: 'Выбрать ответ из вариантов' },
  { id: 'typed', label: 'Вписать форму', description: 'Заполнить пропуск с клавиатуры' },
  { id: 'collocation', label: 'Собрать словосочетание', description: 'Заполнить два связанных пропуска' },
  { id: 'write', label: 'Написать предложение', description: 'Ответить на вопрос целым предложением' },
] as const
const MAX_EXERCISES = 10

type Format = (typeof FORMATS)[number]['id']
type PracticeData = Awaited<ReturnType<typeof loadPracticeData>>

async function loadPracticeData() {
  const [sentences, morphology] = await Promise.all([
    loadGrammarSentences(), loadMorphology(),
  ])
  return { sentences, morphology, corpus: buildSentenceCorpus(sentences) }
}

function practiceExercises(data: PracticeData, ruleId: string, format: Exclude<Format, 'collocation'>, seed: number): Exercise[] {
  if (format === 'write') return sentenceWriteDrills(ruleId, data.sentences, seed, MAX_EXERCISES)
  return singleGapExercises(data.corpus[ruleId] ?? [], data.morphology, format, seed, MAX_EXERCISES)
}

type Session = {
  exercises: Exercise[]
  index: number
  answered: boolean
  correct: number
}

export function GrammarPractice() {
  const { ruleLanguage } = useSettings()
  const [data, setData] = useState<PracticeData | null>(null)
  const [rules, setRules] = useState<Awaited<ReturnType<typeof loadGrammarRules>> | null>(null)
  const [corpusIndex, setCorpusIndex] = useState<CorpusIndex | null>(null)
  const [starting, setStarting] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState(false)
  const [legacyUnavailable, setLegacyUnavailable] = useState(false)
  const [ruleId, setRuleId] = useState('')
  const [format, setFormat] = useState<Format | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    let active = true
    loadGrammarRules()
      .then((loaded) => { if (active) setRules(loaded) })
      .catch(() => { if (active) setError(true) })
    loadCorpusIndex()
      .then((index) => { if (active) setCorpusIndex(index) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!format || data || legacyUnavailable) return
    let active = true
    loadPracticeData()
      .then((loaded) => { if (active) setData(loaded) })
      .catch(() => { if (active) setLegacyUnavailable(true) })
    return () => { active = false }
  }, [format, data, legacyUnavailable])

  const availableRules = useMemo(
    () => rules && format && format !== 'collocation'
      ? [...rules.values()].filter((rule) =>
        ((format === 'typed' || (format === 'choice' && supportsAnnotatedChoice(rule.id))) &&
          Boolean(corpusIndex?.rules[rule.id]?.length)) ||
        Boolean(data && practiceExercises(data, rule.id, format, 0).length),
      )
      : [],
    [rules, data, format, corpusIndex],
  )

  const linkedSentences = useMemo(
    () => data && format === 'collocation' ? buildLinkedSentences(data.corpus, data.morphology) : [],
    [data, format],
  )

  if (error) return <Card><p role="alert">Не удалось загрузить правила.</p></Card>
  if (!rules) return <Card><p role="status">Загружаем правила…</p></Card>
  const selectedRule = rules.get(ruleId)
  const language = isRuleLanguage(ruleLanguage) ? ruleLanguage : PACK_ORIGINAL_LANGUAGE
  const rule = selectedRule ? localizeRule(selectedRule, language) : null
  const exercise = session?.exercises[session.index]

  async function start(ruleId: string, mode: Exclude<Format, 'collocation'>) {
    const seed = Date.now()
    setUnavailable(false)
    setStarting(true)
    try {
      const legacy = data ? practiceExercises(data, ruleId, mode, seed) : []
      const fromCorpus = mode === 'typed' || (mode === 'choice' && supportsAnnotatedChoice(ruleId))
      const examples = fromCorpus && corpusIndex
        ? await sampleAnnotated(corpusIndex, corpusIndex.rules[ruleId] ?? [], MAX_EXERCISES, seed).catch(() => [])
        : []
      const generated = mode !== 'write' ? examples.flatMap((example) => {
        const exercise = annotatedGapExercise(example, ruleId, mode, seed)
        return exercise ? [exercise] : []
      }) : []
      const exercises = shuffle([...legacy, ...generated], seed).slice(0, MAX_EXERCISES)
      if (exercises.length) setSession({ exercises, index: 0, answered: false, correct: 0 })
      else setUnavailable(true)
    } finally {
      setStarting(false)
    }
  }

  if (format === 'collocation') {
    const titles = new Map([...rules.values()].map((entry) => [entry.id, entry.title[language] ?? entry.title.pl ?? entry.id]))
    return <LinkedSentencePractice cards={linkedSentences} corpus={corpusIndex} titles={titles} limit={MAX_EXERCISES} onChangeFormat={() => setFormat(null)} />
  }

  if (session && rule) {
    return (
      <Stack gap="md">
        <Row justify="between" wrap>
          <Button variant="ghost" onClick={() => setSession(null)}>К выбору правила</Button>
          {exercise && <span className="text-sm text-muted">{session.index + 1} / {session.exercises.length}</span>}
        </Row>
        {exercise ? (
          <>
            {exercise.id.startsWith('ex.sgap.corpus.') && exercise.mode !== 'assemble' && exercise.explanation &&
              <p className="text-center text-sm text-muted">{exercise.explanation}</p>}
            <ExerciseView
              key={exercise.id}
              exercise={exercise}
              onAnswered={(result) => setSession((current) => current && !current.answered ? {
                ...current,
                answered: true,
                correct: current.correct + Number(result.correct),
              } : current)}
            />
            <Row gap="sm" justify="center" wrap>
              <RuleSheet rule={rule} />
              <Button
                disabled={!session.answered}
                onClick={() => setSession((current) => current?.answered ? {
                  ...current,
                  index: current.index + 1,
                  answered: false,
                } : current)}
              >
                {session.index + 1 === session.exercises.length ? 'Завершить' : 'Далее'}
              </Button>
            </Row>
          </>
        ) : (
          <Card>
            <h2 className="font-semibold">{rule.titlePl}</h2>
            <p className="mt-1 text-sm">Верно {session.correct} из {session.exercises.length}</p>
          </Card>
        )}
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <Card>
        <Stack gap="sm">
          <h2 id="practice-format-label" className="font-semibold">Тип тренировки</h2>
          <div role="group" aria-labelledby="practice-format-label" className="grid gap-2 sm:grid-cols-2">
            {FORMATS.map(({ id, label, description }) => (
              <button
                key={id}
                type="button"
                aria-pressed={format === id}
                disabled={starting}
                onClick={() => {
                  if (format === id) return
                  setFormat(id)
                  setRuleId('')
                }}
                className="flex min-h-17 flex-col justify-center rounded-card border border-line bg-card px-3 py-2 text-left hover:bg-soft aria-pressed:border-primary aria-pressed:bg-soft"
              >
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-muted">{description}</span>
              </button>
            ))}
          </div>
          {format && !data && !legacyUnavailable && availableRules.length === 0 && (
            <p role="status" className="text-sm text-muted">Загружаем примеры…</p>
          )}
          {format && (data || legacyUnavailable) && availableRules.length === 0 && (
            <p role="status" className="text-sm text-muted">
              {legacyUnavailable ? 'Примеры недоступны без соединения.' : 'Для этого формата пока нет заданий.'}
            </p>
          )}
          {format && availableRules.length > 0 && (
            <>
              <label className="text-sm font-medium" htmlFor="practice-rule">Правило</label>
              <select
                id="practice-rule"
                className="min-h-11 w-full rounded-card border border-line bg-card px-3"
                disabled={starting}
                value={ruleId}
                onChange={(event) => setRuleId(event.target.value)}
              >
                <option value="" disabled>Выберите правило</option>
                {availableRules.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title.pl ?? entry.title[language] ?? entry.id}
                  </option>
                ))}
              </select>
              {unavailable && <p role="alert" className="text-sm">Примеры недоступны. Проверьте соединение и попробуйте снова.</p>}
              {rule && (
                <Button disabled={starting} onClick={() => void start(ruleId, format)}>
                  {starting ? 'Загружаем примеры…' : 'Начать тренировку'}
                </Button>
              )}
            </>
          )}
        </Stack>
      </Card>
      {rule && <Card><RuleView key={rule.id} rule={rule} /></Card>}
    </Stack>
  )
}
