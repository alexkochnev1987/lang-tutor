'use client'

import { TabBody } from '@/app/_components/TabBody'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Card, Stack } from '@polski/ui'
import { LoadingSlot, SkeletonBlock } from '@/app/_components/LoadingSkeleton'
import { ProfileIdentity } from '@/app/_components/ProfileIdentity'
import { ThemePicker } from '@/app/_components/ThemePicker'
import { SettingsRow } from '@/app/_components/SettingsRow'
import { SignInButton } from '@/app/_components/SignInButton'
import { loadState, saveSettings, useAppState } from '@/lib/data/store'
import type { GrammarLessonFormat, Settings } from '@/lib/data/types'
import { usePronounce } from '@/lib/speech/usePronounce'
import { voicesForLanguage } from '@/lib/speech/tts'
import { speechTagForLanguage } from '@/lib/speech/recognition'

type StudySettings = Pick<Settings, 'targetLanguage' | 'dailyBudgetMinutes' | 'ttsVoiceURI' | 'ttsRate'>
type LessonPreferences = Pick<Settings, 'newWordsPerDay' | 'grammarExercisesPerDay' | 'grammarLessonFormats' | 'readingTextsPerDay'>

export default function ProfilePage() {
  const t = useTranslations()
  const state = useAppState()
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void loadState().catch(() => { if (active) setLoadFailed(true) })
    return () => { active = false }
  }, [loadAttempt])

  return (
    <TabBody>
      <Stack gap="md">
        {!state && loadFailed && (
          <Card>
            <Stack gap="sm">
              <p role="alert" className="text-sm text-danger-ink">{t('errors.generic')}</p>
              <Button variant="outline" onClick={() => {
                setLoadFailed(false)
                setLoadAttempt((attempt) => attempt + 1)
              }}>{t('errors.retry')}</Button>
            </Stack>
          </Card>
        )}
        {(state || !loadFailed) && (
          <Card>
            <Stack gap="sm">
              <h2 id="profile-account" className="scroll-mt-4 text-lg font-semibold tracking-tight">{t('profile.account')}</h2>
              <LoadingSlot loading={!state} label={t('loadingSections.account')} fallback={<><div className="flex items-center gap-3"><SkeletonBlock className="size-16 rounded-full" /><div className="flex-1 space-y-2"><SkeletonBlock className="h-5 w-2/3" /><SkeletonBlock className="h-4 w-4/5" /></div></div><SkeletonBlock className="h-11 w-full" /></>}>{state && <>{state.user.signedIn ? <ProfileIdentity key={state.user.id} user={state.user} /> : (
                <div className="text-sm text-muted">
                  <p className="font-medium text-ink">{t('profile.guest')}</p>
                  <p>{t('auth.localOnly')}</p>
                </div>
              )}
              <SignInButton showName={false} />
              </>}</LoadingSlot>
            </Stack>
          </Card>
        )}
        <Card>
          <Stack gap="sm">
            <h2 className="text-lg font-semibold tracking-tight">{t('profile.languageAndAppearance')}</h2>
            {state ? <SettingsRow /> : !loadFailed && (
              <Stack gap="sm">
                <p role="status" className="sr-only">{t('loadingSections.preferences')}</p>
                <SkeletonBlock className="h-12 w-full" />
              </Stack>
            )}
            <ThemePicker />
          </Stack>
        </Card>
        {state ? <StudyPreferences key={state.user.id} settings={state.settings} /> : !loadFailed && (
          <Card>
            <Stack gap="md">
              <h2 className="text-lg font-semibold tracking-tight">{t('profile.study')}</h2>
              <SettingsFieldSkeleton label={t('settings.targetLanguage')} />
              <SettingsFieldSkeleton label={t('settings.dailyBudget')} narrow />
              <p className="text-xs text-muted">{t('profile.budgetHint')}</p>
              <SettingsFieldSkeleton label={t('settings.voice')} />
              <SettingsFieldSkeleton label={t('settings.rate')} />
              <SkeletonBlock className="h-11 w-full" />
              <SkeletonBlock className="h-11 w-full" />
            </Stack>
          </Card>
        )}
        {state ? <LessonSettings key={`lesson-${state.user.id}`} settings={state.settings} /> : !loadFailed && <Card><Stack gap="md">
          <h2 className="text-lg font-semibold tracking-tight">{t('profile.lessonSettings')}</h2>
          <SettingsFieldSkeleton label={t('profile.newWordsPerDay')} narrow />
          <p className="text-xs text-muted">{t('profile.newWordsHint')}</p>
          <SettingsFieldSkeleton label={t('profile.readingTextsPerDay')} narrow />
          <SettingsFieldSkeleton label={t('profile.grammarExercisesPerDay')} narrow />
          <p className="text-sm font-medium">{t('profile.grammarLessonFormats')}</p>
          {['lessonChoice','lessonTyped','lessonWrite'].map(key => <div key={key} className="flex min-h-10 items-center gap-3"><SkeletonBlock className="size-5" /><SkeletonBlock className="h-5 w-32" /></div>)}
          <p className="text-xs text-muted">{t('profile.grammarLessonHint')}</p>
          <SkeletonBlock className="h-11 w-full" />
        </Stack></Card>}
      </Stack>
    </TabBody>
  )
}

