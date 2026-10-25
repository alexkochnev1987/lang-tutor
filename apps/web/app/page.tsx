'use client'

import { useTranslations } from 'next-intl'
import { Row, Screen, Stack } from '@polski/ui'
import { SettingsRow } from './_components/SettingsRow'
import { SignInButton } from './_components/SignInButton'
import { ThemePicker } from './_components/ThemePicker'
import { TodayCard } from './_components/TodayCard'

/**
 * Экран «Сегодня».
 *
 * R1: в этом файле нет оформительских Tailwind-классов — только
 * семантические компоненты и позиционирование.
 */
export default function TodayPage() {
  const t = useTranslations()

  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <Row justify="between">
          <Stack gap="none">
            <strong className="text-lg">{t('app.name')}</strong>
            <span className="text-xs text-muted">{t('app.tagline')}</span>
          </Stack>
          <Row gap="xs">
            <ThemePicker />
            <SignInButton />
          </Row>
        </Row>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4">
        <Stack gap="lg">
          <TodayCard />
          <SettingsRow />
        </Stack>
      </main>

      <footer className="mx-auto w-full max-w-2xl px-4 py-6">
        <p className="text-xs text-muted">
          Данные хранятся только в этом браузере. Бэкенда нет.
        </p>
      </footer>
    </Screen>
  )
}
