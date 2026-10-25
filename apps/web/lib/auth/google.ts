/**
 * Вход через Google Identity Services — клиентская половина.
 *
 * Задача этого файла ровно одна: получить у Google ID-токен и отдать его
 * наверх. Ничего из токена здесь не читается и нигде не сохраняется —
 * подпись может проверить только сервер, а payload без проверки подписи
 * не доказательство личности.
 *
 * Дальше токен уходит в POST /api/auth/google, сервер сверяет подпись с
 * ключами Google, проверяет `aud` и выдаёт свою httpOnly-сессию. Имя и
 * аватар приходят уже из нашей базы.
 *
 * Скрипт грузится лениво, при открытии окна входа: тот, кто не входит,
 * не платит ничем.
 */

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
export const googleAuthEnabled = Boolean(GOOGLE_CLIENT_ID)

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

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

/**
 * Рисует официальную кнопку Google в `parent` и отдаёт ID-токен, когда
 * пользователь выбрал аккаунт. Проверять токен — задача сервера.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  onCredential: (idToken: string) => void,
  options: ButtonOptions = {},
): Promise<void> {
  if (!googleAuthEnabled) throw new Error('google_auth_not_configured')
  const google = await loadScript()
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (res) => { if (res.credential) onCredential(res.credential) },
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
