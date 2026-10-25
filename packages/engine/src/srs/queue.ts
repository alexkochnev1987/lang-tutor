/**
 * Очередь повторений на день — с жёстким потолком по времени.
 *
 * Проблема, ради которой этот модуль существует: FSRS сам по себе не знает
 * про «15 минут в день». Пропустил неделю — на восьмой день он честно
 * выдаёт 300 просроченных карточек. Человек видит это и бросает.
 *
 * Решение из трёх частей:
 *   1. потолок по бюджету — больше, чем влезает, не показываем никогда;
 *   2. сортировка по СРОЧНОСТИ, а не по дате: первым идёт то, что
 *      вот-вот забудется, а не то, что просрочено дольше всех;
 *   3. режим разгребания: при завале новые слова временно не вводятся.
 */
import type { FSRS } from 'ts-fsrs'
import { State } from 'ts-fsrs'
import { costOf, retrievability } from './scheduler'
import type { StudyItem } from '../types'

export interface QueueInput {
  scheduler: FSRS
  items: StudyItem[]
  now: Date
  /** Сколько секунд отведено на повторение в этот день */
  budgetSec: number
  suspendedRefIds?: ReadonlySet<string>
}

export interface QueueResult {
  /** Что показать сегодня, в порядке показа */
  due: StudyItem[]
  /** Сколько просроченного НЕ влезло */
  deferred: number
  /** Оценка времени на очередь */
  estimatedSec: number
  /** Завал: просрочки больше, чем на три дня бюджета */
  backlog: boolean
  /** При завале новые слова не вводим, пока не разгребём */
  suppressNewItems: boolean
}

/** Во сколько раз превышение бюджета считается завалом. */
const BACKLOG_FACTOR = 3

export function buildQueue({
  scheduler, items, now, budgetSec, suspendedRefIds,
}: QueueInput): QueueResult {
  const dueAll = items.filter(
    (i) => i.card.state !== State.New
      && i.card.due.getTime() <= now.getTime()
      && !suspendedRefIds?.has(i.refId))

  // Срочность = насколько вероятно, что элемент уже забыт.
  // Это важнее давности: карточка, просроченная на месяц, но лёгкая,
  // менее срочна, чем вчерашняя, но трудная.
  const scored = dueAll
    .map((item) => ({ item, r: retrievability(scheduler, item, now) }))
    .sort((a, b) => a.r - b.r)

  const due: StudyItem[] = []
  let spent = 0
  for (const { item } of scored) {
    const cost = costOf(item)
    if (spent + cost > budgetSec) break
    due.push(item)
    spent += cost
  }

  const totalDueCost = dueAll.reduce((s, i) => s + costOf(i), 0)
  const backlog = totalDueCost > budgetSec * BACKLOG_FACTOR

  return {
    due,
    deferred: dueAll.length - due.length,
    estimatedSec: spent,
    backlog,
    suppressNewItems: backlog,
  }
}

/**
 * Сколько новых элементов можно ввести сегодня.
 *
 * Каждое новое слово — это не только сегодняшние 20 секунд, но и хвост
 * повторений на недели вперёд. Если вводить по плану, не глядя на уже
 * накопленную нагрузку, очередь растёт быстрее, чем разгребается.
 */
export function newItemAllowance(
  planned: number, queue: QueueResult, budgetSec: number,
): number {
  if (queue.suppressNewItems) return 0
  const free = Math.max(0, budgetSec - queue.estimatedSec)
  // новое слово стоит ~20 с на ввод; не отдаём под него больше половины остатка
  const affordable = Math.floor((free * 0.5) / 20)
  return Math.min(planned, affordable)
}
