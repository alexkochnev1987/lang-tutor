'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Card, Screen, Stack } from '@polski/ui'
import { Nav } from '@/app/_components/Nav'
import { SectionHeading } from '@/app/_components/SectionHeading'
import { SettingsRow } from '@/app/_components/SettingsRow'
import { SignInButton } from '@/app/_components/SignInButton'
import { loadState, saveSettings, useAppState } from '@/lib/data/store'
import type { Settings } from '@/lib/data/types'
import { usePronounce } from '@/lib/speech/usePronounce'
import { voicesForLanguage } from '@/lib/speech/tts'
import { speechTagForLanguage } from '@/lib/speech/recognition'

type StudySettings = Pick<Settings, 'targetLanguage' | 'dailyBudgetMinutes' | 'ttsVoiceURI' | 'ttsRate'>

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
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <SectionHeading section="profile" />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4">
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
        {!state && !loadFailed && <p role="status" className="text-sm text-muted">{t('common.loading')}</p>}
        {state && (
          <Stack gap="md">
            <Card>
              <Stack gap="sm">
                <h2 id="profile-account" className="scroll-mt-4 text-lg font-semibold tracking-tight">{t('profile.account')}</h2>
                {!state.user.signedIn && (
                  <div className="text-sm text-muted">
                    <p className="font-medium text-ink">{t('profile.guest')}</p>
                    <p>{t('auth.localOnly')}</p>
                  </div>
                )}
                <SignInButton />
              </Stack>
            </Card>
            <Card>
              <Stack gap="sm">
                <h2 className="text-lg font-semibold tracking-tight">{t('profile.languageAndAppearance')}</h2>
                <SettingsRow />
              </Stack>
            </Card>
            <StudyPreferences key={state.user.id} settings={state.settings} />
          </Stack>
        )}
      </main>
      <Nav />
    </Screen>
  )
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
            <Button type="submit" disabled={!draft}>
              {status === 'saving' ? t('profile.saving') : t('common.save')}
            </Button>
            {status === 'saved' && <p role="status" className="text-sm text-ok-ink">{t('profile.saved')}</p>}
            {status === 'error' && <p role="alert" className="text-sm text-danger-ink">{t('profile.saveError')}</p>}
          </Stack>
        </fieldset>
      </form>
    </Card>
  )
}
