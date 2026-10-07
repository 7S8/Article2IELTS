/* Exporting saved words for Quizlet, Anki and others.
   Quizlet takes pasted text (word TAB definition, one card per line) on its website,
   and .docx / .pdf files in its phone app, so both are offered. */
(function () {
  const A2I = (window.A2I = window.A2I || {});

  function clean(s) {
    return String(s || '').replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  // Back of the card: "(noun) definition — перевод".
  function back(w) {
    const parts = [];
    if (w.partOfSpeech) parts.push('(' + clean(w.partOfSpeech) + ')');
    if (w.definition) parts.push(clean(w.definition));
    let s = parts.join(' ');
    if (w.translation) s += (s ? ' — ' : '') + clean(w.translation);
    return s || '—';
  }

  // word<TAB>definition, one card per line: Quizlet's and Anki's import format.
  function cardsText(words) {
    return words.map((w) => clean(w.word) + '\t' + back(w)).join('\n');
  }

  /* ---------- a minimal .docx (a Word table), built in the browser ---------- */

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // Zip with no compression ("stored"), which every zip reader accepts.
  function zip(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const [name, text] of files) {
      const nameB = enc.encode(name);
      const data = enc.encode(text);
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(8, 0, true); // stored
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, nameB.length, true);
      chunks.push(new Uint8Array(local.buffer), nameB, data);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, data.length, true);
      cen.setUint32(24, data.length, true);
      cen.setUint16(28, nameB.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), nameB);
      offset += 30 + nameB.length + data.length;
    }
    const cenSize = central.reduce((n, c) => n + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cenSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)],
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  function x(s) {
    return clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function cell(text, bold, width) {
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p><w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}` +
      `<w:t xml:space="preserve">${x(text)}</w:t></w:r></w:p></w:tc>`;
  }

  function docx(words, title) {
    const rows = [['Term', 'Definition']].concat(words.map((w) => [w.word, back(w)]))
      .map((r, i) => `<w:tr>${cell(r[0], true, 2800)}${cell(r[1], i === 0, 6200)}</w:tr>`).join('');
    const border = (s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/>`;
    const body = `<w:p><w:pPr><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr>` +
      `<w:t xml:space="preserve">${x(title)}</w:t></w:r></w:p>` +
      `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders></w:tblPr>` +
      `<w:tblGrid><w:gridCol w:w="2800"/><w:gridCol w:w="6200"/></w:tblGrid>${rows}</w:tbl><w:p/>`;
    return zip([
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
      ['word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body +
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>' +
        '</w:body></w:document>'],
    ]);
  }

  function csv(words) {
    const q = (s) => '"' + String(s || '').replace(/"/g, '""') + '"';
    return 'word,part of speech,definition,translation,example,synonyms,context\n' + words.map((w) =>
      [w.word, w.partOfSpeech, w.definition, w.translation, w.example, (w.synonyms || []).join('; '), w.context].map(q).join(',')).join('\n');
  }

  A2I.wordsExport = { cardsText, docx, csv };
})();
