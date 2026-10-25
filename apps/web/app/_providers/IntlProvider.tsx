'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { readSettings } from '@/lib/db/settings'
import { DEFAULT_LOCALE, MESSAGES, isLocale, type Locale } from '@/lib/i18n/messages'

export function IntlProvider({ children }: { children: ReactNode }) {
  // R12: querier только читает. Дефолт возвращается из памяти.
  const settings = useLiveQuery(() => readSettings(), [])
  const locale: Locale =
    settings && isLocale(settings.uiLanguage) ? settings.uiLanguage : DEFAULT_LOCALE

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale]}
      timeZone="Europe/Warsaw"
      now={undefined}
    >
      {children}
    </NextIntlClientProvider>
  )
}
