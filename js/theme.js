/* Background colour: Light, Paper, Dark or Auto (follows the device). Saved in this browser. */
(function () {
  const KEY = 'a2i.theme';
  const root = document.documentElement;
  const btn = document.getElementById('theme-btn');
  const menu = document.getElementById('theme-menu');
  if (!btn || !menu) return;

  function current() {
    try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; }
  }

  function apply(theme) {
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode: works until reload */ }
    menu.querySelectorAll('[data-theme-set]').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.themeSet === theme)));
  }

  function open(show) {
    menu.hidden = !show;
    btn.setAttribute('aria-expanded', String(show));
  }

  btn.addEventListener('click', (e) => { e.stopPropagation(); open(menu.hidden); });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-set]');
    if (!b) return;
    apply(b.dataset.themeSet);
    open(false);
  });
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.theme-pick')) open(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { open(false); btn.focus(); } });

  apply(current());
})();
