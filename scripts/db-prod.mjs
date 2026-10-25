#!/usr/bin/env node
/**
 * Работа с прод-базой: дамп, восстановление в локальную, миграции.
 *
 *   node scripts/db-prod.mjs dump [--schema-only]
 *   node scripts/db-prod.mjs restore <файл> [--anonymize]
 *   node scripts/db-prod.mjs migrate [--yes]
 *
 * ОТКУДА БЕРЁТСЯ СТРОКА ПОДКЛЮЧЕНИЯ.
 * Vercel помечает переменные Neon как Secret и не отдаёт их CLI
 * (`vercel env pull` вернёт заглушку). Поэтому строку нужно один раз
 * скопировать руками — Vercel → Storage → база → Connection string —
 * и положить в `.env.prod` в корне проекта. Файл в .gitignore.
 *
 *   # .env.prod
 *   DATABASE_URL=postgres://...@ep-xxx-pooler.../neondb?sslmode=require
 *   DATABASE_URL_UNPOOLED=postgres://...@ep-xxx.../neondb?sslmode=require
 *
 * ПОЧЕМУ ЧЕРЕЗ DOCKER. Локально нет ни pg_dump, ни psql, а ставить их
 * через brew — значит привязаться к версии, которая разойдётся с
 * сервером: pg_dump отказывается выгружать базу новее себя. Скрипт сам
 * спрашивает версию сервера и берёт ровно такой образ postgres.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const [cmd, ...rest] = process.argv.slice(2)
const flags = new Set(rest.filter((a) => a.startsWith('--')))
const args = rest.filter((a) => !a.startsWith('--'))

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1) }

/** Читает .env-файл в объект. Без зависимостей: формат тут простой. */
function readEnv(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const isLocal = (url) => /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url)
const hostOf = (url) => (url.match(/@([^/?]+)/)?.[1] ?? '?')

function prodEnv() {
  const env = readEnv(join(root, '.env.prod'))
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL
  if (!url) {
    die('Нет .env.prod со строкой подключения.\n'
      + '  Vercel → Storage → ваша база → Connection string → скопировать\n'
      + '  в .env.prod в корне проекта (файл уже в .gitignore):\n\n'
      + '    DATABASE_URL=postgres://...-pooler.../neondb?sslmode=require\n'
      + '    DATABASE_URL_UNPOOLED=postgres://...neon.tech/neondb?sslmode=require\n\n'
      + '  Для дампа и миграций нужна именно UNPOOLED: через пулер не\n'
      + '  работают ни выгрузка больших объёмов, ни DDL-блокировки.')
  }
  if (!env.DATABASE_URL_UNPOOLED) {
    console.warn('⚠ DATABASE_URL_UNPOOLED не задан, беру DATABASE_URL. '
      + 'Если это строка с -pooler, выгрузка может оборваться.')
  }
  return { url }
}

/**
 * Образ postgres под версию сервера. pg_dump старше сервера падает с
 * «server version mismatch», поэтому версию не угадываем, а спрашиваем.
 */
function imageFor(url) {
  const res = spawnSync('docker', [
    'run', '--rm', 'postgres:17-alpine',
    'psql', url, '-tAc', 'show server_version_num',
  ], { encoding: 'utf8' })
  if (res.status !== 0) {
    die(`Не удалось подключиться к базе.\n${(res.stderr || '').trim()}`)
  }
  const major = Math.floor(Number(res.stdout.trim()) / 10000)
  if (!major) die(`Непонятная версия сервера: ${res.stdout.trim()}`)
  return { image: `postgres:${major}-alpine`, major }
}

// ── dump ─────────────────────────────────────────────────────────────

function dump() {
  const { url } = prodEnv()
  const { image, major } = imageFor(url)
  console.log(`База: ${hostOf(url)} · PostgreSQL ${major}`)

  const dir = join(root, 'dumps')
  mkdirSync(dir, { recursive: true })
  // имя файла по времени запуска: дампы копятся, и нужно видеть порядок
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  const file = join(dir, `prod-${stamp}${flags.has('--schema-only') ? '-schema' : ''}.sql`)

  const pgArgs = [
    'pg_dump', url,
    // без владельцев и прав: восстанавливать будем под другой ролью
    '--no-owner', '--no-acl',
    // чистый формат: дамп можно прочитать глазами и положить в diff
    '--format=plain',
  ]
  if (flags.has('--schema-only')) pgArgs.push('--schema-only')

  console.log(`Выгружаю в ${file.replace(root + '/', '')} …`)
  const out = execFileSync('docker', ['run', '--rm', image, ...pgArgs], {
    maxBuffer: 1024 * 1024 * 512,
  })
  writeFileSync(file, out)

  const kb = Math.round(out.length / 1024)
  console.log(`✓ Готово: ${kb} КБ`)
  console.log('\n⚠ В дампе персональные данные пользователей (email, имя,')
  console.log('  аватар из Google). Каталог dumps/ в .gitignore — не выносите')
  console.log('  файлы наружу и не прикладывайте к задачам.')
  console.log(`\nПодложить себе локально:  pnpm db:restore ${file.replace(root + '/', '')} --anonymize`)
}

