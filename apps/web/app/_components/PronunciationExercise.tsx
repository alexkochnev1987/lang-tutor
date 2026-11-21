'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Card, Row, Stack } from '@polski/ui'
import type { CheckResult } from '@polski/engine'
import { createBrowserRecognition, pronunciationMatches, type BrowserRecognition } from '@/lib/speech/recognition'
import { SpeakIcon } from './ExerciseView'

const MAX_ATTEMPTS = 3
const LISTEN_TIMEOUT_MS = 15_000

type SpeechIssue = 'unsupported' | 'permission' | 'microphone' | 'network' | 'noSpeech' | 'recognitionError'

function speechIssue(error: string): SpeechIssue {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission'
    case 'audio-capture':
      return 'microphone'
    case 'network':
      return 'network'
    case 'no-speech':
      return 'noSpeech'
    case 'language-not-supported':
      return 'unsupported'
    default:
      return 'recognitionError'
  }
}

export function PronunciationExercise({ prompt, expected, onAnswered, onSkip }: {
  prompt: string
  expected: string
  onAnswered: (result: CheckResult, ms: number, attempts: number, answer: string) => void
  onSkip?: () => void
}) {
  const t = useTranslations('dailyWords.speech')
  const active = useRef<{ recognition: BrowserRecognition; timer: number } | null>(null)
  const started = useRef(Date.now())
  const [listening, setListening] = useState(false)
  const [issue, setIssue] = useState<SpeechIssue | null>(null)
  const [feedback, setFeedback] = useState<{ transcript: string; correct: boolean; attempts: number } | null>(null)
  const finished = Boolean(feedback && (feedback.correct || feedback.attempts === MAX_ATTEMPTS))

  useEffect(() => () => {
    const current = active.current
    active.current = null
    if (current) {
      window.clearTimeout(current.timer)
      current.recognition.abort()
    }
  }, [])

  function listen() {
    if (active.current || finished) return
    setIssue(null)
    let recognition: BrowserRecognition | null
    try {
      recognition = createBrowserRecognition()
    } catch {
      setIssue('recognitionError')
      return
    }
    if (!recognition) {
      setIssue('unsupported')
      return
    }

    function finish() {
      const current = active.current
      if (current?.recognition !== recognition) return false
      window.clearTimeout(current.timer)
      active.current = null
      setListening(false)
      return true
    }

    recognition.onresult = ({ results }) => {
      const transcript = Array.from(results).find(({ isFinal }) => isFinal)?.[0].transcript.trim()
      if (!transcript || !finish()) return
      const attempts = (feedback?.attempts ?? 0) + 1
      const correct = pronunciationMatches(expected, transcript)
      setFeedback({ transcript, correct, attempts })
      if (correct || attempts === MAX_ATTEMPTS) {
        onAnswered({ correct, expected, errorKind: correct ? undefined : 'wrong-word' },
          Date.now() - started.current, attempts, transcript)
      }
    }
    recognition.onerror = ({ error }) => {
      if (finish()) setIssue(speechIssue(error))
    }
    recognition.onend = () => {
      if (finish()) setIssue('noSpeech')
    }

    active.current = { recognition, timer: window.setTimeout(() => {
      if (finish()) {
        recognition.abort()
        setIssue('noSpeech')
      }
    }, LISTEN_TIMEOUT_MS) }
    try {
      setListening(true)
      recognition.start()
    } catch {
      if (finish()) setIssue('recognitionError')
    }
  }

  return (
    <Card tone={finished ? (feedback?.correct ? 'correct' : 'wrong') : 'neutral'}>
      <Stack gap="sm">
        <p className="text-sm text-muted">{t('instruction')}</p>
        <p className="text-xl font-semibold" lang="ru">{prompt}</p>
        <div role="status">
          {listening && <p>{t('listening')}</p>}
          {issue && <p className="text-danger-ink">{t(issue)}</p>}
          {feedback && (
            <>
              <p>{t('recognized')} <strong lang="pl">{feedback.transcript}</strong></p>
              <p className={feedback.correct ? 'text-ok-ink' : 'text-danger-ink'}>
                {t(feedback.correct ? 'correct' : 'incorrect')}
              </p>
              {!finished && <p>{t('remaining', { count: MAX_ATTEMPTS - feedback.attempts })}</p>}
            </>
          )}
        </div>
        {finished ? (
          <Row gap="sm">
            <p>{t('answer')} <strong lang="pl">{expected}</strong></p>
            <SpeakIcon text={expected} ariaLabel={t('playAnswer')} />
          </Row>
        ) : (
          <Row wrap gap="sm">
            <Button onClick={listen} disabled={listening || issue === 'unsupported'}>
              {t(feedback ? 'retry' : 'start')}
            </Button>
            {onSkip && <Button variant="ghost" onClick={onSkip} disabled={listening}>{t('skip')}</Button>}
          </Row>
        )}
      </Stack>
    </Card>
  )
}
