'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSettings } from '@/lib/data/store'
import type { Settings } from '@/lib/data/types'
import { primeVoices, speak, type SpeakOutcome, type SpeakProblem } from './tts'

export type SpeakIssue = Exclude<SpeakOutcome, 'ok'> | SpeakProblem

const MESSAGE: Record<SpeakIssue, string> = {
  unsupported: 'Przeglądarka nie obsługuje odczytywania słów',
  'no-voice': 'Brak polskiego głosu — dodaj go w ustawieniach systemu',
  stalled: 'Przeglądarka nie odczytała słowa — uruchom ją ponownie',
  failed: 'Nie udało się odczytać słowa',
}

export function usePronounce(lang = 'pl-PL') {
  const [issue, setIssue] = useState<SpeakIssue | null>(null)

  useEffect(primeVoices, [])

  const pronounce = useCallback((text: string, preview?: Pick<Settings, 'ttsRate' | 'ttsVoiceURI'>) => {
    setIssue(null)
    const { ttsRate, ttsVoiceURI } = preview ?? getSettings()
    const outcome = speak(text, { lang, rate: ttsRate, voiceURI: ttsVoiceURI, onProblem: setIssue })
    if (outcome !== 'ok') setIssue(outcome)
  }, [lang])

  return { pronounce, issue, message: issue ? MESSAGE[issue] : null }
}
