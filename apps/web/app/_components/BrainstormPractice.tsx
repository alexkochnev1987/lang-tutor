'use client'

import { useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from './AppIcon'
import { Button, Card, Row, Screen, Stack } from '@polski/ui'
import type { CheckResult } from '@polski/engine'
import type { Lexeme } from '@/lib/content/curriculum'
import { getLoadedState, queueDailyWordAnswer } from '@/lib/data/store'
import { formatOfWordExercise, wordSkill, type DailyWordAnswer, type DailyWordSubmission, type WordFormat } from '@/lib/engine/daily-words'
import { prepareLexemeReview, Rating } from '@/lib/engine/session'
import { buildWordStageRetryStep, buildWordStudySteps, oneAttemptWordSteps, WORD_STAGE_RETRY_LIMIT, type WordExerciseStep } from '@/lib/engine/word-study'
import { ExerciseView, SpeakIcon } from './ExerciseView'
import { ExerciseCard, ExercisePromptArea } from './exercise/ExerciseCard'
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

export function BrainstormPractice({ id, words, pool, dayNumber, reviewFormats, canContinue, checking, loadError, onConsume, onContinue, onExit }: {
  id: string
  words: Lexeme[]
  pool: Lexeme[]
  dayNumber: number
  reviewFormats?: Record<string, WordFormat[]>
  canContinue: boolean
  checking: boolean
  loadError: boolean
  onConsume: (wordId: string, correct?: number, total?: number) => void
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
  const [failed, setFailed] = useState(false)
  const writing = useRef(false)
  const main = useRef<HTMLElement>(null)
  const prefix = `${id}:`
  const allSteps = useMemo(() => oneAttemptWordSteps(buildWordStudySteps(words, pool, prefix)), [words, pool, prefix])
  const base = useMemo(() => allSteps.filter((step) => step.kind === 'word-intro' || !reviewFormats || reviewFormats[step.word.id]?.includes(formatOfWordExercise(step.ex))), [allSteps, reviewFormats])
  const stages = useMemo(() => {
    const byWord = new Map<string, WordExerciseStep[]>()
    for (const step of allSteps) {
      if (step.kind !== 'exercise') continue
      const list = byWord.get(step.word.id) ?? []
      list.push(step)
      byWord.set(step.word.id, list)
    }
    return byWord
  }, [allSteps])

  function stagesFor(word: Lexeme, responses: Progress['responses']) {
    return (stages.get(word.id) ?? []).map((first, stageIndex) => {
      if (reviewFormats && !reviewFormats[word.id]?.includes(formatOfWordExercise(first.ex))) return []
      const attempts = [first]
      for (let round = 1; round <= WORD_STAGE_RETRY_LIMIT; round += 1) {
        const previous = responses[attempts[attempts.length - 1]!.ex.id]
        if (!previous || previous.result.correct) break
        const retry = buildWordStageRetryStep(word, pool, prefix, stageIndex, round)
        if (!retry) break
        attempts.push(retry)
      }
      return attempts
    }).filter((attempts) => attempts.length > 0)
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

  function advance() {
    if (!step || writing.current) return
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
    setFailed(false)
    try {
      const state = getLoadedState()
      if (!state) throw new Error('word_state_not_loaded')
      const now = new Date()
      const payload: DailyWordSubmission = {
        format: 'brainstorm',
        sessionId: id,
        startedAt: progress.startedAt,
        answers: finalStages.map(({ step, attempts }) => {
          const { result, ms } = responses[step.ex.id]!
          const format = formatOfWordExercise(step.ex)
          return {
            ...prepareLexemeReview(state.studyItems, word.id, wordSkill(format),
              result.correct ? Rating.Good : Rating.Again, ms, now),
            format, result: { ...result, attempts },
          }
        }),
      }
      queueDailyWordAnswer(payload)
      onConsume(word.id, finalStages.filter(({ step }) => responses[step.ex.id]?.result.correct).length, finalStages.length)
      // Do not block the next word on the server. Failures remain in the
      // shared outbox and are retryable from any word exercise footer.
      updateProgress(next)
    } catch (error) {
      console.error('[brainstorm]', error)
      setFailed(true)
    } finally {
      writing.current = false
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
          <Button variant="outline" size="sm" disabled={checking} onClick={() => leave(onExit)}>
            <AppIcon name="back" className="size-4 shrink-0" />
            {t('back')}
          </Button>
          <span className="text-sm text-muted">{t('brainstorm')} · {t('batchWords', { count: words.length })}</span>
        </Row>
      </header>
      <main ref={main} className="mx-auto w-full max-w-2xl flex-1 px-4 pb-2">
        {step?.kind === 'word-intro' && (
          <ExerciseCard practice>
            <ExercisePromptArea practice>
              <Stack gap="sm" align="center">
                <Row gap="sm"><p className="text-3xl font-semibold break-words" lang="pl">{step.word.lemma}</p>
                  <SpeakIcon text={step.word.lemma} size="compact" ariaLabel={t('pronounceWord')} /></Row>
                <p className="text-lg text-center">{step.word.translation}</p>
              </Stack>
            </ExercisePromptArea>
          </ExerciseCard>
        )}
        {exercise && (
          <ExerciseView key={exercise.id} exercise={exercise} onAnswered={remember} autoFocus={false}
            showSpeakButton={exercise.kind === 'listen-write' || exercise.kind === 'translate-recognition'
              || exercise.kind === 'false-friend-contrast' || Boolean(response)} submitFormId={formId} practice />
        )}
        {!step && (
          <Card><Stack gap="sm">
            <strong>{t('done')}</strong>
            <p>{t('score', { correct: done.filter(({ result }) => result.correct).length, total: done.length })}</p>
            <WeeklyGoalCredit />
          </Stack></Card>
        )}
        {loadError && <p role="alert" className="mt-2 text-sm text-danger-ink">{t('error')}</p>}
      </main>
      <WordPracticeFooter
        busyLabel={checking ? t('loading') : undefined}
        label={failed ? t('retry')
          : formId && !response ? t('check') : step ? t('next') : canContinue ? t('continue') : t('backToFormats')}
        formId={response ? undefined : formId}
        disabled={checking || Boolean(exercise && !formId && !response)}
        onNext={step ? advance : canContinue ? onContinue : () => leave(onExit)}
      />
    </Screen>
  )
}
