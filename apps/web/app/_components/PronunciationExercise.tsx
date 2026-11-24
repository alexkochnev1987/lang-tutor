'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Row, Stack } from '@polski/ui'
import { ExerciseActions, ExerciseCard, ExerciseContent, ExerciseFeedback, ExercisePromptArea, ExerciseResultMark, ExerciseSlot } from './exercise/ExerciseCard'
import type { CheckResult } from '@polski/engine'
import { useSettings } from '@/lib/data/store'
import { createBrowserRecognition, pronunciationMatches, speechTagForLanguage, type BrowserRecognition } from '@/lib/speech/recognition'
import { SpeakIcon } from './ExerciseView'
import { stop } from '@/lib/speech/tts'

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

export function PronunciationExercise({ mode = 'word', prompt, expected, matchesAnswer, onAnswered, onSkip }: {
  mode?: 'word' | 'phrase'
  prompt?: string
  expected: string
  matchesAnswer?: (transcript: string) => boolean
  onAnswered: (result: CheckResult, ms: number, attempts: number, answer: string) => void
  onSkip?: () => void
}) {
  const t = useTranslations('dailyWords.speech')
  const phrase = useTranslations('lessonPhrase')
  const isPhrase = mode === 'phrase'
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
    const correct = matchesAnswer ? matchesAnswer(transcript) : pronunciationMatches(expected, transcript)
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
    if (isPhrase) stop()

    const current = { recognition, timer: 0, silenceTimer: null as number | null }
    const armSilenceTimer = () => {
      if (current.silenceTimer !== null) window.clearTimeout(current.silenceTimer)
      current.silenceTimer = window.setTimeout(() => recognition?.stop(), SILENCE_TIMEOUT_MS)
    }
    recognition.onresult = ({ results }) => {
      if (active.current !== current) return
      latestTranscript.current = Array.from(results).map((result) => result[0].transcript).join(' ').trim()
      if (latestTranscript.current) armSilenceTimer()
    }
    recognition.onerror = ({ error }) => { if (active.current === current && finish()) setIssue(speechIssue(error)) }
    recognition.onend = () => {
      if (active.current !== current) return
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
    if (!isPhrase && !finished && !feedback) listen()
    // The pronunciation card starts listening as soon as it is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ExerciseCard practice={!isPhrase} tone={finished ? (feedback?.correct ? 'correct' : 'wrong') : 'neutral'}>
      <ExerciseContent compact practice={!isPhrase}>
        <ExercisePromptArea practice={!isPhrase}>
          <p className="text-center text-sm text-muted">{isPhrase ? phrase('say') : t('instruction')}</p>
          {prompt && <p className="text-center text-xl font-semibold break-words" lang="ru">{prompt}</p>}
        </ExercisePromptArea>
        <div>
          <Button variant="ghost" size="sm" onClick={() => setHintVisible((visible) => !visible)}>
            {isPhrase ? phrase(hintVisible ? 'hideHint' : 'showHint') : t(hintVisible ? 'hideHint' : 'showHint')}
          </Button>
          <ExerciseSlot visible={hintVisible}>
            <Row gap="sm">
              <p className="mt-1 text-lg font-semibold" lang="pl">{expected}</p>
              {isPhrase && <ExerciseSlot visible={!listening}><SpeakIcon text={expected} ariaLabel={phrase('listen')} /></ExerciseSlot>}
            </Row>
          </ExerciseSlot>
        </div>
        <ExerciseFeedback size="speech" reserve={<>
          <p>{t('recognized')} <strong lang="pl">{expected}</strong></p>
          {isPhrase && <p>{phrase('notMatched')}</p>}
          <p>{t('remaining', { count: MAX_ATTEMPTS })}</p>
        </>}>
          {listening && <p>{t('listening')}</p>}
          {issue && <p className="text-danger-ink">{isPhrase && issue === 'noSpeech' ? phrase('notRecognized') : t(issue)}</p>}
          {!languageTag && <p className="text-danger-ink">{t('unsupported')}</p>}
          {feedback && (
            <>
              <p className={isPhrase ? undefined : `flex items-center gap-1 ${feedback.correct ? 'text-ok-ink' : 'text-danger-ink'}`}>
                {t('recognized')} <strong lang="pl" className="min-w-0 break-words">{feedback.transcript}</strong>
                {!isPhrase && <ExerciseResultMark correct={feedback.correct} label={t(feedback.correct ? 'correct' : 'incorrect')} />}
              </p>
              {isPhrase && <p className={feedback.correct ? 'text-ok-ink' : 'text-danger-ink'}>{feedback.correct ? t('correct') : phrase('notMatched')}</p>}
              {!finished && <p>{t('remaining', { count: MAX_ATTEMPTS - feedback.attempts })}</p>}
            </>
          )}
        </ExerciseFeedback>
        <ExerciseActions finished={finished} completed={
          <Stack gap="sm">
            <Row gap="sm"><p>{t('answer')} <strong lang="pl">{expected}</strong></p><SpeakIcon text={expected} size="compact" ariaLabel={t('playAnswer')} /></Row>
            {isPhrase && onSkip && <Button type="button" onClick={onSkip}>{phrase('showDialogue')}</Button>}
          </Stack>
        }>
          <Row wrap gap="sm">
            <ExerciseActions finished={listening} completed={<Button variant="ghost" onClick={stopListening}>{t('stop')}</Button>}>
              <Button onClick={listen} disabled={!languageTag}>{t(isPhrase && !issue && !feedback ? 'start' : 'retry')}</Button>
            </ExerciseActions>
            {onSkip && <Button variant="ghost" onClick={onSkip} disabled={listening}>{isPhrase ? phrase('skipMic') : t('skip')}</Button>}
          </Row>
        </ExerciseActions>
      </ExerciseContent>
    </ExerciseCard>
  )
}
