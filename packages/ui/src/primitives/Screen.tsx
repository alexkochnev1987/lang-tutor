import { cn } from '../cn'

/**
 * Корневой контейнер экрана.
 * UX_UI.md §1.5: 100dvh вместо 100vh и safe-area по краям,
 * иначе нижние кнопки уезжают под индикатор Home на iOS.
 */
export function Screen({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn('flex min-h-dvh flex-col bg-bg text-ink', className)}
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {children}
    </div>
  )
}
