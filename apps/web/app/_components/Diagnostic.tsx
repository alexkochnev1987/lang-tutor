'use client'

import { useState } from 'react'
import { Button, Card, OptionRow, Stack } from '@polski/ui'
import { db } from '@/lib/db/dexie'
import { COURSE_ID } from '@/lib/content/curriculum'

type Track = 'a0' | 'a2' | 'b1-minus'

const TRACKS: { id: Track; title: string; desc: string }[] = [
  { id: 'a0', title: 'С нуля',
    desc: 'Польского не знаю совсем' },
  { id: 'a2', title: 'Что-то понимаю',
    desc: 'Узнаю знакомые слова, читаю вывески, говорить не могу' },
  { id: 'b1-minus', title: 'Понимаю, но путаюсь',
    desc: 'Читаю и слушаю неплохо, но грамматика не систематизирована' },
]

/**
 * День 1 — входная диагностика.
 *
 * Полноценный placement-тест ещё не написан, но оставлять первый экран
 * тупиком нельзя: человек открывает приложение и упирается в выключенную
 * кнопку. Пока — честный самооценочный выбор трека.
 *
 * Зачем трек вообще: 182 × 15 минут = 45,5 часа. С абсолютного нуля
 * этого на B1 не хватит (RESEARCH.md §8), и программа должна знать,
 * откуда стартует человек.
 */
export function Diagnostic({ day, onDone }: { day: number; onDone: () => void }) {
  const [picked, setPicked] = useState<Track | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!picked) return
    setSaving(true)
    await db.userCourses.put({
      courseId: COURSE_ID,
      startedAt: new Date(),
      entryTrack: picked,
      dailyBudgetMinutes: 15,
    })
    await db.lessonSessions.add({
      dayNumber: day, startedAt: new Date(), completedAt: new Date(),
      plannedBudgetMs: 900_000, actualMs: 0, itemsReviewed: 0, itemsCorrect: 0,
    })
    onDone()
  }

  return (
    <Card>
      <Stack gap="lg">
        <Stack gap="xs">
          <h1 className="text-xl font-semibold">С чего начинаем</h1>
          <p className="text-sm text-muted">
            От ответа зависит темп программы. Ошибиться не страшно —
            сложность подстроится по вашим результатам.
          </p>
        </Stack>

        <Stack gap="xs">
          {TRACKS.map((t) => (
            <OptionRow key={t.id} selected={picked === t.id} onClick={() => setPicked(t.id)}>
              <span className="flex flex-col items-start gap-0.5 py-1">
                <span className="font-medium">{t.title}</span>
                <span className="text-xs text-muted">{t.desc}</span>
              </span>
            </OptionRow>
          ))}
        </Stack>

        <Button size="lg" full disabled={!picked || saving} onClick={save}>
          {saving ? 'Сохраняю…' : 'Начать программу'}
        </Button>

        <p className="text-xs text-muted">
          Честно: 15 минут в день за полгода — это 45 часов. С абсолютного
          нуля до B1 этого мало, и приложение не будет делать вид, что
          иначе. Подробности — в документации проекта.
        </p>
      </Stack>
    </Card>
  )
}
