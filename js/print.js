/* Printing a test, its answer key and its dictionary on paper (or to PDF). */
(function () {
  const A2I = (window.A2I = window.A2I || {});

  const esc = (s) => A2I.esc(s == null ? '' : s);

  const STYLE = `
    @page { margin: 16mm 15mm; }
    * { box-sizing: border-box; }
    body { font: 11.5pt/1.55 Georgia, "Times New Roman", serif; color: #111; margin: 0; }
    h1 { font-size: 18pt; margin: 0 0 2pt; }
    h2 { font: 700 13pt system-ui, Arial, sans-serif; margin: 18pt 0 6pt; border-bottom: 1px solid #999; padding-bottom: 3pt; }
    h3 { font: 700 11pt system-ui, Arial, sans-serif; margin: 14pt 0 3pt; }
    .meta { color: #555; font: 9.5pt system-ui, Arial, sans-serif; margin-bottom: 10pt; }
    .para { display: flex; gap: 8pt; margin: 0 0 7pt; }
    .para b { width: 14pt; flex: none; font-family: system-ui, Arial, sans-serif; }
    .para p { margin: 0; text-align: justify; }
    mark { background: #fff0a0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .instr { white-space: pre-line; font: 9.5pt/1.45 system-ui, Arial, sans-serif; color: #333; margin-bottom: 6pt; }
    .opts { font: 10pt/1.45 system-ui, Arial, sans-serif; border: 1px solid #bbb; padding: 5pt 8pt; margin: 4pt 0 8pt; break-inside: avoid; }
    .opts div { margin: 1pt 0; }
    .q { margin: 6pt 0; break-inside: avoid; font-family: system-ui, Arial, sans-serif; font-size: 10.5pt; }
    .q .n { display: inline-block; min-width: 18pt; font-weight: 700; }
    .q .choices { margin: 2pt 0 0 18pt; }
    .q .tf { margin-left: 18pt; color: #444; font-size: 9.5pt; letter-spacing: .5pt; }
    .line { display: inline-block; min-width: 110pt; border-bottom: 1px solid #333; height: 1em; vertical-align: -2pt; }
    .center { text-align: center; font-weight: 700; margin: 6pt 0; }
    .key { width: 100%; border-collapse: collapse; font: 10pt/1.4 system-ui, Arial, sans-serif; }
    .key td, .key th { border-bottom: 1px solid #ccc; padding: 4pt 5pt; vertical-align: top; text-align: left; }
    .key .ok { color: #14652f; font-weight: 700; } .key .bad { color: #a31b14; font-weight: 700; }
    .score { font: 700 12pt system-ui, Arial, sans-serif; margin: 4pt 0 10pt; }
    .word { margin: 0 0 7pt; break-inside: avoid; font-size: 10.5pt; }
    .word .w { font-weight: 700; font-size: 11.5pt; }
    .word .pos { font-style: italic; color: #555; }
    .word .ex { font-style: italic; color: #444; }
    .word .tag { font: 8pt system-ui, Arial, sans-serif; border: 1px solid #999; border-radius: 3pt; padding: 0 3pt; margin-left: 4pt; }
    .dict { columns: 2; column-gap: 18pt; }
    .break { break-before: page; }
    .foot { margin-top: 14pt; color: #777; font: 8.5pt system-ui, Arial, sans-serif; }
  `;

  function passageHTML(test, progress, withHighlights) {
    return test.paragraphs.map((text, i) => {
      const hls = withHighlights ? progress.highlights.filter((h) => h.p === i) : [];
      let body = '';
      if (hls.length) {
        // Only plain marks for print: no dictionary underlines.
        const cuts = new Set([0, text.length]);
        hls.forEach((h) => { cuts.add(h.start); cuts.add(h.end); });
        const pts = Array.from(cuts).sort((a, b) => a - b);
        for (let k = 0; k < pts.length - 1; k++) {
          const seg = esc(text.slice(pts[k], pts[k + 1]));
          body += hls.some((h) => h.start <= pts[k] && h.end >= pts[k + 1]) ? '<mark>' + seg + '</mark>' : seg;
        }
      } else {
        body = esc(text);
      }
      return `<div class="para"><b>${A2I.letter(i)}</b><p>${body}</p></div>`;
    }).join('');
  }

  function range(g) {
    const a = g.questions[0].number;
    const b = g.questions[g.questions.length - 1].number;
    return a === b ? 'Question ' + a : 'Questions ' + a + '–' + b;
  }

  function questionsHTML(test) {
    return test.questionGroups.map((g) => {
      const tf = g.type === 'true_false_not_given' ? 'TRUE &nbsp; FALSE &nbsp; NOT GIVEN' : g.type === 'yes_no_not_given' ? 'YES &nbsp; NO &nbsp; NOT GIVEN' : '';
      const opts = g.options.length
        ? `<div class="opts">${g.type === 'matching_headings' ? '<div><i>List of Headings</i></div>' : ''}${g.options.map((o) => `<div><b>${esc(o.key)}</b>&nbsp; ${esc(o.text)}</div>`).join('')}</div>`
        : '';
      const qs = g.questions.map((q) => {
        let text = esc(q.text);
        if (/_{3,}/.test(q.text)) text = text.replace(/_{3,}/, '<span class="line"></span>');
        else if (!tf && !q.choices.length) text += ' <span class="line"></span>';
        return `<div class="q"><span class="n">${q.number}</span>${text}
          ${q.choices.length ? `<div class="choices">${q.choices.map((c) => `<div><b>${esc(c.key)}</b>&nbsp; ${esc(c.text)}</div>`).join('')}</div>` : ''}
          ${tf ? `<div class="tf">${tf} &nbsp; → <span class="line" style="min-width:70pt"></span></div>` : ''}</div>`;
      }).join('');
      const instr = g.instructions.replace(/^Questions?\s+\d+\s*[–-]?\s*\d*\s*\n?/i, '');
      return `<h3>${range(g)}</h3><div class="instr">${esc(instr)}</div>${opts}${g.summaryTitle ? `<div class="center">${esc(g.summaryTitle)}</div>` : ''}${qs}`;
    }).join('');
  }

  function answersHTML(test, progress, isCorrect) {
    const rows = [];
    let correct = 0;
    let total = 0;
    test.questionGroups.forEach((g) => g.questions.forEach((q) => {
      total++;
      const given = progress.answers[q.number] || '';
      const ok = progress.submitted && isCorrect(q, given);
      if (ok) correct++;
      const yours = progress.submitted ? `<td class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${esc(given || '—')}</td>` : '';
      rows.push(`<tr><td><b>${q.number}</b></td><td><b>${esc(q.answer)}</b>${q.acceptedAnswers.length ? `<br><span style="color:#666">also: ${q.acceptedAnswers.map(esc).join(', ')}</span>` : ''}</td>${yours}<td>${esc(q.explanation)}</td></tr>`);
    }));
    const score = progress.submitted && progress.lastScore
      ? `<div class="score">Your score: ${progress.lastScore.correct} / ${progress.lastScore.total} · estimated band ${esc(progress.lastScore.band)}</div>` : '';
    return `${score}<table class="key"><tr><th>#</th><th>Answer</th>${progress.submitted ? '<th>Yours</th>' : ''}<th>Why</th></tr>${rows.join('')}</table>`;
  }

  function dictionaryHTML(test) {
    if (!test.vocabulary.length) return '<p>This test has no dictionary words.</p>';
    const sorted = test.vocabulary.slice().sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0));
    return `<div class="dict">${sorted.map((v) => `<div class="word">
      <span class="w">${esc(v.word)}</span> ${v.partOfSpeech ? `<span class="pos">${esc(v.partOfSpeech)}</span>` : ''}${v.level ? `<span class="tag">${esc(v.level)}</span>` : ''}${v.mine ? '<span class="tag">my highlight</span>' : ''}
      <div>${esc(v.definition)}</div>
      ${v.translation ? `<div><span style="color:#666">${esc(A2I.languageName ? A2I.languageName(v.trLang) : v.trLang)}:</span> ${esc(v.translation)}</div>` : ''}
      ${v.example ? `<div class="ex">“${esc(v.example)}”</div>` : ''}
      ${v.synonyms && v.synonyms.length ? `<div><span style="color:#666">Synonyms:</span> ${v.synonyms.map(esc).join(', ')}</div>` : ''}
    </div>`).join('')}</div>`;
  }

  /* what: 'test' | 'answers' | 'dictionary' | 'all' */
  A2I.printTest = function (test, progress, what, isCorrect) {
    const head = `<h1>${esc(test.title)}</h1><div class="meta">${test.source ? esc(test.source) + ' · ' : ''}IELTS Academic Reading practice · ${A2I.questionCount(test)} questions · suggested time 20 minutes</div>`;
    const parts = [];
    if (what === 'test' || what === 'all') {
      parts.push(head + '<h2>Reading Passage</h2>' + passageHTML(test, progress, true));
      parts.push('<div class="break"></div><h2>Questions</h2>' + questionsHTML(test));
    }
    if (what === 'answers' || what === 'all') {
      parts.push((parts.length ? '<div class="break"></div>' : head) + '<h2>Answer key</h2>' + answersHTML(test, progress, isCorrect));
    }
    if (what === 'dictionary' || what === 'all') {
      parts.push((parts.length ? '<div class="break"></div>' : head) + `<h2>Dictionary (${test.vocabulary.length} words)</h2>` + dictionaryHTML(test));
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(test.title)}</title><style>${STYLE}</style></head>
      <body>${parts.join('')}<div class="foot">Made with Article2IELTS</div></body></html>`;

    // Print from a hidden frame so the page itself is not disturbed.
    const old = document.getElementById('print-frame');
    if (old) old.remove();
    const frame = document.createElement('iframe');
    frame.id = 'print-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }, 150);
    return html;
  };
})();
