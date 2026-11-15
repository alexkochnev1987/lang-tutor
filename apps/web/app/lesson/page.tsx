"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, Row, Screen, Stack } from "@polski/ui";
import type { CheckResult, Exercise } from "@polski/engine";
import {
  buildTodayPlan,
  type Stage,
  type StageId,
  type Step,
  type TodayPlan,
} from "@/lib/engine/plan";
import {
  completeLexemeLearning,
  ensureLexemeCards,
  LEXEME_SKILL_KINDS,
  lexemeSkillProgress,
  nextLexemeReview,
  recordAnswer,
  recordRuleAttempt,
  Rating,
} from "@/lib/engine/session";
import {
  saveExerciseResult,
  saveLessonSession,
  useAppState,
} from "@/lib/data/store";
import {
  ExerciseView,
  GrammarExerciseBatch,
  StudyActionBar,
  VocabularyExerciseBatch,
  speakableTextOf,
} from "@/app/_components/ExerciseView";
import { RuleSheet } from "@/app/_components/RuleSheet";
import { RuleView } from "@/app/_components/RuleView";
import { Diagnostic } from "@/app/_components/Diagnostic";
import { EmptyDay } from "@/app/_components/EmptyDay";
import { KnownToggle } from "@/app/_components/WordRow";
import { StudyTooltip } from "@/app/_components/StudyTooltip";
import { ThemePicker } from "@/app/_components/ThemePicker";
import type { Lexeme } from "@/lib/content/curriculum";
import { WORD_STAGE_RETRY_LIMIT } from "@/lib/engine/word-study";

type Slot =
  | { kind: "stage-start"; stage: Stage }
  | {
      kind: "step";
      stage: Stage;
      step: Step;
      batchProgress?: {
        title: string;
        description: string;
        index: number;
        total: number;
      };
    };

const STAGE_LEAD: Record<StageId, string> = {
  words: "Powtarzamy i poznajemy słowa. Gramatyka będzie osobnym blokiem.",
  grammar: "Najpierw reguła, potem ćwiczenia. Regułę otworzysz przyciskiem.",
  exam: "Zadanie w formacie egzaminacyjnym: reguły są wymieszane jak na prawdziwym arkuszu.",
};

const STAGE_TITLE_PL: Record<StageId, string> = {
  words: "Słowa",
  grammar: "Gramatyka",
  exam: "Zadanie egzaminacyjne",
};

function toSlots(stages: Stage[]): Slot[] {
  return stages.flatMap((stage): Slot[] => {
    if (!stage.steps.length && !stage.missingContent) return [];
    const steps = stage.steps.flatMap((step): Slot[] => {
      if (stage.id !== "words" || step.kind !== "exercise-batch") {
        return [{ kind: "step", stage, step }];
      }
      return step.exercises.map(
        (ex, index): Slot => ({
          kind: "step",
          stage,
          step: { kind: "exercise", ex, review: true, rule: null },
          batchProgress: {
            title: step.title,
            description: step.description,
            index: index + 1,
            total: step.exercises.length,
          },
        }),
      );
    });
    return [{ kind: "stage-start", stage }, ...steps];
  });
}

