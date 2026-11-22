'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

const sections = {
  words: [
    { href: '/words', label: 'studyWords' },
    { href: '/dictionary', label: 'dictionary' },
  ],
  course: [
    { href: '/program', label: 'plan' },
    { href: '/progress', label: 'progress' },
  ],
} as const

type SectionNavProps =
  | { section: 'words'; current: '/words' | '/dictionary' }
  | { section: 'course'; current: '/program' | '/progress' }

export function SectionNav({ section, current }: SectionNavProps) {
  const t = useTranslations('nav')

  return (
    <nav aria-label={t(section)} className="grid grid-cols-2 gap-1 rounded-card bg-soft p-1">
      {sections[section].map(({ href, label }) => {
        const active = href === current
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-11 items-center justify-center rounded-control px-2 text-center text-sm font-medium ${
              active ? 'bg-card text-accent-ink shadow-card' : 'text-muted hover:bg-soft2 hover:text-ink'
            }`}
          >
            {t(label)}
          </Link>
        )
      })}
    </nav>
  )
}
