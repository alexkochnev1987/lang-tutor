/**
 * Подключение к Postgres.
 *
 * Два драйвера, один и тот же Drizzle-API поверх:
 *
 *   прод (Vercel + Neon) — `@neondatabase/serverless` по HTTP. В
 *     serverless-функции обычного TCP-пула нет: соединение не переживает
 *     заморозку инстанса, и каждый вызов открывал бы новое;
 *   локально — обычный `pg` поверх TCP, чтобы поднять базу в Docker и
 *     гонять ровно ту же сборку, что уедет в прод, без интернета.
 *
 * Выбор по хосту в DATABASE_URL, а не по NODE_ENV: `next start` локально
 * — это тоже прод-сборка, но база при этом локальная.
 */
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { neon } from '@neondatabase/serverless'
import { Pool } from 'pg'
import * as schema from './schema'

const url = process.env.DATABASE_URL

if (!url) {
  // Падаем громко и с инструкцией: пустой DATABASE_URL иначе превращается
  // в невнятную ошибку соединения где-то в середине запроса.
  throw new Error(
    'DATABASE_URL не задан. Локально: docker compose up -d и скопировать ' +
    'строку из .env.example. На Vercel: подключить Neon через Storage.',
  )
}

const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url)

/**
 * В dev Next перезагружает модули на каждое изменение — без кеша в
 * globalThis пул соединений пересоздавался бы и исчерпал лимит Postgres.
 */
const g = globalThis as typeof globalThis & { __pgPool?: Pool }

export const pg = isLocal
  ? drizzlePg(g.__pgPool ??= new Pool({ connectionString: url, max: 5 }), { schema })
  : drizzleNeon(neon(url), { schema })

export { schema }
