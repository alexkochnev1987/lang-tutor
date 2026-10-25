/**
 * Вход через Google Identity Services.
 *
 * ВАЖНО, что это сейчас даёт и чего не даёт.
 *
 * Бэкенда нет, все данные лежат локально в IndexedDB. Поэтому вход здесь —
 * НЕ защита: защищать нечего, авторизовывать нечего. Он нужен для двух
 * вещей:
 *   1. показать, кто вошёл, и разделить локальные профили на одном устройстве;
 *   2. заготовка под синхронизацию — когда появится сервер, тот же ID-токен
 *      уйдёт на него и будет проверен по-настоящему.
 *
 * ID-токен НЕ проверяется криптографически на клиенте: подпись может
 * проверить только сервер. Payload читается ради имени и аватара и не
 * является доказательством личности. Когда появится бэкенд — токен уходит
 * на /auth/google, сервер валидирует его у Google и выдаёт свою сессию.
 *
 * Скрипт грузится лениво, только при открытии окна входа: тот, кто не
 * входит, не платит ничем, и офлайн работает как обычно.
 */

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
export const googleAuthEnabled = Boolean(GOOGLE_CLIENT_ID)

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

export interface GoogleProfile {
  sub: string
  email?: string
  name?: string
  picture?: string
  idToken: string
  expiresAt: number
}

interface ButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'small' | 'medium' | 'large'
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  shape?: 'rectangular' | 'pill'
  width?: number
  locale?: string
}

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(opts: {
        client_id: string
        callback: (res: { credential?: string }) => void
        auto_select?: boolean
        cancel_on_tap_outside?: boolean
      }): void
      renderButton(parent: HTMLElement, opts: ButtonOptions): void
      disableAutoSelect(): void
    }
  }
}

declare global {
  interface Window { google?: GoogleIdentity }
}

let scriptPromise: Promise<GoogleIdentity> | null = null

function loadScript(): Promise<GoogleIdentity> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<GoogleIdentity>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google)
    const el = document.createElement('script')
    el.src = SCRIPT_SRC
    el.async = true
    el.defer = true
    el.onload = () =>
      window.google?.accounts?.id
        ? resolve(window.google)
        : reject(new Error('google_script_broken'))
    el.onerror = () => {
      scriptPromise = null // дать повторить попытку после сбоя сети
      reject(new Error('google_script_unavailable'))
    }
    document.head.appendChild(el)
  })
  return scriptPromise
}

/** Читает payload JWT. НЕ проверяет подпись — это может только сервер. */
function decodeIdToken(idToken: string): GoogleProfile | null {
  try {
    const [, payload] = idToken.split('.')
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(decodeURIComponent(escape(json)))
    if (!claims.sub) return null
    return {
      sub: claims.sub,
      email: claims.email,
      name: claims.name,
      picture: claims.picture,
      idToken,
      expiresAt: (claims.exp ?? 0) * 1000,
    }
  } catch {
    return null
  }
}

/**
 * Рисует официальную кнопку Google в `parent` и вызывает `onProfile`,
 * когда пользователь выбрал аккаунт.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  onProfile: (profile: GoogleProfile) => void,
  options: ButtonOptions = {},
): Promise<void> {
  if (!googleAuthEnabled) throw new Error('google_auth_not_configured')
  const google = await loadScript()
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (res) => {
      if (!res.credential) return
      const profile = decodeIdToken(res.credential)
      if (profile) onProfile(profile)
    },
    cancel_on_tap_outside: true,
  })
  parent.replaceChildren()
  google.accounts.id.renderButton(parent, {
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    width: 280,
    ...options,
  })
}

/** Не даёт Google молча залогинить обратно после выхода. */
export function disableGoogleAutoSelect(): void {
  window.google?.accounts?.id?.disableAutoSelect()
}
