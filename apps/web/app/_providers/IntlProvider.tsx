'use client'

import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { useSettings } from '@/lib/data/store'
import { DEFAULT_LOCALE, MESSAGES, isLocale, type Locale } from '@/lib/i18n/messages'

export function IntlProvider({ children }: { children: ReactNode }) {
  // Пока состояние не пришло, useSettings отдаёт дефолты из памяти —
  // дерево рендерится сразу, без пустого экрана.
  const settings = useSettings()
  const locale: Locale =
    isLocale(settings.uiLanguage) ? settings.uiLanguage : DEFAULT_LOCALE

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
