# DEPLOY_VERCEL_DB.md — передача задачи: деплой на Vercel + база

**Это задание для другого агента.** Документ самодостаточен: в нём
текущее состояние, что именно поменять, пошаговые команды и критерии
приёмки.

Проверено по npm и документации **2026-10-25**.

---

## 0. TL;DR для исполнителя

```
Задача:  выложить приложение на Vercel и подключить Postgres,
         чтобы прогресс синхронизировался между устройствами.

Главное: сейчас проект собирается как СТАТИКА (output: 'export').
         С базой так нельзя. Первое изменение — убрать эту строку.

База:    Neon через Vercel Marketplace. НЕ @vercel/postgres —
         он deprecated с 2024 года.

Правило: local-first сохраняется. IndexedDB остаётся источником
         истины на устройстве, Postgres — это синхронизация,
         а не замена. Приложение обязано работать офлайн.
```

---

## 1. Что есть сейчас

| | |
|---|---|
| Репозиторий | `polski-b1/`, pnpm workspace |
| Фронтенд | Next **16.4.3**, App Router, React **19.3.1** |
| Сборка | **`output: 'export'`** → статика в `apps/web/out/` |
| Данные | **IndexedDB через Dexie 4.4.7**, бэкенда нет |
| Вход | Google Identity Services, **клиентский поток**, токен не проверяется |
| Движок | `packages/engine`, 47 тестов, языконезависим |
| Контент | `content/pl-b1-ru/*.json`, 704 КБ, копируется в `public/` при сборке |

Схема Dexie — `apps/web/lib/db/dexie.ts`. **Имена таблиц уже совпадают с
будущей схемой Postgres** — это было заложено специально
(`ARCHITECTURE.md` §4).

---

## 2. Четыре решения, которые нельзя переигрывать

Они приняты осознанно, с обоснованием в документах. Если исполнитель
считает иначе — сначала обсудить, а не менять молча.

| # | Решение | Где обосновано |
|---|---|---|
| **R1** | **Local-first сохраняется.** IndexedDB — источник истины на устройстве. Postgres только синхронизирует. Приложение работает офлайн полностью | `PLAN.md` D17 |
| **R2** | **Многоязычность.** В схеме не должно появиться колонок `translation_ru` и подобных. Язык — всегда значение поля | `ARCHITECTURE.md` §1, `DEV_RULES.md` R9 |
| **R3** | **Контент не кладётся в базу.** Языковые пакеты остаются статическими JSON. В Postgres только пользовательские данные | `ARCHITECTURE.md` §2 |
| **R4** | **Движок не трогаем.** `packages/engine` не должен узнать, что появился сервер | `DEV_RULES.md` R8, R11 |

---

## 3. Что поменять в коде

### 3.1. Убрать статический экспорт

```ts
// apps/web/next.config.ts
const config: NextConfig = {
  // output: 'export',        ← УДАЛИТЬ: с ним нет route handlers
  // images: { unoptimized: true },  ← можно вернуть оптимизацию
  trailingSlash: true,
  transpilePackages: ['@polski/ui', '@polski/engine'],
}
```

⚠️ После этого `pnpm start` (сейчас `npx serve out`) надо заменить на
`next start`, а в Vercel убрать Output Directory — он определит сам.

### 3.1bis. Service worker трогать не надо

Он написан руками (`apps/web/public/sw.js`), от бандлера не зависит и
при снятии `output: 'export'` продолжит работать как есть. Единственное:
проверить, что `node scripts/stamp-sw.mjs` остался последним шагом
`pnpm build`.

### 3.2. Стек базы

```bash
pnpm --filter @polski/web add drizzle-orm @neondatabase/serverless jose
pnpm --filter @polski/web add -D drizzle-kit
```

