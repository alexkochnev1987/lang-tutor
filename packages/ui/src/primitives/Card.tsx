import { tv, type VariantProps } from 'tailwind-variants'

/**
 * R4: многочастный компонент — через слоты, а не headerClassName наружу.
 * UX_UI.md §1.1: карточка не растягивается на широком экране.
 */
const card = tv({
  slots: {
    root: 'w-full rounded-card border border-line bg-card shadow-card',
    body: 'p-4 sm:p-5',
  },
  variants: {
    tone: {
      neutral: {},
      featured: {
        root: 'rounded-feature bg-linear-to-br from-soft2/65 via-card to-card',
        body: 'p-5 sm:p-6',
      },
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
