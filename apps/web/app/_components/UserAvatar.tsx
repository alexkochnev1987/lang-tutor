'use client'

import { useState } from 'react'
import { cn } from '@polski/ui'
import { profileInitials } from '@/lib/data/profile-name'
import type { SessionUser } from '@/lib/data/types'
import { AppIcon } from './AppIcon'

export function UserAvatar({ user, className }: { user: SessionUser; className?: string }) {
  const initials = profileInitials(user)

  return (
    <span aria-hidden="true" className={cn(
      'relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-soft2 font-semibold text-accent-ink',
      className,
    )}>
      {initials || <AppIcon name="profile" className="size-5" />}
      {user.picture?.startsWith('https://') && <AvatarPhoto key={user.picture} picture={user.picture} />}
    </span>
  )
}

function AvatarPhoto({ picture }: { picture: string }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  if (failed) return null
  // The provider supplies a small remote avatar. A native image keeps the
  // initials available while the provider image loads or is unavailable.
  return <img src={picture} alt="" referrerPolicy="no-referrer" width={64} height={64}
    className={cn('absolute inset-0 size-full object-cover', !loaded && 'opacity-0')}
    onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
}
