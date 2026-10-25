'use client'

import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { useTranslations } from 'next-intl'
import { Button, Dots, OptionRow, Segmented, Stack } from '@polski/ui'
import { PALETTES, useTheme, type ModePref } from '@/lib/theme'

export function ThemePicker() {
  const t = useTranslations('settings')
  const [open, setOpen] = useState(false)
  const { palette, mode, setPalette, setMode } = useTheme()

  const modes: { value: ModePref; label: string; icon: string }[] = [
    { value: 'light',  label: t('themeLight'),  icon: '☀️' },
    { value: 'dark',   label: t('themeDark'),   icon: '🌙' },
    { value: 'system', label: t('themeSystem'), icon: '💻' },
  ]

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('appearance')}>
          <span aria-hidden>🎨</span>
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-card border border-line bg-card p-4 shadow-modal sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:w-[26rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <Stack gap="lg">
            <Dialog.Title className="text-lg font-semibold">{t('appearance')}</Dialog.Title>
            <Dialog.Description className="sr-only">
              {t('appearanceHint')}
            </Dialog.Description>

            <Stack gap="sm">
              <span className="text-xs tracking-wide text-muted uppercase">{t('theme')}</span>
              <Segmented
                options={modes}
                value={mode}
                onChange={setMode}
                ariaLabel={t('theme')}
              />
            </Stack>

            <Stack gap="sm">
              <span className="text-xs tracking-wide text-muted uppercase">{t('palette')}</span>
              <Stack gap="xs">
                {PALETTES.map((p) => (
                  <OptionRow
                    key={p.id}
                    selected={palette === p.id}
                    onClick={() => setPalette(p.id)}
                  >
                    <Dots colors={p.dots} />
                    {p.name}
                  </OptionRow>
                ))}
              </Stack>
            </Stack>

            <Dialog.Close asChild>
              <Button size="lg" full>{t('done')}</Button>
            </Dialog.Close>
          </Stack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
