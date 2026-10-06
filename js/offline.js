/* Built-in test maker: no AI and no API key. It builds simpler IELTS-style
   questions straight from the text (gap fills, word-bank summary, matching
   paragraphs, True/False, vocabulary in context). Definitions for the
   dictionary come from the free dictionaryapi.dev service when online. */
(function () {
  const A2I = (window.A2I = window.A2I || {});

  A2I.OFFLINE_TYPES = ['true_false_not_given', 'multiple_choice', 'matching_information', 'sentence_completion', 'summary_completion'];

  // Common words that are not worth putting in the dictionary or gaps.
  const COMMON = new Set(('about above across actually after again against almost already also although always among another anyone anything around asked because become became been before began behind being believe below better between beyond called cannot certain change children city clear close come coming company could country course different doing done during early either enough even ever every everyone everything example family father feel felt find first follow found friend friends from further gave general getting give given going good government great group happen happened having head help here high himself history home house however human idea important inside instead itself just keep kind knew know known large last later least leave left less life like likely little live living long look looking made make making many matter maybe mean means might million minutes moment money month months more most mother much myself name nature need never next night nothing number often only open order other others outside over own part past people percent perhaps person place play point possible power pretty probably problem problems public question quite rather really reason recent report result right said same school second seem seemed seems several should show side simply since single small social some someone something sometimes soon start started state states still story street strong such sure system take taken talk tell than that their them themselves then there these they thing things think thinking third this those though thought three through time times today together told took toward towards turn turned under until upon used using usually very want wanted water week weeks well went were what whatever when where whether which while white whole whose wife will with within without woman women word words work worked working world would write writing written year years young yourself always because without another between something nothing everything anything someone everyone become becomes becoming including include includes included according american british english university research percent minute hours member members market markets business businesses following special simple period office parent parents letter rather mostly better longer around within itself'.split(' ')));

  const SUFFIX_BONUS = /(tion|sion|ment|ness|ity|ism|ance|ence|ous|ive|ical|able|ible|ise|ize|ify|ate|ent|ant|ary|ory|ure)s?$/;

  /* Small seeded random generator so the same article gives the same test. */
  function rng(seedText) {
    let h = 2166136261;
    for (let i = 0; i < seedText.length; i++) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, rand) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sentencesOf(paragraphs) {
    const out = [];
    paragraphs.forEach((text, p) => {
      const parts = text.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) || [text];
      let pos = 0;
      parts.forEach((raw, i) => {
        const s = raw.trim();
        const start = text.indexOf(s, pos);
        pos = start + s.length;
        out.push({ p, i, text: s, start, words: A2I.wordCount(s) });
      });
    });
    return out;
  }

  /* Score words for "worth learning". */
  function candidateWords(paragraphs) {
    const counts = {};
    paragraphs.forEach((text, p) => {
      const re = /[A-Za-z][a-z]+(?:-[a-z]+)?/g;
      let m;
      while ((m = re.exec(text))) {
        const w = m[0];
        if (/^[A-Z]/.test(w)) continue; // skip names and sentence starts
        if (w.length < 6 || COMMON.has(w) || COMMON.has(w.replace(/s$/, ''))) continue;
        const c = counts[w] || (counts[w] = { word: w, n: 0, p, score: 0 });
        c.n++;
      }
    });
    return Object.values(counts).map((c) => {
      c.score = Math.min(c.word.length, 12) + (SUFFIX_BONUS.test(c.word) ? 3 : 0) - (c.n > 3 ? 2 : 0) + (/ly$/.test(c.word) ? -3 : 0);
      return c;
    }).sort((a, b) => b.score - a.score);
  }

  function lemmas(w) {
    const out = [w];
    if (/ies$/.test(w)) out.push(w.replace(/ies$/, 'y'));
    if (/es$/.test(w)) out.push(w.replace(/es$/, ''));
    if (/s$/.test(w) && !/ss$/.test(w)) out.push(w.replace(/s$/, ''));
    if (/ied$/.test(w)) out.push(w.replace(/ied$/, 'y'));
    if (/ed$/.test(w)) out.push(w.replace(/d$/, ''), w.replace(/ed$/, ''), w.replace(/(.)\1ed$/, '$1'));
    if (/ing$/.test(w)) out.push(w.replace(/ing$/, 'e'), w.replace(/ing$/, ''), w.replace(/(.)\1ing$/, '$1'));
    if (/ly$/.test(w)) out.push(w.replace(/ly$/, ''));
    return Array.from(new Set(out));
  }

  async function define(word, signal) {
    for (const form of lemmas(word)) {
      try {
        const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(form), { signal });
        if (!res.ok) continue;
        const entry = (await res.json())[0];
        const m = entry.meanings[0];
        const d = m.definitions[0];
        const syn = (m.synonyms || []).concat(d.synonyms || []);
        return {
          word: entry.word,
          inText: word,
          partOfSpeech: m.partOfSpeech || '',
          definition: d.definition,
          example: d.example || '',
          synonyms: Array.from(new Set(syn)).slice(0, 4),
          level: '',
        };
      } catch (e) {
        if (signal && signal.aborted) throw e;
        return null; // offline
      }
    }
    return null;
  }

  async function buildVocabulary(cands, onProgress, signal) {
    const pick = cands.slice(0, 30);
    const out = [];
    let done = 0;
    let i = 0;
    async function worker() {
      while (i < pick.length) {
        const c = pick[i++];
        const v = await define(c.word, signal);
        done++;
        onProgress('Looking up dictionary words… ' + done + '/' + pick.length);
        if (v) out.push(Object.assign(v, { _score: c.score }));
      }
    }
    await Promise.all([worker(), worker(), worker(), worker(), worker()]);
    // Keep the passage order stable and the best ~20.
    return out.sort((a, b) => b._score - a._score).slice(0, 20).map((v) => { delete v._score; return v; });
  }

  /* ---------- True / False ---------- */

  const SWAPS = [
    ['more', 'less'], ['increase', 'decrease'], ['increased', 'decreased'], ['increasing', 'decreasing'],
    ['higher', 'lower'], ['larger', 'smaller'], ['bigger', 'smaller'], ['faster', 'slower'], ['earlier', 'later'],
    ['most', 'least'], ['many', 'few'], ['always', 'never'], ['before', 'after'], ['rise', 'fall'], ['rose', 'fell'],
    ['easier', 'harder'], ['better', 'worse'], ['cheaper', 'more expensive'], ['older', 'younger'],
    ['positive', 'negative'], ['success', 'failure'], ['possible', 'impossible'], ['common', 'rare'],
    ['majority', 'minority'], ['strong', 'weak'], ['stronger', 'weaker'], ['similar', 'different'],
  ];

  function makeFalse(s, rand) {
    // 1) change a number
    const num = s.match(/\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b/);
    if (num && !/^(19|20)\d\d$/.test(num[1])) {
      const n = parseFloat(num[1].replace(/,/g, ''));
      const changed = n < 10 ? n + 2 + Math.floor(rand() * 3) : Math.round(n * (rand() < 0.5 ? 0.5 : 2));
      return { text: s.replace(num[1], changed.toLocaleString('en-GB')), why: `the passage gives ${num[1]}, not ${changed.toLocaleString('en-GB')}` };
    }
    // 2) swap an opposite word
    for (const [a, b] of shuffle(SWAPS, rand)) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const re = new RegExp('\\b' + x + '\\b', 'i');
        if (re.test(s)) return { text: s.replace(re, y), why: `the passage says “${x}”, not “${y}”` };
      }
    }
    // 3) add or remove "not"
    const neg = s.match(/\b(is|are|was|were|can|could|will|would|does|do|did|has|have|had|should|must) not\b/);
    if (neg) return { text: s.replace(neg[0], neg[1]), why: `the passage says “${neg[0]}” — the statement leaves out “not”` };
    const aux = s.match(/\b(is|are|was|were|can|will|would|could|should|must)\b(?! not)/);
    if (aux) return { text: s.replace(aux[0], aux[1] + ' not'), why: `the passage says “${aux[1]}”, not “${aux[1]} not”` };
    return null;
  }

  function tidyStatement(s) {
    return s.replace(/^(But|And|However|Yet|So|Still|Instead|Indeed|Meanwhile|Moreover|Also),?\s+/i, '')
      .replace(/^./, (c) => c.toUpperCase())
      .replace(/["“”]/g, '');
  }

  function shorten(s, max) {
    const words = s.split(/\s+/);
    if (words.length <= max) return s;
    const cut = words.slice(0, max).join(' ');
    const comma = cut.lastIndexOf(',');
    return (comma > cut.length * 0.5 ? cut.slice(0, comma) : cut).replace(/[,;:]$/, '') + ' …';
  }

  /* ---------- main ---------- */

  A2I.generateOffline = async function (article, opts, onProgress, signal) {
    onProgress = onProgress || function () {};
    const paras = article.paragraphs;
    const rand = rng(paras.join(' ').slice(0, 2000));
    const total = opts.count || 13;
    let types = (opts.types || []).filter((t) => A2I.OFFLINE_TYPES.includes(t));
    if (!types.length) types = A2I.OFFLINE_TYPES.slice();

    const sents = sentencesOf(paras);
    const usable = sents.filter((s) => s.words >= 8 && s.words <= 45 && !/^["“]/.test(s.text) && !/\?$/.test(s.text));
    const used = new Set();
    const take = (s) => used.add(s.p + ':' + s.i);
    const isUsed = (s) => used.has(s.p + ':' + s.i);
    const noPronounStart = (s) => !/^(It|They|He|She|This|These|That|Those|Its|Their|His|Her|We|I|You)\b/.test(tidyStatement(s.text));

    const cands = candidateWords(paras);
    onProgress('Looking up dictionary words…');
    const vocabulary = await buildVocabulary(cands, onProgress, signal);
    onProgress('Making questions…');

    // Share questions out between the chosen types (vocab MCQ needs a dictionary).
    if (vocabulary.length < 4) types = types.filter((t) => t !== 'multiple_choice');
    if (!types.length) types = ['sentence_completion', 'true_false_not_given'];
    const share = {};
    types.forEach((t, i) => { share[t] = Math.floor(total / types.length) + (i < total % types.length ? 1 : 0); });

    const groups = [];
    const candSet = new Set(cands.map((c) => c.word));

    function gapWordIn(s, avoid) {
      const words = (s.text.match(/[A-Za-z][a-z]+(?:-[a-z]+)?/g) || []).filter((w, i) => i > 0 && candSet.has(w) && !avoid.has(w));
      if (!words.length) return null;
      return words.sort((a, b) => b.length - a.length)[0];
    }

    // Matching information: which paragraph contains…
    if (share.matching_information) {
      const qs = [];
      const byPara = shuffle(paras.map((_, i) => i), rand);
      for (const p of byPara) {
        if (qs.length >= share.matching_information) break;
        const s = shuffle(usable.filter((x) => x.p === p && !isUsed(x) && noPronounStart(x)), rand)[0];
        if (!s) continue;
        take(s);
        qs.push({ text: 'a statement that ' + tidyStatement(shorten(s.text, 22)).replace(/^./, (c) => c.toLowerCase()).replace(/[.!]$/, ''), answer: A2I.letter(p), explanation: `This idea is in paragraph ${A2I.letter(p)}.`, evidence: s.text, choices: [], acceptedAnswers: [] });
      }
      if (qs.length) groups.push({
        type: 'matching_information',
        instructions: `Reading Passage 1 has ${paras.length} paragraphs, A–${A2I.letter(paras.length - 1)}.\nWhich paragraph contains the following information?\nWrite the correct letter. You may use any letter more than once.`,
        summaryTitle: '', options: [], questions: qs,
      });
    }

    // True / False
    if (share.true_false_not_given) {
      const want = share.true_false_not_given;
      const pool = usable.filter((s) => !isUsed(s) && noPronounStart(s) && s.words <= 35);
      const qs = [];
      for (const s of shuffle(pool, rand)) {
        if (qs.length >= want) break;
        const wantFalse = qs.filter((q) => q.answer === 'FALSE').length < Math.ceil(want / 2);
        const base = tidyStatement(s.text);
        if (wantFalse) {
          const f = makeFalse(base, rand);
          if (!f) continue;
          qs.push({ text: f.text, answer: 'FALSE', explanation: `FALSE: ${f.why}.`, evidence: s.text, s });
        } else {
          qs.push({ text: base, answer: 'TRUE', explanation: 'TRUE: the passage says this.', evidence: s.text, s });
        }
        take(s);
      }
      qs.sort((a, b) => a.s.p - b.s.p || a.s.i - b.s.i);
      if (qs.length) groups.push({
        type: 'true_false_not_given',
        instructions: 'Do the following statements agree with the information given in Reading Passage 1?\nWrite\nTRUE if the statement agrees with the information\nFALSE if the statement contradicts the information\nNOT GIVEN if there is no information on this',
        summaryTitle: '', options: [],
        questions: qs.map((q) => ({ text: q.text, answer: q.answer, acceptedAnswers: [], explanation: q.explanation, evidence: q.evidence, choices: [] })),
      });
    }

    // Vocabulary in context (multiple choice)
    if (share.multiple_choice) {
      const qs = [];
      const hits = A2I.findVocab(paras, vocabulary);
      for (const vi of shuffle(vocabulary.map((_, i) => i), rand)) {
        if (qs.length >= share.multiple_choice) break;
        const p = hits.findIndex((h) => h.some((x) => x.v === vi));
        if (p < 0) continue;
        const v = vocabulary[vi];
        const others = shuffle(vocabulary.filter((x, i) => i !== vi && x.definition !== v.definition), rand).slice(0, 3);
        if (others.length < 3) break;
        const opts4 = shuffle([v].concat(others), rand);
        const keys = ['A', 'B', 'C', 'D'];
        const hit = hits[p].find((x) => x.v === vi);
        const sent = sents.find((s) => s.p === p && s.start <= hit.start && s.start + s.text.length >= hit.end);
        qs.push({
          text: `In paragraph ${A2I.letter(p)}, the word “${paras[p].slice(hit.start, hit.end)}” is closest in meaning to`,
          choices: opts4.map((o, i) => ({ key: keys[i], text: o.definition })),
          answer: keys[opts4.indexOf(v)],
          acceptedAnswers: [],
          explanation: `“${v.word}” (${v.partOfSpeech}) means: ${v.definition}`,
          evidence: sent ? sent.text : paras[p].slice(hit.start, hit.end),
          _p: p,
        });
      }
      qs.sort((a, b) => a._p - b._p);
      if (qs.length) groups.push({ type: 'multiple_choice', instructions: 'Choose the correct letter, A, B, C or D.', summaryTitle: '', options: [], questions: qs });
    }

    // Sentence completion: ONE WORD from the passage
    if (share.sentence_completion) {
      const qs = [];
      const avoid = new Set();
      for (const s of shuffle(usable.filter((x) => !isUsed(x) && x.words <= 32), rand)) {
        if (qs.length >= share.sentence_completion) break;
        const w = gapWordIn(s, avoid);
        if (!w) continue;
        avoid.add(w);
        take(s);
        qs.push({ text: tidyStatement(s.text).replace(new RegExp('\\b' + w + '\\b'), '_____'), answer: w, acceptedAnswers: [], explanation: `The missing word is “${w}”, copied from paragraph ${A2I.letter(s.p)}.`, evidence: s.text, choices: [], s });
      }
      qs.sort((a, b) => a.s.p - b.s.p || a.s.i - b.s.i);
      qs.forEach((q) => delete q.s);
      if (qs.length) groups.push({ type: 'sentence_completion', instructions: 'Complete the sentences below.\nChoose ONE WORD ONLY from the passage for each answer.', summaryTitle: '', options: [], questions: qs });
    }

    // Summary completion with a word bank, from one paragraph
    if (share.summary_completion) {
      const want = share.summary_completion;
      const order = paras.map((_, p) => p).sort((a, b) => usable.filter((s) => s.p === b && !isUsed(s)).length - usable.filter((s) => s.p === a && !isUsed(s)).length);
      for (const p of order) {
        const pool = usable.filter((s) => s.p === p && !isUsed(s));
        const avoid = new Set();
        const qs = [];
        for (const s of pool) {
          if (qs.length >= want) break;
          const w = gapWordIn(s, avoid);
          if (!w) continue;
          avoid.add(w);
          qs.push({ s, w });
        }
        if (qs.length < Math.min(2, want)) continue;
        qs.forEach((q) => take(q.s));
        const distractors = shuffle(cands.map((c) => c.word).filter((w) => !avoid.has(w)), rand).slice(0, Math.max(3, 8 - qs.length));
        const bank = shuffle(qs.map((q) => q.w).concat(distractors), rand);
        const keys = bank.map((_, i) => String.fromCharCode(65 + i));
        groups.push({
          type: 'summary_completion',
          instructions: `Complete the summary of paragraph ${A2I.letter(p)} using the list of words, ${keys[0]}–${keys[keys.length - 1]}, below.\nWrite the correct letter.`,
          summaryTitle: 'Paragraph ' + A2I.letter(p),
          options: bank.map((w, i) => ({ key: keys[i], text: w })),
          questions: qs.map((q) => ({ text: tidyStatement(q.s.text).replace(new RegExp('\\b' + q.w + '\\b'), '_____'), answer: keys[bank.indexOf(q.w)], acceptedAnswers: [q.w], explanation: `The missing word is “${q.w}” (${keys[bank.indexOf(q.w)]}).`, evidence: q.s.text, choices: [] })),
        });
        break;
      }
    }

    // IELTS order: matching first, then TFNG, MCQ, completion.
    const rank = { matching_information: 0, true_false_not_given: 1, multiple_choice: 2, sentence_completion: 3, summary_completion: 4 };
    groups.sort((a, b) => rank[a.type] - rank[b.type]);
    if (!groups.length) throw new Error('This article is too short to make questions from. Try a longer article.');

    return A2I.normalizeTest({
      title: article.title || 'Untitled passage',
      source: article.source,
      paragraphs: paras,
      vocabulary,
      questionGroups: groups,
      madeBy: 'basic',
    });
  };
})();
