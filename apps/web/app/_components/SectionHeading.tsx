'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Row, Stack } from '@polski/ui'
import { useAppState } from '@/lib/data/store'

export function SectionHeading({ section }: {
  section: 'today' | 'course' | 'words' | 'grammar' | 'profile'
}) {
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
      {user && section !== 'profile' && (
        <Link
          href={user.signedIn ? '/profile/' : '/profile/#profile-account'}
          className="flex min-h-11 min-w-0 max-w-[42%] shrink-0 items-center rounded-control px-3 text-sm font-medium text-accent-ink hover:bg-soft active:bg-soft2"
        >
          <span className="truncate">
            {user.signedIn ? user.name || t('nav.profile') : t('auth.signIn')}
          </span>
        </Link>
      )}
    </Row>
  )
}
