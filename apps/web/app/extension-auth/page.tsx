'use client'

import { useEffect, useMemo, useState } from 'react'
import { SignInButton } from '@/app/_components/SignInButton'
import { useAppState } from '@/lib/data/store'

export default function ExtensionAuthPage() {
  const state = useAppState()
  const [error, setError] = useState<string | null>(null)
  const params = useMemo(() => {
    if (typeof window === 'undefined') return null
    const search = new URLSearchParams(window.location.search)
    return { redirectUri: search.get('redirect_uri'), state: search.get('state') }
  }, [])

  useEffect(() => {
    if (!state?.user.signedIn || !params?.redirectUri || !params.state) return
    let cancelled = false
    fetch('/api/auth/extension/issue/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirectUri: params.redirectUri, state: params.state }),
    })
      .then(async (response) => {
        const body = await response.json() as { redirectUrl?: string; error?: string }
        if (!response.ok || !body.redirectUrl) throw new Error(body.error ?? 'extension_auth_failed')
        if (!cancelled) window.location.assign(body.redirectUrl)
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'extension_auth_failed')
      })
    return () => { cancelled = true }
  }, [params, state?.user.signedIn])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-5">
      <div>
        <p className="text-sm text-muted">Polski B1</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Вход в расширение</h1>
        <p className="mt-2 text-sm text-muted">
          Войди через тот же Google-аккаунт, чтобы расширение увидело твой личный словарь.
        </p>
      </div>
      {state?.user.signedIn ? (
        <p className="text-sm text-muted" role="status">Передаём вход расширению…</p>
      ) : (
        <SignInButton />
      )}
      {error && <p className="text-sm text-danger-ink" role="alert">Не удалось подключить расширение: {error}</p>}
    </main>
  )
}
