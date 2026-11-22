'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button, Card, Row, Screen, Segmented, Stack } from '@polski/ui'
import type { CheckResult, Exercise } from '@polski/engine'
import {
  buildTodayPlan,
  type Stage, type Step,
} from '@/lib/engine/plan'
import { recordRuleAttempt } from '@/lib/engine/session'
import { saveExerciseResult } from '@/lib/data/store'
import { useSaveLessonResult } from '@/app/_components/useSaveLessonResult'
import { GrammarExerciseBatch } from '@/app/_components/ExerciseView'
import { RuleSheet } from '@/app/_components/RuleSheet'
import { RuleView } from '@/app/_components/RuleView'
import { Nav } from '@/app/_components/Nav'
import { SectionHeading } from '@/app/_components/SectionHeading'
import { WeeklyGoalCredit } from '@/app/_components/WeeklyGoal'
import { GrammarPractice } from '@/app/_components/GrammarPractice'

type GrammarView = 'rule' | 'drill' | 'result'

const MODES = [
  { value: 'today', label: 'Сегодня' },
  { value: 'practice', label: 'Тренировка' },
] as const

export default function GrammarPage() {
  const [mode, setMode] = useState<(typeof MODES)[number]['value']>('today')
  const [openedPractice, setOpenedPractice] = useState(false)

  function changeMode(nextMode: typeof mode) {
    setMode(nextMode)
    if (nextMode === 'practice') setOpenedPractice(true)
  }

  return (
    <Shell mode={mode} onModeChange={changeMode}>
      <div hidden={mode !== 'today'}>
        <Stack gap="md"><TodayGrammar onPractice={() => changeMode('practice')} /></Stack>
      </div>
      {openedPractice && (
        <div hidden={mode !== 'practice'}>
          <GrammarPractice />
        </div>
      )}
    </Shell>
  )
}