| Пакет | Версия | Зачем |
|---|---|---|
| `drizzle-orm` | **0.45.4** | ORM, выбран в `ARCHITECTURE.md` |
| `drizzle-kit` | **0.31.11** | миграции |
| `@neondatabase/serverless` | **1.2.0** | драйвер Neon поверх HTTP/WebSocket |
| `jose` | **6.2.13** | проверка Google ID-токена на сервере |

❌ **Не ставить `@vercel/postgres`.** Он **deprecated** (последняя
публикация 2024-09-06), был обёрткой над `@neondatabase/serverless`,
исходники заархивированы. Vercel Postgres переехал в Neon в декабре 2024.

---

## 4. База: Neon через Vercel Marketplace

1. Vercel → проект → **Storage** → **Create Database** → **Neon**
2. Подключить к проекту — Vercel сам добавит переменные:
   `DATABASE_URL`, `DATABASE_URL_UNPOOLED` и прочие
3. Локально: `vercel env pull apps/web/.env.local`

Для serverless-функций использовать **pooled** `DATABASE_URL`; для
миграций — `DATABASE_URL_UNPOOLED`.

```ts
// apps/web/lib/db/pg.ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

export const sql = neon(process.env.DATABASE_URL!)
export const pg = drizzle(sql, { schema })
```

---

## 5. Схема Postgres

Переносится один в один из `apps/web/lib/db/dexie.ts`. Имена совпадают
намеренно.

```ts
// apps/web/lib/db/schema.ts
import {
  doublePrecision, index, integer, jsonb, pgTable, primaryKey,
  real, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),             // sub из Google ID-токена
  email: text('email'),
  name: text('name'),
  uiLanguageId: text('ui_language_id').notNull().default('ru'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const userCourses = pgTable('user_courses', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull(),
  startedAt: timestamp('started_at').notNull(),
  targetExamDate: timestamp('target_exam_date'),
  entryTrack: text('entry_track').notNull(),
  dailyBudgetMinutes: integer('daily_budget_minutes').notNull().default(15),
}, (t) => [primaryKey({ columns: [t.userId, t.courseId] })])

/** Карточка FSRS. Поля — один в один с ts-fsrs@5.4.2 Card. */
export const studyItems = pgTable('study_items', {
  id: text('id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull(),
  kind: text('kind').notNull(),            // lexeme-recognition | lexeme-production | rule-card
  refId: text('ref_id').notNull(),
  due: timestamp('due').notNull(),
  stability: real('stability').notNull(),
  difficulty: real('difficulty').notNull(),
  elapsedDays: integer('elapsed_days').notNull(),
  scheduledDays: integer('scheduled_days').notNull(),
  learningSteps: integer('learning_steps').notNull(),
  reps: integer('reps').notNull(),
  lapses: integer('lapses').notNull(),
  state: integer('state').notNull(),
  lastReview: timestamp('last_review'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.id] }),
  // главный индекс: по нему строится очередь «на сегодня»
  index('study_items_due_idx').on(t.userId, t.courseId, t.due),
])

export const reviewLogs = pgTable('review_logs', {
  id: text('id').primaryKey(),             // uuid, генерирует клиент — нужен для идемпотентности
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  studyItemId: text('study_item_id').notNull(),
  rating: integer('rating').notNull(),
  state: integer('state').notNull(),
  stability: real('stability').notNull(),
  difficulty: real('difficulty').notNull(),
  elapsedDays: integer('elapsed_days').notNull(),
  scheduledDays: integer('scheduled_days').notNull(),
  reviewedAt: timestamp('reviewed_at').notNull(),
  responseMs: integer('response_ms'),
}, (t) => [index('review_logs_user_time_idx').on(t.userId, t.reviewedAt)])

export const ruleMastery = pgTable('rule_mastery', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  grammarRuleId: text('grammar_rule_id').notNull(),
  mastery: real('mastery').notNull(),
  attempts: integer('attempts').notNull(),
  correct: integer('correct').notNull(),
  recentWindow: jsonb('recent_window').notNull().default([]),
  lastPracticedAt: timestamp('last_practiced_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.grammarRuleId] })])

export const moduleReadiness = pgTable('module_readiness', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull(),
  moduleId: text('module_id').notNull(),
  estimatedPercent: real('estimated_percent').notNull(),
  confidence: real('confidence').notNull(),
  lastMockScore: real('last_mock_score'),
  lastMockAt: timestamp('last_mock_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.courseId, t.moduleId] })])

export const personalDict = pgTable('personal_dict', {
  id: text('id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull(),
  lemma: text('lemma').notNull(),
  translation: text('translation').notNull(),
  sourceUrl: text('source_url'),
  context: text('context'),
  linkedLexemeId: text('linked_lexeme_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.id] })])

export const lessonSessions = pgTable('lesson_sessions', {
  id: text('id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  dayNumber: integer('day_number').notNull(),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  plannedBudgetMs: integer('planned_budget_ms').notNull(),
  actualMs: integer('actual_ms'),
  itemsReviewed: integer('items_reviewed').notNull(),
  itemsCorrect: integer('items_correct').notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.id] })])
```

