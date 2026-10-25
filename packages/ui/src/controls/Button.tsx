import { tv, type VariantProps } from 'tailwind-variants'

/**
 * R2: вся «простыня» классов живёт здесь и нигде больше.
 * R3: className снаружи — только позиционирование (mt-4, col-span-2).
 *     Нужен другой внешний вид — добавляется вариант, а не класс снаружи.
 */
const button = tv({
  base: [
    'inline-flex items-center justify-center gap-2 select-none',
    'rounded-card font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    'focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  variants: {
    variant: {
      primary: 'border border-primary bg-transparent text-primary hover:bg-soft',
      outline: 'border border-primary bg-transparent text-primary hover:bg-soft',
      ghost:   'bg-transparent text-ink hover:bg-soft',
      danger:  'bg-danger text-on-primary hover:opacity-90',
    },
    size: {
      // 48px — минимум для касания. UX_UI.md §1.6: промах засчитывается
      // в SRS как ошибка, поэтому это не косметика
      sm: 'h-10 px-3 text-sm',
      md: 'h-12 px-4 text-base',
      lg: 'h-14 px-6 text-lg',
    },
    full: { true: 'w-full' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
})

export type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof button>

export function Button({ variant, size, full, className, ...rest }: ButtonProps) {
  return <button className={button({ variant, size, full, className })} {...rest} />
}
