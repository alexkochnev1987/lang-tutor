'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Card, OptionRow, Row, Stack } from '@polski/ui'
import { check, type CheckResult, type Exercise } from '@polski/engine'
import { NoVoiceForLanguage, speak, warmUpSpeech } from '@/lib/speech/tts'

let warmed = false

export function SpeakIcon({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  const [err, setErr] = useState(false)
  const cls = size === 'sm' ? 'size-9 text-base' : 'size-12 text-xl'
  return (
    <button
      type="button"
      aria-label={`Произнести ${text}`}
      onClick={async () => {
        if (!warmed) { warmUpSpeech(); warmed = true }
        try { await speak(text, { lang: 'pl-PL' }) }
        catch (e) { setErr(e instanceof NoVoiceForLanguage) }
      }}
      className={`flex shrink-0 items-center justify-center rounded-pill bg-soft hover:bg-soft2 ${cls}`}
    >
      {err ? '🔇' : '🔊'}
    </button>
  )
}

const ERROR_HINT: Record<NonNullable<CheckResult['errorKind']>, string> = {
  diacritic: 'Форма верная, но потеряна диакритика — на экзамене это ошибка',
  typo: 'Опечатка',
  'wrong-form': 'Не та форма',
  'wrong-word': 'Не то слово',
}

/**
 * Один рендерер на все типы упражнений.
 * R13: компонент обязан получать key от родителя, иначе стейт
 * предыдущего упражнения переживёт смену задания.
 */
export function ExerciseView({
  exercise, onAnswered,
}: {
  exercise: Exercise
  onAnswered: (r: CheckResult, ms: number) => void
}) {
  const [result, setResult] = useState<CheckResult | null>(null)
  const [typed, setTyped] = useState('')
  const [built, setBuilt] = useState<string[]>([])
  const started = useRef(Date.now())

  const isPolishPrompt =
    exercise.kind !== 'translate-production' && exercise.kind !== 'spelling'

  function submit(answer: string) {
    if (result) return
    const r = check(exercise, answer)
    setResult(r)
    onAnswered(r, Date.now() - started.current)
  }

  // сборка по буквам: как только набрана нужная длина — проверяем
  useEffect(() => {
    if (exercise.mode !== 'assemble' || result) return
    if (built.join('').length === exercise.answer.length) submit(built.join(''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built])

  return (
    <Card tone={result ? (result.correct ? 'correct' : 'wrong') : 'neutral'}>
      <Stack gap="lg">
        <Stack gap="sm" align="center">
          <span className="text-center text-xs tracking-wide text-muted uppercase">
            {exercise.instruction}
          </span>
          <Row gap="sm" justify="center">
            {/* ≥24px: иначе не различить диакритику, UX_UI.md §1.6 */}
            <span className="text-center text-2xl font-semibold sm:text-3xl">
              {exercise.prompt}
            </span>
            {isPolishPrompt && <SpeakIcon text={exercise.prompt} />}
          </Row>
        </Stack>

        {exercise.mode === 'choice' && (
          <Stack gap="xs">
            {exercise.options.map((o) => (
              <OptionRow
                key={o}
                outcome={
                  !result ? 'none'
                    : o === exercise.answer ? 'correct'
                    : 'none'
                }
                selected={false}
                disabled={Boolean(result)}
                onClick={() => submit(o)}
              >
                {o}
              </OptionRow>
            ))}
          </Stack>
        )}

        {exercise.mode === 'typed' && (
          <Stack gap="sm">
            <input
              autoFocus
              value={typed}
              disabled={Boolean(result)}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(typed) }}
              placeholder="Введите форму"
              className="min-h-12 w-full rounded-card border border-line bg-card px-3 text-center text-xl text-ink"
              lang="pl"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {!result && (
              <Button size="lg" full onClick={() => submit(typed)} disabled={!typed.trim()}>
                Проверить
              </Button>
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
                Сбросить
              </Button>
            )}
          </Stack>
        )}

        {result && (
          <Stack gap="sm">
            {!result.correct && (
              <Stack gap="xs">
                <p className="text-sm text-danger-ink">
                  Правильно: <strong>{result.expected}</strong>
                </p>
                {result.errorKind && (
                  <p className="text-xs text-muted">{ERROR_HINT[result.errorKind]}</p>
                )}
              </Stack>
            )}
            {'explanation' in exercise && exercise.explanation && (
              <p className="text-sm text-accent-ink">{exercise.explanation}</p>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}
