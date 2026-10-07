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

  function jsonInstructions() {
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
    return 'Reply with ONLY one JSON object (no commentary, no code fences) in exactly this shape:\n' + JSON.stringify(skeleton, null, 2);
  }

  A2I.buildChatPrompt = function (article, opts) {
    return SYSTEM_PROMPT + '\n\n' + buildUserPrompt(article, opts) + '\n\n' + jsonInstructions();
  };

  /* AI services the app can use. "free" ones have a no-cost tier but still need a (free) key. */
  A2I.PROVIDERS = {
    claude: { label: 'Claude (Anthropic) — best questions, paid', keyUrl: 'https://console.anthropic.com/settings/keys' },
    gemini: { label: 'Google Gemini — free key', keyUrl: 'https://aistudio.google.com/apikey', model: 'gemini-2.5-flash' },
    groq: { label: 'Groq — free key, fastest', keyUrl: 'https://console.groq.com/keys', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
    openrouter: { label: 'OpenRouter — free models, free key (often slow)', keyUrl: 'https://openrouter.ai/keys', base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free' },
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

  /* ---------- generating the test in parallel parts ----------
     Each question type and the glossary are asked for in separate, smaller
     requests that all run at the same time, so the wait is roughly the time of
     the slowest single part instead of one long answer. */

  const QSCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['questionGroups'],
    properties: { questionGroups: SCHEMA.properties.questionGroups },
  };
  const VSCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'vocabulary'],
    properties: { title: SCHEMA.properties.title, vocabulary: SCHEMA.properties.vocabulary },
  };

  function articleBlock(article) {
    const labelled = article.paragraphs.map((p, i) => A2I.letter(i) + '. ' + p).join('\n\n');
    return `Article title: ${article.title || '(none given)'}\n${article.source ? 'Source: ' + article.source + '\n' : ''}\n<article>\n${labelled}\n</article>`;
  }

  function splitCount(total, n) {
    return Array.from({ length: n }, (_, i) => Math.floor(total / n) + (i < total % n ? 1 : 0));
  }

  function partPrompts(article, opts) {
    const types = A2I.QUESTION_TYPES.filter((t) => opts.types.includes(t.id));
    const counts = splitCount(opts.count, types.length);
    const parts = types.map((t, i) => ({
      kind: 'questions',
      label: t.label,
      schema: QSCHEMA,
      shape: '{"questionGroups": [ ...exactly one group... ]}',
      user: `${articleBlock(article)}

Write ONE question group of type "${t.id}" (${t.label}) with exactly ${Math.max(1, counts[i])} questions for this article, as in a real IELTS Academic Reading test.
- Target difficulty: ${opts.difficulty}.
- The paragraphs are labelled with letters; refer to them by these letters.
- Number the questions from 1 (they will be renumbered later).
- Do not write a glossary; only the question group.`,
    }));
    parts.push({
      kind: 'vocab',
      label: 'dictionary',
      schema: VSCHEMA,
      shape: '{"title": "...", "vocabulary": [ ... ]}',
      user: `${articleBlock(article)}

Give this passage a short IELTS-style title${article.title ? ' (you may keep the article title)' : ''}, and write the learner's glossary for it. Do not write any questions.`,
    });
    return parts;
  }

  function shapeHint(part) {
    const skeleton = part.kind === 'vocab'
      ? { title: 'string', vocabulary: [{ word: 'string', inText: 'string', partOfSpeech: 'string', definition: 'string', example: 'string', synonyms: ['string'], level: 'B1|B2|C1|C2' }] }
      : { questionGroups: [{ type: 'string', instructions: 'string', summaryTitle: 'string', options: [{ key: 'string', text: 'string' }], questions: [{ number: 1, text: 'string', choices: [{ key: 'A', text: 'string' }], answer: 'string', acceptedAnswers: ['string'], explanation: 'string', evidence: 'verbatim quote' }] }] };
    return 'Reply with ONLY one JSON object (no commentary, no code fences) in exactly this shape:\n' + JSON.stringify(skeleton, null, 2);
  }

  function parseJSON(text, who) {
    const m = String(text || '').match(/\{[\s\S]*\}/);
    if (!m) throw new Error(who + ' returned no JSON.');
    try {
      return JSON.parse(m[0]);
    } catch (e) {
      throw new Error(who + ' returned JSON that could not be read.');
    }
  }

  /* Generate a test with the AI service chosen in Settings.
     onProgress(text) receives short status updates. */
  A2I.generateTest = async function (article, opts, settings, onProgress, signal) {
    const provider = settings.provider || 'claude';
    const key = (settings.keys || {})[provider];
    const model = (settings.models || {})[provider] || (A2I.PROVIDERS[provider] || {}).model;
    const fast = settings.speed !== 'best';
    if (!key) throw new Error('Add your ' + A2I.PROVIDERS[provider].label.split(' —')[0] + ' API key first.');

    const call = provider === 'claude' ? await claudeCaller(key, model || 'claude-opus-5-5', fast)
      : provider === 'gemini' ? geminiCaller(key, model, fast)
        : openAICaller(A2I.PROVIDERS[provider].base, key, model);
    const who = A2I.PROVIDERS[provider].label.split(' —')[0];

    const parts = partPrompts(article, opts);
    let done = 0;
    const started = Date.now();
    const tick = () => onProgress(`${who} is writing the test — ${done} of ${parts.length} parts ready (${Math.round((Date.now() - started) / 1000)}s)`);
    tick();
    const timer = setInterval(tick, 1000);
    let results;
    try {
      // Claude and Gemini take all parts at once; free Groq/OpenRouter plans get 3 at a time.
      const limit = provider === 'claude' || provider === 'gemini' ? parts.length : 3;
      results = new Array(parts.length);
      let next = 0;
      const lane = async () => {
        while (next < parts.length) {
          const i = next++;
          try {
            results[i] = { status: 'fulfilled', value: await call(parts[i], signal) };
          } catch (e) {
            results[i] = { status: 'rejected', reason: e };
          }
          done++;
          tick();
        }
      };
      await Promise.all(Array.from({ length: Math.min(limit, parts.length) }, lane));
    } finally {
      clearInterval(timer);
    }
    if (signal && signal.aborted) throw new Error('Generation cancelled.');

    const groups = [];
    let title = '';
    let vocabulary = [];
    const errors = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') { errors.push(r.reason); return; }
      if (parts[i].kind === 'vocab') {
        title = r.value.title || '';
        vocabulary = r.value.vocabulary || [];
      } else {
        (r.value.questionGroups || []).forEach((g) => groups.push(g));
      }
    });
    if (!groups.length) throw errors[0] || new Error(who + ' did not return any questions.');
    if (errors.length) onProgress('Some parts failed; showing the rest.');
    return A2I.normalizeTest({ title: article.title || title, vocabulary, questionGroups: groups },
      { paragraphs: article.paragraphs, title: article.title, source: article.source });
  };

  async function claudeCaller(apiKey, model, fast) {
    const sdk = await loadSdk();
    const client = new sdk.default({ apiKey, dangerouslyAllowBrowser: true });
    return async (part, signal) => {
      const stream = client.beta.messages.stream({
        model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: fast ? 'low' : 'high', format: { type: 'json_schema', schema: part.schema } },
        // The system prompt is the same for every part, so it is cached after the first request.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: part.user }],
      }, { signal });
      let message;
      try {
        message = await stream.finalMessage();
      } catch (e) {
        throw friendlyError(sdk, e);
      }
      if (message.stop_reason === 'refusal') throw new Error('Claude declined to process this article. Try a different article.');
      if (message.stop_reason === 'max_tokens') throw new Error('Claude’s answer was cut off. Try fewer questions.');
      return parseJSON(message.content.filter((b) => b.type === 'text').map((b) => b.text).join(''), 'Claude');
    };
  }

  function geminiCaller(key, model, fast) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
    let thinkingOff = fast; // "thinking" makes Gemini much slower; skip it in Fast mode when the model allows
    return async (part, signal) => {
      const body = () => ({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: part.user + '\n\n' + shapeHint(part) }] }],
        generationConfig: Object.assign({ responseMimeType: 'application/json', maxOutputTokens: 16384 },
          thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      });
      let data;
      try {
        data = await postJSON(url, {}, body(), signal, 'Gemini');
      } catch (e) {
        if (!thinkingOff || !/error 400/.test(e.message)) throw e;
        thinkingOff = false; // this model cannot switch thinking off
        data = await postJSON(url, {}, body(), signal, 'Gemini');
      }
      const cand = (data.candidates || [])[0];
      if (!cand) throw new Error('Gemini did not return an answer' + (data.promptFeedback && data.promptFeedback.blockReason ? ' (blocked: ' + data.promptFeedback.blockReason + ')' : '') + '.');
      if (cand.finishReason === 'MAX_TOKENS') throw new Error('Gemini’s answer was cut off. Try fewer questions.');
      return parseJSON(((cand.content && cand.content.parts) || []).filter((p) => !p.thought).map((p) => p.text || '').join(''), 'Gemini');
    };
  }

  function openAICaller(base, key, model) {
    const who = /groq/.test(base) ? 'Groq' : /openrouter/.test(base) ? 'OpenRouter' : 'The AI service';
    let jsonMode = true;
    return async (part, signal) => {
      const body = () => Object.assign({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: part.user + '\n\n' + shapeHint(part) },
        ],
        max_tokens: 8000,
      }, jsonMode ? { response_format: { type: 'json_object' } } : {});
      const headers = { authorization: 'Bearer ' + key };
      let data;
      try {
        data = await postJSON(base + '/chat/completions', headers, body(), signal, who);
      } catch (e) {
        // Some free models do not support JSON mode; retry once without it.
        if (!jsonMode || !/error 400/.test(e.message)) throw e;
        jsonMode = false;
        data = await postJSON(base + '/chat/completions', headers, body(), signal, who);
      }
      const choice = (data.choices || [])[0];
      if (!choice) throw new Error(who + ' did not return an answer.');
      if (choice.finish_reason === 'length') throw new Error(who + '’s answer was cut off. Try fewer questions.');
      return parseJSON(choice.message.content || '', who);
    };
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function postJSON(url, headers, body, signal, who) {
    let res;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(url, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers), body: JSON.stringify(body), signal });
      } catch (e) {
        if (signal && signal.aborted) throw new Error('Generation cancelled.');
        throw new Error('Could not reach ' + who + '. Check your connection and try again.');
      }
      // Free plans limit requests per minute: wait a little and try again.
      if ((res.status === 429 || res.status === 503) && attempt < 3) {
        const wait = Number(res.headers.get('retry-after')) || 2 + attempt * 3;
        await sleep(Math.min(20, wait) * 1000);
        continue;
      }
      break;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data.error && (data.error.message || data.error)) || res.statusText;
      if (res.status === 401 || res.status === 403) throw new Error(who + ' rejected your API key: ' + msg);
      if (res.status === 429) throw new Error(who + ': free limit reached for now. Wait a minute and try again. (' + msg + ')');
      if (res.status === 404) throw new Error(who + ': model not found. Change the model name in Settings. (' + msg + ')');
      throw new Error(who + ' error ' + res.status + ': ' + msg);
    }
    return data;
  }

  function friendlyError(sdk, e) {
    if (e instanceof sdk.APIUserAbortError) return new Error('Generation cancelled.');
    if (e instanceof sdk.AuthenticationError) return new Error('Your API key was rejected. Check it in Settings.');
    if (e instanceof sdk.PermissionDeniedError) return new Error('This API key does not have access to that model. Try another model in Settings.');
    if (e instanceof sdk.NotFoundError) return new Error('Model not found. Choose another model in Settings.');
    if (e instanceof sdk.RateLimitError) return new Error('Rate limit or credit limit reached. Wait a moment, or check your billing at console.anthropic.com.');
    if (e instanceof sdk.BadRequestError && /credit balance/i.test(e.message)) {
      return new Error('Your Claude account has no credit. Add credit at console.anthropic.com → Plans & Billing, or choose a free AI service above (Gemini, Groq or OpenRouter), or use “Basic questions” or “Claude chat”, which need no key.');
    }
    if (e instanceof sdk.BadRequestError) return new Error('The request was rejected: ' + e.message);
    if (e instanceof sdk.APIConnectionError) return new Error('Could not reach the Claude API. Check your connection and try again.');
    if (e instanceof sdk.APIError) return new Error('Claude API error (' + (e.status || '?') + '): ' + e.message);
    return e;
  }
})();
