'use client'

import { useEffect, useState } from 'react'
import { loadState, subscribeDailyWords, useAppState } from '@/lib/data/store'
import type { AppState } from '@/lib/data/types'
import { studyDayKey } from '@/lib/data/study-day'
import { buildTodayPlan, type TodayPlan } from '@/lib/engine/plan'

let cachedPlan: { key: string; plan: TodayPlan } | null = null

function planKey(state: AppState): string {
  const { settings } = state
  const completedDays = state.sessions.filter((session) => session.kind === 'day' && session.completedAt)
  return JSON.stringify([
    state.user.id, settings.timeZone, studyDayKey(settings.timeZone), settings.ruleLanguage,
    settings.dailyBudgetMinutes, settings.newWordsPerDay, settings.grammarExercisesPerDay,
    settings.grammarLessonFormats, settings.readingTextsPerDay, state.course?.startedAt, completedDays.map(({ dayNumber }) => dayNumber).sort(),
  ])
}

export function useTodayPlan() {
  const state = useAppState()
  const key = state ? planKey(state) : null
  const [attempt, setAttempt] = useState(0)
  // A scheduled review can become due without a date or settings change.
  // Listen to the shared word-queue timer, writes, tab changes and focus.
  useEffect(() => subscribeDailyWords(() => setAttempt((count) => count + 1)), [])
  const [result, setResult] = useState<{ key: string | null; plan: TodayPlan | null } | null>(
    () => cachedPlan && cachedPlan.key === key ? cachedPlan : null,
  )

  useEffect(() => {
    let active = true
    if (key === null) {
      void loadState().catch(() => { if (active) setResult({ key: null, plan: null }) })
    } else {
      void buildTodayPlan().then(async (plan) => {
        const latest = await loadState()
        if (!active || planKey(latest) !== key) return
        cachedPlan = { key, plan }
        setResult(cachedPlan)
      }).catch(() => {
        if (active) setResult((current) => current?.key === key && current.plan ? current : { key, plan: null })
      })
    }
    return () => { active = false }
  }, [attempt, key])

  const current = result?.key === key ? result : null
  return {
    plan: current?.plan ?? null,
    error: current !== null && !current.plan,
    reload: () => {
      setResult((previous) => previous?.plan ? previous : null)
      setAttempt((value) => value + 1)
    },
  }
}
