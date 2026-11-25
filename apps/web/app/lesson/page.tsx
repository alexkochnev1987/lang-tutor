"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrainstormPractice } from "@/app/_components/BrainstormPractice";
import { LoadingSlot, SkeletonBlock } from "@/app/_components/LoadingSkeleton";
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
  LEXEME_SKILL_KINDS,
  lexemeSkillProgress,
  nextLexemeReview,
  prepareLexemeReview,
  recordRuleAttempt,
  Rating,
} from "@/lib/engine/session";
import {
  getCachedDailyWords,
  getLoadedState,
  loadDailyWords,
  queueDailyWordAnswer,
  saveExerciseResult,
  saveLessonSession,
  useAppState,
} from "@/lib/data/store";
import {
  ExerciseView,
  GrammarExerciseBatch,
  VocabularyExerciseBatch,
} from "@/app/_components/ExerciseView";
import { RuleSheet } from "@/app/_components/RuleSheet";
import { RuleView } from "@/app/_components/RuleView";
import { Diagnostic } from "@/app/_components/Diagnostic";
import { EmptyDay } from "@/app/_components/EmptyDay";
import { KnownToggle } from "@/app/_components/WordRow";
import { StudyTooltip } from "@/app/_components/StudyTooltip";
import { useSaveLessonResult } from "@/app/_components/useSaveLessonResult";
import type { Lexeme } from "@/lib/content/curriculum";
import { lessonPhraseFor } from "@/lib/content/lesson-phrases";
import { LessonPhrasePractice } from "@/app/_components/LessonPhrasePractice";
import { formatOfWordExercise, wordSkill } from "@/lib/engine/daily-words";
import { WeeklyGoalCredit } from "@/app/_components/WeeklyGoal";
import { WordPracticeFooter } from "@/app/_components/WordPracticeFooter";
import { WordPracticeScreen } from "@/app/_components/WordPracticeScreen";
import { WordSaveIndicator } from "@/app/_components/WordSaveIndicator";
import { useTranslations } from "next-intl";
import { assignmentProgress, isAssignedStage, stageExerciseIds } from '@/lib/engine/lesson-assignments';


type ReviewWrite = {
  lexemeId: string;
  status: "pending" | "error";
  retry: () => void;
};

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
  brainstorm: "Poznajemy nowe słowa: cztery zadania na każde.",
  words: "Powtarzamy poznane słowa. Gramatyka będzie osobnym blokiem.",
  grammar: "Najpierw reguła, potem ćwiczenia. Regułę otworzysz przyciskiem.",
  collocations: "Łączymy znane słowa. Każde słowo ćwiczy własną regułę.",
  reading: "Przeczytaj tekst i odpowiedz na pytania.",
  exam: "Zadanie w formacie egzaminacyjnym: reguły są wymieszane jak na prawdziwym arkuszu.",
};

