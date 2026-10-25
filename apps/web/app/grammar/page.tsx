'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button, Card, Row, Screen, Stack } from '@polski/ui'
import type { CheckResult, Exercise } from '@polski/engine'
import {
  buildTodayPlan, hasAltMode, otherDrillMode, withDrillMode,
  type Stage, type Step,
} from '@/lib/engine/plan'
import { recordRuleAttempt } from '@/lib/engine/session'
import { saveExerciseResult, saveLessonSession } from '@/lib/data/store'
import { GrammarExerciseBatch } from '@/app/_components/ExerciseView'
import { RuleSheet } from '@/app/_components/RuleSheet'
import { RuleView } from '@/app/_components/RuleView'
import { Nav } from '@/app/_components/Nav'
import { ThemePicker } from '@/app/_components/ThemePicker'

type GrammarView = 'rule' | 'drill' | 'result'

export default function GrammarPage() {
  const [stage, setStage] = useState<Stage | null>(null)
  const [drills, setDrills] = useState<Step[]>([])
  const [dayNumber, setDayNumber] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<GrammarView>('rule')
  const [canAdvance, setCanAdvance] = useState(false)
  const [stats, setStats] = useState({ correct: 0, total: 0 })
  const startedAt = useRef(Date.now())

  const load = useCallback(() => {
    buildTodayPlan().then((p) => {
      const grammar = p.stages.find((s) => s.id === 'grammar') ?? null
      setStage(grammar)
      setDrills((grammar?.steps ?? []).filter((s) => s.kind === 'exercise'))
      setDayNumber(p.dayNumber)
      setLoaded(true)
    })
  }, [])

  useEffect(() => { load() }, [load])

  const step = drills[0]

  function switchKind() {
    const mode = otherDrillMode(drills[0])
    if (!mode) return
    // Переключаем тип сразу у всех предложений блока.
    setDrills((prev) => prev.map((s) => withDrillMode(s, mode)))
  }

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
    setCanAdvance(false)
    await saveLessonSession({
      id: crypto.randomUUID(),
      dayNumber,
      kind: 'grammar',
      startedAt: new Date(startedAt.current),
      completedAt: new Date(),
      plannedBudgetMs: (stage?.estimatedSec ?? 0) * 1000,
      actualMs: Date.now() - startedAt.current,
      itemsReviewed: stats.total,
      itemsCorrect: stats.correct,
    })
    setView('result')
  }

  function restart() {
    setStats({ correct: 0, total: 0 })
    setCanAdvance(false)
    startedAt.current = Date.now()
    setView('rule')
    load()
  }

  if (!loaded) return <Shell><Card><p className="text-sm text-muted">Ładowanie…</p></Card></Shell>

  if (!stage) {
    return (
      <Shell>
        <Card>
          <Stack gap="md" align="center">
            <span className="text-4xl" aria-hidden>📘</span>
            <p className="text-center text-sm text-muted">
              Dziś nie ma gramatyki w programie. Reguły wrócą w kolejnym dniu
              z nowym tematem.
            </p>
            <Link href="/" className="w-full">
              <Button variant="outline" full>Strona główna</Button>
            </Link>
          </Stack>
        </Card>
      </Shell>
    )
  }

  if (view === 'result') {
    const pct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0
    return (
      <Shell>
        <Card>
          <Stack gap="md" align="center">
            <span className="text-4xl" aria-hidden>{pct >= 70 ? '✓' : '↻'}</span>
            <h2 className="text-xl font-semibold">Trening zakończony</h2>
            <p className="text-sm text-muted">Poprawne odpowiedzi: {stats.correct} z {stats.total} · {pct}%</p>
            <Button size="lg" full onClick={restart}>Jeszcze raz</Button>
            <Link href="/" className="w-full">
              <Button variant="outline" full>Strona główna</Button>
            </Link>
          </Stack>
        </Card>
      </Shell>
    )
  }

  if (view === 'rule') {
    return (
      <Shell>
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
      </Shell>
    )
  }

  return (
    <Shell>
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
          />
          <Row gap="sm" justify="center">
            {step.rule && <RuleSheet rule={step.rule} />}
            {!canAdvance && hasAltMode(step) && (
              <Button variant="outline" size="sm" onClick={switchKind}>
                <span aria-hidden>🎲</span>
                Inny typ zadania
              </Button>
            )}
          </Row>
          {canAdvance && (
            <Button size="lg" full onClick={() => void next()}>
              Zakończ
            </Button>
          )}
        </Stack>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <Row justify="between">
          <h1 className="text-lg font-semibold">Gramatyka</h1>
          <ThemePicker />
        </Row>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4">
        <Stack gap="md">{children}</Stack>
      </main>
      <Nav />
    </Screen>
  )
}
