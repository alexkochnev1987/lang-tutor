'use client'

import type { ComponentProps } from 'react'
import Link from 'next/link'

export function GrammarLink(props: Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'>) {
  return (
    <Link {...props} href="/grammar/" onNavigate={(event) => {
      if (navigator.onLine) return
      event.preventDefault()
      // A document request lets the PWA service worker serve the offline page.
      window.location.assign('/grammar/')
    }} />
  )
}
