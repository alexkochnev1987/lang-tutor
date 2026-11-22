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
  outcome?: 'none' | 'correct' | 'wrong'
}

export function OptionRow({ selected, outcome, children, ...rest }: OptionRowProps) {
  const mark = outcome === 'correct' ? '✓' : outcome === 'wrong' ? '×' : selected ? '●' : null
  const showMarker = selected !== undefined || Boolean(mark)
  const graded = outcome === 'correct' || outcome === 'wrong'
  return (
    <button
      type="button"
      className={row({ selected: outcome && outcome !== 'none' ? false : selected, outcome })}
      aria-pressed={selected}
      {...rest}
    >
      {children}
      {showMarker && (
        <span
          className={`ml-auto flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${mark ? 'border-current' : 'border-muted/60'} ${graded ? '' : 'text-accent-ink'}`}
          aria-hidden
        >
          {mark}
        </span>
      )}
    </button>
  )
}
