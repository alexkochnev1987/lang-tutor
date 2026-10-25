/**
 * Загрузка языкового пакета.
 *
 * Контент курса — статические JSON в /public/content/<courseId>/. В базу
 * он не попадает (R3): языковые пакеты версионируются вместе с кодом, а
 * в Postgres лежат только данные пользователя.
 *
 * Кэш — только в памяти вкладки. Повторную загрузку между визитами берут
 * на себя HTTP-кэш и service worker; дублировать их ещё одним хранилищем
 * незачем.
 */
import { loadState } from '@/lib/data/store'

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

const memo = new Map<string, Promise<unknown>>()

function loadPack<T>(file: string): Promise<T> {
  const key = `${COURSE_ID}/${file}`
  let hit = memo.get(key)
  if (!hit) {
    hit = fetch(`/content/${key}`).then((res) => {
      if (!res.ok) throw new Error(`content_unavailable:${file}`)
      return res.json()
    }).catch((e) => {
      memo.delete(key)   // не кэшируем неудачу: следующая попытка должна пойти в сеть
      throw e
    })
    memo.set(key, hit)
  }
  return hit as Promise<T>
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
  const { course, sessions } = await loadState()
  if (!course) return 1
  const completed = sessions.filter((s) => s.completedAt).length
  return Math.min(totalDays, completed + 1)
}
