'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button, Card, Row, Screen, Stack } from '@polski/ui'
import type { Exercise } from '@polski/engine'
import { ExerciseView } from '@/app/_components/ExerciseView'
import { loadReadingPreviewCatalog, loadReadingPreviewText, loadLiveReadingCatalog, loadLiveReadingText, type ReadingText } from '@/lib/content/curriculum'
import type { ReadingCatalogEntry } from '@/lib/content/reading-catalog'
import { exercisesForReading } from '@/lib/engine/exercises'
import { loadState, saveExerciseResult, useAppState } from '@/lib/data/store'
import { READING_PRACTICE_PREFIX, readingProgress, readingResultIndex, type ReadingFilter } from '@/lib/content/reading-progress'
import type { CheckResult } from '@polski/engine'

type Session = { text: ReadingText; exercises: Exercise[]; entry: ReadingCatalogEntry }
type Phase = 'catalog' | 'reading' | 'questions' | 'done'

function Passage({ text }: { text: ReadingText }) {
  return <article lang="pl" className="space-y-4">
    <h2 className="text-xl font-semibold">{text.title}</h2>
    {text.text.split(/\n\s*\n/).map((paragraph, i) =>
      <p key={i} className="whitespace-pre-line text-base leading-7">{paragraph}</p>)}
  </article>
}

