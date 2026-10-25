# DEV_RULES.md — правила разработки

Правила, которые должны выполняться без обсуждения в ревью. Каждое — либо
проверяется линтером, либо имеет конкретный баг за спиной.

Версии проверены по npm 2026-10-24.

---

## 1. UI-библиотека

### Выбор

| Пакет | Версия | Роль |
|---|---|---|
| `radix-ui` | **1.8.1** | неоформленные доступные примитивы: dialog, popover, tabs, select, tooltip, progress |
| `tailwind-variants` | **3.3.1** | матрица вариантов компонента, слоты |
| `tailwind-merge` | **3.7.0** | предсказуемое слияние конфликтующих классов |
| `clsx` | **2.1.1** | условная сборка классов |
| `shadcn/ui` | — | **не зависимость.** Источник, откуда копируются и правятся компоненты |

### Почему не полноценная библиотека компонентов

Рассмотрены и отклонены:

| Вариант | Почему нет |
|---|---|
| **Mantine 9.7.3** | Полноценная дизайн-система со своими решениями. UI здесь нестандартный — карточки упражнений, кольца прогресса, карта компетенций. Библиотеку пришлось бы в основном переопределять |
| **MUI / Chakra** | Рантайм CSS-in-JS, трение с RSC, риск вспышки нестилизованного контента при SSR |
| **Base UI** | `1.0.0-rc.0` опубликован в декабре 2025 и с тех пор не вышел в стабильную версию. Для продакшена рано |
| **React Aria Components 1.22.1** | Достойная альтернатива Radix, лучшая доступность. Можно взять вместо Radix, но API многословнее, а набор примитивов у нас маленький |

Реально нужно примитивов на один экран: диалог, поповер, вкладки, селект,
тултип, прогресс. Это Radix. Всё остальное — свои компоненты, потому что
таких компонентов в библиотеках нет.

### SSR и RSC

Проект в режиме `output: 'export'`, серверных компонентов с данными нет —
всё, что трогает IndexedDB, клиентское. Но правило всё равно соблюдаем:

- `'use client'` ставится на **листовых** интерактивных компонентах, а не на
  странице целиком
- Radix SSR-безопасен, но его компоненты интерактивны → всегда `'use client'`
- Никакого рантайм-CSS-in-JS. Только Tailwind и CSS-переменные — тогда
  первый кадр всегда стилизован

---

## 2. Инкапсуляция стилей

Главная претензия к Tailwind — вот это:

```tsx
// ❌ так быть не должно
<button className="inline-flex items-center justify-center gap-2 rounded-xl
  border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium
  text-neutral-900 shadow-sm transition hover:bg-neutral-50
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600
  disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-800
  dark:bg-neutral-900 dark:text-neutral-100">
  Проверить
</button>
```

Такая строка нечитаема, не переиспользуется, и при копировании расходится
по вариантам.

### R1. Tailwind-классы живут только внутри компонента, который ими владеет

Экраны, страницы и фичи **не содержат оформительских классов**. Они
собираются из компонентов `packages/ui` и layout-примитивов.

```tsx
// ✅ экран
<Card>
  <Prompt>{word.lemma}</Prompt>
  <OptionList>
    {options.map((o) => <Option key={o.id} state={stateOf(o)}>{o.text}</Option>)}
  </OptionList>
  <Button variant="primary" size="lg" onClick={check}>
    {t('lesson.check')}
  </Button>
</Card>
```

Прочитав экран, видно **что** на нём, а не как оно покрашено.

### R2. Варианты — через `tv()`, не через условные строки

```tsx
// packages/ui/src/Button.tsx
import { tv, type VariantProps } from 'tailwind-variants'

const button = tv({
  base: `inline-flex items-center justify-center gap-2 rounded-card font-medium
         transition select-none
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
         disabled:pointer-events-none disabled:opacity-50`,
  variants: {
    variant: {
      primary: 'bg-accent text-accent-fg hover:bg-accent/90',
      ghost:   'bg-transparent text-fg hover:bg-surface',
      danger:  'bg-bad text-white hover:bg-bad/90',
    },
    size: {
      // 48px — минимум для касания, см. UX_UI.md §1.6
      md: 'h-11 px-4 text-sm',
      lg: 'h-12 px-5 text-base',
    },
    full: { true: 'w-full' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
})

type Props = React.ComponentProps<'button'> & VariantProps<typeof button>

export function Button({ variant, size, full, className, ...rest }: Props) {
  return <button className={button({ variant, size, full, className })} {...rest} />
}
```

Вся «простыня» осталась в одном файле и больше нигде не повторяется.

### R3. `className` снаружи — только для позиционирования

Это единственное исключение, и граница проходит чётко:

