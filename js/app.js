/* Article2IELTS — views and interaction. */
(function () {
  const A2I = window.A2I;
  const { store, esc } = A2I;
  const app = document.getElementById('app');
  const toolbar = document.getElementById('sel-toolbar');
  const popover = document.getElementById('popover');

  /* ---------- small helpers ---------- */

  let toastTimer;
  A2I.toast = function (msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  };

  function speak(word) {
    try {
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-GB';
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* speech not available */ }
  }

  function download(filename, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'test';
  }

  function normAnswer(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[‘’`]/g, "'")
      .replace(/[“”"]/g, '')
      .replace(/^[\s.,;:!?()]+|[\s.,;:!?()]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isCorrect(q, given) {
    const g = normAnswer(given);
    if (!g) return false;
    const ok = [q.answer].concat(q.acceptedAnswers || []).map(normAnswer);
    if (ok.includes(g)) return true;
    // Allow a leading article the candidate added or dropped ("the canopy" vs "canopy").
    const strip = (x) => x.replace(/^(the|a|an) /, '');
    return ok.map(strip).includes(strip(g));
  }

  /* Approximate IELTS Academic Reading band from a score scaled to 40. */
  function bandFor(correct, total) {
    const s = Math.round((correct / total) * 40);
    const table = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]];
    for (const [min, band] of table) if (s >= min) return band;
    return 2;
  }

  /* ---------- routing ---------- */

  let cleanup = null;

  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    hideFloating();
    const hash = location.hash.replace(/^#\/?/, '');
    const [view, id] = hash.split('/');
    document.querySelectorAll('[data-nav]').forEach((a) => {
      a.classList.toggle('active', a.dataset.nav === (view || 'library'));
    });
    window.scrollTo(0, 0);
    if (view === 'new') return renderNew();
    if (view === 'words') return renderWords();
    if (view === 'test' && id) return renderTest(decodeURIComponent(id));
    return renderLibrary();
  }

  /* ---------- library ---------- */

  function renderLibrary() {
    const tests = store.listTests();
    app.innerHTML = `
      <div class="lib-head">
        <div>
          <h1 style="margin:0">Your reading tests</h1>
          <p class="muted" style="margin:4px 0 0">Paste an article from The Atlantic, The Guardian, The Economist… and practise it as a real IELTS Academic Reading passage.</p>
        </div>
        <div class="row">
          <button class="btn" id="backup">Save backup</button>
          <label class="btn" style="margin:0;font-weight:400">Open backup / test file<input type="file" accept=".json,application/json" id="import-file" hidden></label>
          <a class="btn primary" href="#/new">+ New test from article</a>
        </div>
      </div>
      ${tests.length ? '' : '<div class="card empty"><p>No tests yet.</p><a class="btn primary" href="#/new">Create your first test</a></div>'}
      <div class="lib-grid">
        ${tests.map((t) => {
          const p = store.getProgress(t.id);
          const n = A2I.questionCount(t);
          const words = t.paragraphs.reduce((s, x) => s + A2I.wordCount(x), 0);
          return `<div class="card lib-card">
            <h3>${esc(t.title)}</h3>
            <div class="meta">${t.source ? esc(t.source) + ' · ' : ''}${words} words · ${n} questions</div>
            <div style="margin-bottom:10px">
              ${t.bundled ? '<span class="badge">sample</span>' : ''}
              ${t.madeBy === 'basic' ? '<span class="badge">basic questions</span>' : ''}
              ${p.lastScore ? `<span class="badge score">last: ${p.lastScore.correct}/${p.lastScore.total} · band ≈ ${p.lastScore.band}</span>` : ''}
            </div>
            <div class="row">
              <a class="btn primary small" href="#/test/${encodeURIComponent(t.id)}">${p.submitted ? 'Review' : Object.keys(p.answers).length ? 'Continue' : 'Start'}</a>
              <button class="btn small" data-export="${esc(t.id)}">Export</button>
              ${t.bundled ? '' : `<button class="btn small ghost" data-delete="${esc(t.id)}">Delete</button>`}
            </div>
          </div>`;
        }).join('')}
      </div>`;

    app.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => {
      const t = store.getTest(b.dataset.export);
      const copy = Object.assign({}, t);
      delete copy.bundled;
      download(slug(t.title) + '.json', JSON.stringify(copy, null, 2));
    }));
    app.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => {
      if (confirm('Delete this test and your answers for it?')) {
        store.deleteTest(b.dataset.delete);
        renderLibrary();
      }
    }));
    app.querySelector('#import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data && data.app === 'Article2IELTS') {
          const r = store.importAll(data);
          A2I.toast(`Backup opened: ${r.newTests} new test${r.newTests === 1 ? '' : 's'}, ${r.newWords} new word${r.newWords === 1 ? '' : 's'}`);
        } else {
          const test = A2I.normalizeTest(data);
          if (store.getTest(test.id)) test.id = A2I.uid();
          store.saveTest(test);
          A2I.toast('Imported “' + test.title + '”');
        }
        renderLibrary();
      } catch (err) {
        alert('Could not open that file: ' + err.message);
      }
    });
    app.querySelector('#backup').addEventListener('click', () => {
      const day = new Date().toISOString().slice(0, 10);
      download('article2ielts-backup-' + day + '.json', JSON.stringify(store.exportAll()));
      A2I.toast('Backup saved — keep the file safe. Open it here (or on another device) to restore.');
    });
  }

  /* ---------- new test ---------- */

  let generating = null; // AbortController while a request runs
  let newMethod = null; // remembered choice on the New test page

  function renderNew() {
    const settings = store.getSettings();
    const provider = A2I.PROVIDERS[settings.provider];
    const hasKey = !!settings.keys[settings.provider];
    if (!newMethod) newMethod = hasKey ? 'ai' : 'basic';
    app.innerHTML = `
      <div class="new-grid">
        <div class="card">
          <h2>1. Add the article</h2>
          <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Upload an article file">
            <input type="file" id="article-file" hidden multiple
              accept=".pdf,.docx,.txt,.md,.html,.htm,.rtf,image/*,application/pdf,text/plain,text/html">
            <div class="dz-icon" aria-hidden="true">📄</div>
            <div><b>Upload a file</b> or drag it here — or press <kbd>Ctrl</kbd>+<kbd>V</kbd> to paste a screenshot</div>
            <div class="muted small">PDF · Word (.docx) · saved web page (.html) · text (.txt) · photos and screenshots (paste several pages one after another)</div>
          </div>
          <div class="progress" id="file-progress" hidden><span></span><div class="bar"><i></i></div></div>
          <div class="error" id="file-error" hidden></div>
          <div class="or"><span>or paste the text</span></div>
          <label>Headline <input type="text" id="article-title" placeholder="e.g. The Case for Boredom"></label>
          <label>Source (optional) <input type="text" id="article-source" placeholder="e.g. The Atlantic, March 2026"></label>
          <label>Article text
            <textarea id="article-text" placeholder="Paste the full article text here, or upload a file above. Keep the blank lines between paragraphs."></textarea>
          </label>
          <div class="muted small" id="article-stats">0 words</div>
        </div>
        <div class="card">
          <h2>2. Choose the questions</h2>
          <label>Number of questions
            <select id="q-count">
              ${[6, 8, 10, 13, 14, 16, 20].map((n) => `<option ${n === 13 ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </label>
          <span class="muted small">A real IELTS passage has 13–14 questions.</span>
          <label>Question types</label>
          <div class="chips" id="q-types">
            ${A2I.QUESTION_TYPES.map((t) => `<label class="chip" data-type="${t.id}"><input type="checkbox" value="${t.id}" ${t.on ? 'checked' : ''}>${esc(t.label)}</label>`).join('')}
          </div>
          <label id="diff-label">Difficulty
            <select id="q-diff">
              <option value="band 5.5–6 (moderate)">Band 5.5–6</option>
              <option value="band 6.5–7 (standard IELTS)" selected>Band 6.5–7</option>
              <option value="band 7.5–9 (hard, subtle paraphrase and distractors)">Band 7.5–9</option>
            </select>
          </label>

          <h2 style="margin-top:20px">3. Make the test</h2>
          <div class="methods" role="radiogroup">
            <label class="method"><input type="radio" name="method" value="ai" ${newMethod === 'ai' ? 'checked' : ''}>
              <span><b>AI questions</b> <span class="badge">${esc(provider.label.split(' —')[0])}</span><br>
              <span class="muted small">Real IELTS-quality questions. Needs an API key — Gemini, Groq and OpenRouter keys are free.
              ${hasKey ? '' : '<a href="#" data-open-settings>Add a key</a>'}</span></span></label>
            <label class="method"><input type="radio" name="method" value="basic" ${newMethod === 'basic' ? 'checked' : ''}>
              <span><b>Basic questions — free, no key</b><br>
              <span class="muted small">Made instantly in your browser without AI: True/False, gap fills, word bank, matching paragraphs, vocabulary. Simpler than the real test.</span></span></label>
            <label class="method"><input type="radio" name="method" value="chat" ${newMethod === 'chat' ? 'checked' : ''}>
              <span><b>Claude chat — free, no key</b><br>
              <span class="muted small">Copy a prompt into claude.ai (a free account works) and paste the answer back. Same quality as AI questions.</span></span></label>
          </div>

          <div id="m-run">
            <button class="btn primary" id="gen-btn">Make test</button>
            <button class="btn ghost" id="cancel-btn" hidden>Cancel</button>
          </div>
          <div id="m-chat" hidden>
            <ol class="small">
              <li>Click <b>Copy prompt</b> and paste it into a chat at <a href="https://claude.ai/new" target="_blank" rel="noopener">claude.ai</a>.</li>
              <li>Copy Claude’s whole reply and paste it below.</li>
            </ol>
            <button class="btn small" id="copy-prompt">Copy prompt</button>
            <label>Paste Claude’s reply
              <textarea id="paste-json" rows="5" placeholder='{"title": "...", "vocabulary": [...], "questionGroups": [...]}'></textarea>
            </label>
            <button class="btn primary small" id="import-json">Create test from reply</button>
          </div>
          <div class="progress" id="gen-progress" hidden><span></span><div class="bar"><i></i></div></div>
          <div class="error" id="gen-error" hidden></div>
        </div>
      </div>`;

    const $ = (s) => app.querySelector(s);
    const textEl = $('#article-text');
    const updateStats = () => {
      const paras = A2I.splitParagraphs(textEl.value);
      const words = A2I.wordCount(textEl.value);
      $('#article-stats').textContent = `${words.toLocaleString()} words · ${paras.length} paragraphs (A–${A2I.letter(Math.max(paras.length - 1, 0))})` +
        (words > 2500 ? ' · long article — consider using only part of it (IELTS passages are ~700–950 words)' : '');
    };
    textEl.addEventListener('input', updateStats);

    /* ----- file upload ----- */
    const fileInput = $('#article-file');
    const dz = $('#dropzone');
    // Files are read one after another. Screenshots are added to the end of
    // the text so several pages can be pasted in a row; other files replace it.
    let queue = Promise.resolve();
    function loadFiles(files) {
      Array.from(files).forEach((f) => { queue = queue.then(() => loadFile(f)); });
    }
    async function loadFile(file) {
      const prog = document.getElementById('file-progress');
      const err = document.getElementById('file-error');
      if (!prog) return;
      err.hidden = true;
      prog.hidden = false;
      try {
        const out = await A2I.readArticleFile(file, (m) => { prog.querySelector('span').textContent = m; });
        // Look the fields up again: the page may have been redrawn while the file was read.
        const t = document.getElementById('article-text');
        if (!t) return;
        const titleEl = document.getElementById('article-title');
        const append = A2I.isImageFile(file) && t.value.trim();
        t.value = append ? t.value.trim() + '\n\n' + out.text : out.text;
        if (out.title && !(append && titleEl.value)) titleEl.value = out.title;
        if (out.source && !document.getElementById('article-source').value) document.getElementById('article-source').value = out.source;
        t.dispatchEvent(new Event('input'));
        A2I.toast(append ? 'Added the screenshot’s text to the end — paste the next page, or check the text' : 'Loaded “' + (out.title || file.name) + '” — check the text, then make the test');
      } catch (e) {
        err.textContent = e.message || String(e);
        err.hidden = false;
      } finally {
        prog.hidden = true;
      }
    }
    dz.addEventListener('click', () => fileInput.click());
    dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    fileInput.addEventListener('change', () => { loadFiles(fileInput.files); fileInput.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', (e) => loadFiles(e.dataTransfer.files));

    // Ctrl+V / Cmd+V anywhere on this page: a copied screenshot is read with OCR.
    function onPaste(e) {
      const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
      const images = items.filter((it) => it.kind === 'file' && it.type.startsWith('image/')).map((it) => it.getAsFile()).filter(Boolean);
      if (images.length) {
        e.preventDefault();
        loadFiles(images.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], 'screenshot-' + (i + 1) + '.png', { type: f.type }))));
        return;
      }
      // Pasted text outside the boxes goes into the article box.
      const target = e.target;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const text = e.clipboardData && e.clipboardData.getData('text/plain');
      if (text) {
        e.preventDefault();
        textEl.value = textEl.value.trim() ? textEl.value.trim() + '\n\n' + text : text;
        textEl.dispatchEvent(new Event('input'));
      }
    }
    document.addEventListener('paste', onPaste);

    /* ----- method choice ----- */
    function syncMethod() {
      newMethod = app.querySelector('input[name=method]:checked').value;
      $('#m-run').hidden = newMethod === 'chat';
      $('#m-chat').hidden = newMethod !== 'chat';
      $('#gen-btn').textContent = newMethod === 'basic' ? 'Make basic test' : 'Generate IELTS test';
      $('#diff-label').hidden = newMethod === 'basic';
      // Basic mode can only make some question types.
      app.querySelectorAll('#q-types .chip').forEach((c) => {
        c.style.opacity = newMethod === 'basic' && !A2I.OFFLINE_TYPES.includes(c.dataset.type) ? 0.4 : '';
        c.title = c.style.opacity ? 'Needs AI questions' : '';
      });
    }
    app.querySelectorAll('input[name=method]').forEach((r) => r.addEventListener('change', syncMethod));
    syncMethod();

    function collect() {
      const article = {
        title: $('#article-title').value.trim(),
        source: $('#article-source').value.trim(),
        paragraphs: A2I.splitParagraphs(textEl.value),
      };
      const opts = {
        count: Number($('#q-count').value),
        types: Array.from(app.querySelectorAll('#q-types input:checked')).map((i) => i.value),
        difficulty: $('#q-diff').value,
      };
      if (A2I.wordCount(textEl.value) < 150) throw new Error('Please add a longer article (at least 150 words).');
      if (!opts.types.length) throw new Error('Choose at least one question type.');
      return { article, opts };
    }

    function showError(msg) {
      const el = $('#gen-error');
      el.textContent = msg;
      el.hidden = !msg;
    }

    $('#gen-btn').addEventListener('click', async () => {
      showError('');
      let input;
      try { input = collect(); } catch (e) { return showError(e.message); }
      const s = store.getSettings();
      if (newMethod === 'ai' && !s.keys[s.provider]) {
        showError('Add an API key in Settings first (Gemini, Groq and OpenRouter keys are free), or choose “Basic questions” or “Claude chat”, which need no key.');
        return;
      }
      generating = new AbortController();
      $('#gen-btn').disabled = true;
      $('#cancel-btn').hidden = false;
      const prog = $('#gen-progress');
      prog.hidden = false;
      const onProgress = (msg) => { prog.querySelector('span').textContent = msg; };
      try {
        const test = newMethod === 'basic'
          ? await A2I.generateOffline(input.article, input.opts, onProgress, generating.signal)
          : await A2I.generateTest(input.article, input.opts, s, onProgress, generating.signal);
        store.saveTest(test);
        location.hash = '#/test/' + encodeURIComponent(test.id);
      } catch (e) {
        showError(e.name === 'AbortError' ? 'Cancelled.' : (e.message || String(e)));
      } finally {
        generating = null;
        if (document.body.contains(prog)) {
          prog.hidden = true;
          $('#gen-btn').disabled = false;
          $('#cancel-btn').hidden = true;
        }
      }
    });
    $('#cancel-btn').addEventListener('click', () => generating && generating.abort());

    $('#copy-prompt').addEventListener('click', async () => {
      showError('');
      let input;
      try { input = collect(); } catch (e) { return showError(e.message); }
      const prompt = A2I.buildChatPrompt(input.article, input.opts);
      try {
        await navigator.clipboard.writeText(prompt);
        A2I.toast('Prompt copied — paste it into Claude');
      } catch (e) {
        $('#paste-json').value = prompt;
        A2I.toast('Clipboard blocked — the prompt is in the box below; copy it from there');
      }
    });

    $('#import-json').addEventListener('click', () => {
      showError('');
      try {
        const paragraphs = A2I.splitParagraphs(textEl.value);
        const test = A2I.normalizeTest($('#paste-json').value, {
          paragraphs: paragraphs.length ? paragraphs : null,
          title: $('#article-title').value.trim(),
          source: $('#article-source').value.trim(),
        });
        store.saveTest(test);
        location.hash = '#/test/' + encodeURIComponent(test.id);
      } catch (e) {
        showError('Could not read that reply: ' + e.message + (A2I.splitParagraphs(textEl.value).length ? '' : '\nTip: keep the article text above so the passage can be shown.'));
      }
    });

    cleanup = () => {
      if (generating) generating.abort();
      document.removeEventListener('paste', onPaste);
    };
  }

  /* ---------- test view ---------- */

  let cur = null;

  function renderTest(id) {
    const test = store.getTest(id);
    if (!test) {
      app.innerHTML = '<div class="card empty"><p>That test was not found.</p><a class="btn" href="#/">Back to my tests</a></div>';
      return;
    }
    const progress = store.getProgress(id);
    cur = {
      test,
      progress,
      vocabHits: A2I.findVocab(test.paragraphs, test.vocabulary),
      evidence: null,
      tab: 'questions',
      showVocab: true,
      timer: null,
    };

    app.innerHTML = `
      <div class="test-bar">
        <h1>${esc(test.title)}</h1>
        <div class="row">
          <span class="timer" id="timer" title="Click to pause / resume" hidden></span>
          <a class="btn small" href="#/">← My tests</a>
        </div>
      </div>
      <div class="split">
        <section class="pane passage" id="passage" aria-label="Reading passage"></section>
        <section class="pane" id="side">
          <div class="tabs" role="tablist">
            <button data-tab="questions" class="active">Questions</button>
            <button data-tab="glossary">Dictionary (${test.vocabulary.length})</button>
            <button data-tab="help">How to use</button>
          </div>
          <div id="tab-body"></div>
        </section>
      </div>`;

    renderPassage();
    renderSide();
    startTimer();

    app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      cur.tab = b.dataset.tab;
      app.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
      renderSide();
    }));

    const passageEl = document.getElementById('passage');
    passageEl.addEventListener('mouseup', onPassageMouseUp);
    passageEl.addEventListener('touchend', () => setTimeout(onPassageMouseUp, 50));
    passageEl.addEventListener('click', onPassageClick);

    cleanup = () => {
      if (cur && cur.timer) clearInterval(cur.timer.handle);
      cur = null;
    };
  }

  function saveProgress() {
    store.saveProgress(cur.test.id, cur.progress);
  }

  function renderPassage() {
    const el = document.getElementById('passage');
    const { test, progress, vocabHits, evidence } = cur;
    const paraHTML = test.paragraphs.map((text, i) => {
      const hls = progress.highlights.filter((h) => h.p === i);
      const ev = evidence && evidence.p === i ? evidence : null;
      return `<div class="para" id="para-${i}">
        <span class="letter">${A2I.letter(i)}</span>
        <p class="ptext" data-p="${i}">${A2I.renderParagraphHTML(text, vocabHits[i], hls, ev)}</p>
      </div>`;
    }).join('');
    const scrollTop = el.scrollTop;
    el.classList.toggle('no-vocab', !cur.showVocab);
    el.innerHTML = `
      <h2>${esc(test.title)}</h2>
      ${test.source ? `<div class="source">${esc(test.source)}</div>` : ''}
      <div class="passage-tools">
        <label><input type="checkbox" id="toggle-vocab" ${cur.showVocab ? 'checked' : ''}> Underline dictionary words</label>
        ${progress.highlights.length ? '<button class="btn small ghost" id="clear-hl">Clear my highlights</button>' : ''}
        ${evidence ? '<button class="btn small ghost" id="clear-ev">Hide answer location</button>' : ''}
      </div>
      ${paraHTML}`;
    el.scrollTop = scrollTop;

    el.querySelector('#toggle-vocab').addEventListener('change', (e) => {
      cur.showVocab = e.target.checked;
      el.classList.toggle('no-vocab', !cur.showVocab);
    });
    const clr = el.querySelector('#clear-hl');
    if (clr) clr.addEventListener('click', () => {
      if (!confirm('Remove all your highlights from this passage?')) return;
      cur.progress.highlights = [];
      saveProgress();
      renderPassage();
    });
    const cev = el.querySelector('#clear-ev');
    if (cev) cev.addEventListener('click', () => { cur.evidence = null; renderPassage(); });
  }

  function renderSide() {
    const body = document.getElementById('tab-body');
    if (cur.tab === 'glossary') return renderGlossary(body);
    if (cur.tab === 'help') return renderHelp(body);
    return renderQuestions(body);
  }

  /* ----- questions ----- */

  const TFNG = ['TRUE', 'FALSE', 'NOT GIVEN'];
  const YNNG = ['YES', 'NO', 'NOT GIVEN'];

  function groupRange(g) {
    const a = g.questions[0].number;
    const b = g.questions[g.questions.length - 1].number;
    return a === b ? 'Question ' + a : 'Questions ' + a + '–' + b;
  }

  function optionsFor(g) {
    if (g.options.length) return g.options;
    if (g.type === 'matching_information' || g.type === 'matching_headings') {
      return cur.test.paragraphs.map((_, i) => ({ key: A2I.letter(i), text: '' }));
    }
    return [];
  }

  function controlFor(g, q, given, locked) {
    const dis = locked ? 'disabled' : '';
    if (g.type === 'true_false_not_given' || g.type === 'yes_no_not_given') {
      const opts = g.type === 'true_false_not_given' ? TFNG : YNNG;
      return `<div class="controls tfng">${opts.map((o) =>
        `<button type="button" data-q="${q.number}" data-val="${o}" class="${normAnswer(given) === normAnswer(o) ? 'picked' : ''}" ${dis}>${o}</button>`).join('')}</div>`;
    }
    if (q.choices.length) {
      return `<div>${q.choices.map((c) => `
        <label class="choice"><input type="radio" name="q${q.number}" data-q="${q.number}" value="${esc(c.key)}" ${given === c.key ? 'checked' : ''} ${dis}>
        <span><b>${esc(c.key)}</b> ${esc(c.text)}</span></label>`).join('')}</div>`;
    }
    const opts = optionsFor(g);
    if (opts.length) {
      return `<select data-q="${q.number}" ${dis}><option value="">—</option>${opts.map((o) =>
        `<option value="${esc(o.key)}" ${given === o.key ? 'selected' : ''}>${esc(o.key)}</option>`).join('')}</select>`;
    }
    return `<input type="text" class="gap-input" data-q="${q.number}" value="${esc(given || '')}" autocomplete="off" spellcheck="false" ${dis}>`;
  }

  function renderQuestion(g, q, locked) {
    const given = cur.progress.answers[q.number] || '';
    const ctrl = controlFor(g, q, given, locked);
    const gap = /_{3,}/;
    let main;
    if (gap.test(q.text) && ctrl.startsWith('<input')) {
      const [before, ...rest] = q.text.split(gap);
      main = `<span class="qtext">${esc(before)}${ctrl}${esc(rest.join('_____'))}</span>`;
    } else if (ctrl.startsWith('<select') || ctrl.startsWith('<input')) {
      main = `<span class="qtext">${esc(q.text)}</span> ${ctrl}`;
    } else {
      main = `<span class="qtext">${esc(q.text)}</span>${ctrl}`;
    }

    let cls = '';
    let fb = '';
    if (locked) {
      const ok = isCorrect(q, given);
      cls = ok ? 'correct' : 'wrong';
      const alt = q.acceptedAnswers.length ? ` <span class="muted">(also accepted: ${q.acceptedAnswers.map(esc).join(', ')})</span>` : '';
      fb = `<div class="feedback">
        ${ok ? '✓ Correct.' : `✗ Your answer: <b>${esc(given || '(blank)')}</b>.`}
        Answer: <span class="ans">${esc(q.answer)}</span>${alt}
        ${q.explanation ? `<div style="margin-top:4px">${esc(q.explanation)}</div>` : ''}
        ${q.evidence ? `<button class="btn small" data-locate="${q.number}">Show in passage</button>` : ''}
      </div>`;
    }
    return `<div class="q ${cls}" id="q-${q.number}"><span class="num">${q.number}</span>${main}${fb}</div>`;
  }

  function renderQuestions(body) {
    const { test, progress } = cur;
    const locked = progress.submitted;
    const total = A2I.questionCount(test);
    let correct = 0;
    if (locked) test.questionGroups.forEach((g) => g.questions.forEach((q) => { if (isCorrect(q, progress.answers[q.number])) correct++; }));
    const answered = Object.values(progress.answers).filter((v) => String(v).trim()).length;

    body.innerHTML = `
      ${locked ? `<div class="result">
        <div><div class="muted small">Score</div><div class="big">${correct} / ${total}</div></div>
        <div><div class="muted small">Estimated band*</div><div class="band">${bandFor(correct, total).toFixed(1)}</div></div>
        <div class="small muted" style="flex:1;min-width:180px">*Your score scaled to the 40-question IELTS Academic Reading test. One passage is only a rough guide.</div>
      </div>` : ''}
      ${test.questionGroups.map((g) => `
        <div class="qgroup">
          <h3>${groupRange(g)}</h3>
          ${g.instructions ? `<div class="instr">${esc(g.instructions.replace(/^Questions?\s+\d+\s*[–-]?\s*\d*\s*\n?/i, ''))}</div>` : ''}
          ${g.options.length ? `<div class="optlist">${g.type === 'matching_headings' ? '<div><b></b><i>List of Headings</i></div>' : ''}${g.options.map((o) => `<div><b>${esc(o.key)}</b> ${esc(o.text)}</div>`).join('')}</div>` : ''}
          ${g.summaryTitle ? `<div class="summary-title">${esc(g.summaryTitle)}</div>` : ''}
          ${g.questions.map((q) => renderQuestion(g, q, locked)).join('')}
        </div>`).join('')}
      <div class="submit-row">
        ${locked
          ? '<button class="btn" id="retry">Try again</button><span class="muted small" style="align-self:center">Click “Show in passage” to see where each answer is.</span>'
          : `<span class="muted small" style="align-self:center">${answered} of ${total} answered</span><button class="btn primary" id="submit">Check answers</button>`}
      </div>`;

    body.querySelectorAll('.tfng button').forEach((b) => b.addEventListener('click', () => {
      setAnswer(b.dataset.q, b.dataset.val);
      b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('picked', x === b));
    }));
    body.querySelectorAll('input[type=radio], select').forEach((el) => el.addEventListener('change', () => setAnswer(el.dataset.q, el.value)));
    body.querySelectorAll('input.gap-input').forEach((el) => el.addEventListener('input', () => setAnswer(el.dataset.q, el.value)));
    body.querySelectorAll('[data-locate]').forEach((b) => b.addEventListener('click', () => locate(Number(b.dataset.locate))));

    const submit = body.querySelector('#submit');
    if (submit) submit.addEventListener('click', () => {
      const missing = total - Object.values(cur.progress.answers).filter((v) => String(v).trim()).length;
      if (missing > 0 && !confirm(`You have ${missing} unanswered question${missing > 1 ? 's' : ''}. Check answers anyway?`)) return;
      let c = 0;
      test.questionGroups.forEach((g) => g.questions.forEach((q) => { if (isCorrect(q, cur.progress.answers[q.number])) c++; }));
      cur.progress.submitted = true;
      cur.progress.lastScore = { correct: c, total, band: bandFor(c, total).toFixed(1), at: Date.now() };
      saveProgress();
      stopTimer();
      renderQuestions(body);
      document.getElementById('side').scrollTop = 0;
    });
    const retry = body.querySelector('#retry');
    if (retry) retry.addEventListener('click', () => {
      cur.progress.submitted = false;
      cur.progress.answers = {};
      cur.evidence = null;
      saveProgress();
      renderPassage();
      renderQuestions(body);
      startTimer();
    });
  }

  function setAnswer(num, val) {
    cur.progress.answers[num] = val;
    saveProgress();
    const counter = document.querySelector('.submit-row span');
    if (counter && !cur.progress.submitted) {
      const answered = Object.values(cur.progress.answers).filter((v) => String(v).trim()).length;
      counter.textContent = `${answered} of ${A2I.questionCount(cur.test)} answered`;
    }
  }

  function locate(num) {
    let q = null;
    cur.test.questionGroups.forEach((g) => g.questions.forEach((x) => { if (x.number === num) q = x; }));
    if (!q) return;
    const ev = A2I.findEvidence(cur.test.paragraphs, q.evidence);
    if (!ev) {
      A2I.toast('Could not find the exact quote in the passage: “' + q.evidence.slice(0, 80) + '”');
      return;
    }
    cur.evidence = ev;
    renderPassage();
    const para = document.getElementById('para-' + ev.p);
    const pane = document.getElementById('passage');
    const mark = para.querySelector('.evidence');
    if (window.matchMedia('(max-width: 900px)').matches) {
      (mark || para).scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      const target = (mark || para).offsetTop - pane.offsetTop - 80;
      pane.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }
    para.classList.remove('flash');
    void para.offsetWidth;
    para.classList.add('flash');
  }

  /* ----- glossary tab ----- */

  function glossaryItemHTML(v, i, opts) {
    opts = opts || {};
    return `<div class="glossary-item">
      <div><span class="w">${esc(v.word)}</span>${v.partOfSpeech ? `<span class="pos">${esc(v.partOfSpeech)}</span>` : ''}${v.level ? `<span class="lvl">${esc(v.level)}</span>` : ''}</div>
      <div class="def-blur">${esc(v.definition)}</div>
      ${v.example ? `<div class="ex def-blur">“${esc(v.example)}”</div>` : ''}
      ${v.synonyms && v.synonyms.length ? `<div class="syn def-blur"><span class="muted">Synonyms:</span> ${v.synonyms.map(esc).join(', ')}</div>` : ''}
      ${v.context ? `<div class="ex">From: ${esc(v.context)}</div>` : ''}
      <div class="actions">
        <button class="btn small ghost" data-say="${esc(v.word)}">🔊 Listen</button>
        ${opts.inPassage ? `<button class="btn small ghost" data-find="${i}">Find in passage</button>` : ''}
        ${opts.save ? `<button class="btn small ghost" data-save="${i}">+ My words</button>` : ''}
        ${opts.remove ? `<button class="btn small ghost" data-remove="${esc(v.word)}">Remove</button>` : ''}
      </div>
    </div>`;
  }

  function bindGlossaryActions(root) {
    root.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => speak(b.dataset.say)));
    root.querySelectorAll('.def-blur').forEach((el) => el.addEventListener('click', () => el.classList.toggle('revealed')));
  }

  function renderGlossary(body) {
    const vocab = cur.test.vocabulary;
    body.innerHTML = `
      <p class="muted small" style="margin-top:0">Key words from this article. Dotted words in the passage open these definitions. Double-click any other word to look it up.</p>
      <label class="chip" style="margin-bottom:8px"><input type="checkbox" id="hide-defs"> Quiz me (hide definitions — click to reveal)</label>
      <div id="gloss-list">${vocab.length
        ? vocab.map((v, i) => glossaryItemHTML(v, i, { inPassage: true, save: true })).join('')
        : '<p class="muted">This test has no dictionary.</p>'}</div>`;
    bindGlossaryActions(body);
    body.querySelector('#hide-defs').addEventListener('change', (e) => body.querySelector('#gloss-list').classList.toggle('hide-defs', e.target.checked));
    body.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => saveVocab(vocab[Number(b.dataset.save)])));
    body.querySelectorAll('[data-find]').forEach((b) => b.addEventListener('click', () => {
      const vi = Number(b.dataset.find);
      for (let p = 0; p < cur.vocabHits.length; p++) {
        const hit = cur.vocabHits[p].find((h) => h.v === vi);
        if (hit) {
          cur.evidence = { p, start: hit.start, end: hit.end };
          renderPassage();
          const el = document.querySelector('#para-' + p + ' .evidence');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
      A2I.toast('Not found in the passage');
    }));
  }

  function contextFor(p, start, end) {
    const text = cur.test.paragraphs[p];
    const s = Math.max(text.lastIndexOf('.', start) + 1, 0);
    let e = text.indexOf('.', end);
    e = e < 0 ? text.length : e + 1;
    return text.slice(s, e).trim();
  }

  function saveVocab(v, context) {
    const added = store.addWord({
      word: v.word,
      partOfSpeech: v.partOfSpeech || '',
      definition: v.definition || '',
      example: v.example || '',
      synonyms: v.synonyms || [],
      level: v.level || '',
      context: context || '',
      testTitle: cur ? cur.test.title : '',
    });
    A2I.toast(added ? `Saved “${v.word}” to My words` : `“${v.word}” is already in My words`);
  }

  function renderHelp(body) {
    body.innerHTML = `
      <h3 style="margin-top:0">How to practise</h3>
      <ol>
        <li>Start the timer (20 minutes is the real-test pace for one passage) and answer the questions on the Questions tab. Your answers save automatically.</li>
        <li><b>Highlight</b>: select any text in the passage, then pick a colour — just like underlining keywords on the paper test. Click a highlight to remove it.</li>
        <li><b>Dictionary</b>: words with a dotted underline are in this article’s dictionary — click them. <b>Double-click</b> any other word to look it up in an online dictionary.</li>
        <li><b>+ My words</b> saves a word with its sentence from the article to your personal word list (top menu → My words).</li>
        <li>Press <b>Check answers</b> to see your score, an estimated band, the correct answers with explanations, and <b>Show in passage</b> to see exactly where each answer comes from.</li>
      </ol>
      <h3>IELTS tips</h3>
      <ul>
        <li>Read the questions first, then scan the passage for paraphrases of their key words.</li>
        <li>FALSE = the passage says the opposite. NOT GIVEN = the passage doesn’t say.</li>
        <li>For gap-fills, copy words exactly from the passage and respect the word limit. Spelling counts.</li>
        <li>For headings, look for the main idea of the whole paragraph, not one detail.</li>
      </ul>`;
  }

  /* ----- timer ----- */

  function startTimer() {
    const el = document.getElementById('timer');
    const minutes = store.getSettings().timerMinutes;
    if (!el || !minutes || cur.progress.submitted) { if (el) el.hidden = true; return; }
    stopTimer();
    const t = { left: minutes * 60, paused: false, handle: null };
    cur.timer = t;
    el.hidden = false;
    const draw = () => {
      const m = Math.floor(Math.abs(t.left) / 60);
      const s = Math.abs(t.left) % 60;
      el.textContent = (t.left < 0 ? '+' : '') + m + ':' + String(s).padStart(2, '0') + (t.paused ? ' ⏸' : '');
      el.classList.toggle('low', t.left <= 120);
      el.classList.toggle('paused', t.paused);
    };
    draw();
    t.handle = setInterval(() => {
      if (t.paused) return;
      t.left--;
      if (t.left === 0) A2I.toast('Time is up! You can keep going, but in the real test you would have to move on.');
      draw();
    }, 1000);
    el.onclick = () => { t.paused = !t.paused; draw(); };
  }

  function stopTimer() {
    if (cur && cur.timer) {
      clearInterval(cur.timer.handle);
      cur.timer = null;
    }
    const el = document.getElementById('timer');
    if (el) el.hidden = true;
  }

  /* ---------- selection toolbar, highlights, dictionary popover ---------- */

  let pendingSel = null; // {p, start, end, text}

  function hideFloating() {
    toolbar.hidden = true;
    popover.hidden = true;
    pendingSel = null;
  }

  function placeNear(el, rect) {
    el.style.left = '0px';
    el.style.top = '0px';
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = rect.left + window.scrollX + rect.width / 2 - w / 2;
    left = Math.max(8 + window.scrollX, Math.min(left, window.scrollX + document.documentElement.clientWidth - w - 8));
    let top = rect.top + window.scrollY - h - 8;
    if (top < window.scrollY + 60) top = rect.bottom + window.scrollY + 8;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  function onPassageMouseUp() {
    if (!cur) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const startEl = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const ptext = startEl && startEl.closest('.ptext');
    if (!ptext) return;
    const { start, end } = A2I.rangeToOffsets(ptext, range);
    const p = Number(ptext.dataset.p);
    const text = cur.test.paragraphs[p].slice(start, end);
    if (!text.trim()) return;
    // Trim surrounding whitespace from the stored range.
    const lead = text.length - text.trimStart().length;
    const trail = text.length - text.trimEnd().length;
    pendingSel = { p, start: start + lead, end: end - trail, text: text.trim() };
    popover.hidden = true;
    toolbar.querySelector('[data-action=unhighlight]').hidden = true;
    toolbar.querySelectorAll('.swatch, [data-action=define], [data-action=save]').forEach((b) => { b.hidden = false; });
    toolbar.hidden = false;
    placeNear(toolbar, range.getBoundingClientRect());
  }

  function onPassageClick(e) {
    if (!cur) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; // handled by mouseup
    const mark = e.target.closest('mark.hl');
    const vocab = e.target.closest('.vocab');
    if (vocab && cur.showVocab) {
      showVocabPopover(Number(vocab.dataset.v), vocab);
      return;
    }
    if (mark) {
      pendingSel = { highlightId: mark.dataset.h };
      popover.hidden = true;
      toolbar.querySelectorAll('.swatch, [data-action=define], [data-action=save]').forEach((b) => { b.hidden = true; });
      toolbar.querySelector('[data-action=unhighlight]').hidden = false;
      toolbar.hidden = false;
      placeNear(toolbar, mark.getBoundingClientRect());
    }
  }

  toolbar.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection alive
  toolbar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !cur || !pendingSel) return;
    const s = pendingSel;
    if (b.dataset.color) {
      cur.progress.highlights.push({ id: 'h' + Date.now().toString(36), p: s.p, start: s.start, end: s.end, color: b.dataset.color });
      saveProgress();
      window.getSelection().removeAllRanges();
      hideFloating();
      renderPassage();
    } else if (b.dataset.action === 'unhighlight') {
      cur.progress.highlights = cur.progress.highlights.filter((h) => h.id !== s.highlightId);
      saveProgress();
      hideFloating();
      renderPassage();
    } else if (b.dataset.action === 'define' || b.dataset.action === 'save') {
      const rect = toolbar.getBoundingClientRect();
      const context = contextFor(s.p, s.start, s.end);
      const word = s.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      toolbar.hidden = true;
      window.getSelection().removeAllRanges();
      const known = cur.test.vocabulary.findIndex((v) => [v.word, v.inText].some((x) => x.toLowerCase() === word.toLowerCase()));
      if (b.dataset.action === 'save' && known >= 0) {
        saveVocab(cur.test.vocabulary[known], context);
      } else if (known >= 0) {
        showVocabPopover(known, null, rect);
      } else {
        lookupWord(word, rect, context, b.dataset.action === 'save');
      }
    }
  });

  function showVocabPopover(vi, anchor, rect) {
    const v = cur.test.vocabulary[vi];
    toolbar.hidden = true;
    popover.innerHTML = `<button class="close" aria-label="Close">×</button>
      <div><span class="w">${esc(v.word)}</span> <span class="pos">${esc(v.partOfSpeech)}</span> ${v.level ? `<span class="badge">${esc(v.level)}</span>` : ''}</div>
      <div style="margin-top:6px">${esc(v.definition)}</div>
      ${v.example ? `<div class="ex" style="margin-top:6px">“${esc(v.example)}”</div>` : ''}
      ${v.synonyms.length ? `<div class="small" style="margin-top:6px"><span class="muted">Synonyms:</span> ${v.synonyms.map(esc).join(', ')}</div>` : ''}
      <div class="actions">
        <button class="btn small" data-pop="say">🔊 Listen</button>
        <button class="btn small" data-pop="save">+ My words</button>
      </div>`;
    popover.hidden = false;
    placeNear(popover, rect || anchor.getBoundingClientRect());
    let context = '';
    if (anchor) {
      const ptext = anchor.closest('.ptext');
      const p = Number(ptext.dataset.p);
      const hit = cur.vocabHits[p].find((h) => h.v === vi);
      if (hit) context = contextFor(p, hit.start, hit.end);
    }
    popover.querySelector('.close').onclick = () => { popover.hidden = true; };
    popover.querySelector('[data-pop=say]').onclick = () => speak(v.word);
    popover.querySelector('[data-pop=save]').onclick = () => saveVocab(v, context);
  }

  const lookupCache = {};

  async function lookupWord(word, rect, context, saveAfter) {
    if (!word) return;
    popover.innerHTML = `<button class="close" aria-label="Close">×</button><div><span class="w">${esc(word)}</span></div><p class="muted">Looking up…</p>`;
    popover.hidden = false;
    placeNear(popover, rect);
    popover.querySelector('.close').onclick = () => { popover.hidden = true; };

    let entry = null;
    const key = word.toLowerCase();
    try {
      if (!(key in lookupCache)) {
        const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(key));
        lookupCache[key] = res.ok ? (await res.json())[0] : null;
      }
      entry = lookupCache[key];
    } catch (e) {
      entry = undefined; // network error
    }

    const meanings = entry ? entry.meanings.slice(0, 3) : [];
    const first = meanings[0];
    const firstDef = first ? first.definitions[0] : null;
    const result = {
      word: entry ? entry.word : word,
      partOfSpeech: first ? first.partOfSpeech : '',
      definition: firstDef ? firstDef.definition : '',
      example: firstDef && firstDef.example ? firstDef.example : '',
      synonyms: first ? (first.synonyms || []).slice(0, 5) : [],
    };
    if (saveAfter) {
      saveVocab(result, context);
      popover.hidden = true;
      return;
    }
    const phon = entry && (entry.phonetic || (entry.phonetics.find((p) => p.text) || {}).text);
    const audio = entry && (entry.phonetics.find((p) => p.audio) || {}).audio;
    popover.innerHTML = `<button class="close" aria-label="Close">×</button>
      <div><span class="w">${esc(result.word)}</span>${phon ? `<span class="phon">${esc(phon)}</span>` : ''}</div>
      ${entry ? meanings.map((m) => `<div style="margin-top:6px"><span class="pos">${esc(m.partOfSpeech)}</span>
        <ol>${m.definitions.slice(0, 2).map((d) => `<li>${esc(d.definition)}${d.example ? `<div class="ex">“${esc(d.example)}”</div>` : ''}</li>`).join('')}</ol></div>`).join('')
        : `<p class="muted">${entry === undefined ? 'Could not reach the online dictionary.' : 'No dictionary entry found.'} You can still save it and add your own note.</p>`}
      <div class="actions">
        <button class="btn small" data-pop="say">🔊 Listen</button>
        <button class="btn small" data-pop="save">+ My words</button>
        <a class="btn small ghost" target="_blank" rel="noopener" href="https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(key)}">Cambridge ↗</a>
      </div>`;
    placeNear(popover, rect);
    popover.querySelector('.close').onclick = () => { popover.hidden = true; };
    popover.querySelector('[data-pop=say]').onclick = () => {
      if (audio) new Audio(audio).play().catch(() => speak(word));
      else speak(word);
    };
    popover.querySelector('[data-pop=save]').onclick = () => saveVocab(result, context);
  }

  // Double-click a word: browsers select it, so show the dictionary straight away.
  document.addEventListener('dblclick', (e) => {
    if (!cur || !e.target.closest('.ptext') || e.target.closest('.vocab')) return;
    setTimeout(() => {
      if (!pendingSel || !pendingSel.text || /\s/.test(pendingSel.text)) return;
      const rect = window.getSelection().rangeCount ? window.getSelection().getRangeAt(0).getBoundingClientRect() : null;
      if (!rect) return;
      const s = pendingSel;
      const known = cur.test.vocabulary.findIndex((v) => [v.word, v.inText].some((x) => x.toLowerCase() === s.text.toLowerCase()));
      if (known >= 0) return;
      toolbar.hidden = false; // keep highlight colours available
      lookupWord(s.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''), toolbar.getBoundingClientRect(), contextFor(s.p, s.start, s.end), false)
        .then(() => {
          // Put the popover below the toolbar so both stay usable.
          const tb = toolbar.getBoundingClientRect();
          popover.style.top = (tb.bottom + window.scrollY + 6) + 'px';
        });
    }, 30);
  });

  document.addEventListener('mousedown', (e) => {
    if (toolbar.contains(e.target) || popover.contains(e.target)) return;
    if (e.target.closest('.vocab') || e.target.closest('mark.hl')) return;
    toolbar.hidden = true;
    if (!e.target.closest('.ptext')) popover.hidden = true;
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideFloating(); });

  /* ---------- my words ---------- */

  function renderWords() {
    const words = store.getWords();
    app.innerHTML = `<div class="words-wrap">
      <div class="lib-head">
        <div>
          <h1 style="margin:0">My words</h1>
          <p class="muted" style="margin:4px 0 0">${words.length} saved word${words.length === 1 ? '' : 's'} from your articles.</p>
        </div>
        <div class="row">
          <label class="chip"><input type="checkbox" id="hide-defs"> Quiz me</label>
          ${words.length ? '<button class="btn" id="export-csv">Export CSV (Anki / Quizlet)</button>' : ''}
        </div>
      </div>
      <div class="card" style="margin-top:12px" id="word-list">
        ${words.length ? words.map((w, i) => glossaryItemHTML(w, i, { remove: true })).join('')
          : '<p class="muted empty">Nothing saved yet. Open a test, then click a dictionary word or select any word and press “+ My words”.</p>'}
      </div>
    </div>`;
    bindGlossaryActions(app);
    app.querySelector('#hide-defs').addEventListener('change', (e) => app.querySelector('#word-list').classList.toggle('hide-defs', e.target.checked));
    app.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
      store.removeWord(b.dataset.remove);
      renderWords();
    }));
    const exp = app.querySelector('#export-csv');
    if (exp) exp.addEventListener('click', () => {
      const q = (s) => '"' + String(s || '').replace(/"/g, '""') + '"';
      const rows = words.map((w) => [w.word, w.partOfSpeech, w.definition, w.example, (w.synonyms || []).join('; '), w.context].map(q).join(','));
      download('my-ielts-words.csv', 'word,part of speech,definition,example,synonyms,context\n' + rows.join('\n'), 'text/csv');
    });
  }

  /* ---------- settings ---------- */

  const dlg = document.getElementById('settings-dialog');
  const provSel = document.getElementById('set-provider');
  let draft = null; // settings being edited, so switching provider keeps typed keys
  let shown = null; // provider whose fields are on screen

  provSel.innerHTML = Object.entries(A2I.PROVIDERS).map(([id, p]) => `<option value="${id}">${esc(p.label)}</option>`).join('');

  function showProvider() {
    const id = provSel.value;
    const p = A2I.PROVIDERS[id];
    shown = id;
    document.getElementById('set-key').value = draft.keys[id] || '';
    document.getElementById('set-model-claude').hidden = id !== 'claude';
    document.getElementById('set-model-other').hidden = id === 'claude';
    if (id === 'claude') document.getElementById('set-model').value = draft.models.claude || 'claude-opus-5-5';
    else document.getElementById('set-model-name').value = draft.models[id] || p.model;
    const link = document.getElementById('set-key-link');
    link.href = p.keyUrl;
    link.textContent = id === 'claude' ? 'Get a key (paid)' : 'Get a free key';
  }
  function keepDraft() {
    const id = shown;
    draft.keys[id] = document.getElementById('set-key').value.trim();
    draft.models[id] = id === 'claude' ? document.getElementById('set-model').value : (document.getElementById('set-model-name').value.trim() || A2I.PROVIDERS[id].model);
  }
  provSel.addEventListener('change', () => { keepDraft(); showProvider(); });

  function openSettings() {
    draft = store.getSettings();
    provSel.value = draft.provider;
    document.getElementById('set-timer').value = draft.timerMinutes;
    showProvider();
    dlg.showModal();
  }
  document.getElementById('open-settings').addEventListener('click', openSettings);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-settings]')) { e.preventDefault(); openSettings(); }
  });
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'save') return;
    keepDraft();
    draft.provider = provSel.value;
    draft.timerMinutes = Math.max(0, Number(document.getElementById('set-timer').value) || 0);
    store.saveSettings(draft);
    if (draft.keys[draft.provider]) newMethod = 'ai';
    A2I.toast('Settings saved');
    if (!cur) route();
  });

  window.addEventListener('hashchange', route);
  route();
})();
