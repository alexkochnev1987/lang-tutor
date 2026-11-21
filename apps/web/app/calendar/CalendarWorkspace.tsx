'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Meter, Row, Stack } from '@polski/ui'
import { completionPercent, courseDayStatus, type CourseDayStatus } from '@polski/engine'
import { loadCurriculum, type Curriculum, type CurriculumDay } from '@/lib/content/curriculum'
import { loadProgress, type Progress } from '@/lib/engine/progress'

const STATUS_LABEL: Record<CourseDayStatus, string> = {
  completed: 'Завершено',
  current: 'Сегодня',
  upcoming: 'Впереди',
}

const STATUS_CLASS: Record<CourseDayStatus, string> = {
  completed: 'border-ok bg-ok-bg text-ok-ink',
  current: 'border-primary bg-soft text-primary ring-2 ring-primary/30',
  upcoming: 'border-line bg-card text-muted',
}

export function CalendarWorkspace() {
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [nextCurriculum, nextProgress] = await Promise.all([loadCurriculum(), loadProgress()])
      setCurriculum(nextCurriculum)
      setProgress(nextProgress)
      setSelectedDay((current) => current ?? nextProgress.day)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const completedDays = useMemo(() => new Set(progress?.completedDays ?? []), [progress?.completedDays])
  const selected = curriculum?.days.find((day) => day.day === selectedDay) ?? null
  const percentage = progress && curriculum
    ? completionPercent(curriculum.stats.totalDays, completedDays)
    : 0

  if (loading) return <Card><p className="text-sm text-muted" role="status">Загружаем календарь…</p></Card>
  if (error || !curriculum || !progress) {
    return (
      <Card>
        <Stack gap="sm">
          <p className="text-sm text-danger">Не удалось загрузить календарь программы.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>Повторить</Button>
        </Stack>
      </Card>
    )
  }

  const weeks = Array.from({ length: Math.ceil(curriculum.days.length / 7) }, (_, index) =>
    curriculum.days.slice(index * 7, index * 7 + 7))

  return (
    <Stack gap="lg">
      <Card>
        <Stack gap="md">
          <Row justify="between" gap="sm">
            <Stack gap="xs">
              <span className="text-xs uppercase tracking-wide text-muted">Программа B1</span>
              <h1 className="text-xl font-semibold">Календарь обучения</h1>
            </Stack>
            <span className="text-2xl font-semibold tabular-nums text-primary">{percentage}%</span>
          </Row>
          <Meter value={percentage} />
          <p className="text-sm text-muted">
            День {progress.day} из {curriculum.stats.totalDays} · завершено {completedDays.size}
          </p>
        </Stack>
      </Card>

      <Card>
        <Stack gap="md">
          <Row justify="between" gap="sm">
            <h2 className="font-semibold">Все дни программы</h2>
            <span className="text-xs text-muted">{curriculum.stats.totalMinutes} минут</span>
          </Row>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Календарь 182 дней">
            {weeks.map((week) => week.map((day) => {
              const status = courseDayStatus(day.day, progress.day, completedDays)
              const selectedClass = selectedDay === day.day ? 'z-10 scale-105 shadow-card' : ''
              return (
                <button
                  key={day.day}
                  type="button"
                  role="gridcell"
                  aria-label={`День ${day.day}: ${day.topic}. ${STATUS_LABEL[status]}`}
                  aria-current={status === 'current' ? 'date' : undefined}
                  aria-pressed={selectedDay === day.day}
                  onClick={() => setSelectedDay(day.day)}
                  className={`aspect-square min-h-10 rounded-card border text-xs font-semibold transition-transform hover:scale-105 ${STATUS_CLASS[status]} ${selectedClass}`}
                >
                  {day.day}
                </button>
              )
            }))}
          </div>
          <Row gap="sm" wrap>
            {(['completed', 'current', 'upcoming'] as const).map((status) => (
              <span key={status} className={`rounded-pill border px-2 py-1 text-xs ${STATUS_CLASS[status]}`}>
                {STATUS_LABEL[status]}
              </span>
            ))}
          </Row>
        </Stack>
      </Card>

      {selected && <DayDetails day={selected} status={courseDayStatus(selected.day, progress.day, completedDays)} />}
    </Stack>
  )
}

function DayDetails({ day, status }: { day: CurriculumDay; status: CourseDayStatus }) {
  return (
    <Card>
      <Stack gap="md">
        <Row justify="between" gap="sm">
          <Stack gap="xs">
            <span className="text-xs uppercase tracking-wide text-muted">День {day.day} · неделя {day.week}</span>
            <h2 className="text-lg font-semibold">{day.topic}</h2>
          </Stack>
          <span className={`rounded-pill border px-2 py-1 text-xs ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
        </Row>
        <Stack gap="xs">
          <p className="text-sm text-muted">{day.phaseTitle} · {day.themeRu}</p>
          <p className="text-sm">{day.expectedOutcome}</p>
        </Stack>
        {status === 'current' && (
          <Link href="/lesson/" className="w-full">
            <Button size="lg" full>Начать занятие</Button>
          </Link>
        )}
      </Stack>
    </Card>
  )
}
