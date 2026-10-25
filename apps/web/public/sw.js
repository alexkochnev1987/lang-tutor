/* eslint-disable no-undef */
/**
 * Service worker. Написан руками — без Workbox и без плагинов к сборке.
 *
 * ПОЧЕМУ БЕЗ БИБЛИОТЕКИ.
 * Единственное, ради чего нужен плагин в сборке, — манифест прекэша с
 * хешами ассетов. Но файлы в /_next/static/ УЖЕ содержат хеш в имени,
 * то есть неизменяемы: для них достаточно cache-first с наполнением на
 * лету. Остальные URL стабильны и перечислены ниже руками.
 *
 * Плюс: сборка остаётся на Turbopack, минус 27 зависимостей, и видно,
 * что именно происходит.
 *
 * ВЕРСИЯ. Подставляется скриптом scripts/stamp-sw.mjs при сборке.
 * Без смены версии браузер не переустановит worker и не обновит кэш.
 */
const VERSION = '__BUILD_ID__'
const SHELL_CACHE = `shell-${VERSION}`
const ASSET_CACHE = `assets-${VERSION}`
const CONTENT_CACHE = `content-${VERSION}`

/** Оболочка и контент: URL стабильные, хешей нет. */
const PRECACHE = [
  '/',
  '/lesson/',
  '/progress/',
  '/offline/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/content/__COURSE_ID__/curriculum.json',
  '/content/__COURSE_ID__/vocabulary.json',
  '/content/__COURSE_ID__/grammar-rules.json',
  '/content/__COURSE_ID__/morphology.json',
  '/content/__COURSE_ID__/competencies.json',
  '/content/__COURSE_ID__/exam-spec.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // по одному, а не addAll: один недоступный файл не должен
      // отменять установку целиком
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 1. Навигация — network-first: онлайн всегда свежая страница,
  //    офлайн отдаём из кэша, в крайнем случае /offline/.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(() => caches.match(request)
          .then((hit) => hit ?? caches.match('/offline/'))
          .then((hit) => hit ?? Response.error())),
    )
    return
  }

  // 2. /_next/static/* — имя содержит хеш, значит файл неизменяем.
  //    Cache-first, манифест не нужен.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  // 3. Языковой пакет — отдаём из кэша сразу, обновляем фоном.
  if (url.pathname.startsWith('/content/')) {
    event.respondWith(staleWhileRevalidate(request, CONTENT_CACHE))
    return
  }
})

function cacheFirst(request, cacheName) {
  return caches.match(request).then((hit) => hit ?? fetch(request).then((res) => {
    if (res.ok) {
      const copy = res.clone()
      caches.open(cacheName).then((c) => c.put(request, copy))
    }
    return res
  }))
}

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((hit) => {
      const fresh = fetch(request).then((res) => {
        if (res.ok) cache.put(request, res.clone())
        return res
      }).catch(() => hit)
      return hit ?? fresh
    }))
}
