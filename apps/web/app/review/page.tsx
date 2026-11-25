'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Card, Screen, Stack } from '@polski/ui'
import type { Exercise, CheckResult } from '@polski/engine'
import { ExerciseView } from '@/app/_components/ExerciseView'
import { loadState, saveExerciseResult, useAppState } from '@/lib/data/store'
import { recordRuleAttempt } from '@/lib/engine/session'
import { assignmentReviewRows, ASSIGNMENT_REVIEW_PREFIX, type AssignmentMap, type AssignmentSummary } from '@/lib/engine/assignment-progress'

type Filter = 'missing' | 'mistakes' | 'all'
type Run = { day: number; exercises: Exercise[] }
export default function ReviewPage() {
  const t = useTranslations('reviewCenter')
  const common = useTranslations('common')
  const state = useAppState()
  const [summaries, setSummaries] = useState<AssignmentSummary[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)
  const [run, setRun] = useState<Run | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState<{ exercise: Exercise; result: CheckResult; attempts: number; answer: string } | null>(null)
  const busy = useRef(false)
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('filter')
    if (requested === 'missing' || requested === 'mistakes') setFilter(requested)
  }, [])
  useEffect(() => {
    let active = true
    setError(false)
    setSummaries(null)
    loadState().then(() => fetch('/api/lesson-assignments/?summary=1', { cache:'no-store' })).then(async response => {
      if (!response.ok) throw new Error('assignment_summary_failed')
      return response.json() as Promise<{ summaries: AssignmentSummary[] }>
    }).then(result => { if (active) setSummaries(result.summaries) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [reload, state?.user.id])
  const completed = new Set((state?.sessions ?? []).filter(s => s.kind === 'day' && s.completedAt).map(s => s.dayNumber))
  const rows = assignmentReviewRows(summaries ?? [], state?.exerciseResults ?? [], completed)
  const visible = rows.filter(row => filter === 'all' || row[filter].length > 0)
  async function start(day: number, ids: string[]) {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    setError(false)
    try {
      const response = await fetch('/api/lesson-assignments/?day=' + day, { cache:'no-store' })
      if (!response.ok) throw new Error('assignment_load_failed')
      const { stages } = await response.json() as { stages: AssignmentMap }
      const wanted = new Set(ids)
      const exercises = [...new Map(Object.entries(stages).filter(([id]) => id !== 'reading')
        .flatMap(([,stage]) => stage?.steps.flatMap(step => step.kind === 'exercise' ? [step.ex] : step.kind === 'exercise-batch' ? step.exercises : []) ?? [])
        .filter(ex => wanted.has(ex.id)).map(ex => [ex.id, ex])).values()]
      if (exercises.length !== wanted.size || !exercises.length) throw new Error('assignment_exercise_missing')
      setRun({ day, exercises }); setIndex(0); setAnswers({}); setFailed(null)
    } catch { setError(true) }
    finally { busy.current = false; setLoading(false) }
  }
  async function persist(exercise: Exercise, result: CheckResult, attempts: number, answer: string) {
    if (!run || busy.current || Object.hasOwn(answers, exercise.id)) return
    busy.current = true; setLoading(true); setFailed(null)
    try {
      const saved = await saveExerciseResult({ dayNumber: run.day, exerciseId: ASSIGNMENT_REVIEW_PREFIX + exercise.id, attempts, correct: result.correct, answer, expected: result.expected, errorKind: result.errorKind ?? null })
      if (!saved) throw new Error('review_save_failed')
      setAnswers(previous => ({ ...previous, [exercise.id]: result.correct }))
      for (const ruleId of exercise.grammarRuleIds) await recordRuleAttempt(ruleId, result.correct, exercise.difficulty).catch(error => console.error('[review-mastery]', error))
    } catch { setFailed({ exercise, result, attempts, answer }) }
    finally { busy.current = false; setLoading(false) }
  }
  const exercise = run?.exercises[index]
  return <Screen>
    <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
      {run ? <Button variant="ghost" size="sm" disabled={loading} onClick={() => { setRun(null); setFailed(null) }}>{t('back')}</Button> : <Link href="/" className="text-sm font-medium">{t('back')}</Link>}
      <h1 className="text-lg font-semibold">{t('title')}</h1>
    </header>
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4"><Stack gap="md">
      {!run && <>
        <div className="flex flex-wrap gap-2">{(['all','missing','mistakes'] as const).map(value => <Button key={value} size="sm" variant={filter === value ? 'primary' : 'outline'} onClick={() => setFilter(value)}>{t('assignmentFilter.' + value)}</Button>)}</div>
        <p className="text-sm text-muted">{t('assignmentNotice')}</p>
        {error && <Card><Stack gap="sm"><p role="alert">{t('loadError')}</p><Button onClick={() => setReload(n => n + 1)}>{t('retry')}</Button></Stack></Card>}
        {!summaries && !error && <p role="status">{common('loading')}</p>}
        {summaries && visible.length === 0 && <Card><p>{t('noAssignments')}</p></Card>}
        {visible.map(row => <Card key={row.dayNumber}><Stack gap="sm">
          <strong>{t('assignmentDay', { day: row.dayNumber })}</strong>
          <p className="text-sm text-muted">{t('assignmentCounts', { missing: row.missing.length, mistakes: row.mistakes.length, total: row.ids.length })}</p>
          <Button full disabled={loading} onClick={() => void start(row.dayNumber, filter === 'all' ? row.ids : row[filter])}>{t(filter === 'all' ? 'repeatAssigned' : 'startReview')}</Button>
        </Stack></Card>)}
      </>}
      {run && exercise && <>
        <p className="text-sm text-muted">{t('assignmentDay', { day: run.day })} · {index + 1}/{run.exercises.length}</p>
        <ExerciseView key={exercise.id} exercise={exercise} onAnswered={(result, _ms, attempts, answer) => void persist(exercise, result, attempts, answer)} />
        {failed && <Card><Stack><p role="alert">{t('saveError')}</p><Button onClick={() => void persist(failed.exercise, failed.result, failed.attempts, failed.answer)}>{t('retry')}</Button></Stack></Card>}
        <Button full disabled={loading || !Object.hasOwn(answers, exercise.id)} onClick={() => setIndex(n => n + 1)}>{t('next')}</Button>
      </>}
      {run && !exercise && <Card><Stack gap="md">
        <h2 className="text-lg font-semibold">{t('result')}</h2>
        <p className="text-2xl font-semibold">{Object.values(answers).filter(Boolean).length}/{run.exercises.length}</p>
        <Button full onClick={() => setRun(null)}>{t('back')}</Button>
      </Stack></Card>}
    </Stack></main>
  </Screen>
}
