'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Card, OptionRow, Row, Stack } from '@polski/ui'
import { check, type CheckResult, type Exercise } from '@polski/engine'
import { usePronounce } from '@/lib/speech/usePronounce'
import { useAppState } from '@/lib/data/store'

export function SpeakIcon({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  const { pronounce, message } = usePronounce()
  const cls = size === 'sm' ? 'size-9 text-base' : 'size-12 text-xl'
  return (
    <button
      type="button"
      aria-label={`Wymów ${text}`}
      title={message ?? undefined}
      onClick={() => pronounce(text)}
      className={`flex shrink-0 items-center justify-center rounded-pill bg-soft hover:bg-soft2 ${cls}`}
    >
      {message ? '🔇' : '🔊'}
    </button>
  )
}

const GAP_MARK = '␣␣␣'
const DEFAULT_ATTEMPTS = 3

type InlineExercise = Extract<Exercise, { mode: 'choice' | 'typed' }>
type ControlStatus = 'empty' | 'correct' | 'wrong'

function baseFormOf(exercise: InlineExercise): string | undefined {
  return 'baseForm' in exercise ? exercise.baseForm : undefined
}

function hintForExercise(exercise: InlineExercise): string | undefined {
  const answer = 'answer' in exercise ? exercise.answer : exercise.accepted[0]
  const firstLetter = answer?.trim().slice(0, 1)
  return firstLetter ? `Pierwsza litera odpowiedzi: ${firstLetter}` : undefined
}

function HintButton({ hint }: { hint: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative shrink-0">
      <button
        type="button"
        aria-label="Pokaż podpowiedź"
        aria-expanded={visible}
        title="Pokaż podpowiedź"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => setVisible((current) => !current)}
        className="flex size-6 items-center justify-center rounded-pill bg-soft2 text-xs font-semibold text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        ?
      </button>
      {visible && (
        <span
          role="status"
          className="pointer-events-none absolute right-0 top-full z-10 mt-1 w-max max-w-56 rounded-card border border-line bg-card px-2 py-1 text-xs font-normal text-muted shadow-card"
        >
          {hint}
        </span>
      )}
    </span>
  )
}

function InlineFormControl({
  baseForm, mode, options, value, disabled, autoFocus, status, hint,
  attemptsAllowed, wrongCount, result, onChange, onSubmit,
}: {
  baseForm: string
  mode: 'choice' | 'typed'
  options?: string[]
  value: string
  disabled: boolean
  autoFocus?: boolean
  status: ControlStatus
  hint?: string
  attemptsAllowed: number
  wrongCount: number
  result: CheckResult | null
  onChange: (value: string) => void
  onSubmit: (value: string) => void
}) {
  const statusClass = status === 'correct'
    ? 'border-ok bg-ok-bg'
    : status === 'wrong'
      ? 'border-danger bg-danger-bg'
      : 'border-line bg-soft'
  const [focused, setFocused] = useState(false)
  const focusClass = status === 'empty' ? 'focus-within:border-muted focus-within:bg-card' : ''
  const textClass = 'text-ink placeholder:text-muted selection:bg-line selection:text-ink'
  const stateLabel = status === 'correct'
    ? ', odpowiedź poprawna'
    : status === 'wrong'
      ? ', odpowiedź niepoprawna'
      : ''

  const common = {
    'aria-label': `Forma słowa ${baseForm}${stateLabel}`,
    'aria-invalid': status === 'wrong' ? true : undefined,
    disabled,
    className: `inline-form-control min-h-9 min-w-24 border-0 bg-transparent px-1 text-left text-lg font-semibold shadow-none outline-none ring-0 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:opacity-100 ${textClass}`,
    lang: 'pl',
  } as const

  return (
    <span className={`mx-1 inline-flex max-w-full items-center gap-1 overflow-visible rounded-card border-2 px-2 py-1 align-baseline ${statusClass} ${focusClass}`}>
      <span className="shrink-0 text-sm font-medium text-muted" lang="pl">{baseForm}</span>
      <span className="text-muted" aria-hidden>→</span>
      {mode === 'choice' ? (
        <select
          {...common}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const next = e.target.value
            onChange(next)
            if (next) onSubmit(next)
          }}
        >
          <option value="">Wybierz…</option>
          {options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input
          {...common}
          autoFocus={autoFocus}
          value={value}
          placeholder="wpisz formę"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onFocus={() => setFocused(true)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            setFocused(false)
            if (value.trim()) onSubmit(value)
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(value) }}
        />
      )}
      <AttemptDots
        attemptsAllowed={attemptsAllowed}
        wrongCount={wrongCount}
        result={result}
        focused={focused}
      />
      {hint && !result && (
        <HintButton hint={hint} />
      )}
    </span>
  )
}

