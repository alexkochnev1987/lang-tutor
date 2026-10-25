'use client'

import { useEffect } from 'react'

/**
 * Регистрация service worker.
 *
 * Раньше это делал за нас плагин Serwist. Восемь строк — приемлемая
 * цена за то, чтобы сборка осталась на Turbopack и в зависимостях не
 * висело 27 лишних пакетов.
 *
 * В dev не регистрируем: кэш перебивает hot reload.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    // ждём load: регистрация не должна конкурировать за сеть
    // с загрузкой первой страницы
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* офлайн не заработает, но приложение — да */
      })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])
  return null
}
