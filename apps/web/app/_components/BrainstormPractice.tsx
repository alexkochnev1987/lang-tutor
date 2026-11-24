'use client'

import { useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from './AppIcon'
import { Button, Card, Row, Screen, Stack } from '@polski/ui'
import type { CheckResult } from '@polski/engine'
import type { Lexeme } from '@/lib/content/curriculum'
import { getLoadedState, queueDailyWordAnswer } from '@/lib/data/store'
import { formatOfWordExercise, wordSkill, type DailyWordAnswer, type DailyWordSubmission, type WordFormat } from '@/lib/engine/daily-words'
import { prepareLexemeReview, Rating } from '@/lib/engine/session'
import { buildWordStageRetryStep, buildWordStudySteps, oneAttemptWordSteps, WORD_STAGE_RETRY_LIMIT, type WordExerciseStep } from '@/lib/engine/word-study'
import { ExerciseView, SpeakIcon } from './ExerciseView'
import { WeeklyGoalCredit } from './WeeklyGoal'
import { WordPracticeFooter } from './WordPracticeFooter'

const FORM_ID = 'brainstorm-response'
const STORAGE_KEY = 'brainstorm-progress'
type Response = { result: DailyWordAnswer['result']; ms: number }
type Progress = {
  startedAt: string
  introduced: string[]
  responses: Record<string, Response>
  unavailable: string[]
}

export function BrainstormPractice({ id, words, pool, dayNumber, reviewFormats, canContinue, checking, loadError, onConsume, onContinue, onExit }: {
  id: string
  words: Lexeme[]
  pool: Lexeme[]
  dayNumber: number
  reviewFormats?: Record<string, WordFormat[]>
  canContinue: boolean
  checking: boolean
  loadError:¶»§q«^