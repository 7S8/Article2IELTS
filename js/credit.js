/* Author credit. Article2IELTS was created by Nuramatova Sakinat Ibnuabasovna.
   Copyright (c) 2026 Nuramatova Sakinat Ibnuabasovna. All rights reserved — see LICENSE.
   The footer is shown on every page (with the creator's signature on the home page);
   if it is removed or changed in the page, it is put back straight away. */
(function () {
  const A2I = (window.A2I = window.A2I || {});
  const CREATOR = 'Nuramatova Sakinat Ibnuabasovna';
  const YEAR = Math.max(2026, new Date().getFullYear());
  const NOTE = '© ' + YEAR + ' Article2IELTS · All rights reserved · Not affiliated with IELTS, the British Council, IDP or Cambridge';
  // The home page shows the signature; other pages show only the copyright line.
  const TEXTS = { home: 'Article2IELTS' + 'Made with ♥ by' + CREATOR + NOTE, page: NOTE }; // used to check it is intact

  A2I.CREATOR = CREATOR;
  A2I.CREDIT = 'Created by ' + CREATOR + ' · © ' + YEAR + ' Article2IELTS. All rights reserved.';
  Object.freeze && Object.defineProperty(A2I, 'CREATOR', { value: CREATOR, writable: false, configurable: false });

  const BASE = 'visibility:visible!important;opacity:1!important;position:static!important;text-align:center;' +
    'font:11px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--muted,#6b6a66);' +
    'margin:24px 16px 0;border:0;border-top:1px solid var(--border,#dcd9d0);clip:auto!important;' +
    'height:auto!important;transform:none!important;filter:none!important;';
  const STYLES = {
    home: 'display:block!important;padding:30px 16px 28px;' + BASE,
    page: 'display:block!important;padding:12px 16px;' + BASE,
  };

  // Handwritten font for the signature (falls back to a script font if it can't load).
  function loadFont() {
    if (document.getElementById('a2i-credit-font')) return;
    const l = document.createElement('link');
    l.id = 'a2i-credit-font';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap';
    document.head.appendChild(l);
  }

  function el(tag, css, ...kids) {
    const e = document.createElement(tag);
    e.style.cssText = css;
    e.append(...kids);
    return e;
  }

  function mode() {
    return document.querySelector('.landing') ? 'home' : 'page';
  }

  function make(m) {
    const f = document.createElement('footer');
    f.id = 'a2i-credit';
    f.dataset.mode = m;
    f.setAttribute('role', 'contentinfo');
    f.setAttribute('style', STYLES[m]);
    if (m === 'home') {
      loadFont();
      const brand = el('div', 'font:700 1.15rem Georgia,"Times New Roman",serif;color:var(--text,#1d1d1b)',
        'Article', el('span', 'color:var(--accent,#b3261e)', '2'), 'IELTS');
      const made = el('div', 'margin:14px 0 0;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase',
        'Made with ', el('span', 'color:var(--accent,#b3261e)', '♥'), ' by');
      const sig = el('div', 'font:400 36px/1.25 "Great Vibes","Segoe Script","Brush Script MT",cursive;' +
        'color:var(--text,#1d1d1b);overflow-wrap:anywhere', CREATOR);
      const note = el('div', 'margin:14px auto 0;font-size:11.5px;max-width:90ch', NOTE);
      f.append(brand, made, sig, note);
    } else {
      f.append(NOTE);
    }
    return f;
  }

  function ensure() {
    let f = document.getElementById('a2i-credit');
    const m = mode();
    if (!f || f.parentNode !== document.body || f.dataset.mode !== m || f.textContent !== TEXTS[m] ||
        f.getAttribute('style') !== STYLES[m] || f.hidden) {
      if (f) f.remove();
      f = make(m);
      document.body.appendChild(f);
    } else if (document.body.lastElementChild !== f && !document.body.lastElementChild.matches('dialog, .toast, #print-frame, #popover, #sel-toolbar, script')) {
      document.body.appendChild(f); // keep it at the bottom of the page
    }
    if (!document.querySelector('meta[name="author"]')) {
      const m = document.createElement('meta');
      m.name = 'author';
      m.content = CREATOR;
      document.head.appendChild(m);
    }
  }

  function start() {
    ensure();
    // Put the credit back whenever something removes or edits it.
    new MutationObserver(() => {
      const f = document.getElementById('a2i-credit');
      const m = mode();
      if (!f || f.dataset.mode !== m || f.textContent !== TEXTS[m] || f.getAttribute('style') !== STYLES[m] || f.hidden ||
          f.parentNode !== document.body) ensure();
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'hidden', 'class'] });
    setInterval(ensure, 3000);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
