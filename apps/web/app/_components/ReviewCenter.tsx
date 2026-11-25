'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, Row, Stack } from '@polski/ui'
import { loadLiveReadingCatalog } from '@/lib/content/curriculum'
import type { ReadingCatalogEntry } from '@/lib/content/reading-catalog'
import { readingBacklog } from '@/lib/content/reading-progress'
import { useAppState } from '@/lib/data/store'

export function ReviewCenter() {
  const t = useTranslations('reviewCenter')
  const state = useAppState()
  const [entries, setEntries] = useState<ReadingCatalogEntry[] | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let alive = true
    setError(false)
    loadLiveReadingCatalog().then(rows => { if (alive) setEntries(rows) }).catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [retry])
  const completed = new Set((state?.sessions ?? []).filter(s => s.kind === 'day' && s.completedAt).map(s => s.dayNumber))
  const counts = state && entries && entries.every(e => e.questionIds?.length) ? readingBacklog(entries, state.exerciseResults, completed) : null
  const weak = state?.mastery.filter(r => r.mastery < 0.6 && r.attempts > 0).length
  const rows = [
    { key: 'missed', href: '/reading/?filter=missed', count: counts?.missed },
    { key: 'unfinished', href: '/reading/?filter=unfinished', count: counts?.unfinished },
    { key: 'mistakes', href: '/reading/?filter=mistakes', count: counts?.mistakes },
    { key: 'grammar', href: '/grammar/', count: weak },
  ] as const
  return <Card><Stack gap="sm">
    <h2 className="text-lg font-semibold">{t('title')}</h2>
    {rows.map(row => <Link key={row.key} href={row.href} className="rounded-card border border-line px-3 py-3 hover:bg-soft">
      <Row align="center" justify="between"><Stack gap="none"><strong className="text-sm">{t(row.key)}</strong><span className="text-xs text-muted">{t(row.key + 'Hint')}</span></Stack>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{row.count ?? '—'} →</span></Row>
    </Link>)}
    {error && <button className="text-sm text-muted underline" onClick={() => setRetry(n => n + 1)}>{t('retry')}</button>}
  </Stack></Card>
}
