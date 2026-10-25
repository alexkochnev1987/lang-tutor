/**
 * Загрузка языкового пакета.
 *
 * Бэкенда нет: пакет — статические JSON в /public/content/<courseId>/.
 * Качается один раз, кладётся в IndexedDB и дальше работает офлайн.
 * Перекачка только при смене contentVersion.
 */
import { db } from '@/lib/db/dexie'

export const COURSE_ID = process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru'

export type DayKind =
  | 'diagnostic' | 'new' | 'consolidation' | 'weekly-check' | 'checkpoint' | 'final'

export interface TimeBudget {
  review: number
  newGrammar: number
  practice: number
  exam: number
  analysis: number
}

export interface CurriculumDay {
  day: number
  week: number
  phase: number
  phaseTitle: string
  kind: DayKind
  topic: string
  themeId: string
  themeRu: string
  grammarRuleIds: string[]
  lexemeIds: string[]
  isNewRule: boolean
  reviewRuleIds: string[]
  newWordCount: number
  exerciseKinds: string[]
  examFocus: 'listening' | 'reading' | 'grammar' | 'writing' | 'speaking'
  competencyIds: string[]
  timeBudgetSec: TimeBudget
  totalSec: number
  expectedOutcome: string
  interferenceRisk: number | null
}

export interface Curriculum {
  courseId: string
  version: string
  stats: {
    totalDays: number
    rulesIntroduced: number
    totalNewWords: number
    totalMinutes: number
  }
  days: CurriculumDay[]
}

export type Transparency = 'transparent' | 'partial' | 'opaque' | 'false-friend'

export interface Lexeme {
  id: string
  lemma: string
  pos: string
  translation: string
  transparency: Transparency
  themeId: string | null
  priority: 'critical' | 'high' | 'normal'
  aspectPair?: { imperfective: string; perfective: string } | null
  government?: string | null
  interference?: { confusedWith: string; actuallyIs: string }
  grammarRuleIds?: string[]
}

export interface GrammarRule {
  id: string
  category: string
  title: { pl: string; ru: string }
  summary: string
  prerequisites: string[]
  difficulty: number
  interferenceRu: number
  examples: { pl: string; ru: string }[]
  pitfallsForRu?: string[]
  examModules: string[]
  exerciseKinds: string[]
  teachingNote?: string
}

const cacheKey = (file: string) => `${COURSE_ID}/${file}`

async function loadPack<T>(file: string): Promise<T> {
  const key = cacheKey(file)
  const cached = await db.contentCache.get(key)
  if (cached) return cached.payload as T

  const res = await fetch(`/content/${COURSE_ID}/${file}`)
  if (!res.ok) throw new Error(`content_unavailable:${file}`)
  const payload = (await res.json()) as T

  const version = (payload as { version?: string }).version ?? 'unknown'
  await db.contentCache.put({ key, version, payload })
  return payload
}

export const loadCurriculum = () => loadPack<Curriculum>('curriculum.json')

export async function loadVocabulary(): Promise<Map<string, Lexeme>> {
  const pack = await loadPack<{ items: Lexeme[] }>('vocabulary.json')
  return new Map(pack.items.map((v) => [v.id, v]))
}

export type Paradigm = Record<string, string[]>

export async function loadMorphology(): Promise<Record<string, Paradigm>> {
  const pack = await loadPack<{ paradigms: Record<string, Paradigm> }>('morphology.json')
  return pack.paradigms
}

export async function loadGrammarRules(): Promise<Map<string, GrammarRule>> {
  const pack = await loadPack<{ rules: GrammarRule[] }>('grammar-rules.json')
  return new Map(pack.rules.map((r) => [r.id, r]))
}

/**
 * Какой сегодня учебный день.
 * Считается от даты старта курса, а не от календаря: пропущенные дни не
 * прожигаются — программа просто сдвигается. SPACED_REPETITION.md опишет,
 * что при этом происходит с очередью повторений.
 */
export async function currentDayNumber(totalDays: number): Promise<number> {
  const course = await db.userCourses.get(COURSE_ID)
  if (!course) return 1
  const sessions = await db.lessonSessions
    .filter((s) => Boolean(s.completedAt))
    .toArray()
  return Math.min(totalDays, sessions.length + 1)
}
