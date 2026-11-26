'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Card, Screen, Stack } from '@polski/ui'
import type { Exercise, CheckResult } from '@polski/engine'
import { ExerciseView } from '@/app/_components/ExerciseView'
import { loadState, saveExerciseResult, useAppState } from '@/lib/data/store'
import { recordRuleAttempt } from '@/lib/engine/session'
import { assignmentReviewRows, latestReviewResults, collectReviewBatch, ASSIGNMENT_REVIEW_PREFIX, type AssignmentMap, type AssignmentReviewData } from '@/lib/engine/assignment-progress'

import { contextualizeLegacy, isLegacyForm, legacyExpected, sentenceSourceKey } from '@/lib/engine/contextual-exercises'
import { restoreHistoricalExercise } from '@/lib/engine/historical-exercises'
import { loadLiveReadingCatalog } from '@/lib/content/curriculum'
import type { ReadingCatalogEntry } from '@/lib/content/reading-catalog'
import { readingBacklog } from '@/lib/content/reading-progress'

type Filter = 'missing' | 'mistakes' | 'all'
type Run = { day: number; exercises: Exercise[] }
export default function ReviewPage() {
  const t = useTranslations('reviewCenter')
  const common = useTranslations('common')
  const state = useAppState()
  const [reviewData, setReviewData] = useState<AssignmentReviewData | null>(null)
  const [catalog, setCatalog] = useState<ReadingCatalogEntry[] | null>(null)
  const [unavailable, setUnavailable] = useState(0)
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(() => new Set())
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
    setReviewData(null)
    loadLiveReadingCatalog().then(entries => { if (active) setCatalog(entries) }).catch(() => { if (active) setError(true) })
    loadState().then(() => fetch('/api/lesson-assignments/?summary=1', { cache:'no-store' })).then(async response => {
      if (!response.ok) throw new Error('assignment_summary_failed')
      return response.json() as Promise<AssignmentReviewData>
    }).then(result => { if (active) setReviewData(result) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [reload, state?.user.id])
  const completed = new Set((state?.sessions ?? []).filter(s => s.kind === 'day' && s.completedAt).map(s => s.dayNumber))
  const rows = assignmentReviewRows(reviewData?.summaries ?? [], state?.exerciseResults ?? [], completed, reviewData?.archive)
  const reading = catalog && state ? readingBacklog(catalog,state.exerciseResults,completed) : null
  const latest = latestReviewResults([...(reviewData?.archive ?? []), ...(state?.exerciseResults ?? [])])
  const visible = rows.filter(row => filter === 'all' || row[filter].length > 0)
  const candidates = (day: number, ids: string[]) => ids.filter(id => !unavailableIds.has(day + ':' + id))
  const recommendation = filter === 'all' ? undefined : visible.find(row => candidates(row.dayNumber, row[filter]).length > 0)
  async function start(day: number, ids: string[]) {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    setError(false)
    setUnavailable(0)
    try {
      const response = await fetch('/api/lesson-assignments/?day=' + day, { cache:'no-store' })
      if (!response.ok) throw new Error('assignment_load_failed')
      const { stages } = await response.json() as { stages: AssignmentMap }
      const wanted = new Set(candidates(day, ids))
      const exercises = [...new Map(Object.entries(stages).filter(([id]) => id !== 'reading')
        .flatMap(([,stage]) => stage?.steps.flatMap(step => step.kind === 'exercise' ? [step.ex] : step.kind === 'exercise-batch' ? step.exercises : []) ?? [])
        .filter(ex => wanted.has(ex.id)).map(ex => [ex.id, ex])).values()]
      const found = new Map(exercises.map(ex => [ex.id, ex]))
      const used = new Set<string>()
      const { items: recovered, unavailable: skipped } = await collectReviewBatch([...wanted], async id => {
        try {
          const stored = found.get(id)
          const row = latest.get(day + ':' + id)
          const exercise = stored
            ? isLegacyForm(stored)
              ? await contextualizeLegacy(id, day, stored.grammarRuleIds, legacyExpected(stored), used)
              : stored
            : row ? await restoreHistoricalExercise(id, row) : null
          if (!exercise) return null
          const key = sentenceSourceKey(exercise)
          if (used.has(key)) return null
          used.add(key)
          return { ...exercise, attemptsAllowed: 1 }
        } catch (error) {
          console.error('[review-exercise]', error)
          return null
        }
      })
      setUnavailable(skipped.length)
      setUnavailableIds(previous => new Set([...previous, ...skipped.map(id => day + ':' + id)]))
      if (!recovered.length) return
      setRun({ day, exercises: recovered }); setIndex(0); setAnswers({}); setFailed(null)
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
        {filter !== 'all' && <Card><Stack gap="sm">
          {recommendation && <><strong>{t('recommended')}</strong><p className="text-sm text-muted">{t('recommendedHint')}</p><Button full disabled={loading} onClick={() => void start(recommendation.dayNumber, recommendation[filter])}>{t('startReview')}</Button></>}
          {filter === 'mistakes' ? <><Link href="/reading/?filter=mistakes" className="flex justify-between border-t border-line py-3 text-sm">{t('mistakes')} <span>{reading?.mistakes ?? '—'} →</span></Link><Link href="/grammar/?review=weak" className="flex justify-between border-t border-line py-3 text-sm">{t('grammar')} <span>{state?.mastery.filter(r => r.attempts > 0 && r.mastery < 0.6).length ?? '—'} →</span></Link></> : <><Link href="/reading/?filter=missed" className="flex justify-between border-t border-line py-3 text-sm">{t('missed')} <span>{reading?.missed ?? '—'} →</span></Link><Link href="/reading/?filter=unfinished" className="flex justify-between border-t border-line py-3 text-sm">{t('unfinished')} <span>{reading?.unfinished ?? '—'} →</span></Link></>}
        </Stack></Card>}
        <p className="text-sm text-muted">{t('assignmentNotice')}</p>
        {error && <Card><Stack gap="sm"><p role="alert">{t('loadError')}</p><Button onClick={() => setReload(n => n + 1)}>{t('retry')}</Button></Stack></Card>}
        {!reviewData && !error && <p role="status">{common('loading')}</p>}
        {reviewData && visible.length === 0 && <Card><p>{t('noAssignments')}</p></Card>}
        {unavailable > 0 && <p role="status" className="text-sm text-muted">{t('unavailableHistory', { count: unavailable })}</p>}
        {unavailableIds.size > 0 && <Button size="sm" variant="ghost" onClick={() => { setUnavailableIds(new Set()); setUnavailable(0) }}>{t('retry')}</Button>}
        <details open={filter === 'all' ? true : undefined} className="space-y-2"><summary className="cursor-pointer text-sm font-medium">{t('history')}</summary>
        {visible.map(row => <Card key={row.dayNumber}><Stack gap="sm">
          <strong>{t('assignmentDay', { day: row.dayNumber })}</strong>
          <p className="text-sm text-muted">{t('assignmentCounts', { missing: row.missing.length, mistakes: row.mistakes.length, total: row.ids.length })}</p>
          <Button full disabled={loading || !candidates(row.dayNumber, filter === 'all' ? row.ids : row[filter]).length} onClick={() => void start(row.dayNumber, filter === 'all' ? row.ids : row[filter])}>{t(filter === 'all' ? 'repeatAssigned' : 'startReview')}</Button>
        </Stack></Card>)}
        </details>
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
