#!/usr/bin/env node
/**
 * Переключает базу, которую использует локальное Next.js-приложение.
 *
 *   pnpm db:use:prod   # локальное приложение пишет в Neon/production
 *   pnpm db:use:local  # локальное приложение пишет в Docker Postgres
 *
 * Меняются только DATABASE_URL и DATABASE_URL_UNPOOLED. Остальные секреты
 * в apps/web/.env.local остаются без изменений, а файл не попадает в Git.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const localEnvPath = join(root, 'apps/web/.env.local')
const exampleEnvPath = join(root, 'apps/web/.env.example')
const prodEnvPath = join(root, '.env.prod')
const localDatabaseUrl = 'postgres://polski:polski@localhost:5433/polski'

const die = (message) => {
  console.error(`\n✖ ${message}\n`)
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
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    values[key] = value
  }
  return values
}

function setEnv(text, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${escapedKey}=.*$`, 'm')
  if (pattern.test(text)) return text.replace(pattern, line)
  return `${text.replace(/\s*$/, '')}\n${line}\n`
}

const target = process.argv[2]
if (target !== 'local' && target !== 'prod') {
  die('Использование: pnpm db:use:prod или pnpm db:use:local')
}

let databaseUrl = localDatabaseUrl
let unpooledUrl = localDatabaseUrl

if (target === 'prod') {
  const prod = readEnv(prodEnvPath)
  if (!prod.DATABASE_URL) {
    die('В корне нет DATABASE_URL в .env.prod. Добавьте строку подключения к production-базе.')
  }
  databaseUrl = prod.DATABASE_URL
  unpooledUrl = prod.DATABASE_URL_UNPOOLED || databaseUrl
}

let localEnv = existsSync(localEnvPath)
  ? readFileSync(localEnvPath, 'utf8')
  : readFileSync(exampleEnvPath, 'utf8')
localEnv = setEnv(localEnv, 'DATABASE_URL', databaseUrl)
localEnv = setEnv(localEnv, 'DATABASE_URL_UNPOOLED', unpooledUrl)
writeFileSync(localEnvPath, localEnv, { encoding: 'utf8', mode: 0o600 })
chmodSync(localEnvPath, 0o600)

console.log(target === 'prod'
  ? '✓ Локальное приложение теперь использует production-базу.'
  : '✓ Локальное приложение теперь использует Docker Postgres.')
console.log('Перезапустите pnpm dev, чтобы Next.js перечитал переменные окружения.')
