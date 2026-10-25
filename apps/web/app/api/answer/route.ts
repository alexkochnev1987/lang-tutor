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

export const POST = withUser(async ({ userId, req }) => {
  const { item, log, mastery } = await req.json() as Body
  if (!item && !mastery) throw new Error('empty_answer')

  if (item) await pg.insert(studyItems).values({
    ...item,
    userId,
    courseId: COURSE_ID,
    due: new Date(item.due),
    lastReview: item.lastReview ? new Date(item.lastReview) : null,
  }).onConflictDoUpdate({
    target: [studyItems.userId, studyItems.id],
    set: {
      due: new Date(item.due),
      stability: item.stability,
      difficulty: item.difficulty,
      elapsedDays: item.elapsedDays,
      scheduledDays: item.scheduledDays,
      learningSteps: item.learningSteps,
      reps: item.reps,
      lapses: item.lapses,
      state: item.state,
      lastReview: item.lastReview ? new Date(item.lastReview) : null,
      updatedAt: sql`now()`,
    },
  })

  if (log && item) {
    await pg.insert(reviewLogs).values({
      ...log, userId, reviewedAt: new Date(log.reviewedAt),
    }).onConflictDoNothing()   // идемпотентность по клиентскому uuid
  }

  if (mastery) {
    await pg.insert(ruleMastery).values({
      ...mastery,
      userId,
      recentWindow: mastery.recentWindow,
      lastPracticedAt: mastery.lastPracticedAt ? new Date(mastery.lastPracticedAt) : null,
    }).onConflictDoUpdate({
      target: [ruleMastery.userId, ruleMastery.grammarRuleId],
      set: {
        mastery: mastery.mastery,
        attempts: mastery.attempts,
        correct: mastery.correct,
        recentWindow: mastery.recentWindow,
        lastPracticedAt: mastery.lastPracticedAt ? new Date(mastery.lastPracticedAt) : null,
        updatedAt: sql`now()`,
      },
    })
  }

  return { ok: true }
})