const STAGE_TITLE_PL: Record<StageId, string> = {
  brainstorm: "Nowe słowa",
  words: "Słowa",
  grammar: "Gramatyka",
  collocations: "Połączenia słów",
  reading: "Czytanie",
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

function resumeIndex(slots: Slot[], day: number) {
  const done = new Set((getLoadedState()?.exerciseResults ?? []).filter(row => row.dayNumber === day).map(row => row.exerciseId));
  const index = slots.findIndex(slot => {
    if (!isAssignedStage(slot.stage.id)) return true;
    if (slot.kind !== "stage-start") return false;
    const ids = stageExerciseIds(slot.stage);
    return Boolean(slot.stage.missingContent) || ids.some(id => !done.has(id));
  });
  return index >= 0 ? index : Math.max(0, slots.length - 1);
}
export default function LessonPage() {
  const router = useRouter();
  const [brainstormId] = useState(() => crypto.randomUUID());
  const appState = useAppState();
  const common = useTranslations("common");
  const t = useTranslations("dailyWords");
  const [planError, setPlanError] = useState(false);
  const [planAttempt, setPlanAttempt] = useState(0);
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [i, setI] = useState(0);
  const [canAdvance, setCanAdvance] = useState(false);
  const [pendingAnswers, setPendingAnswers] = useState(0);
  const [answerFailures, setAnswerFailures] = useState<Record<string, () => void>>({});
  const pendingAnswerIds = useRef(new Set<string>());
  const failedAnswerIds = useRef(new Set<string>());
  const wordStats = useRef({ correct: 0, total: 0 });
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [phase, setPhase] = useState<"main" | "done">("main");
  const [special, setSpecial] = useState<"diagnostic" | "empty" | null>(null);
  const startedAt = useRef(Date.now());
  const wordMain = useRef<HTMLElement>(null);
  const [reviewWrites, setReviewWrites] = useState<Record<string, ReviewWrite>>({});
  const queuedWordExercises = useRef(new Set<string>());
  const lessonSave = useSaveLessonResult();
  const [queueStatus, setQueueStatus] = useState<"ready" | "checking" | "error">("ready");
  const [unavailableWord, setUnavailableWord] = useState(false);

  useEffect(() => {
    let alive = true;
    setPlanError(false);
    buildTodayPlan(true).then((p) => {
      if (!alive) return;
      setPlan(p);
      const main = toSlots(p.stages);
      if (p.day.kind === "diagnostic") {
        setSlots([]);
        setSpecial("diagnostic");
      } else {
        setSlots(main);
        setI(resumeIndex(main, p.dayNumber));
        const restored = assignmentProgress(p.stages, getLoadedState()?.exerciseResults ?? [], p.dayNumber);
        setStats({ correct: restored.correct, total: restored.answered });
        setSpecial(main.length ? null : "empty");
      }
    }).catch(() => { if (alive) setPlanError(true); });
    return () => {
      alive = false;
    };
  }, [planAttempt]);

  const slot = slots[i];
  const wordScreen = slot?.stage.id === "words";
  const wordExercise = slot?.kind === "step" && slot.step.kind === "exercise"
    && wordScreen && slot.step.ex.lexemeId ? slot.step.ex : undefined;
  const wordStudyExercise = Boolean(wordExercise);
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
  const reviewPending = Object.values(reviewWrites).some(
    (write) => write.lexemeId === exerciseLexemeId && write.status === "pending",
  );
  const failedReview = Object.values(reviewWrites).find((write) => write.status === "error");
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

  const trackReviewWrite = useCallback((key: string, lexemeId: string, save: () => Promise<boolean>) => {
    let writing = false;

    async function persist() {
      if (writing) return;
      writing = true;
      const retry = () => void persist();
      setReviewWrites((writes) => ({
        ...writes,
        [key]: { lexemeId, status: "pending", retry },
      }));
      try {
        const saved = await save();
        setReviewWrites((writes) => {
          if (!saved) return { ...writes, [key]: { lexemeId, status: "error", retry } };
          const remaining = { ...writes };
          delete remaining[key];
          return remaining;
        });
      } catch (error) {
        console.error("[review]", error);
        setReviewWrites((writes) => ({ ...writes, [key]: { lexemeId, status: "error", retry } }));
      } finally {
        writing = false;
      }
    }

    return persist();
  }, []);

  async function onAnswered(
    ex: Exercise,
    r: CheckResult,
    ms: number,
    complete = true,
    attempts = 1,
    answer = "",
  ) {
    const exerciseResult = {
      dayNumber: plan?.dayNumber ?? 1,
      exerciseId: ex.id,
      attempts,
      correct: r.correct,
      answer,
      expected: r.expected,
      errorKind: r.errorKind ?? null,
    };
    if (slot?.stage.id === "words" && ex.lexemeId) {
      if (queuedWordExercises.current.has(ex.id)) return;
      const lexemeId = ex.lexemeId;
      const format = formatOfWordExercise(ex);
      const payload = {
        ...prepareLexemeReview(appState?.studyItems ?? [], lexemeId,
          wordSkill(format), r.correct ? Rating.Good : Rating.Again, ms),
        format,
        result: exerciseResult,
      };
      queuedWordExercises.current.add(ex.id);
      wordStats.current = { correct: wordStats.current.correct + Number(r.correct), total: wordStats.current.total + 1 };
      setStats((previous) => ({
        correct: previous.correct + Number(r.correct), total: previous.total + 1,
      }));
      if (complete) setCanAdvance(true);
      // Enqueue instantly; the global outbox owns the network request,
      // retry, rollback and visible background-save status.
      void trackReviewWrite(ex.id, lexemeId, async () => {
        queueDailyWordAnswer(payload);
        setUnavailableWord(false);
        return true;
      });
      return;
    }
    async function persist() {
      if (pendingAnswerIds.current.has(ex.id)) return;
      pendingAnswerIds.current.add(ex.id);
      setPendingAnswers(pendingAnswerIds.current.size);
      try {
        const saved = await saveExerciseResult(exerciseResult);
        if (!saved) throw new Error("exercise_save_failed");
        failedAnswerIds.current.delete(ex.id);
        setAnswerFailures(previous => {
          const next = { ...previous }; delete next[ex.id]; return next;
        });
        for (const ruleId of ex.grammarRuleIds) {
          await recordRuleAttempt(ruleId, r.correct, ex.difficulty).catch(error => console.error("[rule-mastery]", error));
        }
        if (complete) setCanAdvance(true);
      } catch {
        failedAnswerIds.current.add(ex.id);
        setAnswerFailures(previous => ({ ...previous, [ex.id]: () => void persist() }));
      } finally {
        pendingAnswerIds.current.delete(ex.id);
        setPendingAnswers(pendingAnswerIds.current.size);
      }
    }
    await persist();
  }

  function skipWord() {
    // The known-word toggle updates the UI before its API request finishes.
    void advanceWordBlock(exerciseLexemeId);
  }

  function next() {
    if (lessonSave.status === "saving" || queueStatus === "checking" || pendingAnswerIds.current.size || failedAnswerIds.current.size) return;
    if (slot?.stage.id === "words") {
      void advanceWordBlock();
      return;
    }
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

  function advanceWordBlock(skippedId?: string) {
    const queue = getCachedDailyWords();
    const available = queue ? new Set([...queue.learn, ...queue.review]) : null;
    const upcoming = slots.slice(i + 1).filter((candidate) => {
      if (candidate.kind !== "step" || candidate.stage.id !== "words") return true;
      const nextStep = candidate.step;
      const id = nextStep.kind === "exercise" ? nextStep.ex.lexemeId : undefined;
      return !id || (id !== skippedId && (!available || available.has(id)));
    });
    setQueueStatus("ready");
    setCanAdvance(false);
    setUnavailableWord(false);
    if (!upcoming.length) {
      void finish();
      return;
    }
    setSlots([...slots.slice(0, i + 1), ...upcoming]);
    setI(i + 1);
    wordMain.current?.scrollTo({ top: 0 });
    // Do not block navigation while reconciling with the server.
    void loadDailyWords().catch(() => setQueueStatus("error"));
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
    const nextPlan = await buildTodayPlan(true);
    const nextSlots = toSlots(nextPlan.stages);
    setPlan(nextPlan);
    setSlots(nextSlots);
    setI(0);
    setCanAdvance(false);
    setStats({ correct: 0, total: 0 });
    wordStats.current = { correct: 0, total: 0 };
    setSpecial(nextSlots.length ? null : "empty");
    setPhase("main");
    startedAt.current = Date.now();
  }

  async function finish() {
    if (pendingAnswerIds.current.size || failedAnswerIds.current.size) return;
    if (plan) {
      const assigned = assignmentProgress(plan.stages, getLoadedState()?.exerciseResults ?? [], plan.dayNumber);
      const finalStats = { correct: assigned.correct + wordStats.current.correct, total: assigned.answered + wordStats.current.total };
      setStats(finalStats);
      const saved = await lessonSave.save({
        dayNumber: plan.dayNumber,
        kind: "day",
        startedAt: new Date(startedAt.current),
        completedAt: new Date(),
        plannedBudgetMs: plan.estimatedSec * 1000,
        actualMs: Date.now() - startedAt.current,
        itemsReviewed: finalStats.total,
        itemsCorrect: finalStats.correct,
      });
      if (!saved) return;
    }
    setPhase("done");
  }


  if (!plan) {
    return <LessonLayout status={<SkeletonBlock className="h-5 w-28" />} progress={0}>
      <LoadingSlot loading={!planError} label={common("loadingLesson")} fallback={<StageStartCard />}>
        <Card><Button full onClick={() => setPlanAttempt((attempt) => attempt + 1)}>{t("reload")}</Button></Card>
      </LoadingSlot>
    </LessonLayout>;
  }

  const phrase = lessonPhraseFor(plan.dayNumber, appState?.settings.targetLanguage ?? "pl");
  const phrasePractice = phrase
    ? <LessonPhrasePractice key={plan.dayNumber} day={plan.dayNumber} phrase={phrase} />
    : undefined;

  const reviewFeedback = failedReview ? (
    <div role="alert" className="my-2 flex flex-wrap items-center justify-between gap-2 text-sm text-danger-ink">
      <span>Не удалось сохранить срок повторения.</span>
      <Button variant="outline" size="sm" onClick={failedReview.retry}>Повторить</Button>
    </div>
  ) : null;

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
              <WeeklyGoalCredit />
              {reviewFeedback}
              <WordSaveIndicator />
              {phrasePractice}
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
          <Diagnostic onDone={() => void afterDiagnostic()} phrasePractice={phrasePractice} />
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

  if (slot?.kind === "step" && slot.step.kind === "brainstorm") {
    return <BrainstormPractice
      key={brainstormId}
      id={brainstormId}
      words={slot.step.words}
      pool={slot.step.pool}
      dayNumber={plan.dayNumber}
      canContinue
      checking={false}
      loadError={false}
      onConsume={(_wordId, correct = 0, total = 0) => {
        wordStats.current = { correct: wordStats.current.correct + correct, total: wordStats.current.total + total };
        setStats((previous) => ({
          correct: previous.correct + correct,
          total: previous.total + total,
        }));
      }}
      onContinue={next}
      onExit={() => router.push("/")}
    />;
  }

  const screenNotices = <>
        {reviewFeedback}
        {Object.entries(answerFailures).map(([id,retry]) => <div key={id} role="alert" className="my-2 flex items-center justify-between gap-2 text-sm text-danger-ink"><span>Не удалось сохранить ответ.</span><Button variant="outline" size="sm" disabled={pendingAnswers > 0} onClick={retry}>Повторить</Button></div>)}
        {unavailableWord && <p role="status" className="text-sm text-muted">{t("unavailable")}</p>}
        {queueStatus === "error" && <p role="alert" className="text-sm text-danger-ink">{t("error")}</p>}
        {lessonSave.status === "saving" && !restoredResult && !wordStudyExercise && (
          <p role="status" className="my-2 text-sm text-muted">Сохраняем итог…</p>
        )}
        {lessonSave.status === "error" && (
          <div role="alert" className="my-2 flex flex-wrap items-center justify-between gap-2 text-sm text-danger-ink">
            <span>Не удалось сохранить итог.</span>
            <Button variant="outline" size="sm" onClick={() => void finish()}>Повторить</Button>
          </div>
        )}
  </>;

  return (
    <LessonLayout wordScreen={wordScreen} mainRef={wordMain}
      status={<>{slot && (
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
            )}</>}
      progress={((i + 1) / Math.max(1, slots.length)) * 100}
      footer={wordScreen && slot?.kind === "step" && (
        <WordPracticeFooter
          busyLabel={lessonSave.status === "saving" ? t("saving") : undefined}
          label={failedReview ? t("retry") : t("next")}
          disabled={lessonSave.status === "saving"
            || (wordStudyExercise && slot.step.kind === "exercise"
              && !canAdvance && !restoredResult && !failedReview)}
          onNext={failedReview ? failedReview.retry : next}
        />
      )}>
        {!wordScreen && screenNotices}
        {slot?.kind === "stage-start" && (
          <StageStart stage={slot.stage} onNext={next} />
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
              onComplete={() => setCanAdvance(true)}
              canReset={pendingAnswers === 0 && Object.keys(answerFailures).length === 0}
              onReset={() => setCanAdvance(false)}
            />
            {canAdvance && <Button full size="lg" disabled={pendingAnswers > 0 || Object.keys(answerFailures).length > 0} onClick={next}>Dalej</Button>}
          </Stack>
        )}

        {slot?.kind === "step" && slot.step.kind === "exercise" && (
          <Stack gap={wordStudyExercise ? "xs" : "md"}>
            {!wordStudyExercise && slot.kind === "step" && slot.batchProgress ? (
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
            ) : !wordStudyExercise && slot.step.review ? (
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
                onComplete={() => setCanAdvance(true)}
                canReset={pendingAnswers === 0 && Object.keys(answerFailures).length === 0}
                onReset={() => setCanAdvance(false)}
              />
            ) : readingTextOf(slot.step.ex) ? (
              <ReadingExerciseBlock
                text={readingTextOf(slot.step.ex)!}
                exercise={slot.step.ex}
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
                    );
                  }
                }}
              />
            ) : (
              <ExerciseView
                key={`${i}-${slot.step.ex.id}`}
                exercise={slot.step.ex}
                showSpeakButton={!wordStudyExercise || formatOfWordExercise(slot.step.ex) === "translation" || Boolean(restoredResult)}
                practice={Boolean(wordStudyExercise)}
                topLeftStatus={
                  exerciseLexemeId ? (
                    <LexemeSkillLevel
                      progress={lexemeSkillProgress(appState, exerciseLexemeId)}
                      nextReview={nextLexemeReview(appState, exerciseLexemeId)}
                      reviewPending={reviewPending}
                      compact={wordStudyExercise}
                    />
                  ) : undefined
                }
                topRightAction={
                  reviewLexemeId ? (
                    <KnownToggle
                      lexemeId={reviewLexemeId}
                      removeFromStudy
                      iconOnly={wordStudyExercise}
                      onMarked={(known) => known && skipWord()}
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
                    );
                  }
                }}
              />
            )}
            {slot.step.newWord && (
              <details key={slot.step.newWord.id} className="text-sm">
                <summary className="cursor-pointer">Nowe słowo</summary>
                <WordIntro word={slot.step.newWord}
                  skillProgress={lexemeSkillProgress(appState, slot.step.newWord.id)}
                  nextReview={nextLexemeReview(appState, slot.step.newWord.id)}
                  onMarkedKnown={skipWord} />
              </details>
            )}
            <Row gap="sm" justify="center">
              {slot.step.rule && <RuleSheet rule={slot.step.rule} />}
            </Row>
            {!wordStudyExercise && (canAdvance || Boolean(restoredResult) || lessonSave.status === "saving") && (
              <Button size="lg" full disabled={pendingAnswers > 0 || Object.keys(answerFailures).length > 0} busy={lessonSave.status === "saving"} busyLabel="Сохраняем итог…" onClick={next}>
                {i + 1 < slots.length ? "Dalej" : "Zakończ"}
              </Button>
            )}
          </Stack>
        )}
        {wordScreen && screenNotices}
    </LessonLayout>
  );
}

