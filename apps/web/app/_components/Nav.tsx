'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

const TABS = [
  { href: '/',           key: 'today',      icon: '📅' },
  { href: '/program',    key: 'course',     icon: '🧭', alternate: '/progress' },
  { href: '/words',      key: 'words',      icon: '🧠', alternate: '/dictionary' },
  { href: '/grammar',    key: 'grammar',    icon: '📘' },
  { href: '/profile',    key: 'profile',    icon: '👤' },
] as const

/**
 * Нижняя навигация. UX_UI.md §1.4: на телефоне всё управление внизу,
 * в зоне большого пальца. На широком экране уезжает наверх.
 */
export function Nav() {
  const t = useTranslations('nav')
  const path = usePathname()

  return (
    <nav
      className="z-20 shrink-0 border-t border-line bg-card lg:static lg:border-0 lg:bg-transparent"
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex w-full max-w-2xl">
        {TABS.map((tab) => {
          const alternate = 'alternate' in tab && (path === tab.alternate || path.startsWith(`${tab.alternate}/`))
          const active = alternate || path === tab.href || path.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={alternate ? 'location' : active ? 'page' : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                active ? 'text-primary' : 'text-muted'
              }`}
            >
              <span className="text-lg" aria-hidden>{tab.icon}</span>
              {t(tab.key)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
