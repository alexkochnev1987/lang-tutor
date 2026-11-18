'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button, Card, Row, Screen, Stack } from '@polski/ui'
import { hashString, spelling, type CheckResult } from '@polski/engine'
import { BrainstormPractice } from '@/app/_components/BrainstormPractice'
import { ExerciseView } from '@/app/_components/ExerciseView'
import { Nav } from '@/app/_components/Nav'
import { SectionHeading } from '@/app/_components/SectionHeading'
import { SectionNav } from '@/app/_components/SectionNav'
import { WordPracticeFooter } from '@/app/_components/WordPracticeFooter'
import { WordRow } from '@/app/_components/WordRow'
import { currentDayNumber, loadCurriculum, loadVocabulary, type Lexeme } from '@/lib/content/curriculum'
import { loadDailyWords, loadState, saveDailyWordAnswer, subscribeDailyWords } from '@/lib/data/store'
import { dailyWordExercise, WORD_PRACTICE_FORMATS, wordSkill, type DailyWordAnswer, type DailyWordList, type DailyWordQueue, type WordPracticeFormat } from '@/lib/engine/daily-words'
import { prepareLexemeReview, Rating } from '@/lib/engine/session'

const SESSION_SIZE: Record<WordPracticeFormat, number> = { brainstorm: 5, translation: 10, reverse: 10, writing: 5, listening: 5 }
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
}

export default function WordsPage() {
  return <Suspense><WordsWithList /></Suspense>
}

function WordsWithList() {
  const requested = useSearchParams().get('list')
  const initialList = requested === 'review' || requested === 'learn' ? requested : undefined
  return <WordPractice key={initialList ?? 'default'} initialList={initialList} />
}

