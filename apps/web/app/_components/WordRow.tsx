'use client'

import { Row } from '@polski/ui'
import { usePronounce } from '@/lib/speech/usePronounce'
import { setLexemeKnown, useAppState } from '@/lib/data/store'
import type { Lexeme } from '@/lib/content/curriculum'

const BADGE: Record<Lexeme['transparency'], { text: string; cls: string } | null> = {
  transparent: null,
  partial: null,
  opaque: null,
  'false-friend': { text: 'ложный друг', cls: 'bg-danger-bg text-danger-ink' },
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
            aria-label={`Произнести ${word.lemma}`}
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
          <KnownToggle lexemeId={word.id} />
        </Row>
      </Row>

      {!known && word.interference && (
        <p className="mt-1 ml-12 text-xs text-muted">
          не «{word.interference.confusedWith}» — это{' '}
          <span className="text-accent-ink">{word.interference.actuallyIs}</span>
        </p>
      )}
      {!known && word.aspectPair?.perfective && (
        <p className="mt-1 ml-12 text-xs text-muted">
          сов. вид: <span className="text-accent-ink">{word.aspectPair.perfective}</span>
        </p>
      )}
      {!known && word.government && (
        <p className="mt-1 ml-12 text-xs text-muted">управление: {word.government}</p>
      )}
      {message && <p role="status" className="mt-1 ml-12 text-xs text-danger">{message}</p>}
    </div>
  )
}

export function KnownToggle({ lexemeId, onMarked }: {
  lexemeId: string
  onMarked?: (known: boolean) => void
}) {
  const state = useAppState()
  const known = state?.lexemeStatus.some(
    (l) => l.lexemeId === lexemeId && l.status === 'known') ?? false

  return (
    <button
      type="button"
      aria-pressed={known}
      onClick={() => {
        void setLexemeKnown(lexemeId, !known)
        onMarked?.(!known)
      }}
      title={known ? 'Вернуть в практику' : 'Больше не показывать в практике'}
      className={`flex min-h-9 shrink-0 items-center gap-1 rounded-pill px-2.5 text-xs font-medium ${
        known
          ? 'bg-ok-bg text-ok-ink hover:bg-soft2'
          : 'bg-soft text-muted hover:bg-soft2 hover:text-ink'
      }`}
    >
      <span aria-hidden>{known ? '✓' : '○'}</span>
      {known ? 'знаю' : 'учу'}
    </button>
  )
}
