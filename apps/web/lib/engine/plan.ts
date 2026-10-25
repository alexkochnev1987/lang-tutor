import type { CheckResult, Exercise } from '@polski/engine'
import {
  currentDayNumber, loadCurriculum, loadGrammarRules, loadMorphology, loadVocabulary,
  type CurriculumDay, type Lexeme, type Paradigm,
} from '@/lib/content/curriculum'
import {
  localizeRule, PACK_ORIGINAL_LANGUAGE, isRuleLanguage,
  type LocalizedRule, type RuleLanguage,
} from '@/lib/content/rules'
import { knownLexemeIds, loadState } from '@/lib/data/store'
import { exerciseForReview, exercisesForRule, exercisesForWord } from './exercises'
import { buildTodayLesson } from './session'

export type StageId = 'words' | 'grammar' | 'exam' | 'analysis'

export const STAGE_TITLE: Record<StageId, string> = {
  words: 'Слова',
  grammar: 'Грамматика',
  exam: 'Экзаменационное задание',
  analysis: 'Разбор ошибок',
}

export type Step =
  | { kind: 'word-intro'; word: Lexeme }
  | { kind: 'rule-intro'; rule: LocalizedRule }
  | { kind: 'exercise'; ex: Exercise; review: boolean; rule: LocalizedRule | null }

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

export interface Mistake {
  ex: Exercise
  result: CheckResult
  rule: LocalizedRule | null
}

const WORD_INTRO_SEC = 20
const RULE_INTRO_SEC = 60
const DRILLS_PER_RULE = 3
const EXAM_TASK_COUNT = 4
const EXAM_TASKS_PER_RULE = 2

const MODULES_WITH_GENERATOR = new Set(['grammar'])

const MODULE_NAME: Record<string, string> = {
  listening: 'Аудирование',
  reading: 'Чтение',
  grammar: 'Грамматика',
  writing: 'Письмо',
  speaking: 'Говорение',
}

const MISSING_CONTENT_FOR_MODULE: Record<string, string> = {
  listening: 'нужны аудиофайлы — синтезом речи модуль не заменяется (решение D13)',
  reading: 'нужны тексты для чтения, в языковом пакете их пока нет',
  writing: 'нужны темы письменных работ и критерии проверки',
  speaking: 'нужны карточки устной части и запись ответа',
}

const stepSec = (step: Step): number =>
  step.kind === 'exercise' ? step.ex.estimatedSec
  : step.kind === 'rule-intro' ? RULE_INTRO_SEC
  : WORD_INTRO_SEC

const sumSec = (steps: Step[]): number => steps.reduce((sec, s) => sec + stepSec(s), 0)

const exerciseIdsOf = (steps: Step[]): Set<string> =>
  new Set(steps.flatMap((s) => (s.kind === 'exercise' ? [s.ex.id] : [])))

export async function buildTodayPlan(): Promise<TodayPlan> {
  const [curriculum, vocabulary, morphology, rules] = await Promise.all([
    loadCurriculum(), loadVocabulary(), loadMorphology(), loadGrammarRules(),
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
  const newWordSteps = newWords.flatMap((word): Step[] => [
    { kind: 'word-intro', word },
    ...exercisesForWord(word, practisedPool).map((ex): Step => (
      { kind: 'exercise', ex, review: false, rule: null })),
  ])

  const drillRuleIds = lesson.activities.find((a) => a.kind === 'grammar-drill')?.refIds ?? []
  const ruleIds = [...new Set([...day.grammarRuleIds, ...drillRuleIds])]
  const dayRule = day.grammarRuleIds[0] ? localized(day.grammarRuleIds[0]) : null
  const drillSteps = buildDrillSteps(
    ruleIds, [...newWords, ...practisedPool], morphology, localized)

  const examSteps = MODULES_WITH_GENERATOR.has(day.examFocus)
    ? buildExamSteps(
        [...new Set([...state.mastery.map((m) => m.grammarRuleId), ...ruleIds])],
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
        : 'для правила дня не нашлось форм в словаре',
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

  if (day.timeBudgetSec.analysis > 0) {
    stages.push({
      id: 'analysis', steps: [], estimatedSec: 0, rule: null, missingContent: null,
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

function missingExamContent(moduleId: string): string {
  if (MODULES_WITH_GENERATOR.has(moduleId)) {
    return 'не нашлось форм для задания — введённого словаря пока не хватает'
  }
  const name = MODULE_NAME[moduleId] ?? moduleId
  const blocker = MISSING_CONTENT_FOR_MODULE[moduleId] ?? 'нужен контент'
  return `модуль «${name}»: ${blocker}`
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
  localized: (id: string) => LocalizedRule | null,
): Step[] {
  const steps: Step[] = []
  const used = new Set<string>()
  for (const ruleId of ruleIds) {
    const rule = localized(ruleId)
    for (const ex of exercisesForRule(ruleId, words, morphology, DRILLS_PER_RULE)) {
      if (used.has(ex.id)) continue
      used.add(ex.id)
      steps.push({ kind: 'exercise', ex, review: false, rule })
    }
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
  for (const ruleId of ruleIds) {
    if (steps.length >= EXAM_TASK_COUNT) break
    const rule = localized(ruleId)
    const generated = exercisesForRule(
      ruleId, words, morphology, DRILLS_PER_RULE + EXAM_TASKS_PER_RULE)
    let takenForRule = 0
    for (const ex of generated) {
      if (used.has(ex.id)) continue
      if (takenForRule >= EXAM_TASKS_PER_RULE || steps.length >= EXAM_TASK_COUNT) break
      used.add(ex.id)
      takenForRule++
      steps.push({ kind: 'exercise', ex, review: false, rule })
    }
  }
  return steps
}

export function buildAnalysisSteps(mistakes: Mistake[]): Step[] {
  return mistakes.map((m): Step => (
    { kind: 'exercise', ex: m.ex, review: true, rule: m.rule }))
}
