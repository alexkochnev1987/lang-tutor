import { tv, type VariantProps } from 'tailwind-variants'

/** R7: layout-примитив вместо «flex flex-col gap-3» в каждом экране. */
const stack = tv({
  base: 'flex flex-col',
  variants: {
    gap: { none: 'gap-0', xs: 'gap-1', sm: 'gap-2', md: 'gap-3', lg: 'gap-5', xl: 'gap-8' },
    align: { start: 'items-start', center: 'items-center', stretch: 'items-stretch' },
  },
  defaultVariants: { gap: 'md', align: 'stretch' },
})

type Props = React.ComponentProps<'div'> & VariantProps<typeof stack>

export function Stack({ gap, align, className, ...rest }: Props) {
  return <div className={stack({ gap, align, className })} {...rest} />
}
