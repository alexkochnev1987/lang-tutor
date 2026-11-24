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
import { studyDayKey } from './study-day'
import type { ProfileName } from './profile-name'
import { brainstormWordSession, projectDailyWordQueue, type DailyWordAnswer, type DailyWordQueue, type DailyWordSubmission } from '@/lib/engine/daily-words'
import {
  DEFAULT_SETTINGS,
  type AppState, type ExerciseResultRow, type LessonSessionRow, type LexemeStatusRow, type PersonalWordRow,
  type RuleMasteryRow, type SessionUser, type Settings, type StudyItemRow,
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
  const settings = { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) }
  const budget = r.settings?.dailyBudgetMinutes ?? r.course?.dailyBudgetMinutes
  settings.dailyBudgetMinutes = typeof budget === 'number' && Number.isInteger(budget) && budget >= 5 && budget <= 90
    ? budget
    : DEFAULT_SETTINGS.dailyBudgetMinutes
  for (const [field, max] of [['newWordsPerDay', 10], ['grammarExercisesPerDay', 20]] as const) {
    if (!Number.isInteger(settings[field]) || settings[field] < 0 || settings[field] > max) {
      settings[field] = DEFAULT_SETTINGS[field]
    }
  }
  const validFormats: Settings['grammarLessonFormats'] = ['choice', 'typed', 'write']
  settings.grammarLessonFormats = Array.isArray(settings.grammarLessonFormats)
    && settings.grammarLessonFormats.length > 0
    && new Set(settings.grammarLessonFormats).size === settings.grammarLessonFormats.length
    && settings.grammarLessonFormats.every((format) => validFormats.includes(format))
    ? settings.grammarLessonFormats
    : [...DEFAULT_SETTINGS.grammarLessonFormats]
  if (!Number.isFinite(settings.ttsRate) || settings.ttsRate < 0.5 || settings.ttsRate > 1.5) {
    settings.ttsRate = DEFAULT_SETTINGS.ttsRate
  }
  return {
    user: r.user,
    settings,
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
    exerciseResults: (r.exerciseResults ?? []).map((result) => ({
      ...result,
      correct: Boolean(result.correct),
      completedAt: date(result.completedAt),
    })),
    readiness: (r.readiness ?? []).map((m) => ({
      ...m, lastMockAt: maybeDate(m.lastMockAt),
    })),
    sessions: (r.sessions ?? []).map((s) => ({
      ...s, startedAt: date(s.startedAt), completedAt: maybeDate(s.completedAt),
    })),
    personalDict: (r.personalDict ?? []).map((w) => ({ ...w, createdAt: date(w.createdAt) })),
    lexemeStatus: (r.lexemeStatus ?? []).map((l) => ({ ...l, markedAt: date(l.markedAt) })),
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
  const pending: Promise<AppState> = request<Record<string, unknown>>('/api/state/')
    .then((raw) => {
      // A refresh after an account change supersedes older requests.
      if (inflight !== pending) {
        if (inflight) return inflight
        if (snapshot) return snapshot
        throw new Error('state_request_superseded')
      }
      snapshot = parse(raw)
      emit()
      return snapshot
    })
    .finally(() => { if (inflight === pending) inflight = null })
  inflight = pending
  return pending
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
  if (!snapshot && !inflight) void loadState().catch((error) => console.error('[state]', error))
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

export function getSettings(): Settings {
  return snapshot?.settings ?? DEFAULT_SETTINGS
}

// ── запись ───────────────────────────────────────────────────────────

export async function saveSettings(p: Partial<Settings>): Promise<void> {
  await request('/api/settings/', { method: 'PATCH', body: JSON.stringify(p) })
  if (p.timeZone && p.timeZone !== snapshot?.settings.timeZone) invalidateDailyWords()
  patch((s) => ({ ...s, settings: { ...s.settings, ...p } }))
  // Зеркало в localStorage: тема и язык нужны СИНХРОННО до первой
  // отрисовки, иначе экран моргнёт (UX_UI.md §1.8). Сеть этого не успеет.
  try {
    if (p.theme) localStorage.setItem('theme', p.theme)
    if (p.uiLanguage) localStorage.setItem('uiLanguage', p.uiLanguage)
  } catch { /* приватный режим */ }
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
    if (p.item.kind.startsWith('lexeme-')) publishDailyWordsChange(p.log?.id ?? crypto.randomUUID())
  } catch (e) {
    console.error('[answer]', e)
    void refresh()
  }
}

