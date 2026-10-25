/**
 * Сводка прогресса для экрана «Прогресс».
 * Собирает данные из IndexedDB и прогоняет через движок.
 */
import { State } from 'ts-fsrs'
import { decayed, estimateModuleReadiness, evaluate, type ModuleScore } from '@polski/engine'
import { db } from '@/lib/db/dexie'
import { COURSE_ID, loadCurriculum, loadGrammarRules, loadVocabulary } from '@/lib/content/curriculum'
import { PASS_RULE } from './session'

export const MODULES = ['listening', 'reading', 'grammar', 'writing', 'speaking'] as const

export interface RuleProgress {
  id: string
  titleRu: string
  category: string
  mastery: number
  attempts: number
  interferenceRu: number
}

export interface Progress {
  day: number
  totalDays: number
  daysCompleted: number
  streak: number
  scores: ModuleScore[]
  weakest: string | null
  ready: boolean
  lexemes: { known: number; learning: number; total: number }
  rules: { introduced: number; strong: number; weak: number; total: number }
  weakRules: RuleProgress[]
  interferenceRules: RuleProgress[]
}

export async function loadProgress(): Promise<Progress> {
  const now = Date.now()
  const [curriculum, vocab, grammar] = await Promise.all([
    loadCurriculum(), loadVocabulary(), loadGrammarRules(),
  ])
  const [items, masteryRows, sessions, mockRows] = await Promise.all([
    db.studyItems.where('courseId').equals(COURSE_ID).toArray(),
    db.ruleMastery.toArray(),
    db.lessonSessions.filter((s) => Boolean(s.completedAt)).toArray(),
    db.moduleReadiness.where('courseId').equals(COURSE_ID).toArray(),
  ])

  const mastery = masteryRows.map((r) => ({
    grammarRuleId: r.grammarRuleId, mastery: r.mastery,
    attempts: r.attempts, correct: r.correct,
    lastPracticedAt: r.lastPracticedAt?.getTime() ?? null,
  }))

  const ruleModules: Record<string, string[]> = {}
  for (const [id, r] of grammar) ruleModules[id] = r.examModules

  const mockScores: Record<string, number> = {}
  for (const m of mockRows) if (m.lastMockScore != null) mockScores[m.moduleId] = m.lastMockScore

  // зрелыми считаем карточки, вышедшие из фазы заучивания
  const known = items.filter((i) => i.state === State.Review).length
  const learning = items.filter(
    (i) => i.state === State.Learning || i.state === State.Relearning).length

  const scores = estimateModuleReadiness({
    mastery, ruleModules, lexemesKnown: known,
    lexemesTotal: vocab.size * 2,   // узнавание + воспроизведение
    mockScores, modules: [...MODULES], now,
  })
  const verdict = evaluate(scores, PASS_RULE)

  const toProgress = (m: typeof mastery[number]): RuleProgress => {
    const r = grammar.get(m.grammarRuleId)
    return {
      id: m.grammarRuleId,
      titleRu: r?.title.ru ?? m.grammarRuleId,
      category: r?.category ?? '—',
      mastery: decayed(m, now),
      attempts: m.attempts,
      interferenceRu: r?.interferenceRu ?? 0,
    }
  }

  const all = mastery.map(toProgress)
  const daysCompleted = sessions.length

  return {
    day: Math.min(curriculum.stats.totalDays, daysCompleted + 1),
    totalDays: curriculum.stats.totalDays,
    daysCompleted,
    streak: computeStreak(sessions.map((s) => s.completedAt!).sort((a, b) => +b - +a)),
    scores,
    weakest: verdict.weakest,
    ready: verdict.ready,
    lexemes: { known, learning, total: vocab.size * 2 },
    rules: {
      introduced: all.length,
      strong: all.filter((r) => r.mastery >= 0.85).length,
      weak: all.filter((r) => r.mastery < 0.6).length,
      total: grammar.size,
    },
    weakRules: all.filter((r) => r.mastery < 0.6).sort((a, b) => a.mastery - b.mastery).slice(0, 5),
    interferenceRules: all.filter((r) => r.interferenceRu >= 4)
      .sort((a, b) => a.mastery - b.mastery).slice(0, 5),
  }
}

/** Непрерывная серия дней с завершённым занятием. */
function computeStreak(dates: Date[]): number {
  if (!dates.length) return 0
  const DAY = 86_400_000
  const dayOf = (d: Date) => Math.floor(d.getTime() / DAY)
  const today = Math.floor(Date.now() / DAY)
  const unique = [...new Set(dates.map(dayOf))].sort((a, b) => b - a)
  if (unique[0]! < today - 1) return 0   // серия прервана
  let streak = 1
  for (let i = 1; i < unique.length; i++) {
    if (unique[i - 1]! - unique[i]! === 1) streak++
    else break
  }
  return streak
}
