import type { Exercise } from '@polski/engine'
import {
  currentDayNumber, loadCurriculum, loadGrammarRules, loadGrammarSentences,
  loadMorphology, loadReadingTexts, loadVocabulary,
  type CurriculumDay, type Lexeme, type Paradigm, type SentencePack,
} from '@/lib/content/curriculum'
import {
  localizeRule, PACK_ORIGINAL_LANGUAGE, isRuleLanguage,
  type LocalizedRule, type RuleLanguage,
} from '@/lib/content/rules'
import { knownLexemeIds, loadState } from '@/lib/data/store'
import {
  exerciseForReview, exercisesForRule,
  exercisesForReading, sentenceDrillsForRule, sentenceWriteDrills, type SentenceMode,
} from './exercises'
import { buildWordStudySteps } from './word-study'
import { buildTodayLesson } from './session'

export type { SentenceMode } from './exercises'

export type StageId = 'words' | 'grammar' | 'exam'

export const STAGE_TITLE: Record<StageId, string> = {
  words: 'Слова',
  grammar: 'Грамматика',
  exam: 'Экзаменационное задание',
}
export type Step =
  | { kind: 'word-intro'; word: Lexeme }
  | { kind: 'rule-intro'; rule: LocalizedRule }
  | {
      kind: 'exercise'
      ex: Exercise
      review: boolean
      rule: LocalizedRule | null
      variants?: Partial<Record<SentenceMode, Exercise>>
    }

export interface Stage {
  id: StageId
  steps: Step[]
  estimatedSec: number
  rule: LocalizedRule | null
  missingContent: string | null
}
export interface TodayPlan {
  day: CurriculumDay
  dayNumber: number
  totalDays: number
  stages: Stage[]
  estimatedSec: number
  notes: string[]
  newWords: Lexeme[]
  reviewCount: number
  deferredCount: number
}

const WORD_INTRO_SEC = 20
const RULE_INTRO_SEC = 60
const DRILLS_PER_RULE = 10
const MIN_GRAMMAR_EXAMPLES_PER_TYPE = 10
const WRITE_TASKS_PER_RULE = 2
const EXAM_TASK_COUNT = 10
const NEW_WORD_BATCH_SIZE = 5

const MODULES_WITH_GENERATOR = new Set(['grammar'])

const MODULE_NAME: Record<string, string> = {
  listening: 'Аудирование',
  reading: 'Чтение',
  grammar: 'Грамматика',
  writing: 'Письмо',
  speaking: 'Говорение',
}

const MISSING_CONTENT_FOR_MODULE: Record<string, string> = {
  listening: 'potrzebne są nagrania audio — synteza mowy nie zastępuje tego modułu (decyzja D13)',
  reading: 'potrzebne są teksty do czytania, których jeszcze nie ma w pakiecie językowym',
  writing: 'potrzebne są tematy prac pisemnych i kryteria oceny',
  speaking: 'potrzebne są karty części ustnej i nagranie odpowiedzi',
}

const stepSec = (step: Step): number =>
  step.kind === 'exercise' ? step.ex.estimatedSec
  : step.kind === 'rule-intro' ? RULE_INTRO_SEC
  : WORD_INTRO_SEC

const sumSec = (steps: Step[]): number => steps.reduce((sec, s) => sec + stepSec(s), 0)

const exerciseIdsOf = (steps: Step[]): Set<string> =>
  new Set(steps.flatMap((s) => (s.kind === 'exercise' ? [s.ex.id] : [])))

