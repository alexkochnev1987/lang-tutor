'use client'

import { Screen } from '@polski/ui'
import { Nav } from './_components/Nav'
import { SectionHeading } from './_components/SectionHeading'
import { TodayCard } from './_components/TodayCard'

/**
 * Экран «Сегодня».
 *
 * R1: в этом файле нет оформительских Tailwind-классов — только
 * семантические компоненты и позиционирование.
 */
export default function TodayPage() {
  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <SectionHeading section="today" />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4">
        <TodayCard />
      </main>

      <Nav />
    </Screen>
  )
}
