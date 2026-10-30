'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button, Card, Meter, Row, Screen, Stack } from '@polski/ui'
import { loadCurriculum, type Curriculum, type CurriculumDay } from '@/lib/content/curriculum'
import { loadProgress, type Progress } from '@/lib/engine/progress'
import { Nav } from '@/app/_components/Nav'
import { ThemePicker } from '@/app/_components/ThemePicker'

interface WeekRoadmap {
  week: number
  days: CurriculumDay[]
}

interface PhaseRoadmap {
  phase: number
  title: string
  goal: string
  days: CurriculumDay[]
  weeks: WeekRoadmap[]
}

function buildRoadmap(curriculum: Curriculum): PhaseRoadmap[] {
  const meta = new Map((curriculum.params?.phases ?? []).map((phase) => [phase.id, phase]))
  const phases = new Map<number, CurriculumDay[]>()

  for (const day of curriculum.days) {
    const days = phases.get(day.phase) ?? []
    days.push(day)
    phases.set(day.phase, days)
  }

  return [...phases.entries()]
    .sort(([left], [right]) => left - right)
    .map(([phase, days]) => {
      const weeks = new Map<number, CurriculumDay[]>()
      for (const day of days) {
        const week = weeks.get(day.week) ?? []
        week.push(day)
        weeks.set(day.week, week)
      }
      const phaseInfo = meta.get(phase)
      return {
        phase,
        title: phaseInfo?.title ?? days[0]?.phaseTitle ?? `Фаза ${phase}`,
        goal: phaseInfo?.goal ?? '',
        days,
        weeks: [...weeks.entries()]
          .sort(([left], [right]) => left - right)
          .map(([week, weekDays]) => ({ week, days: weekDays })),
      }
    })
}

function phaseProgress(phase: PhaseRoadmap, completedDays: Set<number>): number {
  return phase.days.filter((day) => completedDays.has(day.day)).length
}

type ProgressState = 'done' | 'current' | 'upcoming'

function phaseState(
  phase: PhaseRoadmap,
  currentDay: number,
  completedDays: Set<number>,
): ProgressState {
  const completed = phaseProgress(phase, completedDays)
  if (completed === phase.days.length) return 'done'
  if (phase.days.some((day) => day.day === currentDay)) return 'current'
  return 'upcoming'
}

function MapIsland({
  phase, currentDay, completedDays,
}: {
  phase: PhaseRoadmap
  currentDay: number
  completedDays: Set<number>
}) {
  const completed = phaseProgress(phase, completedDays)
  const state = phaseState(phase, currentDay, completedDays)
  const phaseClass = state === 'current'
    ? 'border-primary bg-primary/10 shadow-card'
    : state === 'done'
      ? 'border-ok bg-ok-bg shadow-card'
      : 'border-line bg-card'
  const islandSide = phase.phase % 2 === 1 ? 'mr-auto' : 'ml-auto'
  const connectorSide = phase.phase % 2 === 1 ? '-right-10' : '-left-10'

  return (
    <div className={`relative z-10 w-[min(100%,19rem)] ${islandSide}`}>
      <span
        aria-hidden
        className={`absolute top-10 hidden h-1 w-10 bg-primary/35 sm:block ${connectorSide}`}
      />
      <div className={`relative rounded-[2rem] border-2 px-4 py-4 ${phaseClass}`}>
        <Stack gap="md">
          <Row justify="between" gap="sm" align="start">
            <Stack gap="xs">
              <span className="text-xs uppercase tracking-wide text-muted">Остров {phase.phase}</span>
              <h2 className="font-semibold">{phase.title}</h2>
              <p className="text-xs text-muted">Дни {phase.days[0]?.day}–{phase.days.at(-1)?.day}</p>
            </Stack>
            <span className="text-2xl" aria-hidden>
              {state === 'done' ? '🏝️' : state === 'current' ? '🧭' : '⛵'}
            </span>
          </Row>

          {phase.goal && <p className="text-sm text-muted">{phase.goal}</p>}

          <Meter
            value={(completed / Math.max(1, phase.days.length)) * 100}
            tone={state === 'done' ? 'ok' : 'neutral'}
          />

          <div className="flex flex-wrap gap-1.5" aria-label={`Остановки фазы ${phase.phase}`}>
            {phase.weeks.map((week) => {
              const weekCompleted = week.days.filter((day) => completedDays.has(day.day)).length
              const weekCurrent = week.days.some((day) => day.day === currentDay)
              const weekDone = weekCompleted === week.days.length
              return (
                <span
                  key={week.week}
                  title={`Неделя ${week.week}: ${week.days[0]?.themeRu}`}
                  aria-label={`Неделя ${week.week}: ${weekCompleted} из ${week.days.length} дней`}
                  className={`rounded-pill border px-2 py-1 text-xs tabular-nums ${
                    weekDone
                      ? 'border-ok bg-ok-bg text-ok-ink'
                      : weekCurrent
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-line bg-card text-muted'
                  }`}
                >
                  {week.week} · {weekCompleted}/{week.days.length}
                </span>
              )
            })}
          </div>

          <p className={`text-xs ${state === 'current' ? 'font-medium text-primary' : 'text-muted'}`}>
            {state === 'done'
              ? 'Остров пройден'
              : state === 'current'
                ? `Текущая остановка · день ${currentDay}`
                : 'Остров впереди'}
          </p>
        </Stack>
      </div>
    </div>
  )
}

