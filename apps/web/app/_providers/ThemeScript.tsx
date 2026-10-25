/**
 * Ставит data-palette и data-mode до первой отрисовки.
 *
 * Без этого при загрузке будет вспышка дефолтной палитры: React
 * смонтируется позже, а IndexedDB вообще асинхронна. Поэтому выбор
 * темы живёт в localStorage и читается синхронно. UX_UI.md §1.8
 *
 * Скрипт намеренно дублирует логику lib/theme — он обязан быть
 * инлайновым и не тянуть за собой бандл.
 */
const SCRIPT = `
(function () {
  try {
    var p = localStorage.getItem('polski.palette') || 'graphite';
    var m = localStorage.getItem('polski.mode') || 'system';
    if (m === 'system') {
      m = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    var r = document.documentElement;
    r.dataset.palette = p;
    r.dataset.mode = m;
  } catch (e) {
    document.documentElement.dataset.palette = 'graphite';
    document.documentElement.dataset.mode = 'light';
  }
})();
`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
}
