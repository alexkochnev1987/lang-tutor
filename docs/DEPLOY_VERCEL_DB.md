# DEPLOY_VERCEL_DB.md — деплой на Vercel + база

> ## ✅ Выполнено 2026-10-25 — и не так, как здесь написано
>
> Задание выполнено, но по дороге заказчик изменил главное требование:
> **никакого local-first.** Данные пользователя теперь только в Postgres,
> IndexedDB и Dexie удалены. Поэтому расходится следующее:
>
> | В документе | Как сделано |
> |---|---|
> | R1: local-first сохраняется, IndexedDB — источник истины | **Отменено.** Источник истины — Postgres. Dexie удалён из зависимостей (`PLAN.md` D23) |
> | §5bis: миграция Dexie `version(2)` | Не понадобилась — Dexie больше нет |
> | §7: синхронизация `POST /api/sync`, LWW по `updatedAt`, tombstones | Не понадобилась. Вместо обмена — обычные роуты данных: `/api/state`, `/api/answer`, `/api/lesson`, `/api/course`, `/api/settings` |
> | §6: вход обязателен | Сессия выдаётся гостю сразу, вход через Google привязывает `google_sub` к той же строке (`PLAN.md` D24) |
> | §8: Root Directory | `apps/web` + Build Command `cd ../.. && pnpm build`, а не корень репозитория. Детали — `GETTING_STARTED.md` §6 |
>
> Актуальная инструкция по деплою — **`GETTING_STARTED.md` §6**. Этот файл
> оставлен как история решения: что проверялось, почему выбран Neon, а не
> `@vercel/postgres`, и какие грабли были найдены в сборке.

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
| База | **нет**: в `apps/web/package.json` нет ни `drizzle-orm`, ни `@neondatabase/serverless`, ни `jose`; каталога `app/api/` тоже нет |
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

### 3.1bis. Service worker: штамповку придётся чинить

Сам worker написан руками (`apps/web/public/sw.js`) и от бандлера
действительно не зависит. Ломается не он, а простановка версии.

`scripts/stamp-sw.mjs` подставляет `__BUILD_ID__` и `__COURSE_ID__` и
пишет результат **только в `apps/web/out/sw.js`** — см. последние строки
скрипта. Без `output: 'export'` папки `out/` не существует: скрипт
напечатает «out/ не найден — пропускаю», завершится с кодом 0, и на прод
уедет `public/sw.js` с плейсхолдерами.

Что при этом сломается:

- прекэш пойдёт по `/content/__COURSE_ID__/curriculum.json` — такого URL
  нет, и офлайн останется без контента;
- `VERSION` перестанет меняться между деплоями → браузер не переустановит
  worker, и пользователь будет сидеть на старом кэше сколь угодно долго.

Как чинить. Штамповать **до** `next build`, в файл, который попадёт в
сборку. Чище всего переименовать исходник в `public/sw.template.js`,
добавить `public/sw.js` в `.gitignore` и генерировать его скриптом перед
сборкой: тогда файла с подставленным build id в репозитории не бывает в
принципе. Вариант «штампуем `public/sw.js` на месте и возвращаем
плейсхолдеры после сборки» тоже работает, но оставляет грязную рабочую
копию при упавшей сборке.

⚠️ Проверка на проде: открыть `https://<домен>/sw.js` и убедиться, что в
первых строках стоит хеш коммита, а не `__BUILD_ID__`.

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

## 5bis. Dexie: перед синхронизацией нужна `version(2)`

Имена таблиц в Dexie и в схеме выше совпадают — это правда. Поля
совпадают не полностью. Сверено с `apps/web/lib/db/dexie.ts` 2026-10-25;
каждое расхождение ломает обмен, а не просто неудобно:

