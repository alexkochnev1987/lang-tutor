# GETTING_STARTED.md — запуск и деплой

Всё, что нужно, чтобы поднять проект локально и выложить его в сеть.

Прогресс пользователя живёт в **Postgres** (локально — Docker, на проде —
Neon через Vercel). Контент курса остаётся статическими JSON и в базу не
попадает.

---

## 1. Требования

| | Версия | Проверить |
|---|---|---|
| Node.js | **≥ 20.9** (требование Next 16) | `node -v` |
| pnpm | **9.x** | `pnpm -v` |
| Docker | любой свежий — только для локальной базы | `docker info` |

Если pnpm нет: `corepack enable && corepack prepare pnpm@9.15.0 --activate`

---

## 2. Запуск за три команды

```bash
cd polski-b1
pnpm install
pnpm db:up          # поднимет Postgres в Docker на порту 5433
cp apps/web/.env.example apps/web/.env.local
pnpm db:migrate     # создаст таблицы
pnpm dev
```

Откроется на **http://localhost:3000**.

В `.env.local` обязательно заполнить `SESSION_SECRET`
(`openssl rand -base64 32`) — без него в dev будет предупреждение в
логе, а прод-сборка откажется стартовать.

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
DATABASE_URL=postgres://polski:polski@localhost:5433/polski
DATABASE_URL_UNPOOLED=        # только для миграций на Neon
SESSION_SECRET=               # openssl rand -base64 32
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_COURSE_ID=pl-b1-ru
```

`NEXT_PUBLIC_*` — публичные: вшиваются в бандл и видны в браузере. Это
нормально, Client ID не секрет. Остальные три **серверные** и в браузер
не попадают.

⚠️ **Client Secret не нужен и здесь.** ID-токен проверяется по публичным
ключам Google (`jose` + JWKS), обмена кодом на токен нет.

⚠️ Смена `SESSION_SECRET` разлогинивает всех. У гостей без привязанного
Google-аккаунта вместе с сессией теряется и доступ к своему прогрессу —
строка в базе остаётся, но найти её больше нечем.

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
будущую синхронизацию — см. `docs/DEPLOY_VERCEL_DB.md`, там расписано,
что именно нужно доделать, чтобы вход стал настоящим.

---

## 4. Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | дев-сервер с hot reload |
| `pnpm build` | контент → штамповка `sw.js` → прод-сборка Next |
| `pnpm start` | прод-сервер локально (`next start`) |
| `pnpm db:up` / `db:down` | поднять/остановить локальный Postgres в Docker |
| `pnpm db:generate` | сгенерировать миграцию по изменённой схеме |
| `pnpm db:migrate` | применить миграции |
| `pnpm db:studio` | веб-просмотр содержимого базы |
| `pnpm db:dump` | выгрузить прод-базу в `dumps/` (см. §6bis) |
| `pnpm db:restore <файл> --anonymize` | залить дамп в локальную базу |
| `pnpm db:migrate:prod --yes` | накатить миграции на прод вручную |
| `pnpm typecheck` | проверка типов во всех пакетах |
| `pnpm validate` | валидатор графа грамматики и программы |
| `pnpm content` | пересобрать программу и словарь |
| `pnpm --filter @polski/engine test` | 47 тестов движка: FSRS, mastery, готовность, упражнения |
| `node scripts/build-morphology.mjs <sgjp.tab.gz>` | пересобрать парадигмы из словаря SGJP |

---

## 5. Структура

```
polski-b1/
├── apps/web/            Next 16, App Router, серверный режим
│   ├── app/             страницы, layout и app/api/* — роуты данных
│   ├── drizzle/         сгенерированные SQL-миграции
│   ├── lib/db/          схема Postgres, драйвер, lib/data — стор на клиенте
│   ├── lib/auth/        сессия (jose) и кнопка Google
│   ├── messages/        переводы интерфейса: ru, uk, en
│   └── public/          манифест, иконки, контент-пакеты
├── packages/engine/     FSRS, mastery-модель, генератор занятия. ЯЗЫКОНЕЗАВИСИМ
├── packages/ui/         дизайн-система. ТОЛЬКО здесь живут Tailwind-классы
├── content/pl-b1-ru/    учебный контент: грамматика, словарь, программа
├── docker-compose.yml   локальный Postgres для разработки
├── scripts/             сборка контента, штамповка service worker
├── tools/               tts-test.html — ручная проверка синтеза речи
└── docs/                вся документация и план
```

Начинать чтение — с `docs/PLAN.md`, затем `docs/DEV_RULES.md`.

---

## 6. Деплой на Vercel

Сборка больше не статическая: нужны серверные роуты (`app/api/*`) и
база. Netlify/Cloudflare Pages/GitHub Pages из прошлой версии этого
раздела больше не подходят — они отдают статику.

### 6.1. Проект

| Поле | Значение |
|---|---|
| Framework Preset | **Next.js** |
| Root Directory | **`apps/web`** — там лежит `next.config.ts`, по нему Vercel и опознаёт Next |
| Include files outside Root Directory | **включить** |
| Build Command | **`cd ../.. && pnpm build`** (Override) |
| Output Directory | не трогать |
| Install Command | не трогать |
| Node.js Version | 20.x или выше |

⚠️ Переопределить Build Command обязательно. Корень проекта — `apps/web`,
и без этого Vercel запустит голый `next build`, пропустив два шага из
корневого `pnpm build`:

- `scripts/sync-content.mjs` — кладёт `content/<курс>/*.json` в `public/`.
  Без него приложение собирается, но на проде нет ни программы, ни
  словаря: экран «Сегодня» не находит контент;
- `scripts/stamp-sw.mjs` — собирает `public/sw.js` из шаблона. Без него
  service worker уедет с плейсхолдерами `__BUILD_ID__`/`__COURSE_ID__`:
  прекэш пойдёт по несуществующим URL, а версия кэша перестанет меняться
  между деплоями.

Чекбокс «Include files outside» нужен по той же причине: `content/` и
`scripts/` лежат выше корня проекта.

### 6.2. База

**Storage → Create Database → Neon → Connect to project.** Vercel сам
добавит `DATABASE_URL` и `DATABASE_URL_UNPOOLED` во все окружения.

Код выбирает драйвер по хосту в `DATABASE_URL` (`lib/db/pg.ts`): Neon
по HTTP на проде, обычный `pg` по TCP для локального Docker. Менять
ничего не нужно.

Миграции на прод-базу накатываются с машины:

```bash
vercel env pull apps/web/.env.local   # заберёт строки Neon
pnpm db:migrate                       # пойдёт по DATABASE_URL_UNPOOLED
```

⚠️ Для миграций нужна именно unpooled-строка: pooler Neon не держит
сессионные блокировки, на которых работает DDL.

### 6.3. Переменные окружения

| Переменная | Откуда | Окружения |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | добавит интеграция Neon | все |
| `SESSION_SECRET` | `openssl rand -base64 32` | все |
| `NEXT_PUBLIC_COURSE_ID` | `pl-b1-ru` | все |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Cloud Console | все |

⚠️ `NEXT_PUBLIC_*` вшиваются **при сборке**. Добавили или поменяли —
нужен редеплой, перезапуска мало.

### 6.4. Google

В **Authorized JavaScript origins** добавить все адреса, откуда будет
открываться приложение: `http://localhost:3000`, прод-домен и домены
превью. Иначе на превью кнопка входа отвалится с `origin_mismatch`.

Пока `NEXT_PUBLIC_GOOGLE_CLIENT_ID` пуст, кнопка входа просто скрыта:
приложение работает на гостевой сессии, прогресс пишется в базу и живёт,
пока цела cookie в этом браузере.

### 6.5. Проверка после деплоя

```
☐ https://<домен>/api/state/ отвечает 200 и ставит cookie pb1_session
☐ https://<домен>/sw.js содержит хеш коммита, а не __BUILD_ID__
☐ Экран «Сегодня» показывает день программы и слова дня
☐ Занятие проходится, после перезагрузки день сдвинулся
☐ Вход через Google работает, в users появился google_sub
```

## 6bis. Прод-база: дамп, восстановление, миграции

### Один раз: строка подключения

Vercel помечает переменные Neon как **Secret** и не отдаёт их CLI —
`vercel env pull` вернёт заглушку `[SENSITIVE]`. Поэтому строку нужно
один раз скопировать руками: **Vercel → Storage → ваша база →
Connection string** (или Neon Console → Connection Details). Обе формы,
с пулером и без, положить в `.env.prod` в корне проекта:

```ini
# .env.prod — в .gitignore, в репозиторий не попадает
DATABASE_URL=postgres://…@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgres://…@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

⚠️ Файл называется `.env.prod`, а не `.env.production.local`, намеренно:
второе имя Next читает сам при `NODE_ENV=production`, и локальная
прод-сборка молча ушла бы работать на боевой базе. `.env.prod` не читает
никто, кроме скриптов ниже.

### Дамп

```bash
pnpm db:dump                 # полный: схема + данные
pnpm db:dump --schema-only   # только схема, чтобы сверить с миграциями
```

Кладётся в `dumps/prod-<дата>-<время>.sql` (каталог в `.gitignore`).
Формат plain SQL — файл можно открыть и прочитать, а не только
восстановить.

Версия `pg_dump` **не угадывается**: скрипт сначала спрашивает у сервера
`server_version_num` и запускает образ `postgres:<та же версия>-alpine`.
Иначе выгрузка падает с «server version mismatch», стоит Neon обновить
мажорную версию. Локально ни `pg_dump`, ни `psql` не нужны — всё через
Docker.

⚠️ В дампе персональные данные: email, имя и аватар из Google. Не
прикладывайте файлы к задачам и не выносите за пределы машины.

### Восстановление в локальную базу

```bash
pnpm db:restore dumps/prod-2026-10-25-07-48.sql --anonymize
```

Сносит локальные схемы и заливает дамп — после этого разработка идёт на
копии реальных данных. `--anonymize` затирает email, имя и аватар в
`users`; для работы они не нужны, а утечь могут.

⚠️ Восстановление **отказывается** работать, если `DATABASE_URL` в
`apps/web/.env.local` указывает не на `localhost`. Операция
перезаписывает схему целиком, и права ошибиться здесь нет.

Сносятся именно **все** пользовательские схемы, а не только `public`:
журнал применённых миграций drizzle живёт в схеме `drizzle`, и если её
оставить, дамп упирается в «schema already exists» на полпути.

### Миграции

Цикл изменения схемы:

```bash
# 1. правим apps/web/lib/db/schema.ts
pnpm db:generate            # drizzle сгенерирует SQL в apps/web/drizzle/
# 2. смотрим глазами, что он написал, и правим SQL при необходимости
pnpm db:migrate             # применяем к ЛОКАЛЬНОЙ базе
# 3. проверяем приложение локально
git add apps/web/drizzle && git commit
```

На прод миграции накатываются **в сборке Vercel** и только когда
`VERCEL_ENV=production` — условие прописано в `apps/web/vercel.json`.
Превью-деплои их пропускают: у них нет `DATABASE_URL`, а если бы был,
ветка с новой миграцией меняла бы боевую схему до того, как её код
станет живым.

Накатить руками, не дожидаясь деплоя:

```bash
pnpm db:dump                       # сначала дамп, всегда
pnpm db:migrate:prod --yes
```

Без `--yes` команда не выполнится — печатает хост и останавливается.

⚠️ **Миграции только расширяющие.** Схема меняется в сборке, а новый код
становится живым через несколько секунд после неё. В этом окне работает
ещё старый код: добавить колонку безопасно, удалить или переименовать —
нет. Удаление делается в два деплоя: сначала код перестаёт читать колонку,
потом отдельной миграцией она убирается.

---

## 7. Чек-лист перед продакшеном

```
☐ HTTPS — иначе не работают ни service worker, ни установка PWA
☐ NEXT_PUBLIC_GOOGLE_CLIENT_ID задан на хостинге И проект пересобран
☐ боевой домен добавлен в Authorized JavaScript origins в Google Console
☐ иконки 192/512, maskable-512 и apple-touch-icon лежат в public/ — ✅ есть
☐ SESSION_SECRET задан на хостинге (без него прод-сборка не стартует)
☐ миграции накатаны на прод-базу: pnpm db:migrate
☐ pnpm validate проходит
☐ pnpm typecheck проходит
☐ проверено на ширине 320px (iPhone SE) — нижняя граница вёрстки
☐ проверено, что тема не моргает при загрузке
```

⚠️ Пункта про офлайн здесь больше нет. С переездом данных в Postgres
занятие офлайн не проходится: без сети приложение покажет оболочку из
кэша, но прогресс читать и писать будет нечем (`PLAN.md` D23).

---

## 8. Если что-то не работает

| Симптом | Причина |
|---|---|
| **Вёрстка разъехалась, стили не применились** | Tailwind 4 не сканирует `node_modules`, куда симлинкнут `@polski/ui`. Нужна строка `@source "../../../packages/ui/src";` в `app/globals.css` |
| **Кнопки озвучки молчат** | На устройстве нет польского голоса. macOS: Настройки → Универсальный доступ → Устный контент → Голоса → Польский. Приложение должно показать подсказку, а не промолчать |
| **Озвучка зависла** | Известная болячка Chrome: очередь встаёт, `speaking` остаётся `true`. Лечится `speechSynthesis.cancel()`. Проверить изолированно можно в `tools/tts-test.html` |
| **Кнопки Google нет** | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` пуст или проект не пересобран после его добавления |
| **`origin_mismatch` от Google** | Домен не добавлен в Authorized JavaScript origins. Порт тоже имеет значение: `localhost:3000` ≠ `localhost:3100` |
| **Тема моргает светлой при загрузке** | Не отработал блокирующий скрипт в `<head>` — он читает тему из `localStorage` синхронно, потому что ответ сервера до первого кадра не успевает |
| **503 `database_unavailable` на всех экранах** | Не задан `DATABASE_URL` либо база не поднята: `pnpm db:up` и `docker compose ps` |
| **Прогресс исчез после смены `SESSION_SECRET`** | Старая cookie больше не проходит проверку подписи. У гостя это потеря доступа к своей строке; у вошедшего через Google — нет, его найдут по `google_sub` |
| **`pnpm test` зелёный, а `pnpm typecheck` красный** | Vitest не типизирует код, он только исполняет. Строгие ошибки (`noUncheckedIndexedAccess`) ловит только `tsc`. Гонять оба |
| **`/sw.js` отдаётся с `__BUILD_ID__`** | Не отработал `scripts/stamp-sw.mjs`. Он собирает `public/sw.js` из `sw.template.js` ПЕРЕД `next build`; на Vercel для этого нужен Build Command `cd ../.. && pnpm build` |
| **После деплоя у пользователей старый кэш** | Не сменилась версия SW. На Vercel её даёт `VERCEL_GIT_COMMIT_SHA`; локально — timestamp |
| **Сборка падает на типах** | `pnpm typecheck` покажет подробности. Next правит `tsconfig.json` при первой сборке — это нормально |
