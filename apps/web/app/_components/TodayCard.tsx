'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Card, Row, Stack } from '@polski/ui'
import {
  loadCurriculum, loadGrammarRules, loadVocabulary, currentDayNumber,
  type CurriculumDay, type GrammarRule, type Lexeme,
} from '@/lib/content/curriculum'
import { WordRow } from './WordRow'

const KIND_LABEL: Record<CurriculumDay['kind'], string> = {
  diagnostic: 'Диагностика',
  new: 'Новая тема',
  consolidation: 'Закрепление',
  'weekly-check': 'Недельный срез',
  checkpoint: 'Контрольный срез',
  final: 'Итоговая оценка',
}

const BLOCK_LABEL: Record<string, string> = {
  review: 'Повторение',
  newGrammar: 'Новая грамматика',
  practice: 'Практика',
  exam: 'Экзаменационное задание',
  analysis: 'Разбор ошибок',
}

export function TodayCard() {
  const t = useTranslations()
  const [day, setDay] = useState<CurriculumDay | null>(null)
  const [total, setTotal] = useState(182)
  const [rule, setRule] = useState<GrammarRule | null>(null)
  const [words, setWords] = useState<Lexeme[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const c = await loadCurriculum()
        const n = await currentDayNumber(c.stats.totalDays)
        const d = c.days[n - 1]
        if (!alive) return
        setTotal(c.stats.totalDays)
        setDay(d)
        if (d.grammarRuleIds.length) {
          const rules = await loadGrammarRules()
          if (alive) setRule(rules.get(d.grammarRuleIds[0]) ?? null)
        }
        if (d.lexemeIds?.length) {
          const vocab = await loadVocabulary()
          if (alive) setWords(d.lexemeIds.map((id) => vocab.get(id)).filter(Boolean) as Lexeme[])
        }
      } catch {
        if (alive) setError(true)
      }
    })()
    return () => { alive = false }
  }, [])

  if (error) {
    return <Card><p className="text-sm text-danger">{t('errors.generic')}</p></Card>
  }
  if (!day) {
    return <Card><p className="text-sm text-muted">{t('common.loading')}</p></Card>
  }

  const blocks = Object.entries(day.timeBudgetSec).filter(([, s]) => s > 0)

  return (
    <Card>
      <Stack gap="md">
        <Stack gap="none">
          <Row gap="sm" justify="between">
            <span className="text-xs tracking-wide text-muted uppercase">
              {t('today.day', { day: day.day, total })}
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

        {rule && (
          <Stack gap="xs" className="rounded-card bg-soft p-3">
            <Row gap="sm" justify="between">
              <strong className="text-sm">{rule.title.pl}</strong>
              {rule.interferenceRu >= 4 && (
                <span className="rounded-pill bg-warn-bg px-2 py-0.5 text-xs text-warn-ink">
                  русский мешает
                </span>
              )}
            </Row>
            <p className="text-sm text-muted">{rule.summary}</p>
            {rule.examples[0] && (
              <p className="text-sm">
                <span className="text-accent-ink">{rule.examples[0].pl}</span>
                <span className="text-muted"> — {rule.examples[0].ru}</span>
              </p>
            )}
          </Stack>
        )}

        <Stack gap="xs">
          {blocks.map(([name, sec]) => (
            <Row key={name} gap="sm" justify="between">
              <span className="text-sm text-muted">{BLOCK_LABEL[name] ?? name}</span>
              <span className="text-sm tabular-nums">{Math.round(sec / 60)} мин</span>
            </Row>
          ))}
        </Stack>

        {words.length > 0 && (
          <Stack gap="xs">
            <span className="text-xs tracking-wide text-muted uppercase">
              Слова дня · {words.length}
            </span>
            <div className="rounded-card border border-line">
              <div className="px-3">
                {words.map((w) => <WordRow key={w.id} word={w} />)}
              </div>
            </div>
          </Stack>
        )}

        <Button size="lg" full disabled>
          {t('today.start', { minutes: Math.round(day.totalSec / 60) })}
        </Button>

        <p className="text-xs text-muted">{day.expectedOutcome}</p>
      </Stack>
    </Card>
  )
}
