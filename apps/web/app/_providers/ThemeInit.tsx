'use client'

import { useEffect } from 'react'
import { initTheme } from '@/lib/theme'

/**
 * Досинхронизирует тему после гидратации и подписывается на смену
 * системной настройки. Первичную отрисовку делает ThemeScript.
 */
export function ThemeInit() {
  useEffect(() => { initTheme() }, [])
  return null
}
