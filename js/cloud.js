/* Online accounts and sync with Supabase.
   When js/config.js has a Supabase URL and key, sign-up and log-in go to the
   database, and everything a user saves (tests, answers, highlights, words,
   finished tests, settings except API keys) is copied there. The browser keeps
   a local copy, so the site stays fast and works for a while offline; changes
   are sent in the background and retried until they arrive. */
(function () {
  const A2I = (window.A2I = window.A2I || {});
  const cfg = window.A2I_CONFIG || {};
  const SDK = A2I.SUPABASE_SDK || 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';

  const cloud = (A2I.cloud = {
    enabled: !!(cfg.supabaseUrl && cfg.supabaseAnonKey),
    client: null,
    profile: null,
    status: 'local',
  });

  if (!cloud.enabled) {
    cloud.ready = Promise.resolve();
    return;
  }

  const local = A2I.auth; // the browser-only accounts, replaced below
  const PUBLIC_SETTINGS = ['provider', 'models', 'timerMinutes', 'speed', 'translateTo'];

  function loadSDK() {
    if (A2I.SUPABASE_CLIENT) return Promise.resolve(A2I.SUPABASE_CLIENT); // tests
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SDK;
      s.onload = () => resolve(window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }));
      s.onerror = () => reject(new Error('Could not load the database library. Check your internet connection.'));
      document.head.appendChild(s);
    });
  }

  function mapProfile(p) {
    return p && { id: p.id, name: p.name, email: p.email, level: p.level, target: p.target, role: p.role, blocked: p.blocked, settings: p.settings || {} };
  }

  async function loadProfile(uid) {
    const { data, error } = await cloud.client.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) throw new Error(error.message);
    return mapProfile(data);
  }

  /* ---------- sync ---------- */

  const TABLES = {
    tests: { table: 'tests', key: 'id', row: (k, v) => ({ id: k, data: v }) },
    progress: { table: 'progress', key: 'test_id', row: (k, v) => ({ test_id: k, data: v }) },
    words: { table: 'words', key: 'word', row: (k, v) => ({ word: k, data: v }) },
  };

  const pendingKey = () => 'a2i.pending@' + (cloud.profile && cloud.profile.id);
  let pending = {};
  let flushTimer = null;
  let flushing = false;

  function savePending() {
    try { localStorage.setItem(pendingKey(), JSON.stringify(pending)); } catch (e) { /* full */ }
  }
  function loadPending() {
    try { pending = JSON.parse(localStorage.getItem(pendingKey()) || '{}'); } catch (e) { pending = {}; }
  }

  /* Called by the store whenever something changes. value null = deleted. */
  cloud.changed = function (kind, key, value) {
    if (!cloud.profile) return;
    pending[kind + '\u0000' + (key == null ? '' : key)] = { kind, key, value, t: Date.now() };
    savePending();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 1200);
  };

  async function flush() {
    if (flushing || !cloud.profile) return;
    flushing = true;
    const uid = cloud.profile.id;
    const items = Object.entries(pending);
    let failed = false;
    for (const [id, it] of items) {
      try {
        let error = null;
        if (it.kind === 'attempts') {
          const a = it.value;
          ({ error } = await cloud.client.from('attempts').upsert({
            user_id: uid, test_id: a.testId, title: a.title || '', at: new Date(a.at).toISOString(),
            correct: a.correct, total: a.total, band: a.band, by_type: a.byType || {}, seconds: a.seconds || 0, over_time: !!a.overTime,
          }, { onConflict: 'user_id,test_id,at', ignoreDuplicates: true }));
        } else if (it.kind === 'settings') {
          const pub = {};
          PUBLIC_SETTINGS.forEach((k) => { if (it.value && k in it.value) pub[k] = it.value[k]; }); // never the API keys
          ({ error } = await cloud.client.from('profiles').update({ settings: pub }).eq('id', uid));
        } else if (it.kind === 'profile') {
          ({ error } = await cloud.client.from('profiles').update(it.value).eq('id', uid));
        } else if (TABLES[it.kind]) {
          const t = TABLES[it.kind];
          if (it.value == null) {
            ({ error } = await cloud.client.from(t.table).delete().eq('user_id', uid).eq(t.key, it.key));
          } else {
            ({ error } = await cloud.client.from(t.table).upsert(Object.assign({ user_id: uid, updated_at: new Date().toISOString() }, t.row(it.key, it.value))));
          }
        }
        if (error) throw error;
        if (pending[id] && pending[id].t === it.t) delete pending[id];
      } catch (e) {
        failed = true;
        console.warn('Sync failed, will retry', it.kind, e.message || e);
        break;
      }
    }
    savePending();
    flushing = false;
    cloud.status = failed ? 'offline' : 'synced';
    if (failed) flushTimer = setTimeout(flush, 15000);
    else if (Object.keys(pending).length) flushTimer = setTimeout(flush, 500);
  }
  window.addEventListener('online', () => flush());

  async function fetchAll(table, uid) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await cloud.client.from(table).select('*').eq('user_id', uid).range(from, from + 999);
      if (error) throw new Error(error.message);
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  }

  /* After log-in: bring down everything saved online, merge with this browser, send up what is only here. */
  async function pull() {
    const uid = cloud.profile.id;
    const [tests, progress, words, attempts] = await Promise.all(['tests', 'progress', 'words', 'attempts'].map((t) => fetchAll(t, uid)));
    const raw = A2I.store._raw;

    const localTests = raw.get('tests', []);
    const serverTests = new Map(tests.map((r) => [r.id, r.data]));
    localTests.forEach((t) => { if (!serverTests.has(t.id)) cloud.changed('tests', t.id, t); });
    raw.set('tests', Array.from(serverTests.values()).concat(localTests.filter((t) => !serverTests.has(t.id)))
      .sort((a, b) => (b.created || 0) - (a.created || 0)));

    const localProgress = raw.get('progress', {});
    const mergedProgress = Object.assign({}, localProgress);
    progress.forEach((r) => { mergedProgress[r.test_id] = r.data; });
    Object.keys(localProgress).forEach((id) => { if (!progress.some((r) => r.test_id === id)) cloud.changed('progress', id, localProgress[id]); });
    raw.set('progress', mergedProgress);

    const localWords = raw.get('words', []);
    const serverWords = new Map(words.map((r) => [r.word, r.data]));
    localWords.forEach((w) => { if (!serverWords.has(w.word)) cloud.changed('words', w.word, w); });
    raw.set('words', Array.from(serverWords.values()).concat(localWords.filter((w) => !serverWords.has(w.word)))
      .sort((a, b) => (b.added || 0) - (a.added || 0)));

    const localAttempts = raw.get('attempts', []);
    const seen = new Set(attempts.map((a) => a.test_id + '|' + new Date(a.at).getTime()));
    localAttempts.forEach((a) => { if (!seen.has(a.testId + '|' + a.at)) cloud.changed('attempts', a.testId + '|' + a.at, a); });
    const fromServer = attempts.map((a) => ({
      testId: a.test_id, title: a.title, at: new Date(a.at).getTime(), correct: a.correct, total: a.total,
      band: Number(a.band), byType: a.by_type || {}, seconds: a.seconds, overTime: a.over_time,
    }));
    const all = fromServer.concat(localAttempts.filter((a) => !seen.has(a.testId + '|' + a.at))).sort((x, y) => x.at - y.at);
    raw.set('attempts', all);

    // Settings: online values for everything except the API keys, which stay in this browser.
    const s = raw.get('settings', {});
    raw.set('settings', Object.assign({}, s, cloud.profile.settings || {}, { keys: s.keys || {} }));
  }

  async function startSession(session) {
    const profile = await loadProfile(session.user.id);
    if (!profile) throw new Error('Your profile was not found. Make sure supabase/schema.sql was run in the database.');
    if (profile.blocked) {
      await cloud.client.auth.signOut();
      throw new Error('This account has been blocked. Please contact the site administrator.');
    }
    cloud.profile = profile;
    A2I.store._setUser(profile.id);
    loadPending();
    try {
      await pull();
      cloud.status = 'synced';
    } catch (e) {
      cloud.status = 'offline';
      console.warn('Could not download data', e);
    }
    cloud.client.rpc('touch_last_seen').then(() => {}, () => {});
    flush();
  }

  function friendly(error) {
    const m = (error && error.message) || String(error);
    if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
    if (/email not confirmed/i.test(m)) return 'Please confirm your email first — open the link in the email we sent you.';
    if (/already registered|already been registered/i.test(m)) return 'An account with this email already exists. Please log in.';
    if (/rate limit/i.test(m)) return 'Too many attempts. Please wait a minute and try again.';
    if (/failed to fetch|network/i.test(m)) return 'Could not reach the server. Check your internet connection.';
    return m;
  }

  /* ---------- accounts, same interface as the local ones ---------- */

  A2I.auth = {
    cloud: true,
    user() {
      return cloud.profile;
    },
    hasAccounts() {
      return true;
    },
    async register({ name, email, password, level, target }) {
      name = String(name || '').trim();
      email = String(email || '').trim().toLowerCase();
      if (!name) throw new Error('Please enter your name.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter a valid email address.');
      if (String(password || '').length < 6) throw new Error('The password must be at least 6 characters.');
      const { data, error } = await cloud.client.auth.signUp({
        email, password,
        options: { data: { name, level: level || '', target: target || '' }, emailRedirectTo: location.href.split('#')[0] },
      });
      if (error) throw new Error(friendly(error));
      if (!data.session) {
        const e = new Error('Almost done! We sent a confirmation link to ' + email + '. Open it, then log in here.');
        e.notice = true;
        throw e;
      }
      await startSession(data.session);
      return cloud.profile;
    },
    async login(email, password) {
      const { data, error } = await cloud.client.auth.signInWithPassword({ email: String(email || '').trim().toLowerCase(), password });
      if (error) throw new Error(friendly(error));
      await startSession(data.session);
      return cloud.profile;
    },
    logout() {
      clearTimeout(flushTimer);
      cloud.profile = null;
      A2I.store._setUser(null);
      cloud.client.auth.signOut();
    },
    updateProfile(patch) {
      Object.assign(cloud.profile, patch);
      cloud.changed('profile', null, patch);
    },
    async resetPassword(email) {
      const { error } = await cloud.client.auth.resetPasswordForEmail(String(email || '').trim().toLowerCase(), { redirectTo: location.href.split('#')[0] });
      if (error) throw new Error(friendly(error));
    },
  };

  /* ---------- admin calls ---------- */

  async function rpc(name, args) {
    const { data, error } = await cloud.client.rpc(name, args || {});
    if (error) throw new Error(friendly(error));
    return data;
  }
  cloud.admin = {
    overview: () => rpc('admin_overview'),
    daily: (days) => rpc('admin_daily', { days }),
    users: (search, sort, lim, off) => rpc('admin_list_users', { search, sort, lim, off }),
    attempts: (uid) => rpc('admin_user_attempts', { uid, lim: 50 }),
    setRole: (uid, role) => rpc('admin_set_role', { uid, new_role: role }),
    setBlocked: (uid, value) => rpc('admin_set_blocked', { uid, value }),
    remove: (uid) => rpc('admin_delete_user', { uid }),
  };

  /* ---------- start ---------- */

  cloud.ready = (async () => {
    try {
      cloud.client = await loadSDK();
      cloud.client.auth.onAuthStateChange(async (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          const pw = window.prompt('Choose a new password (at least 6 characters):');
          if (pw && pw.length >= 6) {
            const { error } = await cloud.client.auth.updateUser({ password: pw });
            alert(error ? friendly(error) : 'Your password has been changed.');
          }
        }
      });
      const { data } = await cloud.client.auth.getSession();
      if (data && data.session) await startSession(data.session);
    } catch (e) {
      console.warn(e);
      cloud.startError = e.message || String(e);
    }
  })();
  cloud.local = local;
})();
