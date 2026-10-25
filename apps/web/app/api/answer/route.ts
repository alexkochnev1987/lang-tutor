/**
 * Один ответ пользователя: карточка FSRS, запись в лог и — если
 * упражнение было на правило — обновление mastery.
 *
 * Расписание считает КЛИЕНТ: движок (`packages/engine`) языконезависим и
 * про сервер не знает (DEV_RULES R8/R11), переносить его сюда нельзя.
 * Сервер принимает результат, проставляет userId из cookie и пишет.
 *
 * `log.id` — uuid от клиента: повторная отправка того же ответа после
 * обрыва сети не должна задваивать историю, на ней учится оптимизатор
 * параметров FSRS.
 */
import { sql } from 'drizzle-orm'
import { pg } from '@/lib/db/pg'
import { reviewLogs, ruleMastery, studyItems } from '@/lib/db/schema'
import { withUser } from '@/lib/api/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COURSE_ID = process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru'

interface Body {
  // Приходит либо карточка слова, либо mastery правила, либо и то и
  // другое: одно упражнение может отрабатывать и слово, и правило.
  item?: {
    id: string; kind: string; refId: string
    due: string; stability: number; difficulty: number
    elapsedDays: number; scheduledDays: number; learningSteps: number
    reps: number; lapses: number; state: number; lastReview: string | null
  }
  log?: {
    id: string; studyItemId: string; rating: number; state: number
    stability: number; difficulty: number
    elapsedDays: number; scheduledDays: number
    reviewedAt: string; exerciseId?: string; responseMs?: number
  }
  mastery?: {
    grammarRuleId: string; mastery: number; attempts: number; correct: number
    recentWindow: unknown[]; lastPracticedAt?: string; introducedOnDay?: number
  }
}

function parseDate(value: string | null | undefined, field: string): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error(`bad_${field}`)
  return parsed
}

export const POST = withUser(async ({ userId, req }) => {
  const { item, log, mastery } = await req.json() as Body
  if (!item && !mastery) throw new Error('empty_answer')

  if (item) {
    const due = parseDate(item.due, 'due')
    if (!due) throw new Error('bad_due')
    const lastReview = parseDate(item.lastReview, 'last_review')

    await pg.insert(studyItems).values({
      id: item.id,
      userId,
      courseId: COURSE_ID,
      kind: item.kind,
      refId: item.refId,
      due,
      stability: item.stability,
      difficulty: item.difficulty,
      elapsedDays: item.elapsedDays,
      scheduledDays: item.scheduledDays,
      learningSteps: item.learningSteps,
      reps: item.reps,
      lapses: item.lapses,
      state: item.state,
      lastReview,
    }).onConflictDoUpdate({
    target: [studyItems.userId, studyItems.id],
    set: {
      due,
      stability: item.stability,
      difficulty: item.difficulty,
      elapsedDays: item.elapsedDays,
      scheduledDays: item.scheduledDays,
      learningSteps: item.learningSteps,
      reps: item.reps,
      lapses: item.lapses,
      state: item.state,
      lastReview,
      updatedAt: sql`now()`,
    },
    })
  }

  if (log && item) {
    const reviewedAt = parseDate(log.reviewedAt, 'reviewed_at')
    if (!reviewedAt) throw new Error('bad_reviewed_at')
    await pg.insert(reviewLogs).values({
      id: log.id,
      userId,
      studyItemId: log.studyItemId,
      rating: log.rating,
      state: log.state,
      stability: log.stability,
      difficulty: log.difficulty,
      elapsedDays: log.elapsedDays,
      scheduledDays: log.scheduledDays,
      reviewedAt,
      exerciseId: log.exerciseId ?? null,
      responseMs: log.responseMs ?? null,
    }).onConflictDoNothing()   // идемпотентность по клиентскому uuid
  }

  if (mastery) {
    const lastPracticedAt = parseDate(mastery.lastPracticedAt, 'last_practiced_at')
    await pg.insert(ruleMastery).values({
      grammarRuleId: mastery.grammarRuleId,
      userId,
      mastery: mastery.mastery,
      attempts: mastery.attempts,
      correct: mastery.correct,
      recentWindow: mastery.recentWindow,
      lastPracticedAt,
      introducedOnDay: mastery.introducedOnDay ?? null,
    }).onConflictDoUpdate({
      target: [ruleMastery.userId, ruleMastery.grammarRuleId],
      set: {
        mastery: mastery.mastery,
        attempts: mastery.attempts,
        correct: mastery.correct,
        recentWindow: mastery.recentWindow,
        lastPracticedAt,
        updatedAt: sql`now()`,
      },
    })
  }

  return { ok: true }
})
