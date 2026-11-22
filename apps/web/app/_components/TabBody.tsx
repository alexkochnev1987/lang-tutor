import { cn } from '@polski/ui'
import type { ReactNode } from 'react'

export function TabBody({ children, controls, className }: {
  children: ReactNode
  controls?: ReactNode
  className?: string
}) {
  return (
    <>
      {controls && <div className="mx-auto w-full max-w-2xl shrink-0 px-4 pb-3">{controls}</div>}
      <main className={cn('mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto overscroll-contain px-4 pb-4', className)}>
        {children}
      </main>
    </>
  )
}
