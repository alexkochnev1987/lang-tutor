const STORAGE_KEY = 'personalWords';

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
