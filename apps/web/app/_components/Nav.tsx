'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AppIcon } from './AppIcon'
import { GrammarLink } from './GrammarLink'

const TABS = [
  { href: '/', key: 'today' },
  { href: '/program', key: 'course', alternate: '/progress' },
  { href: '/words', key: 'words', alternate: '/dictionary' },
  { href: '/grammar/', key: 'grammar' },
  { href: '/profile', key: 'profile' },
] as const

type TabKey = (typeof TABS)[number]['key']

interface TabContentProps {
  tab: TabKey
  label: string
  active: boolean
}

function LinkTabContent(props: TabContentProps) {
  const { pending } = useLinkStatus()
  return <TabContent {...props} pending={pending} />
}

function TabContent({ tab, label, active, pending }: TabContentProps & { pending: boolean }) {
  const selected = active || pending

  return (
    <>
      <span className={`flex h-7 w-11 items-center justify-center rounded-pill group-active:bg-soft2 group-active:text-accent-ink ${
        selected ? 'bg-soft2 text-accent-ink' : 'group-hover:bg-soft'
      }`}>
        <AppIcon name={tab} className="size-5" />
      </span>
      <span className={selected ? 'text-accent-ink' : undefined}>{label}</span>
    </>
  )
}

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
          const TabLink = tab.key === 'grammar' ? GrammarLink : Link
          const label = t(tab.key)
          return (
            <TabLink
              key={tab.href}
              href={tab.href}
              aria-label={label}
              aria-current={alternate ? 'location' : active ? 'page' : undefined}
              className={`group flex min-h-14 min-w-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-control text-center text-[0.6875rem] leading-tight active:bg-soft ${
                active ? 'font-semibold text-accent-ink' : 'font-medium text-muted'
              }`}
            >
              <LinkTabContent tab={tab.key} label={label} active={active} />
            </TabLink>
          )
        })}
      </div>
    </nav>
  )
}
