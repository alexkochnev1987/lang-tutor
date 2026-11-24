'use client'

import { TabBody } from '@/app/_components/TabBody'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/app/_components/AppIcon'
import { Button, Card, Row, Screen, Stack } from '@polski/ui'
import { hashString, spelling, type CheckResult } from '@polski/engine'
import { BrainstormPractice } from '@/app/_components/BrainstormPractice'
import { PronunciationExercise } from '@/app/_components/PronunciationExercise'
import { ExerciseView } from '@/app/_components/ExerciseView'
import { LoadingSkeleton, SkeletonBlock } from '@/app/_components/LoadingSkeleton'
import { SectionNav } from '@/app/_components/SectionNav'
import { WordPracticeFooter } from '@/app/_components/WordPracticeFooter'
import { WordSaveIndicator } from '@/app/_components/WordSaveIndicator'
import { WordRow } from '@/app/_components/WordRow'
import { currentDayNumber, getCachedVocabulary, loadCurriculum, loadVocabulary, type Lexeme } from '@/lib/content/curriculum'
import { getCachedDailyWords, getLoadedState, loadDailyWords, queueDailyWordAnswer, subscribeDailyWords } from '@/lib/data/store'
import { dailyWordExercise, WORD_PRACTICE_FORMATS, wordSkill, wordsForFormat, reviewFormatsForWord, type WordFormat, type DailyWordAnswer, type DailyWordList, type DailyWordQueue, type WordPracticeFormat } from '@/lib/engine/daily-words'
import { prepareLexemeReview, Rating } from '@/lib/engine/session'

const SESSION_SIZE: Record<WordPracticeFormat, number> = { brainstorm: 5, translation: 10, reverse: 10, writing: 5, listening: 5, pronunciation: 5 }
const PAGE_SIZE = 40
const SESSION_KEY = 'daily-word-practice'
type Session = {
  id: string
  day: string
  words: Lexeme[]
  format: WordPracticeFormat
  list: DailyWordList
  index: number
  correct: number
  answered: number
  reviewFormats?: Record<string, WordFormat[]>
}

export default function WordsPage() {
  return <Suspense fallback={<WordsShell><LoadingSkeleton variant="list" /></WordsShell>}><WordsWithList /></Suspense>
}

function WordsWithList() {
  const requested = useSearchParams().get('list')
  const initialList = requested === 'review' || requested === 'learn' ? requested : undefined
  const requestedFormat = useSearchParams().get('format') as WordPracticeFormat | null
  const initialFormat = requestedFormat && WORD_PRACTICE_FORMATS.includes(requestedFormat) ? requestedFormat : undefined
  return <WordPractice key={`${initialList ?? 'default'}:${initialFormat}`} initialList={initialList} initialFormat={initialFormat} />
}

