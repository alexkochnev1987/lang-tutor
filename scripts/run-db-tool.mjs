#!/usr/bin/env node
/** Запускает drizzle-kit с переменными из apps/web/.env.local. */
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, 'apps/web/.env.local')
const command = process.argv[2]
const args = process.argv.slice(3)

if (!command) {
  console.error('✖ Укажите команду drizzle-kit: migrate или studio')
  process.exit(1)
}

function readEnv(path) {
  if (!existsSync(path)) return {}
  const values = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 0) continue
    const key = trimmed.slice(0, separator).trim()
    values[key] = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
  }
  return values
}

const env = readEnv(envPath)
if (!env.DATABASE_URL && !env.DATABASE_URL_UNPOOLED) {
  console.error('✖ В apps/web/.env.local нет DATABASE_URL. Выполните pnpm db:use:local или pnpm db:use:prod.')
  process.exit(1)
}

const result = spawnSync(
  'pnpm',
  ['--filter', '@polski/web', 'exec', 'drizzle-kit', command, ...args],
  { cwd: root, env: { ...process.env, ...env }, stdio: 'inherit' },
)

if (result.error) {
  console.error(`✖ Не удалось запустить drizzle-kit: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
