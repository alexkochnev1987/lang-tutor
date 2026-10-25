'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

const TABS = [
  { href: '/',           key: 'today',      icon: '📅' },
  { href: '/dictionary', key: 'dictionary', icon: '🔤' },
  { href: '/grammar',    key: 'grammar',    icon: '📘' },
  { href: '/progress',   key: 'progress',   icon: '📊' },
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
      className="sticky bottom-0 z-20 border-t border-line bg-card lg:static lg:border-0 lg:bg-transparent"
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex w-full max-w-2xl">
        {TABS.map((tab) => {
          const active = path === tab.href || (tab.href !== '/' && path.startsWith(tab.href))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
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