⚠️ Чего в схеме быть **не должно**: таблиц с контентом (лексика,
грамматика, программа) — это статические JSON (R3); колонок с языком в
имени (R2).

```bash
pnpm --filter @polski/web exec drizzle-kit generate
pnpm --filter @polski/web exec drizzle-kit migrate
```

---

## 6. Аутентификация: доделать до настоящей

Сейчас `apps/web/lib/auth/google.ts` получает Google ID-токен и
**читает payload без проверки подписи** — там об этом написано прямо.
Для клиентского приложения без данных на сервере этого хватало. С базой
— нет: иначе любой подставит чужой `sub` и прочитает чужой прогресс.

```ts
// apps/web/app/api/auth/google/route.ts
import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export async function POST(req: Request) {
  const { idToken } = await req.json()
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
  })
  // payload.sub — доверенный идентификатор пользователя
  // далее: upsert в users, выдать свою сессию (httpOnly cookie)
}
```

⚠️ **Проверять `aud` обязательно.** Без этого примут токен, выданный для
другого приложения.

Сессию держать в **httpOnly, Secure, SameSite=Lax** cookie. Google
ID-токен в localStorage не хранить.

---

## 7. Синхронизация: last-write-wins по updatedAt

Приложение остаётся local-first (R1). Сервер — не источник истины, а
точка обмена.

```
POST /api/sync
  body: { since: ISO-дата, changes: { studyItems[], ruleMastery[], … } }
  resp: { serverTime, changes: { … } }   ← всё, что изменилось после since
```

Правила:

1. **Разрешение конфликтов — по `updatedAt`, побеждает позднейший.**
   Для учебного прогресса этого достаточно: одновременная правка одной
   карточки с двух устройств практически невозможна
2. **`reviewLogs` не мержатся, а дописываются.** У них клиентский uuid →
   `ON CONFLICT DO NOTHING`. Лог повторений — это история, её нельзя
   перезаписывать: на ней потом обучается оптимизатор FSRS
3. **Синхронизация асинхронна и необязательна.** Нет сети — приложение
   работает. Ошибка синхронизации не должна ломать занятие
4. **Клиент не ждёт ответа, чтобы показать результат.** Сначала пишем в
   IndexedDB, потом отправляем

Где вызывать: после завершения занятия и при возврате вкладки в фокус.

---

## 8. Деплой на Vercel

| Поле | Значение |
|---|---|
| Framework Preset | Next.js |
| Root Directory | `polski-b1` |
| Build Command | `pnpm build` |
| Output Directory | **оставить пустым** (не `apps/web/out` — статики больше нет) |
| Install Command | `pnpm install` |
| Node.js Version | 20.x или выше |

Переменные окружения:

