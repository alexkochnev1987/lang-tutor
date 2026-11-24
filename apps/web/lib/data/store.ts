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

let snapshot: AppState | nu���q�^