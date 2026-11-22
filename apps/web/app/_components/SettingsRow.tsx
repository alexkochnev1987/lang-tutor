'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Stack } from '@polski/ui'
import { saveSettings, useSettings } from '@/lib/data/store'
import type { Settings } from '@/lib/data/types'
import { LOCALES, LOCALE_NAMES, isLocale } from '@/lib/i18n/messages'
import { AVAILABLE_RULE_LANGUAGES, RULE_LANGUAGE_NAMES, PACK_ORIGINAL_LANGUAGE } from '@/lib/content/rules'

export function SettingsRow() {
  const t = useTranslations()
  const s = useSettings()
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')

  async function update(settings: Partial<Pick<Settings, 'uiLanguage' | 'ruleLanguage' | 'timeZone'>>) {
    setStatus('saving')
    try {
      await saveSettings(settings)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  return (
    <fieldset disabled={status === 'saving'} className="min-w-0">
      <Stack gap="md">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">
            {t('settings.uiLanguage')}
            <select
              className="min-h-12 w-full min-w-0 rounded-control border border-line bg-card px-3 text-ink"
              value={s.uiLanguage}
              onChange={(e) => {
                const v = e.target.value
                if (isLocale(v)) void update({ uiLanguage: v })
              }}
            >
              {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
            </select>
          </label>

          <label className="grid min-w-0 gap-1.5 text-sm font-medium">
            {t('settings.ruleLanguage')}
            <select
              className="min-h-12 w-full min-w-0 rounded-control border border-line bg-card px-3 text-ink"
              value={s.ruleLanguage === 'pl' ? 'pl' : PACK_ORIGINAL_LANGUAGE}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'ru' || v === 'pl') void update({ ruleLanguage: v })
              }}
            >
              {AVAILABLE_RULE_LANGUAGES.map((l) => (
                <option key={l} value={l}>{RULE_LANGUAGE_NAMES[l]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-1.5 border-t border-line pt-3">
          <p className="text-sm text-muted [overflow-wrap:anywhere]">{t('dailyWords.timeZone', { zone: s.timeZone })}</p>
          <Button type="button" variant="outline" full onClick={() => {
            void update({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
          }}>
            {t('dailyWords.useTimeZone')}
          </Button>
        </div>
      </Stack>
      {status === 'saving' && <p role="status" className="text-sm text-muted">{t('profile.saving')}</p>}
      {status === 'error' && <p role="alert" className="text-sm text-danger-ink">{t('profile.saveError')}</p>}
    </fieldset>
  )
}
