/**
 * Формы строк, как они приходят из API.
 *
 * Даты по сети — всегда ISO-строки: JSON дат не знает. Разбор в Date
 * делается один раз в сторе (`lib/data/store.ts`), дальше по приложению
 * ходят уже настоящие Date — чтобы не ловить «строка минус дата» в
 * расчётах расписания.
 */

export type StudyItemKind = 'lexeme-recognition' | 'lexeme-production' | 'rule-card'
export type ModuleId = 'listening' | 'reading' | 'grammar' | 'writing' | 'speaking'
export type EntryTrack = 'a0' | 'a2' | 'b1-minus'

/** Карточка FSRS. Имена полей — camelCase, как колонки в Postgres. */
export interface StudyItemRow {
  id: string
  kind: StudyItemKind
  refId: string
  due: Date
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: number
  lastReview: Date | null
}

export interface RuleMasteryRow {
  grammarRuleId: string
  mastery: number
  attempts: number
  correct: number
  recentWindow: { correct: boolean; weight: number; at: number }[]
  lastPracticedAt: Date | null
  introducedOnDay: number | null
}

export interface ModuleReadinessRow {
  courseId: string
  moduleId: ModuleId
  estimatedPercent: number
  confidence: number
  lastMockScore: number | null
  lastMockAt: Date | null
}

export interface LessonSessionRow {
  id: string
  dayNumber: number
  startedAt: Date
  completedAt: Date | null
  plannedBudgetMs: number
  actualMs: number | null
  itemsReviewed: number
  itemsCorrect: number
}

export interface PersonalWordRow {
  id: string
  lemma: string
  translation: string
  sourceUrl: string | null
  context: string | null
  linkedLexemeId: string | null
  createdAt: Date
}

export interface UserCourseRow {
  courseId: string
  startedAt: Date
  targetExamDate: Date | null
  entryTrack: EntryTrack
  dailyBudgetMinutes: number
}

export interface SessionUser {
  id: string
  signedIn: boolean
  name: string | null
  email: string | null
  picture: string | null
}

export interface Settings {
  uiLanguage: string      // язык интерфейса
  sourceLanguage: string  // язык переводов слов — может отличаться от UI
  theme: 'light' | 'dark' | 'system'
  dailyBudgetMinutes: number
  ttsVoiceURI: string | null
  ttsRate: number
}

export const DEFAULT_SETTINGS: Settings = {
  uiLanguage: 'ru',
  sourceLanguage: 'ru',
  theme: 'system',
  dailyBudgetMinutes: 15,
  ttsVoiceURI: null,
  ttsRate: 0.95,
}

/** Всё состояние пользователя — ответ GET /api/state. */
export interface AppState {
  user: SessionUser
  settings: Settings
  course: UserCourseRow | null
  studyItems: StudyItemRow[]
  mastery: RuleMasteryRow[]
  readiness: ModuleReadinessRow[]
  sessions: LessonSessionRow[]
  personalDict: PersonalWordRow[]
}
