'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Row, Stack } from '@polski/ui'
import {
  disableGoogleAutoSelect,
  googleAuthEnabled,
  renderGoogleButton,
} from '@/lib/auth/google'
import { signInWithGoogle, signOut, useAppState } from '@/lib/data/store'

/**
 * Вход через Google.
 *
 * Без входа приложение работает: сервер выдаёт гостевую сессию, и
 * прогресс всё равно пишется в базу. Вход нужен, чтобы этот прогресс
 * нашёлся на другом устройстве — и чтобы не потерялся вместе с cookie.
 *
 * ID-токен здесь не хранится и не разбирается: он уходит на сервер,
 * тот проверяет подпись и ставит свою httpOnly-сессию.
 */
export function SignInButton() {
  const t = useTranslations('auth')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const slot = useRef<HTMLDivElement>(null)
  const user = useAppState()?.user

  // Скрипт Google грузится при открытии окна, а не на старте приложения
  useEffect(() => {
    if (!open || !googleAuthEnabled || !slot.current) return
    let cancelled = false
    renderGoogleButton(slot.current, (idToken) => {
      if (cancelled) return
      signInWithGoogle(idToken)
        .then(() => setOpen(false))
        .catch(() => setError('unavailable'))
    }).catch(() => { if (!cancelled) setError('unavailable') })
    return () => { cancelled = true }
  }, [open])

  async function handleSignOut() {
    disableGoogleAutoSelect()
    await signOut()
  }

  if (user?.signedIn) {
    return (
      <Row gap="sm">
        <span className="text-sm text-muted">{user.name ?? user.email}</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>{t('signOut')}</Button>
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
