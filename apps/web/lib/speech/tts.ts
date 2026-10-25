export type SpeakOutcome = 'ok' | 'unsupported' | 'no-voice'
export type SpeakProblem = 'stalled' | 'failed'

const NO_START_TIMEOUT_MS = 2500
const DEFAULT_RATE = 0.95
const SELF_CANCELLED = ['canceled', 'interrupted']

let knownVoices: SpeechSynthesisVoice[] = []
let subscribedToVoiceUpdates = false

function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function refreshKnownVoices(): SpeechSynthesisVoice[] {
  const reported = speechSynthesis.getVoices()
  // getVoices() answers [] until the engine is ready — never let that erase a known list
  if (reported.length) knownVoices = reported
  return knownVoices
}

export function primeVoices(): void {
  if (!speechAvailable() || subscribedToVoiceUpdates) return
  subscribedToVoiceUpdates = true
  refreshKnownVoices()
  speechSynthesis.addEventListener('voiceschanged', refreshKnownVoices)
}

export function findVoice(
  lang: string,
  preferredURI?: string | null,
): SpeechSynthesisVoice | null {
  if (!speechAvailable()) return null

  const languageTag = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-')
  const sameLanguage = refreshKnownVoices().filter((v) =>
    languageTag(v).toLowerCase().startsWith(lang.split('-')[0].toLowerCase()))
  if (!sameLanguage.length) return null

  const preferred = preferredURI && sameLanguage.find((v) => v.voiceURI === preferredURI)
  return preferred
      || sameLanguage.find((v) => v.localService && languageTag(v) === lang)
      || sameLanguage.find((v) => v.localService)
      || sameLanguage.find((v) => languageTag(v) === lang)
      || sameLanguage[0]
}

function cancelOnlyIfBusy(): void {
  // cancel() on an idle queue followed straight by speak() wedges Chrome: speaking stays
  // true and no utterance event ever fires again
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel()
}

export interface SpeakOptions {
  lang?: string
  rate?: number
  voiceURI?: string | null
  onProblem?: (problem: SpeakProblem) => void
}

// Stays synchronous on purpose: an await before speechSynthesis.speak() spends the user
// gesture, and the browser then refuses to make a sound.
export function speak(text: string, opts: SpeakOptions = {}): SpeakOutcome {
  if (!speechAvailable()) return 'unsupported'

  const voice = findVoice(opts.lang ?? 'pl-PL', opts.voiceURI)
  if (!voice) return 'no-voice'

  cancelOnlyIfBusy()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = opts.rate ?? DEFAULT_RATE

  let problemReported = false
  const reportProblem = (problem: SpeakProblem) => {
    if (problemReported) return
    problemReported = true
    opts.onProblem?.(problem)
  }

  let hasStarted = false
  utterance.onstart = () => { hasStarted = true }
  utterance.onerror = (e) => {
    if (!SELF_CANCELLED.includes(e.error)) reportProblem('failed')
  }
  setTimeout(() => { if (!hasStarted) reportProblem('stalled') }, NO_START_TIMEOUT_MS)

  speechSynthesis.speak(utterance)
  return 'ok'
}

export function stop(): void {
  if (speechAvailable()) speechSynthesis.cancel()
}
