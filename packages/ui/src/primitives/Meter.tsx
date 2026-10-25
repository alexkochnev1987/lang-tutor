import { cn } from '../cn'

/**
 * Шкала готовности модуля с двумя отметками: официальный порог и наша цель.
 * UX_UI.md: пользователь должен видеть не абстрактный процент, а
 * расстояние до порога, который решает исход экзамена.
 */
export function Meter({
  value, threshold, target, tone = 'auto', className,
}: {
  value: number
  threshold?: number
  target?: number
  tone?: 'auto' | 'ok' | 'bad' | 'neutral'
  className?: string
}) {
  const resolved = tone !== 'auto' ? tone
    : target != null && value >= target ? 'ok'
    : threshold != null && value < threshold ? 'bad'
    : 'neutral'
  const fill = resolved === 'ok' ? 'bg-ok' : resolved === 'bad' ? 'bg-danger' : 'bg-primary'

  return (
    <div className={cn('relative h-2.5 w-full overflow-hidden rounded-pill bg-soft', className)}>
      <div className={cn('h-full rounded-pill transition-all', fill)}
           style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      {threshold != null && <Tick at={threshold} strong />}
      {target != null && <Tick at={target} />}
    </div>
  )
}

function Tick({ at, strong }: { at: number; strong?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn('absolute top-0 h-full w-px', strong ? 'bg-ink/60' : 'bg-ink/25')}
      style={{ left: `${at}%` }}
    />
  )
}