function WordPractice({ initialList, initialFormat }: { initialList?: DailyWordList; initialFormat?: WordPracticeFormat }) {
  const t = useTranslations('dailyWords')
  const loading = useTranslations('loadingSections')
  const [initializing, setInitializing] = useState(true)
  const [vocabulary, setVocabulary] = useState<Map<string, Lexeme> | null>(getCachedVocabulary)
  const [queue, setQueue] = useState<DailyWordQueue | null>(getCachedDailyWords)
  const [dayNumber, setDayNumber] = useState(1)
  const [loadError, setLoadError] = useState(false)
  const [format, setFormat] = useState<WordPracticeFormat>(initialFormat ?? 'brainstorm')
  const [list, setList] = useState<DailyWordList>(initialList ?? 'learn')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<string[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<'ready' | 'checking' | 'saving' | 'saved' | 'failed' | 'unavailable'>('ready')
  const answering = useRef(false)
  const main = useRef<HTMLElement>(null)
  const initialized = useRef(false)
  const loadVersion = useRef(0)

  function load() {
    const version = ++loadVersion.current
    const active = () => version === loadVersion.current
    setLoadError(false)
    setInitializing(true)
    const wordsRequest = loadVocabulary().then((words) => {
      if (active()) setVocabulary(words)
      return words
    })
    const queueRequest = loadDailyWords().then((nextQueue) => {
      if (active()) setQueue(nextQueue)
      return nextQueue
    })
    const dayRequest = loadCurriculum().then((curriculum) => currentDayNumber(curriculum.stats.totalDays))
    void Promise.all([wordsRequest, queueRequest, dayRequest])
      .then(([words, nextQueue, day]) => {
        if (!active()) return
        setDayNumber(day)
        if (initialized.current) return
        initialized.current = true
        try {
          const raw = sessionStorage.getItem(SESSION_KEY)
          if (!raw) return
          const saved = JSON.parse(raw) as Omit<Session, 'words' | 'index' | 'list'> & { ids: string[]; list?: DailyWordList }
          if (saved.day !== nextQueue.day || !WORD_PRACTICE_FORMATS.includes(saved.format)) return
          const restoredList = saved.list ?? (saved.ids.some((id) => nextQueue.review.includes(id)) ? 'review' : 'learn')
          if ((initialList && initialList !== restoredList) || (initialFormat && initialFormat !== saved.format)) return
          const available = new Set(wordsForFormat(nextQueue, restoredList, saved.format))
          const remaining = saved.ids.flatMap((id) => available.has(id) ? words.get(id) ?? [] : [])
          if (remaining.length) {
            setList(restoredList)
            setFormat(saved.format)
            setSession({ ...saved, list: restoredList, words: remaining, index: 0,
              reviewFormats: restoredList === 'review' ? Object.fromEntries(remaining.map(({ id }) => [id, saved.reviewFormats?.[id] ?? reviewFormatsForWord(nextQueue, id)])) : undefined })
          }
        } catch { /* Session storage may be unavailable. */ }
      })
      .catch(() => { if (active()) setLoadError(true) })
      .finally(() => { if (active()) setInitializing(false) })
  }

  useEffect(() => {
    load()
    return () => { loadVersion.current += 1 }
  }, [])
  useEffect(() => {
    if (status !== 'ready') return
    let active = true
    const unsubscribe = subscribeDailyWords(() => {
      void loadDailyWords().then((fresh) => {
        if (!active) return
        setQueue(fresh)
        if (answering.current) return
        if (!session || session.format === 'brainstorm') return
        const available = new Set(wordsForFormat(fresh, session.list, session.format))
        const remaining = session.words.slice(session.index).filter(({ id }) => available.has(id))
        if (fresh.day !== session.day || remaining.length !== session.words.length - session.index) {
          setSession({ ...session, day: fresh.day, words: [...session.words.slice(0, session.index), ...remaining] })
          main.current?.scrollTo({ top: 0 })
        }
      }).catch(() => { if (active) setLoadError(true) })
    })
    return () => { active = false; unsubscribe() }
  }, [session, status])

  // A write can complete while the ready-only subscription is detached.
  useEffect(() => {
    if (status !== 'ready') return
    let active = true
    void loadDailyWords().then((fresh) => { if (active) setQueue(fresh) }).catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [status])

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
    return wordsForFormat(queue, list, format).filter((id) => {
      const word = vocabulary?.get(id)
      return word && (!search || word.lemma.toLocaleLowerCase().includes(search)
        || word.translation.toLocaleLowerCase().includes(search))
    })
  }, [list, format, query, queue, vocabulary])
  const selectedIds = selected.filter((id) => wordsForFormat(queue, list, format).includes(id))
  const sessionSize = SESSION_SIZE[format]
  const word = session?.words[session.index]
  const exercise = useMemo(() => {
    if (!session || session.format === 'brainstorm' || !word) return null
    const seed = hashString(session.id + word.id)
    const task = session.format === 'writing'
      ? { ...spelling(word, { seed }), attemptsAllowed: 1 }
      : dailyWordExercise(word, pool, session.format, seed)
    return { ...task, id: `${session.id}:${task.id}` }
  }, [pool, session, word])

  async function startBatch(batchList: DailyWordList, batchFormat: WordPracticeFormat, picked: string[] = []) {
    if (!vocabulary || initializing) return
    setLoadError(false)
    setStatus('checking')
    try {
      const fresh = await loadDailyWords()
      setQueue(fresh)
      const ids = wordsForFormat(fresh, batchList, batchFormat).filter((id) => !picked.length || picked.includes(id))
      const words = ids.slice(0, SESSION_SIZE[batchFormat]).flatMap((id) => vocabulary.get(id) ?? [])
      if (words.length) {
        setSession({ format: batchFormat, list: batchList, day: fresh.day, id: crypto.randomUUID(), index: 0, words, correct: 0, answered: 0,
          reviewFormats: batchList === 'review' ? Object.fromEntries(words.map(({ id }) => [id, reviewFormatsForWord(fresh, id)])) : undefined })
        main.current?.scrollTo({ top: 0 })
      }
    } catch {
      setLoadError(true)
    } finally {
      setStatus('ready')
    }
  }

  function refreshQueue() {
    void loadDailyWords().then(setQueue).catch(() => setLoadError(true))
  }

  function advance() {
    if (!session) return
    setLoadError(false)
    setSession({ ...session, index: session.index + 1 })
    setStatus('ready')
    main.current?.scrollTo({ top: 0 })
  }

  function answer(result: CheckResult, ms: number, attempts: number, response: string) {
    if (!session || session.format === 'brainstorm' || !word || !exercise || answering.current) return
    answering.current = true
    try {
      const state = getLoadedState()
      if (!state) throw new Error('word_state_not_loaded')
      const { format } = session
      const payload: DailyWordAnswer = {
        ...prepareLexemeReview(state.studyItems, word.id, wordSkill(format), result.correct ? Rating.Good : Rating.Again, ms),
        format,
        result: { dayNumber, exerciseId: exercise.id, attempts, correct: result.correct,
          answer: response, expected: result.expected, errorKind: result.errorKind ?? null },
      }
      // The shared outbox applies the FSRS result immediately and persists it
      // independently of this screen. No button ever waits for the POST.
      queueDailyWordAnswer(payload)
      setSession((current) => current && ({
        ...current, answered: current.answered + 1, correct: current.correct + Number(result.correct),
      }))
      setStatus('saved')
    } catch (error) {
      console.error('[word-practice]', error)
      setStatus('failed')
    } finally {
      answering.current = false
    }
  }

  function exit() {
    try { sessionStorage.removeItem(SESSION_KEY) } catch { /* Session storage may be unavailable. */ }
    setSession(null)
    setSelected([])
    setStatus('ready')
    setLoadError(false)
    load()
  }

  if (session?.format === 'brainstorm') {
    return <BrainstormPractice key={session.id} id={session.id} words={session.words} pool={pool}
      dayNumber={dayNumber} reviewFormats={session.reviewFormats} canContinue={Boolean(wordsForFormat(queue, session.list, session.format).length)}
      checking={status === 'checking'} loadError={loadError} onConsume={refreshQueue}
      onContinue={() => void startBatch(session.list, session.format)} onExit={exit} />
  }

  if (session) {
    const canAdvance = status === 'saved' || status === 'unavailable'
    const canContinue = Boolean(wordsForFormat(queue, session.list, session.format).length)
    return (
      <Screen className="word-practice-screen">
        <header className="mx-auto w-full max-w-2xl px-4 py-2">
          <Row justify="between" wrap>
            <Button variant="outline" size="sm" onClick={exit} disabled={status === 'checking'}>
              <AppIcon name="back" className="size-4 shrink-0" />
              {t('back')}
            </Button>
            <span className="text-sm text-muted">{t(session.format)} {word && `· ${session.index + 1} / ${session.words.length}`}</span>
          </Row>
        </header>
        <main ref={main} className="mx-auto w-full max-w-2xl flex-1 px-4 pb-2">
          {exercise ? (
            <Stack gap="xs">
              {exercise.kind === 'pronunciation' && exercise.mode === 'typed' ? (
                <PronunciationExercise key={exercise.id} prompt={exercise.prompt} expected={exercise.accepted[0]!}
                  onAnswered={answer} onSkip={status === 'ready' ? advance : undefined} />
              ) : (
                <ExerciseView key={exercise.id} exercise={exercise} onAnswered={answer}
                  practice showSpeakButton={session.format === 'translation' || status === 'saved'} />
              )}
              {status === 'unavailable' && <p role="status" className="text-sm text-muted">{t('unavailable')}</p>}
            </Stack>
          ) : (
            <Card><Stack gap="sm"><strong>{t('done')}</strong><p>{t('score', { correct: session.correct, total: session.answered })}</p></Stack></Card>
          )}
          {loadError && <p role="alert" className="mt-2 text-sm text-danger-ink">{t('error')}</p>}
        </main>
        <WordPracticeFooter
          busyLabel={status === 'checking' ? t('loading') : undefined}
          label={status === 'failed' ? t('backToFormats') : exercise ? t('next') : canContinue ? t('continue') : t('backToFormats')}
          disabled={!(canAdvance || status === 'failed' || !exercise) || status === 'checking'}
          onNext={status === 'failed' ? exit
            : exercise ? advance : canContinue ? () => void startBatch(session.list, session.format) : exit}
        />
      </Screen>
    )
  }

  return (
    <WordsShell>
      <Stack gap="sm">
        <WordSaveIndicator />
        <Row wrap gap="xs">
          {(['learn', 'review'] as const).map((kind) => (
            <Button key={kind} variant={list === kind ? 'primary' : 'outline'} aria-pressed={list === kind}
              onClick={() => { setList(kind); setSelected([]); setLimit(PAGE_SIZE) }}>
              {t(kind)} {queue ? queue[kind].length : loadError ? '—' : (
                <SkeletonBlock className="h-4 w-6 bg-current/15" />
              )}
            </Button>
          ))}
        </Row>
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-2 text-sm font-medium">{t('choose')}</legend>
          {WORD_PRACTICE_FORMATS.map((mode) => (
            <label key={mode} className={`flex min-h-12 cursor-pointer items-start gap-2 rounded-card border px-3 py-2 focus-within:ring-2 focus-within:ring-primary ${mode === 'brainstorm' ? 'col-span-2' : ''} ${format === mode ? 'border-primary bg-primary/5' : 'border-line bg-card hover:bg-soft'}`}>
              <input type="radio" name="word-format" className="mt-1 shrink-0 accent-primary" checked={format === mode}
                aria-label={t(mode)} aria-describedby={`word-format-${mode}`}
                onChange={() => { setFormat(mode); setSelected(selectedIds.filter((id) => wordsForFormat(queue, list, mode).includes(id)).slice(0, SESSION_SIZE[mode])) }} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{t(mode)}</span>
                <span id={`word-format-${mode}`} className="block text-xs text-muted">
                  {t('batchWords', { count: SESSION_SIZE[mode] })} · {t(`formatHint.${mode}`)}
                  {queue && list === 'review' && <span className="mt-1 block font-medium text-foreground">{t('availableCount', { count: wordsForFormat(queue, list, mode).length })}</span>}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {loadError && <Button variant="outline" onClick={load}>{t('reload')}</Button>}
        {!queue || (queue[list].length > 0 && !vocabulary) ? (
          !loadError && <LoadingSkeleton variant="list" visible label={loading(queue ? 'vocabulary' : 'wordCounts')} />
        ) : !wordsForFormat(queue, list, format).length ? <p role="status">{t('empty')}</p> : (
          <>
            <Button full disabled={loadError} busy={initializing || status === 'checking'}
              busyLabel={initializing ? loading('practice') : t('loading')} onClick={() => void startBatch(list, format, selectedIds)}>
              {t('start')}
            </Button>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE) }} placeholder={t('search')} aria-label={t('search')}
              className="min-h-12 rounded-card border border-line bg-card px-3" />
            <p className="text-sm text-muted">{t('selected', { selected: selectedIds.length, limit: sessionSize })}</p>
            <Card>
              {visibleIds.length === 0 && <p className="text-sm text-muted">{t('noMatches')}</p>}
              <div className="-my-2">
                {visibleIds.slice(0, limit).map((id) => {
                  const candidate = vocabulary?.get(id)
                  if (!candidate) return null
                  const picked = selectedIds.includes(id)
                  return <WordRow key={id} word={candidate} selectionControl={
                    <label className="flex min-h-12 min-w-12 cursor-pointer items-center justify-center">
                      <input type="checkbox" className="size-5 accent-primary" checked={picked}
                        aria-label={t('selectWord', { word: candidate.lemma })}
                        disabled={!picked && selectedIds.length >= sessionSize}
                        onChange={() => setSelected(picked ? selectedIds.filter((entry) => entry !== id) : [...selectedIds, id])} />
                    </label>
                  } />
                })}
              </div>
            </Card>
            {visibleIds.length > limit && (
              <Button variant="outline" full onClick={() => setLimit(limit + PAGE_SIZE)}>{t('showMore', { count: visibleIds.length - limit })}</Button>
            )}
          </>
        )}
      </Stack>
    </WordsShell>
  )
}

function WordsShell({ children }: { children: React.ReactNode }) {
  return (
    <TabBody controls={<SectionNav section="words" current="/words" />}>
    {children}
    </TabBody>
  )
}
