'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslations } from 'next-intl'
import { Row } from '@polski/ui'
import { readSettings, writeSetting, DEFAULT_SETTINGS } from '@/lib/db/settings'
import { LOCALES, LOCALE_NAMES, isLocale } from '@/lib/i18n/messages'
import { ThemePicker } from './ThemePicker'

export function SettingsRow() {
  const t = useTranslations('settings')
  // R12: querier только читает, дефолт приходит из памяти
  const s = useLiveQuery(() => readSettings(), []) ?? DEFAULT_SETTINGS

  return (
    <Row gap="md" wrap>
      <label className="flex min-h-12 items-center gap-2 text-sm text-muted">
        {t('uiLanguage')}
        <select
          className="min-h-10 rounded-card border border-line bg-card px-2 text-ink"
          value={s.uiLanguage}
          onChange={(e) => {
            const v = e.target.value
            if (isLocale(v)) void writeSetting('uiLanguage', v)
          }}
        >
          {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
        </select>
      </label>

      <Row gap="sm">
        <span className="text-sm text-muted">{t('appearance')}</span>
        <ThemePicker />
      </Row>
    </Row>
  )
}
