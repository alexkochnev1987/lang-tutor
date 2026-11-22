'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Row, Stack } from '@polski/ui'
import { useAppState } from '@/lib/data/store'
import { UserAvatar } from './UserAvatar'

export type Section = 'today' | 'course' | 'words' | 'grammar' | 'profile'

export function SectionHeading({ section }: { section: Section }) {
  const t = useTranslations()
  const user = useAppState()?.user

  return (
    <Row justify="between" gap="sm" className="min-h-14">
      <Stack gap="none" className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">
          {section === 'today' ? t('app.name') : t(`nav.${section}`)}
        </h1>
        {section === 'today' && <p className="mt-0.5 text-sm text-muted">{t('app.tagline')}</p>}
      </Stack>
      {user && (user.signedIn ? (
        <Link href="/profile/" aria-label={t('nav.profile')} aria-current={section === 'profile' ? 'page' : undefined}
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-soft active:bg-soft2">
          <UserAvatar user={user} />
        </Link>
      ) : section !== 'profile' ? (
        <Link href="/profile/#profile-account"
          className="flex min-h-11 shrink-0 items-center rounded-control px-3 text-sm font-medium text-accent-ink hover:bg-soft active:bg-soft2">
          {t('auth.signIn')}
        </Link>
      ) : null)}
    </Row>
  )
}
