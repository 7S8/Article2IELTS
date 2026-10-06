/* Reading article text from a photo or screenshot.
   Magazine pages have several columns, a headline, pull quotes and boxes.
   Reading the whole page at once mixes the columns together, so we first
   find the layout (recursive "XY-cut" on the blank space between blocks),
   then read each block separately, in reading order, with Tesseract. */
(function () {
  const A2I = (window.A2I = window.A2I || {});

  const TESS = A2I.OCR_LIBS || {
    script: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
    langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int',
  };

  /* ---------- image preparation ---------- */

  async function loadImage(blob) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(blob); } catch (e) { /* fall back below */ }
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not open that image.'));
      img.src = URL.createObjectURL(blob);
    });
  }

  /* Enlarge small screenshots (OCR needs letters ~30px tall), make grey,
     stretch the contrast. Returns {canvas, W, H, gray}. */
  function baseScale(img) {
    return Math.max(0.5, Math.min(3, 2400 / img.width));
  }

  function prepare(img, scale) {
    const w0 = img.width;
    const h0 = img.height;
    const W = Math.round(w0 * scale);
    const H = Math.round(h0 * scale);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H);
    const px = data.data;
    const gray = new Uint8ClampedArray(W * H);
    let lo = 255;
    let hi = 0;
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      gray[j] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    // Dark-mode screenshots: make text dark on light.
    let sum = 0;
    for (let j = 0; j < gray.length; j += 7) sum += gray[j];
    const invert = sum / Math.ceil(gray.length / 7) < 110;
    const range = Math.max(1, hi - lo);
    for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
      let g = ((gray[j] - lo) * 255) / range;
      if (invert) g = 255 - g;
      gray[j] = g;
      px[i] = px[i + 1] = px[i + 2] = g;
      px[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    return { canvas, W, H, gray, scale };
  }

  /* Black/white map using Otsu's threshold. */
  function binarize(gray) {
    const hist = new Array(256).fill(0);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
    const total = gray.length;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0;
    let wB = 0;
    let best = 0;
    let thr = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = t; }
    }
    const ink = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) ink[i] = gray[i] < thr ? 1 : 0;
    return ink;
  }

  /* Erase long straight lines (rules under headlines, box borders) so they
     don't hide the blank gaps between blocks. Text strokes are short. */
  function removeRules(ink, W, H) {
    const maxH = Math.max(60, W * 0.12);
    for (let y = 0; y < H; y++) {
      let start = -1;
      for (let x = 0; x <= W; x++) {
        const on = x < W && ink[y * W + x];
        if (on && start < 0) start = x;
        if (!on && start >= 0) {
          if (x - start > maxH) for (let k = start; k < x; k++) ink[y * W + k] = 0;
          start = -1;
        }
      }
    }
    const maxV = Math.max(60, H * 0.06);
    for (let x = 0; x < W; x++) {
      let start = -1;
      for (let y = 0; y <= H; y++) {
        const on = y < H && ink[y * W + x];
        if (on && start < 0) start = y;
        if (!on && start >= 0) {
          if (y - start > maxV) for (let k = start; k < y; k++) ink[k * W + x] = 0;
          start = -1;
        }
      }
    }
  }

  /* ---------- layout: recursive XY-cut ---------- */

  function layout(ink, W, H) {
    const leaves = [];

    function profileRows(r) {
      const p = new Int32Array(r.y1 - r.y0);
      for (let y = r.y0; y < r.y1; y++) {
        let c = 0;
        const row = y * W;
        for (let x = r.x0; x < r.x1; x++) c += ink[row + x];
        p[y - r.y0] = c;
      }
      return p;
    }
    function profileCols(r) {
      const p = new Int32Array(r.x1 - r.x0);
      for (let y = r.y0; y < r.y1; y++) {
        const row = y * W;
        for (let x = r.x0; x < r.x1; x++) p[x - r.x0] += ink[row + x];
      }
      return p;
    }
    // Shrink a region to the ink inside it.
    function trim(r) {
      const rows = profileRows(r);
      let a = 0;
      let b = rows.length - 1;
      while (a <= b && rows[a] === 0) a++;
      while (b >= a && rows[b] === 0) b--;
      if (a > b) return null;
      const r2 = { x0: r.x0, x1: r.x1, y0: r.y0 + a, y1: r.y0 + b + 1 };
      const cols = profileCols(r2);
      let c = 0;
      let d = cols.length - 1;
      while (c <= d && cols[c] === 0) c++;
      while (d >= c && cols[d] === 0) d--;
      return { x0: r.x0 + c, x1: r.x0 + d + 1, y0: r2.y0, y1: r2.y1 };
    }
    // Blank runs inside a profile (ignoring tiny specks of noise).
    function gaps(p, noise) {
      const out = [];
      let start = -1;
      for (let i = 0; i <= p.length; i++) {
        const blank = i < p.length && p[i] <= noise;
        if (blank && start < 0) start = i;
        if (!blank && start >= 0) {
          if (start > 0 && i < p.length) out.push({ a: start, b: i, len: i - start });
          start = -1;
        }
      }
      return out;
    }

    function cut(r, depth) {
      r = trim(r);
      if (!r) return;
      const w = r.x1 - r.x0;
      const h = r.y1 - r.y0;
      if (w < 8 || h < 8) return;
      if (depth > 14) { leaves.push(r); return; }

      // 1) Columns: a blank vertical strip running the full height.
      if (h > H * 0.05) {
        const cols = profileCols(r);
        const minGutter = Math.max(10, W * 0.012);
        const g = gaps(cols, Math.max(1, Math.floor(h * 0.002))).filter((x) => x.len >= minGutter);
        const parts = [];
        let from = 0;
        g.forEach((x) => {
          const mid = Math.round((x.a + x.b) / 2);
          if (mid - from >= W * 0.06 && w - mid >= W * 0.06) { parts.push([from, mid]); from = mid; }
        });
        if (parts.length) {
          parts.push([from, w]);
          parts.forEach(([a, b]) => cut({ x0: r.x0 + a, x1: r.x0 + b, y0: r.y0, y1: r.y1 }, depth + 1));
          return;
        }
      }

      // 2) Rows: a blank horizontal band clearly bigger than the line spacing.
      const rows = profileRows(r);
      const g = gaps(rows, Math.max(0, Math.floor(w * 0.002)));
      if (g.length) {
        const lens = g.map((x) => x.len).sort((a, b) => a - b);
        const median = lens[Math.floor(lens.length / 2)];
        const big = g.filter((x) => x.len >= Math.max(median * 2.2, H * 0.012));
        if (big.length) {
          let from = 0;
          big.forEach((x) => {
            const mid = Math.round((x.a + x.b) / 2);
            cut({ x0: r.x0, x1: r.x1, y0: r.y0 + from, y1: r.y0 + mid }, depth + 1);
            from = mid;
          });
          cut({ x0: r.x0, x1: r.x1, y0: r.y0 + from, y1: r.y1 }, depth + 1);
          return;
        }
      }
      leaves.push(r);
    }

    cut({ x0: 0, y0: 0, x1: W, y1: H }, 0);
    return leaves;
  }

  /* ---------- turning lines into text ---------- */

  function capsShare(s) {
    const letters = s.replace(/[^A-Za-z]/g, '');
    if (!letters.length) return 0;
    return letters.replace(/[^A-Z]/g, '').length / letters.length;
  }

  function titleCase(s) {
    const small = /^(a|an|and|as|at|but|by|for|in|of|on|or|the|to|vs?|via|with)$/i;
    return s.toLowerCase().split(/\s+/).map((w, i) => (i > 0 && small.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  }

  function cleanLine(t) {
    return t
      .replace(/[|¦]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const SOFT = '\u00AD';

  function joinText(a, b) {
    if (!a) return b;
    // Hyphen at a line end: mark it, decide later with the dictionary whether
    // it splits one word ("optimiza-tion") or joins two ("potassium-maxxing").
    if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + SOFT + b;
    if (/[—–]$/.test(a)) return a + b;
    return a + ' ' + b;
  }

  /* Sentence-case small-caps openings: "I’VE COME TO believe" → "I’ve come to believe". */
  function fixParagraphStart(p) {
    p = p.replace(/^[1l|](['’](?:ve|m|ll|d)\b)/i, 'I$1'); // "1've" → "I've"
    // Drop cap read as a separate letter: "Y ou have" → "You have".
    p = p.replace(/^([B-HJ-Z])\s+([a-z])/, '$1$2');
    p = p.replace(/^((?:[A-Z][A-Z’']*[,]?\s+){1,6})(?=[a-z])/, (m) => {
      const s = m.toLowerCase();
      return s.charAt(0).toUpperCase() + s.slice(1).replace(/\bi(’|'|\b)/g, 'I$1');
    });
    return p;
  }

  /* Turn OCR'd blocks into {title, source, text}. */
  function assemble(blocks) {
    blocks.forEach((b) => {
      const text = b.lines.map((l) => l.text).join(' ').trim();
      b.text = text;
      b.words = A2I.wordCount(text);
      b.avgH = b.lines.reduce((s, l) => s + l.h, 0) / Math.max(1, b.lines.length);
      b.caps = capsShare(text);
      // ALL-CAPS lines have no descenders, so their boxes look smaller.
      b.size = b.caps > 0.75 ? b.avgH * 1.35 : b.avgH;
    });
    const sizes = blocks.filter((b) => b.words >= 25).map((b) => b.avgH).sort((a, b) => a - b);
    const bodyH = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 30;

    // Display text: short blocks that are larger than body text or in capitals.
    const isDisplay = (b) => b.words <= 25 && (b.caps > 0.75 || b.size >= bodyH * 1.25);
    const firstBodyTop = Math.min(...blocks.filter((b) => b.words >= 25 && !isDisplay(b)).map((b) => b.y0).concat([Infinity]));

    let title = '';
    let source = '';
    const header = blocks.filter((b) => b.lines.length && b.y0 < Math.max(firstBodyTop + bodyH, blocks.pageH * 0.4) && isDisplay(b));
    const byline = blocks.find((b) => /^by\s+[A-Z]/i.test(b.text) && b.words <= 7 && b.y0 < blocks.pageH * 0.4);
    if (byline) source = titleCase(byline.text).replace(/^by\b/i, 'By');
    const titleBlock = header.filter((b) => b !== byline && b.words >= 2).sort((a, b) => b.size - a.size)[0];
    if (titleBlock) title = capsShare(titleBlock.text) > 0.75 ? titleCase(titleBlock.text) : titleBlock.text;

    const body = blocks.filter((b) => {
      if (!b.lines.length || header.includes(b) || b === byline) return false;
      if (isDisplay(b)) return false; // pull quotes, labels, captions in capitals
      if (b.words <= 2 && !/[.!?,]$/.test(b.text)) return false; // page numbers, stray marks
      return true;
    });

    // Rebuild paragraphs: a new paragraph starts on an indented line, after a
    // short line that ends a sentence, or after extra space in the same column.
    // Text runs on from the bottom of one column to the top of the next.
    const paras = [];
    let cur = '';
    const ends = (t) => /[.!?:"”’)]$/.test(t);
    const endsLoose = (t) => /[.,!?:;"”’)]$/.test(t);
    const close = () => {
      if (!cur) return;
      paras.push(fixParagraphStart(cur.replace(/,$/, '.'))); // OCR often reads a full stop as a comma
      cur = '';
    };
    body.forEach((b, bi) => {
      const charW = Math.max(4, b.avgH * 0.45);
      const xs = b.lines.map((l) => l.x0).sort((p, q) => p - q);
      const left = xs[Math.floor(xs.length / 4)] || b.x0; // usual left edge (ignores indents and drop caps)
      const prevBlock = body[bi - 1];
      const sameColumn = prevBlock && Math.abs(prevBlock.x0 - b.x0) < charW * 3 && b.y0 > prevBlock.y1;
      b.lines.forEach((l, li) => {
        const t = l.text;
        if (!t) return;
        const indent = l.x0 - left;
        const indented = indent > charW * 1.3 && indent < (b.x1 - b.x0) * 0.25;
        const prev = li > 0 ? b.lines[li - 1] : null;
        const prevShort = prev && prev.x1 < b.x1 - charW * 4;
        if (cur && ((indented && endsLoose(cur)) || (prevShort && ends(cur)) || (li === 0 && sameColumn && endsLoose(cur)))) close();
        cur = joinText(cur, t);
      });
    });
    close();
    return { title, source, text: paras.join('\n\n') };
  }

  /* ---------- reading the same block at several sizes ---------- */

  const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');

  /* Align the words of other readings to the first one and take a vote.
     Different image sizes make different mistakes, so the majority is
     usually right. Ties go to the more confident reading. */
  function vote(runs) {
    const base = runs[0];
    const cands = base.map((w) => [w]);
    runs.slice(1).forEach((other) => {
      const n = base.length;
      const m = other.length;
      if (!n || !m || n * m > 4e6) return;
      // Longest common subsequence on normalised words.
      const dp = new Uint16Array((n + 1) * (m + 1));
      for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
          dp[i * (m + 1) + j] = norm(base[i].text) === norm(other[j].text)
            ? dp[(i + 1) * (m + 1) + j + 1] + 1
            : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1]);
        }
      }
      let i = 0;
      let j = 0;
      let gi = 0;
      let gj = 0;
      const flushGap = () => {
        // Equal-length gaps: pair the words one to one.
        if (i - gi === j - gj) for (let k = 0; k < i - gi; k++) cands[gi + k].push(other[gj + k]);
      };
      while (i < n && j < m) {
        if (norm(base[i].text) === norm(other[j].text)) {
          flushGap();
          cands[i].push(other[j]);
          i++; j++;
          gi = i; gj = j;
        } else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) i++;
        else j++;
      }
      i = n; j = m;
      flushGap();
    });
    return base.map((w, k) => {
      const tally = {};
      cands[k].forEach((c) => {
        const t = tally[c.text] || (tally[c.text] = { text: c.text, n: 0, conf: 0 });
        t.n++;
        t.conf = Math.max(t.conf, c.confidence);
      });
      const best = Object.values(tally).sort((a, b) => b.n - a.n || b.conf - a.conf)[0];
      return Object.assign({}, w, { text: best.text });
    });
  }

  function linesOf(res) {
    const lines = [];
    (res.data.blocks || []).forEach((bl) => bl.paragraphs.forEach((p) => p.lines.forEach((l) => {
      if (l.confidence < 15 || !cleanLine(l.text)) return;
      lines.push({
        x0: l.bbox.x0, x1: l.bbox.x1, y0: l.bbox.y0, y1: l.bbox.y1, h: l.bbox.y1 - l.bbox.y0,
        words: l.words.map((w) => ({ text: cleanLine(w.text), confidence: w.confidence })).filter((w) => w.text),
      });
    })));
    return lines.sort((a, b) => a.y0 - b.y0);
  }

  /* ---------- fixing misread letters ---------- */

  // Letters OCR commonly mixes up, especially in small screenshots.
  const CONFUSIONS = [['c', 'e'], ['e', 'c'], ['r', 't'], ['t', 'r'], ['e', 't'], ['l', 'i'], ['i', 'l'], ['l', 't'], ['t', 'l'],
    ['f', 't'], ['t', 'f'], ['rn', 'm'], ['m', 'rn'], ['cl', 'd'], ['d', 'cl'], ['d', 'tl'], ['li', 'h'], ['h', 'li'], ['h', 'b'],
    ['b', 'h'], ['ii', 'u'], ['vv', 'w'], ['0', 'o'], ['1', 'l'], ['1', 'i'], ['5', 's'], ['n', 'u'], ['u', 'n'], ['a', 'e'], ['o', 'c']];

  let dict = null;
  async function loadDict() {
    if (!dict) {
      await A2I.loadScript(A2I.WORDS_URL || 'js/words-en.js');
      dict = new Map();
      (window.A2I_WORDS || '').split('\n').forEach((w, i) => dict.set(w, i));
    }
    return dict;
  }

  function edits(w) {
    const out = new Set();
    CONFUSIONS.forEach(([a, b]) => {
      let i = w.indexOf(a);
      while (i >= 0) {
        out.add(w.slice(0, i) + b + w.slice(i + a.length));
        i = w.indexOf(a, i + 1);
      }
    });
    return out;
  }

  /* Best dictionary word within two look-alike edits, or null. */
  function bestFix(w) {
    let best = null;
    const one = edits(w);
    const consider = (c, penalty) => {
      const r = dict.get(c);
      if (r != null && (!best || r + penalty < best.r)) best = { w: c, r: r + penalty };
    };
    one.forEach((c) => consider(c, 0));
    if (!best && w.length > 4) one.forEach((c) => edits(c).forEach((c2) => consider(c2, 20000)));
    return best;
  }

  function matchCase(fixed, original) {
    if (original === original.toUpperCase()) return fixed.toUpperCase();
    if (original[0] === original[0].toUpperCase()) return fixed[0].toUpperCase() + fixed.slice(1);
    return fixed;
  }

  function fixWord(core, sentenceStart) {
    const lower = core.toLowerCase();
    if (lower.length < 2 || !/[a-z]/.test(lower)) return core;
    const capital = core[0] !== lower[0];
    if (capital && !sentenceStart && dict.get(lower) == null) return core; // probably a name
    if (core.length > 1 && core.slice(1) !== lower.slice(1)) return core; // ACRONYM or MixedCase
    const rank = dict.get(lower);
    if (rank != null) {
      // A rare word that is one slip away from a very common one ("bur" → "but").
      if (rank > 40000) {
        const f = bestFix(lower);
        if (f && f.r < 1500) return matchCase(f.w, core);
      }
      return core;
    }
    const f = bestFix(lower);
    return f ? matchCase(f.w, core) : core;
  }

  function resolveHyphens(text) {
    return text.replace(new RegExp('([A-Za-z]+)' + SOFT + '([A-Za-z]+)', 'g'), (m, l, r) => {
      const joined = (l + r).toLowerCase();
      const isWord = (w) => dict && dict.get(w.toLowerCase()) != null;
      // The second part is a word in its own right, or used elsewhere in the article ("-maxxing").
      const rightUsed = isWord(r) || new RegExp('(^|[^A-Za-z])' + r + '([^A-Za-z]|$)', 'i').test(text.replace(m, ''));
      if (dict && !isWord(joined) && isWord(l) && l.length > 2 && rightUsed) return l + '-' + r;
      return l + r;
    });
  }

  function correctText(text) {
    return text.split('\n\n').map((para) => {
      let start = true;
      return para.split(' ').map((tok) => {
        const m = tok.match(/^([^A-Za-z0-9]*)([A-Za-z0-9][A-Za-z0-9'’-]*[A-Za-z0-9]|[A-Za-z0-9])([^A-Za-z0-9]*)$/);
        let out = tok;
        if (m) {
          const fixed = m[2].split('-').map((part) => {
            const [w, ...rest] = part.split(/(?=['’])/); // keep "it’s" endings
            return fixWord(w, start) + rest.join('');
          }).join('-');
          out = m[1] + fixed + m[3];
        }
        start = /[.!?]["”’)]*$/.test(tok);
        return out;
      }).join(' ')
        .replace(/([a-z]) 10 (?=[a-z])/g, '$1 to '); // "come 10 believe" → "come to believe"
    }).join('\n\n');
  }

  /* ---------- main ---------- */

  /* Several readers run side by side: one per spare CPU core (up to 4). */
  const POOL_SIZE = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  let poolPromise = null;
  function getWorkers(onProgress) {
    if (!poolPromise) {
      poolPromise = (async () => {
        await A2I.loadScript(TESS.script);
        onProgress('Downloading the text reader (first time only)…');
        const make = async () => {
          const w = await window.Tesseract.createWorker('eng', 1, {
            workerPath: TESS.workerPath,
            corePath: TESS.corePath,
            langPath: TESS.langPath,
          });
          await w.setParameters({ tessedit_pageseg_mode: '6' });
          return w;
        };
        const first = await make(); // the first one downloads and caches the language data
        const rest = await Promise.all(Array.from({ length: POOL_SIZE - 1 }, make).map((p) => p.catch(() => null)));
        return [first].concat(rest.filter(Boolean));
      })().catch((e) => {
        poolPromise = null;
        throw e;
      });
    }
    return poolPromise;
  }

  /* Run tasks (async functions that take a worker) on all workers at once. */
  async function runPool(workers, tasks, onEach) {
    let next = 0;
    await Promise.all(workers.map(async (w) => {
      while (next < tasks.length) {
        const t = tasks[next++];
        await t(w);
        if (onEach) onEach();
      }
    }));
  }

  A2I.ocrImage = async function (blob, onProgress) {
    onProgress = onProgress || function () {};
    onProgress('Preparing the image…');
    const dictReady = loadDict().catch(() => null); // spelling fixes are optional
    const img = await loadImage(blob);
    const s0 = baseScale(img);
    const main = prepare(img, s0);
    const { canvas, W, H } = main;
    const ink = binarize(main.gray);
    removeRules(ink, W, H);
    let leaves = layout(ink, W, H);
    if (!leaves.length) throw new Error('No text found in the image.');
    if (leaves.length > 80) leaves = [{ x0: 0, y0: 0, x1: W, y1: H }]; // very busy image: read it whole
    // Extra readings at other sizes for the vote (skipped for huge photos).
    const extra = [s0 * 0.83, s0 * 1.33].filter((sc) => img.width * sc <= 4200).map((sc) => prepare(img, sc));
    const images = [main].concat(extra);

    const workers = await getWorkers(onProgress);
    const pad = Math.round(Math.min(12, W * 0.004));
    const rectFor = (r, k) => {
      const x0 = Math.max(0, r.x0 - pad) * k;
      const y0 = Math.max(0, r.y0 - pad) * k;
      return { left: Math.round(x0), top: Math.round(y0), width: Math.round(Math.min(W, r.x1 + pad) * k - x0), height: Math.round(Math.min(H, r.y1 + pad) * k - y0) };
    };

    // Every block × every size is one task; biggest blocks first so no worker is left waiting at the end.
    const readings = leaves.map(() => []);
    const order = leaves.map((r, i) => i).sort((a, b) => (leaves[b].x1 - leaves[b].x0) * (leaves[b].y1 - leaves[b].y0) - (leaves[a].x1 - leaves[a].x0) * (leaves[a].y1 - leaves[a].y0));
    const tasks = [];
    order.forEach((i) => images.forEach((im, k) => tasks.push(async (w) => {
      readings[i][k] = linesOf(await w.recognize(im.canvas, { rectangle: rectFor(leaves[i], im.scale / s0) }, { blocks: true }));
    })));
    let finished = 0;
    onProgress('Reading the text… 0%');
    await runPool(workers, tasks, () => { finished++; onProgress('Reading the text… ' + Math.round((finished / tasks.length) * 100) + '%'); });

    const blocks = [];
    blocks.pageH = H;
    const capTasks = [];
    leaves.forEach((r, i) => {
      const lines = readings[i][0] || [];
      if (lines.length && images.length > 1) {
        const voted = vote(readings[i].map((ls) => (ls || []).flatMap((l) => l.words)));
        let n = 0;
        lines.forEach((l) => { l.words = voted.slice(n, n + l.words.length); n += l.words.length; });
      }
      lines.forEach((l) => { l.text = l.words.map((w) => w.text).join(' '); });
      // A large first letter (drop cap) is often missed: read it on its own.
      const first = lines[0];
      if (first && /^[a-z]/.test(first.text) && first.x0 - r.x0 > first.h * 2) {
        capTasks.push(async (w) => {
          await w.setParameters({ tessedit_pageseg_mode: '10' });
          const capRes = await w.recognize(canvas, { rectangle: {
            left: Math.max(0, r.x0 - pad), top: Math.max(0, r.y0 - pad),
            width: first.x0 - r.x0, height: Math.min(r.y1 - r.y0, first.h * 5) + pad,
          } });
          await w.setParameters({ tessedit_pageseg_mode: '6' });
          const ch = (capRes.data.text || '').trim().replace(/^[^A-Za-z]+/, '').charAt(0);
          if (/[A-Za-z]/.test(ch)) first.text = ch.toUpperCase() + first.text;
        });
      }
      blocks.push({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1, lines });
    });
    if (capTasks.length) await runPool(workers, capTasks);
    blocks.forEach((b) => { b.lines = b.lines.filter((l) => l.text); });

    const out = assemble(blocks);
    await dictReady;
    out.text = resolveHyphens(out.text);
    if (dict) out.text = correctText(out.text);
    return out;
  };
})();
