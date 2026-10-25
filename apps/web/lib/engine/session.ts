/**
 * Мост между хранилищем и движком.
 *
 * Движок языконезависим и ничего не знает ни про базу, ни про сеть
 * (R8/R11): расписание считается здесь, на клиенте, а сервер принимает
 * готовый результат. Это единственное место, где движок встречается с
 * данными пользователя.
 */
import {
  applyAttempt, createScheduler, generateLesson, newItem, rate, Rating,
  type DayPlan, type Grade, type Lesson, type ModuleScore,
  type PassRule, type RuleMastery, type StudyItem, type StudyItemKind,
} from '@polski/engine'
import { knownLexemeIds, loadState, saveAnswer, saveMastery } from '@/lib/data/store'
import type { RuleMasteryRow, StudyItemRow } from '@/lib/data/types'
import { type CurriculumDay } from '@/lib/content/curriculum'

export const scheduler = createScheduler()

/** Польский B1: ≥50% в КАЖДОМ модуле. exam-spec.json → legallyFixed.passRule */
export const PASS_RULE: PassRule = { kind: 'per-module-floor', thresholdPercent: 50 }

/** Строка из базы → элемент движка. Колонки camelCase, Card — snake_case. */
const toEngine = (r: StudyItemRow): StudyItem => ({
  id: r.id, kind: r.kind, refId: r.refId,
  card: {
    due: r.due, stability: r.stability, difficulty: r.difficulty,
    elapsed_days: r.elapsedDays, scheduled_days: r.scheduledDays,
    learning_steps: r.learningSteps, reps: r.reps, lapses: r.lapses,
    state: r.state, last_review: r.lastReview ?? undefined,
  },
})

const toRow = (i: StudyItem): StudyItemRow => ({
  id: i.id, kind: i.kind as StudyItemRow['kind'], refId: i.refId,
  due: i.card.due, stability: i.card.stability, difficulty: i.card.difficulty,
  elapsedDays: i.card.elapsed_days, scheduledDays: i.card.scheduled_days,
  learningSteps: i.card.learning_steps, reps: i.card.reps, lapses: i.card.lapses,
  state: i.card.state, lastReview: i.card.last_review ?? null,
})

export async function loadStudyItems(): Promise<StudyItem[]> {
  const { studyItems } = await loadState()
  return studyItems.map(toEngine)
}

export async function loadMastery(): Promise<RuleMastery[]> {
  const { mastery } = await loadState()
  return mastery.map((r) => ({
    grammarRuleId: r.grammarRuleId, mastery: r.mastery,
    attempts: r.attempts, correct: r.correct,
    lastPracticedAt: r.lastPracticedAt?.getTime() ?? null,
  }))
}

export async function loadModuleScores(): Promise<ModuleScore[]> {
  const { readiness } = await loadState()
  if (readiness.length) {
    return readiness.map((r) => ({
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
  const [items, mastery, moduleScores, state] = await Promise.all([
    loadStudyItems(), loadMastery(), loadModuleScores(), loadState(),
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
    suspendedRefIds: knownLexemeIds(state),
  })
}

/** Создаёт карточки для слова: узнавание и воспроизведение — отдельно. */
export async function ensureLexemeCards(lexemeId: string, now = new Date()): Promise<void> {
  const kinds: StudyItemKind[] = ['lexeme-recognition', 'lexeme-production']
  const { studyItems } = await loadState()
  for (const kind of kinds) {
    const id = `${kind}:${lexemeId}`
    if (studyItems.some((i) => i.id === id)) continue
    await saveAnswer({ item: toRow(newItem(id, kind, lexemeId, now)) })
  }
}

/** Ответ на упражнение по слову: пересчёт FSRS и запись в лог. */
export async function recordAnswer(
  itemId: string, grade: Grade, responseMs: number, now = new Date(),
): Promise<void> {
  const { studyItems } = await loadState()
  const row = studyItems.find((i) => i.id === itemId)
  if (!row) return

  const { item, log } = rate(scheduler, toEngine(row), grade, now)
  await saveAnswer({
    item: toRow(item),
    log: {
      // uuid от клиента: повторная отправка после обрыва сети не
      // задвоит историю — на сервере ON CONFLICT DO NOTHING
      id: crypto.randomUUID(),
      studyItemId: itemId,
      rating: log.rating, state: log.state,
      stability: log.stability, difficulty: log.difficulty,
      elapsedDays: log.elapsed_days, scheduledDays: log.scheduled_days,
      reviewedAt: now, responseMs,
    },
  })
}

/**
 * Ответ на упражнение по правилу.
 *
 * Грамматика идёт в mastery-модель, а не в FSRS: правило — это навык на
 * множестве элементов, его забывание видно по ошибкам в разных
 * упражнениях, а не по одному отзыву (RESEARCH.md §7.3).
 */
export async function recordRuleAttempt(
  ruleId: string, correct: boolean, exerciseDifficulty: number, at = Date.now(),
): Promise<void> {
  const { mastery } = await loadState()
  const prev: RuleMasteryRow = mastery.find((m) => m.grammarRuleId === ruleId) ?? {
    grammarRuleId: ruleId, mastery: 0, attempts: 0, correct: 0,
    recentWindow: [], lastPracticedAt: null, introducedOnDay: null,
  }
  const next = applyAttempt(
    {
      grammarRuleId: prev.grammarRuleId, mastery: prev.mastery,
      attempts: prev.attempts, correct: prev.correct,
      lastPracticedAt: prev.lastPracticedAt?.getTime() ?? null,
    },
    { correct, exerciseDifficulty, at },
  )
  await saveMastery({
    ...prev,
    mastery: next.mastery,
    attempts: next.attempts,
    correct: next.correct,
    recentWindow: [...prev.recentWindow.slice(-9),
      { correct, weight: exerciseDifficulty, at }],
    lastPracticedAt: new Date(at),
  })
}

export { Rating }
export type { Grade, Lesson }
