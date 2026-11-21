'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Card, Row, Stack } from '@polski/ui'
import type { CheckResult } from '@polski/engine'
import { useSettings } from '@/lib/data/store'
import { createBrowserRecognition, pronunciationMatches, speechTagForLanguage, type BrowserRecognition } from '@/lib/speech/recognition'
import { SpeakIcon } from './ExerciseView'

const MAX_ATTEMPTS = 3
const SILENCE_TIMEOUT_MS = 900
const LISTEN_TIMEOUT_MS = 15_000

type SpeechIssue = 'unsupported' | 'permission' | 'microphone' | 'network' | 'noSpeech' | 'recognitionError'

function speechIssue(error: string): SpeechIssue {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed': return 'permission'
    case 'audio-capture': return 'microphone'
    case 'network': return 'network'
    case 'no-speech': return 'noSpeech'
    case 'language-not-supported': return 'unsupported'
    default: return 'recognitionError'
  }
}

export function PronunciationExercise({ prompt, expected, onAnswered, onSkip }: {
  prompt: string
  expected: string
  onAnswered: (result: CheckResult, ms: number, attempts: number, answer: string) => void
  onSkip?: () => void
}) {
  const t = useTranslations('dailyWords.speech')
  const settings = useSettings()
  const active = useRef<{ recognition: BrowserRecognition; timer: number; silenceTimer: number | null } | null>(null)
  const started = useRef(Date.now())
  const latestTranscript = useRef('')
  const [listening, setListening] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const [issue, setIssue] = useState<SpeechIssue | null>(null)
  const [feedback, setFeedback] = useState<{ transcript: string; correct: boolean; attempts: number } | null>(null)
  const finished = Boolean(feedback && (feedback.correct || feedback.attempts === MAX_ATTEMPTS))
  const languageTag = speechTagForLanguage(settings.targetLanguage)

  useEffect(() => () => {
    const current = active.current
    active.current = null
    if (current) {
      window.clearTimeout(current.timer)
      if (current.silenceTimer !== null) window.clearTimeout(current.silenceTimer)
      current.recognition.abort()
    }
  }, [])

  function finish(): boolean {
    const current = active.current
    if (!current) return false
    window.clearTimeout(current.timer)
    if (current.silenceTimer !== null) window.clearTimeout(current.silenceTimer)
    active.current = null
    setListening(false)
    return true
  }

  function submitTranscript(transcript: string): void {
    if (!transcript || !finish()) return
    const attempts = (feedback?.attempts ?? 0) + 1
    const correct = pronunciationMatches(expected, transcript)
    setFeedback({ transcript, correct, attempts })
    if (correct || attempts === MAX_ATTEMPTS) {
      onAnswered({ correct, expected, errorKind: correct ? undefined : 'wrong-word' },
        Date.now() - started.current, attempts, transcript)
    }
  }

  function listen() {
    if (active.current || finished || !languageTag) return
    setIssue(null)
    latestTranscript.current = ''
    let recognition: BrowserRecognition | null
    try { recognition = createBrowserRecognition(settings.targetLanguage) } catch { setIssue('recognitionError'); return }
    if (!recognition) { setIssue('unsupported'); return }

    const current = { recognition, timer: 0, silenceTimer: null as number | null }
    const armSilenceTimer = () => {
      if (current.silenceTimer !== null) window.clearTimeout(current.silenceTimer)
      current.silenceTimer = window.setTimeout(() => recognition?.stop(), SILENCE_TIMEOUT_MS)
    }
    recognition.onresult = ({ results }) => {
      latestTranscript.current = Array.from(results).map((result) => result[0].transcript).join(' ').trim()
      if (latestTranscript.current) armSilenceTimer()
    }
    recognition.onerror = ({ error }) => { if (active.current === current && finish()) setIssue(speechIssue(error)) }
    recognition.onend = () => {
      if (latestTranscript.current) submitTranscript(latestTranscript.current)
      else if (active.current === current && finish()) setIssue('noSpeech')
    }
    current.timer = window.setTimeout(() => {
      if (active.current === current && finish()) {
        recognition?.abort()
        setIssue('noSpeech')
      }
    }, LISTEN_TIMEOUT_MS)
    active.current = current
    started.current = Date.now()
    setListening(true)
    try { recognition.start() } catch { if (finish()) setIssue('recognitionError') }
  }

  function stopListening() {
    const current = active.current
    if (!current) return
    current.recognition.abort()
    finish()
  }

  useEffect(() => {
    if (!finished && !feedback) listen()
    // The pronunciation card starts listening as soon as it is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card tone={finished ? (feedback?.correct ? 'correct' : 'wrong') : 'neutral'}>
      <Stack gap="sm">
        <p className="text-sm text-muted">{t('instruction')}</p>
        <p className="text-xl font-semibold" lang="ru">{prompt}</p>
        <div>
          <Button variant="ghost" size="sm" onClick={() => setHintVisible((visible) => !visible)}>
            {t(hintVisible ? 'hideHint' : 'showHint')}
          </Button>
          {hintVisible && <p className="mt-1 text-lg font-semibold" lang="pl">{expected}</p>}
        </div>
        <div role="status">
          {listening && <p>{t('listening')}</p>}
          {issue && <p className="text-danger-ink">{t(issue)}</p>}
          {!languageTag && <p className="text-danger-ink">{t('unsupported')}</p>}
          {feedback && (
            <>
              <p>{t('recognized')} <strong lang="pl">{feedback.transcript}</strong></p>
              <p className={feedback.correct ? 'text-ok-ink' : 'text-danger-ink'}>{t(feedback.correct ? 'correct' : 'incorrect')}</p>
              {!finished && <p>{t('remaining', { count: MAX_ATTEMPTS - feedback.attempts })}</p>}
            </>
          )}
        </div>
        {finished ? (
          <Row gap="sm"><p>{t('answer')} <strong lang="pl">{expected}</strong></p><SpeakIcon text={expected} ariaLabel={t('playAnswer')} /></Row>
        ) : (
          <Row wrap gap="sm">
            {listening && <Button variant="ghost" onClick={stopListening}>{t('stop')}</Button>}
            {!listening && <Button onClick={listen} disabled={!languageTag}>{t('retry')}</Button>}
            {onSkip && <Button variant="ghost" onClick={onSkip} disabled={listening}>{t('skip')}</Button>}
          </Row>
        )}
      </Stack>
    </Card>
  )
}
