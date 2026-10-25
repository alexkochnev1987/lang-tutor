/**
 * Сообщения всех локалей бандлятся вместе.
 *
 * Их мало (~50 ключей), а переключение языка должно быть мгновенным и
 * работать офлайн — подгружать по сети нечего и незачем.
 * Локаль хранится в настройках, не в URL: ARCHITECTURE.md §6ter.
 */
import en from '@/messages/en.json'
import ru from '@/messages/ru.json'
import uk from '@/messages/uk.json'

export const LOCALES = ['ru', 'uk', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'ru'

export const MESSAGES = { ru, uk, en } as const

export const LOCALE_NAMES: Record<Locale, string> = {
  ru: 'Русский',
  uk: 'Українська',
  en: 'English',
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}

/** Угадать язык по браузеру, если пользователь ещё ничего не выбирал. */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.split('-')[0].toLowerCase()
    if (isLocale(base)) return base
  }
  return DEFAULT_LOCALE
}
