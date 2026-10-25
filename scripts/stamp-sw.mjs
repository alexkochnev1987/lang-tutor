#!/usr/bin/env node
/**
 * Собирает service worker из шаблона: подставляет версию и курс.
 *
 *   node scripts/stamp-sw.mjs
 *
 * Запускается ПЕРЕД `next build` и перед `next dev`:
 *   apps/web/public/sw.template.js  →  apps/web/public/sw.js
 *
 * Почему из шаблона, а не правкой файла на месте: `public/sw.js` попадает
 * в сборку как есть, и если штамповать после `next build`, в выдачу уедет
 * файл с плейсхолдерами. А держать в репозитории файл с подставленным
 * build id нельзя — он менялся бы от каждой сборки. Поэтому результат
 * в .gitignore, в репозитории живёт только шаблон.
 *
 * Без смены VERSION браузер не переустановит worker и не обновит кэш.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'apps/web/public/sw.template.js')
const dst = join(root, 'apps/web/public/sw.js')

// на Vercel — хеш коммита, локально — время сборки
const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? String(Date.now())
const courseId = process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru'

const stamped = readFileSync(src, 'utf8')
  .replace(/__BUILD_ID__/g, buildId)
  .replace(/__COURSE_ID__/g, courseId)

if (stamped.includes('__BUILD_ID__') || stamped.includes('__COURSE_ID__')) {
  console.error('sw: плейсхолдеры остались незаполненными')
  process.exit(1)
}

writeFileSync(dst, stamped)
console.log(`sw.js собран: version=${buildId}, курс=${courseId}`)
