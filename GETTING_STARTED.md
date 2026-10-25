# GETTING_STARTED.md — запуск и деплой

Всё, что нужно, чтобы поднять проект локально и выложить его в сеть.

Бэкенда нет: на выходе статика. Значит деплой — это «положить папку на
хостинг», без серверов, БД и переменных окружения на проде (кроме одной,
которая вшивается в бандл при сборке).

---

## 1. Требования

| | Версия | Проверить |
|---|---|---|
| Node.js | **≥ 20.9** (требование Next 16) | `node -v` |
| pnpm | **9.x** | `pnpm -v` |

Если pnpm нет: `corepack enable && corepack prepare pnpm@9.15.0 --activate`

---

## 2. Запуск за три команды

```bash
cd polski-b1
pnpm install
pnpm dev
```

Откроется на **http://localhost:3000**.

Другой порт: `pnpm --filter @polski/web dev --port 3100`

### Что должно быть видно сразу

- экран «Сегодня»: день программы, правило дня, раскладка минут, слова дня
  с озвучкой;
- кнопка «Начать» ведёт в занятие — показ слова, озвучка, проверка перевода;
- переключатели языка интерфейса (ru / uk / en) и оформления (7 палитр × 3 темы).

Если занятие проходится до конца и после перезагрузки счётчик дня
сдвинулся — значит IndexedDB, FSRS и контент поднялись правильно.

---

## 3. Переменные окружения

Файл `apps/web/.env.local` (создаётся копией `.env.example`).

```ini
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_COURSE_ID=pl-b1-ru
```

Обе переменные **публичные** (`NEXT_PUBLIC_`) — они вшиваются в бандл и
видны в браузере. Это нормально: Client ID не секрет.

⚠️ **Client Secret сюда класть не нужно и нельзя.** Поток полностью
клиентский, бэкенда нет. Секрет понадобится только когда появится сервер.

⚠️ Переменные `NEXT_PUBLIC_*` подставляются **на этапе сборки**, а не в
рантайме. Поменяли — нужно пересобрать.

### Как получить Google Client ID

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. **Create credentials → OAuth client ID → Web application**
3. **Authorized JavaScript origins** — добавить оба:
   - `http://localhost:3000` — для разработки
   - `https://ваш-домен` — для продакшена
4. Redirect URI **не нужен**: используется Google Identity Services,
   он работает без редиректа
5. Скопировать Client ID в `.env.local`

Пока переменная пустая — кнопка входа просто не показывается, приложение
работает полностью локально.

**Что вход сейчас даёт:** показывает, кто вошёл, и разделяет локальные
профили. Данные всё равно лежат только в этом браузере. Это заготовка под
будущую синхронизацию — см. `docs/ARCHITECTURE.md` §7bis.

---

## 4. Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | дев-сервер с hot reload |
| `pnpm build` | продакшен-сборка → `apps/web/out/` |
| `pnpm start` | локальный просмотр собранной статики |
| `pnpm typecheck` | проверка типов во всех пакетах |
| `pnpm validate` | валидатор графа грамматики и программы |
| `pnpm content` | пересобрать программу и словарь |
| `pnpm --filter @polski/engine test` | 22 теста движка: FSRS, mastery, готовность |

---

## 5. Структура

```
polski-b1/
├── apps/web/            Next 16, App Router, output: 'export'
│   ├── app/             страницы и layout
│   ├── lib/             db (Dexie), auth, speech, i18n
│   ├── messages/        переводы интерфейса: ru, uk, en
│   └── public/          манифест, иконки, контент-пакеты
├── packages/engine/     FSRS, mastery-модель, генератор занятия. ЯЗЫКОНЕЗАВИСИМ
├── packages/ui/         дизайн-система. ТОЛЬКО здесь живут Tailwind-классы
├── content/pl-b1-ru/    учебный контент: грамматика, словарь, программа
├── scripts/             валидаторы контента
├── tools/               tts-test.html — ручная проверка синтеза речи
└── docs/                вся документация и план
```

Начинать чтение — с `docs/PLAN.md`, затем `docs/DEV_RULES.md`.

