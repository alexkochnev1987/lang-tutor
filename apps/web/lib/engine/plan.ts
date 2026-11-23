import { hashString, type Exercise } from "@polski/engine";
import {
  currentDayNumber,
  loadCollocations,
  loadCurriculum,
  loadGrammarRules,
  loadGrammarSentences,
  loadMorphology,
  loadReadingTexts,
  loadVocabulary,
  type CurriculumDay,
  type CollocationItem,
  type Lexeme,
  type Paradigm,
  type SentencePack,
} from "@/lib/content/curriculum";
import {
  localizeRule,
  PACK_ORIGINAL_LANGUAGE,
  isRuleLanguage,
  type LocalizedRule,
  type RuleLanguage,
} from "@/lib/content/rules";
import { knownLexemeIds, loadDailyWords, loadState } from "@/lib/data/store";
import type { Settings, StudyItemRow } from "@/lib/data/types";
import {
  collocationDrills,
  exercisesForRule,
  exercisesForReading,
  sentenceDrillsForRule,
  sentenceWriteDrills,
  type SentenceMode,
} from "./exercises";
import { dailyWordExercise, WORD_FORMATS, wordSkill } from "./daily-words";
import { buildTodayLesson } from "./session";

export type { SentenceMode } from "./exercises";

export type StageId = "brainstorm" | "words" | "grammar" | "collocations" | "exam";

export const STAGE_TITLE: Record<StageId, string> = {
  brainstorm: "Новые слова",
  words: "Слова",
  grammar: "Грамматика",
  collocations: "Сочетания",
  exam: "Экзаменационное задание",
};
export type Step =
  | { kind: "brainstorm"; words: Lexeme[]; pool: Lexeme[] }
  | { kind: "rule-intro"; rule: LocalizedRule }
  | {
      kind: "exercise-batch";
      exercises: Exercise[];
      title: string;
      description: string;
    }
  | {
      kind: "exercise";
      ex: Exercise;
      review: boolean;
      rule: LocalizedRule | null;
      variants?: Partial<Record<SentenceMode, Exercise>>;
      newWord?: Lexeme;
    };

export interface Stage {
  id: StageId;
  steps: Step[];
  estimatedSec: number;
  rule: LocalizedRule | null;
  missingContent: string | null;
}
export interface TodayPlan {
  day: CurriculumDay;
  dayNumber: number;
  totalDays: number;
  stages: Stage[];
  estimatedSec: number;
  notes: string[];
  newWords: Lexeme[];
  reviewCount: number;
  deferredCount: number;
}

const RULE_INTRO_SEC = 60;
const EXAM_TASK_COUNT = 10;
const COLLOCATION_LIMIT = 3;
const STRONG_RULE_THRESHOLD = 0.85;
const MINIMUM_RULE_ATTEMPTS = 3;

const MODULES_WITH_GENERATOR = new Set(["grammar"]);

const MODULE_NAME: Record<string, string> = {
  listening: "Аудирование",
  reading: "Чтение",
  grammar: "Грамматика",
  writing: "Письмо",
  speaking: "Говорение",
};

const MISSING_CONTENT_FOR_MODULE: Record<string, string> = {
  listening:
    "potrzebne są nagrania audio — synteza mowy nie zastępuje tego modułu (decyzja D13)",
  reading:
    "potrzebne są teksty do czytania, których jeszcze nie ma w pakiecie językowym",
  writing: "potrzebne są tematy prac pisemnych i kryteria oceny",
  speaking: "potrzebne są karty części ustnej i nagranie odpowiedzi",
};

const stepSec = (step: Step): number =>
  step.kind === "brainstorm"
    ? step.words.length * 80
    : step.kind === "exercise"
      ? step.ex.estimatedSec
    : step.kind === "exercise-batch"
      ? step.exercises.reduce((sec, exercise) => sec + exercise.estimatedSec, 0)
      : RULE_INTRO_SEC;

const sumSec = (steps: Step[]): number =>
  steps.reduce((sec, s) => sec + stepSec(s), 0);

const exerciseIdsOf = (steps: Step[]): Set<string> =>
  new Set(steps.flatMap((s) => (s.kind === "exercise" ? [s.ex.id] : [])));

