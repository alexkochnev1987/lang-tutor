'use client'

import { useEffect, useState } from 'react'
import Link, { useLinkStatus } from 'next/link'
import { BusyIndicator } from '@polski/ui'
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
  const loading = useTranslations('common')
  const navigating = pending && !active

  return (
    <>
      <span className={`flex h-7 w-11 items-center justify-center rounded-pill group-active:bg-soft2 group-active:text-accent-ink ${
        navigating || active ? 'bg-soft2 text-accent-ink' : 'group-hover:bg-soft'
      }`}>
        {navigating ? <BusyIndicator className="size-5" /> : <AppIcon name={tab} className="size-5" />}
      </span>
      <span className={navigating ? 'text-accent-ink' : undefined}>{label}</span>
      <span role="status" className="sr-only">{navigating ? loading('loading') : ''}</span>
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
  const [documentPending, setDocumentPending] = useState(false)

  useEffect(() => {
    // A back/forward cache restore may keep the previous component state.
    const clear = () => setDocumentPending(false)
    window.addEventListener('pageshow', clear)
    return () => window.removeEventListener('pageshow', clear)
  }, [])

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
          const documentNavigation = tab.key === 'grammar' && !active
          const TabLink = documentNavigation ? 'a' : Link
          const label = t(tab.key)
          return (
            <TabLink
              key={tab.href}
              href={tab.href}
              aria-label={label}
              aria-current={alternate ? 'location' : active ? 'page' : undefined}
              onClick={(event) => {
                if (event.defaultPrevented || event.button !== 0 ||
                  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                setDocumentPending(documentNavigation)
              }}
              className={`group flex min-h-14 min-w-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-control text-center text-[0.6875rem] leading-tight active:bg-soft ${
                active ? 'font-semibold text-accent-ink' : 'font-medium text-muted'
              }`}
            >
              {documentNavigation
                ? <TabContent tab={tab.key} label={label} active={active} pending={documentPending} />
                : <LinkTabContent tab={tab.key} label={label} active={active} />}
            </TabLink>
          )
        })}
      </div>
    </nav>
  )
}
