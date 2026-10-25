'use client'

import { Dialog } from 'radix-ui'
import { RuleView } from './RuleView'
import type { LocalizedRule } from '@/lib/content/rules'

export function RuleSheet({ rule }: { rule: LocalizedRule }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="inline-flex min-h-10 items-center gap-1.5 rounded-card border border-primary bg-transparent px-3 text-sm text-primary hover:bg-soft">
        <span aria-hidden>📘</span>
        Reguła
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto rounded-t-card border-t border-line bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:border"
        >
          <Dialog.Title className="sr-only">{rule.titlePl}</Dialog.Title>
          <RuleView rule={rule} />
          <Dialog.Close className="mt-4 min-h-12 w-full rounded-card border border-primary bg-transparent text-sm font-medium text-primary hover:bg-soft">
            Zamknij
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
