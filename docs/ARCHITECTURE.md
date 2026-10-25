# ARCHITECTURE.md — техническая архитектура

Проектируется **многоязычной с первого дня**. Польский B1 — первый языковой
пакет, а не частный случай, зашитый в код.

Статус: ядро модели данных и границы модулей. Детализация API и экранов —
по мере готовности `CURRICULUM.md` и `EXERCISE_ENGINE.md`.

---

## 1. Главный принцип: что именно обобщается

Соблазн при обобщении — сделать всё конфигурируемым. Это убивает проект.
Обобщать нужно ровно по трём осям, которые реально меняются:

| Ось | Что меняется | Примеры |
|---|---|---|
| **targetLanguage** | что изучаем | `pl`, `de`, `en`, `cs` |
| **sourceLanguage** | язык пользователя: интерфейс и переводы | `ru`, `uk`, `en`, `be` |
| **goal** | к чему готовимся | `pl-state-b1`, `goethe-b2`, `ielts`, `no-exam-b1` |

Эти оси **независимы**. «Польский B1 для русскоязычных» и «польский B1 для
украиноязычных» — разные продукты, отличающиеся только слоем переводов и
набором интерференционных ошибок. «Немецкий B2 Goethe для русскоязычных» —
другой целевой язык и другая структура экзамена, но **тот же движок**.

### Антипаттерн, которого избегаем

```ts
// ❌ Так делать нельзя — ru зашит в схему
interface Word {
  polish: string
  russian: string
  audioUrl: string
}
```

```ts
// ✅ Так
interface Lexeme {
  id: LexemeId            // 'pl.mieszkanie' — язык в префиксе
  languageId: LanguageId  // 'pl'
  lemma: string
  pos: PartOfSpeech
}

interface LexemeTranslation {
  lexemeId: LexemeId
  sourceLanguageId: LanguageId  // 'ru' | 'uk' | 'en'
  translation: string
  gloss?: string
}
```

Добавление украинской локали = вставка строк в `lexeme_translations`.
Ни одной миграции, ни одной правки в коде.

---

## 2. Три слоя, которые нельзя смешивать

```
┌──────────────────────────────────────────────────────────────┐
│  CONTENT LAYER — языковые пакеты                             │
│  Неизменяемый, версионируемый, поставляется как данные       │
│                                                              │
│  curriculum · vocabulary · grammar rules · exercise           │
│  templates · competencies · exam spec · audio manifest        │
│                                                              │
│  Ключ: (targetLanguage, goal) + переводы по sourceLanguage   │
│  Пишется редакторами и скриптами. НЕ зависит от движка       │
└───────────────────────────┬──────────────────────────────────┘
                            │ только чтение, по стабильным ID
┌───────────────────────────▼──────────────────────────────────┐
│  ENGINE LAYER — бизнес-логика                                │
│  Полностью языконезависим. Не содержит ни одного польского   │
│  слова и ни одной грамматической эвристики                   │
│                                                              │
│  FSRS Scheduler · Mastery Model · Daily Lesson Generator      │
│  Exercise Runner · Progress Tracker · Readiness Estimator     │
└───────────────────────────┬──────────────────────────────────┘
                            │ читает/пишет
┌───────────────────────────▼──────────────────────────────────┐
│  USER DATA LAYER                                             │
│  Изменяемый, персональный, ссылается на контент по ID        │
│                                                              │
│  study items (FSRS-карточки) · review logs · rule mastery     │
│  personal dictionary · settings · lesson history              │
└──────────────────────────────────────────────────────────────┘
                            ▲
┌───────────────────────────┴──────────────────────────────────┐
│  LANGUAGE PLUGIN — то, что обобщить честно не получается     │
│  Один модуль на целевой язык. Реализует узкий интерфейс      │
│                                                              │
│  морфология · орфографические правила · фонетика и голоса     │
│  интерференция (source × target) · генераторы упражнений,     │
│  зависящие от морфологии                                      │
└──────────────────────────────────────────────────────────────┘
```

**Правило, по которому проверяется чистота слоёв:** если удалить все языковые
пакеты и все плагины, движок должен компилироваться и проходить юнит-тесты на
синтетических данных. Если не проходит — значит в движок протекла предметная
специфика.

