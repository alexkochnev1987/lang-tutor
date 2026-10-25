/**
 * Сводка прогресса для экрана «Прогресс».
 * Собирает данные из IndexedDB и прогоняет через движок.
 */
import { State } from 'ts-fsrs'
import { decayed, estimateModuleReadiness, evaluate, type ModuleScore } from '@polski/engine'
import { loadState } from '@/lib/data/store'
import { COURSE_ID, loadCurriculum, loadGrammarRules, loadVocabulary } from '@/lib/content/curriculum'
import { PASS_RULE } from './session'
import { loadLevels, timeToTarget, type TimeToTarget, type TrackId } from '@/lib/content/levels'

export const MODULES = ['listening', 'reading', 'grammar', 'writing', 'speaking'] as const

export interface RuleProgress {
  id: string
  titleRu: string
  category: string
  mastery: number
  attempts: number
  interferenceRu: number
}

/** Время по теме: сколько уже потрачено и сколько дней темы пройдено. */
export interface ThemeTime {
  themeId: string
  themeRu: string
  spentMs: number
  daysDone: number
  daysTotal: number
}

export interface Accuracy {
  reviewed: number
  correct: number
  percent: number
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
  /** Путь до уровня в часах — ответ на «сколько ещё осталось» */
  time: TimeToTarget
  themes: ThemeTime[]
  accuracy: Accuracy
}

export async function loadProgress(): Promise<Progress> {
  const now = Date.now()
  const [curriculum, vocab, grammar, levels] = await Promise.all([
    loadCurriculum(), loadVocabulary(), loadGrammarRules(), loadLevels(),
  ])
  const state = await loadState()
  const items = state.studyItems
  const masteryRows = state.mastery
  const sessions = state.sessions.filter((s) => s.completedAt)
  const mockRows = state.readiness

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

  // ── время ───────────────────────────────────────────────────────────
  const spentMs = sessions.reduce((sum, s) => sum + (s.actualMs ?? 0), 0)

  // Темп считается по КАЛЕНДАРНЫМ дням с начала курса, а не по дням
  // занятий: пропущенные дни — часть реального темпа, и прогноз, который
  // их игнорирует, обещает срок, до которого человек не дойдёт.
  // Начало отсчёта — самая ранняя из дат: когда заведён курс и когда было
  // первое занятие. Брать только дату курса нельзя: занятия могут быть
  // старше его записи (перенос прогресса, починка данных), и тогда весь
  // курс делится на один день, а темп выходит в тысячи минут в сутки.
  const firstSession = sessions.reduce<Date | null>(
    (min, s) => (!min || s.startedAt < min ? s.startedAt : min), null)
  const candidates = [state.course?.startedAt, firstSession].filter(Boolean) as Date[]
  const startedAt = candidates.length
    ? new Date(Math.min(...candidates.map((d) => +d)))
    : new Date(now)
  const calendarDays = Math.max(1, Math.round((now - +startedAt) / 86_400_000) + 1)
  const paceMinPerDay = spentMs / 60_000 / calendarDays

  const track = (state.course?.entryTrack ?? 'a2') as TrackId
  const time = timeToTarget(levels, track, spentMs, paceMinPerDay)

  // ── время по темам ──────────────────────────────────────────────────
  const dayByNumber = new Map(curriculum.days.map((d) => [d.day, d]))
  const themeAgg = new Map<string, ThemeTime>()
  for (const d of curriculum.days) {
    const t = themeAgg.get(d.themeId) ?? {
      themeId: d.themeId, themeRu: d.themeRu, spentMs: 0, daysDone: 0, daysTotal: 0,
    }
    t.daysTotal++
    themeAgg.set(d.themeId, t)
  }
  for (const s of sessions) {
    const d = dayByNumber.get(s.dayNumber)
    if (!d) continue
    const t = themeAgg.get(d.themeId)
    if (!t) continue
    t.spentMs += s.actualMs ?? 0
    t.daysDone++
  }

  // ── точность ────────────────────────────────────────────────────────
  const reviewed = sessions.reduce((sum, s) => sum + s.itemsReviewed, 0)
  const correct = sessions.reduce((sum, s) => sum + s.itemsCorrect, 0)

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
    time,
    // темы без единой минуты внизу: сначала то, чем человек занимался
    themes: [...themeAgg.values()].sort((a, b) => b.spentMs - a.spentMs),
    accuracy: { reviewed, correct, percent: reviewed ? correct / reviewed : 0 },
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
