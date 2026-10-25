'use client'

/**
 * Состояние пользователя на клиенте.
 *
 * Раньше эту роль играл Dexie с `useLiveQuery`: любой компонент читал
 * IndexedDB и сам перерисовывался на изменение. Теперь источник истины —
 * Postgres, поэтому состояние грузится одним запросом `GET /api/state`
 * и живёт в памяти, а подписка сделана на `useSyncExternalStore`.
 *
 * Запись всегда идёт двумя шагами: сначала правим снапшот в памяти
 * (экран отвечает мгновенно), затем отправляем на сервер. Если запрос
 * не прошёл — перечитываем состояние, чтобы на экране не осталось
 * того, чего в базе нет.
 */
import { useSyncExternalStore } from 'react'
import {
  DEFAULT_SETTINGS,
  type AppState, type LessonSessionRow, type RuleMasteryRow,
  type Settings, type StudyItemRow,
} from './types'

let snapshot: AppState | null = null
let inflight: Promise<AppState> | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

const date = (v: unknown): Date => new Date(v as string)
const maybeDate = (v: unknown): Date | null => (v ? new Date(v as string) : null)

/** Разбор ISO-строк в Date. Один раз на границе сети — дальше только Date. */
function parse(raw: Record<string, unknown>): AppState {
  const r = raw as never as AppState & Record<string, never>
  return {
    user: r.user,
    settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
    course: r.course
      ? {
          ...r.course,
          startedAt: date(r.course.startedAt),
          targetExamDate: maybeDate(r.course.targetExamDate),
        }
      : null,
    studyItems: (r.studyItems ?? []).map((i) => ({
      ...i, due: date(i.due), lastReview: maybeDate(i.lastReview),
    })),
    mastery: (r.mastery ?? []).map((m) => ({
      ...m, lastPracticedAt: maybeDate(m.lastPracticedAt),
    })),
    readiness: (r.readiness ?? []).map((m) => ({
      ...m, lastMockAt: maybeDate(m.lastMockAt),
    })),
    sessions: (r.sessions ?? []).map((s) => ({
      ...s, startedAt: date(s.startedAt), completedAt: maybeDate(s.completedAt),
    })),
    personalDict: (r.personalDict ?? []).map((w) => ({ ...w, createdAt: date(w.createdAt) })),
  }
}

/**
 * Все пути — со слэшем на конце: `trailingSlash: true` в next.config
 * иначе отвечает 308 и каждый запрос идёт в два захода.
 */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(body.message ?? `${init?.method ?? 'GET'} ${url} → ${res.status}`)
  }
  return res.json() as Promise<T>
}

/**
 * Состояние пользователя. Параллельные вызовы делят один запрос:
 * экран «Сегодня» и шапка стартуют одновременно, запрос нужен один.
 */
export function loadState(force = false): Promise<AppState> {
  if (!force && snapshot) return Promise.resolve(snapshot)
  if (!force && inflight) return inflight
  inflight = request<Record<string, unknown>>('/api/state/')
    .then((raw) => { snapshot = parse(raw); emit(); return snapshot })
    .finally(() => { inflight = null })
  return inflight
}

export const refresh = (): Promise<AppState> => loadState(true)

/** Локальная правка снапшота: экран не ждёт ответа сервера. */
function patch(fn: (s: AppState) => AppState): void {
  if (!snapshot) return
  snapshot = fn(snapshot)
  emit()
}

// ── подписка для React ───────────────────────────────────────────────

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  if (!snapshot && !inflight) void loadState()
  return () => { listeners.delete(cb) }
}

const getSnapshot = (): AppState | null => snapshot
// на сервере снапшота нет никогда: состояние зависит от cookie
const getServerSnapshot = (): AppState | null => null

/** null, пока состояние не загрузилось. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useSettings(): Settings {
  return useAppState()?.settings ?? DEFAULT_SETTINGS
}

// ── запись ───────────────────────────────────────────────────────────

export async function saveSettings(p: Partial<Settings>): Promise<void> {
  patch((s) => ({ ...s, settings: { ...s.settings, ...p } }))
  // Зеркало в localStorage: тема и язык нужны СИНХРОННО до первой
  // отрисовки, иначе экран моргнёт (UX_UI.md §1.8). Сеть этого не успеет.
  try {
    if (p.theme) localStorage.setItem('theme', p.theme)
    if (p.uiLanguage) localStorage.setItem('uiLanguage', p.uiLanguage)
  } catch { /* приватный режим */ }
  await request('/api/settings/', { method: 'PATCH', body: JSON.stringify(p) })
}

export async function startCourse(
  entryTrack: 'a0' | 'a2' | 'b1-minus',
  dailyBudgetMinutes = 15,
): Promise<void> {
  await request('/api/course/', {
    method: 'POST',
    body: JSON.stringify({ entryTrack, dailyBudgetMinutes }),
  })
  await refresh()
}

export interface AnswerPayload {
  item: StudyItemRow
  log?: {
    id: string; studyItemId: string; rating: number; state: number
    stability: number; difficulty: number
    elapsedDays: number; scheduledDays: number
    reviewedAt: Date; exerciseId?: string; responseMs?: number
  }
  mastery?: RuleMasteryRow
}

/**
 * Ответ на упражнение. Экран не ждёт сервер: сначала правим снапшот,
 * потом отправляем. Провал запроса не должен ломать занятие — только
 * перечитываем состояние.
 */
export async function saveAnswer(p: AnswerPayload): Promise<void> {
  patch((s) => ({
    ...s,
    studyItems: [...s.studyItems.filter((i) => i.id !== p.item.id), p.item],
    mastery: p.mastery
      ? [...s.mastery.filter((m) => m.grammarRuleId !== p.mastery!.grammarRuleId), p.mastery]
      : s.mastery,
  }))
  try {
    await request('/api/answer/', { method: 'POST', body: JSON.stringify(p) })
  } catch (e) {
    console.error('[answer]', e)
    void refresh()
  }
}

/** Попытка по грамматическому правилу: карточка FSRS тут ни при чём. */
export async function saveMastery(m: RuleMasteryRow): Promise<void> {
  patch((s) => ({
    ...s,
    mastery: [...s.mastery.filter((x) => x.grammarRuleId !== m.grammarRuleId), m],
  }))
  try {
    await request('/api/answer/', { method: 'POST', body: JSON.stringify({ mastery: m }) })
  } catch (e) {
    console.error('[mastery]', e)
    void refresh()
  }
}

export async function saveLessonSession(s: LessonSessionRow): Promise<void> {
  patch((prev) => ({ ...prev, sessions: [...prev.sessions, s] }))
  try {
    await request('/api/lesson/', { method: 'POST', body: JSON.stringify(s) })
  } catch (e) {
    console.error('[lesson]', e)
    void refresh()
  }
}

export async function signInWithGoogle(idToken: string): Promise<void> {
  await request('/api/auth/google/', { method: 'POST', body: JSON.stringify({ idToken }) })
  await refresh()
}

export async function signOut(): Promise<void> {
  await request('/api/auth/signout/', { method: 'POST' })
  await refresh()
}
