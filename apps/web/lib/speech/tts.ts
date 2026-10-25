/**
 * Синтез речи. Правила R21–R25 из DEV_RULES.md.
 *
 * Единственный механизм озвучки слов и фраз в MVP: бесплатно, 100% покрытие,
 * и это ЕДИНСТВЕННЫЙ способ озвучить слово, которое пользователь добавил сам.
 * Материалы для аудирования — отдельная история, см. AUDIO_AND_PRONUNCIATION.md.
 */

export class NoSpeechSupport extends Error {
  constructor() { super('speech_synthesis_unsupported') }
}
export class NoVoiceForLanguage extends Error {
  constructor(public lang: string) { super(`no_voice_for_${lang}`) }
}

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null

/** getVoices() на первом вызове часто пуст — список приезжает асинхронно. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesPromise) return voicesPromise
  voicesPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve([])
    const got = speechSynthesis.getVoices()
    if (got.length) return resolve(got)
    speechSynthesis.addEventListener(
      'voiceschanged',
      () => resolve(speechSynthesis.getVoices()),
      { once: true },
    )
    // Safari иногда не стреляет voiceschanged вовсе
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1500)
  })
  return voicesPromise
}

/**
 * R25: офлайн годится только голос с localService — сетевые молчат без сети.
 */
export async function pickVoice(
  lang: string,
  preferredURI?: string | null,
): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices()
  const base = lang.split('-')[0].toLowerCase()
  const matches = voices.filter((v) =>
    v.lang.replace('_', '-').toLowerCase().startsWith(base))
  if (!matches.length) return null

  if (preferredURI) {
    const exact = matches.find((v) => v.voiceURI === preferredURI)
    if (exact) return exact
  }
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  if (offline) return matches.find((v) => v.localService) ?? null

  return matches.find((v) => v.lang.replace('_', '-') === lang)
      ?? matches.find((v) => v.localService)
      ?? matches[0]
}

export interface SpeakOptions {
  lang: string
  rate?: number
  voiceURI?: string | null
  signal?: AbortSignal
}

/**
 * R21: задаются И voice, И lang. Одного lang мало — при отсутствии голоса
 * браузер молча прочитает чужим, и пользователь выучит неверное произношение.
 * R22: отсутствие голоса — явная ошибка, а не тишина.
 */
export async function speak(text: string, opts: SpeakOptions): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    throw new NoSpeechSupport()
  }
  const voice = await pickVoice(opts.lang, opts.voiceURI)
  if (!voice) throw new NoVoiceForLanguage(opts.lang)

  speechSynthesis.cancel()
  // Пауза после cancel(): без неё Chrome иногда роняет новую реплику с 'canceled'
  await new Promise((r) => setTimeout(r, 80))

  return new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text)
    u.voice = voice
    u.lang = voice.lang
    u.rate = opts.rate ?? 0.95

    // Chrome умеет подвесить очередь: speaking=true и ни одного события.
    // Страховка по длине текста, иначе промис никогда не разрешится.
    const guard = setTimeout(() => resolve(), 2000 + text.length * 120)
    const done = () => { clearTimeout(guard); resolve() }

    u.onend = done
    u.onerror = (e) => {
      clearTimeout(guard)
      e.error === 'canceled' || e.error === 'interrupted' ? resolve() : reject(e)
    }
    opts.signal?.addEventListener('abort', () => { speechSynthesis.cancel(); done() })

    speechSynthesis.speak(u)
  })
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    speechSynthesis.cancel()
  }
}

/**
 * iOS требует жест пользователя на первое воспроизведение.
 * Вызывать из обработчика первого тапа в сессии.
 */
export function warmUpSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance('')
  u.volume = 0
  speechSynthesis.speak(u)
}
