/* Persistence (localStorage) and test-data helpers. */
(function () {
  const A2I = (window.A2I = window.A2I || {});

  const KEYS = {
    tests: 'a2i.tests.v1',
    words: 'a2i.words.v1',
    settings: 'a2i.settings.v1',
    progress: 'a2i.progress.v1', // answers/highlights for bundled tests
  };

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

  A2I.store = {
    getSettings() {
      const s = read(KEYS.settings, {});
      const out = {
        provider: s.provider || 'claude',
        keys: Object.assign({}, s.keys),
        models: Object.assign({ claude: 'claude-opus-5-5' }, s.models),
        timerMinutes: s.timerMinutes == null ? 20 : s.timerMinutes,
      };
      // Settings saved by the first version of the app.
      if (s.apiKey && !out.keys.claude) out.keys.claude = s.apiKey;
      if (s.model && !(s.models && s.models.claude)) out.models.claude = s.model;
      return out;
    },
    saveSettings(s) {
      write(KEYS.settings, s);
    },

    /* Tests created in the browser live in localStorage; bundled tests come
       from tests/*.js. Progress for both is stored separately per test id. */
    listTests() {
      const own = read(KEYS.tests, []);
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
      const own = read(KEYS.tests, []);
      const i = own.findIndex((t) => t.id === test.id);
      const copy = Object.assign({}, test);
      delete copy.bundled;
      if (i >= 0) own[i] = copy;
      else own.unshift(copy);
      return write(KEYS.tests, own);
    },
    deleteTest(id) {
      write(KEYS.tests, read(KEYS.tests, []).filter((t) => t.id !== id));
      const p = read(KEYS.progress, {});
      delete p[id];
      write(KEYS.progress, p);
    },

    getProgress(id) {
      const p = read(KEYS.progress, {})[id] || {};
      return {
        answers: p.answers || {},
        highlights: p.highlights || [],
        submitted: !!p.submitted,
        lastScore: p.lastScore || null,
      };
    },
    saveProgress(id, progress) {
      const p = read(KEYS.progress, {});
      p[id] = progress;
      write(KEYS.progress, p);
    },

    getWords() {
      return read(KEYS.words, []);
    },
    addWord(entry) {
      const words = read(KEYS.words, []);
      const key = entry.word.toLowerCase();
      const existing = words.find((w) => w.word.toLowerCase() === key);
      if (existing) {
        if (!existing.definition && entry.definition) existing.definition = entry.definition;
        write(KEYS.words, words);
        return false;
      }
      words.unshift(Object.assign({ added: Date.now() }, entry));
      write(KEYS.words, words);
      return true;
    },
    removeWord(word) {
      write(KEYS.words, read(KEYS.words, []).filter((w) => w.word !== word));
    },

    /* One file with everything (tests, answers, highlights, words) — without API keys. */
    exportAll() {
      return {
        app: 'Article2IELTS',
        version: 1,
        exported: new Date().toISOString(),
        tests: read(KEYS.tests, []),
        progress: read(KEYS.progress, {}),
        words: read(KEYS.words, []),
      };
    },
    /* Merge a backup into what is already saved. Returns counts of new items. */
    importAll(data) {
      if (!data || data.app !== 'Article2IELTS') throw new Error('This is not an Article2IELTS backup file.');
      const tests = read(KEYS.tests, []);
      const have = new Set(tests.map((t) => t.id));
      let newTests = 0;
      (data.tests || []).forEach((t) => {
        if (!have.has(t.id)) { tests.push(t); have.add(t.id); newTests++; }
      });
      const progress = Object.assign({}, data.progress, read(KEYS.progress, {}));
      const words = read(KEYS.words, []);
      const haveWords = new Set(words.map((w) => w.word.toLowerCase()));
      let newWords = 0;
      (data.words || []).forEach((w) => {
        if (w && w.word && !haveWords.has(w.word.toLowerCase())) { words.push(w); haveWords.add(w.word.toLowerCase()); newWords++; }
      });
      write(KEYS.tests, tests);
      write(KEYS.progress, progress);
      write(KEYS.words, words);
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