export async function buildTodayPlan(): Promise<TodayPlan> {
  const [curriculum, vocabulary, morphology, rules, sentences, readingTexts] = await Promise.all([
    loadCurriculum(), loadVocabulary(), loadMorphology(), loadGrammarRules(),
    loadGrammarSentences(), loadReadingTexts(),
  ])
  const state = await loadState()
  const dayNumber = await currentDayNumber(curriculum.stats.totalDays)
  const day = curriculum.days[dayNumber - 1]!

  const language: RuleLanguage = isRuleLanguage(state.settings.ruleLanguage)
    ? state.settings.ruleLanguage
    : PACK_ORIGINAL_LANGUAGE
  const localized = (id: string): LocalizedRule | null => {
    const rule = rules.get(id)
    return rule ? localizeRule(rule, language) : null
  }

  const lesson = await buildTodayLesson(day)
  const known = knownLexemeIds(state)
  const practisedPool = [...vocabulary.values()].filter((w) => !known.has(w.id))

  const reviewSteps = buildReviewSteps(lesson.activities, state.studyItems, vocabulary, practisedPool)
  const newWords = (lesson.activities.find((a) => a.kind === 'new-words')?.refIds ?? [])
    .map((id) => vocabulary.get(id)).filter(Boolean) as Lexeme[]
  const newWordSteps = [] as Step[]
  for (let start = 0; start < newWords.length; start += NEW_WORD_BATCH_SIZE) {
    newWordSteps.push(...buildNewWordSteps(
      newWords.slice(start, start + NEW_WORD_BATCH_SIZE), practisedPool,
    ))
  }

  const drillRuleIds = lesson.activities.find((a) => a.kind === 'grammar-drill')?.refIds ?? []
  const ruleIds = [...new Set([...day.grammarRuleIds, ...drillRuleIds])]
  const dayRule = day.grammarRuleIds[0] ? localized(day.grammarRuleIds[0]) : null
  const drillSteps = buildDrillSteps(
    ruleIds, [...newWords, ...practisedPool], morphology, sentences, localized,
    dayNumber)

  const examSteps = day.examFocus === 'reading'
    ? buildReadingSteps(readingTexts, day.day, exerciseIdsOf(drillSteps))
    : MODULES_WITH_GENERATOR.has(day.examFocus)
    ? buildExamSteps(
        [...new Set([...ruleIds, ...state.mastery.map((m) => m.grammarRuleId)])],
        practisedPool, morphology, localized, exerciseIdsOf(drillSteps))
    : []

  const stages: Stage[] = []

  const wordSteps = [...reviewSteps, ...newWordSteps]
  if (wordSteps.length) {
    stages.push({
      id: 'words',
      steps: wordSteps,
      estimatedSec: sumSec(wordSteps),
      rule: null,
      missingContent: null,
    })
  }

  if (dayRule || drillSteps.length) {
    const steps: Step[] = dayRule
      ? [{ kind: 'rule-intro', rule: dayRule }, ...drillSteps]
      : drillSteps
    stages.push({
      id: 'grammar',
      steps,
      estimatedSec: sumSec(steps),
      rule: dayRule,
      missingContent: drillSteps.length
        ? null
        : 'nie znaleziono form dla reguły dnia w słowniku',
    })
  }

  if (day.timeBudgetSec.exam > 0) {
    stages.push({
      id: 'exam',
      steps: examSteps,
      estimatedSec: sumSec(examSteps),
      rule: null,
      missingContent: examSteps.length ? null : missingExamContent(day.examFocus),
    })
  }

  return {
    day,
    dayNumber,
    totalDays: curriculum.stats.totalDays,
    stages,
    estimatedSec: stages.reduce((sec, s) => sec + s.estimatedSec, 0),
    notes: lesson.notes,
    newWords,
    reviewCount: reviewSteps.length,
    deferredCount: lesson.queue.deferred,
  }
}

/**
 * Вводим слова небольшими пачками и чередуем их упражнения:
 * карточка A → перевод A → карточка B → перевод B → следующее задание A.
 * Так человек не получает подряд четыре разных проверки одного слова.
 */
function buildNewWordSteps(words: Lexeme[], pool: Lexeme[]): Step[] {
  return buildWordStudySteps(words, pool).map((step): Step => (
    step.kind === 'word-intro'
      ? step
      : { kind: 'exercise', ex: step.ex, review: false, rule: null }
  ))
}

function missingExamContent(moduleId: string): string {
  if (MODULES_WITH_GENERATOR.has(moduleId)) {
    return 'nie znaleziono form do zadania — słownik jest jeszcze zbyt mały'
  }
  const name = MODULE_NAME[moduleId] ?? moduleId
  const blocker = MISSING_CONTENT_FOR_MODULE[moduleId] ?? 'нужен контент'
  return `модуль «${name}»: ${blocker}`
}

function buildReadingSteps(
  texts: import('@/lib/content/curriculum').ReadingText[],
  dayNumber: number,
  alreadyDrilled: Set<string>,
): Step[] {
  if (!texts.length) return []
  const text = texts[(dayNumber - 1) % texts.length]!
  const used = new Set(alreadyDrilled)
  return exercisesForReading(text, dayNumber)
    .filter((ex) => !used.has(ex.id))
    .slice(0, EXAM_TASK_COUNT)
    .map((ex): Step => ({ kind: 'exercise', ex, review: false, rule: null }))
}

