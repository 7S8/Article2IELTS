/* Looking up English words online, free and without a key.
   Three sources are asked at the same time — dictionaryapi.dev, Wiktionary and Google —
   and the first useful answer wins. Each has a time limit, so a slow or
   unreachable service never leaves the page stuck on "Looking up…". */
(function () {
  const A2I = (window.A2I = window.A2I || {});

  const TIMEOUT_MS = 8000;
  const cache = {};

  /* Dictionary forms to try for an inflected word: "descendants" → "descendant". */
  A2I.lemmas = function (w) {
    const out = [w];
    if (/ies$/.test(w)) out.push(w.replace(/ies$/, 'y'));
    if (/es$/.test(w)) out.push(w.replace(/es$/, ''));
    if (/s$/.test(w) && !/ss$/.test(w)) out.push(w.replace(/s$/, ''));
    if (/ied$/.test(w)) out.push(w.replace(/ied$/, 'y'));
    if (/ed$/.test(w)) out.push(w.replace(/d$/, ''), w.replace(/ed$/, ''), w.replace(/(.)\1ed$/, '$1'));
    if (/ing$/.test(w)) out.push(w.replace(/ing$/, 'e'), w.replace(/ing$/, ''), w.replace(/(.)\1ing$/, '$1'));
    if (/ly$/.test(w)) out.push(w.replace(/ly$/, ''));
    return Array.from(new Set(out)).filter((x) => x.length > 1);
  };

  async function getJSON(url, signal) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    if (signal) signal.addEventListener('abort', onAbort);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  function stripHTML(html) {
    const d = document.createElement('div');
    d.innerHTML = String(html || '');
    return d.textContent.replace(/\s+/g, ' ').trim();
  }

  /* Both sources are turned into one shape:
     {word, phonetic, audio, meanings: [{partOfSpeech, synonyms, definitions: [{definition, example}]}]} */
  async function fromDictionaryApi(word, signal) {
    const data = await getJSON('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), signal);
    const e = Array.isArray(data) && data[0];
    if (!e || !e.meanings || !e.meanings.length) return null;
    return {
      word: e.word || word,
      phonetic: e.phonetic || ((e.phonetics || []).find((p) => p.text) || {}).text || '',
      audio: ((e.phonetics || []).find((p) => p.audio) || {}).audio || '',
      meanings: e.meanings.map((m) => ({
        partOfSpeech: m.partOfSpeech || '',
        synonyms: (m.synonyms || []).concat(...m.definitions.map((d) => d.synonyms || [])),
        definitions: m.definitions.map((d) => ({ definition: d.definition, example: d.example || '' })),
      })),
    };
  }

  async function fromWiktionary(word, signal) {
    const data = await getJSON('https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(word), signal);
    const en = data && data.en;
    if (!en || !en.length) return null;
    const meanings = en.map((m) => ({
      partOfSpeech: (m.partOfSpeech || '').toLowerCase(),
      synonyms: [],
      definitions: (m.definitions || [])
        .map((d) => ({ definition: stripHTML(d.definition), example: stripHTML((d.examples || [])[0] || '') }))
        .filter((d) => d.definition),
    })).filter((m) => m.definitions.length);
    return meanings.length ? { word, phonetic: '', audio: '', meanings } : null;
  }

  /* Google Translate's public endpoint also returns English definitions (dt=md). */
  async function fromGoogle(word, signal) {
    const data = await getJSON('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=en&dt=md&dt=ex&q=' + encodeURIComponent(word), signal);
    const defs = Array.isArray(data) && data[12];
    if (!Array.isArray(defs) || !defs.length) return null;
    const meanings = defs.map((m) => ({
      partOfSpeech: m[0] || '',
      synonyms: [],
      definitions: (m[1] || []).map((d) => ({ definition: d[0], example: d[2] ? String(d[2]).replace(/<\/?b>/g, '') : '' })).filter((d) => d.definition),
    })).filter((m) => m.definitions.length);
    return meanings.length ? { word, phonetic: '', audio: '', meanings } : null;
  }

  /* First non-empty answer from the sources, or null when none has one. */
  function firstAnswer(word, signal) {
    return new Promise((resolve) => {
      let pending = 3;
      const done = (r) => {
        if (r) { resolve(r); pending = -1; return; }
        if (--pending === 0) resolve(null);
      };
      fromDictionaryApi(word, signal).then(done, () => done(null));
      fromWiktionary(word, signal).then(done, () => done(null));
      fromGoogle(word, signal).then(done, () => done(null));
    });
  }

  /* Look a word or short phrase up. Resolves to an entry or null. */
  A2I.lookup = async function (text, signal) {
    const key = String(text || '').toLowerCase().replace(/[‘’]/g, "'").replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '').trim();
    if (!key) return null;
    if (key in cache) return cache[key];
    const forms = /\s/.test(key) ? [key] : A2I.lemmas(key).slice(0, 4);
    // All forms at once; the first form that has an answer wins.
    const pending = forms.map((f) => firstAnswer(f, signal));
    let found = null;
    for (const p of pending) {
      found = await p;
      if (found) break;
    }
    if (!(signal && signal.aborted)) cache[key] = found;
    return found;
  };

  /* The most useful single sense, for saving in a word list. */
  A2I.firstSense = function (entry, fallbackWord) {
    const m = (entry && entry.meanings[0]) || null;
    const d = m ? m.definitions[0] : null;
    return {
      word: entry ? entry.word : fallbackWord,
      partOfSpeech: m ? m.partOfSpeech : '',
      definition: d ? d.definition : '',
      example: d ? d.example : '',
      synonyms: m ? Array.from(new Set(m.synonyms)).slice(0, 5) : [],
    };
  };
})();
