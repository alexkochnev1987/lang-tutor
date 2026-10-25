'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button, Card, Row, Stack } from '@polski/ui'
import { STAGE_TITLE, buildTodayPlan, type Stage, type TodayPlan } from '@/lib/engine/plan'
import type { CurriculumDay } from '@/lib/content/curriculum'
import { WordRow } from './WordRow'

const KIND_LABEL: Record<CurriculumDay['kind'], string> = {
  diagnostic: 'Диагностика',
  new: 'Новая тема',
  consolidation: 'Закрепление',
  'weekly-check': 'Недельный срез',
  checkpoint: 'Контрольный срез',
  final: 'Итоговая оценка',
}

function stageSummary(stage: Stage, plan: TodayPlan): string {
  const exercises = stage.steps.filter((s) => s.kind === 'exercise').length
  if (stage.id === 'words') {
    const parts: string[] = []
    if (plan.reviewCount) parts.push(`${plan.reviewCount} на повторение`)
    if (plan.newWords.length) parts.push(`${plan.newWords.length} новых`)
    return parts.join(' · ') || 'нет заданий'
  }
  if (stage.id === 'analysis') return 'по ошибкам занятия'
  if (!exercises) return 'нет заданий'
  return `${exercises} заданий`
}

export function TodayCard() {
  const t = useTranslations()
  const [plan, setPlan] = useState<TodayPlan | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    buildTodayPlan()
      .then((p) => { if (alive) setPlan(p) })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [])

  if (error) {
    return <Card><p className="text-sm text-danger">{t('errors.generic')}</p></Card>
  }
  if (!plan) {
    return <Card><p className="text-sm text-muted">{t('common.loading')}</p></Card>
  }

  const { day } = plan
  const minutes = Math.max(1, Math.round(plan.estimatedSec / 60))
  const grammar = plan.stages.find((s) => s.id === 'grammar')

  return (
    <Stack gap="lg">
      <Card>
        <Stack gap="md">
          <Stack gap="none">
            <Row gap="sm" justify="between">
              <span className="text-xs tracking-wide text-muted uppercase">
                {t('today.day', { day: plan.dayNumber, total: plan.totalDays })}
              </span>
              <span className="rounded-pill bg-soft2 px-2 py-0.5 text-xs text-accent-ink">
                {KIND_LABEL[day.kind]}
              </span>
            </Row>
            <h1 className="text-xl font-semibold">{day.topic}</h1>
            <span className="text-sm text-muted">
              Неделя {day.week} · {day.phaseTitle} · тема «{day.themeRu}»
            </span>
          </Stack>

          {plan.deferredCount > 0 && (
            <Row gap="sm" justify="between" className="rounded-card bg-soft2 px-3 py-2">
              <span className="text-sm text-accent-ink">Не поместилось в бюджет</span>
              <span className="text-sm font-semibold tabular-nums text-accent-ink">
                {plan.deferredCount}
              </span>
            </Row>
          )}

          <Stack gap="xs">
            {plan.stages.map((s) => (
              <Row key={s.id} gap="sm" justify="between">
                <span className="text-sm text-muted">{STAGE_TITLE[s.id]}</span>
                <span className="text-sm tabular-nums">
                  {s.missingContent ? '—' : stageSummary(s, plan)}
                </span>
              </Row>
            ))}
          </Stack>

          {plan.stages.filter((s) => s.missingContent).map((s) => (
            <p key={s.id} className="rounded-card bg-warn-bg px-3 py-2 text-xs text-warn-ink">
              {STAGE_TITLE[s.id]} — {s.missingContent}
            </p>
          ))}

          <Link href="/lesson" className="w-full">
            <Button size="lg" full>
              {day.kind === 'diagnostic'
                ? 'Пройти диагностику'
                : t('today.start', { minutes })}
            </Button>
          </Link>

          <p className="text-xs text-muted">{day.expectedOutcome}</p>
        </Stack>
      </Card>

      {grammar?.rule && (
        <Card>
          <Stack gap="md">
            <Stack gap="none">
              <span className="text-xs tracking-wide text-muted uppercase">Правило дня</span>
              <strong className="text-base">{grammar.rule.titlePl}</strong>
              <span className="text-sm text-muted">{grammar.rule.title}</span>
            </Stack>
            <p className="text-sm text-muted">{grammar.rule.summary}</p>
            <Link href="/grammar" className="w-full">
              <Button variant="outline" full>Тренажёр грамматики</Button>
            </Link>
          </Stack>
        </Card>
      )}

      {plan.newWords.length > 0 && (
        <Card>
          <Stack gap="md">
            <Row gap="sm" justify="between">
              <span className="text-xs tracking-wide text-muted uppercase">
                Слова дня · {plan.newWords.length}
              </span>
              <Link href="/dictionary" className="text-sm text-muted hover:text-ink">
                Весь словарь →
              </Link>
            </Row>
            <div className="-my-2">
              {plan.newWords.map((w) => <WordRow key={w.id} word={w} />)}
            </div>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}