---

## 3. Language Plugin — граница языковой специфики

Не всё обобщается данными. Склонение польского существительного — это не
таблица в JSON, это обращение к Morfeusz. Для немецкого будет другой
инструмент. Поэтому — узкий интерфейс с реализацией на язык.

```ts
interface LanguagePlugin {
  readonly languageId: LanguageId

  /** Морфология: формы слова по грамматическим признакам */
  morphology: MorphologyProvider

  /** Орфография: правила, на которых учащиеся ошибаются */
  orthography: OrthographyRules

  /** Звук: как озвучивать */
  audio: AudioConfig

  /** Генераторы упражнений, которым нужна морфология */
  exerciseGenerators: ExerciseGenerator[]

  /** Интерференция: зависит от ПАРЫ языков */
  interference(sourceLanguageId: LanguageId): InterferenceSet
}
```

### 3.1. MorphologyProvider

```ts
interface MorphologyProvider {
  /** Все формы леммы. Для pl — обёртка над Morfeusz 2 (BSD) */
  inflect(lemma: string, pos: PartOfSpeech): InflectionTable

  /** Конкретная форма по признакам: ('ręka', {case:'loc', number:'sg'}) → 'ręce' */
  form(lemma: string, features: GrammaticalFeatures): string | null

  /** Разбор словоформы → возможные леммы с разметкой */
  analyze(wordform: string): MorphAnalysis[]

  /** Какие грамматические категории вообще есть в языке.
   *  pl: case(7) number gender aspect — de: case(4) number gender — en: почти ничего */
  readonly categories: GrammaticalCategory[]
}
```

Реализации:

| Язык | Провайдер | Лицензия |
|---|---|---|
| `pl` | **Morfeusz 2 + SGJP** | 2-clause BSD ✅ |
| `de` | DEMorphy / Zmorge | проверять |
| `cs` | MorfFlex | проверять |
| `en` | заглушка: английскому почти не нужна | — |

Именно наличие такого провайдера решает, можно ли для языка **генерировать**
упражнения на формы, или их придётся писать руками. Для польского — можно,
и это главный технический рычаг проекта.

### 3.2. OrthographyRules

Ошибки правописания, которые нужно уметь отличать от смысловых. Для польского:
`ż/rz`, `u/ó`, `h/ch`, носовые `ą/ę`.

```ts
interface OrthographyRules {
  /** Нормализация для сравнения ответа: регистр, диакритика, пробелы */
  normalize(input: string): string

  /** Классификация ошибки — нужно для разбора и для статистики */
  classifyError(expected: string, actual: string): OrthographyErrorKind
  // 'diacritic-missing' | 'voicing-confusion' | 'nasal-dropped' | 'typo' | 'wrong-word'

  /** Считать ли ответ правильным при мелком отклонении.
   *  На экзамене в аудировании правописание оценивается — значит строго */
  isAcceptable(expected: string, actual: string, strictness: Strictness): boolean
}
```

### 3.3. AudioConfig

```ts
interface AudioConfig {
  bcp47: string                        // 'pl-PL'
  commonsCategory?: string             // 'Lingua Libre pronunciation-pol'
  ttsVoices: {
    primary: TtsVoiceRef               // основной голос курса
    dialogue: TtsVoiceRef[]            // 2+ голоса для аудирования
  }
  stressRule?: StressRule              // pl: предпоследний слог + исключения
}
```

Подробности выбора источника звука — в `AUDIO_AND_PRONUNCIATION.md`.

### 3.4. InterferenceSet — зависит от пары языков

Это то, что отличает «польский для русскоязычных» от «польского для
англоязычных», и то, ради чего вообще стоит делать узкоспециализированный
продукт.

```ts
interface InterferenceSet {
  /** Ложные друзья: sklep ≠ склеп, dywan ≠ диван, uroda ≠ урод */
  falseFriends: FalseFriend[]

  /** Расхождения в управлении: тот же глагол требует другого падежа */
  governmentMismatches: GovernmentMismatch[]

  /** Типичные ошибки переноса, под которые генерируются точечные дриллы */
  transferErrors: TransferError[]
}
```

Хранится как данные в языковом пакете, ключ — `(target, source)`.
Для пары `pl × ru` это большой и ценный набор; для `pl × en` — совсем другой.