function SettingsFieldSkeleton({ label, narrow = false }: { label: string; narrow?: boolean }) {
  return <div className="flex flex-col gap-1 text-sm font-medium">{label}<SkeletonBlock className={`h-11 ${narrow ? 'w-24' : 'w-full'} rounded-card`} /></div>
}

function StudyPreferences({ settings }: { settings: StudySettings }) {
  const t = useTranslations()
  const [draft, setDraft] = useState<StudySettings | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const { pronounce, message } = usePronounce()
  const values = draft ?? settings

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const updateVoices = () => setVoices(voicesForLanguage(speechTagForLanguage(values.targetLanguage) ?? 'pl-PL'))
    updateVoices()
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices)
  }, [values.targetLanguage])

  function change(changes: Partial<StudySettings>) {
    const { targetLanguage, dailyBudgetMinutes, ttsVoiceURI, ttsRate } = values
    setDraft({ targetLanguage, dailyBudgetMinutes, ttsVoiceURI, ttsRate, ...changes })
    setStatus('idle')
  }

  async function save() {
    if (!draft || status === 'saving') return
    setStatus('saving')
    try {
      await saveSettings(draft)
      setDraft(null)
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  return (
    <Card>
      <form onSubmit={(event) => { event.preventDefault(); void save() }}>
        <fieldset disabled={status === 'saving'} className="min-w-0">
          <legend className="mb-3 text-lg font-semibold tracking-tight">{t('profile.study')}</legend>
          <Stack gap="md">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('settings.targetLanguage')}
              <select
                value={values.targetLanguage}
                onChange={(event) => change({ targetLanguage: event.target.value })}
                className="min-h-11 w-full rounded-card border border-line bg-card px-2"
              >
                <option value="pl">{t('languages.pl')}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('settings.dailyBudget')}
              <input
                type="number"
                min={5}
                max={90}
                required
                value={Number.isNaN(values.dailyBudgetMinutes) ? '' : values.dailyBudgetMinutes}
                onChange={(event) => change({ dailyBudgetMinutes: event.target.valueAsNumber })}
                aria-describedby="daily-budget-hint"
                className="min-h-11 w-24 rounded-card border border-line bg-card px-2"
              />
            </label>
            <p id="daily-budget-hint" className="-mt-2 text-xs text-muted">{t('profile.budgetHint')}</p>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('settings.voice')}
              <select
                value={values.ttsVoiceURI ?? ''}
                onChange={(event) => change({ ttsVoiceURI: event.target.value || null })}
                className="min-h-11 w-full rounded-card border border-line bg-card px-2"
              >
                <option value="">{t('profile.defaultVoice')}</option>
                {values.ttsVoiceURI && !voices.some((voice) => voice.voiceURI === values.ttsVoiceURI) && (
                  <option value={values.ttsVoiceURI}>{t('profile.unavailableVoice')}</option>
                )}
                {voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>{t('settings.rate')} · {values.ttsRate.toFixed(2)}×</span>
              <input type="range" min={0.5} max={1.5} step={0.05} value={values.ttsRate}
                onChange={(event) => change({ ttsRate: event.target.valueAsNumber })}
                className="min-h-10 w-full accent-primary"
              />
            </label>
            <Button type="button" variant="outline" onClick={() => pronounce('Dzień dobry! Uczymy się języka polskiego.', values)}>
              {t('profile.previewVoice')}
            </Button>
            {message && <p role="status" className="text-sm text-muted">{message}</p>}
            <Button type="submit" disabled={!draft} busy={status === 'saving'} busyLabel={t('profile.saving')}>
              {t('common.save')}
            </Button>
            {status === 'saved' && <p role="status" className="text-sm text-ok-ink">{t('profile.saved')}</p>}
            {status === 'error' && <p role="alert" className="text-sm text-danger-ink">{t('profile.saveError')}</p>}
          </Stack>
        </fieldset>
      </form>
    </Card>
  )
}


