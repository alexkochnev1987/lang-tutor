'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button, Card, Row, Screen, Stack } from '@polski/ui'
import type { CheckResult, Exercise } from '@polski/engine'
import {
  buildTodayPlan,
  type Stage, type StageId, type Step, type TodayPlan,
} from '@/lib/engine/plan'
import { ensureLexemeCards, recordAnswer, recordRuleAttempt, Rating } from '@/lib/engine/session'
import { saveExerciseResult, saveLessonSession } from '@/lib/data/store'
import { ExerciseView, GrammarExerciseBatch, SpeakIcon } from '@/app/_components/ExerciseView'
import { RuleSheet } from '@/app/_components/RuleSheet'
import { RuleView } from '@/app/_components/RuleView'
import { Diagnostic } from '@/app/_components/Diagnostic'
import { EmptyDay } from '@/app/_components/EmptyDay'
import { KnownToggle } from '@/app/_components/WordRow'
import { ThemePicker } from '@/app/_components/ThemePicker'
import type { Lexeme } from '@/lib/content/curriculum'

type Slot =
  | { kind: 'stage-start'; stage: Stage }
  | { kind: 'step'; stage: Stage; step: Step }

const STAGE_LEAD: Record<StageId, string> = {
  words: 'Powtarzamy i poznajemy słowa. Gramatyka będzie osobnym blokiem.',
  grammar: 'Najpierw reguła, potem ćwiczenia. Regułę otworzysz przyciskiem.',
  exam: 'Zadanie w formacie egzaminacyjnym: reguły są wymieszane jak na prawdziwym arkuszu.',
}

const STAGE_TITLE_PL: Record<StageId, string> = {
  words: 'Słowa',
  grammar: 'Gramatyka',
  exam: 'Zadanie egzaminacyjne',
}

function toSlots(stages: Stage[]): Slot[] {
  return stages.flatMap((stage): Slot[] => {
    if (!stage.steps.length && !stage.missingContent) return []
    return [
      { kind: 'stage-start', stage },
      ...stage.steps.map((step): Slot => ({ kind: 'step', stage, step })),
    ]
  })
}