---

## 4. Модель данных

> **Решение: на первом этапе бэкенда нет.** Приложение local-first:
> контент — статические JSON, пользовательские данные — IndexedDB в браузере,
> FSRS считается на клиенте. PostgreSQL и Drizzle появляются позже и только
> когда понадобится синхронизация между устройствами. Схема ниже написана так,
> чтобы этот переход был механическим — см. §7bis.

Ниже — смысловая схема. Имена таблиц одинаковы в Dexie и в будущем Postgres,
поэтому миграция сводится к замене слоя доступа, а не модели.

### 4.1. Контент (read-only для приложения)

```ts
// ── Справочники ───────────────────────────────────────────────
languages          (id, bcp47, nameNative, nameEn, script, rtl)

// ── Цель обучения ─────────────────────────────────────────────
certification_targets (
  id,                    // 'pl-state-b1-adults'
  targetLanguageId,      // 'pl'
  cefrLevel,             // 'B1'
  name,                  // jsonb: локализованное название
  legalBasis,            // jsonb
  passRule,              // jsonb: см. §4.4 — стратегия, не число
  modules,               // jsonb: массив модулей с весами и порогами
  configurable           // jsonb: что меняется от сессии к сессии
)

// ── Курс = конкретный языковой пакет ──────────────────────────
courses (
  id,                    // 'pl-b1-ru'
  targetLanguageId,      // 'pl'
  sourceLanguageId,      // 'ru'
  certificationTargetId, // 'pl-state-b1-adults' | null для безэкзаменного
  contentVersion,        // семвер пакета
  durationDays           // 182
)

// ── Лексика ───────────────────────────────────────────────────
lexemes (
  id,                    // 'pl.mieszkanie' — ВСЕГДА с префиксом языка
  languageId,
  lemma,
  pos,
  frequencyRank,         // из Leipzig Corpora, CC BY 4.0
  cefrLevel,             // оценка, не официальное требование
  themeIds,              // массив: привязка к тематическому инвентарю
  audio                  // jsonb: { source, localPath?, attribution? }
)

lexeme_translations (
  lexemeId, sourceLanguageId,   // ← составной PK
  translation, gloss,
  UNIQUE (lexemeId, sourceLanguageId)
)

lexeme_examples (
  id, lexemeId,
  sentence,              // на целевом языке
  translations,          // jsonb: { ru: '…', uk: '…' }
  audio
)

// ── Грамматика ────────────────────────────────────────────────
grammar_rules (
  id,                    // 'pl.gram.dopelniacz-negacja'
  languageId,
  title,                 // jsonb локализованный
  explanation,           // jsonb локализованный markdown
  prerequisiteIds,       // массив — граф зависимостей, ДОЛЖЕН быть ацикличен
  competencyIds,         // связь с картой компетенций экзамена
  difficulty
)

// ── Карта компетенций экзамена ────────────────────────────────
competencies (
  id,                    // 'pl-b1.listening.selective'
  certificationTargetId,
  moduleId,              // 'listening' | 'reading' | 'grammar' | 'writing' | 'speaking'
  description,
  sourceReference        // 'załącznik nr 1, cz. II, rozdz. E, 1.1'
)

// ── Программа ─────────────────────────────────────────────────
curriculum_days (
  courseId, dayNumber,   // ← составной PK, 1..182
  weekNumber, moduleId,  // учебный модуль программы, не экзамена
  topic,
  grammarRuleIds,
  newLexemeIds,
  exercisePlan,          // jsonb: типы и порядок
  timeBudget,            // jsonb: раскладка внутри 15 минут
  competencyIds,
  expectedOutcome
)

// ── Упражнения ────────────────────────────────────────────────
exercise_templates (
  id, kind,              // 'translate-to-target' | 'inflect' | 'gap-fill' | …
  appliesTo,             // 'lexeme' | 'grammar-rule' | 'text'
  languageIds,           // null = подходит любому языку
  generatorRef,          // ключ генератора в плагине, если нужна морфология
  difficultyRange,
  checkStrategy          // 'exact' | 'normalized' | 'set-member' | 'llm-rubric'
)
```

### 4.1bis. Где физически лежит контент

