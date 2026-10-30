'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Button, Card, Row, Screen, Stack } from '@polski/ui'
import type { CheckResult, Exercise } from '@polski/engine'
import { Nav } from '@/app/_components/Nav'
import { ExerciseView, SpeakIcon } from '@/app/_components/ExerciseView'
import { ThemePicker } from '@/app/_components/ThemePicker'
import {
  currentDayNumber, loadCurriculum, loadVocabulary, type Lexeme,
} from '@/lib/content/curriculum'
import {
  useAppState, saveExerciseResult, saveLessonSession, setLexemeKnown,
} from '@/lib/data/store'
import { completeLexemeLearning } from '@/lib/engine/session'
import {
  buildWordStudySteps, type WordStudyStep,
} from '@/lib/engine/word-study'

const WORDS_PER_SESSION = 5
const MAX_WORD_RETRIES = 2

type Phase = 'select' | 'study' | 'done'

function initialUrlState(): { sessionId: string | null; wordIds: string[] } {
  if (typeof window === 'undefined') return { sessionId: null, wordIds: [] }
  const params = new URLSearchParams(window.location.search)
  return {
    sessionId: params.get('session'),
    wordIds: (params.get('ids') ?? '').split(',').filter(Boolean).slice(0, WORDS_PER_SESSION),
  }
}

function oneAttemptWordSteps(steps: WordStudyStep[]): WordStudyStep[] {
  return steps.map((step) => step.kind === 'exercise'
    ? { ...step, ex: { ...step.ex, attemptsAllowed: 1 } }
    : step)
}

function wordCyclePrefix(sessionId: string, wordId: string, round: number): string {
  return round === 0 ? `${sessionId}:` : `${sessionId}:retry:${round}:${wordId}:`
}

function buildWordCycle(word: Lexeme, pool: Lexeme[], prefix: string): WordStudyStep[] {
  return oneAttemptWordSteps(buildWordStudySteps([word], pool, prefix))
}

