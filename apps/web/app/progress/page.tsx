'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, Meter, Row, Screen, Stack, Stat } from '@polski/ui'
import { Nav } from '@/app/_components/Nav'
import { loadProgress, type Progress, type RuleProgress } from '@/lib/engine/progress'

/** Официальный порог и наша цель с запасом — exam-spec.json / SPACED_REPETITION.md §6 */
const THRESHOLD = 50
const TARGET = 65

export default function ProgressPage() {
  const t = useTranslations()
  const [p, setP] = useState<Progress | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    loadProgress().then((r) => alive && setP(r)).catch(() => alive && setError(true))
    return () => { alive = false }
  }, [])

  if (error) return <Shell><Card><p className="text-sm text-danger">{t('errors.generic')}</p></Card></Shell>
  if (!p) return <Shell><Card><p className="text-sm text-muted">{t('common.loading')}</p></Card></Shell>

  return (
    <Shell>
      <Card>
        <Row gap="lg" wrap>
          <Stat value={`${p.day}/${p.totalDays}`} label="день программы" />
          <Stat value={p.streak} label="дней подряд" />
          <Stat value={p.lexemes.known} label="слов освоено"
                hint={`+${p.lexemes.learning} в работе`} />
          <Stat value={`${p.rules.introduced}/${p.rules.total}`} label="правил введено"
                hint={`${p.rules.strong} освоено`} />
        </Row>
      </Card>

      <Card>
        <Stack gap="md">
          <Stack gap="none">
            <h2 className="font-semibold">{t('exam.readiness')}</h2>
            <p className="text-xs text-muted">
              Порог — 50% в каждом модуле. Цель приложения — 65%: реальный
              экзамен тяжелее тренировки.
            </p>
          </Stack>

          {p.scores.map((s) => (
            <Stack key={s.moduleId} gap="xs">
              <Row justify="between">
                <span className="text-sm">
                  {t(`exam.modules.${s.moduleId}` as never)}
                  {s.moduleId === p.weakest && (
                    <span className="ml-2 rounded-pill bg-warn-bg px-2 py-0.5 text-xs text-warn-ink">
                      слабейший
                    </span>
                  )}
                </span>
                <span className="text-sm tabular-nums text-muted">
                  {s.estimatedPercent}%
                  {s.confidence < 0.3 && <span className="ml-1 opacity-60">· оценка</span>}
                </span>
              </Row>
              <Meter value={s.estimatedPercent} threshold={THRESHOLD} target={TARGET} />
            </Stack>
          ))}

          <p className="rounded-card bg-soft px-3 py-2 text-xs text-muted">
            {p.ready
              ? 'Все модули выше цели — можно записываться на экзамен.'
              : `Проваленный модуль валит весь экзамен, поэтому время идёт слабейшему. Сейчас это «${
                  p.weakest ? t(`exam.modules.${p.weakest}` as never) : '—'}».`}
          </p>
        </Stack>
      </Card>

      {p.weakRules.length > 0 && (
        <Card>
          <Stack gap="sm">
            <h2 className="font-semibold">Слабые правила</h2>
            <p className="text-xs text-muted">Получают дриллы в первую очередь</p>
            {p.weakRules.map((r) => <RuleRow key={r.id} rule={r} />)}
          </Stack>
        </Card>
      )}

      {p.interferenceRules.length > 0 && (
        <Card>
          <Stack gap="sm">
            <Stack gap="none">
              <h2 className="font-semibold">Там, где мешает русский</h2>
              <p className="text-xs text-muted">
                22 правила из 66 имеют высокий риск интерференции — тема
                узнаваемая, а деталь другая
              </p>
            </Stack>
            {p.interferenceRules.map((r) => <RuleRow key={r.id} rule={r} showRisk />)}
          </Stack>
        </Card>
      )}
    </Shell>
  )
}

function RuleRow({ rule, showRisk }: { rule: RuleProgress; showRisk?: boolean }) {
  return (
    <Stack gap="xs" className="border-b border-line pb-2 last:border-0 last:pb-0">
      <Row justify="between" gap="sm">
        <span className="text-sm">{rule.titleRu}</span>
        <Row gap="xs">
          {showRisk && (
            <span className="rounded-pill bg-danger-bg px-2 py-0.5 text-xs text-danger-ink">
              риск {rule.interferenceRu}
            </span>
          )}
          <span className="text-sm tabular-nums text-muted">
            {Math.round(rule.mastery * 100)}%
          </span>
        </Row>
      </Row>
      <Meter value={rule.mastery * 100} target={85} threshold={60} />
    </Stack>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('nav')
  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <h1 className="text-lg font-semibold">{t('progress')}</h1>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4">
        <Stack gap="lg">{children}</Stack>
      </main>
      <Nav />
    </Screen>
  )
}