function WordPractice({ initialList }: { initialList?: DailyWordList }) {
  const t = useTranslations('dailyWords')
  const [vocabulary, setVocabulary] = useState<Map<string, Lexeme> | null>(null)
  const [queue, setQueue] = useState<DailyWordQueue | null>(null)
  const [dayNumber, setDayNumber] = useState(1)
  const [loadError, setLoadError] = useState(false)
  const [format, setFormat] = useState<WordPracticeFormat>('brainstorm')
  const [list, setList] = useState<DailyWordList>(initialList ?? 'learn')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
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
          const saved = JSON.parse(raw) as Omit<Session, 'words' | 'index' | 'list'> & { ids: string[]; list?: DailyWordList }
          if (saved.day !== nextQueue.day || !WORD_PRACTICE_FORMATS.includes(saved.format)) return
          const restoredList = saved.list ?? (saved.ids.some((id) => nextQueue.review.includes(id)) ? 'review' : 'learn')
          if (initialList && initialList !== restoredList) return
          const available = new Set(nextQueue[restoredList])
          const remaining = saved.ids.flatMap((id) => available.has(id) ? words.get(id) ?? [] : [])
          if (remaining.length) {
            setList(restoredList)
            setFormat(saved.format)
            setSession({ ...saved, list: restoredList, words: remaining, index: 0 })
          }
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
        if (!session || session.format === 'brainstorm') return
        const available = new Set(fresh[session.list])
        const remaining = session.words.slice(session.index).filter(({ id }) => available.has(id))
        if (fresh.day !== session.day || remaining.length !== session.words.length - session.index) {
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
    })
  }, [list, query, queue, vocabulary])
  const selectedIds = selected.filter((id) => queue?.[list].includes(id))
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
    if (!vocabulary) return
    setLoadError(false)
    setStatus('checking')
    try {
      const fresh = await loadDailyWords()
      setQueue(fresh)
      const ids = fresh[batchList].filter((id) => !picked.length || picked.includes(id))
      const words = ids.slice(0, SESSION_SIZE[batchFormat]).flatMap((id) => vocabulary.get(id) ?? [])
      if (words.length) {
        setSession({ format: batchFormat, list: batchList, day: fresh.day, id: crypto.randomUUID(), index: 0, words, correct: 0, answered: 0 })
        main.current?.scrollTo({ top: 0 })
      }
    } catch {
      setLoadError(true)
    } finally {
      setStatus('ready')
    }
  }

  function consumeWord(wordId: string) {
    setQueue((current) => current && ({
      ...current,
      learn: current.learn.filter((id) => id !== wordId),
      review: current.review.filter((id) => id !== wordId),
    }))
  }

  function advance() {
    if (!session) return
    setLoadError(false)
    setSession({ ...session, index: session.index + 1 })
    setStatus('ready')
    main.current?.scrollTo({ top: 0 })
  }

  async function persist() {
    const payload = pending.current
    if (!payload) return
    setStatus('saving')
    try {
      const accepted = await saveDailyWordAnswer(payload)
      pending.current = null
      setStatus(accepted ? 'saved' : 'unavailable')
      consumeWord(payload.item.refId)
      if (accepted) setSession((current) => current && ({
        ...current, answered: current.answered + 1, correct: current.correct + Number(payload.result.correct),
      }))
    } catch {
      setStatus('failed')
    }
  }

  async function answer(result: CheckResult, ms: number, attempts: number, response: string) {
    if (!session || session.format === 'brainstorm' || !word || !exercise || answering.current) return
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

  if (session?.format === 'brainstorm') {
    return <BrainstormPractice key={session.id} id={session.id} words={session.words} pool={pool}
      dayNumber={dayNumber} canContinue={Boolean(queue?.[session.list].length)}
      checking={status === 'checking'} loadError={loadError} onConsume={consumeWord}
      onContinue={() => void startBatch(session.list, session.format)} onExit={exit} />
  }

  if (session) {
    const canAdvance = status === 'saved' || status === 'unavailable'
    const canContinue = Boolean(queue?.[session.list].length)
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
                autoFocus={false} showSpeakButton={session.format === 'translation' || status === 'saved'} />
              {status === 'unavailable' && <p role="status" className="text-sm text-muted">{t('unavailable')}</p>}
            </Stack>
          ) : (
            <Card><Stack gap="sm"><strong>{t('done')}</strong><p>{t('score', { correct: session.correct, total: session.answered })}</p></Stack></Card>
          )}
          {loadError && <p role="alert" className="mt-2 text-sm text-danger-ink">{t('error')}</p>}
        </main>
        <WordPracticeFooter
          label={status === 'saving' ? t('saving') : status === 'failed' ? t('retry') : status === 'checking' ? t('loading')
            : exercise ? t('next') : canContinue ? t('continue') : t('choose')}
          disabled={!(canAdvance || status === 'failed' || !exercise) || status === 'checking'}
          onNext={status === 'failed' ? () => void persist()
            : exercise ? advance : canContinue ? () => void startBatch(session.list, session.format) : exit}
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
                onClick={() => { setList(kind); setSelected([]); setLimit(PAGE_SIZE) }}>
                {t(kind)} {queue ? queue[kind].length : '…'}
              </Button>
            ))}
          </Row>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-2 text-sm font-medium">{t('choose')}</legend>
            {WORD_PRACTICE_FORMATS.map((mode) => (
              <label key={mode} className={`flex min-h-12 cursor-pointer items-start gap-2 rounded-card border px-3 py-2 focus-within:ring-2 focus-within:ring-primary ${mode === 'brainstorm' ? 'col-span-2' : ''} ${format === mode ? 'border-primary bg-primary/5' : 'border-line bg-card hover:bg-soft'}`}>
                <input type="radio" name="word-format" className="mt-1 shrink-0 accent-primary" checked={format === mode}
                  aria-label={t(mode)} aria-describedby={`word-format-${mode}`}
                  onChange={() => { setFormat(mode); setSelected(selectedIds.slice(0, SESSION_SIZE[mode])) }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{t(mode)}</span>
                  <span id={`word-format-${mode}`} className="block text-xs text-muted">
                    {t('batchWords', { count: SESSION_SIZE[mode] })} · {t(`formatHint.${mode}`)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {loadError ? <Button variant="outline" onClick={load}>{t('reload')}</Button> : !queue ? (
            <p role="status">{t('loading')}</p>
          ) : !queue[list].length ? <p role="status">{t('empty')}</p> : (
            <>
              <Button full onClick={() => void startBatch(list, format, selectedIds)} disabled={status === 'checking'}>{status === 'checking' ? t('loading') : t('start')}</Button>
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
      </main>
      <Nav />
    </Screen>
  )
}
