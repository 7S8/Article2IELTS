/* Rendering the reading passage: vocabulary marks, user highlights and
   answer evidence are all stored as character offsets into a paragraph's
   plain text, then layered on top of each other at render time. */
(function () {
  const A2I = (window.A2I = window.A2I || {});

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  A2I.esc = esc;

  function escRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* For each paragraph, find where glossary words appear.
     Returns [[{start, end, v}], ...] with no overlaps (longer terms win). */
  // Curly and straight apostrophes/quotes are treated as the same (same length, so positions stay valid).
  const flat = (t) => String(t).replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');

  /* Other forms a dictionary word may take in the text: seek → seeks, seeking, sought is not covered. */
  function forms(w) {
    if (/\s/.test(w)) return [w];
    const out = [w, w + 's', w + 'es', w + 'ed', w + 'd', w + 'ing', w + 'ly', w + 'er', w + 'ers'];
    if (/e$/.test(w)) out.push(w.slice(0, -1) + 'ing', w.slice(0, -1) + 'ion');
    if (/y$/.test(w)) out.push(w.slice(0, -1) + 'ies', w.slice(0, -1) + 'ied', w.slice(0, -1) + 'ily');
    if (/[^aeiou][aeiou][bdgklmnprt]$/.test(w)) out.push(w + w.slice(-1) + 'ed', w + w.slice(-1) + 'ing');
    if (A2I.lemmas) A2I.lemmas(w).forEach((l) => out.push(l));
    return out;
  }

  A2I.findVocab = function (paragraphs, vocabulary) {
    return paragraphs.map((rawText) => {
      const text = flat(rawText);
      const hits = [];
      vocabulary.forEach((v, vi) => {
        const base = [v.inText, v.word].filter(Boolean).map(flat);
        const terms = Array.from(new Set(base.concat(...base.map(forms)))).filter((t) => t.length > 2)
          .sort((a, b) => b.length - a.length);
        terms.forEach((term) => {
          const re = new RegExp('(^|[^\\p{L}\\p{N}])(' + escRe(term) + ')(?=$|[^\\p{L}\\p{N}])', 'giu');
          let m;
          while ((m = re.exec(text))) {
            const start = m.index + m[1].length;
            hits.push({ start, end: start + m[2].length, v: vi });
            re.lastIndex = start + m[2].length;
          }
        });
      });
      hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
      const out = [];
      let last = -1;
      for (const h of hits) {
        if (h.start >= last) {
          out.push(h);
          last = h.end;
        }
      }
      return out;
    });
  };

  /* Locate an evidence quote in the passage. Returns {p, start, end} or null. */
  A2I.findEvidence = function (paragraphs, quote) {
    const q = String(quote || '').replace(/\s+/g, ' ').replace(/^["“'‘]+|["”'’.…]+$/g, '').trim();
    if (q.length < 3) return null;
    const tries = [q];
    // Fall back to shorter chunks if the model slightly misquoted.
    if (q.length > 60) tries.push(q.slice(0, 60), q.slice(-60));
    if (q.length > 30) tries.push(q.slice(0, 30));
    for (const t of tries) {
      const lt = t.toLowerCase();
      for (let p = 0; p < paragraphs.length; p++) {
        const i = paragraphs[p].toLowerCase().indexOf(lt);
        if (i >= 0) {
          const end = t === q ? i + t.length : Math.min(paragraphs[p].length, i + q.length);
          return { p, start: i, end };
        }
      }
    }
    return null;
  };

  /* Build the HTML for one paragraph. */
  A2I.renderParagraphHTML = function (text, vocabHits, highlights, evidence) {
    const cuts = new Set([0, text.length]);
    vocabHits.forEach((h) => { cuts.add(h.start); cuts.add(h.end); });
    highlights.forEach((h) => { cuts.add(h.start); cuts.add(h.end); });
    if (evidence) { cuts.add(evidence.start); cuts.add(evidence.end); }
    const pts = Array.from(cuts).filter((x) => x >= 0 && x <= text.length).sort((a, b) => a - b);

    let html = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a === b) continue;
      let seg = esc(text.slice(a, b));
      const vh = vocabHits.find((h) => h.start <= a && h.end >= b);
      // Most recently added highlight wins where they overlap.
      let hl = null;
      for (let k = highlights.length - 1; k >= 0; k--) {
        if (highlights[k].start <= a && highlights[k].end >= b) { hl = highlights[k]; break; }
      }
      const ev = evidence && evidence.start <= a && evidence.end >= b;
      if (vh) seg = '<span class="vocab" data-v="' + vh.v + '">' + seg + '</span>';
      if (hl) seg = '<mark class="hl hl-' + esc(hl.color) + '" data-h="' + esc(hl.id) + '">' + seg + '</mark>';
      if (ev) seg = '<span class="evidence">' + seg + '</span>';
      html += seg;
    }
    return html;
  };

  /* Convert a DOM selection range inside a .ptext element to text offsets. */
  A2I.rangeToOffsets = function (container, range) {
    const pre = document.createRange();
    pre.selectNodeContents(container);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    let end;
    if (container.contains(range.endContainer)) {
      pre.setEnd(range.endContainer, range.endOffset);
      end = pre.toString().length;
    } else {
      end = container.textContent.length; // selection ran past this paragraph
    }
    return { start, end };
  };
})();