export async function buildTodayPlan(): Promise<TodayPlan> {
  const [curriculum, vocabulary, morphology, rules, sentences, collocations, readingTexts, state, dailyQueue] =
    await Promise.all([
      loadCurriculum(),
      loadVocabulary(),
      loadMorphology(),
      loadGrammarRules(),
      loadGrammarSentences(),
      loadCollocations(),
      loadReadingTexts(),
      loadState(),
      loadDailyWords(),
    ]);
  const dayNumber = await currentDayNumber(curriculum.stats.totalDays);
  const day = curriculum.days[dayNumber - 1]!;

  const language: RuleLanguage = isRuleLanguage(state.settings.ruleLanguage)
    ? state.settings.ruleLanguage
    : PACK_ORIGINAL_LANGUAGE;
  const localized = (id: string): LocalizedRule | null => {
    const rule = rules.get(id);
    return rule ? localizeRule(rule, language) : null;
  };

  const lesson = await buildTodayLesson(day);
  const known = knownLexemeIds(state);
  const practisedPool = [...vocabulary.values()].filter(
    (w) => !known.has(w.id),
  );

  const reviewIds = new Set(dailyQueue.review);
  const learnIds = new Set(dailyQueue.learn);
  const reviewSteps = buildReviewSteps(
    lesson.activities, state.studyItems, vocabulary, practisedPool, reviewIds,
  );
  // Use an ordered curriculum backlog instead of selecting fresh words every
  // render. Consume only entries still eligible in the shared daily queue.
  const plannedIds = lesson.activities.find((activity) => activity.kind === "new-words")?.refIds ?? [];
  const curriculumIds = curriculum.days.slice(0, dayNumber).flatMap(({ lexemeIds }) => lexemeIds ?? []);
  const candidates = [...new Set([...curriculumIds, ...plannedIds, ...dailyQueue.learn])];
  const newWords = candidates
    .filter((id) => learnIds.has(id))
    .slice(0, Math.max(0, state.settings.newWordsPerDay - (dailyQueue.learnedToday ?? 0)))
    .flatMap((id) => vocabulary.get(id) ?? []);

  const drillRuleIds =
    lesson.activities.find((a) => a.kind === "grammar-drill")?.refIds ?? [];
  const ruleIds = [...new Set([...day.grammarRuleIds, ...drillRuleIds])];
  const dayRule = day.grammarRuleIds[0]
    ? localized(day.grammarRuleIds[0])
    : null;
  const drillSteps = buildDrillSteps(
    ruleIds,
    [...newWords, ...practisedPool],
    morphology,
    sentences,
    localized,
    dayNumber,
    state.settings,
  );
  const collocationSteps = buildCollocationSteps(collocations, state, localized, dayNumber);

  const examSteps =
    day.examFocus === "reading"
      ? buildReadingSteps(readingTexts, day.day, exerciseIdsOf(drillSteps))
      : MODULES_WITH_GENERATOR.has(day.examFocus)
        ? buildExamSteps(
            [
              ...new Set([
                ...ruleIds,
                ...state.mastery.map((m) => m.grammarRuleId),
              ]),
            ],
            practisedPool,
            morphology,
            localized,
            exerciseIdsOf(drillSteps),
          )
        : [];

  const stages: Stage[] = [];

  if (newWords.length) {
    stages.push({
      id: "brainstorm",
      steps: [{ kind: "brainstorm", words: newWords, pool: practisedPool }],
      estimatedSec: newWords.length * 80,
      rule: null,
      missingContent: null,
    });
  }

  const wordSteps = reviewSteps.map((step) => step.kind === "exercise"
    ? { ...step, ex: { ...step.ex, id: `${dailyQueue.day}:${step.ex.id}` } } : step);
  if (wordSteps.length) {
    stages.push({
      id: "words",
      steps: wordSteps,
      estimatedSec: sumSec(wordSteps),
      rule: null,
      missingContent: null,
    });
  }

  if (state.settings.grammarExercisesPerDay > 0 && (dayRule || drillSteps.length)) {
    const steps: Step[] = dayRule
      ? [{ kind: "rule-intro", rule: dayRule }, ...drillSteps]
      : drillSteps;
    stages.push({
      id: "grammar",
      steps,
      estimatedSec: sumSec(steps),
      rule: dayRule,
      missingContent: drillSteps.length
        ? null
        : "nie znaleziono form dla reguły dnia w słowniku",
    });
  }

  if (collocationSteps.length) {
    stages.push({
      id: "collocations",
      steps: collocationSteps,
      estimatedSec: sumSec(collocationSteps),
      rule: null,
      missingContent: null,
    });
  }

  if (day.timeBudgetSec.exam > 0) {
    stages.push({
      id: "exam",
      steps: examSteps,
      estimatedSec: sumSec(examSteps),
      rule: null,
      missingContent: examSteps.length
        ? null
        : missingExamContent(day.examFocus),
    });
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
  };
}

