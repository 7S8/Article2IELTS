/* Turning an article into an IELTS test with Claude.
   Runs entirely in the browser with the user's own API key. */
(function () {
  const A2I = (window.A2I = window.A2I || {});

  const SDK_URLS = A2I.SDK_URLS || [
    'https://esm.sh/@anthropic-ai/sdk@0.131.0',
    'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm',
  ];

  A2I.QUESTION_TYPES = [
    { id: 'true_false_not_given', label: 'True / False / Not Given', on: true },
    { id: 'yes_no_not_given', label: 'Yes / No / Not Given (writer’s views)', on: false },
    { id: 'multiple_choice', label: 'Multiple choice', on: true },
    { id: 'matching_headings', label: 'Matching headings', on: true },
    { id: 'matching_information', label: 'Matching information (which paragraph)', on: false },
    { id: 'matching_features', label: 'Matching features (people / ideas)', on: false },
    { id: 'sentence_completion', label: 'Sentence completion', on: false },
    { id: 'summary_completion', label: 'Summary completion', on: true },
    { id: 'short_answer', label: 'Short-answer questions', on: false },
  ];

  const SYSTEM_PROMPT = `You are a senior IELTS Academic Reading item writer. You turn a real article into one reading passage section that looks and feels exactly like an official IELTS Academic Reading test, plus a learner's glossary.

How real IELTS items work — follow these conventions closely:
- Questions paraphrase the passage; they rarely copy its wording. Test understanding, not word-spotting.
- TRUE/FALSE/NOT GIVEN tests factual information; YES/NO/NOT GIVEN tests the writer's views or claims. A NOT GIVEN statement must be genuinely unanswerable from the passage (plausible, on-topic, but neither confirmed nor contradicted). A FALSE statement must be directly contradicted. Mix the three answers; do not make them all the same.
- TFNG/YNNG, multiple choice, sentence completion, summary completion and short-answer questions follow the order of information in the passage. Matching tasks do not.
- Multiple choice: four options A–D, exactly one correct, with plausible distractors that use words from the passage but distort meaning.
- Matching headings: list more headings (roman numerals i, ii, iii...) than paragraphs being tested; headings express each paragraph's main idea, not a detail. Each question text is just "Paragraph X".
- Matching information: "Which paragraph contains the following information?" Options are the paragraph letters; a letter may be used more than once.
- Matching features: match statements to people, organisations or ideas named in the passage; options list them with capital letters.
- Completion and short-answer tasks: the instructions state a word limit, e.g. "Choose NO MORE THAN TWO WORDS from the passage for each answer." Answers must be copied exactly from the passage, fit the gap grammatically, and respect the limit. Mark each gap in the question text with "_____" (five underscores). If you give a word bank instead (summary completion with options A–H), the answer is the option letter.
- Instructions must use the official IELTS wording style, including the question range, e.g. "Questions 1–5\\nDo the following statements agree with the information given in Reading Passage 1?\\nWrite TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, NOT GIVEN if there is no information on this".

Answer key:
- "answer" is the single canonical answer: TRUE/FALSE/NOT GIVEN, YES/NO/NOT GIVEN, a choice letter, a roman numeral, a paragraph letter, or the exact word(s) from the passage.
- "acceptedAnswers" lists other acceptable forms (e.g. singular/plural variants, with/without an article) — empty if none.
- "explanation" explains in simple English why the answer is right and, where useful, why a tempting wrong answer is wrong. Address the learner directly.
- "evidence" is a verbatim quotation (copied character-for-character, 5–40 words) from the passage that supports the answer. For NOT GIVEN, quote the most closely related sentence.

Glossary:
- Choose 15–25 words or short phrases from the passage that an IELTS candidate at band 5.5–7 is likely not to know and that are worth learning (academic or topic vocabulary, collocations, phrasal verbs). Avoid proper nouns and very basic words.
- "inText" is the exact form as it appears in the passage (same inflection and spelling), "word" is the dictionary form.
- Definitions are short, learner-friendly, in the sense used in the passage. "example" is a new sentence (not from the passage). "level" is the CEFR level.

Number questions continuously from 1. Write everything in British English, as IELTS does.`;

  /* JSON schema for structured outputs. Every object lists all properties as
     required and disallows extras, as structured outputs requires. */
  const OPTION = {
    type: 'object',
    additionalProperties: false,
    required: ['key', 'text'],
    properties: { key: { type: 'string' }, text: { type: 'string' } },
  };

  const SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'vocabulary', 'questionGroups'],
    properties: {
      title: { type: 'string', description: 'Short passage title in the style of an IELTS passage.' },
      vocabulary: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['word', 'inText', 'partOfSpeech', 'definition', 'example', 'synonyms', 'level'],
          properties: {
            word: { type: 'string' },
            inText: { type: 'string' },
            partOfSpeech: { type: 'string' },
            definition: { type: 'string' },
            example: { type: 'string' },
            synonyms: { type: 'array', items: { type: 'string' } },
            level: { type: 'string', enum: ['B1', 'B2', 'C1', 'C2'] },
          },
        },
      },
      questionGroups: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'instructions', 'summaryTitle', 'options', 'questions'],
          properties: {
            type: { type: 'string', enum: A2I.QUESTION_TYPES.map((t) => t.id) },
            instructions: { type: 'string' },
            summaryTitle: { type: 'string', description: 'Title above a summary-completion text; empty string otherwise.' },
            options: {
              type: 'array',
              description: 'Shared option list (headings, features, word bank). Empty for TFNG/YNNG, multiple choice and gap-fill without a word bank.',
              items: OPTION,
            },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['number', 'text', 'choices', 'answer', 'acceptedAnswers', 'explanation', 'evidence'],
                properties: {
                  number: { type: 'integer' },
                  text: { type: 'string' },
                  choices: { type: 'array', description: 'A–D options for multiple choice only; empty otherwise.', items: OPTION },
                  answer: { type: 'string' },
                  acceptedAnswers: { type: 'array', items: { type: 'string' } },
                  explanation: { type: 'string' },
                  evidence: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  };

  function buildUserPrompt(article, opts) {
    const labelled = article.paragraphs.map((p, i) => A2I.letter(i) + '. ' + p).join('\n\n');
    const types = A2I.QUESTION_TYPES.filter((t) => opts.types.includes(t.id)).map((t) => '- ' + t.label).join('\n');
    return `Create an IELTS Academic Reading test from the article below.

Article title: ${article.title || '(none given — invent a suitable IELTS-style title)'}
${article.source ? 'Source: ' + article.source + '\n' : ''}
Requirements:
- Exactly ${opts.count} questions in total, with one question group per type, using these types:
${types}
- Target difficulty: ${opts.difficulty}.
- The paragraphs are already labelled with letters; refer to them by these letters.

<article>
${labelled}
</article>`;
  }

  A2I.buildChatPrompt = function (article, opts) {
    const skeleton = {
      title: 'string',
      vocabulary: [{ word: 'string', inText: 'string', partOfSpeech: 'string', definition: 'string', example: 'string', synonyms: ['string'], level: 'B1|B2|C1|C2' }],
      questionGroups: [{
        type: A2I.QUESTION_TYPES.map((t) => t.id).join('|'),
        instructions: 'string',
        summaryTitle: 'string',
        options: [{ key: 'string', text: 'string' }],
        questions: [{ number: 1, text: 'string', choices: [{ key: 'A', text: 'string' }], answer: 'string', acceptedAnswers: ['string'], explanation: 'string', evidence: 'verbatim quote' }],
      }],
    };
    return SYSTEM_PROMPT + '\n\n' + buildUserPrompt(article, opts) +
      '\n\nReply with ONLY one JSON object (no commentary, no code fences) in exactly this shape:\n' +
      JSON.stringify(skeleton, null, 2);
  };

  let sdkPromise = null;
  function loadSdk() {
    if (!sdkPromise) {
      sdkPromise = (async () => {
        let lastErr;
        for (const url of SDK_URLS) {
          try {
            return await import(url);
          } catch (e) {
            lastErr = e;
          }
        }
        sdkPromise = null;
        throw new Error('Could not load the Claude SDK from the CDN. Check your internet connection. (' + (lastErr && lastErr.message) + ')');
      })();
    }
    return sdkPromise;
  }

  /* Generate a test. onProgress(text) receives short status updates. */
  A2I.generateTest = async function (article, opts, settings, onProgress, signal) {
    const sdk = await loadSdk();
    const Anthropic = sdk.default;
    const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });

    onProgress('Claude is reading the article and planning questions…');
    let chars = 0;
    const stream = client.beta.messages.stream({
      model: settings.model,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(article, opts) }],
    }, { signal });

    stream.on('text', (delta) => {
      chars += delta.length;
      onProgress('Writing the test… ' + chars.toLocaleString() + ' characters');
    });

    let message;
    try {
      message = await stream.finalMessage();
    } catch (e) {
      throw friendlyError(sdk, e);
    }

    if (message.stop_reason === 'refusal') {
      throw new Error('Claude declined to process this article. Try a different article.');
    }
    if (message.stop_reason === 'max_tokens') {
      throw new Error('The response was cut off because the article is very long. Try a shorter article or fewer questions.');
    }
    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Claude returned data that could not be read as JSON. Please try again.');
    }
    return A2I.normalizeTest(data, { paragraphs: article.paragraphs, title: article.title, source: article.source });
  };

  function friendlyError(sdk, e) {
    if (e instanceof sdk.APIUserAbortError) return new Error('Generation cancelled.');
    if (e instanceof sdk.AuthenticationError) return new Error('Your API key was rejected. Check it in Settings.');
    if (e instanceof sdk.PermissionDeniedError) return new Error('This API key does not have access to that model. Try another model in Settings.');
    if (e instanceof sdk.NotFoundError) return new Error('Model not found. Choose another model in Settings.');
    if (e instanceof sdk.RateLimitError) return new Error('Rate limit or credit limit reached. Wait a moment, or check your billing at console.anthropic.com.');
    if (e instanceof sdk.BadRequestError) return new Error('The request was rejected: ' + e.message);
    if (e instanceof sdk.APIConnectionError) return new Error('Could not reach the Claude API. Check your connection and try again.');
    if (e instanceof sdk.APIError) return new Error('Claude API error (' + (e.status || '?') + '): ' + e.message);
    return e;
  }
})();
