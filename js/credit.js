/* Author credit. Article2IELTS was created by Nuramatova Sakinat Ibnuabasovna.
   Copyright (c) 2026 Nuramatova Sakinat Ibnuabasovna. All rights reserved — see LICENSE.
   The credit is shown on every page; if it is removed or changed in the page,
   it is put back straight away. */
(function () {
  const A2I = (window.A2I = window.A2I || {});
  const CREATOR = 'Nuramatova Sakinat Ibnuabasovna';
  const YEAR = Math.max(2026, new Date().getFullYear());
  const NOTE = '© ' + YEAR + ' Article2IELTS · All rights reserved · Not affiliated with IELTS, the British Council, IDP or Cambridge';
  const TEXT = 'Article2IELTS' + 'Made with ♥ by' + CREATOR + NOTE; // the footer's full text, used to check it is intact

  A2I.CREATOR = CREATOR;
  A2I.CREDIT = 'Created by ' + CREATOR + ' · © ' + YEAR + ' Article2IELTS. All rights reserved.';
  Object.freeze && Object.defineProperty(A2I, 'CREATOR', { value: CREATOR, writable: false, configurable: false });

  const STYLE = 'display:flex!important;visibility:visible!important;opacity:1!important;position:static!important;' +
    'flex-wrap:wrap;justify-content:center;align-items:center;gap:4px 22px;text-align:center;' +
    'font:12px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--muted,#6b6a66);' +
    'padding:10px 16px 12px;margin:24px 16px 0;border:0;border-top:1px solid var(--border,#dcd9d0);clip:auto!important;' +
    'height:auto!important;transform:none!important;filter:none!important;';

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

  function make() {
    const f = document.createElement('footer');
    f.id = 'a2i-credit';
    f.setAttribute('role', 'contentinfo');
    f.setAttribute('style', STYLE);
    const brand = el('span', 'font:700 15px Georgia,"Times New Roman",serif;color:var(--text,#1d1d1b)',
      'Article', el('span', 'color:var(--accent,#b3261e)', '2'), 'IELTS');
    const sig = el('span', 'font:400 26px/1 "Great Vibes","Segoe Script","Brush Script MT",cursive;color:var(--text,#1d1d1b);' +
      'letter-spacing:0;text-transform:none;margin-left:6px', CREATOR);
    const made = el('span', 'display:inline-flex;align-items:center;flex-wrap:wrap;justify-content:center;' +
      'font-size:10.5px;letter-spacing:.14em;text-transform:uppercase',
      'Made with ', el('span', 'color:var(--accent,#b3261e);margin:0 .4em', '♥'), ' by', sig);
    const note = el('span', 'font-size:11px', NOTE);
    f.append(brand, made, note);
    return f;
  }

  function ensure() {
    let f = document.getElementById('a2i-credit');
    if (!f || f.parentNode !== document.body || f.textContent !== TEXT || f.getAttribute('style') !== STYLE || f.hidden) {
      if (f) f.remove();
      f = make();
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
    loadFont();
    ensure();
    // Put the credit back whenever something removes or edits it.
    new MutationObserver(() => {
      const f = document.getElementById('a2i-credit');
      if (!f || f.textContent !== TEXT || f.getAttribute('style') !== STYLE || f.hidden || f.parentNode !== document.body) ensure();
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'hidden', 'class'] });
    setInterval(ensure, 3000);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