export default function WordsPage() {
  const state = useAppState()
  const [words, setWords] = useState<Lexeme[] | null>(null)
  // URL is read after hydration. Reading window during the first render made
  // the server render 0/5 while the client immediately rendered 5/5.
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('select')
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState(0)
  const [canAdvance, setCanAdvance] = useState(false)
  const [dayNumber, setDayNumber] = useState(1)
  const startedAt = useRef(Date.now())
  const finalizing = useRef(new Set<string>())
  const restorePositionInitialized = useRef(false)
  const studyMainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const initial = initialUrlState()
    setSelectedIds(initial.wordIds)
    setSessionId(initial.sessionId)
    setPhase(initial.sessionId ? 'study' : 'select')
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all([loadVocabulary(), loadCurriculum()]).then(([vocabulary, curriculum]) => {
      if (!alive) return
      setWords([...vocabulary.values()])
      void currentDayNumber(curriculum.stats.totalDays).then((day) => {
        if (alive) setDayNumber(day)
      })
    })
    return () => { alive = false }
  }, [])

  const selectedWords = useMemo(() => {
    if (!words) return []
    const byId = new Map(words.map((word) => [word.id, word]))
    return selectedIds.map((id) => byId.get(id)).filter(Boolean) as Lexeme[]
  }, [selectedIds, words])

  const baseStudySteps = useMemo(() => (
    sessionId && selectedWords.length === WORDS_PER_SESSION && words
      ? oneAttemptWordSteps(buildWordStudySteps(selectedWords, words, `${sessionId}:`))
      : []
  ), [selectedWords, sessionId, words])

  const resultByExercise = useMemo(() => new Map(
    (state?.exerciseResults ?? [])
      .filter((result) => result.dayNumber === dayNumber)
      .map((result) => [result.exerciseId, result]),
  ), [dayNumber, state?.exerciseResults])

  // После полного прохода ошибившееся слово возвращается в конец пакета.
  // Две дополнительные попытки — последняя ошибка окончательно снимает
  // слово с изучения и не создаёт ему карточки FSRS.
  const retryStudySteps = useMemo(() => {
    if (!sessionId || !words || selectedWords.length !== WORDS_PER_SESSION) return []
    const retries: WordStudyStep[] = []
    for (let round = 1; round <= MAX_WORD_RETRIES; round += 1) {
      for (const word of selectedWords) {
        const previous = buildWordCycle(
          word,
          words,
          wordCyclePrefix(sessionId, word.id, round - 1),
        )
        const previousIds = previous
          .filter((step): step is Extract<WordStudyStep, { kind: 'exercise' }> => step.kind === 'exercise')
          .map((step) => step.ex.id)
        const previousResults = previousIds.map((id) => resultByExercise.get(id))
        if (previousResults.some((result) => !result) || previousResults.every((result) => result?.correct)) {
          continue
        }
        retries.push(...buildWordCycle(
          word,
          words,
          wordCyclePrefix(sessionId, word.id, round),
        ))
      }
    }
    return retries.flat()
  }, [resultByExercise, selectedWords, sessionId, words])

  const studySteps = useMemo(
    () => [...baseStudySteps, ...retryStudySteps],
    [baseStudySteps, retryStudySteps],
  )

  const finalizedWordIds = useMemo(() => new Set(
    (state?.sessions ?? [])
      .filter((session) => (
        (session.kind === 'words' || session.kind === 'words-failed')
        && session.id.startsWith(`${sessionId}:word:`)
      ))
      .map((session) => session.id.slice(`${sessionId}:word:`.length)),
  ), [sessionId, state?.sessions])

  const failedWordIds = useMemo(() => new Set(
    (state?.sessions ?? [])
      .filter((session) => (
        session.kind === 'words-failed' && session.id.startsWith(`${sessionId}:word:`)
      ))
      .map((session) => session.id.slice(`${sessionId}:word:`.length)),
  ), [sessionId, state?.sessions])

  // После reload автоматически пропускаем уже сохранённые этапы.
  useEffect(() => {
    if (phase !== 'study' || !state || !studySteps.length || restorePositionInitialized.current) return
    restorePositionInitialized.current = true
    let next = 0
    while (next < studySteps.length) {
      const step = studySteps[next]!
      if (step.kind === 'word-intro') {
        const firstExercise = studySteps[next + 1]
        if (firstExercise?.kind === 'exercise' && resultByExercise.has(firstExercise.ex.id)) {
          next += 2
          continue
        }
        break
      }
      if (!resultByExercise.has(step.ex.id)) break
      next += 1
    }
    if (next >= studySteps.length) {
      setPhase('done')
      return
    }
    const nextStep = studySteps[next]
    setCurrent(next)
    setCanAdvance(Boolean(
      nextStep?.kind === 'exercise'
      && resultByExercise.has(nextStep.ex.id),
    ))
  }, [phase, resultByExercise, state, studySteps])

  // Состояние может прийти после первого прохода эффекта восстановления.
  // Если текущий ответ уже есть на сервере, результат нельзя оставлять
  // без перехода: пользователь должен продолжить одним кликом.
  useEffect(() => {
    if (phase !== 'study') return
    const currentStep = studySteps[current]
    if (!currentStep) return
    if (currentStep.kind === 'word-intro') {
      setCanAdvance(false)
    } else if (resultByExercise.has(currentStep.ex.id)) {
      setCanAdvance(true)
    }
  }, [current, phase, resultByExercise, studySteps])

  useEffect(() => {
    if (phase === 'study' && canAdvance) studyMainRef.current?.focus()
  }, [canAdvance, phase])

  // Завершение слова — единственная точка, где оно попадает в FSRS.
  useEffect(() => {
    if (!sessionId || !studySteps.length) return
    for (const word of selectedWords) {
      if (finalizedWordIds.has(word.id) || finalizing.current.has(word.id)) continue

      const completed: NonNullable<ReturnType<typeof resultByExercise.get>>[] = []
      let learned = false
      let finished = false
      for (let round = 0; round <= MAX_WORD_RETRIES; round += 1) {
        const cycle = buildWordCycle(
          word,
          words ?? [],
          wordCyclePrefix(sessionId, word.id, round),
        )
        const ids = cycle
          .filter((step): step is Extract<WordStudyStep, { kind: 'exercise' }> => step.kind === 'exercise')
          .map((step) => step.ex.id)
        const rows = ids.map((id) => resultByExercise.get(id))
        if (rows.some((row) => !row)) break
        const cycleResults = rows.filter(Boolean) as NonNullable<typeof rows[number]>[]
        completed.push(...cycleResults)
        if (cycleResults.every((row) => row.correct)) {
          learned = true
          finished = true
          break
        }
        if (round === MAX_WORD_RETRIES) finished = true
      }
      if (!finished || !completed.length) continue

      const allCorrect = learned && completed.every((row) => row.correct && row.attempts === 1)
      finalizing.current.add(word.id)
      void finalizeWord({
        word,
        learned,
        allCorrect,
        correctCount: completed.filter((row) => row.correct).length,
        itemsReviewed: completed.length,
        sessionId,
        dayNumber,
        startedAt: startedAt.current,
      })
    }
  }, [dayNumber, finalizedWordIds, resultByExercise, selectedWords, sessionId, studySteps, words])

  const filteredWords = useMemo(() => {
    if (!words) return []
    const q = query.trim().toLowerCase()
    return words.filter((word) => (
      !q || word.lemma.toLowerCase().includes(q) || word.translation.toLowerCase().includes(q)
    )).slice(0, 80)
  }, [query, words])

  const step = studySteps[current]
  const restoredRow = step?.kind === 'exercise' ? resultByExercise.get(step.ex.id) : undefined
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  function toggleWord(id: string) {
    setSelectedIds((currentIds) => {
      if (currentIds.includes(id)) return currentIds.filter((currentId) => currentId !== id)
      if (currentIds.length >= WORDS_PER_SESSION) return currentIds
      return [...currentIds, id]
    })
  }

  function startSession() {
    if (selectedIds.length !== WORDS_PER_SESSION) return
    const nextSessionId = crypto.randomUUID()
    const params = new URLSearchParams({
      session: nextSessionId,
      ids: selectedIds.join(','),
    })
    window.history.replaceState(null, '', `/words?${params.toString()}`)
    setSessionId(nextSessionId)
    setCurrent(0)
    setCanAdvance(false)
    restorePositionInitialized.current = true
    startedAt.current = Date.now()
    setPhase('study')
  }

  function nextStep() {
    setCanAdvance(false)
    if (current + 1 < studySteps.length) {
      setCurrent((value) => value + 1)
    } else {
      setPhase('done')
    }
  }

  function onAnswered(ex: Exercise, result: CheckResult, ms: number, attempts: number, answer: string) {
    // Результат уже показан на экране: следующий клик нельзя блокировать
    // ожиданием сети или БД. Сохранение оптимистично обновляет снапшот и
    // выполняется в фоне, чтобы пользователь не попадал в «лимб».
    setCanAdvance(true)
    void saveExerciseResult({
      dayNumber,
      exerciseId: ex.id,
      attempts,
      correct: result.correct,
      answer,
      expected: result.expected,
      errorKind: result.errorKind ?? null,
    })
    void ms
  }

  function chooseAnotherSet() {
    window.history.replaceState(null, '', '/words')
    setSessionId(null)
    setSelectedIds([])
    setCurrent(0)
    setCanAdvance(false)
    restorePositionInitialized.current = false
    setPhase('select')
    finalizing.current.clear()
  }

  if (phase === 'study' && step) {
    return (
      <Screen>
        <header className="mx-auto w-full max-w-2xl px-4 py-3">
          <Row justify="between">
            <button type="button" onClick={chooseAnotherSet} className="text-sm text-muted hover:text-ink">
              ← Выбор слов
            </button>
            <Row gap="sm">
              <span className="text-sm text-muted tabular-nums">{current + 1} / {studySteps.length}</span>
              <ThemePicker />
            </Row>
          </Row>
          <div className="mt-2 h-1 overflow-hidden rounded-pill bg-soft">
            <div className="h-full bg-primary" style={{ width: `${((current + 1) / studySteps.length) * 100}%` }} />
          </div>
        </header>
        <main
          ref={studyMainRef}
          tabIndex={-1}
          className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 cursor-pointer flex-col overflow-y-auto px-4 pb-4"
          onClick={() => {
            if (canAdvance) nextStep()
          }}
          onKeyDown={(event) => {
            if (!canAdvance || event.repeat || (event.key !== 'Enter' && event.code !== 'Space')) return
            event.preventDefault()
            nextStep()
          }}
        >
          <Stack gap="md">
            {step.kind === 'word-intro' ? (
              <WordStudyCard word={step.word} onNext={nextStep} />
            ) : (
              <ExerciseView
                key={step.ex.id}
                exercise={step.ex}
                restoredResult={restoredRow ? {
                  result: {
                    correct: restoredRow.correct,
                    expected: restoredRow.expected,
                    errorKind: restoredRow.errorKind ?? undefined,
                  },
                  answer: restoredRow.answer,
                  attempts: restoredRow.attempts,
                } : null}
                onAnswered={(result, ms, attempts, answer) => (
                  void onAnswered(step.ex, result, ms, attempts, answer)
                )}
              />
            )}
          </Stack>
        </main>
      </Screen>
    )
  }

  if (phase === 'done') {
    return (
      <Screen>
        <header className="mx-auto w-full max-w-2xl px-4 py-3">
          <Row justify="between">
            <Link href="/dictionary" className="text-sm text-muted hover:text-ink">← Словарь</Link>
            <ThemePicker />
          </Row>
        </header>
        <main className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 pb-4">
          <Card className="w-full">
            <Stack gap="md" align="center">
              <span className="text-4xl text-ok-ink" aria-hidden>✓</span>
              <h1 className="text-xl font-semibold">
                {failedWordIds.size
                  ? `${failedWordIds.size} ${failedWordIds.size === 1 ? 'слово' : 'слова'} не выучено`
                  : 'Слова добавлены в повторение'}
              </h1>
              <p className="text-center text-sm text-muted">
                {failedWordIds.size
                  ? 'Эти слова не добавлены в повторение. Их можно выбрать снова позже.'
                  : 'Каждое слово прошло пять этапов. Следующее повторение рассчитано по FSRS.'}
              </p>
              <Button size="lg" full onClick={chooseAnotherSet}>Выбрать ещё 5 слов</Button>
              <Link href="/dictionary" className="text-sm text-muted hover:text-ink">Открыть словарь</Link>
            </Stack>
          </Card>
        </main>
        <Nav />
      </Screen>
    )
  }

  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <Row justify="between">
          <div>
            <h1 className="text-lg font-semibold">Учить слова</h1>
            <p className="text-sm text-muted">Выберите ровно 5 слов из словаря</p>
          </div>
          <ThemePicker />
        </Row>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по слову или переводу"
          aria-label="Поиск слов"
          className="mt-3 min-h-12 w-full rounded-card border border-line bg-card px-3 text-base text-ink"
        />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-4">
        <Stack gap="md">
          <Card>
            <Stack gap="sm">
              <Row justify="between">
                <span className="text-sm font-medium">Выбрано</span>
                <span className="text-sm tabular-nums text-muted">{selectedIds.length} / {WORDS_PER_SESSION}</span>
              </Row>
              {selectedWords.length > 0 && (
                <Row gap="xs" wrap>
                  {selectedWords.map((word) => (
                    <button
                      key={word.id}
                      type="button"
                      onClick={() => toggleWord(word.id)}
                      className="rounded-pill bg-soft px-2.5 py-1 text-sm text-ink hover:bg-soft2"
                    >
                      {word.lemma} ×
                    </button>
                  ))}
                </Row>
              )}
              <Button size="lg" full disabled={selectedIds.length !== WORDS_PER_SESSION} onClick={startSession}>
                Начать изучение
              </Button>
            </Stack>
          </Card>

          {!words && <Card><p className="text-sm text-muted">Загрузка словаря…</p></Card>}
          {words && filteredWords.length === 0 && <Card><p className="text-sm text-muted">Ничего не найдено</p></Card>}
          {filteredWords.length > 0 && (
            <Card>
              <Stack gap="xs">
                {filteredWords.map((word) => {
                  const selected = selectedSet.has(word.id)
                  const disabled = !selected && selectedIds.length >= WORDS_PER_SESSION
                  return (
                    <button
                      key={word.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={disabled}
                      onClick={() => toggleWord(word.id)}
                      className={`flex min-h-14 w-full items-center justify-between rounded-card border px-3 py-2 text-left transition-colors ${
                        selected
                          ? 'border-primary bg-soft'
                          : 'border-line bg-card hover:bg-soft disabled:opacity-45'
                      }`}
                    >
                      <span>
                        <span className="block font-medium" lang="pl">{word.lemma}</span>
                        <span className="block text-sm text-muted">{word.translation}</span>
                      </span>
                      <span className="text-lg text-muted" aria-hidden>{selected ? '✓' : '+'}</span>
                    </button>
                  )
                })}
              </Stack>
            </Card>
          )}
        </Stack>
      </main>
      <Nav />
    </Screen>
  )
}

