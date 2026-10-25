import { tv } from 'tailwind-variants'

const seg = tv({
  slots: {
    root: 'inline-flex rounded-card border border-line bg-soft p-0.5',
    item: [
      'inline-flex h-10 min-w-10 items-center justify-center gap-1.5 px-3',
      'rounded-card text-sm font-medium text-muted transition-colors',
      'hover:text-ink',
      'aria-pressed:bg-card aria-pressed:text-ink aria-pressed:shadow-card',
    ],
  },
})

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: string
}

export function Segmented<T extends string>({
  options, value, onChange, ariaLabel,
}: {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  ariaLabel?: string
}) {
  const { root, item } = seg()
  return (
    <div className={root()} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={item()}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <span aria-hidden>{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  )
}
