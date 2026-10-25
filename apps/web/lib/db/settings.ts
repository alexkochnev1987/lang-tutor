/**
 * Настройки пользователя.
 *
 * R12 из DEV_RULES.md: чтение НИКОГДА не пишет в БД. Дефолты возвращаются
 * из памяти — иначе useLiveQuery упадёт с ReadOnlyError и уронит всё дерево.
 */
import { db } from './dexie'

export interface Settings {
  uiLanguage: string      // язык интерфейса (i18n)
  sourceLanguage: string  // язык переводов слов — может отличаться от UI
  theme: 'light' | 'dark' | 'system'
  dailyBudgetMinutes: number
  ttsVoiceURI: string | null
  ttsRate: number
}

export const DEFAULT_SETTINGS: Settings = {
  uiLanguage: 'ru',
  sourceLanguage: 'ru',
  theme: 'system',
  dailyBudgetMinutes: 15,
  ttsVoiceURI: null,
  ttsRate: 0.95,
}

/** Только чтение. Безопасно вызывать из useLiveQuery. */
export async function readSettings(): Promise<Settings> {
  const rows = await db.settings.toArray()
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { ...DEFAULT_SETTINGS, ...stored } as Settings
}

/** Запись — только из обработчиков событий, не из querier. */
export async function writeSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Promise<void> {
  await db.settings.put({ key, value })
  // Зеркало в localStorage: нужно синхронно до первой отрисовки.
  // IndexedDB асинхронна и не успевает — тема моргнёт. UX_UI.md §1.8
  if (key === 'theme' || key === 'uiLanguage') {
    try { localStorage.setItem(key, String(value)) } catch { /* приватный режим */ }
  }
}
