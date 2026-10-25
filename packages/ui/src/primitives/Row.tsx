import { tv, type VariantProps } from 'tailwind-variants'

const row = tv({
  base: 'flex flex-row',
  variants: {
    gap: { none: 'gap-0', xs: 'gap-1', sm: 'gap-2', md: 'gap-3', lg: 'gap-5' },
    align: { start: 'items-start', center: 'items-center', baseline: 'items-baseline' },
    justify: { start: 'justify-start', between: 'justify-between', center: 'justify-center', end: 'justify-end' },
    wrap: { true: 'flex-wrap' },
  },
  defaultVariants: { gap: 'sm', align: 'center', justify: 'start' },
})

type Props = React.ComponentProps<'div'> & VariantProps<typeof row>

export function Row({ gap, align, justify, wrap, className, ...rest }: Props) {
  return <div className={row({ gap, align, justify, wrap, className })} {...rest} />
}