Без бэкенда контент — это **статические файлы**, а не строки в БД:

| Что | Где | Как попадает в приложение |
|---|---|---|
| `exam-spec`, `competencies`, `grammar-rules` | `content/pl-b1-ru/*.json` | `import` на этапе сборки — небольшие, нужны всегда |
| `curriculum.json` (182 дня) | `public/content/pl-b1-ru/` | `fetch` при первом запуске, кладётся в IndexedDB |
| `vocabulary.json` (~2500) | `public/content/pl-b1-ru/` | то же |
| Аудио аудирования | `public/content/pl-b1-ru/audio/` | кэшируется service worker'ом |

Разделение простое: то, что нужно на первом кадре, — импортируется; то, что
большое и нужно офлайн, — загружается один раз и кэшируется.

Версия контента хранится в IndexedDB. При росте `contentVersion` приложение
перекачивает пакет и мигрирует пользовательские ссылки по стабильным id.

### 4.2. Пользовательские данные

Хранилище — **IndexedDB через Dexie**. Пользователь один (локальный), поэтому
`userId` в MVP не нужен — но поле оставлено в схеме, чтобы не переделывать её
при появлении синхронизации.

```ts
// packages/db/src/dexie.ts
class PolskiDB extends Dexie {
  constructor() {
    super('polski-b1')
    this.version(1).stores({
      // индексируются только поля, по которым реально идёт выборка
      studyItems:      'id, [courseId+due], [kind+refId], due, state',
      reviewLogs:      '++id, studyItemId, reviewedAt',
      ruleMastery:     'grammarRuleId, mastery, lastPracticedAt',
      moduleReadiness: '[courseId+moduleId]',
      personalDict:    'id, courseId, lemma, createdAt',
      lessonSessions:  '++id, dayNumber, startedAt',
      userCourses:     'courseId',
      settings:        'key',
      contentCache:    'key',      // загруженные пакеты контента
    })
  }
}
```

⚠️ Составной индекс `[courseId+due]` — главный: по нему строится ежедневная
очередь повторений. Без него выборка «что сегодня» будет сканировать всю
таблицу.

```ts
userCourses (
  courseId,              // ← PK: один локальный пользователь
  startedAt, targetExamDate,
  entryTrack,            // 'a0' | 'a2' | 'b1-minus' — результат диагностики
  dailyBudgetMinutes     // 15 по умолчанию
)

// ── Единица планирования FSRS ─────────────────────────────────
study_items (
  id, userId, courseId,
  kind,                  // 'lexeme-recognition' | 'lexeme-production' | 'rule-card'
  refId,                 // lexemeId либо grammarRuleId
  -- поля FSRS Card, один-в-один с ts-fsrs@5:
  due, stability, difficulty,
  elapsedDays, scheduledDays, learningSteps,
  reps, lapses, state, lastReview,
  UNIQUE (userId, kind, refId)
)
```

⚠️ Одна лексема порождает **две независимые карточки**: узнавание
(`pl → ru`) и воспроизведение (`ru → pl`). У них разная сложность и свои
кривые забывания — склеивать их нельзя. Обоснование в
`SPACED_REPETITION.md`.

```ts
review_logs (
  id, studyItemId, userId,
  rating,                // Rating из ts-fsrs: 1..4
  state, due, stability, difficulty,
  elapsedDays, lastElapsedDays, scheduledDays,
  reviewedAt,
  exerciseId, responseMs, // наше: чем именно вызван отзыв
  INDEX (userId, reviewedAt)
)
```

Полный лог нужен не только для истории: это обучающая выборка для
оптимизатора FSRS-параметров (`@open-spaced-repetition/binding`) — потом,
когда накопится.

```ts
// ── Освоение грамматики: ОТДЕЛЬНАЯ модель, не FSRS ────────────
rule_mastery (
  userId, grammarRuleId,  // ← составной PK
  mastery,                // 0..1, скользящая оценка
  attempts, correct,
  recentWindow,           // jsonb: последние N исходов с весами по сложности
  lastPracticedAt,
  introducedOnDay
)

// ── Готовность по модулям экзамена ────────────────────────────
module_readiness (
  userId, courseId, moduleId,   // ← составной PK
  estimatedPercent,             // прогноз балла
  confidence,
  lastMockScore, lastMockAt,
  updatedAt
)
```

