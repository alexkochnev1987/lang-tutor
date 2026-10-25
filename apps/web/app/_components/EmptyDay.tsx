'use client'

import { useState } from 'react'
import { Button, Card, Stack } from '@polski/ui'
import { saveLessonSession } from '@/lib/data/store'
import type { CurriculumDay } from '@/lib/content/curriculum'

const TITLE: Partial<Record<CurriculumDay['kind'], string>> = {
  'weekly-check': 'Недельный срез',
  checkpoint: 'Контрольный срез',
  final: 'Итоговая оценка',
}

/**
 * День, на котором нечего показать.
 *
 * Срезы и контрольные работают на НАКОПЛЕННОМ материале: очередь
 * повторений плюс пробные задания. Если учить ещё нечего — очередь
 * пуста, и раньше кнопка просто гасла, превращая день в тупик.
 * Таких дней 27 из 182.
 *
 * Теперь день можно честно закрыть и идти дальше.
 */
export function EmptyDay({ day, onDone }: { day: CurriculumDay; onDone: () => void }) {
  const [busy, setBusy] = useState(false)

  async function skip() {
    setBusy(true)
    await saveLessonSession({
      id: crypto.randomUUID(),
      dayNumber: day.day, kind: 'day', startedAt: new Date(), completedAt: new Date(),
      plannedBudgetMs: day.totalSec * 1000, actualMs: 0,
      itemsReviewed: 0, itemsCorrect: 0,
    })
    onDone()
  }

  return (
    <Card>
      <Stack gap="md" align="center">
        <span className="text-4xl" aria-hidden>📋</span>
        <h1 className="text-xl font-semibold">{TITLE[day.kind] ?? day.topic}</h1>
        <p className="text-center text-sm text-muted">
          Повторять пока нечего — материал ещё не накоплен.
          Срез станет осмысленным, когда наберётся материал за неделю.
        </p>
        <Button size="lg" full onClick={skip} disabled={busy}>
          {busy ? 'Отмечаю…' : 'Отметить день и идти дальше'}
        </Button>
      </Stack>
    </Card>
  )
}
