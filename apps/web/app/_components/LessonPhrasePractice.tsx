'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Row, Stack } from '@polski/ui'
import { shuffle } from '@polski/engine'
import type { LessonPhrase } from '@/lib/content/lesson-phrases'
import { SpeakIcon } from './ExerciseView'
import { PronunciationExercise } from './PronunciationExercise'

type Step = 'invite' | 'assemble' | 'write' | 'say' | 'done'

function normalizePhrase(text: string) {
  return text.normalize('NFC').toLocaleLowerCase('pl').replace(/\p{P}+/gu, ' ').trim().replace(/\s+/g, ' ')
}

export function LessonPhrasePractice({ phrase, day }: { phrase: LessonPhrase; day: number }) {
  const t = useTranslations('lessonPhrase')
  const [step, setStep] = useState<Step>('invite')
  const [picked, setPicked] = useState<number[]>([])
  const [written, setWritten] = useState('')
  const [wrong, setWrong] = useState(false)
  const words = phrase.answer.split(' ').map((word, index) => ({
    label: word.replace(/\p{P}/gu, '').toLocaleLowerCase('pl'),
    index,
  }))
  const shuffled = shuffle(words, day)
  const tiles = shuffled.every((word, index) => word.index === index) ? shuffled.reverse() : shuffled

  function matchingAnswer(answer: string) {
    const normalized = normalizePhrase(answer)
    return [phrase.answer, ...(phrase.alternatives ?? [])].find((option) => normalizePhrase(option) === normalized)
  }

  function changeStep(next: Step) {
    setWrong(false)
    setStep(next)
  }

  function checkAssembly() {
    const built = picked.map((index) => words[index]!.label).join(' ')
    if (matchingAnswer(built)) changeStep('write')
    else setWrong(true)
  }

  function checkWriting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!written.trim()) return
    if (matchingAnswer(written)) changeStep('say')
    else setWrong(true)
  }

  function toggleTile(index: number) {
    setWrong(false)
    setPicked((current) => current.includes(index)
      ? current.filter((chosen) => chosen !== index)
      : [...current, index])
  }

  const modelAnswer = matchingAnswer(written) ?? phrase.answer

  function reset() {
    setPicked([])
    setWritten('')
    changeStep('invite')
  }

  return (
    <section aria-label={t('title')} className="w-full min-w-0 border-t border-line pt-3">
      <Stack gap="sm">
        <Row justify="between" align="center" gap="sm">
          <h2 className="font-semibold">{t('title')}</h2>
          {step !== 'invite' && step !== 'done' && (
            <Button type="button" variant="ghost" size="sm" onClick={reset}>{t('close')}</Button>
          )}
        </Row>
        {step !== 'done' && <p lang="ru" className="text-sm text-muted">{phrase.situation}</p>}
        {step === 'invite' && (
          <Button type="button" variant="outline" full onClick={() => changeStep('assemble')}>{t('start')}</Button>
        )}
        {step === 'assemble' && (
          <Stack gap="sm">
            <h3 className="text-sm font-medium">{t('assemble')}</h3>
            <div aria-label={t('selected')} lang="pl" className="flex min-h-14 flex-wrap items-start gap-1.5 rounded-control border border-line p-2">
              {picked.map((index) => (
                <Button key={index} type="button" size="sm" variant="outline" onClick={() => toggleTile(index)}>
                  {words[index]!.label}
                </Button>
              ))}
            </div>
            <Row wrap gap="xs" lang="pl">
              {tiles.map((tile) => (
                <Button key={tile.index} type="button" size="sm" variant="outline" disabled={picked.includes(tile.index)}
                  onClick={() => toggleTile(tile.index)}>
                  {tile.label}
                </Button>
              ))}
            </Row>
            {wrong && <p role="status" className="text-sm text-danger-ink">{t('tryOrder')}</p>}
            <Button type="button" full disabled={picked.length !== words.length} onClick={checkAssembly}>{t('check')}</Button>
          </Stack>
        )}
        {step === 'write' && (
          <form onSubmit={checkWriting}>
            <Stack gap="sm">
              <label className="text-sm font-medium" htmlFor="lesson-phrase-answer">{t('write')}</label>
              <input id="lesson-phrase-answer" lang="pl" type="text" autoComplete="off" autoCorrect="off" spellCheck={false}
                enterKeyHint="done" value={written} onChange={(event) => { setWritten(event.target.value); setWrong(false) }}
                className="w-full rounded-control border border-line bg-card px-3 py-2 text-base text-ink" />
              {wrong && <p role="status" className="text-sm text-danger-ink">{t('tryWriting')}</p>}
              <Row wrap gap="xs">
                <Button type="button" variant="ghost" size="sm" onClick={() => changeStep('assemble')}>{t('back')}</Button>
                <Button type="submit" disabled={!written.trim()} className="flex-1">{t('check')}</Button>
              </Row>
            </Stack>
          </form>
        )}
        {step === 'say' && (
          <PronunciationExercise
            mode="phrase"
            expected={modelAnswer}
            matchesAnswer={(answer) => Boolean(matchingAnswer(answer))}
            onAnswered={(result) => { if (result.correct) changeStep('done') }}
            onSkip={() => changeStep('done')}
          />
        )}
        {step === 'done' && (
          <div role="status" className="rounded-control bg-soft p-3">
            <p lang="pl" className="text-sm text-muted">{phrase.cue}</p>
            <Row justify="between" align="center" gap="sm">
              <strong lang="pl">{modelAnswer}</strong>
              <SpeakIcon text={modelAnswer} ariaLabel={t('listen')} />
            </Row>
            <p lang="ru" className="text-sm text-muted">{phrase.translation}</p>
          </div>
        )}
      </Stack>
    </section>
  )
}