export function ReadingPreview({ preview = false }: { preview?: boolean }) {
  const t = useTranslations('readingPreview')
  const lesson = useTranslations('lesson')
  const common = useTranslations('common')
  const router = useRouter()
  const state = useAppState()
  const [filter, setFilter] = useState<ReadingFilter | 'missed'>('all')
  const [saving, setSaving] = useState(false)
  const [failedAnswer, setFailedAnswer] = useState<{ ex: Exercise; result: CheckResult; attempts: number; answer: string } | null>(null)
  const savingRef = useRef(false)
  const [entries, setEntries] = useState<ReadingCatalogEntry[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [phase, setPhase] = useState<Phase>('catalog')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, boolean>>({})
  const [showText, setShowText] = useState(false)
  const requestId = useRef(0)
  const main = useRef<HTMLElement>(null)

  useEffect(() => {
    if (preview) return
    const requested = new URLSearchParams(window.location.search).get('filter')
    if (requested === 'missed' || requested === 'unfinished' || requested === 'mistakes') setFilter(requested)
    void loadState().catch(() => setError(true))
  }, [preview])

  useEffect(() => {
    let active = true
    const loadCatalog = preview ? loadReadingPreviewCatalog : loadLiveReadingCatalog
    loadCatalog().then(items => {
      if (!active) return
      setEntries(items)
      setError(false)
    }).catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setCatalogLoading(false) })
    return () => { active = false }
  }, [reload, preview])

  useEffect(() => () => { requestId.current++ }, [])
  useEffect(() => { main.current?.scrollTo({ top: 0 }) }, [phase, index])

  const latest = readingResultIndex(state?.exerciseResults ?? [])
  const completedDays = new Set((state?.sessions ?? []).filter(s => s.kind === 'day' && s.completedAt).map(s => s.dayNumber))
  function matches(entry: ReadingCatalogEntry) {
    const p = readingProgress(entry, latest)
    if (preview || filter === 'all') return true
    if (filter === 'missed') return p.status === 'new' && Boolean(entry.day && completedDays.has(entry.day))
    if (filter === 'mistakes') return p.mistakes.length > 0
    return p.status === filter
  }
  const visibleEntries = entries.filter(matches)

  async function select(entry: ReadingCatalogEntry) {
    const request = ++requestId.current
    setLoadingId(entry.id)
    setError(false)
    try {
      const text = await (preview ? loadReadingPreviewText(entry) : loadLiveReadingText(entry))
      const all = exercisesForReading(text, entry.day ?? 1).map(ex => ({ ...ex, attemptsAllowed: 1 }))
      if (all.length !== text.questions.length || !all.length) throw new Error('invalid_reading_exercises')
      const progress = readingProgress({ ...entry, questionIds: text.questions.map(q => q.id) }, latest)
      const target = filter === 'mistakes' || progress.status === 'mistakes' ? progress.mistakes : progress.status === 'unfinished' ? progress.remaining : []
      const exercises = !preview && target.length ? all.filter(ex => target.includes(ex.id)) : all
      if (request !== requestId.current) return
      setSession({ text, exercises, entry })
      setIndex(0)
      setAnswers({})
      setShowText(false)
      setPhase('reading')
    } catch {
      if (request === requestId.current) setError(true)
    } finally {
      if (request === requestId.current) setLoadingId(null)
    }
  }

  function backToCatalog() {
    if (savingRef.current) return
    requestId.current++
    setFailedAnswer(null)
    setLoadingId(null)
    setError(false)
    setSession(null)
    setPhase('catalog')
  }

  function retry() {
    setError(false)
    setCatalogLoading(true)
    setReload(value => value + 1)
  }

  async function persistAnswer(ex: Exercise, result: CheckResult, attempts: number, answer: string) {
    if (savingRef.current || Object.hasOwn(answers, ex.id)) return
    if (preview) { setAnswers(previous => ({ ...previous, [ex.id]: result.correct })); return }
    savingRef.current = true
    setSaving(true)
    setFailedAnswer(null)
    try {
      const saved = await saveExerciseResult({ dayNumber: session?.entry.day ?? 1, exerciseId: READING_PRACTICE_PREFIX + ex.id, attempts, correct: result.correct, answer, expected: result.expected, errorKind: result.errorKind ?? null })
      if (!saved) throw new Error('reading_save_failed')
      setAnswers(previous => ({ ...previous, [ex.id]: result.correct }))
    } catch { setFailedAnswer({ ex, result, attempts, answer }) }
    finally { savingRef.current = false; setSaving(false) }
  }

  const exercise = phase === 'questions' ? session?.exercises[index] : undefined
  const answered = exercise ? Object.hasOwn(answers, exercise.id) : false
  const correct = Object.values(answers).filter(Boolean).length
  const total = session?.exercises.length ?? 0

  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <Row align="center">
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => phase === 'catalog' ? router.push('/') : backToCatalog()}>
            {t('back')}
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold">{t('title')}</h1>
            <p className="text-sm text-muted">{session?.entry.day ? t('day', { day: session.entry.day, level: session.entry.level ?? '' }) : t(preview ? 'experimental' : 'practice')}</p>
          </div>
        </Row>
      </header>
      <main ref={main} className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4">
        <Stack gap="md">
          {phase === 'catalog' && <>
            <Card><p>{t(preview ? 'notice' : 'practiceNotice')}</p></Card>
            {!preview && <div className="flex flex-wrap gap-2">{(['all','new','missed','unfinished','mistakes','done'] as const).map(value => <Button key={value} size="sm" variant={filter === value ? 'primary' : 'outline'} onClick={() => setFilter(value)}>{t('filter.' + value)}</Button>)}</div>}
            {catalogLoading ? <p role="status">{common('loading')}</p> : <>
              {error && <Card><Stack><p role="alert">{t('loadError')}</p><Button onClick={retry}>{t('retry')}</Button></Stack></Card>}
              {!error && visibleEntries.length === 0 && <p>{t('empty')}</p>}
              {visibleEntries.map(entry => { const progress = readingProgress(entry, latest); return <Button key={entry.id} variant="outline" full
                disabled={loadingId !== null || (!preview && !state)} busy={loadingId === entry.id} onClick={() => void select(entry)}>
                <Stack gap="xs" align="start">
                  <span className="text-sm">{entry.day ? t('day', { day: entry.day, level: entry.level ?? '' }) : t('legacy')}</span>
                  <span lang="pl" className="text-left">{entry.title}</span>
                  {!preview && progress.status !== 'unknown' && <span className="text-xs text-muted">{t('filter.' + progress.status)} · {progress.answered}/{progress.total} · {t('correct', { count: progress.correct })}</span>}
                  {entry.status === 'practice' && <span className="text-xs text-muted">{t('practiceReviewPending')}</span>}
                </Stack>
              </Button> })}
            </>}
          </>}
          {phase === 'reading' && session && <Card><Stack gap="sm">{session.entry.status === 'practice' && <p className="text-xs text-muted">{t('practiceReviewPending')}</p>}<Passage text={session.text} /></Stack></Card>}
          {phase === 'questions' && session && exercise && <>
            <Row align="center">
              <p className="flex-1 text-sm text-muted">{lesson('progress', { done: index + 1, total })}</p>
              <Button variant="outline" size="sm" aria-expanded={showText} onClick={() => setShowText(value => !value)}>
                {showText ? t('hideText') : t('showText')}
              </Button>
            </Row>
            {showText && <Card><Passage text={session.text} /></Card>}
            <ExerciseView key={exercise.id} exercise={exercise} showReadingText={false}
              showSpeakButton={false} autoFocus={false} onAnswered={(result, _ms, attempts, answer) => void persistAnswer(exercise, result, attempts, answer)} />
            {failedAnswer && <Card><Stack gap="sm"><p role="alert">{t('saveError')}</p><Button onClick={() => void persistAnswer(failedAnswer.ex, failedAnswer.result, failedAnswer.attempts, failedAnswer.answer)}>{t('retry')}</Button></Stack></Card>}
          </>}
          {phase === 'done' && session && <Card><Stack gap="md">
            <h2 className="text-xl font-semibold">{t('result')}</h2>
            <p className="text-3xl font-semibold">{correct}/{total}</p>
            <p>{t('correct', { count: correct })} · {t('wrong', { count: total - correct })}</p>
            <p className="text-sm text-muted">{t(preview ? 'notice' : 'practiceNotice')}</p>
          </Stack></Card>}
        </Stack>
      </main>
      {session && phase !== 'catalog' && <footer className="mx-auto w-full max-w-2xl border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {phase === 'reading' && <Button full size="lg" onClick={() => setPhase('questions')}>{t('startQuestions')}</Button>}
        {phase === 'questions' && <Button full size="lg" disabled={!answered || saving} onClick={() => {
          if (!answered) return
          setShowText(false)
          if (index + 1 === total) setPhase('done')
          else setIndex(value => value + 1)
        }}>{index + 1 === total ? lesson('finish') : lesson('next')}</Button>}
        {phase === 'done' && <Button full size="lg" onClick={backToCatalog}>{t('chooseAnother')}</Button>}
      </footer>}
    </Screen>
  )
}