---

## 6. Деплой

Сборка кладёт готовый сайт в `apps/web/out/`. Это обычные HTML, CSS и JS —
хостится где угодно.

```bash
pnpm build
# → apps/web/out/
```

### Vercel

```bash
npx vercel
```

Настройки в проекте Vercel:

| Поле | Значение |
|---|---|
| Framework Preset | Next.js |
| Root Directory | `polski-b1` |
| Build Command | `pnpm build` |
| Output Directory | `apps/web/out` |
| Install Command | `pnpm install` |

Переменную `NEXT_PUBLIC_GOOGLE_CLIENT_ID` добавить в **Settings →
Environment Variables** и **пересобрать** — она попадает в бандл только при
сборке.

### Netlify

`netlify.toml` в корне `polski-b1`:

```toml
[build]
  base    = "polski-b1"
  command = "pnpm build"
  publish = "apps/web/out"

[build.environment]
  NODE_VERSION = "20"
```

### Cloudflare Pages

| Поле | Значение |
|---|---|
| Build command | `pnpm build` |
| Build output directory | `apps/web/out` |
| Root directory | `polski-b1` |

### GitHub Pages

Работает, но есть нюанс. Если сайт живёт не в корне домена
(`username.github.io/polski-b1`), нужен `basePath`:

```ts
// next.config.ts
const isGhPages = process.env.GITHUB_PAGES === 'true'
export default {
  output: 'export',
  basePath: isGhPages ? '/polski-b1' : '',
  assetPrefix: isGhPages ? '/polski-b1/' : '',
  images: { unoptimized: true },
  trailingSlash: true,
  transpilePackages: ['@polski/ui', '@polski/engine'],
}
```

И положить `.nojekyll` в `out/`, иначе GitHub выкинет папки на `_`.

### Любой статический хостинг / nginx

```bash
pnpm build
rsync -av apps/web/out/ user@server:/var/www/polski-b1/
```

Благодаря `trailingSlash: true` каждая страница — это `папка/index.html`,
поэтому особые rewrite-правила не нужны.

---

## 7. Чек-лист перед продакшеном

```
☐ HTTPS — иначе не работают ни service worker, ни установка PWA
☐ NEXT_PUBLIC_GOOGLE_CLIENT_ID задан на хостинге И проект пересобран
☐ боевой домен добавлен в Authorized JavaScript origins в Google Console
☐ иконки 192/512, maskable-512 и apple-touch-icon лежат в public/ — ✅ есть
☐ pnpm validate проходит
☐ pnpm typecheck проходит
☐ проверено на ширине 320px (iPhone SE) — нижняя граница вёрстки
☐ проверено, что тема не моргает при загрузке
```

---

## 8. Если что-то не работает

| Симптом | Причина |
|---|---|
| **Вёрстка разъехалась, стили не применились** | Tailwind 4 не сканирует `node_modules`, куда симлинкнут `@polski/ui`. Нужна строка `@source "../../../packages/ui/src";` в `app/globals.css` |
| **Кнопки озвучки молчат** | На устройстве нет польского голоса. macOS: Настройки → Универсальный доступ → Устный контент → Голоса → Польский. Приложение должно показать подсказку, а не промолчать |
| **Озвучка зависла** | Известная болячка Chrome: очередь встаёт, `speaking` остаётся `true`. Лечится `speechSynthesis.cancel()`. Проверить изолированно можно в `tools/tts-test.html` |
| **Кнопки Google нет** | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` пуст или проект не пересобран после его добавления |
| **`origin_mismatch` от Google** | Домен не добавлен в Authorized JavaScript origins. Порт тоже имеет значение: `localhost:3000` ≠ `localhost:3100` |
| **Тема моргает светлой при загрузке** | Не отработал блокирующий скрипт в `<head>` — он читает тему из `localStorage` синхронно, потому что IndexedDB до первого кадра не успевает |
| **Сборка падает на типах** | `pnpm typecheck` покажет подробности. Next правит `tsconfig.json` при первой сборке — это нормально |
