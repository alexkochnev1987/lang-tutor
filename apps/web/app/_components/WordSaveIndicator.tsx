'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { loadState, restoreWordAnswers, retryFailedWordAnswers, useWordSaveStatus } from '@/lib/data/store'

/** Shared non-blocking save feedback. Retry stays available after navigating. */
export function WordSaveIndicator() {
  const t = useTranslations('dailyWords')
  const { pending, failed } = useWordSaveStatus()

  useEffect(() => {
    void loadState().then(restoreWordAnswers).catch((error) =>
      console.error('[word-outbox]', error))
  }, [])

  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-2 text-xs text-muted"
      role="status" aria-live="polite">
      {pending > 0 && <span>{t('savingInBackground', { count: pending })}</span>}
      {failed > 0 && (
        <>
          <span className="text-danger-ink">{t('saveFailed', { count: failed })}</span>
          <button type="button" onClick={retryFailedWordAnswers}
            className="min-h-8 font-medium text-primary underline underline-offset-2">
            {t('retrySave')}
          </button>
        </>
      )}
    </div>
  )
}