`module_readiness` — это то, что делает систему заточенной под экзамен.
Генератор урока читает именно её и подтягивает слабейший модуль.

```ts
personal_dictionary (
  id, userId, courseId,
  lemma, translation,    // пользователь мог добавить что угодно
  sourceUrl, context,    // откуда взято расширением
  linkedLexemeId,        // если совпало со словом курса
  audioSource,           // почти всегда 'device-tts'
  createdAt
)

lesson_sessions (
  id, userId, dayNumber,
  startedAt, completedAt,
  plannedBudgetMs, actualMs,
  itemsReviewed, itemsCorrect,
  moduleBreakdown        // jsonb: сколько времени на какой модуль ушло
)
```

### 4.3. Что в схеме НЕ должно появиться

Чек-лист на ревью. Любое из этого — протечка:

- ❌ колонка `russian`, `polish`, `translation_ru`
- ❌ enum с польскими падежами в общем коде движка
- ❌ `if (languageId === 'pl')` где-либо вне плагина
- ❌ захардкоженное `182` в движке — берётся из `courses.durationDays`
- ❌ захардкоженные `50%`, `190 минут` — из `certification_targets`

### 4.4. passRule как стратегия, а не число

Польский B1 требует ≥50% **в каждом** модуле. IELTS считает средний балл.
Goethe — свои правила. Это разные **стратегии**, и они должны быть данными:

```ts
type PassRule =
  | { kind: 'per-module-floor'; thresholdPercent: number }      // pl-state-b1
  | { kind: 'aggregate'; thresholdPercent: number }              // A1/A2 pl
  | { kind: 'weighted-average'; weights: Record<ModuleId, number>; threshold: number }
  | { kind: 'band-average'; minBand: number; minPerModule?: number } // IELTS

interface ReadinessStrategy {
  /** Готов ли сдавать */
  isReady(scores: ModuleScores, rule: PassRule): boolean
  /** Какой модуль тянуть в первую очередь — вот где вся разница */
  weakestLink(scores: ModuleScores, rule: PassRule): ModuleId
}
```

Для `per-module-floor` функция `weakestLink` возвращает модуль с минимальным
баллом — и генератор урока отдаёт ему время. Для `aggregate` — модуль с
наибольшим `вес × отставание`. Один интерфейс, разное поведение, ноль `if`'ов
в генераторе.

---

## 5. Модули системы

```
Learning Platform
│
├── Content Registry        загрузка и валидация языковых пакетов,
│                           разрешение ID, версионирование
│
├── Curriculum Engine       день N → план занятия; пересчёт при пропусках
│
├── Vocabulary Engine       очередь новых слов, темп ввода,
│                           слияние курса и личного словаря
│
├── Grammar Engine          граф правил, топологический порядок,
│                           mastery-модель (НЕ FSRS)
│
├── FSRS Scheduler          обёртка над ts-fsrs@5.4.2: очередь повторений,
│                           бюджет нагрузки, обработка пропущенных дней
│
├── Exercise Engine         генерация из шаблонов + плагина, проверка ответа,
│                           адаптация сложности
│
├── Daily Lesson Generator  сборка 15 минут: приоритизация, обрезка по бюджету
│
├── Progress Tracking       агрегация, статистика, карта компетенций
│
├── Exam Preparation        module_readiness, пробные экзамены,
│                           критерий готовности
│
├── Dictionary Integration  личный словарь, перевод, Chrome-расширение
│
└── Language Plugins
    ├── pl/  Morfeusz · орфография ż-rz · pl-PL голоса · pl×ru интерференция
    └── …    следующий язык добавляется сюда, движок не трогается
```

### Поток одного ответа пользователя

```
ответ
  │
  ├─→ Exercise Engine: проверить (через OrthographyRules плагина)
  │       └─→ классифицировать ошибку
  │
  ├─→ FSRS Scheduler: rating → scheduler.next(card, now, rating)
  │       └─→ обновить study_items, записать review_logs
  │
  ├─→ Grammar Engine: обновить rule_mastery по всем правилам,
  │       помеченным на упражнении (их может быть несколько)
  │
  ├─→ Exam Preparation: пересчитать module_readiness
  │
  └─→ Daily Lesson Generator: решить, что показать следующим
```