function TodayGrammar({ onPractice }: { onPractice: () => void }) {
  const t = useTranslations()
  const [stage, setStage] = useState<Stage | null>(null)
  const [drills, setDrills] = useState<Step[]>([])
  const [dayNumber, setDayNumber] = useState(1)
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [view, setView] = useState<GrammarView>('rule')
  const [canAdvance, setCanAdvance] = useState(false)
  const [stats, setStats] = useState({ correct: 0, total: 0 })
  const startedAt = useRef(Date.now())
  const lessonSave = useSaveLessonResult()

  const load = useCallback(() => {
    setLoadStatus('loading')
    void buildTodayPlan().then((p) => {
      const grammar = p.stages.find((s) => s.id === 'grammar') ?? null
      setStage(grammar)
      setDrills((grammar?.steps ?? []).filter((s) => s.kind === 'exercise'))
      setDayNumber(p.dayNumber)
      setLoadStatus('ready')
    }).catch(() => setLoadStatus('error'))
  }, [])

  useEffect(() => { load() }, [load])

  const step = drills[0]

  async function onAnswered(
    ex: Exercise, r: CheckResult, complete = true, attempts = 1, answer = '',
  ) {
    if (complete) setCanAdvance(true)
    setStats((s) => ({ correct: s.correct + (r.correct ? 1 : 0), total: s.total + 1 }))
    await saveExerciseResult({
      dayNumber,
      exerciseId: ex.id,
      attempts,
      correct: r.correct,
      answer,
      expected: r.expected,
      errorKind: r.errorKind ?? null,
    })
    for (const ruleId of ex.grammarRuleIds) {
      await recordRuleAttempt(ruleId, r.correct, ex.difficulty)
    }
  }

  async function next() {
    const saved = await lessonSave.save({
      dayNumber,
      kind: 'grammar',
      startedAt: new Date(startedAt.current),
      completedAt: new Date(),
      plannedBudgetMs: (stage?.estimatedSec ?? 0) * 1000,
      actualMs: Date.now() - startedAt.current,
      itemsReviewed: stats.total,
      itemsCorrect: stats.correct,
    })
    if (saved) setView('result')
  }

  function restart() {
    setStats({ correct: 0, total: 0 })
    setCanAdvance(false)
    startedAt.current = Date.now()
    setView('rule')
    load()
  }

  if (loadStatus === 'loading') {
    return <Card><p role="status" className="text-sm text-muted">{t('common.loading')}</p></Card>
  }

  if (loadStatus === 'error') {
    return (
      <Card>
        <Stack gap="sm">
          <p role="alert" className="text-sm text-danger-ink">{t('errors.generic')}</p>
          <Button variant="outline" full onClick={load}>{t('errors.retry')}</Button>
          <Button variant="ghost" full onClick={onPractice}>{MODES[1].label}</Button>
        </Stack>
      </Card>
    )
  }

  if (!stage) {
    return (
      <Card>
        <Stack gap="md" align="center">
          <span className="text-4xl" aria-hidden>📘</span>
          <p className="text-center text-sm text-muted">
            Dziś nie ma gramatyki w programie. Reguły wrócą w kolejnym dniu
            z nowym tematem.
          </p>
          <Button full onClick={onPractice}>{MODES[1].label}</Button>
        </Stack>
      </Card>
    )
  }

  if (view === 'result') {
    const pct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0
    return (
      <Card>
        <Stack gap="md" align="center">
          <span className="text-4xl" aria-hidden>{pct >= 70 ? '✓' : '↻'}</span>
          <h2 className="text-xl font-semibold">Trening zakończony</h2>
          <p className="text-sm text-muted">Poprawne odpowiedzi: {stats.correct} z {stats.total} · {pct}%</p>
          <WeeklyGoalCredit />
          <Button size="lg" full onClick={restart}>Jeszcze raz</Button>
          <Link href="/" className="w-full">
            <Button variant="outline" full>Strona główna</Button>
          </Link>
        </Stack>
      </Card>
    )
  }

  if (view === 'rule') {
    return (
      <Card>
        <Stack gap="lg">
          {stage.rule
            ? <RuleView rule={stage.rule} />
            : <p className="text-sm text-muted">
                Dziś ćwiczymy reguły, które wypadają najsłabiej w statystykach.
              </p>}
          {stage.missingContent && (
            <p className="rounded-card bg-warn-bg px-3 py-2 text-sm text-warn-ink">
              Brak zadań: {stage.missingContent}
            </p>
          )}
          <Button size="lg" full disabled={!drills.length} onClick={() => setView('drill')}>
            {drills.length ? `Do zadań · ${drills.length}` : 'Brak zadań'}
          </Button>
        </Stack>
      </Card>
    )
  }

  return (
    <>
      <Row justify="between">
        <button
          type="button"
          onClick={() => setView('rule')}
          className="text-sm text-muted hover:text-ink"
        >
          ← Do reguły
        </button>
        <span className="text-sm tabular-nums text-muted">{drills.length} zdań</span>
      </Row>

      {step?.kind === 'exercise' && (
        <Stack gap="md">
          <GrammarExerciseBatch
            key={drills.map((s) => s.kind === 'exercise' ? s.ex.id : s.kind).join('|')}
            exercises={drills.flatMap((s) => s.kind === 'exercise' ? [s.ex] : [])}
            dayNumber={dayNumber}
            onAnswered={(ex, r, _ms, attempts, answer) => void onAnswered(ex, r, false, attempts, answer)}
            onComplete={() => setCanAdvance(true)}
            onReset={() => setCanAdvance(false)}
          />
          <Row gap="sm" justify="center">
            {step.rule && <RuleSheet rule={step.rule} />}
          </Row>
          {lessonSave.status === 'error' && (
            <p role="alert" className="text-sm text-danger-ink">Nie udało się zapisać wyniku.</p>
          )}
          {canAdvance && (
            <Button size="lg" full disabled={lessonSave.status === 'saving'} onClick={() => void next()}>
              {lessonSave.status === 'saving' ? 'Zapisywanie wyniku…' : lessonSave.status === 'error' ? 'Spróbuj ponownie' : 'Zakończ'}
            </Button>
          )}
        </Stack>
      )}
    </>
  )
}

function Shell({ children, mode, onModeChange }: {
  children: React.ReactNode
  mode: (typeof MODES)[number]['value']
  onModeChange: (mode: (typeof MODES)[number]['value']) => void
}) {
  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <SectionHeading section="grammar" />
        <div className="mt-2">
          <Segmented options={MODES} value={mode} onChange={onModeChange} ariaLabel="Режим грамматики" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4">
        <Stack gap="md">{children}</Stack>
      </main>
      <Nav />
    </Screen>
  )
}