| Можно передать снаружи | Нельзя |
|---|---|
| `mt-4`, `mb-2` — отступ от соседа | `bg-*`, `text-*`, `border-*` |
| `col-span-2`, `row-start-1` — место в сетке | `rounded-*`, `shadow-*` |
| `shrink-0`, `grow` — поведение во флексе | `font-*`, `px-*`, `py-*` |
| `hidden lg:block` — видимость на брейкпоинте | `hover:*`, `focus:*` |

Логика: компонент знает, **как он выглядит**, но не знает, **где стоит**.
Внешний вид — его дело; положение — дело родителя.

Если родителю нужен другой внешний вид — это не `className`, это **новый
вариант** в `tv()`. Появление третьего такого запроса означает, что в
дизайн-системе не хватает варианта, а не что правило мешает.

### R4. Многочастные компоненты — через слоты

```tsx
const card = tv({
  slots: {
    root:   'rounded-card border border-line bg-surface',
    header: 'flex items-center justify-between px-4 pt-4 pb-2',
    body:   'px-4 pb-4',
    footer: 'border-t border-line px-4 py-3',
  },
  variants: {
    tone: {
      neutral: {},
      correct: { root: 'border-ok/40 bg-ok/5' },
      wrong:   { root: 'border-bad/40 bg-bad/5' },
    },
  },
})

export function Card({ tone, children }: CardProps) {
  const { root } = card({ tone })
  return <div className={root()}>{children}</div>
}
```

Без слотов пришлось бы прокидывать `headerClassName`, `bodyClassName` —
то есть протекание наружу, против R1.

### R5. Слияние классов — только через `cn()`

```tsx
// packages/ui/src/cn.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
```

Без `tailwind-merge` `"px-4" + "px-6"` даёт непредсказуемый результат —
выигрывает тот, кто позже в CSS, а не в пропсах. `tv()` использует
`tailwind-merge` внутри; для ручной сборки — `cn()`.

### R6. Никаких магических значений

```tsx
// ❌  text-[#1f9d55]   p-[13px]   w-[347px]
// ✅  text-accent      p-3        w-full max-w-prose
```

Любой цвет, радиус и шрифт приходит из `@theme`. Если токена нет — он
добавляется в `theme.css`, а не инлайнится. Проверяется правилом
`tailwindcss/no-arbitrary-value` (с точечными исключениями для
`env(safe-area-inset-*)` и `100dvh`).

### R7. Layout-примитивы вместо повторяющихся утилит

```tsx
<Stack gap="md">…</Stack>          // вместо flex flex-col gap-3
<Row gap="sm" align="center">…</Row>
<Screen>…</Screen>                 // 100dvh + safe-area, см. UX_UI.md §1.5
```

Это снимает 80% оставшихся классов в экранах.

### Где это живёт

```
packages/ui/src/
├── cn.ts
├── theme.css          @theme токены — единственный источник цветов
├── primitives/        Stack, Row, Screen, Spacer
├── controls/          Button, Option, Input, Toggle
├── surfaces/          Card, Sheet, Dialog (поверх radix-ui)
└── domain/            ExerciseCard, ProgressRing, CompetencyMap, WordRow
```

`domain/` — компоненты, специфичные для продукта, но всё ещё не знающие о
польском языке: `ExerciseCard` принимает пропсы, а не лезет в контент.

---

## 3. Границы слоёв

Из `ARCHITECTURE.md` §2. Нарушение — баг проектирования, не стилистика.

- **R8.** `packages/engine` не импортирует `lang-*` и не содержит
  `if (languageId === 'pl')`. Плагин регистрируется снаружи
- **R9.** В схеме БД нет колонок вида `translation_ru`. Язык — всегда
  значение поля, никогда не часть имени
- **R10.** Никаких захардкоженных `182`, `15`, `50%`, `190` в коде. Всё из
  `courses` и `certification_targets`
- **R11.** `packages/ui` не импортирует `engine` и не знает про FSRS.
  Компоненты получают данные пропсами

Критерий приёмки: удалить все языковые пакеты и плагины — `engine` должен
собираться и проходить тесты.

---

## 4. React и Dexie

Оба правила стоят за реальными багами, пойманными в EngTutor 2026-10-24.

### R12. `useLiveQuery` только читает

```tsx
// ❌ падает: ReadOnlyError — Readwrite transaction in liveQuery context
const stats = useLiveQuery(() => getStatsAndCreateIfMissing())

// ✅ querier читает; строка создаётся в обработчике
const stats = useLiveQuery(() => db.stats.get('me')) ?? DEFAULT_STATS
```

Dexie запрещает readwrite-транзакцию внутри querier. Исключение летит мимо
error boundary и роняет всё дерево — пользователь видит белый экран.

**Любой дефолт возвращается из памяти, запись — только из обработчиков
событий.**

### R13. Компонент упражнения обязан иметь `key`

```tsx
// ❌ React переиспользует инстанс, стейт предыдущего упражнения остаётся
<ExerciseView ex={exercises[step]} onResult={next} />

// ✅
<ExerciseView key={step} ex={exercises[step]} onResult={next} />
```

