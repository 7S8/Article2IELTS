/* Author credit. Article2IELTS was created by Nuramatova Sakinat Ibnuabasovna.
   Copyright (c) 2026 Nuramatova Sakinat Ibnuabasovna. All rights reserved — see LICENSE.
   The credit is shown on every page; if it is removed or changed in the page,
   it is put back straight away. */
(function () {
  const A2I = (window.A2I = window.A2I || {});
  const CREATOR = 'Nuramatova Sakinat Ibnuabasovna';
  const YEAR = Math.max(2026, new Date().getFullYear());
  const TEXT = 'Created by ' + CREATOR + ' · © ' + YEAR + ' Article2IELTS. All rights reserved.';

  A2I.CREATOR = CREATOR;
  A2I.CREDIT = TEXT;
  Object.freeze && Object.defineProperty(A2I, 'CREATOR', { value: CREATOR, writable: false, configurable: false });

  const STYLE = 'display:block!important;visibility:visible!important;opacity:1!important;position:static!important;' +
    'text-align:center;font:12px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.01em;' +
    'color:var(--muted,#6b6a66);padding:6px 16px 32px;margin:24px 0 0;border:0;clip:auto!important;height:auto!important;' +
    'transform:none!important;filter:none!important;font-size:12px!important;';

  function make() {
    const f = document.createElement('footer');
    f.id = 'a2i-credit';
    f.setAttribute('role', 'contentinfo');
    f.setAttribute('style', STYLE);
    // Same text as TEXT, with the creator's name in bold.
    const name = document.createElement('b');
    name.style.cssText = 'font-weight:600;color:var(--text,#1d1d1b)';
    name.textContent = CREATOR;
    f.append('Created by ', name, ' · © ' + YEAR + ' Article2IELTS. All rights reserved.');
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