function buildReviewSteps(
  activities: { kind: string; refIds: string[] }[],
  studyItems: { id: string; kind: string; refId: string; reps: number }[],
  vocabulary: Map<string, Lexeme>,
  pool: Lexeme[],
): Step[] {
  const dueIds = activities.find((a) => a.kind === 'review')?.refIds ?? []
  const byId = new Map(studyItems.map((i) => [i.id, i]))
  const steps: Step[] = []
  for (const id of dueIds) {
    const item = byId.get(id)
    if (!item || item.kind === 'rule-card') continue
    const word = vocabulary.get(item.refId)
    if (!word) continue
    const ex = exerciseForReview(
      word, item.kind as 'lexeme-recognition' | 'lexeme-production', item.reps, pool)
    if (ex) steps.push({ kind: 'exercise', ex, review: true, rule: null })
  }
  return steps
}
function buildDrillSteps(
  ruleIds: string[],
  words: Lexeme[],
  morphology: Record<string, Paradigm>,
  sentences: SentencePack,
  localized: (id: string) => LocalizedRule | null,
  dayNumber: number,
): Step[] {
  // Each answer mode gets its own quota. We deliberately build both pools
  // from the same sentence pack instead of choosing one mode per rule: one
  // rule must never produce ten typed items and only two choice items.
  function buildModeSteps(mode: SentenceMode): Step[] {
    const candidates: Step[] = []
    const used = new Set<string>()

    for (const ruleId of ruleIds) {
      if (candidates.length >= MIN_GRAMMAR_EXAMPLES_PER_TYPE) break
      const rule = localized(ruleId)
      const drills = sentenceDrillsForRule(
        ruleId,
        sentences,
        morphology,
        mode,
        dayNumber,
        MIN_GRAMMAR_EXAMPLES_PER_TYPE - candidates.length,
      )
      for (const d of drills) {
        if (used.has(d.ex.id)) continue
        used.add(d.ex.id)
        candidates.push({ kind: 'exercise', ex: d.ex, review: false, rule, variants: d.variants })
        if (candidates.length >= MIN_GRAMMAR_EXAMPLES_PER_TYPE) break
      }
    }

    // An incomplete block is worse than no block: the content pack must be
    // extended instead of silently replacing sentence exercises with a
    // one-word paradigm drill.
    return candidates.length >= MIN_GRAMMAR_EXAMPLES_PER_TYPE ? candidates : []
  }

  const choiceSteps = buildModeSteps('choice')
  const typedSteps = buildModeSteps('typed')
  const steps = [...choiceSteps, ...typedSteps]

  for (const ruleId of ruleIds) {
    const rule = localized(ruleId)
    steps.push(...sentenceWriteDrills(
      ruleId, sentences, dayNumber, WRITE_TASKS_PER_RULE,
    ).map((ex): Step => ({ kind: 'exercise', ex, review: false, rule })))
  }

  return steps
}

function buildExamSteps(
  ruleIds: string[],
  words: Lexeme[],
  morphology: Record<string, Paradigm>,
  localized: (id: string) => LocalizedRule | null,
  alreadyDrilled: Set<string>,
): Step[] {
  const steps: Step[] = []
  const used = new Set(alreadyDrilled)
  const pools = ruleIds.map((ruleId) => ({
    rule: localized(ruleId),
    exercises: exercisesForRule(ruleId, words, morphology, EXAM_TASK_COUNT),
    cursor: 0,
  }))

  // Round-robin keeps the current rule and older mastered rules in the same
  // exam block instead of exhausting one rule before repeating another.
  let progressed = true
  while (steps.length < EXAM_TASK_COUNT && progressed) {
    progressed = false
    for (const pool of pools) {
      while (pool.cursor < pool.exercises.length && used.has(pool.exercises[pool.cursor]!.id)) {
        pool.cursor++
      }
      const ex = pool.exercises[pool.cursor++]
      if (!ex) continue
      used.add(ex.id)
      steps.push({ kind: 'exercise', ex, review: false, rule: pool.rule })
      progressed = true
      if (steps.length >= EXAM_TASK_COUNT) break
    }
  }

  // Do not render a misleading one-item exam block: it must be a real
  // practice set with at least the required ten examples.
  return steps.length >= EXAM_TASK_COUNT ? steps : []
}
