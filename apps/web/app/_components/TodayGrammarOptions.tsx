import { useTranslations } from 'next-intl'
import { Button, Card, Stack } from '@polski/ui'
import type { Exercise } from '@polski/engine'
import type { LocalizedRule } from '@/lib/content/rules'
import { GRAMMAR_FORMATS, grammarFormat, type grammarPracticePlan } from '@/lib/engine/grammar-practice-plan'

export function TodayGrammarOptions({ plan, onStart }: {
  plan: ReturnType<typeof grammarPracticePlan>
  onStart: (exercises: Exercise[], rule?: LocalizedRule | null) => void
}) {
  const t = useTranslations('grammarToday')
  const count = (exercises: Exercise[]) => t('count', { count: exercises.length })
  const quickFormats = GRAMMAR_FORMATS.filter((format) => plan.quick.some((exercise) => grammarFormat(exercise) === format))

  return (
    <Stack gap="md">
      {plan.quick.length < plan.exercises.length && (
        <Card tone="featured">
          <Stack gap="sm">
            <Button size="lg" full onClick={() => onStart(plan.quick)}>
              {t('quick')} · {count(plan.quick)}
            </Button>
            <p className="text-sm text-muted">{quickFormats.map((format) => t(format)).join(' · ')}</p>
          </Stack>
        </Card>
      )}

      <h2 className="mx-auto w-full max-w-(--container-exercise) text-lg font-semibold">{t('topics')}</h2>
      {plan.topics.map(({ rule, exercises }) => {
        const example = rule?.examples.find((item) => item.pl)?.pl
        const formats = GRAMMAR_FORMATS.map((format) => ({
          format,
          exercises: exercises.filter((exercise) => grammarFormat(exercise) === format),
        })).filter((entry) => entry.exercises.length > 0)

        return (
          <Card key={rule?.id ?? 'other'}>
            <Stack gap="sm">
              <h3 className="font-semibold">{rule?.title ?? t('other')}</h3>
              {example && <p lang="pl" className="text-sm text-muted">{example}</p>}
              {formats.map((entry) => (
                <Button key={entry.format} variant="outline" full onClick={() => onStart(entry.exercises, rule)}>
                  {t(entry.format)} · {count(entry.exercises)}
                </Button>
              ))}
              {formats.length > 1 && (
                <Button variant="ghost" full onClick={() => onStart(exercises, rule)}>
                  {t('allTopic')} · {count(exercises)}
                </Button>
              )}
            </Stack>
          </Card>
        )
      })}
      <div className="mx-auto w-full max-w-(--container-exercise)">
        <Button variant="outline" full onClick={() => onStart(plan.exercises)}>
          {t('all')} · {count(plan.exercises)}
        </Button>
      </div>
    </Stack>
  )
}
