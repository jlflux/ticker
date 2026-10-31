(() => {
  'use strict';

  // ── Feeds ──────────────────────────────────────────────────────────────────
  // ESPN's public scoreboard JSON: free, no API key, sends CORS headers, and
  // updates within seconds of the broadcast. `filter` trims a feed further.
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/';
  const PRESETS = {
    'nfl':                       { label: 'NFL',    path: 'football/nfl' },
    'college-football':          { label: 'NCAAF',  path: 'football/college-football', params: { groups: 80, limit: 300 } },
    'college-football-top25':    { label: 'TOP 25', path: 'football/college-football', params: { groups: 80, limit: 300 }, filter: 'ranked' },
    'nba':                       { label: 'NBA',    path: 'basketball/nba' },
    'wnba':                      { label: 'WNBA',   path: 'basketball/wnba' },
    'mens-college-basketball':   { label: 'NCAAM',  path: 'basketball/mens-college-basketball', params: { groups: 50, limit: 400 } },
    'womens-college-basketball': { label: 'NCAAW',  path: 'basketball/womens-college-basketball', params: { groups: 50, limit: 400 } },
    'mlb':                       { label: 'MLB',    path: 'baseball/mlb' },
    'college-baseball':          { label: 'NCAA BASEBALL', path: 'baseball/college-baseball' },
    'nhl':                       { label: 'NHL',    path: 'hockey/nhl' },
    'mls':                       { label: 'MLS',    path: 'soccer/usa.1', homeFirst: true },
    'nwsl':                      { label: 'NWSL',   path: 'soccer/usa.nwsl', homeFirst: true },
    'epl':                       { label: 'PREMIER LEAGUE', path: 'soccer/eng.1', homeFirst: true },
    'laliga':                    { label: 'LALIGA', path: 'soccer/esp.1', homeFirst: true },
    'champions-league':          { label: 'UCL',    path: 'soccer/uefa.champions', homeFirst: true },
  };

  // ── Settings (config.js, then URL overrides) ───────────────────────────────
  const DEFAULTS = {
    leagues: ['nfl'], teams: [], sheets: [],
    secondsPerGame: 5, refreshSeconds: 20,
    showUpcoming: true, upcomingWithinHours: 24, finalsWithinHours: 30, hidePostponed: false,
    nameStyle: 'short', showLogos: true, showRecords: false, showRankings: true,
    title: 'SCORES', accentColor: '#d50a0a', winnerColor: '#ffd200',
    hideWhenEmpty: false, emptyMessage: 'No games scheduled',
    layout: 'corner', corner: 'top-left', edgeMargin: 40,
  };
  const cfg = Object.assign({}, DEFAULTS, window.TICKER_CONFIG || {});
  const q = new URLSearchParams(location.search);
  const list = (v) => v.split(',').map((s) => s.trim()).filter(Boolean);
  const bool = (v) => !/^(0|false|no|off)$/i.test(v);
  const URL_OPTS = {
    leagues: ['leagues', list], teams: ['teams', list],
    secondsPerGame: ['seconds', Number], refreshSeconds: ['refresh', Number],
    showUpcoming: ['upcoming', bool], upcomingWithinHours: ['upcominghours', Number],
    finalsWithinHours: ['finalhours', Number], hidePostponed: ['hidepostponed', bool],
    nameStyle: ['names', String], showLogos: ['logos', bool], showRecords: ['records', bool],
    showRankings: ['rankings', bool], title: ['title', String],
    accentColor: ['accent', String], winnerColor: ['winner', String],
    hideWhenEmpty: ['hideempty', bool], emptyMessage: ['empty', String],
    layout: ['layout', String], corner: ['corner', String], edgeMargin: ['margin', Number],
  };
  for (const [key, [param, parse]] of Object.entries(URL_OPTS)) {
    if (q.has(param)) cfg[key] = parse(q.get(param));
  }
  if (q.has('sheet')) cfg.sheets = [{ label: q.get('sheetlabel') || 'HS FOOTBALL', url: q.get('sheet') }];
  const DEMO = q.has('demo') && bool(q.get('demo'));

  cfg.secondsPerGame = Math.max(2, cfg.secondsPerGame || 5);
  cfg.refreshSeconds = Math.max(10, cfg.refreshSeconds || 20);
  const teamFilter = cfg.teams.map((t) => String(t).toLowerCase());

  document.documentElement.style.setProperty('--accent', cfg.accentColor);
  document.documentElement.style.setProperty('--winner', cfg.winnerColor);
  document.documentElement.style.setProperty('--edge', `${cfg.edgeMargin}px`);
  // 'corner' = compact score bug in a corner of the screen; 'bar' = full-width bottom bar.
  const corner = String(cfg.corner).toLowerCase();
  if (String(cfg.layout).toLowerCase() === 'corner') {
    document.body.classList.add('corner', /^(top|bottom)-(left|right)$/.test(corner) ? corner : 'top-left');
  }

  // ── Feed list ──────────────────────────────────────────────────────────────
  const feeds = [];
  for (const key of cfg.leagues) {
    const p = PRESETS[String(key).toLowerCase()];
    if (!p) { console.warn(`[ticker] Unknown league "${key}". Options: ${Object.keys(PRESETS).join(', ')}`); continue; }
    feeds.push({ id: key, type: 'espn', ...p });
  }
  cfg.sheets.forEach((s, i) => s && s.url && feeds.push({ id: `sheet${i}`, type: 'sheet', label: s.label || 'HS FOOTBALL', url: sheetCsvUrl(s.url) }));

  // ── Normalised game shape ──────────────────────────────────────────────────
  // { id, league, state: 'pre'|'in'|'post', final, statusTop, statusBottom,
  //   start: Date|null, teams: [first, second] } where each team is
  // { name, score, logo, color, rank, record, winner }

  const pick = (team) => {
    if (cfg.nameStyle === 'abbr') return team.abbreviation || team.shortDisplayName;
    if (cfg.nameStyle === 'full') return team.displayName || team.shortDisplayName;
    return team.shortDisplayName || team.name || team.abbreviation;
  };

  function fromEspn(feed, ev) {
    const comp = (ev.competitions || [])[0];
    if (!comp || !comp.competitors || comp.competitors.length < 2) return null;
    const status = comp.status || ev.status || {};
    const type = status.type || {};
    const state = type.state || 'pre';
    const final = state === 'post' && type.completed !== false;

    let teams = comp.competitors.slice(0, 2).map((c) => {
      const t = c.team || {};
      const rank = c.curatedRank && c.curatedRank.current;
      return {
        name: pick(t),
        abbr: t.abbreviation || '',
        keys: [t.abbreviation, t.shortDisplayName, t.displayName, t.name, t.location]
          .filter(Boolean).map((s) => s.toLowerCase()),
        homeAway: c.homeAway,
        score: state === 'pre' ? '' : String(c.score ?? ''),
        logo: t.logo || '',
        color: t.color ? `#${t.color}` : '',
        rank: rank >= 1 && rank <= 25 ? rank : null,
        record: ((c.records || [])[0] || {}).summary || '',
        winner: c.winner === true,
      };
    });
    const away = teams.find((t) => t.homeAway === 'away');
    const home = teams.find((t) => t.homeAway === 'home');
    if (away && home) teams = feed.homeFirst ? [home, away] : [away, home];

    const g = {
      id: `${feed.id}:${ev.id}`, league: feed.label, state, final, teams,
      start: ev.date ? new Date(ev.date) : null,
      timeValid: comp.timeValid !== false,
      network: ((comp.broadcasts || [])[0] || {}).names?.[0] || '',
      detail: type.shortDetail || type.detail || type.description || '',
      postponed: /POSTPONED|CANCELED|CANCELLED|SUSPENDED|DELAYED/.test(type.name || ''),
    };
    if (feed.filter === 'ranked' && !teams.some((t) => t.rank)) return null;
    return g;
  }

  // Google Sheet columns (header row, any order, case-insensitive):
  //   league, away, away_score, home, home_score, status
  // optional: away_rank, home_rank, away_record, home_record,
  //           away_logo, home_logo, away_color, home_color, show
  function fromSheet(feed, rows) {
    const [header, ...body] = rows;
    if (!header) return [];
    const col = Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase().replace(/\s+/g, '_'), i]));
    const get = (r, k) => (col[k] != null ? (r[col[k]] || '').trim() : '');
    return body.map((r, i) => {
      const away = get(r, 'away'), home = get(r, 'home');
      if (!away || !home || /^(n|no|false|0|hide)$/i.test(get(r, 'show'))) return null;
      // Sheets may store "7:00 PM" as a time and export it as "7:00:00 PM".
      const status = get(r, 'status').replace(/^(\d{1,2}:\d{2}):00(\s*[AP]M)?$/i, '$1$2');
      const as = get(r, 'away_score'), hs = get(r, 'home_score');
      const final = /^final/i.test(status);
      const started = as !== '' || hs !== '';
      const state = final ? 'post' : started ? 'in' : 'pre';
      const mk = (name, score, side) => {
        const color = get(r, `${side}_color`);
        return {
          name, score, abbr: name, keys: [name.toLowerCase()],
          logo: get(r, `${side}_logo`), rank: parseInt(get(r, `${side}_rank`), 10) || null,
          color: /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : color,
          record: get(r, `${side}_record`), winner: false,
        };
      };
      const teams = [mk(away, as, 'away'), mk(home, hs, 'home')];
      if (final) {
        const a = parseFloat(as), h = parseFloat(hs);
        if (a > h) teams[0].winner = true; else if (h > a) teams[1].winner = true;
      }
      return {
        id: `${feed.id}:${away}@${home}`, league: get(r, 'league') || feed.label,
        state, final, teams, start: null, timeValid: false, network: '',
        detail: status || (state === 'in' ? 'LIVE' : ''), sheetStatus: true,
        postponed: /postpon|cancel|suspend|delay/i.test(status),
      };
    }).filter(Boolean);
  }

  // Accepts a normal Google Sheets link (".../spreadsheets/d/<id>/edit#gid=0")
  // and turns it into the live CSV export, which reflects edits within seconds.
  // "Publish to web" CSV links and any other CSV URL are used as-is.
  function sheetCsvUrl(url) {
    const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
    if (!m || /\/pub(\?|$)|output=csv|tqx=out:csv/.test(url)) return url;
    const gid = (url.match(/[#?&]gid=(\d+)/) || [])[1];
    return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`;
  }

  function parseCsv(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  }

  // ── Fetching ───────────────────────────────────────────────────────────────
  const store = new Map();   // feed.id -> games[] (last good copy is kept on errors)
  let firstLoadDone = false;

  async function getJson(url, asText) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ctl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return asText ? await res.text() : await res.json();
    } finally { clearTimeout(timer); }
  }

  async function loadFeed(feed) {
    try {
      let games;
      if (feed.type === 'espn') {
        const params = new URLSearchParams({ ...(feed.params || {}), _: Date.now() });
        const data = await getJson(`${ESPN}${feed.path}/scoreboard?${params}`);
        games = (data.events || []).map((ev) => fromEspn(feed, ev)).filter(Boolean);
      } else {
        games = fromSheet(feed, parseCsv(await getJson(feed.url, true)));
      }
      store.set(feed.id, games);
    } catch (err) {
      console.warn(`[ticker] ${feed.label}: ${err.message} (keeping last scores)`);
    }
  }

  async function refreshAll() {
    if (DEMO) { store.set('demo', window.TICKER_DEMO_GAMES(fromEspn, fromSheet, parseCsv)); }
    else await Promise.all(feeds.map(loadFeed));
    firstLoadDone = true;
  }

  // ── Which games make the rotation ──────────────────────────────────────────
  function visible(g) {
    if (teamFilter.length && !g.sheetStatus && !g.teams.some((t) => t.keys.some((k) => teamFilter.includes(k)))) return false;
    if (g.postponed && cfg.hidePostponed) return false;
    if (g.sheetStatus || !g.start) return g.state !== 'pre' || cfg.showUpcoming;
    const hrs = (g.start - Date.now()) / 3.6e6;
    if (g.state === 'pre') return cfg.showUpcoming && hrs <= cfg.upcomingWithinHours && hrs > -12;
    if (g.state === 'post') return -hrs <= cfg.finalsWithinHours + 5; // +5h ≈ game length
    return true;
  }

  function currentGames() {
    const ids = DEMO ? ['demo'] : feeds.map((f) => f.id);
    return ids.flatMap((id) => store.get(id) || []).filter(visible);
  }

  // ── Status text ────────────────────────────────────────────────────────────
  const DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  function status(g) {
    if (g.state === 'pre' && g.start && !g.sheetStatus) {
      const d = g.start, now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      const daysOut = (d - now) / 864e5;
      const day = sameDay ? 'TODAY' : daysOut < 6 ? DAY[d.getDay()] : `${d.getMonth() + 1}/${d.getDate()}`;
      const time = g.timeValid ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'TBD';
      return { top: g.timeValid && sameDay ? time : day, bottom: g.timeValid && sameDay ? g.network : (g.timeValid ? time : 'TBD'), cls: 'pre' };
    }
    const detail = String(g.detail || '').toUpperCase();
    if (g.final) return { top: detail.replace(/^FINAL\b/, 'FINAL') || 'FINAL', bottom: '', cls: 'final' };
    if (g.postponed) return { top: detail, bottom: '', cls: 'pre' };
    // ESPN live text looks like "2:31 - 4TH" → show "4TH" over "2:31".
    const cls = g.state === 'in' ? 'live' : g.state === 'pre' ? 'pre' : '';
    let m = detail.match(/^(.+?)\s+-\s+(.+)$/);
    if (m) return { top: m[2], bottom: m[1], cls };
    // Hand-typed sheet status: "Q3 4:12" or "4:12 Q3" → period over clock.
    const PERIOD = '(Q[1-4]|[1-4](?:ST|ND|RD|TH)|OT\\d?|\\d?OT)';
    if ((m = detail.match(new RegExp(`^${PERIOD}\\s+(\\d{1,2}:\\d{2})$`)))) return { top: m[1], bottom: m[2], cls };
    if ((m = detail.match(new RegExp(`^(\\d{1,2}:\\d{2})\\s+${PERIOD}$`)))) return { top: m[2], bottom: m[1], cls };
    return { top: detail, bottom: '', cls };
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const bar = $('#bar'), stage = $('#stage'), labelEl = $('#label');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function teamHtml(t, g) {
    const decided = g.final && g.teams.some((x) => x.winner);
    const cls = decided ? (t.winner ? 'winner' : 'loser') : '';
    const logo = cfg.showLogos && t.logo
      ? `<img class="logo" src="${esc(t.logo)}" alt="" onerror="this.remove()">` : '';
    const rank = cfg.showRankings && t.rank ? `<span class="rank">${t.rank}</span>` : '';
    const rec = cfg.showRecords && t.record ? `<span class="record">${esc(t.record)}</span>` : '';
    return `<div class="team ${cls}" style="--team:${esc(t.color || 'transparent')}">
      <span class="stripe"></span>${logo}
      <span class="name-wrap"><span class="name">${rank}${esc(t.name)}</span>${rec}</span>
      <span class="score" data-score="${esc(t.score)}">${esc(t.score)}</span>
      <span class="arrow">&#9664;</span>
    </div>`;
  }

  function cardHtml(g) {
    const s = status(g);
    return `${teamHtml(g.teams[0], g)}${teamHtml(g.teams[1], g)}
      <div class="status ${s.cls}"><span class="top">${esc(s.top)}</span>${s.bottom ? `<span class="bottom">${esc(s.bottom)}</span>` : ''}</div>`;
  }

  let currentId = null, currentLabel = null;

  function setLabel(text) {
    if (text === currentLabel) return;
    currentLabel = text;
    labelEl.classList.add('swap');
    setTimeout(() => { labelEl.textContent = text; labelEl.classList.remove('swap'); }, 200);
  }

  function show(html, id, animate) {
    const old = stage.querySelector('.card.active');
    if (!animate && old) {
      // Same game still on screen: refresh it in place and flash changed scores.
      const before = [...old.querySelectorAll('.score')].map((e) => e.dataset.score);
      old.innerHTML = html;
      old.querySelectorAll('.score').forEach((e, i) => {
        if (before[i] !== undefined && before[i] !== e.dataset.score) e.classList.add('flash');
      });
      return;
    }
    const card = document.createElement('div');
    card.className = 'card enter';
    card.innerHTML = html;
    stage.appendChild(card);
    void card.offsetWidth; // start the transition from the "enter" position
    card.classList.replace('enter', 'active');
    if (old) {
      old.classList.replace('active', 'exit');
      setTimeout(() => old.remove(), 700);
    }
    currentId = id;
  }

  // ── Rotation ───────────────────────────────────────────────────────────────
  let queue = [], pos = 0;

  function tick() {
    const games = currentGames();
    if (!games.length) {
      queue = []; pos = 0;
      bar.classList.toggle('hidden', cfg.hideWhenEmpty && firstLoadDone);
      setLabel(cfg.title);
      const msg = firstLoadDone ? cfg.emptyMessage : 'Loading scores…';
      if (currentId !== '__empty' + msg) show(`<div class="message">${esc(msg)}</div>`, '__empty' + msg, true);
      return;
    }
    bar.classList.remove('hidden');
    // Walk the rotation in order; once it runs out, start over with fresh data
    // so new games and dropped games are picked up at a natural break.
    if (pos >= queue.length) { queue = games.map((g) => g.id); pos = 0; }
    const byId = new Map(games.map((g) => [g.id, g]));
    let g;
    while (pos < queue.length && !(g = byId.get(queue[pos]))) pos++;
    if (!g) { queue = games.map((x) => x.id); pos = 0; g = games[0]; }
    pos++;
    setLabel(g.league);
    show(cardHtml(g), g.id, g.id !== currentId || games.length > 1);
  }

  // Between rotations, keep whatever is on screen current (e.g. a lone game).
  function refreshOnScreen() {
    if (!currentId || currentId.startsWith('__empty')) return;
    const g = currentGames().find((x) => x.id === currentId);
    if (g) show(cardHtml(g), g.id, false);
  }

  async function start() {
    setLabel(cfg.title);
    tick();
    await refreshAll();
    tick();
    setInterval(tick, cfg.secondsPerGame * 1000);
    setInterval(async () => { await refreshAll(); refreshOnScreen(); }, cfg.refreshSeconds * 1000);
  }

  // Exposed for troubleshooting in the browser console.
  window.ticker = { cfg, store, feeds, refreshAll, currentGames };
  start();
})();
