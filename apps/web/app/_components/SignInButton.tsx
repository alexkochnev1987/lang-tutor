'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Row, Stack } from '@polski/ui'
import {
  disableGoogleAutoSelect,
  googleAuthEnabled,
  renderGoogleButton,
  type GoogleProfile,
} from '@/lib/auth/google'
import { db } from '@/lib/db/dexie'
import { useLiveQuery } from 'dexie-react-hooks'

const PROFILE_KEY = 'googleProfile'

export function SignInButton() {
  const t = useTranslations('auth')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const slot = useRef<HTMLDivElement>(null)

  // R12: querier только читает
  const row = useLiveQuery(() => db.settings.get(PROFILE_KEY), [])
  const profile = row?.value as GoogleProfile | undefined

  // Скрипт Google грузится при открытии окна, а не на старте приложения
  useEffect(() => {
    if (!open || !googleAuthEnabled || !slot.current) return
    let cancelled = false
    renderGoogleButton(slot.current, (p) => {
      if (cancelled) return
      void db.settings.put({ key: PROFILE_KEY, value: p })
      setOpen(false)
    }).catch(() => { if (!cancelled) setError('unavailable') })
    return () => { cancelled = true }
  }, [open])

  async function signOut() {
    disableGoogleAutoSelect()
    await db.settings.delete(PROFILE_KEY)
  }

  if (profile) {
    return (
      <Row gap="sm">
        <span className="text-sm text-muted">{profile.name ?? profile.email}</span>
        <Button variant="ghost" size="sm" onClick={signOut}>{t('signOut')}</Button>
      </Row>
    )
  }

  if (!googleAuthEnabled) {
    return <span className="text-sm text-muted">{t('unavailable')}</span>
  }

  return (
    <Stack gap="sm" align="start">
      {!open && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {t('signIn')}
        </Button>
      )}
      {open && (
        <Stack gap="sm">
          <div ref={slot} />
          <p className="max-w-xs text-xs text-muted">{t('localOnly')}</p>
          {error && <p className="text-xs text-bad">{t('unavailable')}</p>}
        </Stack>
      )}
    </Stack>
  )
}
