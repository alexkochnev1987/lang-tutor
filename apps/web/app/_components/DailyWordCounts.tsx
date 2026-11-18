'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, Row } from '@polski/ui'
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
    <Card>
      <Row gap="lg" wrap>
        <span>{t('learn')} <strong>{failed ? '—' : queue?.learn.length ?? '…'}</strong></span>
        <span>{t('review')} <strong>{failed ? '—' : queue?.review.length ?? '…'}</strong></span>
      </Row>
    </Card>
  )
}