/** Confirms the date before replacing the previously saved schedule in the UI. */
export async function saveScheduledReview(payload: AnswerPayload): Promise<boolean> {
  try {
    await request('/api/answer/', { method: 'POST', body: JSON.stringify(payload) })
  } catch (error) {
    console.error('[answer]', error)
    return false
  }

  const item = payload.item
  patch((state) => {
    const previous = state.studyItems.find((row) => row.id === item.id)
    if (previous?.lastReview && (!item.lastReview || previous.lastReview > item.lastReview)) return state
    return { ...state, studyItems: [...state.studyItems.filter((row) => row.id !== item.id), item] }
  })
  if (item.kind.startsWith('lexeme-')) publishDailyWordsChange(payload.log?.id ?? crypto.randomUUID())
  return true
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

export async function saveLessonSession(s: LessonSessionRow): Promise<boolean> {
  patch((prev) => ({ ...prev, sessions: [...prev.sessions.filter((session) => session.id !== s.id), s] }))
  try {
    await request('/api/lesson/', { method: 'POST', body: JSON.stringify(s) })
    return true
  } catch (e) {
    console.error('[lesson]', e)
    void refresh().catch((error) => console.error('[state]', error))
    return false
  }
}

export async function setLexemeKnown(lexemeId: string, known: boolean): Promise<void> {
  const row: LexemeStatusRow = {
    lexemeId, status: known ? 'known' : 'active', markedAt: new Date(),
  }
  patch((s) => ({
    ...s,
    lexemeStatus: [...s.lexemeStatus.filter((l) => l.lexemeId !== lexemeId), row],
  }))
  try {
    await request('/api/lexeme/', { method: 'POST', body: JSON.stringify(row) })
    publishDailyWordsChange(crypto.randomUUID())
  } catch (e) {
    console.error('[lexeme]', e)
    void refresh()
  }
}

export async function savePersonalWord(input: Omit<PersonalWordRow, 'id' | 'createdAt'>): Promise<boolean> {
  const row: PersonalWordRow = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  }
  patch((s) => ({
    ...s,
    personalDict: [
      row,
      ...s.personalDict.filter((word) => word.lemma.toLocaleLowerCase() !== row.lemma.toLocaleLowerCase()),
    ],
  }))
  try {
    await request('/api/personal-dict/', {
      method: 'POST',
      body: JSON.stringify(row),
    })
    return true
  } catch (e) {
    console.error('[personal-dict]', e)
    void refresh()
    return false
  }
}

const COURSE_ID = process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru'

export async function saveExerciseResult(input: Omit<ExerciseResultRow, 'courseId' | 'completedAt'>): Promise<boolean> {
  const row: ExerciseResultRow = {
    ...input,
    courseId: COURSE_ID,
    completedAt: new Date(),
  }
  patch((s) => ({
    ...s,
    exerciseResults: [
      ...s.exerciseResults.filter((result) => (
        result.dayNumber !== row.dayNumber || result.exerciseId !== row.exerciseId
      )),
      row,
    ],
  }))
  try {
    await request('/api/exercise-result/', {
      method: 'POST',
      body: JSON.stringify(row),
    })
    return true
  } catch (e) {
    console.error('[exercise-result]', e)
    void refresh()
    return false
  }
}

