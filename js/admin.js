/* Article2IELTS — © 2026 Nuramatova Sakinat Ibnuabasovna. All rights reserved. */
/* Admin panel: site statistics and user management.
   With the online database it covers every user of the site; without it,
   only the accounts created in this browser. */
(function () {
  const A2I = (window.A2I = window.A2I || {});
  const esc = (s) => A2I.esc(s == null ? '' : s);
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
  const ago = (d) => {
    if (!d) return '—';
    const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 2) return 'just now';
    if (m < 60) return m + ' min ago';
    if (m < 60 * 24) return Math.round(m / 60) + ' h ago';
    return Math.round(m / 1440) + ' days ago';
  };

  /* Small single-series bar chart (one per metric, so no legend is needed). */
  function barChart(rows, field, label) {
    const W = 520;
    const H = 150;
    const L = 28;
    const B = 22;
    const T = 10;
    const max = Math.max(1, ...rows.map((r) => Number(r[field]) || 0));
    const bw = (W - L - 6) / Math.max(1, rows.length);
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const bars = rows.map((r, i) => {
      const v = Number(r[field]) || 0;
      const x = L + i * bw + 1;
      const h = Math.max(0, H - B - y(v));
      return `<g><rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="bar"/>
        <rect x="${x.toFixed(1)}" y="${T}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${H - B - T}" class="hit"><title>${esc(fmtDate(r.day))}: ${v} ${esc(label)}</title></rect></g>`;
    }).join('');
    const total = rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(label)} per day, ${total} in total">
      <line x1="${L}" x2="${W}" y1="${H - B}" y2="${H - B}" class="grid"/>
      <line x1="${L}" x2="${W}" y1="${T}" y2="${T}" class="grid"/>
      <text x="${L - 6}" y="${T + 4}" class="tick" text-anchor="end">${max}</text>
      <text x="${L - 6}" y="${H - B + 4}" class="tick" text-anchor="end">0</text>
      ${bars}
      <text x="${L}" y="${H - 6}" class="tick">${esc(fmtDate(rows[0] && rows[0].day))}</text>
      <text x="${W}" y="${H - 6}" class="tick" text-anchor="end">${esc(fmtDate(rows[rows.length - 1] && rows[rows.length - 1].day))}</text>
    </svg>`;
  }

  /* ---------- data sources ---------- */

  // Accounts in this browser, in the same shape the database returns.
  function localSource() {
    const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
    const rows = () => {
      const accounts = A2I.auth.accounts ? A2I.auth.accounts() : [];
      const hasAdmin = accounts.some((a) => a.role === 'admin');
      return accounts.map((a, i) => {
        const attempts = read('a2i.attempts.v1@' + a.id) || [];
        const bands = attempts.map((x) => Number(x.band));
        return {
          id: a.id, email: a.email, name: a.name, level: a.level, target: a.target,
          role: a.role || (!hasAdmin && i === 0 ? 'admin' : 'user'), blocked: !!a.blocked,
          created_at: a.created, last_seen_at: a.lastSeen || a.created,
          tests_taken: attempts.length,
          avg_band: bands.length ? (bands.reduce((s, b) => s + b, 0) / bands.length).toFixed(1) : null,
          best_band: bands.length ? Math.max(...bands).toFixed(1) : null,
          last_attempt: attempts.length ? attempts[attempts.length - 1].at : null,
          words_count: (read('a2i.words.v1@' + a.id) || []).length,
          _attempts: attempts,
        };
      });
    };
    const update = (uid, patch) => {
      const list = A2I.auth.accounts();
      const a = list.find((x) => x.id === uid);
      if (a) Object.assign(a, patch);
      A2I.auth.saveAccounts(list);
    };
    return {
      local: true,
      async overview() {
        const r = rows();
        const week = Date.now() - 7 * 864e5;
        const all = r.flatMap((u) => u._attempts);
        return {
          users_total: r.length, users_new_7d: r.filter((u) => u.created_at > week).length,
          active_7d: r.filter((u) => u.last_seen_at > week).length, active_1d: r.filter((u) => u.last_seen_at > Date.now() - 864e5).length,
          admins: r.filter((u) => u.role === 'admin').length, blocked: r.filter((u) => u.blocked).length,
          attempts_total: all.length, attempts_7d: all.filter((a) => a.at > week).length,
          avg_band: all.length ? (all.reduce((s, a) => s + Number(a.band), 0) / all.length).toFixed(1) : null,
          words_total: r.reduce((s, u) => s + u.words_count, 0),
        };
      },
      async daily(days) {
        const r = rows();
        const out = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
          const next = d.getTime() + 864e5;
          out.push({
            day: d.toISOString(),
            signups: r.filter((u) => u.created_at >= d.getTime() && u.created_at < next).length,
            attempts: r.flatMap((u) => u._attempts).filter((a) => a.at >= d.getTime() && a.at < next).length,
          });
        }
        return out;
      },
      async users(search, sort, lim, off) {
        const q = (search || '').toLowerCase();
        let r = rows().filter((u) => !q || u.email.includes(q) || u.name.toLowerCase().includes(q));
        const by = { name: (a, b) => a.name.localeCompare(b.name), active: (a, b) => b.last_seen_at - a.last_seen_at,
          tests: (a, b) => b.tests_taken - a.tests_taken, band: (a, b) => (b.avg_band || 0) - (a.avg_band || 0) }[sort] || ((a, b) => b.created_at - a.created_at);
        r.sort(by);
        const total = r.length;
        return r.slice(off, off + lim).map((u) => Object.assign(u, { total_count: total }));
      },
      async attempts(uid) {
        const u = rows().find((x) => x.id === uid);
        return (u ? u._attempts : []).slice().reverse().map((a) => ({ at: a.at, title: a.title, correct: a.correct, total: a.total, band: a.band }));
      },
      async setRole(uid, role) {
        if (uid === A2I.auth.user().id && role !== 'admin') throw new Error('You cannot remove your own admin role');
        // Make roles explicit for everyone once someone is changed.
        const list = A2I.auth.accounts();
        const hasAdmin = list.some((a) => a.role === 'admin');
        list.forEach((a, i) => { if (!a.role) a.role = !hasAdmin && i === 0 ? 'admin' : 'user'; });
        A2I.auth.saveAccounts(list);
        update(uid, { role });
      },
      async setBlocked(uid, value) {
        if (uid === A2I.auth.user().id) throw new Error('You cannot block yourself');
        update(uid, { blocked: value });
      },
      async remove(uid) {
        if (uid === A2I.auth.user().id) throw new Error('You cannot delete your own account here');
        A2I.auth.saveAccounts(A2I.auth.accounts().filter((a) => a.id !== uid));
        Object.keys(localStorage).filter((k) => k.endsWith('@' + uid)).forEach((k) => localStorage.removeItem(k));
      },
    };
  }

  /* ---------- page ---------- */

  A2I.renderAdmin = function (app) {
    const me = A2I.auth.user();
    if (!me || me.role !== 'admin') {
      app.innerHTML = '<div class="card empty"><h2>Admins only</h2><p class="muted">This page is for site administrators.</p><a class="btn" href="#/dashboard">Back</a></div>';
      return;
    }
    const src = A2I.cloud && A2I.cloud.enabled ? A2I.cloud.admin : localSource();
    const state = { search: '', sort: 'created', page: 0, size: 50, open: null };

    app.innerHTML = `
      <div class="dash admin">
        <div class="lib-head">
          <div><h1 style="margin:0">Admin panel</h1>
            <p class="muted" style="margin:4px 0 0">${src.local
              ? 'Local mode: only accounts created in this browser. Connect the online database (see README → “Database”) to manage all users.'
              : 'All users of the site · online database'}</p></div>
          <button class="btn" id="adm-refresh">↻ Refresh</button>
        </div>
        <div class="tiles" id="adm-tiles"><div class="tile"><div class="muted small">Loading…</div></div></div>
        <div class="dash-grid" style="grid-template-columns:1fr 1fr">
          <div class="card"><h2>New users per day (30 days)</h2><div id="adm-signups" class="muted small">Loading…</div></div>
          <div class="card"><h2>Tests finished per day (30 days)</h2><div id="adm-attempts" class="muted small">Loading…</div></div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="row" style="justify-content:space-between;margin-bottom:10px">
            <h2 style="margin:0">Users <span class="muted small" id="adm-count"></span></h2>
            <div class="row">
              <input type="text" id="adm-search" placeholder="Search name or email…" style="width:240px">
              <select id="adm-sort" style="width:auto">
                <option value="created">Newest</option><option value="active">Last active</option>
                <option value="tests">Most tests</option><option value="band">Best average band</option><option value="name">Name A–Z</option>
              </select>
              <button class="btn small" id="adm-csv">Export CSV</button>
            </div>
          </div>
          <div class="table-wrap"><table class="table" id="adm-table"></table></div>
          <div class="row" style="justify-content:space-between;margin-top:10px">
            <button class="btn small" id="adm-prev">← Previous</button>
            <span class="muted small" id="adm-page"></span>
            <button class="btn small" id="adm-next">Next →</button>
          </div>
        </div>
      </div>`;
    const $ = (s) => app.querySelector(s);

    async function loadStats() {
      try {
        const o = await src.overview();
        const tile = (label, big, sub) => `<div class="tile"><div class="muted small">${label}</div><div class="big">${big}</div><div class="small muted">${sub}</div></div>`;
        $('#adm-tiles').innerHTML =
          tile('Users', Number(o.users_total).toLocaleString(), `+${o.users_new_7d} this week · ${o.admins} admin${o.admins == 1 ? '' : 's'}${o.blocked ? ' · ' + o.blocked + ' blocked' : ''}`) +
          tile('Active', Number(o.active_7d).toLocaleString(), `in the last 7 days · ${o.active_1d} today`) +
          tile('Tests finished', Number(o.attempts_total).toLocaleString(), `${o.attempts_7d} this week`) +
          tile('Average band', o.avg_band != null ? Number(o.avg_band).toFixed(1) : '—', `${Number(o.words_total || 0).toLocaleString()} words saved`);
        const d = await src.daily(30);
        $('#adm-signups').innerHTML = barChart(d, 'signups', 'new users');
        $('#adm-attempts').innerHTML = barChart(d, 'attempts', 'tests finished');
      } catch (e) {
        $('#adm-tiles').innerHTML = `<div class="error">${esc(e.message)}</div>`;
      }
    }

    let rows = [];
    async function loadUsers() {
      $('#adm-table').innerHTML = '<tr><td class="muted">Loading…</td></tr>';
      try {
        rows = await src.users(state.search, state.sort, state.size, state.page * state.size);
      } catch (e) {
        $('#adm-table').innerHTML = `<tr><td class="error">${esc(e.message)}</td></tr>`;
        return;
      }
      const total = rows.length ? Number(rows[0].total_count) : 0;
      $('#adm-count').textContent = total ? `(${total.toLocaleString()})` : '';
      const pages = Math.max(1, Math.ceil(total / state.size));
      $('#adm-page').textContent = `Page ${state.page + 1} of ${pages}`;
      $('#adm-prev').disabled = state.page === 0;
      $('#adm-next').disabled = state.page + 1 >= pages;
      $('#adm-table').innerHTML = `<tr><th>User</th><th>Joined</th><th>Last active</th><th>Tests</th><th>Avg / best band</th><th>Words</th><th>Role</th><th></th></tr>` +
        (rows.length ? rows.map((u) => `
          <tr data-uid="${esc(u.id)}" class="${u.blocked ? 'blocked' : ''}">
            <td><b>${esc(u.name || '—')}</b>${u.id === me.id ? ' <span class="badge">you</span>' : ''}<br><span class="muted small">${esc(u.email)}</span>
              ${u.target ? `<br><span class="muted small">target ${esc(u.target)}${u.level ? ' · now ' + esc(u.level) : ''}</span>` : ''}</td>
            <td>${esc(fmtDate(u.created_at))}</td>
            <td>${esc(ago(u.last_seen_at))}</td>
            <td>${u.tests_taken}</td>
            <td>${u.avg_band != null ? Number(u.avg_band).toFixed(1) : '—'} / ${u.best_band != null ? Number(u.best_band).toFixed(1) : '—'}</td>
            <td>${u.words_count}</td>
            <td>${u.role === 'admin' ? '<span class="badge score">admin</span>' : 'user'}${u.blocked ? ' <span class="bad small">■ blocked</span>' : ''}</td>
            <td class="adm-actions">
              <button class="btn small ghost" data-act="view">${state.open === u.id ? 'Hide' : 'Results'}</button>
              ${u.id === me.id ? '' : `
              <button class="btn small ghost" data-act="role">${u.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>
              <button class="btn small ghost" data-act="block">${u.blocked ? 'Unblock' : 'Block'}</button>
              <button class="btn small ghost bad" data-act="delete">Delete</button>`}
            </td>
          </tr>
          ${state.open === u.id ? `<tr class="adm-detail"><td colspan="8" id="adm-detail">Loading…</td></tr>` : ''}`).join('')
        : '<tr><td colspan="8" class="muted">No users found.</td></tr>');
      if (state.open) showAttempts(state.open);
    }

    async function showAttempts(uid) {
      const cell = $('#adm-detail');
      if (!cell) return;
      try {
        const list = await src.attempts(uid);
        cell.innerHTML = list.length
          ? `<table class="table"><tr><th>Date</th><th>Test</th><th>Score</th><th>Band</th></tr>${list.map((a) => `<tr><td>${esc(fmtDate(a.at))}</td><td>${esc(a.title)}</td><td>${a.correct}/${a.total}</td><td>${Number(a.band).toFixed(1)}</td></tr>`).join('')}</table>`
          : '<span class="muted">No finished tests yet.</span>';
      } catch (e) {
        cell.innerHTML = `<span class="error">${esc(e.message)}</span>`;
      }
    }

    $('#adm-table').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const uid = b.closest('tr').dataset.uid;
      const u = rows.find((x) => x.id === uid);
      try {
        if (b.dataset.act === 'view') {
          state.open = state.open === uid ? null : uid;
          return loadUsers();
        }
        if (b.dataset.act === 'role') {
          if (!confirm(u.role === 'admin' ? `Remove admin rights from ${u.email}?` : `Give ${u.email} full admin rights?`)) return;
          await src.setRole(uid, u.role === 'admin' ? 'user' : 'admin');
        } else if (b.dataset.act === 'block') {
          if (!confirm(u.blocked ? `Unblock ${u.email}?` : `Block ${u.email}? They will not be able to log in or save anything.`)) return;
          await src.setBlocked(uid, !u.blocked);
        } else if (b.dataset.act === 'delete') {
          const typed = prompt(`Delete ${u.email} and ALL their data? This cannot be undone.\nType the email to confirm:`);
          if ((typed || '').trim().toLowerCase() !== u.email.toLowerCase()) return;
          await src.remove(uid);
        }
        A2I.toast('Done');
        loadUsers();
        loadStats();
      } catch (err) {
        alert(err.message);
      }
    });

    let searchTimer = null;
    $('#adm-search').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.search = e.target.value.trim(); state.page = 0; loadUsers(); }, 300);
    });
    $('#adm-sort').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 0; loadUsers(); });
    $('#adm-prev').addEventListener('click', () => { state.page = Math.max(0, state.page - 1); loadUsers(); });
    $('#adm-next').addEventListener('click', () => { state.page++; loadUsers(); });
    $('#adm-refresh').addEventListener('click', () => { loadStats(); loadUsers(); });
    $('#adm-csv').addEventListener('click', async () => {
      const all = [];
      for (let off = 0; ; off += 500) {
        const part = await src.users(state.search, state.sort, 500, off);
        all.push(...part);
        if (part.length < 500) break;
      }
      const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const csv = 'name,email,role,blocked,joined,last_active,tests,avg_band,best_band,words,level,target\n' +
        all.map((u) => [u.name, u.email, u.role, u.blocked, fmtDate(u.created_at), fmtDate(u.last_seen_at), u.tests_taken, u.avg_band, u.best_band, u.words_count, u.level, u.target].map(q).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'article2ielts-users.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
    });

    loadStats();
    loadUsers();
  };
})();
