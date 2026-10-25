import { cn } from '../cn'

/**
 * Корневой контейнер экрана.
 * UX_UI.md §1.5: 100dvh вместо 100vh и safe-area по краям,
 * иначе нижние кнопки уезжают под индикатор Home на iOS.
 */
export function Screen({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex h-dvh min-h-0 flex-col overflow-hidden bg-bg text-ink',
        '[&>header]:shrink-0 [&>main]:min-h-0 [&>main]:overflow-y-auto [&>main]:overscroll-contain [&>footer]:shrink-0',
        className,
      )}
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        // Нижняя навигация сама учитывает safe-area, чтобы не создавать
        // двойной отступ и оставаться у физического края экрана.
        paddingBottom: '0px',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {children}
    </div>
  )
}
