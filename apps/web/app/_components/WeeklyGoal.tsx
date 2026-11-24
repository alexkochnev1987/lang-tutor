'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button, Card, Row, Stack } from '@polski/ui'
import { loadState, useAppState } from '@/lib/data/store'
import { SkeletonBlock } from './LoadingSkeleton'
import { WEEKLY_GOAL, weeklyProgress } from '@/lib/engine/weekly-goal'

type IconName = 'calendar' | 'complete' | 'today' | 'missed' | 'upcoming'

const iconPaths: Record<IconName, string> = {
  calendar: 'M7 3v4m10-4v4M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 10 2 2 4-4',
  complete: 'm6 12 4 4 8-8',
  today: 'M12 7v10M7 12h10',
  missed: 'M7 12h10',
  upcoming: 'M12 12h.01',
}

function GoalIcon({ name, className }: { name: IconName; className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={iconPaths[name]} />
    </svg>
  )
}

function useWeeklyProgress() {
  const state = useAppState()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const update = () => setNow(new Date())
    const timer = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  // A session can arrive from the store after the last clock tick.
  return state ? weeklyProgress(state.sessions, state.settings.timeZone, new Date(Math.max(now.getTime(), Date.now()))) : null
}

const dayStyles: Record<Exclude<IconName, 'calendar'>, string> = {
  complete: 'border-transparent bg-ok-bg text-ok-ink',
  today: 'border-accent-ink bg-soft2 text-accent-ink',
  missed: 'border-transparent bg-soft text-muted',
  upcoming: 'border-line bg-transparent text-muted',
}

export function WeeklyGoal() {
  const t = useTranslations('weeklyGoal')
  const locale = useLocale()
  const week = useWeeklyProgress()

  const loading = useTranslations('loadingSections')
  const errors = useTranslations('errors')
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void loadState().catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [attempt])

  if (!week) {
    return (
      <Card constrained={false}>
        <Stack gap="sm">
          <Row gap="sm" justify="between">
            <Row gap="sm"><GoalIcon name="calendar" className="size-5 shrink-0 text-accent-ink" />
            <h2 className="text-sm font-semibold">{t('title')}</h2></Row>
            {!failed && <SkeletonBlock className="h-5 w-12" />}
          </Row>
          {failed ? (
            <>
              <p role="alert" className="text-xs text-danger-ink">{loading('unavailable')}</p>
              <Button size="sm" variant="outline" onClick={() => {
                setFailed(false)
                setAttempt((current) => current + 1)
              }}>{errors('retry')}</Button>
            </>
          ) : (
            <>
              <ol className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }, (_, index) => (
                  <li key={index} className="flex flex-col items-center gap-1">
                    <SkeletonBlock className="h-4 w-6" />
                    <SkeletonBlock className="size-7 rounded-full" />
                  </li>
                ))}
              </ol>
              <SkeletonBlock className="h-4 w-4/5" />
              <p role="status" className="sr-only">{loading('weeklyGoal')}</p>
            </>
          )}
        </Stack>
      </Card>
    )
  }

  const shortDay = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  const longDay = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' })

  return (
    <Card constrained={false}>
      <section aria-labelledby="weekly-goal-title">
        <Stack gap="sm">
          <Row gap="sm" justify="between">
            <Row gap="sm">
              <GoalIcon name="calendar" className="size-5 shrink-0 text-accent-ink" />
              <h2 id="weekly-goal-title" className="text-sm font-semibold">{t('title')}</h2>
            </Row>
            <p className="text-sm font-semibold tabular-nums">{t('count', { count: Math.min(week.count, WEEKLY_GOAL), goal: WEEKLY_GOAL })}</p>
          </Row>

          <ol className="grid grid-cols-7 gap-1" role="list">
            {week.days.map(({ date, status, isToday }) => (
              <li key={date} aria-current={isToday ? 'date' : undefined}
                className="flex flex-col items-center gap-1">
                <span className="sr-only">{longDay.format(date)} · {t(status)}</span>
                <span aria-hidden="true" className={isToday ? 'text-xs font-semibold' : 'text-xs text-muted'}>
                  {shortDay.format(date)}
                </span>
                <span className={`flex size-7 items-center justify-center rounded-full border ${dayStyles[status]}`}>
                  <GoalIcon name={status} className="size-4" />
                </span>
              </li>
            ))}
          </ol>

          <p className="text-xs text-muted">
            {week.count >= WEEKLY_GOAL ? t('achieved') : week.todayComplete ? t('credited') : t('instruction')}
          </p>
        </Stack>
      </section>
    </Card>
  )
}

export function WeeklyGoalCredit() {
  const t = useTranslations('weeklyGoal')
  const week = useWeeklyProgress()

  if (!week?.todayComplete) return null

  return (
    <p className="inline-flex items-center gap-1.5 rounded-pill bg-ok-bg px-3 py-1 text-sm text-ok-ink">
      <GoalIcon name="complete" className="size-4 shrink-0" />
      {week.count >= WEEKLY_GOAL ? t('achieved') : t('credit', { count: week.count, goal: WEEKLY_GOAL })}
    </p>
  )
}