export default function LessonPage() {
  const appState = useAppState();
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [i, setI] = useState(0);
  const [canAdvance, setCanAdvance] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [phase, setPhase] = useState<"main" | "done">("main");
  const [special, setSpecial] = useState<"diagnostic" | "empty" | null>(null);
  const startedAt = useRef(Date.now());
  const finalizedWords = useRef(new Set<string>());
  const batchResumeInitialized = useRef(false);

  useEffect(() => {
    let alive = true;
    buildTodayPlan().then((p) => {
      if (!alive) return;
      setPlan(p);
      const main = toSlots(p.stages);
      if (p.day.kind === "diagnostic") {
        setSlots([]);
        setSpecial("diagnostic");
      } else {
        setSlots(main);
        setSpecial(main.length ? null : "empty");
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const slot = slots[i];
  const wordStudyExercise =
    slot?.kind === "step" &&
    slot.step.kind === "exercise" &&
    slot.step.wordStage !== undefined;
  const reviewLexemeId =
    slot?.kind === "step" && slot.step.kind === "exercise" && slot.step.review
      ? slot.step.ex.lexemeId
      : undefined;
  const exerciseLexemeId =
    slot?.kind === "step" && slot.step.kind === "exercise"
      ? slot.step.ex.lexemeId
      : undefined;
  const stageSlots = slot
    ? slots.filter((s) => s.kind === "step" && s.stage.id === slot.stage.id)
    : [];
  const indexInStage = slot ? stageSlots.indexOf(slot) + 1 : 0;
  const grammarExerciseSlots = slots.filter(
    (s) =>
      s.kind === "step" &&
      s.stage.id === "grammar" &&
      s.step.kind === "exercise",
  );
  const grammarExerciseIndex =
    slot?.kind === "step" &&
    slot.stage.id === "grammar" &&
    slot.step.kind === "exercise"
      ? grammarExerciseSlots.indexOf(slot) + 1
      : 0;
  const currentExerciseId =
    slot?.kind === "step" && slot.step.kind === "exercise"
      ? slot.step.ex.id
      : undefined;
  const restoredRow = currentExerciseId
    ? appState?.exerciseResults.find(
        (row) =>
          row.dayNumber === plan?.dayNumber &&
          row.exerciseId === currentExerciseId,
      )
    : undefined;
  const restoredResult = restoredRow
    ? {
        result: {
          correct: restoredRow.correct,
          expected: restoredRow.expected,
          errorKind: restoredRow.errorKind ?? undefined,
        },
        answer: restoredRow.answer,
        attempts: restoredRow.attempts,
      }
    : null;

  useEffect(() => {
    if (!plan || !appState || !slots.length) return;
    const idsByWord = new Map<string, string[]>();
    for (const currentSlot of slots) {
      if (currentSlot.kind !== "step" || currentSlot.step.kind !== "exercise")
        continue;
      if (currentSlot.step.review || !currentSlot.step.ex.lexemeId) continue;
      const ids = idsByWord.get(currentSlot.step.ex.lexemeId) ?? [];
      ids.push(currentSlot.step.ex.id);
      idsByWord.set(currentSlot.step.ex.lexemeId, ids);
    }

    for (const [lexemeId, exerciseIds] of idsByWord) {
      const markerId = `day:${plan.dayNumber}:word:${lexemeId}`;
      if (
        finalizedWords.current.has(lexemeId) ||
        appState.sessions.some((s) => s.id === markerId)
      ) {
        continue;
      }
      const rows = exerciseIds.map((exerciseId) =>
        appState.exerciseResults.find(
          (row) =>
            row.dayNumber === plan.dayNumber && row.exerciseId === exerciseId,
        ),
      );
      const pendingRetry = slots.some((currentSlot) => {
        if (
          currentSlot.kind !== "step" ||
          currentSlot.step.kind !== "exercise" ||
          currentSlot.step.ex.lexemeId !== lexemeId ||
          currentSlot.step.wordStage === undefined ||
          (currentSlot.step.wordRetryRound ?? 0) >= WORD_STAGE_RETRY_LIMIT
        )
          return false;
        const exerciseId = currentSlot.step.ex.id;
        const wordStage = currentSlot.step.wordStage;
        const retryRound = currentSlot.step.wordRetryRound ?? 0;
        const hasNextRetry = slots.some(
          (nextSlot) =>
            nextSlot.kind === "step" &&
            nextSlot.step.kind === "exercise" &&
            nextSlot.step.ex.lexemeId === lexemeId &&
            nextSlot.step.wordStage === wordStage &&
            (nextSlot.step.wordRetryRound ?? 0) === retryRound + 1,
        );
        return (
          !hasNextRetry &&
          appState.exerciseResults.some(
            (row) =>
              row.dayNumber === plan.dayNumber &&
              row.exerciseId === exerciseId &&
              !row.correct,
          )
        );
      });
      if (pendingRetry) continue;
      if (rows.some((row) => !row)) continue;

      const completed = rows.filter(Boolean) as NonNullable<
        (typeof rows)[number]
      >[];
      const skillResults = Object.fromEntries(
        LEXEME_SKILL_KINDS.map((kind, stageIndex) => {
          const stageSlots = slots.filter(
            (currentSlot) =>
              currentSlot.kind === "step" &&
              currentSlot.step.kind === "exercise" &&
              currentSlot.step.ex.lexemeId === lexemeId &&
              currentSlot.step.wordStage === stageIndex,
          );
          return [
            kind,
            stageSlots.some((stageSlot) => {
              if (
                stageSlot.kind !== "step" ||
                stageSlot.step.kind !== "exercise"
              ) {
                return false;
              }
              const stageExerciseId = stageSlot.step.ex.id;
              return appState.exerciseResults.some(
                (row) =>
                  row.dayNumber === plan.dayNumber &&
                  row.exerciseId === stageExerciseId &&
                  row.correct,
              );
            }),
          ];
        }),
      ) as Record<(typeof LEXEME_SKILL_KINDS)[number], boolean>;
      finalizedWords.current.add(lexemeId);
      void completeLexemeLearning(lexemeId, skillResults).then(() =>
        saveLessonSession({
          id: markerId,
          dayNumber: plan.dayNumber,
          kind: "words",
          startedAt: new Date(startedAt.current),
          completedAt: new Date(),
          plannedBudgetMs: completed.length * 20_000,
          actualMs: Date.now() - startedAt.current,
          itemsReviewed: completed.length,
          itemsCorrect: completed.filter((row) => row.correct).length,
        }),
      );
    }
  }, [appState, plan, slots]);

  async function onAnswered(
    ex: Exercise,
    r: CheckResult,
    ms: number,
    complete = true,
    attempts = 1,
    answer = "",
    wordStep?: Extract<Step, { kind: "exercise" }>,
  ) {
    setStats((s) => ({
      correct: s.correct + (r.correct ? 1 : 0),
      total: s.total + 1,
    }));

    // Результат каждого задания сохраняется на сервере: после reload должны
    // восстанавливаться и упражнения на слова, а не только грамматика.
    await saveExerciseResult({
      dayNumber: plan?.dayNumber ?? 1,
      exerciseId: ex.id,
      attempts,
      correct: r.correct,
      answer,
      expected: r.expected,
      errorKind: r.errorKind ?? null,
    });

    // Для новых слов возвращаем в очередь только ошибочный этап. Остальные
    // этапы слова не повторяются, а retry получает отдельный ID для reload.
    if (
      !r.correct &&
      wordStep?.wordStage !== undefined &&
      ex.lexemeId &&
      plan?.newWords.some((word) => word.id === ex.lexemeId) &&
      (wordStep.wordRetryRound ?? 0) < WORD_STAGE_RETRY_LIMIT &&
      slot?.kind === "step"
    ) {
      const retryRound = (wordStep.wordRetryRound ?? 0) + 1;
      const retryId = `day:${plan.dayNumber}:word-retry:${ex.lexemeId}:${wordStep.wordStage}:${retryRound}:${ex.id}`;
      const retryStep: Step = {
        ...wordStep,
        wordRetryRound: retryRound,
        ex: { ...ex, id: retryId, attemptsAllowed: 1 },
      };
      setSlots((currentSlots) =>
        currentSlots.some(
          (currentSlot) =>
            currentSlot.kind === "step" &&
            currentSlot.step.kind === "exercise" &&
            currentSlot.step.ex.id === retryId,
        )
          ? currentSlots
          : [
              ...currentSlots,
              { kind: "step", stage: slot.stage, step: retryStep },
            ],
      );
    }

    const isNewWordExercise = Boolean(
      ex.lexemeId && plan?.newWords.some((word) => word.id === ex.lexemeId),
    );
    if (ex.lexemeId && !isNewWordExercise) {
      // Обязательный лексический минимум может добрать резервное слово,
      // которого ещё нет в FSRS. Создаём обе стороны карточки перед записью
      // ответа, иначе такое упражнение не влияло бы на дальнейшие повторы.
      await ensureLexemeCards(ex.lexemeId);
      const kind =
        ex.kind === "translate-production"
          ? "lexeme-production"
          : ex.kind === "spelling"
            ? "lexeme-spelling"
            : ex.kind === "listen-write"
              ? "lexeme-listen-write"
              : "lexeme-recognition";
      await recordAnswer(
        `${kind}:${ex.lexemeId}`,
        r.correct ? Rating.Good : Rating.Again,
        ms,
      );
    }
    for (const ruleId of ex.grammarRuleIds) {
      await recordRuleAttempt(ruleId, r.correct, ex.difficulty);
    }
    if (complete) setCanAdvance(true);
  }

  function skipWord(lexemeId: string) {
    setSlots((prev) =>
      prev.filter(
        (s, idx) =>
          idx <= i ||
          !(
            s.kind === "step" &&
            s.step.kind === "exercise" &&
            s.step.ex.lexemeId === lexemeId
          ),
      ),
    );
    next();
  }

  function next() {
    setCanAdvance(false);
    if (
      slot?.kind === "step" &&
      slot.stage.id === "grammar" &&
      slot.step.kind === "exercise"
    ) {
      const lastGrammarIndex = slots.reduce(
        (last, current, index) =>
          current.kind === "step" &&
          current.stage.id === "grammar" &&
          current.step.kind === "exercise"
            ? index
            : last,
        -1,
      );
      if (lastGrammarIndex + 1 < slots.length) {
        setI(lastGrammarIndex + 1);
      } else {
        void finish();
      }
      return;
    }
    if (i + 1 < slots.length) {
      setI(i + 1);
      return;
    }
    void finish();
  }

  async function afterDiagnostic() {
    if (plan) {
      await saveLessonSession({
        id: crypto.randomUUID(),
        dayNumber: plan.dayNumber,
        kind: "day",
        startedAt: new Date(startedAt.current),
        completedAt: new Date(),
        plannedBudgetMs: plan.estimatedSec * 1000,
        actualMs: Date.now() - startedAt.current,
        itemsReviewed: 0,
        itemsCorrect: 0,
      });
    }
    const nextPlan = await buildTodayPlan();
    const nextSlots = toSlots(nextPlan.stages);
    setPlan(nextPlan);
    setSlots(nextSlots);
    setI(0);
    setCanAdvance(false);
    setStats({ correct: 0, total: 0 });
    setSpecial(nextSlots.length ? null : "empty");
    setPhase("main");
    finalizedWords.current.clear();
    startedAt.current = Date.now();
  }

  async function finish() {
    if (plan) {
      await saveLessonSession({
        id: crypto.randomUUID(),
        dayNumber: plan.dayNumber,
        kind: "day",
        startedAt: new Date(startedAt.current),
        completedAt: new Date(),
        plannedBudgetMs: plan.estimatedSec * 1000,
        actualMs: Date.now() - startedAt.current,
        itemsReviewed: stats.total,
        itemsCorrect: stats.correct,
      });
    }
    setPhase("done");
  }

  useEffect(() => {
    if (!plan || !appState || !slots.length || batchResumeInitialized.current)
      return;
    const batchSlots = slots.filter(
      (currentSlot) =>
        currentSlot.kind === "step" && Boolean(currentSlot.batchProgress),
    );
    if (!batchSlots.length) return;
    batchResumeInitialized.current = true;

    const completedIds = new Set(
      appState.exerciseResults
        .filter((row) => row.dayNumber === plan.dayNumber)
        .map((row) => row.exerciseId),
    );
    const completedCount = batchSlots.filter(
      (batchSlot) =>
        batchSlot.kind === "step" &&
        batchSlot.step.kind === "exercise" &&
        completedIds.has(batchSlot.step.ex.id),
    ).length;
    if (!completedCount) return;

    const firstPending = batchSlots.find(
      (batchSlot) =>
        batchSlot.kind === "step" &&
        batchSlot.step.kind === "exercise" &&
        !completedIds.has(batchSlot.step.ex.id),
    );
    if (firstPending) {
      setI(slots.indexOf(firstPending));
      return;
    }

    const lastBatchSlot = batchSlots[batchSlots.length - 1]!;
    const nextIndex = slots.indexOf(lastBatchSlot) + 1;
    if (nextIndex < slots.length) setI(nextIndex);
    else void finish();
  }, [appState, finish, plan, slots]);

  if (!plan) {
    return (
      <Screen>
        <Centered>
          <p className="text-muted">Загрузка…</p>
        </Centered>
      </Screen>
    );
  }

  if (phase === "done") {
    const pct = stats.total
      ? Math.round((stats.correct / stats.total) * 100)
      : 0;
    return (
      <Screen>
        <Centered>
          <Card>
            <Stack gap="md" align="center">
              <span className="text-4xl" aria-hidden>
                {pct >= 70 ? "✓" : "↻"}
              </span>
              <h1 className="text-xl font-semibold">
                День {plan.dayNumber} пройден
              </h1>
              {stats.total > 0 && (
                <p className="text-sm text-muted">
                  Верно {stats.correct} из {stats.total} · {pct}%
                </p>
              )}
              {plan.notes.map((n) => (
                <p key={n} className="text-center text-xs text-warn-ink">
                  {n}
                </p>
              ))}
              <Link href="/" className="w-full">
                <Button variant="outline" size="lg" full>
                  На главный
                </Button>
              </Link>
            </Stack>
          </Card>
        </Centered>
      </Screen>
    );
  }

  if (special === "diagnostic") {
    return (
      <Screen>
        <Centered>
          <Diagnostic onDone={() => void afterDiagnostic()} />
        </Centered>
      </Screen>
    );
  }
  if (special === "empty") {
    return (
      <Screen>
        <Centered>
          <EmptyDay day={plan.day} onDone={() => setPhase("done")} />
        </Centered>
      </Screen>
    );
  }

  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <Row justify="between">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center text-sm text-muted hover:text-ink"
          >
            ← Wyjdź
          </Link>
          <Row gap="sm">
            {slot && (
              <span className="text-sm text-muted">
                {grammarExerciseIndex
                  ? "Gramatyka"
                  : STAGE_TITLE_PL[slot.stage.id]}
                {slot.kind === "step" && (
                  <span className="tabular-nums">
                    {" "}
                    · {grammarExerciseIndex || indexInStage} /{" "}
                    {grammarExerciseIndex
                      ? grammarExerciseSlots.length
                      : stageSlots.length}
                  </span>
                )}
              </span>
            )}
            <ThemePicker />
          </Row>
        </Row>
        <div className="u-hide-on-short mt-2 h-1 overflow-hidden rounded-pill bg-soft">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((i + 1) / Math.max(1, slots.length)) * 100}%` }}
          />
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col justify-start overflow-y-auto overscroll-contain px-4 pb-4">
        {slot?.kind === "stage-start" && (
          <StageStart stage={slot.stage} onNext={next} />
        )}

        {slot?.kind === "step" && slot.step.kind === "word-intro" && (
          <WordIntro
            word={slot.step.word}
            skillProgress={lexemeSkillProgress(appState, slot.step.word.id)}
            nextReview={nextLexemeReview(appState, slot.step.word.id)}
            onMarkedKnown={() =>
              skipWord((slot.step as { word: Lexeme }).word.id)
            }
          />
        )}

        {slot?.kind === "step" && slot.step.kind === "word-intro" && (
          <StudyActionBar
            speakText={slot.step.word.lemma}
            canAdvance
            onNext={next}
            nextLabel="Запомнил"
          />
        )}

        {slot?.kind === "step" && slot.step.kind === "rule-intro" && (
          <Card>
            <Stack gap="lg">
              <RuleView rule={slot.step.rule} />
              <Button size="lg" full onClick={next}>
                Do zadań
              </Button>
            </Stack>
          </Card>
        )}

        {slot?.kind === "step" && slot.step.kind === "exercise-batch" && (
          <Stack gap="md">
            <VocabularyExerciseBatch
              key={slot.step.exercises.map((exercise) => exercise.id).join("|")}
              exercises={slot.step.exercises}
              blockTitle={slot.step.title}
              blockDescription={slot.step.description}
              dayNumber={plan.dayNumber}
              onAnswered={(ex, r, ms, attempts, answer) =>
                void onAnswered(ex, r, ms, false, attempts, answer)
              }
              onComplete={() => void next()}
              onReset={() => setCanAdvance(false)}
            />
          </Stack>
        )}

        {slot?.kind === "step" && slot.step.kind === "exercise" && (
          <Stack gap="md">
            {slot.kind === "step" && slot.batchProgress ? (
              <div className="mx-auto w-full max-w-(--container-exercise)">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold tracking-wide text-muted uppercase">
                      {slot.batchProgress.title}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {slot.batchProgress.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-muted">
                    {slot.batchProgress.index} / {slot.batchProgress.total}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Postęp powtórki słów"
                  aria-valuemin={0}
                  aria-valuemax={slot.batchProgress.total}
                  aria-valuenow={slot.batchProgress.index}
                  className="h-1 overflow-hidden rounded-pill bg-soft"
                >
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${(slot.batchProgress.index / slot.batchProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ) : slot.step.review ? (
              <p className="text-center text-xs tracking-wide text-muted uppercase">
                Powtórka
              </p>
            ) : null}
            {grammarExerciseIndex === 1 ? (
              <GrammarExerciseBatch
                key={grammarExerciseSlots
                  .map((s) =>
                    s.kind === "step" && s.step.kind === "exercise"
                      ? s.step.ex.id
                      : s.kind,
                  )
                  .join("|")}
                exercises={grammarExerciseSlots.flatMap((s) =>
                  s.kind === "step" && s.step.kind === "exercise"
                    ? [s.step.ex]
                    : [],
                )}
                dayNumber={plan.dayNumber}
                onAnswered={(ex, r, ms, attempts, answer) =>
                  void onAnswered(ex, r, ms, false, attempts, answer)
                }
                onComplete={() => void next()}
                onReset={() => setCanAdvance(false)}
              />
            ) : readingTextOf(slot.step.ex) ? (
              <ReadingExerciseBlock
                text={readingTextOf(slot.step.ex)!}
                exercise={slot.step.ex}
                onAnswered={(r, ms) => {
                  const step = slot.step;
                  if (step.kind === "exercise") void onAnswered(step.ex, r, ms);
                }}
              />
            ) : (
              <ExerciseView
                key={`${i}-${slot.step.ex.id}`}
                exercise={slot.step.ex}
                showSpeakButton={!wordStudyExercise}
                topLeftStatus={
                  exerciseLexemeId ? (
                    <LexemeSkillLevel
                      progress={lexemeSkillProgress(appState, exerciseLexemeId)}
                      nextReview={nextLexemeReview(appState, exerciseLexemeId)}
                    />
                  ) : undefined
                }
                topRightAction={
                  reviewLexemeId ? (
                    <KnownToggle
                      lexemeId={reviewLexemeId}
                      removeFromStudy
                      onMarked={(known) => known && skipWord(reviewLexemeId)}
                    />
                  ) : undefined
                }
                restoredResult={restoredResult}
                onAnswered={(r, ms, attempts, answer) => {
                  const step = slot.step;
                  if (step.kind === "exercise") {
                    void onAnswered(
                      step.ex,
                      r,
                      ms,
                      true,
                      attempts,
                      answer,
                      step,
                    );
                  }
                }}
              />
            )}
            <Row gap="sm" justify="center">
              {slot.step.rule && <RuleSheet rule={slot.step.rule} />}
            </Row>
            {wordStudyExercise ? (
              <StudyActionBar
                speakText={speakableTextOf(slot.step.ex)}
                canAdvance={canAdvance || Boolean(restoredResult)}
                onNext={next}
                nextLabel={i + 1 < slots.length ? "Далее" : "Завершить"}
              />
            ) : (
              (canAdvance || Boolean(restoredResult)) && (
                <Button variant="outline" size="lg" full onClick={next}>
                  {i + 1 < slots.length ? "Dalej" : "Zakończ"}
                </Button>
              )
            )}
          </Stack>
        )}
      </main>
    </Screen>
  );
}

function StageStart({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const exercises = stage.steps.reduce(
    (count, step) =>
      count +
      (step.kind === "exercise"
        ? 1
        : step.kind === "exercise-batch"
          ? step.exercises.length
          : 0),
    0,
  );
  return (
    <Card>
      <Stack gap="md" align="center">
        <span className="text-xs tracking-wide text-muted uppercase">
          Blok lekcji
        </span>
        <h1 className="text-xl font-semibold">{STAGE_TITLE_PL[stage.id]}</h1>
        <p className="text-center text-sm text-muted">{STAGE_LEAD[stage.id]}</p>
        {exercises > 0 && (
          <p className="text-sm tabular-nums text-muted">
            {exercises} zadań ·{" "}
            {Math.max(1, Math.round(stage.estimatedSec / 60))} min
          </p>
        )}
        {stage.missingContent && (
          <p className="rounded-card bg-warn-bg px-3 py-2 text-center text-sm text-warn-ink">
            Blok nie jest jeszcze gotowy: {stage.missingContent}
          </p>
        )}
        <Button variant="outline" size="lg" full onClick={onNext}>
          {stage.steps.length ? "Rozpocznij blok" : "Pomiń"}
        </Button>
      </Stack>
    </Card>
  );
}

function WordIntro({
  word,
  skillProgress,
  nextReview,
  onMarkedKnown,
}: {
  word: Lexeme;
  skillProgress: ReturnType<typeof lexemeSkillProgress>;
  nextReview: ReturnType<typeof nextLexemeReview>;
  onMarkedKnown: () => void;
}) {
  return (
    <Card>
      <Stack gap="lg" align="center">
        <span className="text-xs tracking-wide text-muted uppercase">
          Nowe słowo
        </span>
        <div className="text-center text-3xl font-semibold">{word.lemma}</div>
        <div className="text-center text-lg">{word.translation}</div>

        {word.interference && (
          <p className="rounded-card bg-warn-bg px-3 py-2 text-center text-sm text-warn-ink">
            Nie „{word.interference.confusedWith}”!
            <br />„{word.interference.confusedWith}” po polsku to{" "}
            <strong>{word.interference.actuallyIs}</strong>.
          </p>
        )}
        {word.aspectPair?.perfective && (
          <p className="text-sm text-muted">
            aspekt dokonany:{" "}
            <span className="text-accent-ink">
              {word.aspectPair.perfective}
            </span>
          </p>
        )}
        {word.government && (
          <p className="text-sm text-muted">rekcja: {word.government}</p>
        )}

        <LexemeSkillLevel progress={skillProgress} nextReview={nextReview} />
        <Row gap="sm" wrap justify="center">
          <KnownToggle
            lexemeId={word.id}
            polishLabels
            removeFromStudy
            onMarked={(known) => known && onMarkedKnown()}
          />
        </Row>
      </Stack>
    </Card>
  );
}

const SKILL_INDICATORS = {
  "lexeme-recognition": {
    label: "Перевод",
    description: "Понять значение польского слова",
    icon: "M2 5h12M7 2h1M13 2c0 7-5 12-11 14M4 9c1 3 4 5 7 6m1 7 5-11 5 11m-8.5-3h7",
  },
  "lexeme-production": {
    label: "Вспомнить слово",
    description: "Вспомнить польское слово по переводу",
    icon: "M12 18V5a3 3 0 0 0-5.9-.7 4 4 0 0 0-2.1 6.8 4 4 0 0 0 1.1 7A3.5 3.5 0 0 0 12 18Zm0 0V5a3 3 0 0 1 5.9-.7 4 4 0 0 1 2.1 6.8 4 4 0 0 1-1.1 7A3.5 3.5 0 0 1 12 18ZM6 5v2m12-2v2m-6 8a4 4 0 0 0-4-4m4 4a4 4 0 0 1 4-4",
  },
  "lexeme-spelling": {
    label: "Написать по буквам",
    description: "Вспомнить, как пишется польское слово",
    icon: "M3 14 7 4l4 10M4.5 10h5M14 13V4h3a2.25 2.25 0 0 1 0 4.5h-3m3 0a2.25 2.25 0 0 1 0 4.5h-3m-3 6 3 3 6-6",
  },
  "lexeme-listen-write": {
    label: "Написать на слух",
    description: "Прослушать слово и написать его",
    icon: "M3 14v-3a9 9 0 0 1 18 0v3M3 13h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm18 0h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2Z",
  },
} satisfies Record<(typeof LEXEME_SKILL_KINDS)[number], {
  label: string;
  description: string;
  icon: string;
}>;

function skillLevel(value: number | undefined) {
  if (value === undefined) return { label: "Не проверено", color: "text-muted" };
  if (value < 50) return { label: "Начал изучать", color: "text-skill-start" };
  if (value < 70) return { label: "Уже знакомо", color: "text-skill-familiar" };
  if (value < 85) return { label: "Почти освоено", color: "text-skill-near" };
  return { label: "Освоено", color: "text-skill-strong" };
}

const REVIEW_DATE_FORMAT = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const MILLISECONDS_PER_DAY = 86_400_000;

function reviewBadge(daysUntilReview: number | null): string {
  if (daysUntilReview === null) return "—";
  if (daysUntilReview <= 0) return "Пора";
  if (daysUntilReview < 1) return "<1д";
  if (daysUntilReview > 7) return "7+";
  return `${Math.ceil(daysUntilReview)}д`;
}

function reviewColor(daysUntilReview: number | null): string {
  if (daysUntilReview === null) return "text-muted";
  if (daysUntilReview <= 0) return "text-danger-ink";
  if (daysUntilReview <= 1) return "text-warn-ink";
  if (daysUntilReview <= 7) return "text-skill-familiar";
  return "text-review-far";
}

function IndicatorArc({ value }: { value: number }) {
  return (
    <>
      <circle cx="20" cy="20" r="17" className="stroke-line" strokeWidth="3" />
      {value > 0 && (
        <circle
          cx="20" cy="20" r="17" pathLength="100"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${value} 100`}
          transform="rotate(-90 20 20)"
        />
      )}
    </>
  );
}

