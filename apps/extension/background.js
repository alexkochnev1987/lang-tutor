const STORAGE_KEY = 'personalWords';
const APP_URL = 'https://web-ecru-ten-90.vercel.app/';
const API_URL = 'https://web-ecru-ten-90.vercel.app';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-selected-word',
    title: 'Сохранить в Polski B1: %s',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'save-selected-word') return;

  const word = (info.selectionText || '').trim();
  if (!word) return;

  const result = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  const words = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  const exists = words.some((item) => item.word.toLocaleLowerCase() === word.toLocaleLowerCase());

  if (!exists) {
    words.unshift({
      id: crypto.randomUUID(),
      word,
      translation: '',
      example: '',
      createdAt: new Date().toISOString(),
    });
    await chrome.storage.local.set({ [STORAGE_KEY]: words });
  }
});

async function loginWithGoogle() {
  const state = crypto.randomUUID();
  const redirectUri = chrome.identity.getRedirectURL('extension-auth');
  const url = new URL(`${APP_URL}extension-auth/`);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: url.toString(),
    interactive: true,
  });
  if (!responseUrl) throw new Error('auth_cancelled');

  const callback = new URL(responseUrl);
  if (callback.searchParams.get('state') !== state) throw new Error('invalid_auth_state');
  const code = callback.searchParams.get('code');
  if (!code) throw new Error('missing_auth_code');

  const response = await fetch(`${API_URL}/api/auth/extension/exchange/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error(`auth_exchange_failed_${response.status}`);

  const data = await response.json();
  await chrome.storage.local.set({ appToken: data.token, user: data.user });
  await chrome.storage.local.remove('lastAuthError');
  return data.user;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'login') return undefined;

  loginWithGoogle()
    .then((user) => sendResponse({ ok: true, user }))
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : 'auth_failed';
      await chrome.storage.local.set({ lastAuthError: message });
      sendResponse({ ok: false, error: message });
    });

  return true;
});
