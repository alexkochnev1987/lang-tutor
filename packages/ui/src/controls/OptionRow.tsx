import { tv } from 'tailwind-variants'

/** Строка выбора: палитра в настройках, вариант ответа в упражнении. */
const row = tv({
  base: [
    'flex w-full items-center gap-3 rounded-control border px-3.5 py-2.5',
    'text-left text-base transition-colors active:brightness-95',
    // 48px — минимум для касания, UX_UI.md §1.6
    'min-h-12',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
  ],
  variants: {
    compact: { true: 'h-full min-w-0 gap-1.5 px-2.5 py-2' },
    selected: {
      true:  'border-accent-ink bg-soft2 text-ink',
      false: 'border-line bg-soft/50 text-ink hover:bg-soft',
    },
    /** Подсветка после ответа: верный вариант всегда видно, даже если
     *  выбран другой — иначе разбор ошибки не работает. */
    outcome: {
      none:    '',
      correct: 'border-ok bg-ok-bg text-ok-ink',
      wrong:   'border-danger bg-danger-bg text-danger-ink',
    },
  },
  defaultVariants: { selected: false, outcome: 'none' },
})

type OptionRowProps = React.ComponentProps<'button'> & {
  selected?: boolean
  compact?: boolean
  outcome?: 'none' | 'correct' | 'wrong'
}

export function OptionRow({ selected, outcome, children, compact, ...rest }: OptionRowProps) {
  const mark = outcome === 'correct' ? '✓' : outcome === 'wrong' ? '×' : selected ? '●' : null
  const showMarker = selected !== undefined || Boolean(mark)
  const graded = outcome === 'correct' || outcome === 'wrong'
  return (
    <button
      type="button"
      className={row({ selected: outcome && outcome !== 'none' ? false : selected, outcome, compact })}
      aria-pressed={selected}
      {...rest}
    >
      {compact ? <span className="min-w-0 flex-1 break-words text-center leading-snug">{children}</span> : children}
      {showMarker && (
        <span
          className={`ml-auto flex ${compact ? "size-4" : "size-5"} shrink-0 items-center justify-center rounded-full border text-xs ${mark ? 'border-current' : 'border-muted/60'} ${graded ? '' : 'text-accent-ink'}`}
          aria-hidden
        >
          {mark}
        </span>
      )}
    </button>
  )
}
