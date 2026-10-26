'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadMorphology, loadVocabulary, type Lexeme } from '@/lib/content/curriculum'
import { savePersonalWord, useAppState } from '@/lib/data/store'
import { usePronounce } from '@/lib/speech/usePronounce'

interface SelectedWord {
  matches: Array<{ text: string; word: Lexeme }>
  selectedText: string
  left: number
  top: number
}

const normalizeWord = (value: string): string => value.normalize('NFC').toLocaleLowerCase('pl-PL')

function selectedPhrase(value: string): string | null {
  const phrase = value.trim()
    .replace(/^[^\p{L}]+/u, '')
    .replace(/[^\p{L}]+$/u, '')
    .replace(/\s+/g, ' ')
  return /^[\p{L}]+(?:[-'’][\p{L}]+)*(?:\s+[\p{L}]+(?:[-'’][\p{L}]+)*)*$/u.test(phrase)
    ? phrase
    : null
}

export function SelectionDictionary() {
  const state = useAppState()
  const { pronounce, message } = usePronounce()
  const [vocabulary, setVocabulary] = useState<Map<string, Lexeme> | null>(null)
  const [morphology, setMorphology] = useState<Record<string, Record<string, string[]>> | null>(null)
  const [selection, setSelection] = useState<SelectedWord | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([loadVocabulary(), loadMorphology()])
      .then(([words, forms]) => {
        if (!alive) return
        setVocabulary(words)
        setMorphology(forms)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const byForm = useMemo(() => {
    if (!vocabulary) return null
    const result = new Map<string, Lexeme>()
    for (const word of vocabulary.values()) {
      result.set(normalizeWord(word.lemma), word)
      for (const form of Object.values(morphology?.[word.lemma] ?? {}).flat()) {
        if (!result.has(normalizeWord(form))) result.set(normalizeWord(form), word)
      }
    }
    return result
  }, [morphology, vocabulary])

  useEffect(() => {
    function updateSelection() {
      const nativeSelection = window.getSelection()
      const raw = nativeSelection?.toString() ?? ''
      const normalized = selectedPhrase(raw)
      const range = nativeSelection && nativeSelection.rangeCount > 0
        ? nativeSelection.getRangeAt(0)
        : null
      const source = range?.commonAncestorContainer.parentElement
      if (!normalized || nativeSelection?.isCollapsed || source?.closest('input, textarea, select, button, [data-selection-ignore]')) {
        setSelection(null)
        return
      }

      const matches = normalized.split(' ').map((text) => ({
        text,
        word: byForm?.get(normalizeWord(text)),
      })).filter((match): match is { text: string; word: Lexeme } => Boolean(match.word))
      if (!matches.length || !range) {
        setSelection(null)
        return
      }

      const rect = range.getBoundingClientRect()
      const width = 280
      setSelection({
        matches,
        selectedText: raw.trim(),
        left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8)),
        top: Math.min(rect.bottom + 8, Math.max(8, window.innerHeight - 280)),
      })
    }

    document.addEventListener('mouseup', updateSelection)
    document.addEventListener('keyup', updateSelection)
    return () => {
      document.removeEventListener('mouseup', updateSelection)
      document.removeEventListener('keyup', updateSelection)
    }
  }, [byForm])

  useEffect(() => {
    const match = selection?.matches.length === 1 ? selection.matches[0] : null
    setSaved(Boolean(match && state?.personalDict.some(
      (word) => normalizeWord(word.lemma) === normalizeWord(match.text),
    )))
  }, [selection, state?.personalDict])

  if (!selection) return null
  const currentSelection = selection

  async function save() {
    const match = currentSelection.matches.length === 1 ? currentSelection.matches[0] : null
    if (!match || saved || saving) return
    setSaving(true)
    const ok = await savePersonalWord({
      lemma: currentSelection.selectedText,
      translation: match.word.translation,
      sourceUrl: window.location.pathname,
      context: currentSelection.selectedText,
      linkedLexemeId: match.word.id,
    })
    setSaving(false)
    if (ok) setSaved(true)
  }

  return (
    <aside
      data-selection-ignore
      className="fixed z-50 w-70 rounded-card border border-line bg-card p-3 shadow-modal"
      style={{ left: currentSelection.left, top: currentSelection.top }}
      onPointerDown={(event) => event.stopPropagation()}
      aria-label="Tłumaczenie zaznaczonego słowa"
    >
      <div className="text-sm text-muted">
        {currentSelection.matches.length > 1 ? 'Tłumaczenie słów' : 'Tłumaczenie'}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="min-w-0 flex-1 text-base font-semibold text-ink" lang="pl">
          {currentSelection.selectedText}
        </div>
        <button
          type="button"
          aria-label={`Wymów ${currentSelection.selectedText}`}
          title={message ?? `Wymów ${currentSelection.selectedText}`}
          onClick={() => pronounce(currentSelection.selectedText)}
          className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-soft text-base text-ink hover:bg-soft2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {message ? '🔇' : '🔊'}
        </button>
      </div>
      <div className="mt-2 space-y-1 text-sm text-muted">
        {currentSelection.matches.map((match) => (
          <div key={`${match.text}-${match.word.id}`} className="flex items-baseline justify-between gap-3">
            <span lang="pl">{match.text}</span>
            <span className="text-right text-ink">{match.word.translation}</span>
          </div>
        ))}
      </div>
      {message && <div className="mt-1 text-xs text-danger-ink" role="status">{message}</div>}
      {currentSelection.matches.length === 1 ? (
        <button
          type="button"
          disabled={saved || saving}
          onClick={() => void save()}
          className="mt-3 min-h-9 w-full rounded-card border border-line bg-transparent px-3 text-sm font-medium text-ink hover:bg-soft disabled:opacity-60"
        >
          {saved ? 'Już w słowniku' : saving ? 'Zapisywanie…' : 'Zapisz do słownika'}
        </button>
      ) : (
        <div className="mt-3 text-xs text-muted">Aby zapisać słowo, zaznacz je osobno.</div>
      )}
    </aside>
  )
}
