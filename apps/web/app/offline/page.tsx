import { Card, Screen, Stack } from '@polski/ui'

/**
 * Показывается, если страница не в кэше и сети нет.
 * Занятие при этом обычно всё равно доступно: данные в IndexedDB,
 * оболочка в прекэше.
 */
export default function OfflinePage() {
  return (
    <Screen>
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4">
        <Card>
          <Stack gap="md" align="center">
            <span className="text-4xl" aria-hidden>📡</span>
            <h1 className="text-xl font-semibold">Нет сети</h1>
            <p className="text-center text-sm text-muted">
              Эта страница ещё не сохранена. Занятие и словарь работают
              офлайн — вернитесь на главный экран.
            </p>
          </Stack>
        </Card>
      </div>
    </Screen>
  )
}