| Что | Сейчас в Dexie | Что нужно |
|---|---|---|
| `updatedAt` | есть **только** у `moduleReadiness` | нужен у `studyItems`, `ruleMastery`, `personalDict`, `lessonSessions`, `userCourses`: по нему разрешается конфликт (§7). Без поля разрешать нечем |
| `userId` | **нет нигде**, ни в одном интерфейсе | проставляется после входа; до входа строки живут без него |
| `reviewLogs.id` | `++id` — автоинкремент, число | `text` с клиентским uuid. Автоинкремент уникален только внутри одного устройства, и `ON CONFLICT DO NOTHING` на нём не даёт идемпотентности: при повторной отправке пачки логи задвоятся |
| `lessonSessions.id` | `++id` — автоинкремент, число | то же самое |

Отсюда — `this.version(2).stores({…}).upgrade(…)` в `dexie.ts`:
проставить `updatedAt` существующим строкам, перевести два автоинкремента
на `crypto.randomUUID()`.

⚠️ Миграция выполняется у людей, которые уже занимались офлайн. Их
прогресс терять нельзя: `upgrade()` обязан быть идемпотентным и переживать
прерывание на середине. Это первое, что надо протестировать на базе,
заполненной **до** миграции, а не на пустой.

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
ID-токен не хранить.

⚠️ Сейчас профиль вместе с `idToken` кладётся в Dexie — ключ
`googleProfile` в таблице `settings` (`app/_components/SignInButton.tsx`).
IndexedDB в этом смысле не безопаснее localStorage: её читает любой скрипт
на странице. При переходе на серверную сессию токен в хранилище не
сохранять — он нужен ровно один раз, чтобы обменять его на cookie.

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
5. **Удаления LWW не переносит — нужно мягкое удаление.** У удалённой
   строки нет `updatedAt`, и сервер не отличит её от «ещё не созданной»:
   слово, удалённое из личного словаря на телефоне, вернётся с ноутбука
   при следующем обмене. Решение — колонка `deletedAt`: строка остаётся и
   участвует в обмене как обычная, из интерфейса скрывается. Вводить
   вместе с `version(2)` (§5bis), а не потом: добавлять поле в работающую
   схему дороже. Пока это касается только `personalDict` — единственного,
   что пользователь удаляет руками
6. **Первый вход — слияние, а не замена.** До входа строки живут без
   `userId`, и на сервере к этому моменту уже может лежать прогресс с
   другого устройства. Ни одну из сторон не затирать: обычный LWW-мерж по
   `updatedAt`. Привязка локальных строк к аккаунту делается один раз и с
   явного подтверждения — иначе вход на общем компьютере утащит чужой
   прогресс в свой аккаунт

Где вызывать: после завершения занятия и при возврате вкладки в фокус.

---

## 8. Деплой на Vercel

| Поле | Значение |
|---|---|
| Framework Preset | Next.js |
| Root Directory | **`./`** — корень репозитория |
| Build Command | `pnpm build` |
| Output Directory | **оставить пустым** (не `apps/web/out` — статики больше нет) |
| Install Command | `pnpm install` |
| Node.js Version | 20.x или выше |

⚠️ Root Directory — именно корень, не `polski-b1`. Репозиторий
(`alexkochnev1987/lang-tutor`, ветка `main`) имеет корнем саму папку
`polski-b1`; подкаталога с таким именем внутри него нет, и Vercel на нём
упадёт с «root directory does not exist».

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
☐ /sw.js на проде содержит хеш коммита, а не __BUILD_ID__/__COURSE_ID__
☐ /progress/ открывается офлайн с контентом, а не с ошибкой
☐ Вход через Google работает, токен проверяется НА СЕРВЕРЕ
☐ Прогресс, сделанный офлайн, уезжает на сервер после появления сети
☐ Вход с другого устройства тем же аккаунтом подтягивает прогресс
☐ Чужой userId недоступен: запрос с подменённым sub отклоняется
☐ Миграция Dexie version(2) прошла на базе, заполненной ДО неё, прогресс цел
☐ Повторная отправка той же пачки reviewLogs не создаёт дублей
☐ Слово, удалённое на одном устройстве, не возвращается со второго

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
| `docs/ARCHITECTURE.md` §2, §4, §6 | слои, модель данных, почему Next без бэкенда |
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
