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

  A2I.renderLanding = function (app) {
    app.innerHTML = `
      <div class="landing">
        <section class="lp-hero">
          <div class="lp-copy">
            <span class="lp-kicker">IELTS Academic Reading practice</span>
            <h1>Turn any article into a real IELTS Reading test</h1>
            <p class="lp-lead">Paste a link from The Atlantic, The Guardian or The Economist, upload a PDF or a screenshot —
              and get an IELTS-style passage with real question types, an answer key, a dictionary with translation
              and flashcards. Practise with what you actually want to read.</p>
            <div class="row">
              <a class="btn primary lp-cta" href="#/signup">Start free</a>
              <a class="btn lp-cta" href="#/login">Log in</a>
            </div>
            <p class="muted small">Free · no card · works on phone and computer</p>
          </div>
          ${PREVIEW}
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

        <section class="lp-section lp-final">
          <h2>Ready for your next article?</h2>
          <p class="muted">Create a free account and make your first test in a minute. A sample passage is waiting for you inside.</p>
          <div class="row" style="justify-content:center"><a class="btn primary lp-cta" href="#/signup">Start free</a></div>
        </section>
        <footer class="lp-foot muted small">Article2IELTS · practice tool, not affiliated with IELTS, the British Council, IDP or Cambridge.</footer>
      </div>`;
  };
})();
