import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@polski/ui'

export function SkeletonBlock({ className }: { className: string }) {
  return <span aria-hidden="true"
    className={cn('block rounded-control bg-soft motion-safe:animate-pulse [animation-delay:180ms]', className)} />
}

/** Only the slot's value changes; its owning layout stays mounted. */
export function LoadingSlot({ loading, fallback, children, label }: {
  loading: boolean; fallback: ReactNode; children: ReactNode; label?: string
}) {
  const t = useTranslations('common')
  return loading ? <><span className="sr-only" role="status">{label ?? t('loading')}</span>{fallback}</> : <>{children}</>
}