function WordStudyCard({ word, onNext }: { word: Lexeme; onNext: () => void }) {
  return (
    <Card>
      <Stack gap="lg" align="center">
        <span className="text-xs tracking-wide text-muted uppercase">Karta słowa</span>
        <div className="text-center text-3xl font-semibold" lang="pl">{word.lemma}</div>
        <SpeakIcon text={word.lemma} />
        <div className="text-center text-lg">{word.translation}</div>
        <Button size="lg" full onClick={onNext}>Znam słowo</Button>
      </Stack>
    </Card>
  )
}

async function finalizeWord({
  word, learned, allCorrect, correctCount, itemsReviewed, sessionId, dayNumber, startedAt,
}: {
  word: Lexeme
  learned: boolean
  allCorrect: boolean
  correctCount: number
  itemsReviewed: number
  sessionId: string
  dayNumber: number
  startedAt: number
}) {
  if (learned) {
    await completeLexemeLearning(word.id, allCorrect)
  } else {
    await setLexemeKnown(word.id, false)
  }
  await saveLessonSession({
    id: `${sessionId}:word:${word.id}`,
    dayNumber,
    kind: learned ? 'words' : 'words-failed',
    startedAt: new Date(startedAt),
    completedAt: new Date(),
    plannedBudgetMs: itemsReviewed * 20_000,
    actualMs: Date.now() - startedAt,
    itemsReviewed,
    itemsCorrect: correctCount,
  })
}
