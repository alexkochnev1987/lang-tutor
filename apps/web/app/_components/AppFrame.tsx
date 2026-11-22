'use client'

import { usePathname } from 'next/navigation'
import { Screen } from '@polski/ui'
import { Nav } from './Nav'
import { SectionHeading, type Section } from './SectionHeading'

const sections: Partial<Record<string, Section>> = {
  '/': 'today',
  '/program': 'course',
  '/progress': 'course',
  '/words': 'words',
  '/dictionary': 'words',
  '/grammar': 'grammar',
  '/profile': 'profile',
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const section = sections[pathname.replace(/\/$/, '') || '/']

  if (!section) return children

  return (
    <Screen className="app-tab-frame">
      <header className="app-tab-heading mx-auto w-full max-w-2xl px-4 py-3">
        <SectionHeading section={section} />
      </header>
      <div className="app-tab-content flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      <Nav />
    </Screen>
  )
}
