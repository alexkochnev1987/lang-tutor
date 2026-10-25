/**
 * Тема приложения: какая палитра и светлая/тёмная.
 *
 * Состояние живёт в двух атрибутах на <html>:
 *   data-palette="graphite"   — выбирает блок в theme/palettes.css
 *   data-mode="light|dark"    — уже РАЗРЕШЁННАЯ тема
 *
 * Пользователь может выбрать "system" — тогда мы сами слушаем
 * matchMedia и пишем в data-mode итог. Благодаря этому тёмный набор
 * в tokens.css описан один раз, без дублей в @media.
 *
 * Цвет шапки браузера (meta theme-color) не задаётся вручную: он
 * считывается из активного токена --head, поэтому новая палитра
 * получает его автоматически.
 *
 * Хранилище: localStorage, а не IndexedDB. Тема должна примениться
 * ДО первой отрисовки, а IndexedDB асинхронна и не успевает —
 * иначе вспышка светлой темы. UX_UI.md §1.8
 */
import { create } from 'zustand'

export interface Palette {
  id: string
  name: string
  /** три цвета для кружков в переключателе: шапка, акцент, фон */
  dots: readonly [string, string, string]
}

export const PALETTES = [
  { id: 'graphite', name: 'Графит и коралл', dots: ['#1d1d20', '#ff5a5f', '#fafaf9'] },
  { id: 'indigo',   name: 'Индиго и мята',   dots: ['#4f46e5', '#10b981', '#f6f7fb'] },
  { id: 'teal',     name: 'Тил и песок',     dots: ['#0d9488', '#f97316', '#fbf7f0'] },
  { id: 'violet',   name: 'Ночной фиолет',   dots: ['#7c3aed', '#22d3ee', '#f8f6ff'] },
  { id: 'blue',     name: 'Синий и лайм',    dots: ['#1e3a8a', '#84cc16', '#f4f6fa'] },
  { id: 'plum',     name: 'Слива и персик',  dots: ['#6b2d5c', '#f6a07a', '#fdf6f3'] },
  { id: 'leaf',     name: 'Зелёная',         dots: ['#16a34a', '#f59e0b', '#f7faf5'] },
] as const satisfies readonly Palette[]

export type PaletteId = (typeof PALETTES)[number]['id']
export type ModePref = 'light' | 'dark' | 'system'

export const DEFAULT_PALETTE: PaletteId = 'graphite'
export const DEFAULT_MODE: ModePref = 'system'

/** Те же ключи читает блокирующий скрипт в <head>. */
export const STORAGE = {
  palette: 'polski.palette', mode: 'polski.mode',
} as const

const MODES: ModePref[] = ['light', 'dark', 'system']

function isPaletteId(v: unknown): v is PaletteId {
  return PALETTES.some((p) => p.id === v)
}

function read<T>(key: string, ok: (v: unknown) => v is T, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const v = localStorage.getItem(key)
    return ok(v) ? v : fallback
  } catch {
    return fallback // приватный режим / заблокированные куки
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* не критично: тема просто не переживёт перезагрузку */
  }
}

const darkQuery = () =>
  typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null

export function resolveMode(pref: ModePref): 'light' | 'dark' {
  if (pref !== 'system') return pref
  return darkQuery()?.matches ? 'dark' : 'light'
}

/** Красит шапку браузера в цвет, который палитра дала токену --head. */
function syncThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) return
  const head = getComputedStyle(document.documentElement).getPropertyValue('--head').trim()
  if (head) meta.content = head
}

export function applyTheme(palette: PaletteId, pref: ModePref) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.palette = palette
  root.dataset.mode = resolveMode(pref)
  syncThemeColor()
}

interface ThemeState {
  palette: PaletteId
  /** что выбрал пользователь (включая "system") */
  mode: ModePref
  setPalette: (id: PaletteId) => void
  setMode: (m: ModePref) => void
}

export const useTheme = create<ThemeState>((set, get) => ({
  palette: read(STORAGE.palette, isPaletteId, DEFAULT_PALETTE),
  mode: read(STORAGE.mode, (v): v is ModePref => MODES.includes(v as ModePref), DEFAULT_MODE),
  setPalette: (palette) => {
    write(STORAGE.palette, palette)
    applyTheme(palette, get().mode)
    set({ palette })
  },
  setMode: (mode) => {
    write(STORAGE.mode, mode)
    applyTheme(get().palette, mode)
    set({ mode })
  },
}))

/** Вызывается один раз при монтировании приложения. */
export function initTheme() {
  const { palette, mode } = useTheme.getState()
  applyTheme(palette, mode)

  // пока выбран "system" — следим за настройкой ОС
  darkQuery()?.addEventListener('change', () => {
    const s = useTheme.getState()
    if (s.mode === 'system') applyTheme(s.palette, s.mode)
  })
}