Обратите внимание: **одно упражнение обновляет несколько моделей сразу.**
Упражнение на склонение существительного в родительном при отрицании — это
одновременно отзыв по лексической карточке и наблюдение по двум
грамматическим правилам. Это ключевое отличие от простого flashcard-приложения.

---

## 6. Стек

Версии проверены по npm **2026-10-24**.

| Пакет | Версия | Зачем |
|---|---|---|
| `next` | **16.4.3** | App Router, статический экспорт |
| `react` / `react-dom` | **19.3.1** | требуется Next 16 |
| `tailwindcss` + `@tailwindcss/postcss` | **4.3.3** | CSS-first конфигурация, без `tailwind.config.js` |
| `next-intl` | **4.14.9** | i18n. Явно поддерживает Next `^16.0.0` и React 19 |
| `dexie` | **4.4.7** | IndexedDB |
| `dexie-react-hooks` | 1.x | `useLiveQuery` — реактивность из БД |
| `zustand` | **5.0.16** | эфемерный UI-стейт |
| `ts-fsrs` | **5.4.2** | **не v6** — она в npm только в бете, см. `RESEARCH.md` §7.1 |
| `@serwist/next` | **9.5.13** | service worker. `next-pwa` мёртв с 2022 |
| `vitest` | актуальный | тесты движка |
| Node | **≥20.9** | требование Next 16 |

⚠️ `@serwist/next` объявляет peer `next >= 14.0.0` — диапазон, а не явная
проверка на 16. Собрать и убедиться до того, как закладываться на офлайн.

### Почему Next без бэкенда

Честно: для чисто локального PWA **Vite проще**, и у вас он уже работает в
EngTutor. Next здесь оправдан одним — путь к бэкенду, когда он понадобится,
будет добавлением `app/api/*` в тот же проект, а не переездом. Плюс
file-based роутинг на 14 экранов.

Режим — `output: 'export'`: на выходе статика, хостится где угодно, сервера
нет вообще.

```ts
// next.config.ts
export default {
  output: 'export',          // статика; убрать, когда появится API
  images: { unoptimized: true },  // оптимизатор требует сервера
}
```

Ограничения, которые это накладывает: нет route handlers, server actions,
middleware и ISR. Всё, что трогает IndexedDB, — клиентские компоненты. Для
local-first это не ограничение, а описание задачи.

### Что берём из EngTutor

Вы уже прошли этот путь, поэтому стек намеренно повторяет рабочие решения:

| Решение в EngTutor | Берём? | Почему |
|---|---|---|
| Dexie + `useLiveQuery` | ✅ да | для local-first это ровно то, что нужно: UI сам перерисовывается при записи в БД |
| zustand для UI-стейта | ✅ да | разделение «БД → useLiveQuery, UI → zustand» себя оправдало |
| CSS-переменные в `theme/tokens.css` | ✅ да, но через `@theme` | Tailwind 4 конфигурируется **из CSS**, ваши токены переносятся почти дословно |
| Vite | ❌ меняем на Next | по запросу + задел под бэкенд |
| Vitest | ✅ да | — |
| Fastify + Prisma | ❌ не нужен | бэкенда нет |

Tailwind 4 читает токены прямо из CSS, так что ваш `tokens.css` превращается в:

```css
/* app/theme.css */
@import "tailwindcss";

@theme {
  --color-brand-50:  #f0faf4;
  --color-brand-500: #1f9d55;
  --color-brand-600: #18794a;
  --font-display: "Inter", sans-serif;
  --radius-card: 12px;
}
```

…и сразу доступны как `bg-brand-500`, `rounded-card`. Отдельного
`tailwind.config.js` в v4 не нужно.

### Два урока из EngTutor, которые надо зашить в правила

Оба бага я чинил в вашем коде сегодня, и оба повторятся здесь один в один:

1. **`useLiveQuery` не должен писать в БД.** Dexie запрещает readwrite-транзакцию
   внутри querier — падает `ReadOnlyError` и роняет всё дерево React.
   Правило: querier только читает, дефолты возвращаются из памяти, запись —
   в обработчиках.