export async function resetExerciseResults(dayNumber: number, exerciseIds: string[]): Promise<boolean> {
  const ids = new Set(exerciseIds)
  patch((s) => ({
    ...s,
    exerciseResults: s.exerciseResults.filter((result) => (
      result.dayNumber !== dayNumber || !ids.has(result.exerciseId)
    )),
  }))
  try {
    await request('/api/exercise-result/', {
      method: 'DELETE',
      body: JSON.stringify({ dayNumber, exerciseIds }),
    })
    return true
  } catch (e) {
    console.error('[exercise-result-reset]', e)
    void refresh()
    return false
  }
}

export function knownLexemeIds(state: AppState | null): ReadonlySet<string> {
  return new Set(
    (state?.lexemeStatus ?? []).filter((l) => l.status === 'known').map((l) => l.lexemeId))
}

export async function saveProfileName(name: ProfileName): Promise<void> {
  const updated = await request<Pick<SessionUser, 'id' | 'name' | 'firstName' | 'lastName'>>('/api/profile/', {
    method: 'PATCH',
    body: JSON.stringify(name),
  })
  patch((state) => state.user.id === updated.id
    ? { ...state, user: { ...state.user, ...updated } }
    : state)
}

export async function signInWithGoogle(idToken: string): Promise<void> {
  const { userId } = await request<{ userId: string }>('/api/auth/google/', {
    method: 'POST', body: JSON.stringify({ idToken }),
  })
  invalidateDailyWords()
  if (snapshot && snapshot.user.id !== userId) {
    snapshot = null
    emit()
  }
  await refresh()
}

export async function signOut(): Promise<void> {
  await request('/api/auth/signout/', { method: 'POST' })
  invalidateDailyWords()
  snapshot = null
  emit()
  await refresh()
}

const DAILY_WORD_EVENT = 'daily-words-changed'
const DAILY_WORD_REVISION = 'daily-words-revision'

function publishDailyWordsChange(revision: string) {
  invalidateDailyWords()
  window.dispatchEvent(new Event(DAILY_WORD_EVENT))
  try { localStorage.setItem(DAILY_WORD_REVISION, revision) } catch { /* Storage may be disabled. */ }
}

export function subscribeDailyWords(listener: () => void) {
  function syncTabs(event: StorageEvent) {
    if (event.key === DAILY_WORD_REVISION) {
      invalidateDailyWords()
      listener()
    }
  }
  window.addEventListener(DAILY_WORD_EVENT, listener)
  window.addEventListener('storage', syncTabs)
  window.addEventListener('focus', listener)
  return () => {
    window.removeEventListener(DAILY_WORD_EVENT, listener)
    window.removeEventListener('storage', syncTabs)
    window.removeEventListener('focus', listener)
  }
}

let dailyQueueRequest: Promise<DailyWordQueue> | null = null
let dailyQueueSnapshot: { userId: string; timeZone: string; queue: DailyWordQueue } | null = null
const pendingQueueAnswers = new Map<string, { userId: string; answers: DailyWordAnswer[] }>()
let nextReviewTimer: ReturnType<typeof setTimeout> | null = null

function clearNextReviewTimer() {
  if (nextReviewTimer !== null) clearTimeout(nextReviewTimer)
  nextReviewTimer = null
}

function invalidateDailyWords() {
  clearNextReviewTimer()
  dailyQueueRequest = null
  dailyQueueSnapshot = null
}

function scheduleNextReview(queue: DailyWordQueue) {
  clearNextReviewTimer()
  if (!queue.nextReviewAt) return
  const dueAt = Date.parse(queue.nextReviewAt)
  if (!Number.isFinite(dueAt)) return
  // Offset past the due boundary to avoid clock precision / request races.
  const delay = Math.max(1000, dueAt - Date.now() + 500)
  nextReviewTimer = setTimeout(() => {
    invalidateDailyWords()
    window.dispatchEvent(new Event(DAILY_WORD_EVENT))
  }, Math.min(delay, 2_147_483_647))
}