function AttemptDots({
  attemptsAllowed, wrongCount, result, focused,
}: {
  attemptsAllowed: number
  wrongCount: number
  result: CheckResult | null
  focused: boolean
}) {
  const remaining = Math.max(0, attemptsAllowed - wrongCount)
  return (
    <span
      className="flex shrink-0 flex-col-reverse items-center gap-1 pl-1"
      aria-label={`Pozostało prób: ${remaining}`}
      title={`Pozostało prób: ${remaining}`}
    >
      {Array.from({ length: attemptsAllowed }, (_, index) => {
        const className = index < wrongCount
          ? 'bg-danger'
          : result && index === wrongCount
            ? result.correct ? 'bg-ok' : 'bg-danger'
            : focused && !result && index === wrongCount
              ? 'bg-muted ring-2 ring-muted/30'
            : 'bg-line'
        return <span key={index} className={`size-1.5 rounded-full ${className}`} />
      })}
    </span>
  )
}

function InlineSentencePrompt({
  exercise, value, disabled, status, attemptsAllowed, wrongCount, result, autoFocus, onChange, onSubmit,
}: {
  exercise: InlineExercise
  value: string
  disabled: boolean
  status: ControlStatus
  attemptsAllowed: number
  wrongCount: number
  result: CheckResult | null
  autoFocus?: boolean
  onChange: (value: string) => void
  onSubmit: (value: string) => void
}) {
  const baseForm = baseFormOf(exercise)
  if (!baseForm) return <>{exercise.prompt}</>

  const [before, after = ''] = exercise.prompt.split(GAP_MARK)
  return (
    <>
      {before}
      <InlineFormControl
        baseForm={baseForm}
        mode={exercise.mode}
        options={exercise.mode === 'choice' ? exercise.options : undefined}
        value={value}
        disabled={disabled}
        status={status}
        attemptsAllowed={attemptsAllowed}
        wrongCount={wrongCount}
        result={result}
        autoFocus={autoFocus}
        hint={hintForExercise(exercise)}
        onChange={onChange}
        onSubmit={onSubmit}
      />
      {after}
    </>
  )
}

function InlineWordPrompt({
  exercise, value, disabled, status, attemptsAllowed, wrongCount, result, autoFocus, onChange, onSubmit,
}: {
  exercise: InlineExercise
  value: string
  disabled: boolean
  status: ControlStatus
  attemptsAllowed: number
  wrongCount: number
  result: CheckResult | null
  autoFocus?: boolean
  onChange: (value: string) => void
  onSubmit: (value: string) => void
}) {
  const baseForm = baseFormOf(exercise)
  if (!baseForm) return <>{exercise.prompt}</>

  return (
    <InlineFormControl
      baseForm={baseForm}
      mode={exercise.mode}
      options={exercise.mode === 'choice' ? exercise.options : undefined}
      value={value}
      disabled={disabled}
      status={status}
      attemptsAllowed={attemptsAllowed}
      wrongCount={wrongCount}
      result={result}
      autoFocus={autoFocus}
      hint={hintForExercise(exercise)}
      onChange={onChange}
      onSubmit={onSubmit}
    />
  )
}

