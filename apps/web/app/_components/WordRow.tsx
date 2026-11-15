"use client";

import { Row } from "@polski/ui";
import { StudyTooltip } from "./StudyTooltip";
import { usePronounce } from "@/lib/speech/usePronounce";
import { setLexemeKnown, useAppState } from "@/lib/data/store";
import type { Lexeme } from "@/lib/content/curriculum";
import {
  getLexemeStudyStatus,
  type LexemeStudyStatus,
} from "@/lib/engine/word-status";

const BADGE: Record<
  Lexeme["transparency"],
  { text: string; cls: string } | null
> = {
  transparent: null,
  partial: null,
  opaque: null,
  "false-friend": {
    text: "fałszywy przyjaciel",
    cls: "bg-warn-bg text-warn-ink",
  },
};

export function WordRow({
  word,
  completed = false,
}: {
  word: Lexeme;
  completed?: boolean;
}) {
  const { pronounce, message } = usePronounce();
  const state = useAppState();
  const badge = BADGE[word.transparency];
  const known =
    state?.lexemeStatus.some(
      (l) => l.lexemeId === word.id && l.status === "known",
    ) ?? false;
  const studyStatus = getLexemeStudyStatus(state, word.id);

  return (
    <div className="border-b border-line py-2 last:border-0">
      <Row gap="sm" justify="between">
        <Row gap="sm">
          <button
            type="button"
            onClick={() => pronounce(word.lemma)}
            aria-label={`Wymów ${word.lemma}`}
            className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-soft text-base hover:bg-soft2"
          >
            {message ? "🔇" : "🔊"}
          </button>
          <div>
            <div
              className={`text-base font-medium ${known ? "text-muted" : ""}`}
            >
              {word.lemma}
            </div>
            <div className="text-sm text-muted">{word.translation}</div>
            <StudyStatusBadge status={studyStatus} />
          </div>
        </Row>
        <Row gap="xs">
          {badge && !known && (
            <span
              className={`shrink-0 rounded-pill px-2 py-0.5 text-xs ${badge.cls}`}
            >
              {badge.text}
            </span>
          )}
          <KnownToggle lexemeId={word.id} polishLabels />
        </Row>
      </Row>

      {completed && !known && (
        <p className="mt-1 ml-12 text-xs text-ok-ink">
          ✓ слово пройдено и добавлено в повторение
        </p>
      )}

      {!known && word.interference && (
        <p className="mt-1 ml-12 text-xs text-muted">
          nie „{word.interference.confusedWith}” — po polsku to{" "}
          <span className="text-warn-ink">{word.interference.actuallyIs}</span>
        </p>
      )}
      {!known && word.aspectPair?.perfective && (
        <p className="mt-1 ml-12 text-xs text-muted">
          aspekt dokonany:{" "}
          <span className="text-accent-ink">{word.aspectPair.perfective}</span>
        </p>
      )}
      {!known && word.government && (
        <p className="mt-1 ml-12 text-xs text-muted">
          rekcja: {word.government}
        </p>
      )}
      {message && (
        <p role="status" className="mt-1 ml-12 text-xs text-danger">
          {message}
        </p>
      )}
    </div>
  );
}

export function KnownToggle({
  lexemeId,
  onMarked,
  polishLabels = false,
  removeFromStudy = false,
}: {
  lexemeId: string;
  onMarked?: (known: boolean) => void;
  polishLabels?: boolean;
  removeFromStudy?: boolean;
}) {
  const state = useAppState();
  const known =
    state?.lexemeStatus.some(
      (l) => l.lexemeId === lexemeId && l.status === "known",
    ) ?? false;
  const toggleKnown = () => {
    void setLexemeKnown(lexemeId, !known);
    onMarked?.(!known);
  };

  if (removeFromStudy) {
    const label = polishLabels
      ? known ? "Przywróć" : "Usuń"
      : known ? "Вернуть" : "Убрать";
    const description = polishLabels
      ? known
        ? "Przywraca słowo do ćwiczeń."
        : "Pomija to słowo w obecnej lekcji i w kolejnych powtórkach. Możesz je przywrócić na liście słów."
      : known
        ? "Возвращает слово в упражнения."
        : "Пропускает это слово в текущем уроке и будущих повторах. Вернуть его можно в списке слов.";

    return (
      <StudyTooltip description={description}>
        <button
          type="button"
          onClick={toggleKnown}
          className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill bg-soft px-3 text-xs font-medium text-ink transition-colors hover:bg-soft2 active:bg-soft2"
        >
          <svg
            aria-hidden="true"
            className="size-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="20" height="5" rx="1" />
            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M9 13h6" />
            {known && <path d="M12 10v6" />}
          </svg>
          {label}
        </button>
      </StudyTooltip>
    );
  }

  return (
    <Row gap="xs">
      {!known && (
        <span
          role="status"
          className="shrink-0 text-xs text-muted"
          title={
            polishLabels ? "Słowo jest w trakcie nauki" : "Слово изучается"
          }
        >
          ○ {polishLabels ? "uczę się" : "учу"}
        </span>
      )}
      <button
        type="button"
        aria-pressed={known}
        onClick={toggleKnown}
        title={
          polishLabels
            ? known
              ? "Przywróć do ćwiczeń"
              : "Oznacz słowo jako znane"
            : known
              ? "Вернуть в практику"
              : "Отметить слово как выученное"
        }
        className={`flex min-h-12 shrink-0 items-center gap-1 rounded-pill px-2.5 text-xs font-medium ${
          known
            ? "bg-ok-bg text-ok-ink hover:bg-soft2"
            : "border border-primary bg-transparent text-primary hover:bg-soft"
        }`}
      >
        <span aria-hidden>{known ? "✓" : "→"}</span>
        {polishLabels ? (known ? "znam" : "Znam") : known ? "знаю" : "Знаю"}
      </button>
    </Row>
  );
}

const STUDY_STATUS: Record<
  LexemeStudyStatus,
  { label: string; className: string }
> = {
  known: { label: "✓ знаю", className: "bg-ok-bg text-ok-ink" },
  learning: { label: "↻ в повторении", className: "bg-soft2 text-accent-ink" },
  completed: { label: "✓ изучено", className: "bg-ok-bg text-ok-ink" },
  failed: { label: "↻ нужно повторить", className: "bg-warn-bg text-warn-ink" },
  untouched: { label: "○ не начато", className: "bg-soft text-muted" },
};

export function StudyStatusBadge({ status }: { status: LexemeStudyStatus }) {
  const view = STUDY_STATUS[status];
  return (
    <span
      className={`mt-1 inline-flex min-h-6 items-center rounded-pill px-2 py-0.5 text-xs ${view.className}`}
    >
      {view.label}
    </span>
  );
}
