import { tv, type VariantProps } from 'tailwind-variants'

/**
 * R4: многочастный компонент — через слоты, а не headerClassName наружу.
 * UX_UI.md §1.1: карточка не растягивается на широком экране.
 */
const card = tv({
  slots: {
    root: 'w-full rounded-card border border-line bg-card shadow-card',
    body: 'p-4',
  },
  variants: {
    tone: {
      neutral: {},
      correct: { root: 'border-ok/50 bg-ok-bg' },
      wrong:   { root: 'border-danger/50 bg-danger-bg' },
    },
    constrained: { true: { root: 'mx-auto max-w-(--container-exercise)' } },
  },
  defaultVariants: { tone: 'neutral', constrained: true },
})

type Props = React.ComponentProps<'div'> & VariantProps<typeof card>

export function Card({ tone, constrained, className, children, ...rest }: Props) {
  const { root, body } = card({ tone, constrained })
  return (
    <div className={root({ className })} {...rest}>
      <div className={body()}>{children}</div>
    </div>
  )
}