/**
 * Один рендерер на все типы упражнений.
 * R13: компонент обязан получать key от родителя, иначе стейт
 * предыдущего упражнения переживёт смену задания.
 */
export function ExerciseView({
  exercise, onAnswered, bare = false, showReadingText = true, autoFocus = true,
  showInstruction = true, leadingNumber, restoredResult,
}: {
  exercise: Exercise
  onAnswered: (r: CheckResult, ms: number, attempts: number, answer: string) => void
  /** Рендерит содержимое без собственной карточки — для составных блоков. */
  bare?: boolean
  /** Текст чтения можно вынести во внешний стабильный контейнер. */
  showReadingText?: boolean
  /** Автофокус только для первого поля в пакетном задании. */
  autoFocus?: boolean
  /** Показывать инструкцию над конкретным упражнением. */
  showInstruction?: boolean
  /** Номер строки, который отображается перед предложением. */
  leadingNumber?: number
  /** Результат упражнения, восстановленный из серверной истории. */
  restoredResult?: { result: CheckResult; answer: string; attempts: number } | null
}) {
  const [result, setResult] = useState<CheckResult | null>(null)
  const [typed, setTyped] = useState('')
  const [built, setBuilt] = useState<string[]>([])
  const [wrongTries, setWrongTries] = useState<string[]>([])
  const started = useRef(Date.now())
  const lastCheckedValue = useRef<string | null>(null)

  useEffect(() => {
    if (!restoredResult) return
    setResult(restoredResult.result)
    setTyped(restoredResult.answer)
    setWrongTries(Array.from({
      length: Math.max(0, restoredResult.attempts - (restoredResult.result.correct ? 1 : 0)),
    }, () => ''))
  }, [exercise.id, restoredResult])

  const attemptsAllowed = exercise.attemptsAllowed ?? DEFAULT_ATTEMPTS

  const isGapSentence =
    exercise.kind === 'sentence-choice' || exercise.kind === 'sentence-typed'
  const isReading = exercise.kind === 'reading-choice'
  const isSentence = isGapSentence || exercise.kind === 'sentence-write'
  const baseForm = exercise.mode === 'assemble' ? undefined : baseFormOf(exercise)
  const isInlineForm = Boolean(baseForm) && exercise.kind !== 'sentence-write'
  const inlineStatus: ControlStatus = result
    ? result.correct ? 'correct' : 'wrong'
    : wrongTries.includes(typed) && typed ? 'wrong' : 'empty'
  const isPolishPrompt = !isGapSentence
    && !isReading
    && exercise.kind !== 'translate-production' && exercise.kind !== 'spelling'

  function updateTyped(value: string) {
    lastCheckedValue.current = null
    setTyped(value)
  }

  function submit(answer: string) {
    if (result) return
    const normalized = answer.trim()
    if (!normalized || lastCheckedValue.current === normalized) return
    lastCheckedValue.current = normalized
    const r = check(exercise, answer)
    if (!r.correct && wrongTries.length + 1 < attemptsAllowed) {
      setWrongTries((w) => [...w, answer])
      if (exercise.mode === 'typed' && !isInlineForm) setTyped('')
      if (exercise.mode === 'assemble') setBuilt([])
      return
    }
    const nextWrongTries = r.correct ? wrongTries : [...wrongTries, answer]
    if (!r.correct) setWrongTries(nextWrongTries)
    setResult(r)
    onAnswered(
      r,
      Date.now() - started.current,
      nextWrongTries.length + (r.correct ? 1 : 0),
      answer,
    )
  }

  // сборка по буквам: как только набрана нужная длина — проверяем
  useEffect(() => {
    if (exercise.mode !== 'assemble' || result) return
    if (built.join('').length === exercise.answer.length) submit(built.join(''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built])

  const content = (
    <Stack gap="lg" className="w-full">
        <Stack gap="sm" align="center">
          {showInstruction && (
            <span className="text-center text-xs tracking-wide text-muted uppercase">
              {exercise.instruction}
            </span>
          )}
          {showReadingText && exercise.mode === 'choice' && isReading && exercise.readingText && (
            <div className="w-full rounded-card bg-soft2 p-4" lang="pl">
              <p className="mb-2 text-xs tracking-wide text-muted uppercase">Tekst</p>
              <p className="whitespace-pre-wrap text-left text-base leading-7">
                {exercise.readingText}
              </p>
            </div>
          )}
          <Row
            gap="sm"
            justify={leadingNumber !== undefined ? 'start' : 'center'}
            align="baseline"
            className={leadingNumber !== undefined ? 'w-full' : undefined}
          >
            {leadingNumber !== undefined && (
              <span className="shrink-0 text-base font-semibold text-muted sm:text-lg">
                {leadingNumber}.
              </span>
            )}
            {/* ≥24px: иначе не различить диакритику, UX_UI.md §1.6 */}
            <span className={isReading
              ? 'whitespace-pre-wrap text-left text-base leading-7'
              : `${leadingNumber !== undefined ? 'text-left' : 'text-center'} font-semibold ${isSentence ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'}`}>
              {isInlineForm && exercise.mode !== 'assemble'
                ? isGapSentence
                  ? <InlineSentencePrompt
                      exercise={exercise}
                      value={typed}
                      disabled={Boolean(result)}
                      status={inlineStatus}
                      attemptsAllowed={attemptsAllowed}
                      wrongCount={wrongTries.length}
                      result={result}
                      autoFocus={autoFocus && exercise.mode === 'typed'}
                      onChange={updateTyped}
                      onSubmit={submit}
                    />
                  : <InlineWordPrompt
                      exercise={exercise}
                      value={typed}
                      disabled={Boolean(result)}
                      status={inlineStatus}
                      attemptsAllowed={attemptsAllowed}
                      wrongCount={wrongTries.length}
                      result={result}
                      autoFocus={autoFocus && exercise.mode === 'typed'}
                      onChange={updateTyped}
                      onSubmit={submit}
                    />
                : exercise.prompt}
            </span>
            {isPolishPrompt && <SpeakIcon text={exercise.prompt} />}
          </Row>
        </Stack>

        {exercise.mode === 'choice' && !isInlineForm && (
          <Stack gap="xs">
            {exercise.options.map((o) => (
              <OptionRow
                key={o}
                outcome={
                  result && o === exercise.answer ? 'correct'
                    : wrongTries.includes(o) ? 'wrong'
                    : 'none'
                }
                selected={false}
                disabled={Boolean(result) || wrongTries.includes(o)}
                onClick={() => submit(o)}
              >
                {o}
              </OptionRow>
            ))}
          </Stack>
        )}

        {exercise.mode === 'typed' && (
          <Stack gap="sm">
            {!isInlineForm && (
              <input
                autoFocus={autoFocus}
                value={typed}
                disabled={Boolean(result)}
                onChange={(e) => updateTyped(e.target.value)}
                onBlur={() => submit(typed)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(typed) }}
                placeholder={
                  exercise.kind === 'sentence-write' ? 'Napisz zdanie'
                    : exercise.kind === 'sentence-typed' ? 'Wpisz słowo'
                    : 'Wpisz formę'
                }
                className="min-h-12 w-full rounded-card border border-line bg-card px-3 text-center text-xl text-ink"
                lang="pl"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            )}
          </Stack>
        )}

        {exercise.mode === 'assemble' && (
          <Stack gap="md">
            <div className="min-h-12 rounded-card border border-dashed border-line px-3 py-2 text-center text-2xl tracking-widest">
              {built.join('') || ' '}
            </div>
            <Row gap="xs" wrap justify="center">
              {exercise.letters.map((l, idx) => (
                <button
                  key={`${l}-${idx}`}
                  type="button"
                  disabled={Boolean(result) || built.length > idx && false}
                  onClick={() => setBuilt((b) => [...b, l])}
                  className="size-12 rounded-card bg-soft text-xl font-medium hover:bg-soft2 disabled:opacity-40"
                >
                  {l}
                </button>
              ))}
            </Row>
            {built.length > 0 && !result && (
              <Button variant="ghost" size="sm" onClick={() => setBuilt([])}>
                Wyczyść
              </Button>
            )}
          </Stack>
        )}

        {result && !result.correct && (
          <p className="text-sm text-ok-ink">
            Poprawna odpowiedź: <strong>{result.expected}</strong>
          </p>
        )}

    </Stack>
  )

  if (bare) return content
  return <Card tone={result ? (result.correct ? 'correct' : 'wrong') : 'neutral'}>{content}</Card>
}

/**
 * Пакет грамматических предложений: все строки остаются на одной странице,
 * а завершить блок можно только после проверки каждой строки.
 */
export function GrammarExerciseBatch({
  exercises, onAnswered, onComplete, dayNumber,
}: {
  exercises: Exercise[]
  onAnswered: (exercise: Exercise, result: CheckResult, ms: number, attempts: number, answer: string) => void
  onComplete: () => void
  dayNumber: number
}) {
  const state = useAppState()
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set())
  const completionNotified = useRef(false)

  useEffect(() => {
    if (exercises.length > 0 && completedIds.size === exercises.length && !completionNotified.current) {
      completionNotified.current = true
      onComplete()
    }
  }, [completedIds, exercises.length, onComplete])

  const restored = new Map(
    (state?.exerciseResults ?? [])
      .filter((result) => result.dayNumber === dayNumber)
      .map((result) => [result.exerciseId, result]),
  )
  const groups = (['choice', 'typed'] as const)
    .map((mode) => ({
      mode,
      exercises: exercises.filter((exercise) => exercise.mode === mode),
    }))
    .filter((group) => group.exercises.length > 0)

  useEffect(() => {
    setCompletedIds(new Set(
      exercises.filter((exercise) => restored.has(exercise.id)).map((exercise) => exercise.id),
    ))
  }, [dayNumber, exercises, state?.exerciseResults])

  function handleAnswered(exercise: Exercise, result: CheckResult, ms: number, attempts: number, answer: string) {
    onAnswered(exercise, result, ms, attempts, answer)
    setCompletedIds((current) => {
      const next = new Set(current)
      next.add(exercise.id)
      return next
    })
  }

  return (
    <Stack gap="lg" className="mx-auto w-full max-w-(--container-exercise)">
      {groups.map((group, groupIndex) => {
        const offset = groups
          .slice(0, groupIndex)
          .reduce((count, previous) => count + previous.exercises.length, 0)
        return (
          <Stack key={group.mode} gap="md">
            <p className="text-left text-sm tracking-wide text-muted uppercase">
              {group.exercises[0]!.instruction}
            </p>
            {group.exercises.map((exercise, index) => (
              <div key={exercise.id} className="w-full">
                <ExerciseView
                  exercise={exercise}
                  bare
                  autoFocus={groupIndex === 0 && index === 0}
                  showInstruction={false}
                  leadingNumber={offset + index + 1}
                  restoredResult={restored.get(exercise.id) ? {
                    result: {
                      correct: restored.get(exercise.id)!.correct,
                      expected: restored.get(exercise.id)!.expected,
                      errorKind: restored.get(exercise.id)!.errorKind ?? undefined,
                    },
                    answer: restored.get(exercise.id)!.answer,
                    attempts: restored.get(exercise.id)!.attempts,
                  } : null}
                  onAnswered={(result, ms, attempts, answer) => (
                    handleAnswered(exercise, result, ms, attempts, answer)
                  )}
                />
              </div>
            ))}
          </Stack>
        )
      })}
    </Stack>
  )
}
