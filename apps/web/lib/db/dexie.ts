/**
 * Локальное хранилище. Бэкенда нет — всё живёт в IndexedDB.
 *
 * Имена таблиц совпадают с будущей схемой Postgres (ARCHITECTURE.md §4),
 * поэтому появление синхронизации — замена слоя доступа, а не модели.
 */
import Dexie, { type Table } from 'dexie'
import type { Card } from 'ts-fsrs'

export type StudyItemKind = 'lexeme-recognition' | 'lexeme-production' | 'rule-card'
export type ModuleId = 'listening' | 'reading' | 'grammar' | 'writing' | 'speaking'

/** FSRS-карточка плюс наши поля. Card разворачивается плоско ради индексов. */
export interface StudyItem extends Card {
  id: string
  courseId: string
  kind: StudyItemKind
  refId: string
}

export interface ReviewLogRow {
  id?: number
  studyItemId: string
  rating: number
  state: number
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reviewedAt: Date
  exerciseId?: string
  responseMs?: number
}

/** Грамматика НЕ моделируется через FSRS — см. RESEARCH.md §7.3 */
export interface RuleMastery {
  grammarRuleId: string
  mastery: number
  attempts: number
  correct: number
  recentWindow: { correct: boolean; weight: number; at: number }[]
  lastPracticedAt?: Date
  introducedOnDay?: number
}

/** Ключевая сущность для экзамена: порог 50% считается по каждому модулю */
export interface ModuleReadiness {
  courseId: string
  moduleId: ModuleId
  estimatedPercent: number
  confidence: number
  lastMockScore?: number
  lastMockAt?: Date
  updatedAt: Date
}

export interface PersonalWord {
  id: string
  courseId: string
  lemma: string
  translation: string
  sourceUrl?: string
  context?: string
  linkedLexemeId?: string
  createdAt: Date
}

export interface UserCourse {
  courseId: string
  startedAt: Date
  targetExamDate?: Date
  entryTrack: 'a0' | 'a2' | 'b1-minus'
  dailyBudgetMinutes: number
}

export interface LessonSession {
  id?: number
  dayNumber: number
  startedAt: Date
  completedAt?: Date
  plannedBudgetMs: number
  actualMs?: number
  itemsReviewed: number
  itemsCorrect: number
}

export interface SettingRow { key: string; value: unknown }
export interface ContentCacheRow { key: string; version: string; payload: unknown }

class PolskiDB extends Dexie {
  studyItems!: Table<StudyItem, string>
  reviewLogs!: Table<ReviewLogRow, number>
  ruleMastery!: Table<RuleMastery, string>
  moduleReadiness!: Table<ModuleReadiness, [string, string]>
  personalDict!: Table<PersonalWord, string>
  userCourses!: Table<UserCourse, string>
  lessonSessions!: Table<LessonSession, number>
  settings!: Table<SettingRow, string>
  contentCache!: Table<ContentCacheRow, string>

  constructor() {
    super('polski-b1')
    this.version(1).stores({
      // [courseId+due] — главный индекс: по нему строится очередь «на сегодня».
      // Без него выборка сканирует всю таблицу.
      studyItems:      'id, [courseId+due], [kind+refId], due, state',
      reviewLogs:      '++id, studyItemId, reviewedAt',
      ruleMastery:     'grammarRuleId, mastery, lastPracticedAt',
      moduleReadiness: '[courseId+moduleId], courseId',
      personalDict:    'id, courseId, lemma, createdAt',
      userCourses:     'courseId',
      lessonSessions:  '++id, dayNumber, startedAt',
      settings:        'key',
      contentCache:    'key',
    })
  }
}

export const db = new PolskiDB()