function LexemeSkillLevel({
  progress,
  nextReview,
}: {
  progress: ReturnType<typeof lexemeSkillProgress>;
  nextReview: ReturnType<typeof nextLexemeReview>;
}) {
  const daysUntilReview = nextReview
    ? (nextReview.due.getTime() - Date.now()) / MILLISECONDS_PER_DAY
    : null;
  const reviewDue = daysUntilReview !== null && daysUntilReview <= 0;
  const reviewBadgeText = reviewBadge(daysUntilReview);
  const reviewFill = daysUntilReview === null
    ? 0
    : 100 - (90 * Math.min(7, Math.max(0, daysUntilReview))) / 7;
  const reviewDescription = nextReview
    ? `${reviewDue ? "Пора повторить. Оптимальный срок был" : "Оптимально повторить"} ${REVIEW_DATE_FORMAT.format(nextReview.due)}. Навык «${SKILL_INDICATORS[nextReview.kind].label}».`
    : "Повторение ещё не запланировано.";

  return (
    <div
      role="group"
      aria-label="Шкала повторения слова"
    >
      <div className="mb-1 flex items-center gap-1.5">
        <p className="text-xs text-muted">Уровень освоения</p>
        <StudyTooltip
          description="Длина дуги показывает, как даётся навык. Правильный ответ удлиняет дугу, ошибка укорачивает. Цвет обозначает уровень."
          openOnActivation
        >
          <button
            type="button"
            aria-label="Что означает уровень освоения"
            className="flex size-5 items-center justify-center rounded-pill bg-soft text-xs font-semibold text-muted hover:text-ink"
          >
            i
          </button>
        </StudyTooltip>
      </div>
      <div className="flex flex-wrap gap-1">
        {LEXEME_SKILL_KINDS.map((kind) => {
          const { label, description, icon } = SKILL_INDICATORS[kind];
          const result = progress[kind];
          const value = result?.value ?? 0;
          const level = skillLevel(result?.value);
          const details = result
            ? `${description}\nВерно ${result.correct} из ${result.attempts}.`
            : description;

          return (
            <StudyTooltip
              key={kind}
              description={`${label} · ${level.label}\n${details}`}
              openOnActivation
            >
              <button
                type="button"
                aria-label={`${label}: ${level.label}`}
                className={`grid size-11 place-items-center rounded-pill hover:bg-soft ${level.color}`}
              >
                <svg aria-hidden="true" className="size-10" viewBox="0 0 40 40" fill="none">
                  <IndicatorArc value={value} />
                  <svg x="11" y="11" width="18" height="18" viewBox="0 0 24 24">
                    <path d={icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </svg>
              </button>
            </StudyTooltip>
          );
        })}
        <StudyTooltip description={reviewDescription} openOnActivation>
          <button
            type="button"
            aria-label={nextReview ? `Следующее повторение — ${reviewBadgeText}` : reviewDescription}
            className={`grid size-11 place-items-center rounded-pill hover:bg-soft ${reviewColor(daysUntilReview)}`}
          >
            <svg aria-hidden="true" className="size-10" viewBox="0 0 40 40" fill="none">
              <IndicatorArc value={reviewFill} />
              <text
                x="20"
                y="20"
                dominantBaseline="central"
                textAnchor="middle"
                fill="currentColor"
                fontSize="11"
                className="font-semibold tabular-nums"
              >
                {reviewBadgeText}
              </text>
            </svg>
          </button>
        </StudyTooltip>
      </div>
    </div>
  );
}

function readingTextOf(exercise: Exercise): string | null {
  return exercise.mode === "choice" && exercise.kind === "reading-choice"
    ? (exercise.readingText ?? null)
    : null;
}

function ReadingExerciseBlock({
  text,
  exercise,
  onAnswered,
}: {
  text: string;
  exercise: Exercise;
  onAnswered: (r: CheckResult, ms: number) => void;
}) {
  return (
    <Card>
      <Stack gap="lg">
        <section className="w-full rounded-card bg-soft2 p-4" lang="pl">
          <p className="mb-2 text-xs tracking-wide text-muted uppercase">
            Tekst
          </p>
          <p className="whitespace-pre-wrap text-left text-base leading-7">
            {text}
          </p>
        </section>
        <ExerciseView
          key={exercise.id}
          exercise={exercise}
          bare
          showReadingText={false}
          onAnswered={onAnswered}
        />
      </Stack>
    </Card>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4">
      {children}
    </div>
  );
}
