# Article2IELTS

Turn any newspaper or magazine article (The Atlantic, The Guardian, The Economist…) into an
**IELTS Academic Reading test** you can practise in the browser.

- **Real IELTS question types**: True/False/Not Given, Yes/No/Not Given, multiple choice, matching headings,
  matching information, matching features, sentence/summary completion and short answer, with official-style instructions.
- **Highlighter**: select text in the passage and pick a colour, like underlining on the paper test. Highlights are saved.
- **Dictionary for each article**: key words are underlined. Click one to see its definition, example, synonyms and CEFR level.
  Double-click any other word to look it up in an online dictionary.
- **Translation** into Russian and 20 other languages (Settings → “Translate words to”): in the word pop-up, a
  **Translate** button for any selected sentence, in the Dictionary tab, flashcards and print-outs. Free, no key
  (Google Translate’s public endpoint, with MyMemory as a backup).
- **My words**: save words with the sentence they came from, quiz yourself, and export them as CSV for Anki or Quizlet.
- **Answer key**: score, an estimated band, the correct answers with explanations, and **Show in passage**,
  which highlights the sentence each answer comes from.
- 20-minute timer (can be changed in Settings), and answers are saved as you go.
- **Your highlights become vocabulary**: when you check your answers, the words and short phrases (up to 4 words) you
  highlighted are added to the test’s Dictionary with definitions.
- **Print** the test (passage with your highlights + questions with answer lines), the answer key, the dictionary, or all
  of them — or “Save as PDF” from the print window.

- **Account, dashboard and flashcards**: sign up to see your current band, band over time, strengths and weak
  question types with tips, and review your words with spaced-repetition flashcards.

## How to use

1. Open `index.html` in a browser, or publish the repo with GitHub Pages (Settings → Pages → Deploy from branch).
   Create an account (name, email, password). Accounts and all data are stored in this browser only — use
   **Save backup** to move them to another device.
2. Click **New test**, then **upload a file** (PDF, Word .docx, a web page saved with “Save page as…”, .txt,
   or a photo/screenshot of the article), **paste a link** to the article (or press Ctrl+V with a copied link),
   press **Ctrl+V** to paste a screenshot, or paste the text. Links are read through the free Jina Reader
   (r.jina.ai) or public CORS relays; paywalled articles may come back only partly.
   Screenshots of magazine pages with several columns are read column by column; paste more screenshots to add
   the next pages to the end. Reading a screenshot takes about 30 seconds per page.
3. Choose the question types and how to make the test:
   - **AI questions**: needs an API key, which you can paste right on the New test page. Each question type and the
     dictionary are written at the same time in separate requests, so a test usually takes seconds, not minutes;
     **Groq** is the fastest free service. **Google Gemini, Groq and OpenRouter keys are free**;
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

## Database for many users (optional)

Without a database, accounts and progress are stored in each visitor's browser. To let people log in from
any device and to manage everyone from the **Admin** page, connect a free [Supabase](https://supabase.com)
project (free plan: 50,000 monthly active users, 500 MB database):

1. Create an account and a new project at supabase.com (choose a region close to your users).
2. Open **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and press **Run**.
3. Open **Project Settings → API**, copy the **Project URL** and the **anon public** key into
   [`js/config.js`](js/config.js).
4. In **Authentication → URL Configuration**, set **Site URL** to the address of your site (e.g. your GitHub Pages URL),
   so confirmation and password-reset emails link back to it. You can turn off **Confirm email** under
   Authentication → Providers → Email if you don't want email confirmation.
5. Open the site and sign up. **The first account becomes the admin** and sees the **Admin** link in the menu.

What gets stored online: profile (name, email, level, target band), tests, answers and highlights, saved words and
flashcard progress, finished tests and settings. **API keys for AI services are never sent to the database.**
Every table uses Row Level Security, so users can only read and change their own data; admins use the checked
`admin_*` functions. The browser keeps a copy and syncs changes in the background, so the site stays fast and
keeps working if the connection drops for a while.

The **Admin** page shows the number of users, active users, tests finished and average band, new users and tests per
day, and a searchable, sortable list of users with their results, where you can view a user's tests, make or remove
admins, block or unblock, delete an account with all its data, and export the list as CSV.

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
| `js/dictionary.js` | Free word look-up (dictionaryapi.dev, Wiktionary, Google and Datamuse, with a time limit) |
| `js/translate.js` | Free translation of words and sentences |
| `js/print.js` | Printable test, answer key and dictionary |
| `js/generator.js` | Prompt and JSON schema, and calls to Claude, Gemini, Groq and OpenRouter |
| `js/offline.js` | Basic question maker that needs no AI or key |
| `js/fileimport.js` | Reading articles from PDF, Word, HTML and text files |
| `js/ocr.js` | Reading screenshots and photos: finds the columns, reads each one, fixes common misread letters |
| `js/words-en.js` | English word list (SCOWL) used to fix misread letters |
| `js/app.js` | Pages: test list, new test, test view, my words, settings |
| `js/views.js` | Sign up / log in, dashboard, flashcards |
| `js/admin.js` | Admin panel: statistics and user management |
| `js/config.js` | Database connection settings (Supabase URL and public key) |
| `js/cloud.js` | Online accounts and background sync with Supabase |
| `supabase/schema.sql` | Database tables, security rules and admin functions |
| `tests/` | Bundled tests |
