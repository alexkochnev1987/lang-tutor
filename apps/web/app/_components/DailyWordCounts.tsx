'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { loadDailyWords, subscribeDailyWords } from '@/lib/data/store'
import { AppIcon } from './AppIcon'
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
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {(['learn', 'review'] as const).map((kind) => (
        <Link key={kind} href={`/words/?list=${kind}`}
          className="flex min-h-[4.5rem] min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-card border border-line bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-soft active:bg-soft2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-soft2 text-accent-ink">
            <AppIcon name={kind === 'learn' ? 'words' : 'review'} className="size-4" />
          </span>
          <span className="min-w-0 flex-1 basis-16 leading-tight">{t(kind)}</span>
          <strong className="ml-auto text-base tabular-nums">{failed ? '—' : queue?.[kind].length ?? '…'}</strong>
        </Link>
      ))}
    </div>
  )
}
