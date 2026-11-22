import { useTranslations } from 'next-intl'
import { Card, cn } from '@polski/ui'

export function SkeletonBlock({ className }: { className: string }) {
  return <div aria-hidden="true"
    className={cn('rounded-control bg-soft motion-safe:animate-pulse [animation-delay:180ms]', className)} />
}

export function LoadingSkeleton({ variant = 'card', label }: {
  variant?: 'card' | 'today' | 'list' | 'lesson' | 'profile'
  label?: string
}) {
  const t = useTranslations('common')
  const title = label ?? t('loading')

  return (
    <div className="w-full">
      <p role="status" className={variant === 'lesson' ? 'mb-3 text-center text-sm text-muted' : 'sr-only'}>{title}</p>
      <div aria-hidden="true" className="grid gap-3">
        {variant === 'today' && (
          <>
            <Card tone="featured" constrained={false}>
              <div className="grid gap-3">
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="h-8 w-2/3" />
                <SkeletonBlock className="h-4 w-1/2" />
                <div className="my-1 grid gap-2">
                  <SkeletonBlock className="h-4 w-full" />
                  <SkeletonBlock className="h-4 w-3/4" />
                </div>
                <SkeletonBlock className="h-14 w-full bg-soft2" />
                <SkeletonBlock className="h-3 w-4/5" />
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-2">
              <SkeletonBlock className="h-18 rounded-card" />
              <SkeletonBlock className="h-18 rounded-card" />
            </div>
          </>
        )}
        {variant === 'list' && (
          <Card>
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-center gap-3 border-b border-line py-3 first:pt-1 last:border-0 last:pb-1">
                <SkeletonBlock className="size-11 shrink-0" />
                <div className="grid flex-1 gap-2">
                  <SkeletonBlock className="h-4 w-1/2" />
                  <SkeletonBlock className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </Card>
        )}
        {variant === 'lesson' && (
          <Card>
            <div className="grid gap-3 py-3">
              <SkeletonBlock className="mx-auto h-7 w-3/5" />
              <SkeletonBlock className="mx-auto mb-2 h-4 w-2/5" />
              <SkeletonBlock className="h-12 w-full" />
              <SkeletonBlock className="h-12 w-full" />
            </div>
          </Card>
        )}
        {variant === 'profile' && (
          <>
            <Card>
              <div className="grid gap-3">
                <SkeletonBlock className="h-6 w-28" />
                <div className="flex items-center gap-3">
                  <SkeletonBlock className="size-16 shrink-0 rounded-full" />
                  <div className="grid flex-1 gap-2">
                    <SkeletonBlock className="h-5 w-3/5" />
                    <SkeletonBlock className="h-3 w-4/5" />
                  </div>
                </div>
                <SkeletonBlock className="h-12" />
              </div>
            </Card>
            <Card><SkeletonBlock className="h-6 w-44 max-w-full" /></Card>
          </>
        )}
        {variant === 'card' && (
          <Card>
            <div className="grid gap-3">
              <SkeletonBlock className="h-6 w-2/3" />
              <SkeletonBlock className="h-4 w-1/2" />
              <SkeletonBlock className="h-12 w-full" />
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
