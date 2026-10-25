'use client'

import { Row, Stack } from '@polski/ui'
import { SpeakIcon } from './ExerciseView'
import type { LocalizedRule } from '@/lib/content/rules'

export function RuleView({ rule, compact }: { rule: LocalizedRule; compact?: boolean }) {
  return (
    <Stack gap="md">
      <Stack gap="none">
        <Row gap="sm" justify="between">
          <strong className="text-lg">{rule.titlePl}</strong>
          {rule.interferenceRu >= 4 && (
            <span className="shrink-0 rounded-pill bg-warn-bg px-2 py-0.5 text-xs text-warn-ink">
              русский мешает
            </span>
          )}
        </Row>
        <span className="text-sm text-muted">{rule.title}</span>
      </Stack>

      <p className="text-sm">{rule.summary}</p>

      {rule.showsOriginalInstead && (
        <p className="rounded-card bg-soft px-3 py-2 text-xs text-muted">
          Перевода этого правила пока нет — показан русский оригинал.
        </p>
      )}

      {rule.examples.length > 0 && (
        <Stack gap="xs">
          <span className="text-xs tracking-wide text-muted uppercase">Примеры</span>
          {rule.examples.map((e) => (
            <Row key={e.pl} gap="sm" justify="between">
              <Stack gap="none">
                <span className="text-sm text-accent-ink">{e.pl}</span>
                {e.gloss && <span className="text-xs text-muted">{e.gloss}</span>}
              </Stack>
              <SpeakIcon text={e.pl} size="sm" />
            </Row>
          ))}
        </Stack>
      )}

      {!compact && rule.pitfalls.length > 0 && (
        <Stack gap="xs">
          <span className="text-xs tracking-wide text-muted uppercase">Где ошибаются</span>
          {rule.pitfalls.map((p) => (
            <p key={p} className="rounded-card bg-danger-bg px-3 py-2 text-sm text-danger-ink">
              {p}
            </p>
          ))}
        </Stack>
      )}

      {!compact && rule.teachingNote && (
        <p className="rounded-card bg-soft px-3 py-2 text-sm text-muted">{rule.teachingNote}</p>
      )}
    </Stack>
  )
}
