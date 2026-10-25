#!/usr/bin/env node
/**
 * Кладёт языковые пакеты туда, откуда их заберёт приложение.
 *
 *   content/<courseId>/*.json  →  apps/web/public/content/<courseId>/
 *
 * Источник истины — content/. В public/ лежит копия, она в .gitignore.
 * Запускается автоматически перед dev и build.
 */
import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'content')
const dst = join(root, 'apps/web/public/content')

mkdirSync(dst, { recursive: true })
let files = 0, bytes = 0
for (const course of readdirSync(src)) {
  const from = join(src, course)
  if (!statSync(from).isDirectory()) continue
  cpSync(from, join(dst, course), { recursive: true })
  for (const f of readdirSync(from)) {
    files++
    bytes += statSync(join(from, f)).size
  }
  console.log(`  ${course}: ${readdirSync(from).length} файлов`)
}
console.log(`Контент синхронизирован: ${files} файлов, ${Math.round(bytes / 1024)} КБ`)