| Переменная | Где взять | Окружения |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Cloud Console | все |
| `DATABASE_URL` | добавит интеграция Neon | все |
| `DATABASE_URL_UNPOOLED` | добавит интеграция Neon | для миграций |
| `SESSION_SECRET` | `openssl rand -base64 32` | все |

⚠️ `NEXT_PUBLIC_*` вшиваются **при сборке**. Добавили — нужен редеплой.

⚠️ В Google Console добавить в **Authorized JavaScript origins** и
прод-домен, и превью-домены Vercel. Иначе на превью будет
`origin_mismatch`.

⚠️ `pnpm build` сейчас первым шагом гоняет `scripts/sync-content.mjs` —
он копирует контент в `public/`. На Vercel это отработает, но убедиться,
что `apps/web/public/content/` не в `.gitignore`-исключении, которое
сломает сборку. Сейчас папка в `.gitignore` и генерируется при сборке —
это правильно, менять не надо.

---

## 9. Критерии приёмки

```
☐ pnpm typecheck    — 0 ошибок
☐ pnpm --filter @polski/engine test — 47 тестов проходят
☐ pnpm validate     — граф и программа валидны
☐ pnpm build        — собирается без output: 'export'

☐ Приложение открывается на прод-домене по HTTPS
☐ Занятие проходится ПОЛНОСТЬЮ БЕЗ СЕТИ (отключить в DevTools)
☐ out/sw.js содержит реальную версию, а не __BUILD_ID__
☐ /progress/ открывается офлайн с контентом, а не с ошибкой
☐ Вход через Google работает, токен проверяется НА СЕРВЕРЕ
☐ Прогресс, сделанный офлайн, уезжает на сервер после появления сети
☐ Вход с другого устройства тем же аккаунтом подтягивает прогресс
☐ Чужой userId недоступен: запрос с подменённым sub отклоняется

☐ packages/engine не изменён
☐ В схеме нет таблиц с учебным контентом
☐ В схеме нет колонок с языком в имени
```

---

## 10. Чего НЕ делать

| | Почему |
|---|---|
| Не ставить `@vercel/postgres` | deprecated с 2024, исходники заархивированы |
| Не переносить контент в базу | языковые пакеты статичны и версионируются с кодом (R3) |
| Не делать Postgres источником истины | сломает офлайн, а это основной сценарий «15 минут в метро» (R1) |
| Не трогать `packages/engine` | он языконезависим и не должен знать о сервере (R4) |
| Не хранить Google ID-токен в localStorage | httpOnly cookie, иначе XSS = угон аккаунта |
| Не добавлять `translation_ru` и подобное | многоязычность заложена в схему (R2) |
| Не чинить «ошибку» нулевой готовности | до первого пробника это оценка, так и задумано (`SPACED_REPETITION.md` §6) |

---

## 11. Что читать перед началом

| Документ | Зачем |
|---|---|
| `docs/ARCHITECTURE.md` §2, §4, §7bis | слои, модель данных, путь миграции на бэкенд |
| `docs/DEV_RULES.md` R8–R11 | границы слоёв — их легко нарушить при добавлении API |
| `GETTING_STARTED.md` | запуск, переменные, текущая конфигурация деплоя |
| `apps/web/lib/db/dexie.ts` | схема, которую надо отразить в Postgres |
| `apps/web/lib/auth/google.ts` | комментарий в начале файла объясняет, что доделать |

---

## Источники

- [Postgres on Vercel](https://vercel.com/docs/postgres) — переезд в Neon
- [@vercel/postgres в npm](https://www.npmjs.com/package/@vercel/postgres) — отметка deprecated
- [@neondatabase/serverless](https://www.npmjs.com/package/@neondatabase/serverless) 1.2.0
- [drizzle-orm](https://www.npmjs.com/package/drizzle-orm) 0.45.4 · [drizzle-kit](https://www.npmjs.com/package/drizzle-kit) 0.31.11
- [jose](https://www.npmjs.com/package/jose) 6.2.13 — проверка JWT
