type SpeechResult = { isFinal: boolean; 0: { transcript: string } }

export interface BrowserRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

export type SpeechLanguage = 'pl'

const SPEECH_TAGS: Record<SpeechLanguage, string> = {
  pl: 'pl-PL',
}

export function speechTagForLanguage(language: string): string | null {
  return SPEECH_TAGS[language as SpeechLanguage] ?? null
}

export function createBrowserRecognition(language = 'pl'): BrowserRecognition | null {
  const browser = window as Window & {
    SpeechRecognition?: new () => BrowserRecognition
    webkitSpeechRecognition?: new () => BrowserRecognition
  }
  const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition
  if (!Recognition) return null

  const speechTag = speechTagForLanguage(language)
  if (!speechTag) return null
  const recognition = new Recognition()
  recognition.lang = speechTag
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1
  return recognition
}

function normalize(text: string) {
  return text.normalize('NFC').toLocaleLowerCase('pl')
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '')
    .replace(/\s+/g, ' ')
}

export function pronunciationMatches(expected: string, transcript: string) {
  return normalize(expected) === normalize(transcript)
}
