'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Card, Row, Screen, Stack } from '@polski/ui'
import { hashString, type CheckResult } from '@polski/engine'
import { ExerciseView } from '@/app/_components/ExerciseView'
import { Nav } from '@/app/_components/Nav'
import { SectionHeading } from '@/app/_components/SectionHeading'
import { SectionNav } from '@/app/_components/SectionNav'
import { WordPracticeFooter } from '@/app/_components/WordPracticeFooter'
import { currentDayNumber, loadCurriculum, loadVocabulary, type Lexeme } from '@/lib/content/curriculum'
import { loadDailyWords, loadState, saveDailyWordAnswer, subscribeDailyWords } from '@/lib/data/store'
import { dailyWordExercise, WORD_FORMATS, wordSkill, type DailyWordAnswer, type DailyWordQueue, type WordFormat } from '@/lib/engine/daily-words'
import { prepareLexemeReview, Rating } from '@/lib/engine/session'

const SESSION_SIZE = 5
const FORM_ID = 'daily-word-response'
const SESSION_KEY = 'daily-word-practice'
type Session = {
  id: string
  day: string
  words: Lexeme[]
  format: WordFormat
  index: number
  correct: number
  answered: number
}

export default function WordsPage() {
  const t = useTranslations('dailyWords')
  const [vocabulary, setVocabulary] = useState<Map<string, Lexeme> | null>(null)
  const [queue, setQueue] = useState<DailyWordQueue | null>(null)
  const [dayNumber, setDayNumber] = useState(1)
  const [loadError, setLoadError] = useState(false)
  const [format, setFormat] = useState<WordFormat>('translation')
  const [list, setList] = useState<'learn' | 'review'>('learn')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<'ready' | 'checking' | 'saving' | 'saved' | 'failed' | 'unavailable'>('ready')
  const pending = useRef<DailyWordAnswer | null>(null)
  const answering = useRef(false)
  const main = useRef<HTMLElement>(null)
  const initialized = useRef(false)

  function load() {
    setLoadError(false)
    void Promise.all([loadVocabulary(), loadDailyWords(), loadCurriculum()])
      .then(async ([words, nextQueue, curriculum]) => {
        setDayNumber(await currentDayNumber(curriculum.stats.totalDays))
        setVocabulary(words)
        setQueue(nextQueue)
        if (initialized.current) return
        initialized.current = true
        try {
          const raw = sessionStorage.getItem(SESSION_KEY)
          if (!raw) return
          const saved = JSON.parse(raw) as Omit<Session, 'words' | 'index'> & { ids: string[] }
          if (saved.day !== nextQueue.day || !WORD_FORMATS.includes(saved.format)) return
          const available = new Set([...nextQueue.learn, ...nextQueue.review])
          const remaining = saved.ids.flatMap((id) => available.has(id) ? words.get(id) ?? [] : [])
          if (remaining.length) setSession({ ...saved, words: remaining, index: 0 })
        } catch { /* Session storage may be unavailable. */ }
      }).catch(() => setLoadError(true))
  }

  useEffect(load, [])
  useEffect(() => {
    if (status !== 'ready') return
    let active = true
    const unsubscribe = subscribeDailyWords(() => {
      void loadDailyWords().then((fresh) => {
        if (!active || answering.current) return
        setQueue(fresh)
        if (!session) return
        const available = new Set([...fresh.learn, ...fresh.review])
        const remaining = session.words.slice(session.index).filter(({ id }) => available.has(id))
        if (remaining.length !== session.words.length - session.index) {
          setSession({ ...session, day: fresh.day, words: [...session.words.slice(0, session.index), ...remaining] })
          main.current?.scrollTo({ top: 0 })
        }
      }).catch(() => { if (active) setLoadError(true) })
    })
    return () => { active = false; unsubscribe() }
  }, [session, status])

  useEffect(() => {
    if (!session) return
    try {
      const { words, index, ...saved } = session
      const offset = status === 'saved' || status === 'unavailable' ? index + 1 : index
      const ids = words.slice(offset).map(({ id }) => id)
      if (ids.length) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...saved, ids }))
      else sessionStorage.removeItem(SESSION_KEY)
    } catch { /* Session storage may be unavailable. */ }
  }, [session, status])

  const pool = useMemo(() => [...(vocabulary?.values() ?? [])], [vocabulary])
  const visibleIds = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    return (queue?.[list] ?? []).filter((id) => {
      const word = vocabulary?.get(id)
      return word && (!search || word.lemma.toLocaleLowerCase().includes(search)
        || word.translation.toLocaleLowerCase().includes(search))
    }).slice(0, 80)
  }, [list, query, queue, vocabulary])
  const word = session?.words[session.index]
  const exercise = useMemo(() => {
    if (!session || !word) return null
    const task = dailyWordExercise(word, pool, session.format, hashString(session.id + word.id))
    return { ...task, id: `${session.id}:${task.id}` }
  }, [pool, session, word])

  async function nextSession(words: Lexeme[], current: Session) {
    setStatus('checking')
    try {
      const fresh = await loadDailyWords()
      setQueue(fresh)
      const available = new Set([...fresh.learn, ...fresh.review])
      const rest = words.filter(({ id }) => available.has(id))
      setSession({ ...current, day: fresh.day, words: [...current.words.slice(0, current.index), ...rest] })
      main.current?.scrollTo({ top: 0 })
      setStatus('ready')
    } catch {
      setStatus('ready')
      setLoadError(true)
    }
  }

  function start() {
    if (!vocabulary || !queue) return
    const ids = selected.length ? queue[list].filter((id) => selected.includes(id)) : queue[list].slice(0, SESSION_SIZE)
    const words = ids.flatMap((id) => vocabulary.get(id) ?? [])
    if (!words.length) return
    setLoadError(false)
    void nextSession(words, { format, day: queue.day, id: crypto.randomUUID(), index: 0, words, correct: 0, answered: 0 })
  }

  function advance() {
    if (!session) return
    const index = session.index + 1
    setLoadError(false)
    void nextSession(session.words.slice(index), { ...session, index })
  }

  async function persist() {
    const payload = pending.current
    if (!payload) return
    setStatus('saving')
    try {
      const accepted = await saveDailyWordAnswer(payload)
      pending.current = null
      setStatus(accepted ? 'saved' : 'unavailable')
      if (accepted) setSession((current) => current && ({
        ...current, answered: current.answered + 1, correct: current.correct + Number(payload.result.correct),
      }))
    } catch {
      setStatus('failed')
    }
  }

  async function answer(result: CheckResult, ms: number, attempts: number, response: string) {
    if (!session || !word || !exercise || answering.current) return
    answering.current = true
    setStatus('saving')
    const state = await loadState()
    pending.current = {
      ...prepareLexemeReview(state.studyItems, word.id, wordSkill(session.format), result.correct ? Rating.Good : Rating.Again, ms),
      format: session.format,
      result: { dayNumber, exerciseId: exercise.id, attempts, correct: result.correct,
        answer: response, expected: result.expected, errorKind: result.errorKind ?? null },
    }
    await persist()
    answering.current = false
  }

  function exit() {
    try { sessionStorage.removeItem(SESSION_KEY) } catch { /* Session storage may be unavailable. */ }
    setSession(null)
    setSelected([])
    setStatus('ready')
    setLoadError(false)
    load()
  }

  if (session) {
    const canAdvance = status === 'saved' || status === 'unavailable'
    const formId = exercise?.mode === 'typed' && status === 'ready' ? FORM_ID : undefined
    return (
      <Screen className="word-practice-screen">
        <header className="mx-auto w-full max-w-2xl px-4 py-2">
          <Row justify="between" wrap>
            <Button variant="ghost" size="sm" onClick={exit} disabled={status === 'saving' || status === 'checking'}>{t('choose')}</Button>
            <span className="text-sm text-muted">{t(session.format)} {word && `· ${session.index + 1} / ${session.words.length}`}</span>
          </Row>
        </header>
        <main ref={main} className="mx-auto w-full max-w-2xl flex-1 px-4 pb-2">
          {exercise ? (
            <Stack gap="xs">
              <ExerciseView key={exercise.id} exercise={exercise} onAnswered={(...args) => void answer(...args)}
                autoFocus={false} showSpeakButton={session.format === 'translation' || status === 'saved'} submitFormId={exercise.mode === 'typed' ? FORM_ID : undefined} />
              {status === 'unavailable' && <p role="status" className="text-sm text-muted">{t('unavailable')}</p>}
              {loadError && <p role="alert" className="text-sm text-danger-ink">{t('error')}</p>}
            </Stack>
          ) : (
            <Card><Stack gap="sm"><strong>{t('done')}</strong><p>{t('score', { correct: session.correct, total: session.answered })}</p></Stack></Card>
          )}
        </main>
        <WordPracticeFooter
          label={status === 'saving' ? t('saving') : status === 'failed' ? t('retry') : status === 'checking' ? t('loading')
            : formId ? t('check') : exercise ? t('next') : t('choose')}
          formId={formId}
          disabled={!(canAdvance || formId || status === 'failed' || !exercise) || status === 'checking'}
          onNext={status === 'failed' ? () => void persist() : exercise ? advance : exit}
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <SectionHeading section="words" />
        <div className="mt-2"><SectionNav section="words" current="/words" /></div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4">
        <Stack gap="sm">
          <Row wrap gap="xs">
            {(['learn', 'review'] as const).map((kind) => (
              <Button key={kind} variant={list === kind ? 'primary' : 'outline'} aria-pressed={list === kind}
                onClick={() => { setList(kind); setSelected([]) }}>
                {t(kind)} {queue ? queue[kind].length : '…'}
              </Button>
            ))}
          </Row>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-2 text-sm font-medium">{t('choose')}</legend>
            {WORD_FORMATS.map((mode) => (
              <label key={mode} className="flex min-h-12 items-center gap-2 rounded-card border border-line px-3 text-sm">
                <input type="radio" name="word-format" checked={format === mode} onChange={() => setFormat(mode)} />
                {t(mode)}
              </label>
            ))}
          </fieldset>
          {loadError ? <Button variant="outline" onClick={load}>{t('reload')}</Button> : !queue ? (
            <p role="status">{t('loading')}</p>
          ) : !queue[list].length ? <p role="status">{t('empty')}</p> : (
            <>
              <Button full onClick={start} disabled={status === 'checking'}>{status === 'checking' ? t('loading') : t('start')}</Button>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} aria-label={t('search')}
                className="min-h-12 rounded-card border border-line bg-card px-3" />
              <p className="text-sm text-muted">{t('selected', { selected: selected.length, limit: SESSION_SIZE })}</p>
              {visibleIds.map((id) => {
                const candidate = vocabulary?.get(id)
                const picked = selected.includes(id)
                return <Button key={id} variant={picked ? 'primary' : 'outline'} aria-pressed={picked}
                  disabled={!picked && selected.length >= SESSION_SIZE}
                  onClick={() => setSelected((previous) => picked ? previous.filter((entry) => entry !== id) : [...previous, id])}>
                  <span lang="pl">{candidate?.lemma}</span> · {candidate?.translation}
                </Button>
              })}
            </>
          )}
        </Stack>
      </main>
      <Nav />
    </Screen>
  )
}
