'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Button, Card, Row, Screen, Stack } from '@polski/ui'
import type { CheckResult, Exercise } from '@polski/engine'
import {
  buildAnalysisSteps, buildTodayPlan, STAGE_TITLE,
  type Mistake, type Stage, type StageId, type Step, type TodayPlan,
} from '@/lib/engine/plan'
import { ensureLexemeCards, recordAnswer, recordRuleAttempt, Rating } from '@/lib/engine/session'
import { saveLessonSession } from '@/lib/data/store'
import { ExerciseView, SpeakIcon } from '@/app/_components/ExerciseView'
import { RuleSheet } from '@/app/_components/RuleSheet'
import { RuleView } from '@/app/_components/RuleView'
import { Diagnostic } from '@/app/_components/Diagnostic'
import { EmptyDay } from '@/app/_components/EmptyDay'
import { KnownToggle } from '@/app/_components/WordRow'
import type { Lexeme } from '@/lib/content/curriculum'

type Slot =
  | { kind: 'stage-start'; stage: Stage }
  | { kind: 'step'; stage: Stage; step: Step }

const STAGE_LEAD: Record<StageId, string> = {
  words: 'Повторяем и вводим слова. Грамматика будет отдельным блоком.',
  grammar: 'Сначала правило, потом задания на него. Правило доступно по кнопке.',
  exam: 'Задание в формате экзамена: правила вперемешку, как на настоящем листе.',
  analysis: 'Возвращаемся к тому, где ошиблись.',
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
  const [phase, setPhase] = useState<'main' | 'analysis' | 'done'>('main')
  const [special, setSpecial] = useState<'diagnostic' | 'empty' | null>(null)
  const mistakes = useRef<Mistake[]>([])
  const startedAt = useRef(Date.now())

  useEffect(() => {
    let alive = true
    buildTodayPlan().then((p) => {
      if (!alive) return
      setPlan(p)
      const main = toSlots(p.stages.filter((s) => s.id !== 'analysis'))
      setSlots(main)
      if (!main.length) setSpecial(p.day.kind === 'diagnostic' ? 'diagnostic' : 'empty')
    })
    return () => { alive = false }
  }, [])

  const analysisStage = useMemo(
    () => plan?.stages.find((s) => s.id === 'analysis') ?? null, [plan])

  const slot = slots[i]
  const stageSlots = slot
    ? slots.filter((s) => s.kind === 'step' && s.stage.id === slot.stage.id)
    : []
  const indexInStage = slot ? stageSlots.indexOf(slot) + 1 : 0

  async function onAnswered(step: Step, ex: Exercise, r: CheckResult, ms: number) {
    setCanAdvance(true)
    setStats((s) => ({ correct: s.correct + (r.correct ? 1 : 0), total: s.total + 1 }))

    if (!r.correct && phase === 'main') {
      const rule = step.kind === 'exercise' ? step.rule : null
      mistakes.current = [...mistakes.current, { ex, result: r, rule }]
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
    if (i + 1 < slots.length) { setI(i + 1); return }
    if (phase === 'main' && analysisStage && mistakes.current.length) {
      const steps = buildAnalysisSteps(mistakes.current)
      const stage: Stage = { ...analysisStage, steps }
      setPhase('analysis')
      setSlots(toSlots([stage]))
      setI(0)
      return
    }
    void finish()
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
                <Button size="lg" full>На главный</Button>
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
          <Diagnostic day={plan.dayNumber} onDone={() => setPhase('done')} />
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
          <Link href="/" className="text-sm text-muted hover:text-ink">← Выйти</Link>
          {slot && (
            <span className="text-sm text-muted">
              {STAGE_TITLE[slot.stage.id]}
              {slot.kind === 'step' && (
                <span className="tabular-nums"> · {indexInStage} / {stageSlots.length}</span>
              )}
            </span>
          )}
        </Row>
        <div className="mt-2 h-1 overflow-hidden rounded-pill bg-soft">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((i + 1) / Math.max(1, slots.length)) * 100}%` }}
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 pb-4">
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
              <Button size="lg" full onClick={next}>К заданиям</Button>
            </Stack>
          </Card>
        )}

        {slot?.kind === 'step' && slot.step.kind === 'exercise' && (
          <Stack gap="md">
            {slot.step.review && (
              <p className="text-center text-xs tracking-wide text-muted uppercase">
                {phase === 'analysis' ? 'Работа над ошибкой' : 'Повторение'}
              </p>
            )}
            <ExerciseView
              key={`${i}-${slot.step.ex.id}`}
              exercise={slot.step.ex}
              onAnswered={(r, ms) => {
                const step = slot.step
                if (step.kind === 'exercise') void onAnswered(step, step.ex, r, ms)
              }}
            />
            <Row gap="sm" justify="center">
              {slot.step.rule && <RuleSheet rule={slot.step.rule} />}
            </Row>
            {canAdvance && (
              <Button size="lg" full onClick={next}>
                {i + 1 < slots.length ? 'Дальше' : 'Завершить'}
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
        <span className="text-xs tracking-wide text-muted uppercase">Блок занятия</span>
        <h1 className="text-xl font-semibold">{STAGE_TITLE[stage.id]}</h1>
        <p className="text-center text-sm text-muted">{STAGE_LEAD[stage.id]}</p>
        {exercises > 0 && (
          <p className="text-sm tabular-nums text-muted">
            {exercises} заданий · {Math.max(1, Math.round(stage.estimatedSec / 60))} мин
          </p>
        )}
        {stage.missingContent && (
          <p className="rounded-card bg-warn-bg px-3 py-2 text-center text-sm text-warn-ink">
            Блок пока не собирается: {stage.missingContent}
          </p>
        )}
        <Button size="lg" full onClick={onNext}>
          {stage.steps.length ? 'Начать блок' : 'Пропустить'}
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
        <span className="text-xs tracking-wide text-muted uppercase">Новое слово</span>
        <div className="text-center text-3xl font-semibold">{word.lemma}</div>
        <SpeakIcon text={word.lemma} />
        <div className="text-center text-lg">{word.translation}</div>

        {word.interference && (
          <p className="rounded-card bg-danger-bg px-3 py-2 text-center text-sm text-danger-ink">
            Не «{word.interference.confusedWith}»!<br />
            «{word.interference.confusedWith}» — это <strong>{word.interference.actuallyIs}</strong>
          </p>
        )}
        {word.aspectPair?.perfective && (
          <p className="text-sm text-muted">
            сов. вид: <span className="text-accent-ink">{word.aspectPair.perfective}</span>
          </p>
        )}
        {word.government && (
          <p className="text-sm text-muted">управление: {word.government}</p>
        )}

        <Row gap="sm" justify="center">
          <KnownToggle lexemeId={word.id} onMarked={(known) => known && onMarkedKnown()} />
        </Row>

        <Button size="lg" full onClick={onNext}>Запомнил</Button>
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
