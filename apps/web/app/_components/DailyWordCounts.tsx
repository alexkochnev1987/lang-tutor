'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { loadDailyWords, subscribeDailyWords } from '@/lib/data/store'
import type { DailyWordQueue } from '@/lib/engine/daily-words'

export function DailyWordCounts() {
  const t = useTranslations('dailyWords')
  const [queue, setQueue] = useState<DailyWordQueue | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    const update = () => {
      void loadDailyWords().then((next) => {
        if (active) { setQueue(next); setFailed(false) }
      }).catch(() => { if (active) setFailed(true) })
    }
    update()
    const unsubscribe = subscribeDailyWords(update)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return (
    <div className="grid grid-cols-2 gap-2">
      {(['learn', 'review'] as const).map((kind) => (
        <Link key={kind} href={`/words/?list=${kind}`}
          className="flex min-h-12 items-center justify-between gap-2 rounded-card border border-line bg-card px-3 py-2 text-sm font-medium hover:bg-soft">
          <span>{t(kind)}</span>
          <strong className="tabular-nums">{failed ? '—' : queue?.[kind].length ?? '…'}</strong>
        </Link>
      ))}
    </div>
  )
}
