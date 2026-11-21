const STORAGE_KEY = 'personalWords';
const API_URL = 'https://web-ecru-ten-90.vercel.app';

const form = document.querySelector('#word-form');
const wordInput = document.querySelector('#word');
const translationInput = document.querySelector('#translation');
const wordsList = document.querySelector('#words');
const empty = document.querySelector('#empty');
const count = document.querySelector('#count');
const clearButton = document.querySelector('#clear');
const status = document.querySelector('#status');
const loginButton = document.querySelector('#login');
const signedIn = document.querySelector('#signed-in');
const userName = document.querySelector('#user-name');
const logoutButton = document.querySelector('#logout');
const exampleInput = document.querySelector('#example');
const remindersInput = document.querySelector('#reminders');
const practiceMode = document.querySelector('#practice-mode');
const startPracticeButton = document.querySelector('#start-practice');
const practicePanel = document.querySelector('#practice');
const practiceIndex = document.querySelector('#practice-index');
const practiceScore = document.querySelector('#practice-score');
const practicePrompt = document.querySelector('#practice-prompt');
const practiceAnswer = document.querySelector('#practice-answer');
const checkAnswerButton = document.querySelector('#check-answer');
const nextWordButton = document.querySelector('#next-word');
const practiceFeedback = document.querySelector('#practice-feedback');
const practiceProgress = document.querySelector('#practice-progress');

const SETTINGS_KEY = 'practiceSettings';
const SESSION_SIZE = 5;
let practiceSession = [];
let practicePosition = 0;
let practiceCorrect = 0;
let answerChecked = false;

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

async function getPracticeSettings() {
  const result = await chrome.storage.local.get({ [SETTINGS_KEY]: { remindersEnabled: false, mode: 'word-to-translation' } });
  return {
    remindersEnabled: Boolean(result[SETTINGS_KEY]?.remindersEnabled),
    mode: result[SETTINGS_KEY]?.mode || 'word-to-translation',
  };
}

async function savePracticeSettings() {
  const settings = { remindersEnabled: remindersInput.checked, mode: practiceMode.value };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  await chrome.runtime.sendMessage({ type: 'update-reminder', enabled: settings.remindersEnabled });
  showStatus(settings.remindersEnabled ? 'Напоминания включены' : 'Напоминания выключены');
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
  if (!word || !translation) return;

  const words = await getWords();
  const withoutDuplicate = words.filter((item) => item.word.toLocaleLowerCase() !== word.toLocaleLowerCase());
  withoutDuplicate.unshift({
    id: crypto.randomUUID(),
    word,
    translation,
    example: exampleInput.value.trim(),
    createdAt: new Date().toISOString(),
  });
  await setWords(withoutDuplicate);
  try { await saveRemote(withoutDuplicate[0]); } catch { showStatus('Сохранено локально; синхронизация не удалась', true); }
  form.reset();
  showStatus('Слово добавлено');
  await render();
  wordInput.focus();
});

function normalizeAnswer(value) {
  return value.trim().toLocaleLowerCase().replace(/[.!?,;:]+$/g, '');
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function updatePracticeProgress() {
  practiceProgress.textContent = `${practiceSession.length || SESSION_SIZE} слов`;
  practiceIndex.textContent = `${Math.min(practicePosition + 1, practiceSession.length)} / ${practiceSession.length}`;
  practiceScore.textContent = `${practiceCorrect} правильно`;
}

function renderPracticeCard() {
  const item = practiceSession[practicePosition];
  if (!item) {
    practicePrompt.textContent = 'Тренировка завершена';
    practiceAnswer.hidden = true;
    checkAnswerButton.hidden = true;
    nextWordButton.hidden = true;
    practiceFeedback.textContent = `Результат: ${practiceCorrect} из ${practiceSession.length}.`;
    return;
  }

  const mode = practiceMode.value;
  practicePrompt.textContent = mode === 'translation-to-word' ? item.translation : item.word;
  practiceAnswer.hidden = false;
  checkAnswerButton.hidden = false;
  nextWordButton.hidden = true;
  practiceAnswer.value = '';
  practiceAnswer.placeholder = mode === 'brainstorm' ? 'Напишите пример или ассоциацию' : 'Введите ответ';
  practiceFeedback.textContent = '';
  practiceFeedback.classList.remove('success');
  answerChecked = false;
  updatePracticeProgress();
  practiceAnswer.focus();
}

async function startPractice() {
  const words = (await getWords()).filter((item) => item.word && item.translation);
  if (!words.length) {
    showStatus('Добавьте минимум одно слово с переводом', true);
    return;
  }
  practiceSession = shuffle(words).slice(0, SESSION_SIZE);
  practicePosition = 0;
  practiceCorrect = 0;
  practicePanel.hidden = false;
  renderPracticeCard();
}

function checkAnswer() {
  if (answerChecked) return;
  const item = practiceSession[practicePosition];
  const answer = practiceAnswer.value.trim();
  if (!item || !answer) return;
  const mode = practiceMode.value;
  const expected = mode === 'translation-to-word' ? item.word : item.translation;
  const isBrainstorm = mode === 'brainstorm';
  const correct = isBrainstorm || normalizeAnswer(answer) === normalizeAnswer(expected);
  if (correct) practiceCorrect += 1;
  answerChecked = true;
  practiceFeedback.textContent = isBrainstorm
    ? `Хорошо! Перевод: ${item.translation}`
    : (correct ? 'Правильно!' : `Правильный ответ: ${expected}`);
  practiceFeedback.classList.toggle('success', correct);
  checkAnswerButton.hidden = true;
  nextWordButton.hidden = false;
  updatePracticeProgress();
}

function nextPracticeWord() {
  practicePosition += 1;
  renderPracticeCard();
}

remindersInput.addEventListener('change', savePracticeSettings);
practiceMode.addEventListener('change', async () => {
  await savePracticeSettings();
  if (!practicePanel.hidden) renderPracticeCard();
});
startPracticeButton.addEventListener('click', startPractice);
checkAnswerButton.addEventListener('click', checkAnswer);
nextWordButton.addEventListener('click', nextPracticeWord);
practiceAnswer.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') checkAnswer();
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

async function renderPracticeSettings() {
  const settings = await getPracticeSettings();
  remindersInput.checked = settings.remindersEnabled;
  practiceMode.value = settings.mode;
}

void Promise.all([render(), renderAccount(), renderPracticeSettings(), syncRemoteWords().catch(() => undefined)]);

if (new URLSearchParams(location.search).get('practice') === '1') {
  void startPractice();
}