Без `key` внутренний стейт (`picked`, введённый ответ, собранные буквы)
переживает смену упражнения и блокирует следующее — тренировка встаёт.

Тест на каждый тип упражнения: пройти два подряд и убедиться, что второе
принимает ввод.

### R14. Error boundary вокруг каждого экрана

Оба бага выше приводили к белому экрану именно потому, что boundary не
было. Минимум — один на маршрут, с кнопкой «перезапустить урок».

### R15. Таймеры в `useEffect` убираются в cleanup

В EngTutor `setTimeout(onResult, 700)` без cleanup в StrictMode давал
двойное начисление XP: одно упражнение — 20 очков вместо 10.

```tsx
useEffect(() => {
  const id = setTimeout(() => onResult(ok), 700)
  return () => clearTimeout(id)
}, [ok, onResult])
```

---

## 5. i18n

Из `ARCHITECTURE.md` §6ter.

- **R16.** Ни одной строки интерфейса в JSX. Только `t('…')`
- **R17.** Ключи смысловые: `lesson.check`, не `proverit` и не `btn_1`
- **R18.** Плюрализация — через ICU, не через `if (n === 1)`. Для русского
  и украинского нужны формы `one / few / many`
- **R19.** `ru.json` — эталон. CI падает при расхождении набора ключей
- **R20.** Объяснение грамматики **не** в `messages/`. Граница: меняется при
  смене курса → контент; при смене языка интерфейса → i18n

---

## 6. Звук

Из `AUDIO_AND_PRONUNCIATION.md`.

- **R21.** Голос выбирается явно через `getVoices()`; задаются **и** `voice`,
  **и** `lang`. Одного `lang` недостаточно — при отсутствии голоса браузер
  молча прочитает чужим
- **R22.** Нет голоса целевого языка → явная ошибка и подсказка
  пользователю, не тишина
- **R23.** Один `utterance` — один язык. Польское слово и русский перевод
  произносятся раздельно
- **R24.** Никакого SSML в Web Speech: на macOS теги зачитываются вслух
- **R25.** Офлайн берётся только голос с `localService: true`

---

## 7. Контент

- **R26.** Любой идентификатор контента с префиксом языка: `pl.mieszkanie`,
  `pl.gram.dopelniacz-negacja`. Коллизии между языками исключены по
  построению
- **R27.** Граф зависимостей грамматики ацикличен. Проверяется
  `scripts/validate-grammar.mjs` в CI
- **R28.** Валидатор диакритики на всех польских строках — отсутствие
  диакритики в длинной строке почти всегда опечатка, а не стиль
- **R29.** Контент меняется только через файлы в `content/` и проходит
  валидацию. Никаких правок данных из кода приложения

---

## 8. Конфигурация линтера

```js
// eslint.config.mjs
import tailwind from 'eslint-plugin-tailwindcss'   // 4.4.0, peer tailwindcss ^4

export default [
  ...tailwind.configs['flat/recommended'],
  {
    rules: {
      'tailwindcss/classnames-order': 'warn',
      'tailwindcss/no-custom-classname': 'error',   // R6
      'tailwindcss/enforces-shorthand': 'warn',
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/lang-*'], message: 'R8: engine не знает о языковых плагинах' },
          { group: ['**/engine/*'], message: 'R11: ui не зависит от engine' },
        ],
      }],
    },
  },
]
```

⚠️ `no-restricted-imports` настраивается **по пакетам** (overrides для
`packages/engine/**` и `packages/ui/**`), а не глобально — приложению
импортировать и то, и другое можно.

Отдельным скриптом, не линтером:

```
scripts/check-classnames.mjs   R1/R3: className с оформительскими классами
                               вне packages/ui — ошибка
scripts/check-i18n.mjs         R19: расхождение ключей локалей
scripts/validate-grammar.mjs   R27: цикл в графе     ✅ готов
scripts/validate-content.mjs   R28: диакритика, бюджеты дней
```

---

## 9. Чек-лист ревью

```
Стили
  ☐ нет оформительских Tailwind-классов вне packages/ui
  ☐ новые варианты добавлены в tv(), а не прокинуты className
  ☐ нет произвольных значений: text-[#...], p-[13px]
  ☐ касания ≥ 48px, font-size в input ≥ 16px

React
  ☐ useLiveQuery ничего не пишет
  ☐ у компонента упражнения есть key
  ☐ таймеры из useEffect убираются в cleanup
  ☐ экран обёрнут в error boundary

Слои
  ☐ engine не импортирует lang-*
  ☐ нет захардкоженных чисел из exam-spec
  ☐ id контента с префиксом языка

i18n
  ☐ нет строк интерфейса в JSX
  ☐ плюрализация через ICU
  ☐ ключи добавлены во все локали
```