function LessonSettings({ settings }: { settings: LessonPreferences }) {
  const t = useTranslations('profile')
  const [draft, setDraft] = useState<LessonPreferences | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const values = draft ?? settings
  const formats: { id: GrammarLessonFormat; label: string }[] = [
    { id: 'choice', label: t('lessonChoice') },
    { id: 'typed', label: t('lessonTyped') },
    { id: 'write', label: t('lessonWrite') },
  ]

  function change(patch: Partial<LessonPreferences>) {
    setDraft({ ...values, ...patch })
    setStatus('idle')
  }

  async function save() {
    if (!draft || status === 'saving') return
    setStatus('saving')
    try {
      await saveSettings(draft)
      setDraft(null)
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  return (
    <Card>
      <form onSubmit={(event) => { event.preventDefault(); void save() }}>
        <fieldset disabled={status === 'saving'} className="min-w-0">
          <legend className="mb-3 text-lg font-semibold tracking-tight">{t('lessonSettings')}</legend>
          <Stack gap="md">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('newWordsPerDay')}
              <input type="number" min={0} max={10} required
                value={values.newWordsPerDay}
                onChange={(event) => change({ newWordsPerDay: event.target.valueAsNumber })}
                className="min-h-11 w-24 rounded-card border border-line bg-card px-2" />
            </label>
            <p className="text-xs text-muted">{t('newWordsHint')}</p>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('grammarExercisesPerDay')}
              <input type="number" min={0} max={20} required
                value={values.grammarExercisesPerDay}
                onChange={(event) => change({ grammarExercisesPerDay: event.target.valueAsNumber })}
                className="min-h-11 w-24 rounded-card border border-line bg-card px-2" />
            </label>
            <p className="text-sm font-medium">{t('grammarLessonFormats')}</p>
            {formats.map(({ id, label }) => (
              <label key={id} className="flex min-h-10 items-center gap-3 text-sm">
                <input type="checkbox" className="size-5 accent-primary"
                  checked={values.grammarLessonFormats.includes(id)}
                  disabled={values.grammarLessonFormats.length === 1 && values.grammarLessonFormats.includes(id)}
                  onChange={(event) => change({
                    grammarLessonFormats: event.target.checked
                      ? [...values.grammarLessonFormats, id]
                      : values.grammarLessonFormats.filter((format) => format !== id),
                  })} />
                {label}
              </label>
            ))}
            <p className="text-xs text-muted">{t('grammarLessonHint')}</p>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('readingTextsPerDay')}
              <input type="number" min={0} max={3} required value={values.readingTextsPerDay}
                onChange={(event) => change({ readingTextsPerDay: event.target.valueAsNumber })}
                className="min-h-11 w-24 rounded-card border border-line bg-card px-2" />
            </label>
            <Button type="submit" disabled={!draft} busy={status === 'saving'} busyLabel={t('saving')}>
              {t('saveLessonSettings')}
            </Button>
            {status === 'saved' && <p role="status" className="text-sm text-ok-ink">{t('saved')}</p>}
            {status === 'error' && <p role="alert" className="text-sm text-danger-ink">{t('saveError')}</p>}
          </Stack>
        </fieldset>
      </form>
    </Card>
  )
}
