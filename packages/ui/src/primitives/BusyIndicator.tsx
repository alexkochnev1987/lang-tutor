import { cn } from '../cn'

export function BusyIndicator({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"
      className={cn('size-4 shrink-0 motion-safe:animate-spin', className)}>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="2" opacity=".22" />
      <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
