/* Article2IELTS — © 2026 Nuramatova Sakinat Ibnuabasovna. All rights reserved. */
/* Home page for visitors who are not logged in: what the site does,
   a live preview of a test, how it works, and the sign-up buttons. */
(function () {
  const A2I = (window.A2I = window.A2I || {});

  const PREVIEW = `
    <div class="lp-window" aria-hidden="true">
      <div class="lp-chrome"><i></i><i></i><i></i><span>Article2IELTS — The Atlantic · “Small Forests, Big Claims”</span></div>
      <div class="lp-split">
        <div class="lp-passage">
          <div class="lp-ptitle">Small Forests, Big Claims</div>
          <div class="para"><span class="letter">A</span><p class="ptext">On a narrow strip of land beside a motorway, a dense
            <span class="vocab lp-target">thicket</span> now rises well above head height. Projects like this have spread from Japan to
            India and Britain. <mark class="hl hl-yellow lp-sweep">Their supporters describe them as a quick and affordable way</mark> to bring nature back into crowded cities.</p></div>
          <div class="para"><span class="letter">B</span><p class="ptext">The approach is usually traced to Akira Miyawaki, a
            <span class="vocab">botanist</span> who argued that many parks were <span class="vocab">dominated</span> by species poorly suited to local conditions.</p></div>
          <div class="lp-pop">
            <div><b class="lp-w">thicket</b> <i class="muted">noun</i> <span class="badge">C2</span></div>
            <div>a group of bushes or small trees growing very closely together</div>
            <div class="tr"><span class="tr-lang">Русский:</span> заросли, чаща</div>
          </div>
        </div>
        <div class="lp-questions">
          <div class="lp-qhead">Questions 1–3 · TRUE / FALSE / NOT GIVEN</div>
          <div class="lp-q"><span class="num">1</span> Small forests are considered an expensive option.
            <div class="tfng"><button>TRUE</button><button class="picked lp-pick">FALSE</button><button>NOT GIVEN</button></div></div>
          <div class="lp-q"><span class="num">2</span> Miyawaki trained most of today’s volunteers.
            <div class="tfng"><button>TRUE</button><button>FALSE</button><button class="picked">NOT GIVEN</button></div></div>
          <div class="lp-result"><b>Score 12 / 13</b> · estimated band <b>8.5</b><span class="good">✓ Show in passage</span></div>
        </div>
      </div>
    </div>`;

  const DEMO_WORDS = {
    thicket: ['noun', 'a group of bushes or small trees growing very closely together', 'заросли, чаща'],
    native: ['adjective', 'growing naturally in a place, not brought from somewhere else', 'местный, коренной'],
    affordable: ['adjective', 'cheap enough for people to be able to pay for it', 'доступный (по цене)'],
    crowded: ['adjective', 'full of people', 'переполненный, многолюдный'],
  };

  A2I.renderLanding = function (app) {
    app.innerHTML = `
      <div class="landing">
        <section class="lp-hero">
          <div class="lp-copy">
            <span class="lp-kicker">IELTS Academic Reading practice</span>
            <h1>Turn any <span class="lp-rotate" id="lp-rotate">article</span> into a real IELTS Reading test</h1>
            <p class="lp-lead">Paste a link from The Atlantic, The Guardian or The Economist, upload a PDF or a screenshot —
              and get an IELTS-style passage with real question types, an answer key, a dictionary with translation
              and flashcards. Practise with what you actually want to read.</p>
            <div class="row">
              <a class="btn primary lp-cta" href="#/signup">Start free</a>
              <button type="button" class="btn lp-cta" id="lp-try">Try it now ↓</button>
            </div>
            <p class="muted small">Free · no card · works on phone and computer</p>
          </div>
          ${PREVIEW}
        </section>

        <section class="lp-sources">
          <span class="muted small">Practise with articles from</span>
          <div class="lp-logos"><span>The Atlantic</span><span>The Guardian</span><span>The Economist</span><span>BBC</span><span>New Scientist</span><span>Scientific American</span><span>National Geographic</span></div>
        </section>

        <section class="lp-stats">
          <div><b data-count="9">9</b><span>IELTS question types</span></div>
          <div><b data-count="21">21</b><span>translation languages</span></div>
          <div><b data-count="20">20</b><span>minute exam timer</span></div>
          <div><b>0</b><span>cost — free to use</span></div>
        </section>

        <section class="lp-section" id="try">
          <h2>Try it now — no sign-up</h2>
          <p class="muted lp-sub">Read the short passage and answer three questions. Click the <span class="vocab">dotted words</span> to see what they mean.</p>
          <div class="lp-demo">
            <div class="lp-demo-text">
              <div class="lp-ptitle">Small Forests, Big Claims</div>
              <p class="lp-dp" id="lp-dp">On a narrow strip of land beside a motorway junction, a dense <span class="vocab" data-w="thicket">thicket</span> now rises well above head height.
                <span data-ev="1">It is barely the size of a tennis court, yet it contains several dozen species of <span class="vocab" data-w="native">native</span> trees and shrubs.</span>
                <span data-ev="2">Projects like this have spread from Japan to India, the Netherlands, Britain and beyond over the past two decades.</span>
                <span data-ev="3">Their supporters describe them as a quick and <span class="vocab" data-w="affordable">affordable</span> way to bring nature back into <span class="vocab" data-w="crowded">crowded</span> cities.</span>
                Their critics are not so sure.</p>
              <div class="lp-wordbox" id="lp-wordbox" hidden></div>
            </div>
            <div class="lp-demo-qs">
              <div class="lp-qhead">Do the statements agree with the passage? <span class="muted">TRUE / FALSE / NOT GIVEN</span></div>
              ${[
                ['Each small forest is larger than a tennis court.', 'FALSE', 1, 'The passage says it is “barely the size of a tennis court” — so it is not larger. The statement contradicts the text.'],
                ['Projects like this can now be found in India.', 'TRUE', 2, '“Projects like this have spread from Japan to India…” — the same information in different words.'],
                ['Most of these forests are paid for by local councils.', 'NOT GIVEN', 3, 'The passage says the forests are “affordable”, but never says who pays for them. No information → NOT GIVEN.'],
              ].map(([q, a, ev, why], i) => `
                <div class="lp-dq" data-answer="${a}" data-ev="${ev}" data-why="${why.replace(/"/g, '&quot;')}">
                  <div><span class="num">${i + 1}</span>${q}</div>
                  <div class="tfng">${['TRUE', 'FALSE', 'NOT GIVEN'].map((o) => `<button type="button" data-v="${o}">${o}</button>`).join('')}</div>
                  <div class="lp-why" hidden></div>
                </div>`).join('')}
              <button class="btn primary" id="lp-check" disabled>Check answers</button>
              <div class="lp-demo-result" id="lp-demo-result" hidden></div>
            </div>
          </div>
        </section>

        <section class="lp-section">
          <h2>How it works</h2>
          <div class="lp-steps">
            <div class="lp-step"><span class="lp-n">1</span><h3>Add an article</h3>
              <p>Paste a link, upload a PDF, Word file or saved web page, or press <kbd>Ctrl</kbd>+<kbd>V</kbd> with a screenshot —
              even magazine pages with several columns are read in the right order.</p></div>
            <div class="lp-step"><span class="lp-n">2</span><h3>Get a real IELTS test</h3>
              <p>True/False/Not Given, matching headings, multiple choice, summary and sentence completion — with official-style
              instructions, a 20-minute timer and an estimated band score.</p></div>
            <div class="lp-step"><span class="lp-n">3</span><h3>Learn from every mistake</h3>
              <p>See exactly where each answer is in the text, read the explanation, and keep new words with definitions,
              translation and spaced-repetition flashcards.</p></div>
          </div>
        </section>

        <section class="lp-section">
          <h2>Everything you need for Reading</h2>
          <div class="lp-features">
            <div class="lp-f"><span>🖍️</span><h3>Highlighter</h3><p>Underline key words like on the paper test. Your highlights become vocabulary.</p></div>
            <div class="lp-f"><span>📖</span><h3>Built-in dictionary</h3><p>Click any word for its meaning, example, synonyms, level and pronunciation.</p></div>
            <div class="lp-f"><span>🌍</span><h3>Translation</h3><p>Words and whole sentences in Russian, Kazakh, Uzbek, Ukrainian and 17 more languages.</p></div>
            <div class="lp-f"><span>🎯</span><h3>Answer key</h3><p>Score, band estimate, explanations and “Show in passage” for every question.</p></div>
            <div class="lp-f"><span>🃏</span><h3>Flashcards</h3><p>Words come back just before you forget them — 1, 2, 4, 8, 16 days.</p></div>
            <div class="lp-f"><span>📈</span><h3>Progress dashboard</h3><p>Your band over time, strong and weak question types, and what to practise next.</p></div>
            <div class="lp-f"><span>🖨️</span><h3>Print or PDF</h3><p>Print the test, the answer key or your dictionary and practise on paper.</p></div>
            <div class="lp-f"><span>☁️</span><h3>On every device</h3><p>Your tests, words and results are saved to your account.</p></div>
          </div>
        </section>

        <section class="lp-section lp-faq">
          <h2>Questions</h2>
          <details><summary>Is it really free?</summary><p>Yes. Making tests, the dictionary, translation, flashcards and the dashboard are free.
            For the best AI-written questions you can paste a free key from Google Gemini or Groq — or use the built-in
            question maker and the Claude chat option, which need no key at all.</p></details>
          <details><summary>Which articles can I use?</summary><p>Any English text: a link to a news site, a PDF, a Word file, a saved web page,
            or a screenshot of a magazine page (several columns are read in the right order). Articles of 600–1,000 words
            work best — that is the length of a real IELTS passage.</p></details>
          <details><summary>Are the questions like the real IELTS?</summary><p>They follow the official Academic Reading formats and
            instructions: True/False/Not Given, Yes/No/Not Given, matching headings and information, multiple choice, summary,
            sentence completion and short answers, with an estimated band score at the end.</p></details>
          <details><summary>Can I use it on my phone?</summary><p>Yes — the site works in any modern browser on phone, tablet and computer,
            and your account keeps everything in sync.</p></details>
          <details><summary>Is my data safe?</summary><p>Only you can see your tests, words and results. AI keys stay in your own browser
            and are never sent to our database.</p></details>
        </section>

        <section class="lp-section lp-final">
          <h2>Ready for your next article?</h2>
          <p class="muted">Create a free account and make your first test in a minute. A sample passage is waiting for you inside.</p>
          <div class="row" style="justify-content:center"><a class="btn primary lp-cta" href="#/signup">Start free</a></div>
        </section>
        <footer class="lp-foot muted small">Article2IELTS by <b>Nuramatova Sakinat Ibnuabasovna</b> · practice tool, not affiliated with IELTS, the British Council, IDP or Cambridge.</footer>
      </div>`;

    app.querySelector('#lp-try').addEventListener('click', () => app.querySelector('#try').scrollIntoView({ behavior: 'smooth' }));

    // Rotating word in the headline.
    const words = ['article', 'news story', 'PDF', 'screenshot', 'blog post', 'magazine page'];
    const rot = app.querySelector('#lp-rotate');
    let wi = 0;
    const timer = setInterval(() => {
      if (!document.body.contains(rot)) { clearInterval(timer); return; }
      wi = (wi + 1) % words.length;
      rot.classList.remove('in');
      void rot.offsetWidth;
      rot.textContent = words[wi];
      rot.classList.add('in');
    }, 2200);

    // Click a dotted word.
    const box = app.querySelector('#lp-wordbox');
    app.querySelector('#lp-dp').addEventListener('click', (e) => {
      const w = e.target.closest('[data-w]');
      if (!w) return;
      const [pos, def, ru] = DEMO_WORDS[w.dataset.w];
      box.hidden = false;
      box.innerHTML = `<b class="lp-w">${w.dataset.w}</b> <i class="muted">${pos}</i> <button type="button" class="lp-say" title="Listen">🔊</button>
        <div>${def}</div><div class="tr"><span class="tr-lang">Русский:</span> ${ru}</div>`;
      box.querySelector('.lp-say').onclick = () => { try { const u = new SpeechSynthesisUtterance(w.dataset.w); u.lang = 'en-GB'; speechSynthesis.speak(u); } catch (err) { /* no speech */ } };
    });

    // The mini test.
    const qs = Array.from(app.querySelectorAll('.lp-dq'));
    const check = app.querySelector('#lp-check');
    const answers = {};
    qs.forEach((q, i) => q.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
      if (check.dataset.done) return;
      answers[i] = b.dataset.v;
      q.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('picked', x === b));
      check.disabled = Object.keys(answers).length < qs.length;
    })));
    check.addEventListener('click', () => {
      check.dataset.done = '1';
      let score = 0;
      qs.forEach((q, i) => {
        const ok = answers[i] === q.dataset.answer;
        if (ok) score++;
        q.classList.add(ok ? 'right' : 'wrong');
        const why = q.querySelector('.lp-why');
        why.hidden = false;
        why.innerHTML = `${ok ? '✓ Correct' : '✗ Answer: <b>' + q.dataset.answer + '</b>'} — ${q.dataset.why} <button type="button" class="lp-loc">Show in passage</button>`;
        why.querySelector('.lp-loc').onclick = () => {
          app.querySelectorAll('#lp-dp [data-ev]').forEach((s2) => s2.classList.toggle('evidence', s2.dataset.ev === q.dataset.ev));
        };
      });
      check.hidden = true;
      const res = app.querySelector('#lp-demo-result');
      res.hidden = false;
      res.innerHTML = `<b>${score} / 3</b> — ${score === 3 ? 'excellent! You are ready for a full passage.' : 'NOT GIVEN is the trickiest answer in IELTS — that is exactly what practice is for.'}
        <div class="row" style="margin-top:10px"><a class="btn primary" href="#/signup">Make a test from your own article</a></div>`;
    });
  };
})();
