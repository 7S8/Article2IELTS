/* Phone menu: on narrow screens the top links fold into the ☰ button. */
(function () {
  const btn = document.getElementById('menu-btn');
  const nav = document.getElementById('topnav');
  if (!btn || !nav) return;

  function open(show) {
    nav.classList.toggle('open', show);
    btn.setAttribute('aria-expanded', String(show));
  }

  btn.addEventListener('click', (e) => { e.stopPropagation(); open(!nav.classList.contains('open')); });
  // Close after choosing a link, changing page, tapping elsewhere or pressing Escape.
  nav.addEventListener('click', (e) => { if (e.target.closest('a, button')) open(false); });
  window.addEventListener('hashchange', () => open(false));
  document.addEventListener('click', (e) => { if (nav.classList.contains('open') && !e.target.closest('#topnav, #menu-btn')) open(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { open(false); btn.focus(); } });
})();
