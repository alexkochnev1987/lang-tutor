import type { Config } from 'drizzle-kit'

/**
 * Миграции.
 *
 * Для миграций нужен прямой (unpooled) доступ: pooler Neon не держит
 * сессионные блокировки, на которых строится DDL. Локально unpooled-строки
 * нет — берём обычную.
 */
export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
} satisfies Config
