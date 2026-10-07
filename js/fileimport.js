/* Reading an article from a file: PDF, Word (.docx), saved web page (.html),
   plain text / Markdown, or a photo/screenshot (OCR). Libraries for PDF, Word
   and OCR are loaded from a CDN only when needed. */
(function () {
  const A2I = (window.A2I = window.A2I || {});

  const LIBS = A2I.FILE_LIBS || {
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  };

  const loaded = {};
  function loadScript(url) {
    if (!loaded[url]) {
      loaded[url] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.onload = resolve;
        s.onerror = () => {
          delete loaded[url];
          reject(new Error('Could not download a helper library. Check your internet connection.'));
        };
        document.head.appendChild(s);
      });
    }
    return loaded[url];
  }

  function titleFromName(name) {
    return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ---------- HTML (e.g. "Save page as…" from The Atlantic) ---------- */

  function fromHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, noscript, nav, header, footer, aside, figure, figcaption, form, button, svg, iframe').forEach((n) => n.remove());
    const meta = (sel) => (doc.querySelector(sel) || {}).content || '';
    const root = doc.querySelector('article') || doc.querySelector('main') || doc.body;
    const h1 = root.querySelector('h1') || doc.querySelector('h1');
    const title = (h1 && h1.textContent.trim()) || meta('meta[property="og:title"]') || (doc.title || '').trim();
    const site = meta('meta[property="og:site_name"]');
    const author = meta('meta[name="author"]');
    let paras = Array.from(root.querySelectorAll('p'))
      .map((p) => p.textContent.replace(/\s+/g, ' ').trim())
      .filter((t) => A2I.wordCount(t) >= 8);
    if (paras.length < 3) {
      paras = (root.innerText || root.textContent || '').split(/\n\s*\n/).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
    }
    return { title, source: [site, author].filter(Boolean).join(' · '), text: paras.join('\n\n') };
  }

  /* ---------- PDF: rebuild paragraphs from line positions ---------- */

  async function fromPDF(buf, onProgress) {
    await loadScript(LIBS.pdf);
    const pdfjs = window.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const lines = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress('Reading PDF page ' + i + ' of ' + pdf.numPages + '…');
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let line = null;
      content.items.forEach((it) => {
        if (!it.str) return;
        const y = it.transform[5];
        const h = Math.abs(it.transform[3]) || it.height || 10;
        if (!line || Math.abs(line.y - y) > h * 0.5) {
          if (line) lines.push(line);
          line = { y, h, text: it.str, page: i };
        } else {
          line.text += (/\s$/.test(line.text) || /^\s/.test(it.str) ? '' : ' ') + it.str;
        }
      });
      if (line) lines.push(line);
      lines.push({ pageBreak: true });
    }

    // Typical gap between lines tells us where paragraphs break.
    const gaps = [];
    for (let i = 1; i < lines.length; i++) {
      const a = lines[i - 1];
      const b = lines[i];
      if (!a.pageBreak && !b.pageBreak) gaps.push(Math.abs(a.y - b.y));
    }
    gaps.sort((a, b) => a - b);
    const typical = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 14;

    // A full line is about as long as the 90th-percentile line.
    const lens = lines.filter((l) => !l.pageBreak).map((l) => l.text.length).sort((a, b) => a - b);
    const fullLine = lens[Math.floor(lens.length * 0.9)] || 80;

    const paras = [];
    let cur = '';
    let prev = null;
    for (const ln of lines) {
      if (ln.pageBreak) { prev = null; continue; }
      const text = ln.text.replace(/\s+/g, ' ').trim();
      if (!text || /^\d+$/.test(text)) continue; // skip page numbers
      const bigGap = prev && Math.abs(prev.y - ln.y) > typical * 1.45;
      // A short line ending a sentence usually ends a paragraph.
      const shortEnd = prev && /[.!?"”’]$/.test(prev.text.trim()) && prev.text.length < fullLine * 0.8;
      if (cur && (bigGap || shortEnd)) {
        paras.push(cur);
        cur = '';
      }
      if (cur.endsWith('-') && /^[a-z]/.test(text)) cur = cur.slice(0, -1) + text; // re-join hyphenated words
      else cur = cur ? cur + ' ' + text : text;
      prev = ln;
    }
    if (cur) paras.push(cur);
    return { title: '', source: '', text: paras.join('\n\n') };
  }

  /* ---------- Word ---------- */

  async function fromDOCX(buf) {
    await loadScript(LIBS.mammoth);
    const res = await window.mammoth.convertToHtml({ arrayBuffer: buf });
    const doc = new DOMParser().parseFromString(res.value, 'text/html');
    const h = doc.querySelector('h1, h2');
    const paras = Array.from(doc.querySelectorAll('p, li')).map((p) => p.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { title: h ? h.textContent.trim() : '', source: '', text: paras.join('\n\n') };
  }

  /* ---------- photo / screenshot: see ocr.js ---------- */

  A2I.loadScript = loadScript;
  A2I.articleFromHTML = fromHTML;

  /* ---------- article from a web link ----------
     Browsers may not read other websites directly, so the page is fetched
     through free services: Jina Reader first (it returns the clean article
     text), then two public relays that return the raw page. */

  const SITE_NAMES = {
    theatlantic: 'The Atlantic', theguardian: 'The Guardian', nytimes: 'The New York Times', economist: 'The Economist',
    newyorker: 'The New Yorker', washingtonpost: 'The Washington Post', bbc: 'BBC', wired: 'Wired', ft: 'Financial Times',
    scientificamerican: 'Scientific American', nationalgeographic: 'National Geographic', newscientist: 'New Scientist',
    vox: 'Vox', time: 'TIME', forbes: 'Forbes', bloomberg: 'Bloomberg', reuters: 'Reuters', aeon: 'Aeon', independent: 'The Independent',
  };

  const READER = A2I.URL_READER || 'https://r.jina.ai/';
  const RELAYS = A2I.URL_RELAYS || [
    (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  ];

  async function fetchText(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  /* Turn Jina Reader's Markdown into plain paragraphs. */
  function fromReaderMarkdown(md) {
    const title = (md.match(/^Title:\s*(.+)$/m) || [])[1] || '';
    const body = md.includes('Markdown Content:') ? md.split('Markdown Content:')[1] : md;
    const paras = body
      .replace(/\r/g, '')
      .split(/\n\s*\n/)
      .map((p) => p
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → their text
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-*+>]\s+/gm, '')
        .replace(/[*_`]{1,3}/g, '')
        .replace(/\s+/g, ' ')
        .trim())
      // Keep real prose: long enough, and not menus or captions.
      .filter((p) => A2I.wordCount(p) >= 12 && /[.!?"”’)]$/.test(p));
    return { title: title.trim(), source: '', text: paras.join('\n\n') };
  }

  A2I.readArticleURL = async function (url, onProgress) {
    onProgress = onProgress || function () {};
    url = String(url || '').trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    let host;
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { throw new Error('That does not look like a web address.'); }

    const tries = [
      { name: 'reader', run: async () => fromReaderMarkdown(await fetchText(READER + url, 30000)) },
    ].concat(RELAYS.map((relay, i) => ({ name: 'relay ' + (i + 1), run: async () => fromHTML(await fetchText(relay(url), 20000)) })));

    let best = null;
    for (const t of tries) {
      onProgress('Opening ' + host + '…' + (best ? ' (trying another way)' : ''));
      try {
        const out = await t.run();
        if (!best || A2I.wordCount(out.text) > A2I.wordCount(best.text)) best = out;
        if (A2I.wordCount(out.text) >= 250) break;
      } catch (e) { /* try the next way */ }
    }
    if (!best || A2I.wordCount(best.text) < 80) {
      throw new Error('Could not get the article from ' + host + '. The site may block this or need a subscription. Open the article in your browser and use “Save page as…”, a screenshot (Ctrl+V), or copy the text instead.');
    }
    const site = host.split('.').slice(-2, -1)[0] || host;
    best.source = best.source || SITE_NAMES[site] || site.charAt(0).toUpperCase() + site.slice(1);
    best.url = url;
    best.short = A2I.wordCount(best.text) < 250; // probably cut off by a paywall
    return best;
  };
  A2I.isImageFile = function (file) {
    return (file.type || '').startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name || '');
  };

  /* Read one file. Returns {title, source, text}. */
  A2I.readArticleFile = async function (file, onProgress) {
    onProgress = onProgress || function () {};
    const name = file.name || 'screenshot';
    const ext = (name.match(/\.([^.]+)$/) || [])[1];
    const type = file.type || '';
    let out;
    onProgress('Opening ' + name + '…');
    if (ext === 'pdf' || type === 'application/pdf') {
      out = await fromPDF(await file.arrayBuffer(), onProgress);
    } else if (ext === 'docx') {
      out = await fromDOCX(await file.arrayBuffer());
    } else if (ext === 'doc') {
      throw new Error('Old .doc files are not supported. In Word, use File → Save As → .docx, or save as PDF.');
    } else if (/^html?$|^xhtml$|^mht/.test(ext || '') || type === 'text/html') {
      out = fromHTML(await file.text());
    } else if (A2I.isImageFile(file)) {
      out = await A2I.ocrImage(file, onProgress);
    } else if (ext === 'json') {
      throw new Error('This looks like a test file. Use “Import .json” on the My tests page.');
    } else {
      const text = await file.text();
      out = /^\s*<(!doctype|html)/i.test(text) ? fromHTML(text) : { title: '', source: '', text };
    }
    out.text = (out.text || '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (A2I.wordCount(out.text) < 30 && A2I.isImageFile(file)) throw new Error('Could not read enough text from the image. Try a sharper or larger screenshot (zoom in on the page first).');
    if (A2I.wordCount(out.text) < 30) throw new Error('Could not find enough text in ' + name + '. If it is a scanned PDF, take a screenshot and upload the image instead.');
    if (!out.title) {
      // Use a short first line as the headline if there is one.
      const first = out.text.split('\n')[0];
      if (A2I.wordCount(first) <= 14 && !/[.!?]$/.test(first)) {
        out.title = first;
        out.text = out.text.slice(first.length).trim();
      } else {
        out.title = titleFromName(name);
      }
    }
    return out;
  };
})();
