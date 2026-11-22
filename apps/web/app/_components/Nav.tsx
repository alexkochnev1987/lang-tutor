'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AppIcon } from './AppIcon'

const TABS = [
  { href: '/', key: 'today' },
  { href: '/program', key: 'course', alternate: '/progress' },
  { href: '/words', key: 'words', alternate: '/dictionary' },
  { href: '/grammar/', key: 'grammar' },
  { href: '/profile', key: 'profile' },
] as const

/**
 * Нижняя навигация. UX_UI.md §1.4: на телефоне всё управление внизу,
 * в зоне большого пальца.
 */
export function Nav() {
  const t = useTranslations('nav')
  const path = usePathname()

  return (
    <nav
      className="z-20 shrink-0 border-t border-line bg-card"
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto grid w-full max-w-2xl grid-cols-5 px-1 py-1">
        {TABS.map((tab) => {
          const alternate = 'alternate' in tab && (path === tab.alternate || path.startsWith(`${tab.alternate}/`))
          const route = tab.href === '/' ? tab.href : tab.href.replace(/\/$/, '')
          const active = alternate || path === route || path.startsWith(`${route}/`)
          // Let the PWA service worker handle this document navigation directly.
          const TabLink = tab.key === 'grammar' && !active ? 'a' : Link
          return (
            <TabLink
              key={tab.href}
              href={tab.href}
              aria-current={alternate ? 'location' : active ? 'page' : undefined}
              className={`group flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-control text-center text-[0.6875rem] leading-tight transition-colors active:bg-soft ${
                active ? 'font-semibold text-accent-ink' : 'font-medium text-muted'
              }`}
            >
              <span className={`flex h-7 w-11 items-center justify-center rounded-pill ${active ? 'bg-soft2' : 'group-hover:bg-soft'}`}>
                <AppIcon name={tab.key} className="size-5" />
              </span>
              {t(tab.key)}
            </TabLink>
          )
        })}
      </div>
    </nav>
  )
}
