'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button, Card, Row, Screen, Segmented, Stack } from '@polski/ui'
import type { CheckResult, Exercise } from '@polski/engine'
import {
  buildTodayPlan,
  type Stage,
} from '@/lib/engine/plan'
import { recordRuleAttempt } from '@/lib/engine/session'
import { saveExerciseResult, useAppState } from '@/lib/data/store'
import { useSaveLessonResult } from '@/app/_components/useSaveLessonResult'
import { GrammarExerciseBatch } from '@/app/_components/ExerciseView'
import { RuleSheet } from '@/app/_components/RuleSheet'
import { RuleView } from '@/app/_components/RuleView'
import { LoadingSkeleton } from '@/app/_components/LoadingSkeleton'
import { Nav } from '@/app/_components/Nav'
import { SectionHeading } from '@/app/_components/SectionHeading'
import { WeeklyGoalCredit } from '@/app/_components/WeeklyGoal'
import { AppIcon } from '@/app/_components/AppIcon'
import { TodayGrammarOptions } from '@/app/_components/TodayGrammarOptions'
import { grammarPracticePlan } from '@/lib/engine/grammar-practice-plan'
import type { LocalizedRule } from '@/lib/content/rules'
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
  const state = useAppState()
  const [selection, setSelection] = useState<{ exercises: Exercise[]; rule?: LocalizedRule | null } | null>(null)
  const [dayNumber, setDayNumber] = useState(1)
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [view, setView] = useState<GrammarView>('rule')
  const [canAdvance, setCanAdvance] = useState(false)
  const [pendingAnswers, setPendingAnswers] = useState(0)
  const [result, setResult] = useState({ correct: 0, total: 0 })
  const startedAt = useRef(Date.now())
  const lessonSave = useSaveLessonResult()

  const load = useCallback(() => {
    setLoadStatus('loading')
    void buildTodayPlan().then((p) => {
      const grammar = p.stages.find((s) => s.id === 'grammar') ?? null
      setStage(grammar)
      setDayNumber(p.dayNumber)
      setLoadStatus('ready')
    }).catch(() => setLoadStatus('error'))
  }, [])

  useEffect(() => { load() }, [load])

  function start(exercises: Exercise[], rule?: LocalizedRule | null) {
    lessonSave.reset()
    setSelection({ exercises, rule })
    setCanAdvance(false)
    startedAt.current = Date.now()
    setView('drill')
  }

  async function onAnswered(ex: Exercise, r: CheckResult, attempts: number, answer: string) {
    setPendingAnswers((count) => count + 1)
    try {
      const saved = await saveExerciseResult({
        dayNumber,
        exerciseId: ex.id,
        attempts,
        correct: r.correct,
        answer,
        expected: r.expected,
        errorKind: r.errorKind ?? null,
      })
      if (saved) {
        for (const ruleId of ex.grammarRuleIds) {
          await recordRuleAttempt(ruleId, r.correct, ex.difficulty)
        }
      }
    } finally {
      setPendingAnswers((count) => count - 1)
    }
  }

  const selectedIds = new Set(selection?.exercises.map(({ id }) => id))
  const answers = (state?.exerciseResults ?? []).filter((answer) =>
    answer.dayNumber === dayNumber && selectedIds.has(answer.exerciseId))

  async function next() {
    if (!selection || pendingAnswers || answers.length !== selectedIds.size) return
    const stats = { total: answers.length, correct: answers.filter(({ correct }) => correct).length }
    const saved = await lessonSave.save({
      dayNumber,
      kind: 'grammar',
      startedAt: new Date(startedAt.current),
      completedAt: new Date(),
      plannedBudgetMs: selection.exercises.reduce((sum, exercise) => sum + exercise.estimatedSec, 0) * 1000,
      actualMs: Date.now() - startedAt.current,
      itemsReviewed: stats.total,
      itemsCorrect: stats.correct,
    })
    if (saved) {
      setResult(stats)
      setView('result')
    }
  }

  function restart() {
    setSelection(null)
    setView('rule')
    load()
  }

  if (loadStatus === 'loading') {
    return <LoadingSkeleton variant="list" visible label={t('loadingSections.grammar')} />
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
    const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0
    return (
      <Card>
        <Stack gap="md" align="center">
          <span className="text-4xl" aria-hidden>{pct >= 70 ? '✓' : '↻'}</span>
          <h2 className="text-xl font-semibold">Trening zakończony</h2>
          <p className="text-sm text-muted">Poprawne odpowiedzi: {result.correct} z {result.total} · {pct}%</p>
          <WeeklyGoalCredit />
          <Button size="lg" full onClick={restart}>Jeszcze raz</Button>
          <Link href="/" className="w-full">
            <Button variant="outline" full>Strona główna</Button>
          </Link>
        </Stack>
      </Card>
    )
  }

  if (view === 'rule' || !selection) {
    const plan = grammarPracticePlan(stage.steps)
    if (plan.exercises.length > 0) return <TodayGrammarOptions plan={plan} onStart={start} />

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
          <Button full onClick={onPractice}>{MODES[1].label}</Button>
        </Stack>
      </Card>
    )
  }

  return (
    <>
      <Row justify="between">
        <Button size="sm" variant="outline" disabled={lessonSave.status === 'saving' || pendingAnswers > 0}
          onClick={() => { setSelection(null); setView('rule') }}>
          <AppIcon name="back" className="size-4 shrink-0" />
          {t('grammarToday.backTopics')}
        </Button>
        <span className="text-sm tabular-nums text-muted">{t('grammarToday.count', { count: selection.exercises.length })}</span>
      </Row>

      <Stack gap="md">
        <GrammarExerciseBatch
          exercises={selection.exercises}
          dayNumber={dayNumber}
          onAnswered={(ex, r, _ms, attempts, answer) => void onAnswered(ex, r, attempts, answer)}
          onComplete={() => setCanAdvance(true)}
          canReset={pendingAnswers === 0 && lessonSave.status !== 'saving'}
          onReset={() => { lessonSave.reset(); setCanAdvance(false) }}
        />
        {selection.rule && <Row gap="sm" justify="center"><RuleSheet rule={selection.rule} /></Row>}
        {lessonSave.status === 'error' && (
          <p role="alert" className="text-sm text-danger-ink">Nie udało się zapisać wyniku.</p>
        )}
        {canAdvance && answers.length === selectedIds.size && (
          <Button size="lg" full disabled={pendingAnswers > 0} busy={lessonSave.status === 'saving'} busyLabel="Zapisywanie wyniku…" onClick={() => void next()}>
            {lessonSave.status === 'error' ? 'Spróbuj ponownie' : 'Zakończ'}
          </Button>
        )}
      </Stack>
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
