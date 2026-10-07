/* Persistence (localStorage) and test-data helpers.
   Each account's data is stored under its own keys ("…@<userId>"). */
(function () {
  const A2I = (window.A2I = window.A2I || {});

  const KEYS = {
    tests: 'a2i.tests.v1',
    words: 'a2i.words.v1',
    settings: 'a2i.settings.v1',
    progress: 'a2i.progress.v1', // answers/highlights for every test
    attempts: 'a2i.attempts.v1', // finished tests, for the dashboard
    draft: 'a2i.draft.v1', // unfinished New test form
  };
  const ACCOUNTS = 'a2i.accounts.v1';
  const SESSION = 'a2i.session.v1';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      A2I.toast && A2I.toast('Could not save — browser storage is full or blocked.');
      return false;
    }
  }

  /* ---------- accounts (stored in this browser only) ---------- */

  let userId = null;
  (function restoreSession() {
    const s = read(SESSION, null);
    if (s && read(ACCOUNTS, []).some((a) => a.id === s.userId)) userId = s.userId;
  })();

  const key = (name) => KEYS[name] + '@' + userId;
  // Tell the online database about a change (no-op without one).
  const notify = (kind, k, value) => { if (A2I.cloud && A2I.cloud.changed) A2I.cloud.changed(kind, k, value); };

  function toHex(buf) {
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function hashPassword(password, salt) {
    if (window.crypto && crypto.subtle) {
      const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 150000, hash: 'SHA-256' }, base, 256);
      return 'pbkdf2:' + toHex(bits);
    }
    // Very old browsers: a plain (weak) hash so the password is at least not stored as text.
    let h = 2166136261;
    const t = salt + password;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'fnv:' + (h >>> 0).toString(16);
  }

  const normEmail = (e) => String(e || '').trim().toLowerCase();

  A2I.auth = {
    user() {
      const accounts = read(ACCOUNTS, []);
      const a = userId ? accounts.find((x) => x.id === userId) : null;
      if (!a) return null;
      // On this device the first account is the admin unless roles were set.
      const role = a.role || (accounts.some((x) => x.role === 'admin') ? 'user' : (accounts[0].id === a.id ? 'admin' : 'user'));
      return Object.assign({}, a, { role });
    },
    accounts() {
      return read(ACCOUNTS, []);
    },
    saveAccounts(list) {
      write(ACCOUNTS, list);
    },
    hasAccounts() {
      return read(ACCOUNTS, []).length > 0;
    },
    async register({ name, email, password, level, target }) {
      email = normEmail(email);
      name = String(name || '').trim();
      if (!name) throw new Error('Please enter your name.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter a valid email address.');
      if (String(password || '').length < 6) throw new Error('The password must be at least 6 characters.');
      const accounts = read(ACCOUNTS, []);
      if (accounts.some((a) => a.email === email)) throw new Error('An account with this email already exists here. Please log in.');
      const salt = A2I.uid() + Math.random().toString(36).slice(2);
      const account = {
        id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name, email, salt,
        hash: await hashPassword(password, salt),
        level: level || '', target: target || '',
        role: accounts.length === 0 ? 'admin' : 'user',
        created: Date.now(),
      };
      const first = accounts.length === 0;
      accounts.push(account);
      write(ACCOUNTS, accounts);
      userId = account.id;
      write(SESSION, { userId });
      // The first account takes over anything saved before accounts existed.
      if (first) {
        Object.values(KEYS).forEach((k) => {
          const old = localStorage.getItem(k);
          if (old != null) {
            try { localStorage.setItem(k + '@' + userId, old); localStorage.removeItem(k); } catch (e) { /* storage full */ }
          }
        });
      }
      return account;
    },
    async login(email, password) {
      const account = read(ACCOUNTS, []).find((a) => a.email === normEmail(email));
      if (!account || (await hashPassword(password, account.salt)) !== account.hash) {
        throw new Error('Wrong email or password.');
      }
      if (account.blocked) throw new Error('This account has been blocked on this device.');
      userId = account.id;
      write(SESSION, { userId });
      account.lastSeen = Date.now();
      write(ACCOUNTS, read(ACCOUNTS, []).map((a) => (a.id === account.id ? account : a)));
      return account;
    },
    logout() {
      userId = null;
      try { localStorage.removeItem(SESSION); } catch (e) { /* ignore */ }
    },
    updateProfile(patch) {
      const accounts = read(ACCOUNTS, []);
      const a = accounts.find((x) => x.id === userId);
      if (!a) return;
      Object.assign(a, patch);
      write(ACCOUNTS, accounts);
    },
  };

  A2I.store = {
    getSettings() {
      const s = read(key('settings'), {});
      const out = {
        provider: s.provider || 'claude',
        keys: Object.assign({}, s.keys),
        models: Object.assign({ claude: 'claude-opus-5-5' }, s.models),
        timerMinutes: s.timerMinutes == null ? 20 : s.timerMinutes,
        speed: s.speed === 'best' ? 'best' : 'fast',
        translateTo: s.translateTo == null ? 'ru' : s.translateTo, // '' = off
      };
      // Settings saved by the first version of the app.
      if (s.apiKey && !out.keys.claude) out.keys.claude = s.apiKey;
      if (s.model && !(s.models && s.models.claude)) out.models.claude = s.model;
      return out;
    },
    saveSettings(s) {
      write(key('settings'), s);
      notify('settings', null, s);
    },
    _setUser(id) {
      userId = id;
    },
    // Raw access for syncing (does not report changes back).
    _raw: {
      get: (name, fallback) => read(key(name), fallback),
      set: (name, value) => write(key(name), value),
    },

    /* Tests created in the browser live in localStorage; bundled tests come
       from tests/*.js. Progress for both is stored separately per test id. */
    listTests() {
      const own = read(key('tests'), []);
      const bundled = [];
      (window.A2I_BUNDLED || []).forEach((t) => {
        try {
          bundled.push(Object.assign(A2I.normalizeTest(t), { bundled: true }));
        } catch (e) {
          console.warn('Skipping bundled test', t && t.id, e);
        }
      });
      const ownIds = new Set(own.map((t) => t.id));
      return own.concat(bundled.filter((t) => !ownIds.has(t.id)));
    },
    getTest(id) {
      return this.listTests().find((t) => t.id === id) || null;
    },
    saveTest(test) {
      const own = read(key('tests'), []);
      const i = own.findIndex((t) => t.id === test.id);
      const copy = Object.assign({}, test);
      delete copy.bundled;
      if (i >= 0) own[i] = copy;
      else own.unshift(copy);
      notify('tests', copy.id, copy);
      return write(key('tests'), own);
    },
    deleteTest(id) {
      write(key('tests'), read(key('tests'), []).filter((t) => t.id !== id));
      const p = read(key('progress'), {});
      delete p[id];
      write(key('progress'), p);
      notify('tests', id, null);
      notify('progress', id, null);
    },

    getProgress(id) {
      const p = read(key('progress'), {})[id] || {};
      return {
        answers: p.answers || {},
        highlights: p.highlights || [],
        submitted: !!p.submitted,
        lastScore: p.lastScore || null,
      };
    },
    saveProgress(id, progress) {
      const p = read(key('progress'), {});
      p[id] = progress;
      write(key('progress'), p);
      notify('progress', id, progress);
    },

    getWords() {
      return read(key('words'), []);
    },
    addWord(entry) {
      const words = read(key('words'), []);
      const lower = entry.word.toLowerCase();
      const existing = words.find((w) => w.word.toLowerCase() === lower);
      if (existing) {
        if (!existing.definition && entry.definition) existing.definition = entry.definition;
        write(key('words'), words);
        return false;
      }
      const item = Object.assign({ added: Date.now() }, entry);
      words.unshift(item);
      write(key('words'), words);
      notify('words', item.word, item);
      return true;
    },
    updateWord(word, patch) {
      const words = read(key('words'), []);
      const w = words.find((x) => x.word === word);
      if (w) { Object.assign(w, patch); write(key('words'), words); notify('words', w.word, w); }
    },
    removeWord(word) {
      write(key('words'), read(key('words'), []).filter((w) => w.word !== word));
      notify('words', word, null);
    },

    /* Finished tests, newest last: {testId, title, at, correct, total, band, byType: {type: [correct, total]}, seconds, overTime} */
    getAttempts() {
      return read(key('attempts'), []);
    },
    addAttempt(a) {
      const list = read(key('attempts'), []);
      list.push(a);
      write(key('attempts'), list.slice(-500));
      notify('attempts', a.testId + '|' + a.at, a);
    },

    getDraft() {
      return read(key('draft'), null);
    },
    saveDraft(d) {
      write(key('draft'), d);
    },
    clearDraft() {
      try { localStorage.removeItem(key('draft')); } catch (e) { /* ignore */ }
    },

    /* One file with everything (tests, answers, highlights, words) — without API keys. */
    exportAll() {
      return {
        app: 'Article2IELTS',
        version: 1,
        exported: new Date().toISOString(),
        tests: read(key('tests'), []),
        progress: read(key('progress'), {}),
        words: read(key('words'), []),
        attempts: read(key('attempts'), []),
      };
    },
    /* Merge a backup into what is already saved. Returns counts of new items. */
    importAll(data) {
      if (!data || data.app !== 'Article2IELTS') throw new Error('This is not an Article2IELTS backup file.');
      const tests = read(key('tests'), []);
      const have = new Set(tests.map((t) => t.id));
      let newTests = 0;
      (data.tests || []).forEach((t) => {
        if (!have.has(t.id)) { tests.push(t); have.add(t.id); newTests++; }
      });
      const progress = Object.assign({}, data.progress, read(key('progress'), {}));
      const words = read(key('words'), []);
      const haveWords = new Set(words.map((w) => w.word.toLowerCase()));
      let newWords = 0;
      (data.words || []).forEach((w) => {
        if (w && w.word && !haveWords.has(w.word.toLowerCase())) { words.push(w); haveWords.add(w.word.toLowerCase()); newWords++; }
      });
      write(key('tests'), tests);
      write(key('progress'), progress);
      write(key('words'), words);
      const attempts = read(key('attempts'), []);
      const seen = new Set(attempts.map((a) => a.testId + ':' + a.at));
      (data.attempts || []).forEach((a) => { if (a && !seen.has(a.testId + ':' + a.at)) attempts.push(a); });
      attempts.sort((x, y) => x.at - y.at);
      write(key('attempts'), attempts);
      tests.forEach((t) => notify('tests', t.id, t));
      Object.entries(progress).forEach(([id, pr]) => notify('progress', id, pr));
      words.forEach((w) => notify('words', w.word, w));
      attempts.forEach((a) => notify('attempts', a.testId + '|' + a.at, a));
      return { newTests, newWords };
    },
  };

  /* ---------- paragraphs ---------- */

  function wordCount(s) {
    return (s.match(/\S+/g) || []).length;
  }

  /* Split pasted article text into IELTS-style paragraphs (A, B, C...).
     Very short paragraphs (pull quotes, one-liners) are merged into the next one. */
  A2I.splitParagraphs = function (text) {
    const clean = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (!clean) return [];
    let parts = clean.split(/\n\s*\n/);
    if (parts.length < 3) parts = clean.split(/\n/);
    parts = parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);

    const MIN_WORDS = 35;
    const merged = [];
    let carry = '';
    for (const p of parts) {
      const joined = carry ? carry + ' ' + p : p;
      if (wordCount(joined) < MIN_WORDS) {
        carry = joined;
      } else {
        merged.push(joined);
        carry = '';
      }
    }
    if (carry) {
      if (merged.length) merged[merged.length - 1] += ' ' + carry;
      else merged.push(carry);
    }
    return merged;
  };

  A2I.letter = function (i) {
    let s = '';
    i += 1;
    while (i > 0) {
      const m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  };

  A2I.wordCount = wordCount;

  A2I.uid = function () {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  /* ---------- normalising test JSON (from Claude, imports, bundles) ---------- */

  const TYPES = [
    'true_false_not_given',
    'yes_no_not_given',
    'multiple_choice',
    'matching_headings',
    'matching_information',
    'matching_features',
    'sentence_completion',
    'summary_completion',
    'short_answer',
  ];

  const arr = (x) => (Array.isArray(x) ? x : []);
  const str = (x) => (x == null ? '' : String(x));

  /* Accepts loosely-shaped JSON and returns a test object the app can render.
     Throws an Error with a readable message when the data is unusable. */
  A2I.normalizeTest = function (raw, extra) {
    if (typeof raw === 'string') {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('No JSON object found in the pasted text.');
      raw = JSON.parse(m[0]);
    }
    if (!raw || typeof raw !== 'object') throw new Error('Test data is not an object.');
    extra = extra || {};

    let paragraphs = arr(raw.paragraphs).map(str).filter(Boolean);
    if (!paragraphs.length && extra.paragraphs) paragraphs = extra.paragraphs;
    if (!paragraphs.length && raw.passage) paragraphs = A2I.splitParagraphs(str(raw.passage));
    if (!paragraphs.length) throw new Error('The test has no passage paragraphs.');

    const groups = arr(raw.questionGroups).map((g) => {
      let type = str(g.type).toLowerCase().replace(/[\s-]+/g, '_');
      if (!TYPES.includes(type)) type = 'short_answer';
      return {
        type,
        instructions: str(g.instructions),
        summaryTitle: str(g.summaryTitle),
        options: arr(g.options).map((o) => ({ key: str(o.key).trim(), text: str(o.text) })).filter((o) => o.key),
        questions: arr(g.questions).map((q) => ({
          number: Number(q.number) || 0,
          text: str(q.text),
          choices: arr(q.choices).map((c) => ({ key: str(c.key).trim(), text: str(c.text) })).filter((c) => c.key),
          answer: str(q.answer).trim(),
          acceptedAnswers: arr(q.acceptedAnswers).map(str).filter(Boolean),
          explanation: str(q.explanation),
          evidence: str(q.evidence),
        })),
      };
    }).filter((g) => g.questions.length);

    if (!groups.length) throw new Error('The test has no questions.');

    // Make numbering continuous 1..N so the answer sheet is predictable.
    let n = 1;
    groups.forEach((g) => g.questions.forEach((q) => { q.number = n++; }));

    const vocabulary = arr(raw.vocabulary).map((v) => ({
      word: str(v.word).trim(),
      inText: str(v.inText || v.word).trim(),
      partOfSpeech: str(v.partOfSpeech),
      definition: str(v.definition),
      example: str(v.example),
      synonyms: arr(v.synonyms).map(str).filter(Boolean),
      level: str(v.level),
      mine: !!v.mine,
      translation: str(v.translation),
      trLang: str(v.trLang),
    })).filter((v) => v.word && v.definition);

    return {
      id: raw.id || extra.id || A2I.uid(),
      title: str(raw.title) || extra.title || 'Untitled passage',
      source: str(raw.source) || extra.source || '',
      created: raw.created || Date.now(),
      madeBy: str(raw.madeBy),
      paragraphs,
      vocabulary,
      questionGroups: groups,
    };
  };

  A2I.questionCount = function (test) {
    return test.questionGroups.reduce((s, g) => s + g.questions.length, 0);
  };
})();