2. **Компонент упражнения обязан иметь `key`.** Без `key={step}` React
   переиспользует инстанс между упражнениями, и стейт предыдущего
   (`picked`, введённый ответ) блокирует следующее.

Оба проверяются ESLint-правилами и тестом на каждый тип упражнения.

## 6bis. Структура репозитория

```
polski-b1/                      → переименовать: имя не должно быть
├── apps/                          привязано к одному языку
│   ├── web/                    Next 16, App Router, output: export
│   │   ├── app/
│   │   │   ├── layout.tsx      NextIntlClientProvider + тема
│   │   │   ├── page.tsx        «Сегодня»
│   │   │   ├── lesson/         ежедневная тренировка
│   │   │   ├── plan/           программа и календарь
│   │   │   ├── dictionary/     словарь и редактор карточки
│   │   │   ├── progress/       статистика, карта компетенций
│   │   │   └── onboarding/     диагностика уровня
│   │   ├── messages/           ← i18n, см. §6ter
│   │   │   ├── ru.json
│   │   │   ├── uk.json
│   │   │   └── en.json
│   │   └── public/content/     языковые пакеты (большие JSON + аудио)
│   └── extension/              Chrome MV3 — этап 5
├── packages/
│   ├── engine/                 ЯЗЫКОНЕЗАВИСИМО. Без единого 'pl'
│   │   ├── srs/                обёртка ts-fsrs@5.4.2
│   │   ├── mastery/            модель освоения грамматики
│   │   ├── lesson/             генератор дневного занятия
│   │   ├── exercises/          рантайм упражнений
│   │   └── readiness/          стратегии passRule
│   ├── content-schema/         zod-схемы + валидатор пакетов
│   ├── db/                     Dexie-схема и репозитории
│   └── lang-pl/                ЯЗЫКОВОЙ ПЛАГИН
│       ├── morphology/         Morfeusz 2 — предрассчитанные таблицы
│       ├── orthography/
│       ├── audio/
│       └── interference/ru/    pl × ru
├── content/
│   └── pl-b1-ru/               ЯЗЫКОВОЙ ПАКЕТ (данные, не код)
│       ├── exam-spec.json
│       ├── competencies.json
│       ├── grammar-rules.json      ✅ готов, 66 правил
│       ├── vocabulary.json
│       ├── curriculum.json
│       └── exercise-templates.json
├── scripts/
│   ├── validate-grammar.mjs    ✅ готов
│   └── validate-content.mjs
└── docs/
```

⚠️ **Morfeusz в браузере не запустить** — это нативная библиотека. Без
бэкенда остаётся предрасчёт: скрипт на этапе сборки прогоняет словарь через
Morfeusz и кладёт готовые таблицы форм в `lang-pl/morphology/tables.json`.
Для 2500 лемм это мегабайты, а не гигабайты, и генерация упражнений
становится чистым просмотром таблицы.

Зависимости строго однонаправленные:

```
apps  →  engine  →  content-schema
  ↓        ↑
lang-pl ───┘   (плагин реализует интерфейсы engine, engine о нём не знает)
```

`engine` **не импортирует** `lang-pl`. Плагин регистрируется на старте
приложения. Проверяется линтером: запрет импорта `lang-*` из `engine`.

## 6ter. i18n

### Три разных «языка», которые нельзя путать

Классический источник багов — считать, что это одно и то же:

| Что | Пример | Где живёт |
|---|---|---|
| **UI language** — язык интерфейса | кнопка «Проверить» | `messages/*.json`, next-intl |
| **sourceLanguage** — язык переводов | `mieszkanie → квартира` | контент, `lexeme_translations` |
| **targetLanguage** — что изучаем | польский | контент, фиксирован курсом |

Обычно UI и source совпадают, но не обязаны: кто-то захочет русский
интерфейс с английскими глоссами. Поэтому это **две независимые настройки**,
UI по умолчанию наследует source.

```ts
interface UserSettings {
  uiLanguage: LanguageId      // next-intl
  sourceLanguage: LanguageId  // какие переводы показывать
  courseId: CourseId          // отсюда targetLanguage
}
```

### Локаль в URL или в настройках?

Два варианта, и для этого приложения они не равноценны:

