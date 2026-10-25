/**
 * Нормативы времени до уровня.
 *
 * Отвечает на вопрос «сколько мне ещё осталось». Числа — не из головы:
 * шкала guided learning hours Cambridge и LANGUAGECERT, источники
 * перечислены в самом `levels.json`.
 *
 * Оценка всегда вилкой, от и до. Единственное число здесь было бы
 * враньём: ни одна шкала не обещает точного часа, а для пары
 * русский → польский надёжной публикации нет вовсе (RESEARCH.md §8).
 */
import { COURSE_ID } from './curriculum'

export type TrackId = 'a0' | 'a2' | 'b1-minus'

export interface LevelTrack {
  id: TrackId
  titleRu: string
  startLevel: string
  /** [оптимистично, осторожно] — часов до целевого уровня */
  hoursToTarget: [number, number]
}

export interface Levels {
  cefr: { level: string; cumulativeHours: [number, number] }[]
  tracks: LevelTrack[]
  relatedLanguageDiscount: {
    factor: number
    appliesTo: string[]
    notAppliesTo: string[]
    reason: string
  }
  target: { level: string; examId: string }
}

let cache: Promise<Levels> | null = null

export function loadLevels(): Promise<Levels> {
  cache ??= fetch(`/content/${COURSE_ID}/levels.json`)
    .then((res) => {
      if (!res.ok) throw new Error('content_unavailable:levels.json')
      return res.json() as Promise<Levels>
    })
    .catch((e) => { cache = null; throw e })
  return cache
}

export interface TimeToTarget {
  /** Часов занятий позади */
  spentHours: number
  /** Сколько всего нужно на выбранном треке, вилкой */
  requiredHours: [number, number]
  remainingHours: [number, number]
  /** Доля пути, 0..1, по осторожной оценке */
  percent: number
  /** Средний темп за последние занятия, минут в день */
  paceMinPerDay: number
  /** При текущем темпе — сколько дней ещё, по осторожной оценке */
  daysLeft: number | null
}

/**
 * Считает путь до уровня.
 *
 * Скидка на родство языков применяется к части часов: узнавание
 * ускоряется общей лексикой и падежной системой, производство — почти
 * нет. Коэффициент лежит в данных и виден пользователю, а не зашит
 * здесь: его можно оспорить, и это правильно.
 */
export function timeToTarget(
  levels: Levels,
  track: TrackId,
  spentMs: number,
  paceMinPerDay: number,
): TimeToTarget {
  const t = levels.tracks.find((x) => x.id === track) ?? levels.tracks[0]!
  const { factor, appliesTo, notAppliesTo } = levels.relatedLanguageDiscount
  // скидка действует на часть модулей, поэтому и к часам применяется
  // пропорционально их доле, а не целиком
  const share = appliesTo.length / (appliesTo.length + notAppliesTo.length)
  const adjust = (h: number) => h * (share * factor + (1 - share))

  const required: [number, number] = [adjust(t.hoursToTarget[0]), adjust(t.hoursToTarget[1])]
  const spentHours = spentMs / 3_600_000
  const remaining: [number, number] = [
    Math.max(0, required[0] - spentHours),
    Math.max(0, required[1] - spentHours),
  ]
  const daysLeft = paceMinPerDay > 0
    ? Math.ceil((remaining[1] * 60) / paceMinPerDay)
    : null

  return {
    spentHours,
    requiredHours: required,
    remainingHours: remaining,
    percent: required[1] > 0 ? Math.min(1, spentHours / required[1]) : 0,
    paceMinPerDay,
    daysLeft,
  }
}
