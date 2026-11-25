#!/usr/bin/env node
/**
 * Кладёт языковые пакеты туда, откуда их заберёт приложение.
 *
 *   content/<courseId>/*.json  →  apps/web/public/content/<courseId>/
 *
 * Источник истины — content/. В public/ лежит копия, она в .gitignore.
 * Запускается автоматически перед dev и build.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, dirname, join } from 'node:path'
import { packSentenceCorpus } from './pack-sentence-corpus.mjs'
import { packReadingContent, readingPreviewEnabled } from './pack-reading.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'content')
const dst = join(root, 'apps/web/public/content')

mkdirSync(dst, { recursive: true })
let files = 0, bytes = 0
for (const course of readdirSync(src)) {
  const from = join(src, course)
  if (!statSync(from).isDirectory()) continue
  const target = join(dst, course)
  const corpus = join(from, 'sentence-corpus.json')
  cpSync(from, target, { recursive: true, filter: (source) => !['sentence-corpus.json', 'reading', 'reading-preview'].includes(basename(source)) })
  rmSync(join(target, 'sentence-corpus.json'), { force: true })
  if (existsSync(corpus)) packSentenceCorpus(from, target)
  const reading = packReadingContent(from, target, {
    preview: course === 'pl-b1-ru' && readingPreviewEnabled(),
    draftDir: join(root, 'scripts/reading-drafts'),
  })
  console.log(`  reading: ${reading.live} live, ${reading.preview} experimental`)
  for (const f of readdirSync(from)) {
    files++
    bytes += statSync(join(from, f)).size
  }
  console.log(`  ${course}: ${readdirSync(from).length} файлов`)
}
console.log(`Контент синхронизирован: ${files} файлов, ${Math.round(bytes / 1024)} КБ`)
