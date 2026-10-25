#!/usr/bin/env node
/**
 * Проставляет версию в service worker и копирует его в сборку.
 *
 *   node scripts/stamp-sw.mjs
 *
 * Нужно, потому что браузер переустанавливает worker только если
 * ИЗМЕНИЛСЯ его байт-в-байт контент. Без смены версии после деплоя
 * у пользователя останется старый кэш.
 *
 * Это вся «магия сборки», которая требуется для офлайна, — 30 строк
 * вместо плагина, тянущего сборку с Turbopack на webpack.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'apps/web/public/sw.js')

const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? String(Date.now())
const courseId = process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru'

const stamped = readFileSync(src, 'utf8')
  .replace(/__BUILD_ID__/g, buildId)
  .replace(/__COURSE_ID__/g, courseId)

// в out/ — то, что уедет на хостинг; в public/ плейсхолдеры остаются,
// иначе каждая сборка меняла бы файл в репозитории
const out = join(root, 'apps/web/out/sw.js')
if (existsSync(dirname(out))) {
  writeFileSync(out, stamped)
  console.log(`sw.js проштампован: version=${buildId}, курс=${courseId}`)
} else {
  console.log('out/ не найден — пропускаю (сборки ещё не было)')
}