export function getCachedDailyWords(): DailyWordQueue | null {
  if (!snapshot || !dailyQueueSnapshot) return null
  const { userId, timeZone, queue } = dailyQueueSnapshot
  return snapshot.user.id === userId
    && snapshot.settings.timeZone === timeZone
    && queue.day === studyDayKey(timeZone)
    ? [...pendingQueueAnswers.values()].filter((entry) => entry.userId === userId).reduce((value, entry) => projectDailyWordQueue(value, entry.answers), queue) : null
}

export function loadDailyWords() {
  const projected = getCachedDailyWords()
  if (projected && [...pendingQueueAnswers.values()].some((entry) => entry.userId === snapshot?.user.id)) return Promise.resolve(projected)
  if (dailyQueueRequest) return dailyQueueRequest
  const pending = loadState().then(async ({ user, settings }) => {
    const queue = await request<DailyWordQueue>('/api/daily-words/', { cache: 'no-store' })
    if (dailyQueueRequest === pending && snapshot?.user.id === user.id &&
      snapshot.settings.timeZone === settings.timeZone) {
      dailyQueueSnapshot = { userId: user.id, timeZone: settings.timeZone, queue }
      scheduleNextReview(queue)
    }
    return getCachedDailyWords() ?? queue
  }).finally(() => { if (dailyQueueRequest === pending) dailyQueueRequest = null })
  dailyQueueRequest = pending
  return pending
}

export async function saveDailyWordAnswer(payload: DailyWordSubmission) {
  const submitted = payload.format === 'brainstorm' ? payload.answers : [payload]
  const key = submitted[0]!.log.id
  const userId = snapshot?.user.id
  if (userId) {
    pendingQueueAnswers.set(key, { userId, answers: submitted })
    window.dispatchEvent(new Event(DAILY_WORD_EVENT))
  }
  let response: { answeredAt: string | null; acceptedLogIds?: string[] }
  try {
    response = await request<typeof response>('/api/daily-words/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch (error) {
    pendingQueueAnswers.delete(key)
    publishDailyWordsChange(key)
    throw error
  }
  pendingQueueAnswers.delete(key)
  const { answeredAt, acceptedLogIds } = response
  const answers = acceptedLogIds ? submitted.filter(({ log }) => acceptedLogIds.includes(log.id)) : submitted
  if (!answeredAt || !answers.length || (userId && snapshot?.user.id !== userId)) {
    publishDailyWordsChange(key)
    return false
  }
  const completedAt = new Date(answeredAt)
  const currentItems = new Map(answers.map(({ item, log }) => [item.id, {
    ...item,
    due: new Date(completedAt.getTime() + Math.max(0, item.due.getTime() - log.reviewedAt.getTime())),
    lastReview: completedAt,
  }]))
  const results = answers.map(({ result }) => ({ ...result, courseId: COURSE_ID, completedAt }))
  const wordSession = payload.format === 'brainstorm' ? brainstormWordSession({ ...payload, answers }) : null
  patch((state) => {
    const studyItems = state.studyItems.filter((row) => {
      if (!currentItems.has(row.id)) return true
      if (row.lastReview && row.lastReview > completedAt) {
        currentItems.delete(row.id)
        return true
      }
      return false
    })
    return {
      ...state,
      studyItems: [...studyItems, ...currentItems.values()],
      sessions: wordSession ? [
        ...state.sessions.filter(({ id }) => id !== wordSession.id),
        { ...wordSession, completedAt, actualMs: Math.max(0, completedAt.getTime() - wordSession.startedAt.getTime()) },
      ] : state.sessions,
      exerciseResults: [...state.exerciseResults.filter((row) =>
        !results.some((result) => row.dayNumber === result.dayNumber && row.exerciseId === result.exerciseId)),
      ...results],
    }
  })
  publishDailyWordsChange(answers[0]!.log.id)
  return true
}
