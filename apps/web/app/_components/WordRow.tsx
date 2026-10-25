'use client'

import { Row } from '@polski/ui'
import { usePronounce } from '@/lib/speech/usePronounce'
import { setLexemeKnown, useAppState } from '@/lib/data/store'
import type { Lexeme } from '@/lib/content/curriculum'

const BADGE: Record<Lexeme['transparency'], { text: string; cls: string } | null> = {
  transparent: null,
  partial: null,
  opaque: null,
  'false-friend': { text: 'fałszywy przyjaciel', cls: 'bg-warn-bg text-warn-ink' },
}

export function WordRow({ word }: { word: Lexeme }) {
  const { pronounce, message } = usePronounce()
  const state = useAppState()
  const badge = BADGE[word.transparency]
  const known = state?.lexemeStatus.some(
    (l) => l.lexemeId === word.id && l.status === 'known') ?? false

  return (
    <div className="border-b border-line py-2 last:border-0">
      <Row gap="sm" justify="between">
        <Row gap="sm">
          <button
            type="button"
            onClick={() => pronounce(word.lemma)}
            aria-label={`Wymów ${word.lemma}`}
            className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-soft text-base hover:bg-soft2"
          >
            {message ? '🔇' : '🔊'}
          </button>
          <div>
            <div className={`text-base font-medium ${known ? 'text-muted' : ''}`}>
              {word.lemma}
            </div>
            <div className="text-sm text-muted">{word.translation}</div>
          </div>
        </Row>
        <Row gap="xs">
          {badge && !known && (
            <span className={`shrink-0 rounded-pill px-2 py-0.5 text-xs ${badge.cls}`}>
              {badge.text}
            </span>
          )}
          <KnownToggle lexemeId={word.id} polishLabels />
        </Row>
      </Row>

      {!known && word.interference && (
        <p className="mt-1 ml-12 text-xs text-muted">
          nie „{word.interference.confusedWith}” — po polsku to{' '}
          <span className="text-warn-ink">{word.interference.actuallyIs}</span>
        </p>
      )}
      {!known && word.aspectPair?.perfective && (
        <p className="mt-1 ml-12 text-xs text-muted">
          aspekt dokonany: <span className="text-accent-ink">{word.aspectPair.perfective}</span>
        </p>
      )}
      {!known && word.government && (
        <p className="mt-1 ml-12 text-xs text-muted">rekcja: {word.government}</p>
      )}
      {message && <p role="status" className="mt-1 ml-12 text-xs text-danger">{message}</p>}
    </div>
  )
}

export function KnownToggle({ lexemeId, onMarked, polishLabels = false }: {
  lexemeId: string
  onMarked?: (known: boolean) => void
  polishLabels?: boolean
}) {
  const state = useAppState()
  const known = state?.lexemeStatus.some(
    (l) => l.lexemeId === lexemeId && l.status === 'known') ?? false

  return (
    <Row gap="xs">
      {!known && (
        <span
          role="status"
          className="shrink-0 text-xs text-muted"
          title={polishLabels ? 'Słowo jest w trakcie nauki' : 'Слово изучается'}
        >
          ○ {polishLabels ? 'uczę się' : 'учу'}
        </span>
      )}
      <button
        type="button"
        aria-pressed={known}
        onClick={() => {
          void setLexemeKnown(lexemeId, !known)
          onMarked?.(!known)
        }}
        title={polishLabels
          ? known ? 'Przywróć do ćwiczeń' : 'Oznacz słowo jako znane'
          : known ? 'Вернуть в практику' : 'Отметить слово как выученное'}
        className={`flex min-h-9 shrink-0 items-center gap-1 rounded-pill px-2.5 text-xs font-medium ${
          known
            ? 'bg-ok-bg text-ok-ink hover:bg-soft2'
            : 'border border-primary bg-transparent text-primary hover:bg-soft'
        }`}
      >
        <span aria-hidden>{known ? '✓' : '→'}</span>
        {polishLabels
          ? known ? 'znam' : 'Znam'
          : known ? 'знаю' : 'Знаю'}
      </button>
    </Row>
  )
}
