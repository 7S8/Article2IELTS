# Article2IELTS

Turn any newspaper or magazine article (The Atlantic, The Guardian, The Economist…) into an
**IELTS Academic Reading test** you can practise in the browser.

- **Real IELTS question types**: True/False/Not Given, Yes/No/Not Given, multiple choice, matching headings,
  matching information, matching features, sentence/summary completion and short answer, with official-style instructions.
- **Highlighter**: select text in the passage and pick a colour, like underlining on the paper test. Highlights are saved.
- **Dictionary for each article**: key words are underlined. Click one to see its definition, example, synonyms and CEFR level.
  Double-click any other word to look it up in an online dictionary.
- **My words**: save words with the sentence they came from, quiz yourself, and export them as CSV for Anki or Quizlet.
- **Answer key**: score, an estimated band, the correct answers with explanations, and **Show in passage**,
  which highlights the sentence each answer comes from.
- 20-minute timer (can be changed in Settings), and answers are saved as you go.

## How to use

1. Open `index.html` in a browser, or publish the repo with GitHub Pages (Settings → Pages → Deploy from branch).
2. Click **New test**, paste the article, choose the question types, then:
   - **With a Claude API key** (add it in Settings): click **Generate IELTS test**. The key is stored only in your
     browser and sent only to `api.anthropic.com`.
   - **Without a key**: open “No API key? Use Claude chat instead”, click **Copy prompt**, paste it into claude.ai,
     then paste Claude’s JSON reply back into the app.
3. Tests can be exported and imported as `.json` files.

A sample test (“Small Forests, Big Claims”) is included so you can try the app straight away.

## Adding tests to the repo

To add a bundled test, create `tests/<name>.js` in the same format as `tests/sample-tiny-forests.js` and add a
`<script>` tag for it in `index.html`. Full articles from newspapers are copyrighted, so only keep them in a
**private** repository, or use the in-browser generator, which keeps them on your own computer.

## Files

| Path | Contents |
| --- | --- |
| `index.html` | Page shell |
| `css/style.css` | Styles (light and dark mode) |
| `js/storage.js` | Saving to the browser, splitting paragraphs, checking test JSON |
| `js/passage.js` | Showing the passage with dictionary words, highlights and answer locations |
| `js/generator.js` | Prompt and JSON schema for Claude, and the API call |
| `js/app.js` | Pages: test list, new test, test view, my words, settings |
| `tests/` | Bundled tests |