function missingExamContent(moduleId: string): string {
  if (MODULES_WITH_GENERATOR.has(moduleId)) {
    return "nie znaleziono form do zadania — słownik jest jeszcze zbyt mały";
  }
  const name = MODULE_NAME[moduleId] ?? moduleId;
  const blocker = MISSING_CONTENT_FOR_MODULE[moduleId] ?? "нужен контент";
  return `модуль «${name}»: ${blocker}`;
}

function buildReadingSteps(
  texts: import("@/lib/content/curriculum").ReadingText[],
  dayNumber: number,
  alreadyDrilled: Set<string>,
): Step[] {
  if (!texts.length) return [];
  const text = texts[(dayNumber - 1) % texts.length]!;
  const used = new Set(alreadyDrilled);
  return exercisesForReading(text, dayNumber)
    .filter((ex) => !used.has(ex.id))
    .slice(0, EXAM_TASK_COUNT)
    .map((ex): Step => ({ kind: "exercise", ex, review: false, rule: null }));
}

/**
 * Сочетания — первый адаптивный блок. Он появляется только после того,
 * как все слова и правила конкретного сочетания достаточно освоены.
 */
function buildCollocationSteps(
  items: CollocationItem[],
  state: Awaited<ReturnType<typeof loadState>>,
  localized: (id: string) => LocalizedRule | null,
  dayNumber: number,
): Step[] {
  const known = knownLexemeIds(state);
  const readyWords = new Set<string>(known);
  const cardKinds = ["lexeme-recognition", "lexeme-production"];

  for (const item of state.studyItems) {
    if (!cardKinds.includes(item.kind) || item.reps < 2) continue;
    const pair = state.studyItems.filter(
      (candidate) =>
        candidate.refId === item.refId && cardKinds.includes(candidate.kind),
    );
    if (pair.length === 2 && pair.every((card) => card.reps >= 2)) {
      readyWords.add(item.refId);
    }
  }

  const strongRules = new Set(
    state.mastery
      .filter(
        (rule) =>
          rule.attempts >= MINIMUM_RULE_ATTEMPTS &&
          rule.mastery >= STRONG_RULE_THRESHOLD,
      )
      .map((rule) => rule.grammarRuleId),
  );

  return items
    .filter((item) =>
      item.slots.every(
        (slot) =>
          Boolean(slot.lexemeId) &&
          readyWords.has(slot.lexemeId!) &&
          slot.ruleIds.every((ruleId) => strongRules.has(ruleId)),
      ),
    )
    .slice(0, COLLOCATION_LIMIT)
    .flatMap((item) => {
      const rule = item.slots[0]?.ruleIds[0]
        ? localized(item.slots[0].ruleIds[0])
        : null;
      return collocationDrills(item, dayNumber, 6).map((ex): Step => ({
        kind: "exercise",
        ex,
        review: false,
        rule,
      }));
    });
}

