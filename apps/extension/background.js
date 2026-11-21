const STORAGE_KEY = 'personalWords';
const APP_URL = 'https://web-ecru-ten-90.vercel.app/';
const API_URL = 'https://web-ecru-ten-90.vercel.app';
const REMINDER_ALARM = 'polski-b1-review-reminder';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-selected-word',
    title: 'Сохранить в Polski B1: %s',
    contexts: ['selection'],
  });
});

async function setReminderAlarm(enabled) {
  await chrome.alarms.clear(REMINDER_ALARM);
  if (enabled) {
    await chrome.alarms.create(REMINDER_ALARM, { delayInMinutes: 30, periodInMinutes: 30 });
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== REMINDER_ALARM) return;
  const result = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  const words = (Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : []).filter((item) => item.word && item.translation);
  if (!words.length) return;
  const item = words[Math.floor(Math.random() * words.length)];
  await chrome.notifications.create(`review-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'Polski B1 — время повторить',
    message: `Слово: ${item.word}\nВспомните перевод и откройте тренировку.`,
    buttons: [{ title: 'Начать тренировку' }],
    priority: 1,
  });
});

chrome.notifications.onClicked.addListener(() => {
  chrome.tabs.create({ url: `${chrome.runtime.getURL('popup.html')}?practice=1` });
});

chrome.notifications.onButtonClicked.addListener((_notificationId, buttonIndex) => {
  if (buttonIndex === 0) chrome.tabs.create({ url: `${chrome.runtime.getURL('popup.html')}?practice=1` });
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
  if (message?.type === 'update-reminder') {
    setReminderAlarm(Boolean(message.enabled)).then(() => sendResponse({ ok: true }));
    return true;
  }
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
