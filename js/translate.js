/* Free translation of words and sentences, no key needed.
   Google Translate's public endpoint first (it also gives several meanings
   for single words), MyMemory as a backup. */
(function () {
  const A2I = (window.A2I = window.A2I || {});

  A2I.LANGUAGES = [
    ['ru', 'Русский'], ['uk', 'Українська'], ['kk', 'Қазақша'], ['uz', 'Oʻzbekcha'], ['ky', 'Кыргызча'],
    ['az', 'Azərbaycanca'], ['tg', 'Тоҷикӣ'], ['tr', 'Türkçe'], ['ar', 'العربية'], ['fa', 'فارسی'],
    ['zh-CN', '中文'], ['ja', '日本語'], ['ko', '한국어'], ['hi', 'हिन्दी'], ['vi', 'Tiếng Việt'],
    ['es', 'Español'], ['pt', 'Português'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'], ['pl', 'Polski'],
  ];

  A2I.languageName = function (code) {
    const l = A2I.LANGUAGES.find(([c]) => c === code);
    return l ? l[1] : code;
  };

  const cache = {};
  const TIMEOUT_MS = 8000;

  async function getJSON(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function viaGoogle(text, to) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' + encodeURIComponent(to) +
      '&dt=t&dt=bd&q=' + encodeURIComponent(text);
    const data = await getJSON(url);
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
    const main = data[0].map((seg) => (seg && seg[0]) || '').join('');
    // data[1]: dictionary meanings for single words: [[partOfSpeech, [term, term, ...]], ...]
    const meanings = Array.isArray(data[1])
      ? data[1].map((d) => ({ pos: d[0] || '', terms: (d[1] || []).slice(0, 5) })).filter((d) => d.terms.length)
      : [];
    return main ? { text: main, meanings } : null;
  }

  async function viaMyMemory(text, to) {
    const url = 'https://api.mymemory.translated.net/get?langpair=en|' + encodeURIComponent(to.split('-')[0]) + '&q=' + encodeURIComponent(text.slice(0, 480));
    const data = await getJSON(url);
    const t = data && data.responseData && data.responseData.translatedText;
    if (!t || /MYMEMORY WARNING|INVALID/i.test(t)) return null;
    return { text: t, meanings: [] };
  }

  /* Translate English text. Resolves to {text, meanings:[{pos, terms}]} or null. */
  A2I.translate = async function (text, to) {
    text = String(text || '').trim();
    if (!text || !to) return null;
    const key = to + '|' + text;
    if (key in cache) return cache[key];
    const out = (await viaGoogle(text, to)) || (await viaMyMemory(text, to));
    if (out) cache[key] = out;
    return out;
  };

  /* Translate many short items (e.g. a word list) in one request where possible. */
  A2I.translateMany = async function (items, to) {
    const result = new Array(items.length).fill(null);
    const todo = [];
    items.forEach((t, i) => {
      const k = to + '|' + t;
      if (k in cache) result[i] = cache[k];
      else todo.push(i);
    });
    // Up to ~40 items per request, one per line.
    for (let s = 0; s < todo.length; s += 40) {
      const chunk = todo.slice(s, s + 40);
      const joined = await viaGoogle(chunk.map((i) => items[i]).join('\n'), to);
      const lines = joined ? joined.text.split('\n') : [];
      if (lines.length === chunk.length) {
        chunk.forEach((i, j) => { result[i] = { text: lines[j].trim(), meanings: [] }; cache[to + '|' + items[i]] = result[i]; });
      } else {
        // Fall back to one by one (few at a time).
        for (const i of chunk) result[i] = await A2I.translate(items[i], to);
      }
    }
    return result;
  };

  /* Short one-line text: "ищущий, поиск" for a word, or the full sentence translation. */
  A2I.translationLine = function (tr) {
    if (!tr) return '';
    if (tr.meanings && tr.meanings.length) {
      return tr.meanings.slice(0, 2).map((m) => (m.pos ? m.pos + ': ' : '') + m.terms.slice(0, 4).join(', ')).join(' · ');
    }
    return tr.text;
  };
})();
