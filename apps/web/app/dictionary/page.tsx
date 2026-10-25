'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Row, Screen, Segmented, Stack } from '@polski/ui'
import { Nav } from '@/app/_components/Nav'
import { WordRow } from '@/app/_components/WordRow'
import { loadVocabulary, type Lexeme } from '@/lib/content/curriculum'
import { useAppState } from '@/lib/data/store'

type Filter = 'all' | 'learning' | 'known' | 'untouched'

const FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'learning', label: 'В работе' },
  { value: 'known', label: 'Знаю' },
  { value: 'untouched', label: 'Не начато' },
] as const

const PAGE_SIZE = 40

export default function DictionaryPage() {
  const state = useAppState()
  const [words, setWords] = useState<Lexeme[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)

  useEffect(() => {
    let alive = true
    loadVocabulary().then((v) => alive && setWords([...v.values()]))
    return () => { alive = false }
  }, [])

  const knownIds = useMemo(
    () => new Set((state?.lexemeStatus ?? [])
      .filter((l) => l.status === 'known').map((l) => l.lexemeId)),
    [state?.lexemeStatus])

  const startedIds = useMemo(
    () => new Set((state?.studyItems ?? []).map((i) => i.refId)),
    [state?.studyItems])

  const visible = useMemo(() => {
    if (!words) return []
    const q = query.trim().toLowerCase()
    return words.filter((w) => {
      if (q && !w.lemma.toLowerCase().includes(q) && !w.translation.toLowerCase().includes(q)) {
        return false
      }
      if (filter === 'known') return knownIds.has(w.id)
      if (filter === 'learning') return !knownIds.has(w.id) && startedIds.has(w.id)
      if (filter === 'untouched') return !knownIds.has(w.id) && !startedIds.has(w.id)
      return true
    })
  }, [words, query, filter, knownIds, startedIds])

  useEffect(() => { setLimit(PAGE_SIZE) }, [filter, query])

  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <Stack gap="sm">
          <Row justify="between">
            <h1 className="text-lg font-semibold">Словарь</h1>
            <span className="text-sm tabular-nums text-muted">
              {knownIds.size} знаю · {words?.length ?? 0} всего
            </span>
          </Row>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по слову или переводу"
            className="min-h-12 w-full rounded-card border border-line bg-card px-3 text-base text-ink"
          />
          <Segmented
            options={FILTERS}
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

          {!words && <Card><p className="text-sm text-muted">Загрузка…</p></Card>}

          {words && visible.length === 0 && (
            <Card><p className="text-sm text-muted">Ничего не нашлось</p></Card>
          )}

          {visible.length > 0 && (
            <Card>
              <div className="-my-2">
                {visible.slice(0, limit).map((w) => <WordRow key={w.id} word={w} />)}
              </div>
            </Card>
          )}

          {visible.length > limit && (
            <Button variant="ghost" full onClick={() => setLimit(limit + PAGE_SIZE)}>
              Показать ещё · осталось {visible.length - limit}
            </Button>
          )}
        </Stack>
      </main>

      <Nav />
    </Screen>
  )
}