// ── restore ──────────────────────────────────────────────────────────

function restore() {
  const file = args[0] && resolve(process.cwd(), args[0])
  if (!file || !existsSync(file)) die('Укажите файл дампа: pnpm db:restore dumps/prod-….sql')

  const local = readEnv(join(root, 'apps/web/.env.local')).DATABASE_URL
  if (!local) die('В apps/web/.env.local нет DATABASE_URL')
  // Единственная по-настоящему опасная операция в этом файле — поэтому
  // цель проверяется жёстко: восстанавливать можно ТОЛЬКО в локальную базу.
  if (!isLocal(local)) {
    die(`Отказываюсь: DATABASE_URL указывает на ${hostOf(local)}, а не на localhost.\n`
      + '  Восстановление перезаписывает схему целиком. В прод — никогда.')
  }

  console.log(`Цель: ${hostOf(local)} (локальная)`)
  console.log('Сношу схему public и заливаю дамп …')

  const psql = (sql, out = 'ignore') => spawnSync('docker', [
    'exec', '-i', 'polski-b1-db', 'psql', '-U', 'polski', '-d', 'polski', '-v', 'ON_ERROR_STOP=1', '-c', sql,
  ], { stdio: ['inherit', out, 'inherit'], encoding: 'utf8' })

  // Сносим ВСЕ пользовательские схемы, а не только public: журнал
  // применённых миграций drizzle живёт в схеме `drizzle`, и если её
  // оставить, дамп упрётся в «schema already exists» на полпути.
  const r = psql(`do $$
    declare s text;
    begin
      for s in
        select nspname from pg_namespace
        where nspname not in ('information_schema', 'pg_catalog', 'pg_toast')
          and nspname not like 'pg_temp_%' and nspname not like 'pg_toast_temp_%'
      loop
        execute format('drop schema %I cascade', s);
      end loop;
      create schema public;
    end $$;`)
  if (r.status !== 0) die('Не удалось пересоздать схемы. Поднят ли контейнер? pnpm db:up')

  const load = spawnSync('docker', [
    'exec', '-i', 'polski-b1-db', 'psql', '-U', 'polski', '-d', 'polski', '-v', 'ON_ERROR_STOP=1',
  ], { stdio: [openSync(file, 'r'), 'ignore', 'inherit'] })
  if (load.status !== 0) die('Дамп залился с ошибкой')

  if (flags.has('--anonymize')) {
    // Для разработки настоящие email и имена не нужны, а утечь могут.
    const r2 = psql(`update users set
        email = case when email is null then null else 'user-' || left(id, 8) || '@example.test' end,
        name = case when name is null then null else 'Пользователь ' || left(id, 4) end,
        picture = null`)
    if (r2.status !== 0) die('Не удалось обезличить users')
    console.log('✓ Персональные данные в users затёрты')
  } else {
    console.log('⚠ Дамп залит как есть, с реальными email и именами.')
    console.log('  Для разработки лучше: pnpm db:restore <файл> --anonymize')
  }
  console.log('✓ Локальная база — копия прода')
}

// ── migrate ──────────────────────────────────────────────────────────

function migrate() {
  const { url } = prodEnv()
  console.log(`\n⚠ МИГРАЦИИ В ПРОД: ${hostOf(url)}`)
  console.log('  Применятся все неприменённые файлы из apps/web/drizzle/.')
  console.log('  Перед этим стоит снять дамп: pnpm db:dump\n')

  if (!flags.has('--yes')) {
    die('Повторите с --yes, если уверены: pnpm db:migrate:prod --yes')
  }

  const r = spawnSync('pnpm', ['--filter', '@polski/web', 'exec', 'drizzle-kit', 'migrate'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
  })
  process.exit(r.status ?? 1)
}

switch (cmd) {
  case 'dump': dump(); break
  case 'restore': restore(); break
  case 'migrate': migrate(); break
  default:
    console.log(`Команды:
  pnpm db:dump [--schema-only]        выгрузить прод-базу в dumps/
  pnpm db:restore <файл> [--anonymize]  залить дамп в локальную базу
  pnpm db:migrate:prod --yes          применить миграции к проду`)
    process.exit(cmd ? 1 : 0)
}
