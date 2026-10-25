/**
 * Мост между Dexie и движком.
 *
 * Движок языконезависим и ничего не знает про IndexedDB (R8/R11).
 * Здесь — единственное место, где они встречаются.
 */
import {
  createScheduler, generateLesson, newItem, rate, Rating,
  type DayPlan, type Grade, type Lesson, type ModuleScore,
  type PassRule, type RuleMastery, type StudyItem, type StudyItemKind,
} from '@polski/engine'
import { db, type StudyItem as DbItem } from '@/lib/db/dexie'
import { COURSE_ID, type CurriculumDay } from '@/lib/content/curriculum'

export const scheduler = createScheduler()

/** Польский B1: ≥50% в КАЖДОМ модуле. exam-spec.json → legallyFixed.passRule */
export const PASS_RULE: PassRule = { kind: 'per-module-floor', thresholdPercent: 50 }

const toEngine = (r: DbItem): StudyItem => ({
  id: r.id, kind: r.kind, refId: r.refId,
  card: {
    due: r.due, stability: r.stability, difficulty: r.difficulty,
    elapsed_days: r.elapsed_days, scheduled_days: r.scheduled_days,
    learning_steps: r.learning_steps, reps: r.reps, lapses: r.lapses,
    state: r.state, last_review: r.last_review,
  },
})

const toDb = (i: StudyItem): DbItem => ({
  id: i.id, courseId: COURSE_ID, kind: i.kind, refId: i.refId, ...i.card,
})

export async function loadStudyItems(): Promise<StudyItem[]> {
  const rows = await db.studyItems.where('courseId').equals(COURSE_ID).toArray()
  return rows.map(toEngine)
}

export async function loadMastery(): Promise<RuleMastery[]> {
  const rows = await db.ruleMastery.toArray()
  return rows.map((r) => ({
    grammarRuleId: r.grammarRuleId, mastery: r.mastery,
    attempts: r.attempts, correct: r.correct,
    lastPracticedAt: r.lastPracticedAt?.getTime() ?? null,
  }))
}

export async function loadModuleScores(): Promise<ModuleScore[]> {
  const rows = await db.moduleReadiness.where('courseId').equals(COURSE_ID).toArray()
  if (rows.length) {
    return rows.map((r) => ({
      moduleId: r.moduleId, estimatedPercent: r.estimatedPercent, confidence: r.confidence,
    }))
  }
  // до первого среза считаем, что всё на нуле — тогда слабейшим будет
  // первый по алфавиту, и генератор пойдёт по ротации из программы
  return ['listening', 'reading', 'grammar', 'writing', 'speaking'].map((moduleId) => ({
    moduleId, estimatedPercent: 0, confidence: 0,
  }))
}

export async function buildTodayLesson(day: CurriculumDay): Promise<Lesson> {
  const [items, mastery, moduleScores] = await Promise.all([
    loadStudyItems(), loadMastery(), loadModuleScores(),
  ])
  const plan: DayPlan = {
    day: day.day, kind: day.kind,
    grammarRuleIds: day.grammarRuleIds, lexemeIds: day.lexemeIds ?? [],
    newWordCount: day.newWordCount, examFocus: day.examFocus,
    timeBudgetSec: day.timeBudgetSec,
  }
  return generateLesson({
    scheduler, plan, items, mastery, moduleScores,
    passRule: PASS_RULE, now: new Date(),
  })
}

/** Создаёт карточки для слова: узнавание и воспроизведение — отдельно. */
export async function ensureLexemeCards(lexemeId: string, now = new Date()) {
  const kinds: StudyItemKind[] = ['lexeme-recognition', 'lexeme-production']
  for (const kind of kinds) {
    const id = `${kind}:${lexemeId}`
    if (await db.studyItems.get(id)) continue
    await db.studyItems.put(toDb(newItem(id, kind, lexemeId, now)))
  }
}

/** Записывает ответ: обновляет карточку FSRS и пишет лог. */
export async function recordAnswer(
  itemId: string, grade: Grade, responseMs: number, now = new Date(),
) {
  const row = await db.studyItems.get(itemId)
  if (!row) return
  const { item, log } = rate(scheduler, toEngine(row), grade, now)
  await db.studyItems.put(toDb(item))
  await db.reviewLogs.add({
    studyItemId: itemId, rating: log.rating, state: log.state,
    stability: log.stability, difficulty: log.difficulty,
    elapsedDays: log.elapsed_days, scheduledDays: log.scheduled_days,
    reviewedAt: now, responseMs,
  })
}

export { Rating }
export type { Grade, Lesson }
