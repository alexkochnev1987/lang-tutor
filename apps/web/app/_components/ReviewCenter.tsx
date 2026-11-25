'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, Stack } from '@polski/ui'
import { loadLiveReadingCatalog } from '@/lib/content/curriculum'
import type { ReadingCatalogEntry } from '@/lib/content/reading-catalog'
import { readingBacklog } from '@/lib/content/reading-progress'
import { loadState, useAppState } from '@/lib/data/store'
import { assignmentReviewRows, type AssignmentReviewData } from '@/lib/engine/assignment-progress'

export function ReviewCenter() {
  const t = useTranslations('reviewCenter')
  const state = useAppState()
  const [entries, setEntries] = useState<ReadingCatalogEntry[] | null>(null)
  const [reviewData, setReviewData] = useState<AssignmentReviewData | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let alive = true
    setError(false)
    loadLiveReadingCatalog().then(rows => { if (alive) setEntries(rows) }).catch(() => { if (alive) setError(true) })
    setReviewData(null)
    loadState().then(() => fetch('/api/lesson-assignments/?summary=1', { cache:'no-store' })).then(async response => {
      if (!response.ok) throw new Error('assignment_summary_failed')
      return response.json() as Promise<AssignmentReviewData>
    }).then(result => { if (alive) setReviewData(result) }).catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [retry, state?.user.id])
  const completed = new Set((state?.sessions ?? []).filter(s => s.kind === 'day' && s.completedAt).map(s => s.dayNumber))
  const counts = state && entries && entries.every(e => e.questionIds?.length) ? readingBacklog(entries, state.exerciseResults, completed) : null
  const assignments = state && reviewData ? assignmentReviewRows(reviewData.summaries, state.exerciseResults, completed, reviewData.archive) : null
  const totalMissing = assignments && counts ? assignments.reduce((n,row) => n + row.missing.length,0) + counts.missed + counts.unfinished : null
  const totalMistakes = assignments && counts ? assignments.reduce((n,row) => n + row.mistakes.length,0) + counts.mistakes : null
  return <Card><Stack gap="sm">
    <h2 className="text-lg font-semibold">{t('title')}</h2>
    {[{ key:'compactMissing', filter:'missing', count:totalMissing }, { key:'compactMistakes', filter:'mistakes', count:totalMistakes }].map(row =>
      <Link key={row.key} href={'/review/?filter=' + row.filter} className="flex min-h-14 items-center justify-between gap-3 border-t border-line py-2">
        <Stack gap="none"><strong className="text-sm">{t(row.key)}</strong><span className="text-xs text-muted">{t(row.key + 'Hint')}</span></Stack>
        <span className="shrink-0 font-semibold tabular-nums">{row.count ?? '—'} →</span>
      </Link>)}
    {error && <button className="text-sm text-muted underline" onClick={() => setRetry(n => n + 1)}>{t('retry')}</button>}
  </Stack></Card>
}
