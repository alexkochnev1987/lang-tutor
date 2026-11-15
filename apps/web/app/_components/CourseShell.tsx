'use client'

import { Screen, Stack } from '@polski/ui'
import { Nav } from './Nav'
import { SectionHeading } from './SectionHeading'
import { SectionNav } from './SectionNav'

export function CourseShell({ children, current }: {
  children: React.ReactNode
  current: '/program' | '/progress'
}) {
  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <Stack gap="sm">
          <SectionHeading section="course" />
          <SectionNav section="course" current={current} />
        </Stack>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4">
        <Stack gap="lg">{children}</Stack>
      </main>
      <Nav />
    </Screen>
  )
}
