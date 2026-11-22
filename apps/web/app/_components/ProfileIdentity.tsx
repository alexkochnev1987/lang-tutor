'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Row, Stack } from '@polski/ui'
import { parseProfileName, PROFILE_NAME_LIMIT, type ProfileName } from '@/lib/data/profile-name'
import { saveProfileName } from '@/lib/data/store'
import type { SessionUser } from '@/lib/data/types'
import { UserAvatar } from './UserAvatar'

export function ProfileIdentity({ user }: { user: SessionUser }) {
  const t = useTranslations('profile')
  const common = useTranslations('common')
  const [draft, setDraft] = useState<ProfileName | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'invalid'>('idle')
  const saving = status === 'saving'

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const name = parseProfileName(draft)
    if (!name) {
      setStatus('invalid')
      return
    }
    setStatus('saving')
    try {
      await saveProfileName(name)
      setDraft(null)
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  return (
    <Stack gap="sm">
      <Row gap="md">
        <UserAvatar user={user} className="size-16 text-xl" />
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <p className="text-lg font-semibold">{user.name || t('nameMissing')}</p>
          {user.email && <p className="text-sm text-muted">{user.email}</p>}
        </div>
      </Row>
      {draft ? (
        <form onSubmit={save}>
          <fieldset disabled={saving} className="grid min-w-0 gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                {t('firstName')}
                <input autoComplete="given-name" required maxLength={PROFILE_NAME_LIMIT} value={draft.firstName}
                  className="min-h-12 w-full min-w-0 rounded-control border border-line bg-card px-3"
                  onChange={(event) => { setDraft({ ...draft, firstName: event.target.value }); setStatus('idle') }} />
              </label>
              <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                {t('lastName')}
                <input autoComplete="family-name" maxLength={PROFILE_NAME_LIMIT} value={draft.lastName}
                  className="min-h-12 w-full min-w-0 rounded-control border border-line bg-card px-3"
                  onChange={(event) => { setDraft({ ...draft, lastName: event.target.value }); setStatus('idle') }} />
              </label>
            </div>
            <Row gap="sm" wrap>
              <Button type="submit" busy={saving} busyLabel={t('saving')}>{common('save')}</Button>
              <Button type="button" variant="ghost" onClick={() => { setDraft(null); setStatus('idle') }}>
                {t('cancelEdit')}
              </Button>
            </Row>
            {status === 'invalid' && <p role="alert" className="text-sm text-danger-ink">{t('invalidName')}</p>}
            {status === 'error' && <p role="alert" className="text-sm text-danger-ink">{t('saveError')}</p>}
          </fieldset>
        </form>
      ) : (
        <>
          <Button type="button" variant="outline" onClick={() => {
            setDraft({ firstName: user.firstName, lastName: user.lastName })
            setStatus('idle')
          }}>
            {t('editProfile')}
          </Button>
          {status === 'saved' && <p role="status" className="text-sm text-ok-ink">{t('saved')}</p>}
        </>
      )}
    </Stack>
  )
}
