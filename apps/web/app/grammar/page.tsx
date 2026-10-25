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
import { saveLessonSession } from '@/lib/data/store'
import { ExerciseView } from '@/app/_components/ExerciseView'
import { RuleSheet } from '@/app/_components/RuleSheet'
import { RuleView } from '@/app/_components/RuleView'
import { Nav } from '@/app/_components/Nav'

type GrammarView = 'rule' | 'drill' | 'result'

export default function GrammarPage() {
  const [stage, setStage] = useState<Stage | null>(null)
  const [drills, setDrills] = useState<Step[]>([])
  const [dayNumber, setDayNumber] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<GrammarView>('rule')
  const [i, setI] = useState(0)
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

  const step = drills[i]

  function switchKind() {
    const mode = otherDrillMode(step)
    if (!mode) return
    // disliking the kind, not the sentence — so the rest of the task switches too
    setDrills((prev) => prev.map((s, idx) => (idx < i ? s : withDrillMode(s, mode))))
  }

  async function onAnswered(ex: Exercise, r: CheckResult) {
    setCanAdvance(true)
    setStats((s) => ({ correct: s.correct + (r.correct ? 1 : 0), total: s.total + 1 }))
    for (const ruleId of ex.grammarRuleIds) {
      await recordRuleAttempt(ruleId, r.correct, ex.difficulty)
    }
  }

  async function next() {
    setCanAdvance(false)
    if (i + 1 < drills.length) { setI(i + 1); return }
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
    setI(0)
    setStats({ correct: 0, total: 0 })
    setCanAdvance(false)
    startedAt.current = Date.now()
    setView('rule')
    load()
  }

  if (!loaded) return <Shell><Card><p className="text-sm text-muted">Загрузка…</p></Card></Shell>

  if (!stage) {
    return (
      <Shell>
        <Card>
          <Stack gap="md" align="center">
            <span className="text-4xl" aria-hidden>📘</span>
            <p className="text-center text-sm text-muted">
              На сегодня грамматики в программе нет. Правила вернутся в
              следующий день с новой темой.
            </p>
            <Link href="/" className="w-full">
              <Button full>На главный</Button>
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
            <h2 className="text-xl font-semibold">Тренировка закончена</h2>
            <p className="text-sm text-muted">Верно {stats.correct} из {stats.total} · {pct}%</p>
            <Button size="lg" full onClick={restart}>Ещё раз</Button>
            <Link href="/" className="w-full">
              <Button variant="ghost" full>На главный</Button>
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
                  Сегодня отрабатываются правила, которые проседают по статистике.
                </p>}
            {stage.missingContent && (
              <p className="rounded-card bg-warn-bg px-3 py-2 text-sm text-warn-ink">
                Заданий нет: {stage.missingContent}
              </p>
            )}
            <Button size="lg" full disabled={!drills.length} onClick={() => setView('drill')}>
              {drills.length ? `К заданиям · ${drills.length}` : 'Заданий нет'}
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
          ← К правилу
        </button>
        <span className="text-sm tabular-nums text-muted">{i + 1} / {drills.length}</span>
      </Row>

      {step?.kind === 'exercise' && (
        <Stack gap="md">
          <ExerciseView
            key={`${i}-${step.ex.id}`}
            exercise={step.ex}
            onAnswered={(r) => void onAnswered(step.ex, r)}
          />
          <Row gap="sm" justify="center">
            {step.rule && <RuleSheet rule={step.rule} />}
            {!canAdvance && hasAltMode(step) && (
              <button
                type="button"
                onClick={switchKind}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-card bg-soft px-3 text-sm text-muted hover:bg-soft2 hover:text-ink"
              >
                <span aria-hidden>🎲</span>
                Другой вид задания
              </button>
            )}
          </Row>
          {canAdvance && (
            <Button size="lg" full onClick={() => void next()}>
              {i + 1 < drills.length ? 'Дальше' : 'Завершить'}
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
        <h1 className="text-lg font-semibold">Грамматика</h1>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4">
        <Stack gap="md">{children}</Stack>
      </main>
      <Nav />
    </Screen>
  )
}
