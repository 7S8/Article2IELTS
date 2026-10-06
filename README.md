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
2. Click **New test**, then **upload a file** (PDF, Word .docx, a web page saved with “Save page as…”, .txt,
   or a photo/screenshot of the article) or paste the text.
3. Choose the question types and how to make the test:
   - **AI questions**: needs an API key, added in Settings. **Google Gemini, Groq and OpenRouter keys are free**;
     Claude gives the best questions but is paid. Keys are stored only in your browser and sent only to the service you choose.
   - **Basic questions — free, no key**: made instantly in your browser without AI (True/False, gap fills,
     word-bank summary, matching paragraphs, vocabulary). Simpler than the real test. Dictionary definitions come from
     the free [dictionaryapi.dev](https://dictionaryapi.dev).
   - **Claude chat — free, no key**: click **Copy prompt**, paste it into claude.ai (a free account works), and paste
     Claude’s answer back.
4. Everything is saved in your browser automatically. Use **Save backup** on the My tests page to download all your
   tests, answers, highlights and words to one file, and **Open backup** to restore them (also on another device).
   Single tests can be exported and imported as `.json` files.

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
| `js/storage.js` | Saving to the browser, backups, splitting paragraphs, checking test JSON |
| `js/passage.js` | Showing the passage with dictionary words, highlights and answer locations |
| `js/generator.js` | Prompt and JSON schema, and calls to Claude, Gemini, Groq and OpenRouter |
| `js/offline.js` | Basic question maker that needs no AI or key |
| `js/fileimport.js` | Reading articles from PDF, Word, HTML, text and image files |
| `js/app.js` | Pages: test list, new test, test view, my words, settings |
| `tests/` | Bundled tests |
