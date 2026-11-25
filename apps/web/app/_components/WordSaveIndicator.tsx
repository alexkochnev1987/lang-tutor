'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from './AppIcon'
import { loadState, restoreWordAnswers, retryFailedWordAnswers, useWordSaveStatus } from '@/lib/data/store'

/** Shared non-blocking save feedback. Retry stays available after navigating. */
export function WordSaveIndicator() {
  const t = useTranslations('dailyWords')
  const { pending, failed } = useWordSaveStatus()

  useEffect(() => {
    void loadState().then(restoreWordAnswers).catch((error) =>
      console.error('[word-outbox]', error))
  }, [])

  const pendingLabel = pending > 0 ? t('savingInBackground', { count: pending }) : ''
  const failedLabel = failed > 0 ? t('saveFailed', { count: failed }) : ''

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 text-xs text-muted">
      <span role="status" aria-live="polite" className="sr-only">
        {[pendingLabel, failedLabel].filter(Boolean).join(' · ')}
      </span>
      <span className="inline-flex h-11 min-w-12 items-center gap-1"
        title={pendingLabel || undefined} aria-hidden="true">
        {pending > 0 && <>
          <AppIcon name="sync" className="size-4 motion-safe:animate-spin" />
          <span className="tabular-nums">{pending}</span>
        </>}
      </span>
      {failed > 0 && (
        <button type="button" onClick={retryFailedWordAnswers}
          aria-label={`${failedLabel}. ${t('retrySave')}`} title={`${failedLabel}. ${t('retrySave')}`}
          className="inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-control px-2 text-danger-ink focus-visible:outline-2">
          <AppIcon name="cloudOff" className="size-4" />
          <span className="tabular-nums" aria-hidden="true">{failed}</span>
        </button>
      )}
    </div>
  )
}