function LessonLayout({ children, status, progress, wordScreen = false, footer, mainRef }: {
  children: React.ReactNode; status: React.ReactNode; progress: number; wordScreen?: boolean;
  footer?: React.ReactNode; mainRef?: React.Ref<HTMLElement>;
}) {
  return <WordPracticeScreen enabled={wordScreen}>
    <header className="mx-auto w-full max-w-2xl px-4 py-3">
      <Row justify="between">
        <Link href="/" className="inline-flex min-h-10 items-center text-sm text-muted hover:text-ink">← Wyjdź</Link>
        <Row gap="sm">{status}</Row>
      </Row>
      <div className={`mt-2 h-1 overflow-hidden rounded-pill bg-soft ${wordScreen ? "" : "u-hide-on-short"}`}>
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
    </header>
    <main ref={mainRef} className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col justify-start overflow-y-auto overscroll-contain px-4 pb-4">
      {children}
    </main>
    {footer}
  </WordPracticeScreen>;
}

function StageStartCard({ children }: { children?: React.ReactNode }) {
  return <Card>
    <Stack gap="md" align="center">
      <span className="text-xs tracking-wide text-muted uppercase">Blok lekcji</span>
      {children ?? <>
        <SkeletonBlock className="h-8 w-2/3" />
        <SkeletonBlock className="h-5 w-4/5" />
        <SkeletonBlock className="h-5 w-1/3" />
        <SkeletonBlock className="h-14 w-full" />
      </>}
    </Stack>
  </Card>;
}

