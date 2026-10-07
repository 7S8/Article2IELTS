/* Article2IELTS — © 2026 Nuramatova Sakinat Ibnuabasovna. All rights reserved. */
/* Extra pages: sign up / log in, dashboard, flashcards. */
(function () {
  const A2I = (window.A2I = window.A2I || {});
  const esc = (s) => A2I.esc(s == null ? '' : s);

  const TYPE_LABEL = {
    true_false_not_given: 'True / False / Not Given',
    yes_no_not_given: 'Yes / No / Not Given',
    multiple_choice: 'Multiple choice',
    matching_headings: 'Matching headings',
    matching_information: 'Matching information',
    matching_features: 'Matching features',
    sentence_completion: 'Sentence completion',
    summary_completion: 'Summary completion',
    short_answer: 'Short answer',
  };

  const TIPS = {
    true_false_not_given: 'Underline the key idea of each statement, find the matching sentence, then ask: does it say the same, the opposite (FALSE), or nothing at all (NOT GIVEN)? Watch words like “all”, “only”, “always”.',
    yes_no_not_given: 'These test the writer’s opinion, not facts. Look for opinion language: “I believe”, “arguably”, “it is clear that”.',
    multiple_choice: 'Find the part of the text first, then rule out each wrong option — distractors often reuse words from the passage with a changed meaning.',
    matching_headings: 'Read the first and last sentence of each paragraph and choose the heading for the whole paragraph, not one detail. Cross out headings as you use them.',
    matching_information: 'Answers are not in order. Scan for synonyms of key words (names, numbers, examples) and note which paragraph mentions them.',
    matching_features: 'Circle every name in the passage first, then match each statement to what that person actually says.',
    sentence_completion: 'Predict the type of word (noun, number, adjective) before you look. Copy the words exactly and stay within the word limit — spelling counts.',
    summary_completion: 'The summary follows the order of the text. Find where it starts, then check that each answer fits the grammar of the gap.',
    short_answer: 'Use words from the text, keep within the limit, and answer the exact question asked (who / when / how many).',
  };

  /* ---------- sign up / log in ---------- */

  // "Continue with …" buttons for sign-in services (shown only when switched on in Supabase).
  const OAUTH = {
  "google": {
    "name": "Google",
    "icon": "<svg viewBox=\"0 0 48 48\" width=\"18\" height=\"18\" aria-hidden=\"true\"><path fill=\"#FFC107\" d=\"M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z\"/><path fill=\"#FF3D00\" d=\"m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z\"/><path fill=\"#4CAF50\" d=\"M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z\"/><path fill=\"#1976D2\" d=\"M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z\"/></svg>"
  },
  "apple": {
    "name": "Apple",
    "icon": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.71-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.63 1.11 8.8.73 1.06 1.6 2.25 2.75 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.33-3.56zM14.19 6.13c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.59-2.57 1.32-.56.65-1.06 1.69-.93 2.69.98.08 1.98-.5 2.59-1.23z\"/></svg>"
  },
  "azure": {
    "name": "Microsoft",
    "icon": "<svg viewBox=\"0 0 21 21\" width=\"18\" height=\"18\" aria-hidden=\"true\"><path fill=\"#f25022\" d=\"M1 1h9v9H1z\"/><path fill=\"#7fba00\" d=\"M11 1h9v9h-9z\"/><path fill=\"#00a4ef\" d=\"M1 11h9v9H1z\"/><path fill=\"#ffb900\" d=\"M11 11h9v9h-9z\"/></svg>"
  },
  "github": {
    "name": "GitHub",
    "icon": "<svg viewBox=\"0 0 16 16\" width=\"18\" height=\"18\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z\"/></svg>"
  },
  "facebook": {
    "name": "Facebook",
    "icon": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" aria-hidden=\"true\"><path fill=\"#1877F2\" d=\"M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z\"/></svg>"
  },
  "discord": {
    "name": "Discord",
    "icon": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" aria-hidden=\"true\"><path fill=\"#5865F2\" d=\"M20.32 4.37A19.8 19.8 0 0 0 15.38 2.8a13.6 13.6 0 0 0-.63 1.29 18.4 18.4 0 0 0-5.5 0 12.7 12.7 0 0 0-.64-1.29 19.7 19.7 0 0 0-4.94 1.53C.54 9.05-.32 13.62.1 18.12a19.9 19.9 0 0 0 6.06 3.06 14.7 14.7 0 0 0 1.3-2.1 12.9 12.9 0 0 1-2.04-.98c.17-.13.34-.26.5-.39a14.2 14.2 0 0 0 12.16 0c.16.13.33.27.5.39-.65.39-1.33.71-2.04.98.37.74.81 1.44 1.3 2.1a19.8 19.8 0 0 0 6.06-3.06c.5-5.22-.84-9.75-3.58-13.75zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42zm7.96 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.94 2.42-2.16 2.42z\"/></svg>"
  }
};



  A2I.renderAuth = function (app, startMode, onDone) {
    let mode = startMode || (A2I.auth.hasAccounts() ? 'login' : 'register');
    function draw(error, notice) {
      app.innerHTML = `
        <div class="auth-wrap">
          <div class="card auth-card">
            <h1>${mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p class="muted small">${mode === 'login'
              ? 'Log in to see your tests, dashboard, words and flashcards.'
              : 'An account keeps your tests, scores, words and flashcards together and unlocks your progress dashboard.'}</p>
            <div class="oauth" id="oauth" hidden></div>
            <form id="auth-form" novalidate>
              ${mode === 'register' ? `
                <label>Name <input type="text" name="name" autocomplete="name" required></label>` : ''}
              <label>Email <input type="email" name="email" autocomplete="email" required></label>
              <label>Password <input type="password" name="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" minlength="6" required></label>
              ${mode === 'register' ? `
                <div class="row" style="gap:12px">
                  <label style="flex:1">Current reading band
                    <select name="level"><option value="">Not sure</option>${['4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5'].map((b) => `<option>${b}</option>`).join('')}</select></label>
                  <label style="flex:1">Target band
                    <select name="target">${['5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9'].map((b) => `<option ${b === '7' ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
                </div>` : ''}
              ${error ? `<div class="error">${esc(error)}</div>` : ''}
              ${notice ? `<div class="notice">${esc(notice)}</div>` : ''}
              <button class="btn primary" style="width:100%;justify-content:center;margin-top:16px" type="submit">${mode === 'login' ? 'Log in' : 'Sign up'}</button>
            </form>
            <p class="small" style="text-align:center;margin-bottom:0">
              ${mode === 'login' ? 'New here? <a href="#" id="switch">Create an account</a>' : 'Already have an account? <a href="#" id="switch">Log in</a>'}
            </p>
            ${A2I.auth.cloud
              ? (mode === 'login' ? '<p class="small" style="text-align:center;margin:6px 0 0"><a href="#" id="forgot">Forgot your password?</a></p>' : '') +
                '<p class="muted small" style="margin-bottom:0">Your account and progress are saved online, so you can log in from any device.</p>'
              : '<p class="muted small" style="margin-bottom:0">Accounts are saved in this browser on this device. Use “Save backup” on the My tests page to move your data to another device.</p>'}
            ${A2I.cloud && A2I.cloud.startError ? `<div class="error">${esc(A2I.cloud.startError)}</div>` : ''}
          </div>
        </div>`;
      // Sign-in services.
      if (A2I.auth.providers) {
        A2I.auth.providers().then((list) => {
          const box = app.querySelector('#oauth');
          const shown = Object.keys(OAUTH).filter((k) => list.includes(k));
          if (!box || !shown.length) return;
          box.hidden = false;
          box.innerHTML = shown.map((k) => `<button type="button" class="btn oauth-btn" data-provider="${k}">${OAUTH[k].icon}<span>Continue with ${OAUTH[k].name}</span></button>`).join('') +
            '<div class="or"><span>or with email</span></div>';
          box.querySelectorAll('[data-provider]').forEach((b) => b.addEventListener('click', async () => {
            b.disabled = true;
            try {
              await A2I.auth.signInWith(b.dataset.provider);
            } catch (err) {
              b.disabled = false;
              draw(err.message);
            }
          }));
        });
      }
      const forgot = app.querySelector('#forgot');
      if (forgot) forgot.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = (app.querySelector('input[name=email]').value || '').trim() || prompt('Your email address:');
        if (!email) return;
        try {
          await A2I.auth.resetPassword(email);
          draw('', 'If an account exists for ' + email + ', we have sent it a link to choose a new password. Check the Spam folder too. No account yet? Use “Create an account”.');
        } catch (err) {
          draw(err.message);
        }
      });
      const sw = app.querySelector('#switch');
      if (sw) sw.addEventListener('click', (e) => {
        e.preventDefault();
        mode = mode === 'login' ? 'register' : 'login';
        history.replaceState(null, '', mode === 'login' ? '#/login' : '#/signup');
        draw();
      });
      app.querySelector('#auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
          if (mode === 'login') await A2I.auth.login(f.get('email'), f.get('password'));
          else await A2I.auth.register({ name: f.get('name'), email: f.get('email'), password: f.get('password'), level: f.get('level'), target: f.get('target') });
          onDone();
        } catch (err) {
          if (err.notice) { mode = 'login'; draw('', err.message); } else draw(err.message);
          const em = app.querySelector('input[name=email]');
          if (em) em.value = f.get('email') || '';
          const nm = app.querySelector('input[name=name]');
          if (nm) nm.value = f.get('name') || '';
        }
      });
      const first = app.querySelector('input');
      if (first) first.focus();
    }
    draw();
  };

  /* ---------- dashboard ---------- */

  function bandChart(attempts, target) {
    const pts = attempts.slice(-20).map((a) => ({ band: Number(a.band), at: a.at, title: a.title, score: a.correct + '/' + a.total }));
    if (pts.length < 2) return '<p class="muted small">Finish two or more tests to see your band over time.</p>';
    const W = 640;
    const H = 220;
    const L = 34;
    const R = 12;
    const T = 14;
    const B = 28;
    const min = Math.max(0, Math.min(...pts.map((p) => p.band), Number(target) || 9) - 0.5);
    const max = 9;
    const x = (i) => L + (i * (W - L - R)) / (pts.length - 1);
    const y = (b) => T + ((max - b) * (H - T - B)) / (max - min);
    const grid = [];
    for (let b = Math.ceil(min); b <= max; b++) {
      grid.push(`<line x1="${L}" x2="${W - R}" y1="${y(b)}" y2="${y(b)}" class="grid"/><text x="${L - 8}" y="${y(b) + 4}" class="tick" text-anchor="end">${b}</text>`);
    }
    const tgt = Number(target) ? `<line x1="${L}" x2="${W - R}" y1="${y(Number(target))}" y2="${y(Number(target))}" class="target"/><text x="${W - R}" y="${y(Number(target)) - 5}" class="tick" text-anchor="end">target ${esc(target)}</text>` : '';
    const path = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.band).toFixed(1)).join(' ');
    const dots = pts.map((p, i) => `<g class="pt"><circle cx="${x(i)}" cy="${y(p.band)}" r="14" class="hit"/><circle cx="${x(i)}" cy="${y(p.band)}" r="4.5" class="dot"/>
      <title>${esc(new Date(p.at).toLocaleDateString())} — ${esc(p.title)}: ${p.score}, band ≈ ${p.band.toFixed(1)}</title></g>`).join('');
    const last = pts[pts.length - 1];
    const label = `<text x="${x(pts.length - 1) - 8}" y="${y(last.band) - 10}" class="val" text-anchor="end">${last.band.toFixed(1)}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Estimated band for your last ${pts.length} tests">${grid.join('')}${tgt}<path d="${path}" class="line"/>${dots}${label}
      <text x="${L}" y="${H - 8}" class="tick">${esc(new Date(pts[0].at).toLocaleDateString())}</text><text x="${W - R}" y="${H - 8}" class="tick" text-anchor="end">${esc(new Date(last.at).toLocaleDateString())}</text></svg>`;
  }

  A2I.renderDashboard = function (app) {
    const user = A2I.auth.user();
    const attempts = A2I.store.getAttempts();
    const words = A2I.store.getWords();
    const now = Date.now();
    const due = words.filter((w) => !w.due || w.due <= now).length;
    const mastered = words.filter((w) => (w.box || 0) >= 5).length;

    const recent = attempts.slice(-5);
    const avg = (list) => list.reduce((s, a) => s + Number(a.band), 0) / list.length;
    const level = recent.length ? avg(recent) : null;
    const prev = attempts.slice(-10, -5);
    const trend = level != null && prev.length ? level - avg(prev) : null;
    const best = attempts.length ? Math.max(...attempts.map((a) => Number(a.band))) : null;
    const totalQ = attempts.reduce((s, a) => s + a.total, 0);
    const totalC = attempts.reduce((s, a) => s + a.correct, 0);

    // Accuracy by question type over all attempts.
    const byType = {};
    attempts.forEach((a) => Object.entries(a.byType || {}).forEach(([t, [c, n]]) => {
      const o = byType[t] || (byType[t] = { c: 0, n: 0 });
      o.c += c;
      o.n += n;
    }));
    const types = Object.entries(byType).map(([t, o]) => ({ t, c: o.c, n: o.n, pct: o.n ? o.c / o.n : 0 })).sort((a, b) => b.pct - a.pct);
    const enough = types.filter((x) => x.n >= 3);
    const strengths = enough.filter((x) => x.pct >= 0.75);
    const weak = enough.filter((x) => x.pct < 0.6).sort((a, b) => a.pct - b.pct);
    const overTime = attempts.filter((a) => a.overTime).length;

    const advice = [];
    weak.slice(0, 3).forEach((x) => advice.push(`<b>${esc(TYPE_LABEL[x.t] || x.t)}</b> (${Math.round(x.pct * 100)}%): ${esc(TIPS[x.t] || '')}`));
    if (overTime && overTime >= Math.ceil(attempts.length / 3)) advice.push('<b>Timing</b>: you went over 20 minutes in ' + overTime + ' of ' + attempts.length + ' tests. Skim the passage in 2–3 minutes, then go to the questions; skip a hard question and come back.');
    if (user && user.target && level != null && level < Number(user.target)) advice.push(`<b>Goal</b>: you are about ${(Number(user.target) - level).toFixed(1)} band below your target of ${esc(user.target)}. Aim for 3–4 passages a week and review every wrong answer with “Show in passage”.`);
    if (due) advice.push(`<b>Vocabulary</b>: ${due} flashcard${due === 1 ? ' is' : 's are'} due for review today. <a href="#/cards">Review now</a>.`);
    if (!advice.length && attempts.length) advice.push('Great work — keep a steady routine and try the Band 7.5–9 difficulty for harder distractors.');

    const bars = types.length ? `<div class="bars">${types.map((x) => {
      const status = x.n < 3 ? '<span class="muted">few questions</span>' : x.pct >= 0.75 ? '<span class="good">▲ strength</span>' : x.pct < 0.6 ? '<span class="bad">▼ needs work</span>' : '<span class="muted">● OK</span>';
      return `<div class="bar-row" title="${esc(TYPE_LABEL[x.t] || x.t)}: ${x.c} of ${x.n} correct">
        <div class="bar-label">${esc(TYPE_LABEL[x.t] || x.t)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, x.pct * 100)}%"></div></div>
        <div class="bar-val">${Math.round(x.pct * 100)}% <span class="muted">(${x.c}/${x.n})</span></div>
        <div class="bar-status small">${status}</div>
      </div>`;
    }).join('')}</div>` : '<p class="muted small">Finish a test to see which question types are easy or hard for you.</p>';

    app.innerHTML = `
      <div class="dash">
        <div class="lib-head">
          <div>
            <h1 style="margin:0">Hi, ${esc(user ? user.name : '')}</h1>
            <p class="muted" style="margin:4px 0 0">Your IELTS Reading progress${user && user.target ? ' · target band ' + esc(user.target) : ''}</p>
          </div>
          <div class="row"><a class="btn" href="#/cards">Flashcards${due ? ` <span class="badge score">${due} due</span>` : ''}</a><a class="btn primary" href="#/new">+ New test</a></div>
        </div>

        <div class="tiles">
          <div class="tile"><div class="muted small">Current level</div><div class="big">${level != null ? level.toFixed(1) : '—'}</div>
            <div class="small muted">${level != null ? 'average of your last ' + recent.length + ' test' + (recent.length > 1 ? 's' : '') + (trend != null ? ` · <span class="${trend >= 0 ? 'good' : 'bad'}">${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend).toFixed(1)}</span> vs before` : '') : 'finish a test to see it'}</div></div>
          <div class="tile"><div class="muted small">Best band</div><div class="big">${best != null ? best.toFixed(1) : '—'}</div><div class="small muted">${attempts.length} test${attempts.length === 1 ? '' : 's'} finished</div></div>
          <div class="tile"><div class="muted small">Accuracy</div><div class="big">${totalQ ? Math.round((totalC / totalQ) * 100) + '%' : '—'}</div><div class="small muted">${totalC} of ${totalQ} questions</div></div>
          <div class="tile"><div class="muted small">Words</div><div class="big">${words.length}</div><div class="small muted">${mastered} mastered · ${due} due today</div></div>
        </div>

        <div class="dash-grid">
          <div class="card"><h2>Band over time</h2>${bandChart(attempts, user && user.target)}</div>
          <div class="card"><h2>What to improve</h2>${advice.length ? '<ul class="advice">' + advice.map((a) => '<li>' + a + '</li>').join('') + '</ul>' : '<p class="muted small">Finish a test to get personal advice.</p>'}</div>
        </div>

        <div class="card" style="margin-top:16px"><h2>Question types</h2>
          ${strengths.length ? `<p class="small"><span class="good">▲ Strengths:</span> ${strengths.map((x) => esc(TYPE_LABEL[x.t] || x.t)).join(', ')}</p>` : ''}
          ${weak.length ? `<p class="small"><span class="bad">▼ Weak spots:</span> ${weak.map((x) => esc(TYPE_LABEL[x.t] || x.t)).join(', ')}</p>` : ''}
          ${bars}
        </div>

        <div class="card" style="margin-top:16px"><h2>Recent tests</h2>
          ${attempts.length ? `<table class="table"><tr><th>Date</th><th>Test</th><th>Score</th><th>Band</th><th>Time</th></tr>
            ${attempts.slice(-10).reverse().map((a) => `<tr><td>${esc(new Date(a.at).toLocaleDateString())}</td><td><a href="#/test/${encodeURIComponent(a.testId)}">${esc(a.title)}</a></td><td>${a.correct}/${a.total}</td><td>${Number(a.band).toFixed(1)}</td><td>${a.seconds ? (a.seconds < 60 ? '<1 min' : Math.round(a.seconds / 60) + ' min') : '—'}${a.overTime ? ' <span class="bad">over</span>' : ''}</td></tr>`).join('')}</table>`
            : '<p class="muted small">No finished tests yet. <a href="#/new">Make your first test</a> or try the sample on <a href="#/">My tests</a>.</p>'}
        </div>
      </div>`;
  };

  /* ---------- flashcards (Leitner boxes: 1 day, 2, 4, 8, 16) ---------- */

  const DAY = 86400000;
  const INTERVALS = [0, 1, 2, 4, 8, 16];

  A2I.renderCards = function (app) {
    let mode = 'word'; // show word first, or 'meaning' first
    let scope = 'due';
    let queue = [];
    let idx = 0;
    let flipped = false;
    let stats = { again: 0, good: 0, easy: 0 };

    function build() {
      const now = Date.now();
      const words = A2I.store.getWords().filter((w) => w.definition);
      queue = (scope === 'due' ? words.filter((w) => !w.due || w.due <= now) : words.slice())
        .sort((a, b) => (a.box || 0) - (b.box || 0) || (a.due || 0) - (b.due || 0));
      idx = 0;
      flipped = false;
      stats = { again: 0, good: 0, easy: 0 };
    }

    function blank(context, word) {
      if (!context) return '';
      const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*', 'ig');
      return context.replace(re, '_____');
    }

    function draw() {
      const all = A2I.store.getWords().filter((w) => w.definition);
      const head = `
        <div class="lib-head">
          <div><h1 style="margin:0">Flashcards</h1>
          <p class="muted" style="margin:4px 0 0">${all.length} words · cards you know come back less often</p></div>
          <div class="row">
            <select id="fc-scope" style="width:auto"><option value="due" ${scope === 'due' ? 'selected' : ''}>Due today</option><option value="all" ${scope === 'all' ? 'selected' : ''}>All words</option></select>
            <select id="fc-mode" style="width:auto"><option value="word" ${mode === 'word' ? 'selected' : ''}>Word → meaning</option><option value="meaning" ${mode === 'meaning' ? 'selected' : ''}>Meaning → word</option></select>
          </div>
        </div>`;
      let body;
      if (!all.length) {
        body = '<div class="card empty"><p>No words yet.</p><p class="muted small">Open a test, then use “+ My words” on any word, or “Add all to flashcards” in the Dictionary tab.</p><a class="btn" href="#/">My tests</a></div>';
      } else if (idx >= queue.length) {
        const nextDue = all.filter((w) => w.due && w.due > Date.now()).sort((a, b) => a.due - b.due)[0];
        body = `<div class="card empty"><h2 style="margin-top:0">${queue.length ? 'Session done!' : 'Nothing due right now 🎉'}</h2>
          ${queue.length ? `<p>Again: ${stats.again} · Good: ${stats.good} · Easy: ${stats.easy}</p>` : ''}
          <p class="muted small">${nextDue ? 'Next card is due ' + new Date(nextDue.due).toLocaleDateString() + '.' : ''}</p>
          <button class="btn" id="fc-all">Practise all words anyway</button></div>`;
      } else {
        const w = queue[idx];
        const front = mode === 'word'
          ? `<div class="fc-word">${esc(w.word)}</div>${w.partOfSpeech ? `<div class="muted">${esc(w.partOfSpeech)}</div>` : ''}${w.context ? `<div class="fc-context">“${esc(w.context)}”</div>` : ''}`
          : `<div class="fc-def">${esc(w.definition)}</div>${w.context ? `<div class="fc-context">“${esc(blank(w.context, w.word))}”</div>` : ''}`;
        const back = `<div class="fc-word">${esc(w.word)}</div>${w.partOfSpeech ? `<div class="muted">${esc(w.partOfSpeech)}</div>` : ''}
          <div class="fc-def">${esc(w.definition)}</div>
          ${w.translation ? `<div class="tr"><span class="tr-lang">${esc(A2I.languageName(w.trLang))}:</span> ${esc(w.translation)}</div>` : ''}
          ${w.example ? `<div class="fc-context">“${esc(w.example)}”</div>` : ''}
          ${w.synonyms && w.synonyms.length ? `<div class="small"><span class="muted">Synonyms:</span> ${w.synonyms.map(esc).join(', ')}</div>` : ''}`;
        body = `
          <div class="fc-progress"><div style="width:${(idx / queue.length) * 100}%"></div></div>
          <div class="muted small" style="text-align:center;margin-bottom:8px">Card ${idx + 1} of ${queue.length} · box ${w.box || 0}/5</div>
          <div class="fc-card ${flipped ? 'flipped' : ''}" id="fc-card" tabindex="0" role="button" aria-label="Flip card">
            ${flipped ? back : front + '<div class="muted small fc-hint">Click or press Space to show the answer</div>'}
          </div>
          <div class="fc-actions">
            <button class="btn" id="fc-say">🔊</button>
            ${flipped ? `
              <button class="btn fc-again" data-grade="again">Again <span class="kbd">1</span></button>
              <button class="btn fc-good" data-grade="good">Good <span class="kbd">2</span></button>
              <button class="btn fc-easy" data-grade="easy">Easy <span class="kbd">3</span></button>`
              : '<button class="btn primary" id="fc-flip">Show answer</button>'}
          </div>`;
      }
      app.innerHTML = `<div class="words-wrap">${head}<div style="margin-top:16px">${body}</div></div>`;
      app.querySelector('#fc-scope').addEventListener('change', (e) => { scope = e.target.value; build(); draw(); });
      app.querySelector('#fc-mode').addEventListener('change', (e) => { mode = e.target.value; flipped = false; draw(); });
      const allBtn = app.querySelector('#fc-all');
      if (allBtn) allBtn.addEventListener('click', () => { scope = 'all'; build(); draw(); });
      const card = app.querySelector('#fc-card');
      if (card) card.addEventListener('click', () => { flipped = !flipped; draw(); });
      const flip = app.querySelector('#fc-flip');
      if (flip) flip.addEventListener('click', () => { flipped = true; draw(); });
      const say = app.querySelector('#fc-say');
      if (say) say.addEventListener('click', () => A2I.speak(queue[idx].word));
      app.querySelectorAll('[data-grade]').forEach((b) => b.addEventListener('click', () => grade(b.dataset.grade)));
    }

    function grade(g) {
      const w = queue[idx];
      let box = w.box || 0;
      if (g === 'again') box = 1;
      else if (g === 'good') box = Math.min(5, box + 1);
      else box = Math.min(5, box + 2);
      const due = g === 'again' ? Date.now() + 60 * 1000 : Date.now() + INTERVALS[box] * DAY;
      A2I.store.updateWord(w.word, { box, due, reviewed: Date.now() });
      stats[g]++;
      if (g === 'again') queue.push(Object.assign({}, w, { box, due })); // see it again this session
      idx++;
      flipped = false;
      draw();
    }

    function onKey(e) {
      if (!document.getElementById('fc-card') || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipped = !flipped; draw(); }
      else if (flipped && ['1', '2', '3'].includes(e.key)) grade(['again', 'good', 'easy'][Number(e.key) - 1]);
    }
    document.addEventListener('keydown', onKey);
    build();
    draw();
    return () => document.removeEventListener('keydown', onKey);
  };

  A2I.TYPE_LABEL = TYPE_LABEL;
})();
