'use client'

import { useState } from 'react'
import { Button, Card, OptionRow, Stack } from '@polski/ui'
import { startCourse } from '@/lib/data/store'

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
export function Diagnostic({ onDone }: { onDone: () => void }) {
  const [picked, setPicked] = useState<Track | null>(null)
  const [completedTrack, setCompletedTrack] = useState<Track | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!picked) return
    setSaving(true)
    try {
      await startCourse(picked)
      setCompletedTrack(picked)
      setSaving(false)
    } catch (e) {
      // Кнопка обязана разблокироваться: иначе экран навсегда
      // застревает на «Сохраняю…», как это уже было.
      setSaving(false)
      setError(e instanceof Error ? e.message : 'save_failed')
    }
  }

  if (completedTrack) {
    const track = TRACKS.find((item) => item.id === completedTrack)!
    return (
      <Card>
        <Stack gap="lg" align="center">
          <span className="text-4xl" aria-hidden>✓</span>
          <Stack gap="xs" align="center">
            <h1 className="text-xl font-semibold">Диагностика завершена</h1>
            <p className="text-center text-sm text-muted">
              Ваш стартовый трек: <strong className="text-ink">{track.title}</strong>
            </p>
            <p className="text-center text-xs text-muted">{track.desc}</p>
          </Stack>
          <p className="w-full rounded-card bg-ok-bg px-3 py-2 text-center text-sm text-ok-ink">
            ✓ Прогресс сохранён
          </p>
          <Button size="lg" full onClick={onDone}>Начать обучение</Button>
          <Button variant="outline" full onClick={() => {
            setCompletedTrack(null)
            setPicked(null)
            setError(null)
            setSaving(false)
          }}>
            Пройти диагностику заново
          </Button>
        </Stack>
      </Card>
    )
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
          {saving ? 'Сохраняю…' : 'Сохранить и продолжить'}
        </Button>

        {error && (
          <p className="text-xs text-bad">Не удалось сохранить: {error}</p>
        )}

        <p className="text-xs text-muted">
          Честно: 15 минут в день за полгода — это 45 часов. С абсолютного
          нуля до B1 этого мало, и приложение не будет делать вид, что
          иначе. Подробности — в документации проекта.
        </p>
      </Stack>
    </Card>
  )
}
