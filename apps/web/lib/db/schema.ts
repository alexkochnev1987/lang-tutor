/**
 * Схема Postgres. Источник истины по пользовательским данным.
 *
 * Что сюда НЕ попадает (ARCHITECTURE.md §4.3, R2/R3):
 *   — учебный контент: лексика, грамматика, программа. Это статические
 *     JSON в public/content/<courseId>/, они версионируются вместе с кодом;
 *   — колонки с языком в имени (`translation_ru` и подобные). Язык —
 *     всегда значение поля, иначе второй языковой пакет потребует миграции.
 */
import {
  index, integer, jsonb, pgTable, primaryKey,
  real, text, timestamp,
} from 'drizzle-orm/pg-core'

/**
 * Пользователь.
 *
 * Сессия выдаётся сразу, ещё до входа через Google: без неё прогресс
 * некуда писать. Поэтому `googleSub` может быть пустым — это гость.
 * Вход через Google не создаёт нового пользователя, а проставляет
 * `googleSub` существующему: занятия, пройденные до входа, остаются.
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(),                       // uuid, выдаёт сервер
  googleSub: text('google_sub').unique(),            // sub из проверенного ID-токена
  email: text('email'),
  name: text('name'),
  picture: text('picture'),
  settings: jsonb('settings').notNull().default({}), // язык UI, тема, голос TTS
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userCourses = pgTable('user_courses', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  targetExamDate: timestamp('target_exam_date', { withTimezone: true }),
  entryTrack: text('entry_track').notNull(),         // a0 | a2 | b1-minus
  dailyBudgetMinutes: integer('daily_budget_minutes').notNull().default(15),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.courseId] })])

/**
 * Карточка FSRS. Поля — один в один с ts-fsrs@5.4.2 Card, развёрнуты
 * плоско: по ним строится выборка «что сегодня», и это должен делать
 * индекс, а не фильтр в памяти.
 */
export const studyItems = pgTable('study_items', {
  id: text('id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull(),
  kind: text('kind').notNull(),                      // lexeme-recognition | lexeme-production | rule-card
  refId: text('ref_id').notNull(),
  due: timestamp('due', { withTimezone: true }).notNull(),
  stability: real('stability').notNull(),
  difficulty: real('difficulty').notNull(),
  elapsedDays: integer('elapsed_days').notNull(),
  scheduledDays: integer('scheduled_days').notNull(),
  learningSteps: integer('learning_steps').notNull(),
  reps: integer('reps').notNull(),
  lapses: integer('lapses').notNull(),
  state: integer('state').notNull(),
  lastReview: timestamp('last_review', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.id] }),
  // главный индекс: по нему строится очередь повторений на сегодня
  index('study_items_due_idx').on(t.userId, t.courseId, t.due),
])

/**
 * Полный лог повторений. Не перезаписывается никогда: это история, на
 * которой потом обучается оптимизатор параметров FSRS.
 *
 * `id` генерирует клиент (uuid) — чтобы повторная отправка того же
 * ответа при обрыве сети не создавала дубль: ON CONFLICT DO NOTHING.
 */
export const reviewLogs = pgTable('review_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  studyItemId: text('study_item_id').notNull(),
  rating: integer('rating').notNull(),               // Rating из ts-fsrs: 1..4
  state: integer('state').notNull(),
  stability: real('stability').notNull(),
  difficulty: real('difficulty').notNull(),
  elapsedDays: integer('elapsed_days').notNull(),
  scheduledDays: integer('scheduled_days').notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull(),
  exerciseId: text('exercise_id'),
  responseMs: integer('response_ms'),
}, (t) => [index('review_logs_user_time_idx').on(t.userId, t.reviewedAt)])

/** Грамматика моделируется НЕ через FSRS — RESEARCH.md §7.3 */
export const ruleMastery = pgTable('rule_mastery', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  grammarRuleId: text('grammar_rule_id').notNull(),
  mastery: real('mastery').notNull(),
  attempts: integer('attempts').notNull(),
  correct: integer('correct').notNull(),
  recentWindow: jsonb('recent_window').notNull().default([]),
  lastPracticedAt: timestamp('last_practiced_at', { withTimezone: true }),
  introducedOnDay: integer('introduced_on_day'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.grammarRuleId] })])

/** Готовность по модулям экзамена: порог 50% считается по каждому отдельно */
export const moduleReadiness = pgTable('module_readiness', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull(),
  moduleId: text('module_id').notNull(),
  estimatedPercent: real('estimated_percent').notNull(),
  confidence: real('confidence').notNull(),
  lastMockScore: real('last_mock_score'),
  lastMockAt: timestamp('last_mock_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.courseId, t.moduleId] })])

/**
 * Личный словарь. Единственное, что пользователь удаляет руками, —
 * поэтому удаление мягкое: строка остаётся, из выдачи уходит.
 */
export const personalDict = pgTable('personal_dict', {
  id: text('id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull(),
  lemma: text('lemma').notNull(),
  translation: text('translation').notNull(),
  sourceUrl: text('source_url'),
  context: text('context'),
  linkedLexemeId: text('linked_lexeme_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.userId, t.id] })])

/** Пройденные занятия. По ним считается номер учебного дня. */
export const lessonSessions = pgTable('lesson_sessions', {
  id: text('id').notNull(),                          // uuid, генерирует клиент
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull(),
  dayNumber: integer('day_number').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  plannedBudgetMs: integer('planned_budget_ms').notNull(),
  actualMs: integer('actual_ms'),
  itemsReviewed: integer('items_reviewed').notNull(),
  itemsCorrect: integer('items_correct').notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.id] }),
  index('lesson_sessions_day_idx').on(t.userId, t.courseId, t.dayNumber),
])
