'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Row, Screen, Segmented, Stack } from '@polski/ui'
import { LoadingSkeleton, SkeletonBlock } from '@/app/_components/LoadingSkeleton'
import { Nav } from '@/app/_components/Nav'
import { SectionHeading } from '@/app/_components/SectionHeading'
import { SectionNav } from '@/app/_components/SectionNav'
import { WordRow } from '@/app/_components/WordRow'
import { loadVocabulary, type Lexeme } from '@/lib/content/curriculum'
import { loadState, useAppState } from '@/lib/data/store'

type Filter = 'all' | 'learning' | 'known' | 'untouched'

const FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'learning', label: 'В работе' },
  { value: 'known', label: 'Знаю' },
  { value: 'untouched', label: 'Не начато' },
] as const

const PAGE_SIZE = 40

function completedWordId(sessionId: string): string | null {
  const marker = ':word:'
  const markerIndex = sessionId.lastIndexOf(marker)
  return markerIndex >= 0 ? sessionId.slice(markerIndex + marker.length) : null
}

export default function DictionaryPage() {
  const state = useAppState()
  const [words, setWords] = useState<Lexeme[] | null>(null)
  const [vocabularyError, setVocabularyError] = useState(false)
  const [stateError, setStateError] = useState(false)
  const [vocabularyAttempt, setVocabularyAttempt] = useState(0)
  const [stateAttempt, setStateAttempt] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)

  useEffect(() => {
    let alive = true
    loadVocabulary()
      .then((v) => { if (alive) setWords([...v.values()]) })
      .catch(() => { if (alive) setVocabularyError(true) })
    return () => { alive = false }
  }, [vocabularyAttempt])

  useEffect(() => {
    let alive = true
    void loadState().catch(() => { if (alive) setStateError(true) })
    return () => { alive = false }
  }, [stateAttempt])

  const knownIds = useMemo(
    () => new Set((state?.lexemeStatus ?? [])
      .filter((l) => l.status === 'known').map((l) => l.lexemeId)),
    [state?.lexemeStatus])

  const startedIds = useMemo(
    () => new Set((state?.studyItems ?? []).map((i) => i.refId)),
    [state?.studyItems])

  const completedIds = useMemo(
    () => new Set((state?.sessions ?? [])
      .filter((session) => session.kind === 'words' && session.completedAt)
      .map((session) => completedWordId(session.id))
      .filter((id): id is string => Boolean(id))),
    [state?.sessions],
  )

  const filteredWords = useMemo(() => {
    const groups: Record<Filter, Lexeme[]> = { all: [], learning: [], known: [], untouched: [] }
    const q = query.trim().toLowerCase()
    for (const w of words ?? []) {
      if (q && !w.lemma.toLowerCase().includes(q) && !w.translation.toLowerCase().includes(q)) {
        continue
      }
      groups.all.push(w)
      if (knownIds.has(w.id)) groups.known.push(w)
      else if (startedIds.has(w.id)) groups.learning.push(w)
      else groups.untouched.push(w)
    }
    return groups
  }, [words, query, knownIds, startedIds])
  const visible = filteredWords[filter]
  const filterOptions = FILTERS.map((option) => ({
    ...option,
    count: words && (state || option.value === 'all') ? filteredWords[option.value].length : undefined,
  }))

  const loadingFilter = !state && filter !== 'all'

  const personalVisible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (state?.personalDict ?? []).filter((word) => (
      !q || word.lemma.toLowerCase().includes(q) || word.translation.toLowerCase().includes(q)
    ))
  }, [state?.personalDict, query])

  useEffect(() => { setLimit(PAGE_SIZE) }, [filter, query])

  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <Stack gap="sm">
          <SectionHeading section="words" />
          <SectionNav section="words" current="/dictionary" />
          {state && words ? (
            <p className="text-sm tabular-nums text-muted">
              {knownIds.size} знаю · {completedIds.size} пройдено · {words.length} всего
            </p>
          ) : (
            <p className="text-xs text-muted" role="status">{vocabularyError || (!state && stateError) ? 'Статистика недоступна' : 'Загрузка статистики…'}</p>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по слову или переводу"
            className="min-h-12 w-full rounded-control border border-line bg-card px-3.5 text-base text-ink placeholder:text-muted"
          />
          <Segmented
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            ariaLabel="Фильтр словаря"
          />
        </Stack>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4">
        <Stack gap="md">
          <Card>
            <p className="text-xs text-muted">
              «Знаю» убирает слово из практики, но его статистика повторений
              сохраняется. Вернёте «учу» — слово придёт на повторение по
              своему прежнему сроку, а не начнётся заново.
            </p>
          </Card>

          {!state && (
            <Card>
              <h2 className="text-base font-semibold">Мой словарь</h2>
              {stateError ? (
                <Stack gap="sm" className="mt-2">
                  <p role="alert" className="text-sm text-danger-ink">Не удалось загрузить сохранённые слова и статусы.</p>
                  <Button variant="outline" onClick={() => {
                    setStateError(false)
                    setStateAttempt((current) => current + 1)
                  }}>Повторить</Button>
                </Stack>
              ) : (
                <div className="mt-3 grid gap-2">
                  <p role="status" className="sr-only">Загружаем сохранённые слова…</p>
                  <SkeletonBlock className="h-4 w-1/2" />
                  <SkeletonBlock className="h-3 w-2/3" />
                </div>
              )}
            </Card>
          )}
          {personalVisible.length > 0 && (
            <Card>
              <Stack gap="sm">
                <Row justify="between">
                  <h2 className="text-base font-semibold">Мой словарь</h2>
                  <span className="text-sm tabular-nums text-muted">{personalVisible.length}</span>
                </Row>
                <div>
                  {personalVisible.map((word) => (
                    <div key={word.id} className="border-b border-line py-2 last:border-0">
                      <div className="text-base font-medium" lang="pl">{word.lemma}</div>
                      <div className="text-sm text-muted">{word.translation}</div>
                    </div>
                  ))}
                </div>
              </Stack>
            </Card>
          )}

          {vocabularyError && (
            <Card><Stack gap="sm">
              <p className="text-sm text-danger-ink" role="alert">Не удалось загрузить словарь.</p>
              <Button variant="outline" onClick={() => {
                setVocabularyError(false)
                setVocabularyAttempt((current) => current + 1)
              }}>Повторить</Button>
            </Stack></Card>
          )}
          {((!words && !vocabularyError) || (words && loadingFilter && !stateError)) && (
            <LoadingSkeleton variant="list" />
          )}

          {words && !loadingFilter && visible.length === 0 && (
            <Card><p className="text-sm text-muted">Ничего не нашлось</p></Card>
          )}

          {!loadingFilter && visible.length > 0 && (
            <Card>
              <div className="-my-2">
                {visible.slice(0, limit).map((w) => (
                  <WordRow key={w.id} word={w} completed={completedIds.has(w.id)} />
                ))}
              </div>
            </Card>
          )}

          {!loadingFilter && visible.length > limit && (
            <Button variant="outline" full onClick={() => setLimit(limit + PAGE_SIZE)}>
              Показать ещё · осталось {visible.length - limit}
            </Button>
          )}
        </Stack>
      </main>

      <Nav />
    </Screen>
  )
}
