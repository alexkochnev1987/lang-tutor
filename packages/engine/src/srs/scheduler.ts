/**
 * Обёртка над ts-fsrs@5.4.2 — лексика и декларативные карточки правил.
 *
 * Грамматика КАК НАВЫК здесь не живёт: для неё отдельная модель в
 * ../mastery. Обоснование — RESEARCH.md §7.3.
 */
import {
  createEmptyCard, fsrs, generatorParameters, Rating, State,
  type Card, type FSRS, type Grade, type RecordLogItem,
} from 'ts-fsrs'
import { REVIEW_COST_SEC, type StudyItem, type StudyItemKind } from '../types'

export { Rating, State }
export type { Card, Grade }

export interface SchedulerOptions {
  /** Целевая вероятность вспомнить. 0.9 — стандарт, выше = больше повторов */
  requestRetention?: number
  maximumIntervalDays?: number
}

export function createScheduler(opts: SchedulerOptions = {}): FSRS {
  return fsrs(generatorParameters({
    request_retention: opts.requestRetention ?? 0.9,
    maximum_interval: opts.maximumIntervalDays ?? 36500,
    enable_fuzz: true,        // разводит повторения, чтобы они не слипались в один день
    enable_short_term: true,  // learning steps внутри одной сессии
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  }))
}

export function newItem(id: string, kind: StudyItemKind, refId: string, now: Date): StudyItem {
  return { id, kind, refId, card: createEmptyCard(now) }
}

export function rate(
  scheduler: FSRS, item: StudyItem, grade: Grade, now: Date,
): { item: StudyItem; log: RecordLogItem['log'] } {
  const result = scheduler.next(item.card, now, grade)
  return { item: { ...item, card: result.card }, log: result.log }
}

/**
 * Вероятность вспомнить прямо сейчас. 0 = точно забыто, 1 = свежо.
 * Используется как мера срочности: чем ниже, тем раньше показывать.
 */
export function retrievability(scheduler: FSRS, item: StudyItem, now: Date): number {
  if (item.card.state === State.New) return 0
  return scheduler.get_retrievability(item.card, now, false) as number
}

export const costOf = (item: StudyItem): number => REVIEW_COST_SEC[item.kind]
