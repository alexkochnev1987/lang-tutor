'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Row } from '@polski/ui'
import { saveSettings, useSettings } from '@/lib/data/store'
import type { Settings } from '@/lib/data/types'
import { LOCALES, LOCALE_NAMES, isLocale } from '@/lib/i18n/messages'
import { AVAILABLE_RULE_LANGUAGES, RULE_LANGUAGE_NAMES, PACK_ORIGINAL_LANGUAGE } from '@/lib/content/rules'
import { ThemePicker } from './ThemePicker'

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
      <Row gap="md" wrap>
        <label className="flex min-h-12 items-center gap-2 text-sm text-muted">
          {t('settings.uiLanguage')}
          <select
            className="min-h-10 rounded-card border border-line bg-card px-2 text-ink"
            value={s.uiLanguage}
            onChange={(e) => {
              const v = e.target.value
              if (isLocale(v)) void update({ uiLanguage: v })
            }}
          >
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
          </select>
        </label>

        <label className="flex min-h-12 items-center gap-2 text-sm text-muted">
          {t('settings.ruleLanguage')}
          <select
            className="min-h-10 rounded-card border border-line bg-card px-2 text-ink"
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

        <Row gap="sm" wrap>
          <span className="text-sm text-muted">{t('dailyWords.timeZone', { zone: s.timeZone })}</span>
          <button type="button" className="min-h-12 rounded-card border border-line px-3 text-sm"
            onClick={() => void update({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>
            {t('dailyWords.useTimeZone')}
          </button>
        </Row>
        <Row gap="sm">
          <span className="text-sm text-muted">{t('settings.appearance')}</span>
          <ThemePicker />
        </Row>
      </Row>
      {status === 'saving' && <p role="status" className="text-sm text-muted">{t('profile.saving')}</p>}
      {status === 'error' && <p role="alert" className="text-sm text-danger-ink">{t('profile.saveError')}</p>}
    </fieldset>
  )
}
