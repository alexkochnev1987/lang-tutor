'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadMorphology, loadVocabulary, type Lexeme } from '@/lib/content/curriculum'
import { savePersonalWord, useAppState } from '@/lib/data/store'

interface SelectedWord {
  word: Lexeme
  selectedText: string
  left: number
  top: number
}

const normalizeWord = (value: string): string => value.normalize('NFC').toLocaleLowerCase('pl-PL')

function selectedWord(value: string): string | null {
  const word = value.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
  return /^[\p{L}]+(?:[-'][\p{L}]+)*$/u.test(word) ? word : null
}

export function SelectionDictionary() {
  const state = useAppState()
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
      const normalized = selectedWord(raw)
      const range = nativeSelection && nativeSelection.rangeCount > 0
        ? nativeSelection.getRangeAt(0)
        : null
      const source = range?.commonAncestorContainer.parentElement
      if (!normalized || nativeSelection?.isCollapsed || source?.closest('input, textarea, select, button, [data-selection-ignore]')) {
        setSelection(null)
        return
      }

      const word = byForm?.get(normalizeWord(normalized))
      if (!word || !range) {
        setSelection(null)
        return
      }

      const rect = range.getBoundingClientRect()
      const width = 280
      setSelection({
        word,
        selectedText: raw.trim(),
        left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8)),
        top: Math.min(rect.bottom + 8, window.innerHeight - 150),
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
    setSaved(Boolean(selection && state?.personalDict.some(
      (word) => normalizeWord(word.lemma) === normalizeWord(selection.selectedText),
    )))
  }, [selection, state?.personalDict])

  if (!selection) return null
  const currentSelection = selection

  async function save() {
    if (saved || saving) return
    setSaving(true)
    const ok = await savePersonalWord({
      lemma: currentSelection.selectedText,
      translation: currentSelection.word.translation,
      sourceUrl: window.location.pathname,
      context: currentSelection.selectedText,
      linkedLexemeId: currentSelection.word.id,
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
      <div className="text-sm text-muted">Tłumaczenie</div>
      <div className="mt-1 text-base font-semibold text-ink" lang="pl">{currentSelection.selectedText}</div>
      <div className="text-sm text-muted">{currentSelection.word.translation}</div>
      <button
        type="button"
        disabled={saved || saving}
        onClick={() => void save()}
        className="mt-3 min-h-9 w-full rounded-card border border-primary bg-transparent px-3 text-sm font-medium text-primary hover:bg-soft disabled:opacity-60"
      >
        {saved ? 'Już w słowniku' : saving ? 'Zapisywanie…' : 'Zapisz do słownika'}
      </button>
    </aside>
  )
}
