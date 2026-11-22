'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button, buttonStyles, Card, Row, Stack } from '@polski/ui'
import { STAGE_TITLE, type Stage, type TodayPlan } from '@/lib/engine/plan'
import type { CurriculumDay } from '@/lib/content/curriculum'
import { LoadingSkeleton } from './LoadingSkeleton'
import { WordRow } from './WordRow'
import { AppIcon } from './AppIcon'
import { GrammarLink } from './GrammarLink'
import { DailyWordCounts } from './DailyWordCounts'
import { WeeklyGoal } from './WeeklyGoal'
import { useTodayPlan } from './useTodayPlan'

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
  if (!exercises) return 'нет заданий'
  return `${exercises} заданий`
}

export function TodayCard() {
  const t = useTranslations()
  const { plan, error, reload } = useTodayPlan()

  const grammar = plan?.stages.find((stage) => stage.id === 'grammar')

  return (
    <Stack gap="lg">
      {error ? (
        <Card tone="featured" constrained={false}>
          <Stack gap="sm">
            <p role="alert" className="text-sm text-danger-ink">{t('errors.generic')}</p>
            <Button variant="outline" onClick={reload}>
              {t('errors.retry')}
            </Button>
          </Stack>
        </Card>
      ) : plan ? <TodayLessonCard plan={plan} /> : (
        <LoadingSkeleton variant="today" label={t('loadingSections.lessonPlan')} />
      )}
      <DailyWordCounts />
      <WeeklyGoal />

      {grammar?.rule && (
        <Card>
          <Stack gap="md">
            <Stack gap="none">
              <span className="text-xs tracking-wide text-muted uppercase">Правило дня</span>
              <strong className="text-base">{grammar.rule.titlePl}</strong>
              <span className="text-sm text-muted">{grammar.rule.title}</span>
            </Stack>
            <p className="text-sm text-muted">{grammar.rule.summary}</p>
            <GrammarLink className={buttonStyles({ variant: 'outline', full: true })}>
              Тренажёр грамматики
            </GrammarLink>
          </Stack>
        </Card>
      )}

      {plan && plan.newWords.length > 0 && (
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

function TodayLessonCard({ plan }: { plan: TodayPlan }) {
  const t = useTranslations()
  const { day } = plan
  const minutes = Math.max(1, Math.round(plan.estimatedSec / 60))

  return (
    <Card tone="featured" constrained={false}>
      <Stack gap="md">
        <Stack gap="none">
          <Row gap="sm" justify="between">
            <span className="text-xs tracking-wide text-muted uppercase">
              {t('today.day', { day: plan.dayNumber, total: plan.totalDays })}
            </span>
            <span className="rounded-pill bg-card px-2.5 py-1 text-xs font-medium text-muted">
              {KIND_LABEL[day.kind]}
            </span>
          </Row>
          <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{day.topic}</h2>
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

        <Link href="/lesson" className={buttonStyles({ size: 'lg', full: true })}>
          {t('today.start', { minutes })}
          <AppIcon name="arrow" className="size-5 shrink-0" />
        </Link>

        <p className="text-xs text-muted">{day.expectedOutcome}</p>
      </Stack>
    </Card>

  )
}