| | URL-локали `/ru/lesson` | Локаль как настройка |
|---|---|---|
| SEO, расшаренные ссылки | ✅ | ❌ |
| Сложность при `output: export` | нужен `[locale]` + `generateStaticParams`, страницы множатся на число языков | ничего не меняется |
| Модель установленного PWA | чужая: у приложения нет «языка в адресе» | естественная |
| Переключение языка | навигация | мгновенно, без перезагрузки |

**Решение: локаль как настройка**, хранится в IndexedDB. Приложение —
установленное PWA, адресной строки пользователь не видит. `next-intl` это
поддерживает и без роутинга.

Если позже появится маркетинговый лендинг — он получит URL-локали отдельно,
не трогая приложение.

```tsx
// app/layout.tsx
import { NextIntlClientProvider } from 'next-intl'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {/* сообщения всех локалей бандлятся: их мало, а переключение
            должно быть мгновенным и работать офлайн */}
        <IntlBootstrap>{children}</IntlBootstrap>
      </body>
    </html>
  )
}
```

```tsx
// клиентский компонент: читает локаль из настроек в IndexedDB
'use client'
function IntlBootstrap({ children }) {
  const locale = useLiveQuery(() => getSetting('uiLanguage')) ?? 'ru'
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {children}
    </NextIntlClientProvider>
  )
}
```

### Правила работы с сообщениями

- ключи **смысловые, а не по тексту**: `lesson.check`, не `proverit`
- namespace по экранам: `lesson.*`, `dictionary.*`, `progress.*`, `common.*`
- `ru.json` — эталон. CI падает, если в другой локали есть ключ, которого
  нет в эталоне, или наоборот
- плюрализация — через ICU MessageFormat, он в next-intl встроен.
  Для русского это обязательно: `1 слово / 2 слова / 5 слов`
- **грамматический контент в `messages/` не кладётся.** Объяснение правила —
  это контент языкового пакета (`grammar_rules.explanation`), а не строка
  интерфейса. Граница: если текст меняется при смене *курса*, это контент;
  если при смене *языка интерфейса* — это i18n

```jsonc
// messages/ru.json
{
  "lesson": {
    "check": "Проверить",
    "next": "Дальше",
    "progress": "{done} из {total}",
    "wordsDue": "{count, plural, one {# слово} few {# слова} other {# слов}} к повторению"
  }
}
```

### Стартовый набор локалей

`ru` (эталон), `uk`, `en`. Украинский — та же целевая аудитория для польского
B1, а английский нужен как язык по умолчанию при неизвестной локали браузера.

---

## 7. Добавление второго языка: чек-лист

Проверка того, что архитектура не фикция. Чтобы запустить, скажем, чешский
B1 для русскоязычных, нужно:

| Шаг | Что делается | Код движка меняется? |
|---|---|---|
| 1 | Строка в `languages` | нет |
| 2 | Запись в `certification_targets` + `passRule` | нет, если стратегия уже есть |
| 3 | Новый пакет `content/cs-b1-ru/` | нет |
| 4 | Новый `packages/lang-cs/` с реализацией `LanguagePlugin` | нет |
| 5 | Морфологический провайдер для чешского | нет |
| 6 | Набор интерференции `cs × ru` | нет |
| 7 | Локали интерфейса | нет |

Строчка «нет» в каждой строке — это и есть критерий приёмки архитектуры.
Если на каком-то шаге придётся править `packages/engine` — значит слой
протёк, и это баг проектирования, а не особенность языка.

**Единственное исключение**, где движок законно меняется: появление
принципиально новой `PassRule` (например, бандовая шкала IELTS). Это
расширение стратегии, а не правка существующей логики.

---

## 8. Что ещё не спроектировано

Дописывается по мере готовности смежных документов:

- API endpoints — после `EXERCISE_ENGINE.md`
- Формат хранения правил и упражнений в деталях — после `grammar-rules.json`
- Алгоритм генерации дневного урока — после `CURRICULUM.md` и `SPACED_REPETITION.md`
- Механизм изменения программы по прогрессу — там же
- Chrome MV3: манифест, права, синхронизация — этап 5
- Аутентификация, биллинг, аналитика — вне текущего объёма
