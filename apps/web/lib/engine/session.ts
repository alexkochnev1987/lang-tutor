/**
 * Мост между хранилищем и движком.
 *
 * Движок языконезависим и ничего не знает ни про базу, ни про сеть
 * (R8/R11): расписание считается здесь, на клиенте, а сервер принимает
 * готовый результат. Это единственное место, где движок встречается с
 * данными пользователя.
 */
import {
  applyAttempt,
  createScheduler,
  generateLesson,
  newItem,
  rate,
  Rating,
  State,
  type DayPlan,
  type Grade,
  type Lesson,
  type ModuleScore,
  type PassRule,
  type RuleMastery,
  type StudyItem,
  type StudyItemKind,
} from "@polski/engine";
import {
  knownLexemeIds,
  loadState,
  saveAnswer,
  saveMastery,
  saveScheduledReview,
  type AnswerPayload,
} from "@/lib/data/store";
import type { AppState, RuleMasteryRow, StudyItemRow } from "@/lib/data/types";
import { DEFAULT_SETTINGS } from "@/lib/data/types";
import { type CurriculumDay } from "@/lib/content/curriculum";

export const scheduler = createScheduler();

/** Польский B1: ≥50% в КАЖДОМ модуле. exam-spec.json → legallyFixed.passRule */
export const PASS_RULE: PassRule = {
  kind: "per-module-floor",
  thresholdPercent: 50,
};

/** Строка из базы → элемент движка. Колонки camelCase, Card — snake_case. */
const toEngine = (r: StudyItemRow): StudyItem => ({
  id: r.id,
  kind: r.kind,
  refId: r.refId,
  card: {
    due: r.due,
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsedDays,
    scheduled_days: r.scheduledDays,
    learning_steps: r.learningSteps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    last_review: r.lastReview ?? undefined,
  },
});

const toRow = (i: StudyItem): StudyItemRow => ({
  id: i.id,
  kind: i.kind as StudyItemRow["kind"],
  refId: i.refId,
  due: i.card.due,
  stability: i.card.stability,
  difficulty: i.card.difficulty,
  elapsedDays: i.card.elapsed_days,
  scheduledDays: i.card.scheduled_days,
  learningSteps: i.card.learning_steps,
  reps: i.card.reps,
  lapses: i.card.lapses,
  state: i.card.state,
  lastReview: i.card.last_review ?? null,
});

export async function loadStudyItems(): Promise<StudyItem[]> {
  const { studyItems } = await loadState();
  return studyItems.map(toEngine);
}

export async function loadMastery(): Promise<RuleMastery[]> {
  const { mastery } = await loadState();
  return mastery.map((r) => ({
    grammarRuleId: r.grammarRuleId,
    mastery: r.mastery,
    attempts: r.attempts,
    correct: r.correct,
    lastPracticedAt: r.lastPracticedAt?.getTime() ?? null,
  }));
}

export async function loadModuleScores(): Promise<ModuleScore[]> {
  const { readiness } = await loadState();
  if (readiness.length) {
    return readiness.map((r) => ({
      moduleId: r.moduleId,
      estimatedPercent: r.estimatedPercent,
      confidence: r.confidence,
    }));
  }
  // до первого среза считаем, что всё на нуле — тогда слабейшим будет
  // первый по алфавиту, и генератор пойдёт по ротации из программы
  return ["listening", "reading", "grammar", "writing", "speaking"].map(
    (moduleId) => ({
      moduleId,
      estimatedPercent: 0,
      confidence: 0,
    }),
  );
}

export async function buildTodayLesson(day: CurriculumDay): Promise<Lesson> {
  const [items, mastery, moduleScores, state] = await Promise.all([
    loadStudyItems(),
    loadMastery(),
    loadModuleScores(),
    loadState(),
  ]);
  const plan: DayPlan = {
    day: day.day,
    kind: day.kind,
    grammarRuleIds: day.grammarRuleIds,
    lexemeIds: day.lexemeIds ?? [],
    newWordCount: day.newWordCount,
    examFocus: day.examFocus,
    timeBudgetSec: {
      ...day.timeBudgetSec,
      review: Math.round(
        day.timeBudgetSec.review * state.settings.dailyBudgetMinutes / DEFAULT_SETTINGS.dailyBudgetMinutes,
      ),
    },
  };
  return generateLesson({
    scheduler,
    plan,
    items,
    mastery,
    moduleScores,
    passRule: PASS_RULE,
    now: new Date(),
    suspendedRefIds: knownLexemeIds(state),
  });
}

export const LEXEME_SKILL_KINDS = [
  "lexeme-recognition",
  "lexeme-production",
  "lexeme-spelling",
  "lexeme-listen-write",
] as const;

export type LexemeSkillKind = (typeof LEXEME_SKILL_KINDS)[number];

/** Создаёт отдельную FSRS-карточку для каждого способа владения словом. */
export async function ensureLexemeCards(
  lexemeId: string,
  now = new Date(),
): Promise<void> {
  const { studyItems } = await loadState();
  for (const kind of LEXEME_SKILL_KINDS) {
    const id = `${kind}:${lexemeId}`;
    if (studyItems.some((i) => i.id === id)) continue;
    await saveScheduledReview({ item: toRow(newItem(id, kind, lexemeId, now)) });
  }
}

