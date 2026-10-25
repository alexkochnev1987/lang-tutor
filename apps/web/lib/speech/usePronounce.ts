'use client'

import { useCallback, useEffect, useState } from 'react'
import { primeVoices, speak, type SpeakOutcome, type SpeakProblem } from './tts'

export type SpeakIssue = Exclude<SpeakOutcome, 'ok'> | SpeakProblem

const MESSAGE: Record<SpeakIssue, string> = {
  unsupported: 'браузер не умеет произносить слова',
  'no-voice': 'нет польского голоса — добавьте его в настройках системы',
  stalled: 'браузер не произнёс слово — перезапустите браузер',
  failed: 'не удалось произнести',
}

export function usePronounce(lang = 'pl-PL') {
  const [issue, setIssue] = useState<SpeakIssue | null>(null)

  useEffect(primeVoices, [])

  const pronounce = useCallback((text: string) => {
    setIssue(null)
    const outcome = speak(text, { lang, onProblem: setIssue })
    if (outcome !== 'ok') setIssue(outcome)
  }, [lang])

  return { pronounce, issue, message: issue ? MESSAGE[issue] : null }
}