export default function LessonPage() {
  const [plan, setPlan] = useState<TodayPlan | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [i, setI] = useState(0)
  const [canAdvance, setCanAdvance] = useState(false)
  const [stats, setStats] = useState({ correct: 0, total: 0 })
  const [phase, setPhase] = useState<'main' | 'done'>('main')
  const [special, setSpecial] = useState<'diagnostic' | 'empty' | null>(null)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    let alive = true
    buildTodayPlan().then((p) => {
      if (!alive) return
      setPlan(p)
      const main = toSlots(p.stages)
      if (p.day.kind === 'diagnostic') {
        setSlots([])
        setSpecial('diagnostic')
      } else {
        setSlots(main)
        setSpecial(main.length ? null : 'empty')
      }
    })
    return () => { alive = false }
  }, [])

  const slot = slots[i]
  const stageSlots = slot
    ? slots.filter((s) => s.kind === 'step' && s.stage.id === slot.stage.id)
    : []
  const indexInStage = slot ? stageSlots.indexOf(slot) + 1 : 0
  const grammarExerciseSlots = slots.filter((s) => (
    s.kind === 'step' && s.stage.id === 'grammar' && s.step.kind === 'exercise'
  ))
  const grammarExerciseIndex = slot?.kind === 'step'
    && slot.stage.id === 'grammar' && slot.step.kind === 'exercise'
    ? grammarExerciseSlots.indexOf(slot) + 1
    : 0

  async function onAnswered(
    ex: Exercise, r: CheckResult, ms: number, complete = true, attempts = 1, answer = '',
  ) {
    if (complete) setCanAdvance(true)
    setStats((s) => ({ correct: s.correct + (r.correct ? 1 : 0), total: s.total + 1 }))

    if (ex.moduleId === 'grammar') {
      await saveExerciseResult({
        dayNumber: plan?.dayNumber ?? 1,
        exerciseId: ex.id,
        attempts,
        correct: r.correct,
        answer,
        expected: r.expected,
        errorKind: r.errorKind ?? null,
      })
    }

    if (ex.lexemeId) {
      await ensureLexemeCards(ex.lexemeId)
      const kind = ex.kind === 'translate-production' || ex.kind === 'spelling'
        ? 'lexeme-production' : 'lexeme-recognition'
      await recordAnswer(`${kind}:${ex.lexemeId}`, r.correct ? Rating.Good : Rating.Again, ms)
    }
    for (const ruleId of ex.grammarRuleIds) {
      await recordRuleAttempt(ruleId, r.correct, ex.difficulty)
    }
  }

  function skipWord(lexemeId: string) {
    setSlots((prev) => prev.filter((s, idx) => idx <= i
      || !(s.kind === 'step' && s.step.kind === 'exercise' && s.step.ex.lexemeId === lexemeId)))
    next()
  }

  function next() {
    setCanAdvance(false)
    if (slot?.kind === 'step' && slot.stage.id === 'grammar' && slot.step.kind === 'exercise') {
      const lastGrammarIndex = slots.reduce((last, current, index) => (
        current.kind === 'step' && current.stage.id === 'grammar' && current.step.kind === 'exercise'
          ? index
          : last
      ), -1)
      if (lastGrammarIndex + 1 < slots.length) {
        setI(lastGrammarIndex + 1)
      } else {
        void finish()
      }
      return
    }
    if (i + 1 < slots.length) { setI(i + 1); return }
    void finish()
  }

  async function afterDiagnostic() {
    if (plan) {
      await saveLessonSession({
        id: crypto.randomUUID(),
        dayNumber: plan.dayNumber,
        kind: 'day',
        startedAt: new Date(startedAt.current),
        completedAt: new Date(),
        plannedBudgetMs: plan.estimatedSec * 1000,
        actualMs: Date.now() - startedAt.current,
        itemsReviewed: 0,
        itemsCorrect: 0,
      })
    }
    const nextPlan = await buildTodayPlan()
    const nextSlots = toSlots(nextPlan.stages)
    setPlan(nextPlan)
    setSlots(nextSlots)
    setI(0)
    setCanAdvance(false)
    setStats({ correct: 0, total: 0 })
    setSpecial(nextSlots.length ? null : 'empty')
    setPhase('main')
    startedAt.current = Date.now()
  }

  async function finish() {
    if (plan) {
      await saveLessonSession({
        id: crypto.randomUUID(),
        dayNumber: plan.dayNumber,
        kind: 'day',
        startedAt: new Date(startedAt.current),
        completedAt: new Date(),
        plannedBudgetMs: plan.estimatedSec * 1000,
        actualMs: Date.now() - startedAt.current,
        itemsReviewed: stats.total,
        itemsCorrect: stats.correct,
      })
    }
    setPhase('done')
  }

  if (!plan) {
    return <Screen><Centered><p className="text-muted">Загрузка…</p></Centered></Screen>
  }

  if (phase === 'done') {
    const pct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0
    return (
      <Screen>
        <Centered>
          <Card>
            <Stack gap="md" align="center">
              <span className="text-4xl" aria-hidden>{pct >= 70 ? '✓' : '↻'}</span>
              <h1 className="text-xl font-semibold">День {plan.dayNumber} пройден</h1>
              {stats.total > 0 && (
                <p className="text-sm text-muted">
                  Верно {stats.correct} из {stats.total} · {pct}%
                </p>
              )}
              {plan.notes.map((n) => (
                <p key={n} className="text-center text-xs text-warn-ink">{n}</p>
              ))}
              <Link href="/" className="w-full">
                <Button variant="outline" size="lg" full>На главный</Button>
              </Link>
            </Stack>
          </Card>
        </Centered>
      </Screen>
    )
  }

  if (special === 'diagnostic') {
    return (
      <Screen>
        <Centered>
          <Diagnostic onDone={() => void afterDiagnostic()} />
        </Centered>
      </Screen>
    )
  }
  if (special === 'empty') {
    return (
      <Screen>
        <Centered><EmptyDay day={plan.day} onDone={() => setPhase('done')} /></Centered>
      </Screen>
    )
  }

  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <Row justify="between">
          <Link href="/" className="text-sm text-muted hover:text-ink">← Wyjdź</Link>
          <Row gap="sm">
            {slot && (
              <span className="text-sm text-muted">
                {grammarExerciseIndex ? 'Gramatyka' : STAGE_TITLE_PL[slot.stage.id]}
                {slot.kind === 'step' && (
                  <span className="tabular-nums"> · {
                    grammarExerciseIndex || indexInStage
                  } / {grammarExerciseIndex ? grammarExerciseSlots.length : stageSlots.length}</span>
                )}
              </span>
            )}
            <ThemePicker />
          </Row>
        </Row>
        <div className="mt-2 h-1 overflow-hidden rounded-pill bg-soft">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((i + 1) / Math.max(1, slots.length)) * 100}%` }}
          />
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col justify-start overflow-y-auto overscroll-contain px-4 pb-4">
        {slot?.kind === 'stage-start' && (
          <StageStart stage={slot.stage} onNext={next} />
        )}

        {slot?.kind === 'step' && slot.step.kind === 'word-intro' && (
          <WordIntro
            word={slot.step.word}
            onNext={next}
            onMarkedKnown={() => skipWord((slot.step as { word: Lexeme }).word.id)}
          />
        )}

        {slot?.kind === 'step' && slot.step.kind === 'rule-intro' && (
          <Card>
            <Stack gap="lg">
              <RuleView rule={slot.step.rule} />
              <Button size="lg" full onClick={next}>Do zadań</Button>
            </Stack>
          </Card>
        )}

        {slot?.kind === 'step' && slot.step.kind === 'exercise' && (
          <Stack gap="md">
            {slot.step.review && (
              <p className="text-center text-xs tracking-wide text-muted uppercase">
                Powtórka
              </p>
            )}
            {grammarExerciseIndex === 1 ? (
              <GrammarExerciseBatch
                key={grammarExerciseSlots.map((s) => (
                  s.kind === 'step' && s.step.kind === 'exercise' ? s.step.ex.id : s.kind
                )).join('|')}
                exercises={grammarExerciseSlots.flatMap((s) => (
                  s.kind === 'step' && s.step.kind === 'exercise' ? [s.step.ex] : []
                ))}
                dayNumber={plan.dayNumber}
                onAnswered={(ex, r, ms, attempts, answer) => void onAnswered(ex, r, ms, false, attempts, answer)}
                onComplete={() => void next()}
                onReset={() => setCanAdvance(false)}
              />
            ) : readingTextOf(slot.step.ex) ? (
              <ReadingExerciseBlock
                text={readingTextOf(slot.step.ex)!}
                exercise={slot.step.ex}
                onAnswered={(r, ms) => {
                  const step = slot.step
                  if (step.kind === 'exercise') void onAnswered(step.ex, r, ms)
                }}
              />
            ) : (
              <ExerciseView
                key={`${i}-${slot.step.ex.id}`}
                exercise={slot.step.ex}
                onAnswered={(r, ms) => {
                  const step = slot.step
                  if (step.kind === 'exercise') void onAnswered(step.ex, r, ms)
                }}
              />
            )}
            <Row gap="sm" justify="center">
              {slot.step.rule && <RuleSheet rule={slot.step.rule} />}
            </Row>
            {canAdvance && (
              <Button variant="outline" size="lg" full onClick={next}>
                {i + 1 < slots.length ? 'Dalej' : 'Zakończ'}
              </Button>
            )}
          </Stack>
        )}
      </main>
    </Screen>
  )
}

function StageStart({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const exercises = stage.steps.filter((s) => s.kind === 'exercise').length
  return (
    <Card>
      <Stack gap="md" align="center">
        <span className="text-xs tracking-wide text-muted uppercase">Blok lekcji</span>
        <h1 className="text-xl font-semibold">{STAGE_TITLE_PL[stage.id]}</h1>
        <p className="text-center text-sm text-muted">{STAGE_LEAD[stage.id]}</p>
        {exercises > 0 && (
          <p className="text-sm tabular-nums text-muted">
            {exercises} zadań · {Math.max(1, Math.round(stage.estimatedSec / 60))} min
          </p>
        )}
        {stage.missingContent && (
          <p className="rounded-card bg-warn-bg px-3 py-2 text-center text-sm text-warn-ink">
            Blok nie jest jeszcze gotowy: {stage.missingContent}
          </p>
        )}
        <Button variant="outline" size="lg" full onClick={onNext}>
            {stage.steps.length ? 'Rozpocznij blok' : 'Pomiń'}
        </Button>
      </Stack>
    </Card>
  )
}

function WordIntro({ word, onNext, onMarkedKnown }: {
  word: Lexeme
  onNext: () => void
  onMarkedKnown: () => void
}) {
  return (
    <Card>
      <Stack gap="lg" align="center">
        <span className="text-xs tracking-wide text-muted uppercase">Nowe słowo</span>
        <div className="text-center text-3xl font-semibold">{word.lemma}</div>
        <SpeakIcon text={word.lemma} />
        <div className="text-center text-lg">{word.translation}</div>

        {word.interference && (
          <p className="rounded-card bg-warn-bg px-3 py-2 text-center text-sm text-warn-ink">
            Nie „{word.interference.confusedWith}”!<br />
            „{word.interference.confusedWith}” po polsku to <strong>{word.interference.actuallyIs}</strong>.
          </p>
        )}
        {word.aspectPair?.perfective && (
          <p className="text-sm text-muted">
            aspekt dokonany: <span className="text-accent-ink">{word.aspectPair.perfective}</span>
          </p>
        )}
        {word.government && (
          <p className="text-sm text-muted">rekcja: {word.government}</p>
        )}

        <Row gap="sm" justify="center">
          <KnownToggle lexemeId={word.id} polishLabels onMarked={(known) => known && onMarkedKnown()} />
        </Row>

        <Button variant="outline" size="lg" full onClick={onNext}>Zapamiętałem</Button>
      </Stack>
    </Card>
  )
}

function readingTextOf(exercise: Exercise): string | null {
  return exercise.mode === 'choice' && exercise.kind === 'reading-choice'
    ? exercise.readingText ?? null
    : null
}

function ReadingExerciseBlock({
  text, exercise, onAnswered,
}: {
  text: string
  exercise: Exercise
  onAnswered: (r: CheckResult, ms: number) => void
}) {
  return (
    <Card>
      <Stack gap="lg">
        <section className="w-full rounded-card bg-soft2 p-4" lang="pl">
          <p className="mb-2 text-xs tracking-wide text-muted uppercase">Tekst</p>
          <p className="whitespace-pre-wrap text-left text-base leading-7">{text}</p>
        </section>
        <ExerciseView
          key={exercise.id}
          exercise={exercise}
          bare
          showReadingText={false}
          onAnswered={onAnswered}
        />
      </Stack>
    </Card>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4">
      {children}
    </div>
  )
}