function buildReviewSteps(
  activities: { kind: string; refIds: string[] }[],
  studyItems: StudyItemRow[],
  vocabulary: Map<string, Lexeme>,
  pool: Lexeme[],
  available: Set<string>,
): Step[] {
  const dueIds = activities.find((activity) => activity.kind === "review")?.refIds ?? [];
  const byId = new Map(studyItems.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const steps: Step[] = [];
  for (const id of dueIds) {
    const item = byId.get(id);
    if (!item || seen.has(item.refId) || !available.has(item.refId)) continue;
    const word = vocabulary.get(item.refId);
    const format = WORD_FORMATS.find((candidate) => wordSkill(candidate) === item.kind);
    if (!word || !format) continue;
    seen.add(word.id);
    steps.push({
      kind: "exercise",
      ex: dailyWordExercise(word, pool, format, hashString(word.id) + item.reps),
      review: true,
      rule: null,
    });
  }
  return steps;
}



function buildDrillSteps(
  ruleIds: string[],
  words: Lexeme[],
  morphology: Record<string, Paradigm>,
  sentences: SentencePack,
  localized: (id: string) => LocalizedRule | null,
  dayNumber: number,
  settings: Pick<Settings, 'grammarExercisesPerDay' | 'grammarLessonFormats'>,
): Step[] {
  const requested = settings.grammarExercisesPerDay;
  if (requested <= 0) return [];
  const selected = settings.grammarLessonFormats;
  type DrillCandidate = Extract<Step, { kind: 'exercise' }> & { sourceKey: string }
  const candidates: Record<'choice' | 'typed' | 'write', DrillCandidate[]> = {
    choice: [], typed: [], write: [],
  };
  const seenIds = new Set<string>();

  for (const ruleId of ruleIds) {
    const rule = localized(ruleId);
    for (const mode of ['choice', 'typed'] as const) {
      if (!selected.includes(mode)) continue;
      for (const drill of sentenceDrillsForRule(ruleId, sentences, morphology, mode, dayNumber, requested)) {
        if (seenIds.has(drill.ex.id)) continue;
        seenIds.add(drill.ex.id);
        candidates[mode].push({
          kind: 'exercise', ex: drill.ex, review: false, rule,
          variants: drill.variants, sourceKey: drill.sourceSentence,
        });
      }
    }
    if (selected.includes('write')) {
      for (const ex of sentenceWriteDrills(ruleId, sentences, dayNumber, requested)) {
        if (seenIds.has(ex.id)) continue;
        seenIds.add(ex.id);
        candidates.write.push({
          kind: 'exercise', ex, review: false, rule, sourceKey: ex.prompt.trim().toLowerCase(),
        });
      }
    }
  }

  const steps: Step[] = [];
  const usedSources = new Set<string>();
  const usedExercises = new Set<string>();
  // Distribute the requested total across enabled types, without repeating a
  // sentence when choice and typed versions share the same corpus record.
  let remaining = requested;
  while (remaining > 0) {
    let added = false;
    for (const mode of selected) {
      const pool = candidates[mode];
      const nextIndex = pool.findIndex(({ sourceKey, ex }) => !usedSources.has(sourceKey) && !usedExercises.has(ex.id));
      if (nextIndex < 0) continue;
      const next = pool.splice(nextIndex, 1)[0]!;
      const { sourceKey, ...step } = next;
      usedSources.add(sourceKey);
      usedExercises.add(step.ex.id);
      steps.push(step);
      remaining--;
      added = true;
      if (remaining === 0) break;
    }
    if (!added) break;
  }
  return steps;
}

function buildExamSteps(
  ruleIds: string[],
  words: Lexeme[],
  morphology: Record<string, Paradigm>,
  localized: (id: string) => LocalizedRule | null,
  alreadyDrilled: Set<string>,
): Step[] {
  const steps: Step[] = [];
  const used = new Set(alreadyDrilled);
  const pools = ruleIds.map((ruleId) => ({
    rule: localized(ruleId),
    exercises: exercisesForRule(ruleId, words, morphology, EXAM_TASK_COUNT),
    cursor: 0,
  }));

  // Round-robin keeps the current rule and older mastered rules in the same
  // exam block instead of exhausting one rule before repeating another.
  let progressed = true;
  while (steps.length < EXAM_TASK_COUNT && progressed) {
    progressed = false;
    for (const pool of pools) {
      while (
        pool.cursor < pool.exercises.length &&
        used.has(pool.exercises[pool.cursor]!.id)
      ) {
        pool.cursor++;
      }
      const ex = pool.exercises[pool.cursor++];
      if (!ex) continue;
      used.add(ex.id);
      steps.push({ kind: "exercise", ex, review: false, rule: pool.rule });
      progressed = true;
      if (steps.length >= EXAM_TASK_COUNT) break;
    }
  }

  // Do not render a misleading one-item exam block: it must be a real
  // practice set with at least the required ten examples.
  return steps.length >= EXAM_TASK_COUNT ? steps : [];
}
