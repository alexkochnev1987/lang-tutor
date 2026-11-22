import { tv, type VariantProps } from 'tailwind-variants'
import { BusyIndicator } from '../primitives/BusyIndicator'

/**
 * R2: вся «простыня» классов живёт здесь и нигде больше.
 * R3: className снаружи — только позиционирование (mt-4, col-span-2).
 *     Нужен другой внешний вид — добавляется вариант, а не класс снаружи.
 */
export const buttonStyles = tv({
  base: [
    'inline-flex items-center justify-center gap-2 select-none',
    'rounded-control text-center font-semibold leading-tight transition-[background-color,color,box-shadow,translate] active:translate-y-px',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    'focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-60 disabled:aria-busy:opacity-100',
  ],
  variants: {
    variant: {
      primary: 'bg-accent-ink text-card shadow-card hover:brightness-95 active:brightness-90',
      outline: 'bg-soft2 text-accent-ink hover:brightness-95 active:brightness-90',
      ghost:   'bg-transparent text-ink hover:bg-soft active:bg-soft2',
      danger:  'bg-danger-bg text-danger-ink hover:brightness-95 active:brightness-90',
    },
    size: {
      // 48px — минимум для касания. UX_UI.md §1.6: промах засчитывается
      // в SRS как ошибка, поэтому это не косметика
      sm: 'min-h-11 px-3 py-2 text-sm',
      md: 'min-h-12 px-4 py-2.5 text-base',
      lg: 'min-h-14 px-5 py-3 text-base',
    },
    full: { true: 'w-full' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
})

export type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonStyles> & {
  busy?: boolean
  busyLabel?: string
}

export function Button({ variant, size, full, className, busy, busyLabel, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonStyles({ variant, size, full, className })} {...rest}
      disabled={disabled || busy} aria-busy={busy || rest['aria-busy']}>
      {busyLabel === undefined ? (
        busy ? <><BusyIndicator />{children}</> : children
      ) : (
        <span className="grid min-w-0 items-center">
          <span aria-hidden={busy || undefined} className={`col-start-1 row-start-1 flex items-center justify-center gap-2 ${busy ? 'invisible' : ''}`}>
            {children}
          </span>
          <span aria-hidden={!busy || undefined} className={`col-start-1 row-start-1 flex items-center justify-center gap-2 ${busy ? '' : 'invisible'}`}>
            <BusyIndicator className={busy ? undefined : 'motion-safe:animate-none'} />
            <span>{busyLabel}</span>
          </span>
        </span>
      )}
    </button>
  )
}
