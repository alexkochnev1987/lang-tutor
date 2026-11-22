'use client'

import { useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Card, Row, Screen, Stack } from '@polski/ui'
import type { CheckResult } from '@polski/engine'
import type { Lexeme } from '@/lib/content/curriculum'
import { loadState, saveDailyWordAnswer } from '@/lib/data/store'
import { formatOfWordExercise, wordSkill, type DailyWordAnswer, type DailyWordSubmission } from '@/lib/engine/daily-words'
import { prepareLexemeReview, Rating } from '@/lib/engine/session'
import { buildWordStageRetryStep, buildWordStudySteps, oneAttemptWordSteps, WORD_STAGE_RETRY_LIMIT, type WordExerciseStep } from '@/lib/engine/word-study'
import { ExerciseView, SpeakIcon } from './ExerciseView'
import { WeeklyGoalCredit } from './WeeklyGoal'
import { WordPracticeFooter } from './WordPracticeFooter'

const FORM_ID = 'brainstorm-response'
const STORAGE_KEY = 'brainstorm-progress'
type Response = { result: DailyWordAnswer['result']; ms: number }
type Progress = {
  startedAt: string
  introduced: string[]
  responses: Record<string, Response>
  unavailable: string[]
}

export function BrainstormPractice({ id, words, pool, dayNumber, canContinue, checking, loadError, onConsume, onContinue, onExit }: {
  id: string
  words: Lexeme[]
  pool: Lexeme[]
  dayNumber: number
  canContinue: boolean
  checking: boolean
  loadError: boolean
  onConsume: (wordId: string) => void
  onContinue: () => void
  onExit: () => void
}) {
  const t = useTranslations('dailyWords')
  const [progress, setProgress] = useState<Progress>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      const saved = raw ? JSON.parse(raw) as { id: string; progress: Progress } : null
      if (saved?.id === id) return saved.progress
    } catch { /* Session storage may be unavailable. */ }
    return { startedAt: new Date().toISOString(), introduced: [], responses: {}, unavailable: [] }
  })
  const [response, setResponse] = useState<Response | null>(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const pending = useRef<DailyWordSubmission | null>(null)
  const writing = useRef(false)
  const main = useRef<HTMLElement>(null)
  const prefix = `${id}:`
  const base = useMemo(() => oneAttemptWordSteps(buildWordStudySteps(words, pool, prefix)), [words, pool, prefix])
  const stages = useMemo(() => {
    const byWord = new Map<string, WordExerciseStep[]>()
    for (const step of base) {
      if (step.kind !== 'exercise') continue
      const list = byWord.get(step.word.id) ?? []
      list.push(step)
      byWord.set(step.word.id, list)
    }
    return byWord
  }, [base])

  function stagesFor(word: Lexeme, responses: Progress['responses']) {
    return (stages.get(word.id) ?? []).map((first, stageIndex) => {
      const attempts = [first]
      for (let round = 1; round <= WORD_STAGE_RETRY_LIMIT; round += 1) {
        const previous = responses[attempts[attempts.length - 1]!.ex.id]
        if (!previous || previous.result.correct) break
        const retry = buildWordStageRetryStep(word, pool, prefix, stageIndex, round)
        if (!retry) break
        attempts.push(retry)
      }
      return attempts
    })
  }

  const active = (word: Lexeme) => !progress.unavailable.includes(word.id)
  const baseStep = base.find((step) => active(step.word) && (step.kind === 'word-intro'
    ? !progress.introduced.includes(step.word.id) : !progress.responses[step.ex.id]))
  const retryStep = baseStep ? undefined : words.filter(active).flatMap((word) =>
    stagesFor(word, progress.responses).flatMap((attempts) => attempts.slice(1)),
  ).find((step) => !progress.responses[step.ex.id])
  const step = baseStep ?? retryStep
  const exercise = step?.kind === 'exercise' ? step.ex : null
  const done = Object.values(progress.responses)
  const formId = exercise?.mode === 'typed' ? FORM_ID : undefined

  function updateProgress(next: Progress) {
    setProgress(next)
    setResponse(null)
    main.current?.scrollTo({ top: 0 })
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id, progress: next })) } catch { /* Storage may be unavailable. */ }
  }

  function remember(result: CheckResult, ms: number, attempts: number, answer: string) {
    if (!exercise) return
    setResponse({ ms, result: {
      dayNumber, exerciseId: exercise.id, attempts, correct: result.correct,
      answer, expected: result.expected, errorKind: result.errorKind ?? null,
    } })
  }

  async function advance() {
    if (!step || writing.current) return
    setUnavailable(false)
    const word = step.word
    if (step.kind === 'word-intro') {
      updateProgress({ ...progress, introduced: [...progress.introduced, word.id] })
      return
    }
    if (!response) return
    const responses = { ...progress.responses, [step.ex.id]: response }
    const next = { ...progress, responses }
    const finalStages = stagesFor(word, responses).map((attempts) => ({
      step: attempts[attempts.length - 1]!,
      attempts: attempts.length,
    }))
    if (finalStages.some(({ step }) => !responses[step.ex.id])) {
      updateProgress(next)
      return
    }

    writing.current = true
    setSaving(true)
    setFailed(false)
    try {
      if (!pending.current) {
        const { studyItems } = await loadState()
        const now = new Date()
        pending.current = {
          format: 'brainstorm',
          sessionId: id,
          startedAt: progress.startedAt,
          answers: finalStages.map(({ step, attempts }) => {
            const { result, ms } = responses[step.ex.id]!
            const format = formatOfWordExercise(step.ex)
            return {
              ...prepareLexemeReview(studyItems, word.id, wordSkill(format), result.correct ? Rating.Good : Rating.Again, ms, now),
              format, result: { ...result, attempts },
            }
          }),
        }
      }
      const accepted = await saveDailyWordAnswer(pending.current)
      pending.current = null
      onConsume(word.id)
      setUnavailable(!accepted)
      updateProgress(accepted ? next : { ...progress, unavailable: [...progress.unavailable, word.id] })
    } catch {
      setFailed(true)
    } finally {
      writing.current = false
      setSaving(false)
    }
  }

  function leave(action: () => void) {
    try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* Storage may be unavailable. */ }
    action()
  }

  return (
    <Screen className="word-practice-screen">
      <header className="mx-auto w-full max-w-2xl px-4 py-2">
        <Row justify="between" wrap>
          <Button variant="ghost" size="sm" disabled={saving || checking} onClick={() => leave(onExit)}>{t('choose')}</Button>
          <span className="text-sm text-muted">{t('brainstorm')} · {t('batchWords', { count: words.length })}</span>
        </Row>
      </header>
      <main ref={main} className="mx-auto w-full max-w-2xl flex-1 px-4 pb-2">
        {step?.kind === 'word-intro' && (
          <Card>
            <Stack gap="sm" align="center">
              <p className="text-3xl font-semibold" lang="pl">{step.word.lemma}</p>
              <p className="text-lg">{step.word.translation}</p>
              <SpeakIcon text={step.word.lemma} ariaLabel={t('pronounceWord')} />
            </Stack>
          </Card>
        )}
        {exercise && (
          <ExerciseView key={exercise.id} exercise={exercise} onAnswered={remember} autoFocus={false}
            showSpeakButton={exercise.kind === 'listen-write' || exercise.kind === 'translate-recognition'
              || exercise.kind === 'false-friend-contrast' || Boolean(response)} submitFormId={formId} />
        )}
        {!step && (
          <Card><Stack gap="sm">
            <strong>{t('done')}</strong>
            <p>{t('score', { correct: done.filter(({ result }) => result.correct).length, total: done.length })}</p>
            <WeeklyGoalCredit />
          </Stack></Card>
        )}
        {unavailable && <p role="status" className="mt-2 text-sm text-muted">{t('unavailable')}</p>}
        {loadError && <p role="alert" className="mt-2 text-sm text-danger-ink">{t('error')}</p>}
      </main>
      <WordPracticeFooter
        label={checking ? t('loading') : saving ? t('saving') : failed ? t('retry')
          : formId && !response ? t('check') : step ? t('next') : canContinue ? t('continue') : t('choose')}
        formId={response ? undefined : formId}
        disabled={saving || checking || Boolean(exercise && !formId && !response)}
        onNext={step ? () => void advance() : canContinue ? onContinue : () => leave(onExit)}
      />
    </Screen>
  )
}