export default function ProgramPage() {
  const [data, setData] = useState<{ curriculum: Curriculum; progress: Progress } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([loadCurriculum(), loadProgress()])
      .then(([curriculum, progress]) => {
        if (alive) setData({ curriculum, progress })
      })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [])

  if (error) return <Shell><Card><p className="text-sm text-danger">Что-то пошло не так</p></Card></Shell>
  if (!data) return <Shell><Card><p className="text-sm text-muted">Загрузка…</p></Card></Shell>

  const { curriculum, progress } = data
  const completedDays = new Set(progress.completedDays)
  const currentDay = Math.min(progress.totalDays, progress.day)
  const percent = Math.round((progress.daysCompleted / Math.max(1, progress.totalDays)) * 100)
  const roadmap = buildRoadmap(curriculum)
  const finished = progress.daysCompleted >= progress.totalDays

  return (
    <Shell>
      <Card>
        <Stack gap="md">
          <Row justify="between" gap="md" align="start">
            <Stack gap="xs">
              <span className="text-xs uppercase tracking-wide text-muted">Визуализация курса</span>
              <h1 className="text-xl font-semibold">Дорожка до B1</h1>
              <p className="text-sm text-muted">
                День {currentDay} из {progress.totalDays} · пройдено {percent}%
              </p>
            </Stack>
            <span className="text-2xl" aria-hidden>{finished ? '🏁' : '🧭'}</span>
          </Row>

          <div
            className="relative h-3 overflow-visible rounded-pill bg-soft"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.totalDays}
            aria-valuenow={progress.daysCompleted}
            aria-label={`Программа: ${progress.daysCompleted} из ${progress.totalDays} дней`}
          >
            <div
              className={`h-full rounded-pill ${finished ? 'bg-ok' : 'bg-primary'}`}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
            <span
              aria-hidden
              className={`absolute top-1/2 size-5 -translate-y-1/2 -translate-x-1/2 rounded-full border-4 border-card ${finished ? 'bg-ok' : 'bg-primary'}`}
              style={{ left: `${Math.min(100, percent)}%` }}
            />
          </div>

          <Row justify="between" className="text-xs text-muted">
            <span>Старт</span>
            <span>{finished ? 'Курс завершён' : `Осталось ${progress.totalDays - progress.daysCompleted} дней`}</span>
            <span>Финиш B1 🏁</span>
          </Row>

          {!finished && (
            <Link href="/lesson" className="w-full">
              <Button size="lg" full>Продолжить обучение · день {currentDay}</Button>
            </Link>
          )}
        </Stack>
      </Card>

      <section
        className="relative overflow-hidden rounded-[2rem] border border-line bg-soft px-3 py-5 sm:px-6"
        aria-label="Карта маршрута программы"
      >
        <span aria-hidden className="pointer-events-none absolute -left-10 top-16 size-28 rounded-full bg-ok-bg/70" />
        <span aria-hidden className="pointer-events-none absolute -right-12 top-1/2 size-36 rounded-full bg-primary/10" />
        <span aria-hidden className="pointer-events-none absolute bottom-8 left-1/3 size-20 rounded-full bg-card/70" />

        <div className="relative mx-auto max-w-xl">
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-7 left-1/2 top-7 w-12 -translate-x-1/2 rounded-pill border-8 border-soft2"
          >
            <div className="h-full w-full rounded-pill border-x-2 border-dashed border-primary/50" />
          </div>

          <div className="relative z-10 mx-auto mb-10 w-fit rounded-pill border-2 border-primary bg-card px-4 py-2 text-sm font-semibold shadow-card">
            🚩 Старт курса
          </div>

          <div className="relative z-10 space-y-10">
            {roadmap.map((phase) => (
              <MapIsland
                key={phase.phase}
                phase={phase}
                currentDay={currentDay}
                completedDays={completedDays}
              />
            ))}
          </div>

          <div className="relative z-10 mx-auto mt-10 w-fit rounded-[2rem] border-2 border-ok bg-ok-bg px-5 py-3 text-center shadow-card">
            <span className="block text-2xl" aria-hidden>🏁</span>
            <span className="text-sm font-semibold">Финиш B1</span>
          </div>
        </div>
      </section>

      <Card tone={finished ? 'correct' : 'neutral'}>
        <Stack gap="sm" align="center">
          <span className="text-3xl" aria-hidden>🏁</span>
          <h2 className="font-semibold">Финиш: польский B1</h2>
          <p className="text-center text-sm text-muted">
            {finished
              ? 'Программа завершена. Можно повторять темы и готовиться к экзамену.'
              : 'Каждая точка — один учебный день. После завершения дня она становится зелёной.'}
          </p>
          <Link href="/grammar" className="text-sm text-muted hover:text-ink">
            Открыть ресурс Gramatyka →
          </Link>
        </Stack>
      </Card>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <Row justify="between">
          <h1 className="text-lg font-semibold">Программа</h1>
          <ThemePicker />
        </Row>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4">
        <Stack gap="lg">{children}</Stack>
      </main>
      <Nav />
    </Screen>
  )
}