function StageStart({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const exercises = stage.steps.reduce(
    (count, step) =>
      count +
      (step.kind === "brainstorm"
        ? step.words.length * 4
        : step.kind === "exercise"
          ? 1
          : step.kind === "exercise-batch"
            ? step.exercises.length
            : 0),
    0,
  );
  return (
    <StageStartCard>
        <h1 className="text-2xl font-semibold tracking-tight">{STAGE_TITLE_PL[stage.id]}</h1>
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
    </StageStartCard>
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
  "lexeme-pronunciation": {
    label: "Произнести слово",
    description: "Произнести польский перевод и проверить распознанное слово",
    icon: "M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V5Zm-3 6a6 6 0 0 0 12 0m-6 6v4m-3 0h6",
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
  reviewPending = false,
  compact = false,
}: {
  progress: ReturnType<typeof lexemeSkillProgress>;
  nextReview: ReturnType<typeof nextLexemeReview>;
  reviewPending?: boolean;
  compact?: boolean;
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
      {!compact && <div className="mb-1 flex items-center gap-1.5">
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
      </div>}
      <div className={compact ? "grid grid-cols-6 items-center gap-0.5" : "flex flex-wrap gap-1"}>
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
                className={`grid place-items-center rounded-pill hover:bg-soft ${compact ? "min-h-11 w-full max-w-11 min-w-0" : "size-11"} ${level.color}`}
              >
                <svg aria-hidden="true" className="size-10 max-w-full" viewBox="0 0 40 40" fill="none">
                  <IndicatorArc value={value} />
                  <svg x="11" y="11" width="18" height="18" viewBox="0 0 24 24">
                    <path d={icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </svg>
              </button>
            </StudyTooltip>
          );
        })}
        <StudyTooltip description={reviewPending ? "Назначаем повторение…" : reviewDescription} openOnActivation>
          <button
            type="button"
            aria-label={reviewPending ? "Назначаем повторение…" : nextReview ? `Следующее повторение — ${reviewBadgeText}` : reviewDescription}
            aria-busy={reviewPending}
            className={`grid place-items-center rounded-pill hover:bg-soft ${compact ? "min-h-11 w-full max-w-11 min-w-0" : "size-11"} ${reviewColor(daysUntilReview)}`}
          >
            <svg aria-hidden="true" className="size-10 max-w-full" viewBox="0 0 40 40" fill="none">
              <IndicatorArc value={reviewPending ? 0 : reviewFill} />
              {reviewPending && (
                <circle
                  cx="20" cy="20" r="17" pathLength="100"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  strokeDasharray="25 100"
                  className="origin-center text-primary motion-safe:animate-spin"
                />
              )}
              <text
                x="20"
                y="20"
                dominantBaseline="central"
                textAnchor="middle"
                fill="currentColor"
                fontSize="11"
                className="font-semibold tabular-nums"
              >
                {(!reviewPending || nextReview) && reviewBadgeText}
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
  restoredResult,
  onAnswered,
}: {
  text: string;
  exercise: Exercise;
  restoredResult?: React.ComponentProps<typeof ExerciseView>["restoredResult"];
  onAnswered: (
    r: CheckResult,
    ms: number,
    attempts: number,
    answer: string,
  ) => void;
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
          restoredResult={restoredResult}
          onAnswered={onAnswered}
        />
      </Stack>
    </Card>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-4">
      {children}
    </div>
  );
}