export function prepareLexemeReview(
  studyItems: readonly StudyItemRow[],
  lexemeId: string,
  kind: LexemeSkillKind,
  grade: Grade,
  responseMs: number,
  now = new Date(),
): AnswerPayload & { log: NonNullable<AnswerPayload["log"]> } {
  const itemId = `${kind}:${lexemeId}`;
  const row = studyItems.find((item) => item.id === itemId);
  const previous = row ? toEngine(row) : newItem(itemId, kind, lexemeId, now);
  const { item, log } = rate(scheduler, previous, grade, now);
  return {
    item: toRow(item),
    log: {
      id: crypto.randomUUID(),
      studyItemId: itemId,
      rating: log.rating,
      state: log.state,
      stability: log.stability,
      difficulty: log.difficulty,
      elapsedDays: log.elapsed_days,
      scheduledDays: log.scheduled_days,
      reviewedAt: now,
      responseMs,
    },
  };
}

/**
 * Завершение полного цикла нового слова. Один вызов рейтинга на каждую
 * сторону карточки, а не отдельный рейтинг после каждого упражнения.
 */
export async function completeLexemeLearning(
  lexemeId: string,
  results: Record<LexemeSkillKind, boolean>,
  responseMs = 0,
): Promise<void> {
  const { studyItems } = await loadState();
  await Promise.all(
    LEXEME_SKILL_KINDS.map((kind) =>
      saveAnswer(prepareLexemeReview(
        studyItems,
        lexemeId,
        kind,
        results[kind] ? Rating.Good : Rating.Again,
        responseMs,
      )),
    ),
  );
}

const EXERCISE_SKILL = {
  rec: "lexeme-recognition",
  ff: "lexeme-recognition",
  choice: "lexeme-recognition",
  prod: "lexeme-production",
  spell: "lexeme-spelling",
  "write-word": "lexeme-spelling",
  "listen-choice": "lexeme-listen-write",
  "listen-write": "lexeme-listen-write",
  typed: "lexeme-listen-write",
  writing: "lexeme-spelling",
  translation: "lexeme-recognition",
} as const satisfies Record<string, LexemeSkillKind>;

// Exercise results persist the generated ID, including optional session and retry prefixes.
const WORD_EXERCISE_ID = /(?:^|:)ex\.(?:(rec|ff|prod|spell|listen-write|listen-choice|write-word)|minimum-words\.\d+\.(choice|typed|writing|translation))\.(.+)$/;

type LexemeSkillProgress = { value: number; correct: number; attempts: number };

export function lexemeSkillProgress(
  state: AppState | null,
  lexemeId: string,
): Partial<Record<LexemeSkillKind, LexemeSkillProgress>> {
  const progress: Partial<Record<LexemeSkillKind, LexemeSkillProgress>> = {};
  const results = (state?.exerciseResults ?? [])
    .flatMap((result) => {
      const match = WORD_EXERCISE_ID.exec(result.exerciseId);
      if (!match || match[3] !== lexemeId) return [];
      const type = (match[1] ?? match[2]) as keyof typeof EXERCISE_SKILL;
      return [{ result, kind: EXERCISE_SKILL[type] }];
    })
    .sort((a, b) => a.result.completedAt.getTime() - b.result.completedAt.getTime());

  for (const { result, kind } of results) {
    // Each miss moves the score towards zero, and a correct answer closes
    // part of the remaining gap. This gives the latest attempts more weight.
    const previous = progress[kind];
    const correct = Number(result.correct);
    const misses = result.attempts - correct;
    const afterMisses = (previous?.value ?? 0) * 0.75 ** misses;
    progress[kind] = {
      value: result.correct ? afterMisses + (100 - afterMisses) * 0.2 : afterMisses,
      correct: (previous?.correct ?? 0) + correct,
      attempts: (previous?.attempts ?? 0) + result.attempts,
    };
  }
  return progress;
}

export function nextLexemeReview(
  state: AppState | null,
  lexemeId: string,
): { kind: LexemeSkillKind; due: Date } | null {
  let next: { kind: LexemeSkillKind; due: Date } | null = null;
  for (const item of state?.studyItems ?? []) {
    const { kind, due, refId, state } = item;
    if (refId !== lexemeId || kind === "rule-card" || state === State.New) continue;
    if (next === null || due < next.due) next = { kind, due };
  }
  return next;
}

/**
 * Ответ на упражнение по правилу.
 *
 * Грамматика идёт в mastery-модель, а не в FSRS: правило — это навык на
 * множестве элементов, его забывание видно по ошибкам в разных
 * упражнениях, а не по одному отзыву (RESEARCH.md §7.3).
 */
export async function recordRuleAttempt(
  ruleId: string,
  correct: boolean,
  exerciseDifficulty: number,
  at = Date.now(),
): Promise<void> {
  const { mastery } = await loadState();
  const prev: RuleMasteryRow = mastery.find(
    (m) => m.grammarRuleId === ruleId,
  ) ?? {
    grammarRuleId: ruleId,
    mastery: 0,
    attempts: 0,
    correct: 0,
    recentWindow: [],
    lastPracticedAt: null,
    introducedOnDay: null,
  };
  const next = applyAttempt(
    {
      grammarRuleId: prev.grammarRuleId,
      mastery: prev.mastery,
      attempts: prev.attempts,
      correct: prev.correct,
      lastPracticedAt: prev.lastPracticedAt?.getTime() ?? null,
    },
    { correct, exerciseDifficulty, at },
  );
  await saveMastery({
    ...prev,
    mastery: next.mastery,
    attempts: next.attempts,
    correct: next.correct,
    recentWindow: [
      ...prev.recentWindow.slice(-9),
      { correct, weight: exerciseDifficulty, at },
    ],
    lastPracticedAt: new Date(at),
  });
}

export { Rating };
export type { Grade, Lesson };
