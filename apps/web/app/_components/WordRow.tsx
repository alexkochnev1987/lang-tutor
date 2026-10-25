'use client'

import { useState } from 'react'
import { Row } from '@polski/ui'
import { NoVoiceForLanguage, speak, warmUpSpeech } from '@/lib/speech/tts'
import type { Lexeme } from '@/lib/content/curriculum'

let warmed = false

const BADGE: Record<Lexeme['transparency'], { text: string; cls: string } | null> = {
  transparent: null,
  partial: null,
  opaque: null,
  'false-friend': { text: 'ложный друг', cls: 'bg-danger-bg text-danger-ink' },
}

export function WordRow({ word }: { word: Lexeme }) {
  const [err, setErr] = useState(false)
  const badge = BADGE[word.transparency]

  async function pronounce() {
    if (!warmed) { warmUpSpeech(); warmed = true }
    setErr(false)
    try {
      await speak(word.lemma, { lang: 'pl-PL' })
    } catch (e) {
      setErr(e instanceof NoVoiceForLanguage)
    }
  }

  return (
    <div className="border-b border-line py-2 last:border-0">
      <Row gap="sm" justify="between">
        <Row gap="sm">
          <button
            type="button"
            onClick={pronounce}
            aria-label={`Произнести ${word.lemma}`}
            className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-soft text-base hover:bg-soft2"
          >
            🔊
          </button>
          <div>
            <div className="text-base font-medium">{word.lemma}</div>
            <div className="text-sm text-muted">{word.translation}</div>
          </div>
        </Row>
        {badge && (
          <span className={`shrink-0 rounded-pill px-2 py-0.5 text-xs ${badge.cls}`}>
            {badge.text}
          </span>
        )}
      </Row>

      {word.interference && (
        <p className="mt-1 ml-12 text-xs text-muted">
          не «{word.interference.confusedWith}» — это{' '}
          <span className="text-accent-ink">{word.interference.actuallyIs}</span>
        </p>
      )}
      {word.aspectPair?.perfective && (
        <p className="mt-1 ml-12 text-xs text-muted">
          сов. вид: <span className="text-accent-ink">{word.aspectPair.perfective}</span>
        </p>
      )}
      {word.government && (
        <p className="mt-1 ml-12 text-xs text-muted">управление: {word.government}</p>
      )}
      {err && <p className="mt-1 ml-12 text-xs text-danger">нет польского голоса</p>}
    </div>
  )
}
