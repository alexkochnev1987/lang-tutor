'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button, Card, Row, Screen, Stack } from '@polski/ui'
import type { CheckResult, Exercise } from '@polski/engine'
import {
  currentDayNumber, loadCurriculum, loadMorphology, loadVocabulary,
  type CurriculumDay, type Lexeme,
} from '@/lib/content/curriculum'
import { exercisesForRule, exercisesForWord } from '@/lib/engine/exercises'
import { buildTodayLesson, ensureLexemeCards, recordAnswer, Rating } from '@/lib/engine/session'
import { db } from '@/lib/db/dexie'
import { ExerciseView, SpeakIcon } from '@/app/_components/ExerciseView'
import { Diagnostic } from '@/app/_components/Diagnostic'
import { EmptyDay } from '@/app/_components/EmptyDay'

type Step =
  | { phase: 'intro'; word: Lexeme }
  | { phase: 'exercise'; ex: Exercise }

export default function LessonPage() {
  const [day, setDay] = useState<CurriculumDay | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [i, setI] = useState(0)
  const [canAdvance, setCanAdvance] = useState(false)
  const [stats, setStats] = useState({ correct: 0, total: 0 })
  const [done, setDone] = useState(false)
  const [special, setSpecial] = useState<'diagnostic' | 'empty' | null>(null)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    let alive = true
    ;(async () => {
      const c = await loadCurriculum()
      const n = await currentDayNumber(c.stats.totalDays)
      const d = c.days[n - 1]!
      const [lesson, vocab, morph] = await Promise.all([
        buildTodayLesson(d), loadVocabulary(), loadMorphology(),
      ])
      if (!alive) return

      const all = [...vocab.values()]
      const newIds = lesson.activities.find((a) => a.kind === 'new-words')?.refIds ?? []
      const newWords = newIds.map((id) => vocab.get(id)).filter(Boolean) as Lexeme[]

      const built: Step[] = []
      // 1. новые слова: показ → упражнения
      for (const w of newWords) {
        built.push({ phase: 'intro', word: w })
        for (const ex of exercisesForWord(w, all)) built.push({ phase: 'exercise', ex })
      }
      // 2. грамматика дня — на уже введённой лексике
      const known = newWords.length ? newWords : all.slice(0, 20)
      for (const ruleId of d.grammarRuleIds) {
        for (const ex of exercisesForRule(ruleId, known, morph, 3)) {
          built.push({ phase: 'exercise', ex })
        }
      }

      setDay(d); setSteps(built); setNotes(lesson.notes)
      // 27 дней из 182 не содержат ни слов, ни правил: диагностика,
      // срезы, контрольные, финал. Раньше они были тупиками.
      if (!built.length) setSpecial(d.kind === 'diagnostic' ? 'diagnostic' : 'empty')
    })()
    return () => { alive = false }
  }, [])

  const step = steps[i]

  async function onAnswered(ex: Exercise, r: CheckResult, ms: number) {
    setCanAdvance(true)
    setStats((s) => ({ correct: s.correct + (r.correct ? 1 : 0), total: s.total + 1 }))

    if (ex.lexemeId) {
      await ensureLexemeCards(ex.lexemeId)
      const kind = ex.kind === 'translate-production' || ex.kind === 'spelling'
        ? 'lexeme-production' : 'lexeme-recognition'
      await recordAnswer(`${kind}:${ex.lexemeId}`, r.correct ? Rating.Good : Rating.Again, ms)
    }
    // грамматика идёт в mastery-модель, а не в FSRS — RESEARCH.md §7.3
    for (const ruleId of ex.grammarRuleIds) {
      const row = await db.ruleMastery.get(ruleId)
      const prev = row ?? {
        grammarRuleId: ruleId, mastery: 0, attempts: 0, correct: 0, recentWindow: [],
      }
      const { applyAttempt } = await import('@polski/engine')
      const next = applyAttempt(
        { ...prev, lastPracticedAt: row?.lastPracticedAt?.getTime() ?? null },
        { correct: r.correct, exerciseDifficulty: ex.difficulty, at: Date.now() },
      )
      await db.ruleMastery.put({
        grammarRuleId: ruleId, mastery: next.mastery,
        attempts: next.attempts, correct: next.correct,
        recentWindow: [...prev.recentWindow.slice(-9),
          { correct: r.correct, weight: ex.difficulty, at: Date.now() }],
        lastPracticedAt: new Date(),
      })
    }
  }

  function next() {
    setCanAdvance(false)
    if (i + 1 < steps.length) setI(i + 1)
    else void finish()
  }

  async function finish() {
    if (day) {
      await db.lessonSessions.add({
        dayNumber: day.day, startedAt: new Date(startedAt.current),
        completedAt: new Date(), plannedBudgetMs: day.totalSec * 1000,
        actualMs: Date.now() - startedAt.current,
        itemsReviewed: stats.total, itemsCorrect: stats.correct,
      })
    }
    setDone(true)
  }

  if (!day) return <Screen><Centered><p className="text-muted">Загрузка…</p></Centered></Screen>

  if (special === 'diagnostic') {
    return (
      <Screen>
        <Centered>
          <Diagnostic day={day.day} onDone={() => setDone(true)} />
        </Centered>
      </Screen>
    )
  }
  if (special === 'empty') {
    return (
      <Screen>
        <Centered><EmptyDay day={day} onDone={() => setDone(true)} /></Centered>
      </Screen>
    )
  }

  if (done) {
    const pct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0
    return (
      <Screen>
        <Centered>
          <Card>
            <Stack gap="md" align="center">
              <span className="text-4xl" aria-hidden>{pct >= 70 ? '✓' : '↻'}</span>
              <h1 className="text-xl font-semibold">День {day.day} пройден</h1>
              {stats.total > 0 && (
                <p className="text-sm text-muted">
                  Верно {stats.correct} из {stats.total} · {pct}%
                </p>
              )}
              {notes.map((n) => (
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

  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <Row justify="between">
          <Link href="/" className="text-sm text-muted hover:text-ink">← Выйти</Link>
          <span className="text-sm tabular-nums text-muted">{i + 1} / {steps.length}</span>
        </Row>
        <div className="mt-2 h-1 overflow-hidden rounded-pill bg-soft">
          <div className="h-full bg-primary transition-all"
               style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 pb-4">
        {step?.phase === 'intro' && (
          <Intro word={step.word} onNext={() => { setCanAdvance(false); next() }} />
        )}
        {step?.phase === 'exercise' && (
          /* R13: key обязателен — иначе стейт предыдущего упражнения
             переживёт смену задания и заблокирует ввод */
          <Stack gap="md">
            <ExerciseView
              key={`${i}-${step.ex.id}`}
              exercise={step.ex}
              onAnswered={(r, ms) => void onAnswered(step.ex, r, ms)}
            />
            {canAdvance && (
              <Button size="lg" full onClick={next}>
                {i + 1 < steps.length ? 'Дальше' : 'Завершить'}
              </Button>
            )}
          </Stack>
        )}
      </main>
    </Screen>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4">
      {children}
    </div>
  )
}

function Intro({ word, onNext }: { word: Lexeme; onNext: () => void }) {
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

        <Button size="lg" full onClick={onNext}>Запомнил</Button>
      </Stack>
    </Card>
  )
}
