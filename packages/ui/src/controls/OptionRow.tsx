import { tv } from 'tailwind-variants'

/** Строка выбора: палитра в настройках, вариант ответа в упражнении. */
const row = tv({
  base: [
    'flex w-full items-center gap-3 rounded-card border px-3 py-2.5',
    'text-left text-base transition-colors',
    // 48px — минимум для касания, UX_UI.md §1.6
    'min-h-12',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
  ],
  variants: {
    selected: {
      true:  'border-primary bg-soft2 text-ink',
      false: 'border-line bg-card text-ink hover:bg-soft',
    },
  },
  defaultVariants: { selected: false },
})

export function OptionRow({
  selected, children, ...rest
}: React.ComponentProps<'button'> & { selected?: boolean }) {
  return (
    <button type="button" className={row({ selected })} aria-pressed={selected} {...rest}>
      {children}
      {selected && <span className="ml-auto text-primary" aria-hidden>✓</span>}
    </button>
  )
}
