const STORAGE_KEY = 'personalWords';
const APP_URL = 'https://web-ecru-ten-90.vercel.app/';
const API_URL = 'https://web-ecru-ten-90.vercel.app';

const form = document.querySelector('#word-form');
const wordInput = document.querySelector('#word');
const translationInput = document.querySelector('#translation');
const exampleInput = document.querySelector('#example');
const wordsList = document.querySelector('#words');
const empty = document.querySelector('#empty');
const count = document.querySelector('#count');
const clearButton = document.querySelector('#clear');
const status = document.querySelector('#status');
const loginButton = document.querySelector('#login');
const signedIn = document.querySelector('#signed-in');
const userName = document.querySelector('#user-name');
const logoutButton = document.querySelector('#logout');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function getWords() {
  const result = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
}

async function setWords(words) {
  await chrome.storage.local.set({ [STORAGE_KEY]: words });
}

async function getAuth() {
  return chrome.storage.local.get({ appToken: '', user: null, lastAuthError: '' });
}

async function syncRemoteWords() {
  const { appToken } = await getAuth();
  if (!appToken) return;
  const response = await fetch(`${API_URL}/api/state/`, { headers: { Authorization: `Bearer ${appToken}` } });
  if (!response.ok) throw new Error('state_load_failed');
  const state = await response.json();
  const remote = (state.personalDict || []).map((item) => ({
    id: item.id,
    word: item.lemma,
    translation: item.translation,
    example: item.context || '',
    createdAt: item.createdAt,
    remote: true,
  }));
  const local = await getWords();
  const remoteWords = new Set(remote.map((item) => item.word.toLocaleLowerCase()));
  await setWords([...remote, ...local.filter((item) => !remoteWords.has(item.word.toLocaleLowerCase()))]);
}

async function saveRemote(item) {
  const { appToken } = await getAuth();
  if (!appToken || !item.translation) return;
  const response = await fetch(`${API_URL}/api/personal-dict/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${appToken}` },
    body: JSON.stringify({
      id: item.id,
      lemma: item.word,
      translation: item.translation,
      context: item.example || null,
      sourceUrl: null,
    }),
  });
  if (!response.ok) throw new Error('word_save_failed');
}

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

async function render() {
  const words = await getWords();
  count.textContent = String(words.length);
  clearButton.hidden = words.length === 0;
  empty.hidden = words.length !== 0;
  wordsList.innerHTML = words.map((item, index) => `
    <li class="word">
      <div class="word-main">
        <div class="word-title">${escapeHtml(item.word)}</div>
        <div class="translation">${escapeHtml(item.translation || 'Перевод не добавлен')}</div>
        ${item.example ? `<p class="example">${escapeHtml(item.example)}</p>` : ''}
      </div>
      <button class="delete" type="button" data-index="${index}">Удалить</button>
    </li>
  `).join('');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const word = wordInput.value.trim();
  const translation = translationInput.value.trim();
  const example = exampleInput.value.trim();
  if (!word || !translation) return;

  const words = await getWords();
  const withoutDuplicate = words.filter((item) => item.word.toLocaleLowerCase() !== word.toLocaleLowerCase());
  withoutDuplicate.unshift({
    id: crypto.randomUUID(),
    word,
    translation,
    example,
    createdAt: new Date().toISOString(),
  });
  await setWords(withoutDuplicate);
  try { await saveRemote(withoutDuplicate[0]); } catch { showStatus('Сохранено локально; синхронизация не удалась', true); }
  form.reset();
  showStatus('Слово добавлено');
  await render();
  wordInput.focus();
});

wordsList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-index]');
  if (!button) return;
  const words = await getWords();
  words.splice(Number(button.dataset.index), 1);
  await setWords(words);
  showStatus('Слово удалено');
  await render();
});

clearButton.addEventListener('click', async () => {
  if (!confirm('Удалить все сохранённые слова?')) return;
  await setWords([]);
  showStatus('Словарь очищен');
  await render();
});

loginButton.addEventListener('click', async () => {
  loginButton.disabled = true;
  showStatus('Открываем вход…');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'login' });
    if (!result?.ok) throw new Error(result?.error || 'auth_failed');
    await syncRemoteWords();
    await render();
    await renderAccount();
    showStatus('Вход выполнен');
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Не удалось войти', true);
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  await chrome.storage.local.remove(['appToken', 'user']);
  await renderAccount();
  showStatus('Выход выполнен');
});

async function renderAccount() {
  const { user, lastAuthError } = await getAuth();
  loginButton.hidden = Boolean(user);
  signedIn.hidden = !user;
  userName.textContent = user ? (user.name || user.email || 'Вы вошли') : '';
  if (!user && lastAuthError) showStatus(`Ошибка входа: ${lastAuthError}`, true);
}

document.querySelector('#open-app').addEventListener('click', () => {
  chrome.tabs.create({ url: APP_URL });
});

void Promise.all([render(), renderAccount(), syncRemoteWords().catch(() => undefined)]);
