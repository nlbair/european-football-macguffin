(function () {
  'use strict';

  const CHAIN = window.MG_CHAIN || { rows: [], seed: {}, built: '' };
  const DETAILS = window.MG_DETAILS || {};
  const SEED = CHAIN.seed || {};
  const RAW = CHAIN.rows || [];
  const HAS_DETAILS = Object.keys(DETAILS).length > 0;
  const LOGOS = window.MG_LOGOS || {};
  const USE_CREST = Object.keys(LOGOS).length > 0;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const COMP_NAMES = { 'Champions Lg': 'Champions League', 'Europa Lg': 'Europa League', 'Conf Lg': 'Conference League', 'UEFA Cup': 'UEFA Cup' };
  const VIEWS = ['path', 'clubs', 'records', 'players', 'about'];
  const NAV = { path: 'The path', clubs: 'Clubs', records: 'Records', players: 'Players', about: 'How it works' };
  const TODAY = new Date().toISOString().slice(0, 10);

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const slug = (v) => norm(v).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const utc = (iso) => { const p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); };
  const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
  const fmtDate = (iso) => { const p = iso.split('-'); return `${+p[2]} ${MONTHS[+p[1] - 1]} ${p[0]}`; };
  const seasonLabel = (s) => { const p = String(s).split('-'); return p.length === 2 ? `${p[0]}–${p[1].slice(2)}` : s; };
  const isEurope = (c) => /champions|europa|uefa|conf/i.test(c || '');
  const compLabel = (c) => COMP_NAMES[c] || String(c || '').replace(/\bLg\b/, 'League');
  const initials = (name) => {
    const words = String(name).replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
    if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
    return String(words[0] || '?').slice(0, 3).toUpperCase();
  };
  function crest(name, size) {
    if (!USE_CREST || !name) return '';
    const key = slug(name);
    const cls = size ? ` crest-${size}` : '';
    if (LOGOS[key]) return `<img class="crest${cls}" src="${esc(LOGOS[key])}" alt="" loading="lazy" decoding="async">`;
    return `<span class="crest mono${cls}" aria-hidden="true">${esc(initials(name))}</span>`;
  }
  const crestCell = (name) => (USE_CREST ? `<span class="cc">${crest(name)}</span>` : '');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

  const rows = RAW.map((r, i) => {
    const m = /^(\d+)-(\d+)$/.exec(r.sc || '');
    const next = RAW[i + 1];
    const end = next ? next.d : null;
    return Object.assign({}, r, {
      revert: r.e === 'r',
      lost: m ? +m[1] : null,
      won: m ? +m[2] : null,
      end: end,
      ongoing: !next,
      days: Math.max(0, daysBetween(r.d, end || TODAY)),
      europe: isEurope(r.c)
    });
  });
  const byStep = {};
  rows.forEach((r) => { byStep[r.s] = r; });
  const maxDays = rows.reduce((m, r) => Math.max(m, r.days), 1);
  const longestSorted = rows.filter((r) => !r.revert).map((r) => r.days).sort((a, b) => b - a);
  const hotMin = longestSorted.length > 9 ? longestSorted[9] : 0;
  const isHot = (r) => !r.revert && hotMin > 0 && r.days >= hotMin;

  const scoreText = (r) => (r.won == null ? '' : `${r.won}–${r.lost}`);
  const venueWords = (r) => (r.v === 'Away' ? 'at home' : r.v === 'Home' ? 'away' : r.v === 'Neutral' ? 'at a neutral ground' : '');

  const clubMap = new Map();
  function club(name) {
    if (!clubMap.has(name)) clubMap.set(name, { name: name, slug: slug(name), spells: [], days: 0, longest: 0 });
    return clubMap.get(name);
  }
  if (SEED.club) {
    club(SEED.club).spells.push({ seed: true, start: null, end: rows.length ? rows[0].d : null, days: null, got: null, lostRow: rows[0] || null, ongoing: !rows.length });
  }
  rows.forEach((r, i) => {
    const c = club(r.w);
    c.spells.push({ seed: false, start: r.d, end: r.end, days: r.days, got: r, lostRow: rows[i + 1] || null, ongoing: r.ongoing });
    c.days += r.days;
    c.longest = Math.max(c.longest, r.days);
  });
  const clubs = Array.from(clubMap.values());
  const clubBySlug = {};
  clubs.forEach((c) => { clubBySlug[c.slug] = c; });
  const maxClubDays = clubs.reduce((m, c) => Math.max(m, c.days), 1);
  const allSpells = [];
  clubs.forEach((c) => c.spells.forEach((s) => { if (!s.seed) allSpells.push(Object.assign({ club: c.name }, s)); }));

  const players = new Map();
  function playerRec(name, team, chain) {
    let p = players.get(name);
    if (!p) {
      p = { name: name, slug: slug(name), team: team, chain: chain || '', goals: 0, assists: 0, apps: 0, took: { g: 0, a: 0, p: 0 }, lost: { g: 0, a: 0, p: 0 }, games: new Map() };
      players.set(name, p);
    }
    p.team = team;
    if (chain) p.chain = chain;
    return p;
  }
  function gameRec(p, step) {
    let g = p.games.get(step);
    if (!g) { g = { step: step, g: 0, a: 0, played: false, role: '' }; p.games.set(step, g); }
    return g;
  }
  let lineupGames = 0;
  let detailGames = 0;
  if (HAS_DETAILS) {
    rows.forEach((r) => {
      if (r.revert) return;
      const d = DETAILS[String(r.s)];
      if (!d) return;
      detailGames += 1;
      if (d.p) lineupGames += 1;
      const holderSide = d.hs || (d.hg < d.ag ? 'home' : d.ag < d.hg ? 'away' : '');
      const roleOf = (side) => (!holderSide || !side ? '' : side === holderSide ? 'lost' : 'took');
      const sideOf = (team) => (team === d.h ? 'home' : team === d.a ? 'away' : '');
      const chainOf = (role) => (role === 'lost' ? r.h : role === 'took' ? r.w : '');
      (d.g || []).forEach((g) => {
        if (g[4] === 'own goal') return;
        const role = roleOf(sideOf(g[1]));
        if (g[2]) {
          const p = playerRec(g[2], g[1], chainOf(role));
          p.goals += 1;
          if (role) p[role].g += 1;
          const gr = gameRec(p, r.s);
          gr.g += 1;
          gr.role = role;
        }
        if (g[3]) {
          const p = playerRec(g[3], g[1], chainOf(role));
          p.assists += 1;
          if (role) p[role].a += 1;
          const gr = gameRec(p, r.s);
          gr.a += 1;
          gr.role = role;
        }
      });
      ['home', 'away'].forEach((side) => {
        const squad = d.p && d.p[side];
        const team = side === 'home' ? d.h : d.a;
        const role = roleOf(side);
        (squad || []).forEach((pl) => {
          if (pl[2] === 's' || pl[3]) {
            const p = playerRec(pl[1], team, chainOf(role));
            p.apps += 1;
            if (role) p[role].p += 1;
            const gr = gameRec(p, r.s);
            gr.played = true;
            gr.role = role;
          }
        });
      });
    });
  }
  const playerList = Array.from(players.values());

  const state = { q: '', season: '', comp: '', newest: true, intro: true, clubSort: 'spells', pq: '' };
  let current = null;
  let lastFocus = null;

  function sinceText(r) {
    if (r.revert) return `They got it back when ${esc(r.h)} dropped out of the top five leagues.`;
    const where = r.c ? ` in ${esc(compLabel(r.c))}` : '';
    return `They took it from ${esc(r.h)}${r.won != null ? ' ' + scoreText(r) : ''} on ${fmtDate(r.d)}${where}.`;
  }

  function renderHero() {
    const el = $('#hero');
    const last = rows[rows.length - 1];
    if (!last) {
      el.innerHTML = `<p class="kicker">The belt starts with</p><h1 class="holder">${esc(SEED.club || 'Nobody yet')}</h1>`;
      return;
    }
    const rise = state.intro ? ' rise' : '';
    el.innerHTML = `
      <p class="kicker${rise}" style="--i:0">Right now, European football belongs to</p>
      <div class="holder-line${rise}" style="--i:1">${USE_CREST ? crest(last.w, 'xl') : ''}<h1 class="holder">${esc(last.w)}</h1></div>
      <p class="since${rise}" style="--i:2">${sinceText(last)}</p>
      <p class="explainer${rise}" style="--i:3">Beat the holder and the belt is yours. A draw changes nothing. It has been moving since August 1992.</p>
      <div class="hero-actions${rise}" style="--i:4">
        <button type="button" class="btn" data-step="${last.s}">${last.revert ? 'Why it moved' : 'See the match'}</button>
        <p class="fresh">Latest transfer on record: ${fmtDate(last.d)}.</p>
      </div>`;
  }

  function renderMachine() {
    $('#machine').innerHTML = `
      <label for="tmDate">Who had it on</label>
      <input type="date" id="tmDate" min="1992-08-01" max="${TODAY}">
      <p class="machine-result" id="tmResult" aria-live="polite">Pick any day since August 1992 and I’ll tell you who owned European football.</p>`;
  }

  function holderOn(iso) {
    let found = null;
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].d <= iso) found = rows[i]; else break;
    }
    return found;
  }

  function machineHTML(iso) {
    if (!iso) return 'Pick any day since August 1992 and I’ll tell you who owned European football.';
    if (iso < '1992-08-01') return 'The belt didn’t exist yet. It starts in August 1992.';
    const f = holderOn(iso);
    if (!f) {
      const until = rows.length ? ` and kept it until ${fmtDate(rows[0].d)}` : '';
      return `On ${fmtDate(iso)}, it was with <strong>${esc(SEED.club)}</strong>, who started with it${until}.`;
    }
    const how = f.revert ? `when ${esc(f.h)} dropped out of the top five leagues` : `by beating ${esc(f.h)}${f.won != null ? ' ' + scoreText(f) : ''}`;
    const kept = f.ongoing ? 'and, as far as the data goes, still has it' : `and kept it until ${fmtDate(f.end)}`;
    return `On ${fmtDate(iso)}, it was with <strong>${esc(f.w)}</strong>. They got it on ${fmtDate(f.d)} ${how}, ${kept}.
      <span class="actions"><button type="button" class="link" data-step="${f.s}">How they got it</button><button type="button" class="link" data-show="${f.s}">Show on the path</button></span>`;
  }

  function movedBy(r) {
    return `<strong>${esc(r.w)}</strong> took the belt from ${esc(r.h)}.`;
  }

  function revertHTML(r) {
    return `
      <p class="dlg-kicker">${seasonLabel(r.se)}</p>
      <h2 class="dlg-score" id="dlgTitle">${esc(r.w)} get it back</h2>
      <p class="moved">${esc(r.h)} had the belt, then dropped out of the top five leagues.</p>
      <div class="note-box">The belt only travels through the top five leagues and European games against their clubs. When the holder leaves them, it goes back to the club it was taken from. That has happened ${plural(rows.filter((x) => x.revert).length, 'time')} so far.</div>`;
  }

  function goalsHTML(d, winName) {
    if (!d.g || !d.g.length) return '';
    const items = d.g.map((g) => {
      const own = g[4] === 'own goal';
      const pen = g[4] === 'penalty';
      return `<li class="${g[1] === winName ? 'win' : ''}"><span class="min">${esc(g[0])}’</span><span><strong>${esc(g[2])}</strong>${own ? ' (own goal)' : ''}${pen ? ' (pen.)' : ''}${g[3] ? `<span class="assist"> assist ${esc(g[3])}</span>` : ''}<br><span class="team" style="text-align:left">${esc(g[1])}</span></span><span class="run">${esc(String(g[5]).replace('-', '–'))}</span></li>`;
    }).join('');
    return `<section class="dlg-sec"><h3>Goals</h3><ul class="events">${items}</ul></section>`;
  }

  function cardsHTML(d) {
    if (!d.c || !d.c.length) return '';
    const items = d.c.map((c) => {
      const red = /red|second/i.test(c[3]);
      return `<li><span class="min">${esc(c[0])}’</span><span><span class="chip${red ? ' red' : ''}"></span>${esc(c[2])}</span><span class="team">${esc(c[1])}</span></li>`;
    }).join('');
    return `<section class="dlg-sec"><h3>Cards</h3><ul class="events">${items}</ul></section>`;
  }

  function statsHTML(d, winSide) {
    if (!d.st || !d.st.length) return '';
    const items = d.st.map((s) => {
      const label = String(s[0]);
      const pct = /%/.test(label);
      const hv = Number(s[1]);
      const av = Number(s[2]);
      const total = hv + av;
      const hp = total > 0 ? (hv / total) * 100 : 50;
      const fmt = (v) => (v === '' || v == null ? '–' : esc(v) + (pct ? '%' : ''));
      return `<div class="stat"><span class="v">${fmt(s[1])}</span><span class="l">${esc(label.replace(' %', ''))}</span><span class="v">${fmt(s[2])}</span><span class="sbar"><i class="${winSide === 'home' ? 'win' : ''}" style="width:${hp}%"></i><i class="${winSide === 'away' ? 'win' : ''}" style="width:${100 - hp}%"></i></span></div>`;
    }).join('');
    return `<section class="dlg-sec"><h3>Team stats</h3><div><div class="stat-head"><b>${esc(d.h)}</b><b>${esc(d.a)}</b></div>${items}</div></section>`;
  }

  function squadHTML(d, side) {
    const squad = d.p && d.p[side];
    if (!squad) return '';
    const name = side === 'home' ? d.h : d.a;
    const form = side === 'home' ? d.hf : d.af;
    const line = (p) => {
      const marks = [];
      if (p[3]) marks.push(`on ${esc(p[3])}’`);
      if (p[4]) marks.push(`off ${esc(p[4])}’`);
      return `<li><span class="no">${esc(p[0])}</span>${esc(p[1])}${marks.length ? ` <span class="sub">${marks.join(', ')}</span>` : ''}</li>`;
    };
    const starters = squad.filter((p) => p[2] === 's').map(line).join('');
    const bench = squad.filter((p) => p[2] === 'b').map(line).join('');
    return `<div><h4>${esc(name)} <span class="formation">${esc(form || '')}</span></h4><ul>${starters}</ul>${bench ? `<p class="bench-h">Bench</p><ul>${bench}</ul>` : ''}</div>`;
  }

  function lineupsHTML(d) {
    if (!d.p) return '';
    return `<section class="dlg-sec"><h3>Lineups</h3><div class="lineups">${squadHTML(d, 'home')}${squadHTML(d, 'away')}</div></section>`;
  }

  function matchHTML(step) {
    const r = byStep[step];
    if (!r) return '<div class="note-box">That game isn’t on the path.</div>';
    if (r.revert) return revertHTML(r);
    const d = DETAILS[String(step)];
    const link = (d && d.u) || r.u;
    let title;
    let kicker;
    let winSide = '';
    let winName = '';
    if (d) {
      winSide = d.hs === 'home' ? 'away' : d.hs === 'away' ? 'home' : d.hg > d.ag ? 'home' : d.ag > d.hg ? 'away' : '';
      winName = winSide === 'home' ? d.h : winSide === 'away' ? d.a : '';
      const homeChain = winSide === 'home' ? r.w : r.h;
      const awayChain = winSide === 'home' ? r.h : r.w;
      title = `<span class="side ${winSide === 'home' ? 'win' : ''}">${crest(homeChain, 'md')}${esc(d.h)}</span><span class="sc">${d.hg == null ? '' : d.hg}–${d.ag == null ? '' : d.ag}</span><span class="side ${winSide === 'away' ? 'win' : ''}">${esc(d.a)}${crest(awayChain, 'md')}</span>`;
      kicker = `${esc(compLabel(d.cp || r.c))}${d.rd ? ', ' + esc(d.rd) : ''}, ${fmtDate(r.d)}`;
    } else {
      const holderHome = r.v === 'Home';
      const score = scoreText(r);
      const left = holderHome ? esc(r.h) : esc(r.w);
      const right = holderHome ? esc(r.w) : esc(r.h);
      const sc = r.won == null ? '' : (holderHome ? `${r.lost}–${r.won}` : `${r.won}–${r.lost}`);
      winSide = holderHome ? 'away' : 'home';
      const leftChain = holderHome ? r.h : r.w;
      const rightChain = holderHome ? r.w : r.h;
      title = `<span class="side ${holderHome ? '' : 'win'}">${crest(leftChain, 'md')}${left}</span><span class="sc">${score ? sc : 'v'}</span><span class="side ${holderHome ? 'win' : ''}">${right}${crest(rightChain, 'md')}</span>`;
      kicker = `${esc(compLabel(r.c))}, ${fmtDate(r.d)}`;
    }
    const facts = [];
    if (d && d.vn) facts.push(esc(d.vn));
    if (d && d.at) facts.push(`attendance ${esc(d.at)}`);
    if (d && d.rf) facts.push(`referee ${esc(d.rf)}`);
    const body = d
      ? goalsHTML(d, winName) + cardsHTML(d) + statsHTML(d, winSide) + lineupsHTML(d) + (d.p ? '' : '<div class="note-box">FBref has no lineup on file for this one, which is common for older games.</div>')
      : '<div class="note-box">Goals, lineups and stats show up here once the match data is loaded.</div>';
    return `
      <p class="dlg-kicker">${kicker}</p>
      <h2 class="dlg-score" id="dlgTitle">${title}</h2>
      <p class="moved">${movedBy(r)}</p>
      ${body}
      <div class="dlg-foot">
        <span class="grow">${facts.join(', ')}</span>
        ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">Full match report on FBref</a>` : ''}
        <button type="button" class="link" data-copy="${r.s}">Copy link to this game</button>
      </div>`;
  }

  const dlg = $('#dlg');
  const dlgBody = $('#dlgBody');

  function openMatch(step) {
    lastFocus = document.activeElement;
    dlgBody.innerHTML = matchHTML(step);
    dlg.scrollTop = 0;
    if (!dlg.open) dlg.showModal();
  }

  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $('#dlgClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => {
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (err) { /* ignore */ } }
  });

  function matchesFilter(r) {
    if (state.season && r.se !== state.season) return false;
    if (state.comp === '__europe') { if (!r.europe) return false; } else if (state.comp && r.c !== state.comp) return false;
    if (state.q && !norm(r.h + ' ' + r.w).includes(norm(state.q))) return false;
    return true;
  }

  function rowHTML(r, idx) {
    const rise = state.intro && idx < 9 ? ` rise" style="--i:${idx}` : '';
    if (r.revert) {
      return `<li><button type="button" class="row revert${rise}" data-step="${r.s}" id="row-${r.s}">
        <span class="rank">↩</span>${crestCell(r.w)}
        <span class="main"><span class="winner">${esc(r.w)} get it back</span><span class="beat">${esc(r.h)} dropped out of the top five leagues, so the belt returned to the club it came from.</span><span class="meta">Start of ${seasonLabel(r.se)}</span></span>
        <span class="reign"><span class="days">${r.days}</span><span class="days-label">${r.ongoing ? 'days so far' : 'days held'}</span></span>
      </button></li>`;
    }
    const hot = isHot(r);
    const pct = Math.max(2, Math.round((r.days / maxDays) * 100));
    const where = venueWords(r);
    return `<li><button type="button" class="row${rise}" data-step="${r.s}" id="row-${r.s}">
      <span class="rank">${r.s}</span>${crestCell(r.w)}
      <span class="main">
        <span class="winner">${esc(r.w)}</span>
        <span class="beat">beat ${esc(r.h)}${r.won != null ? ' ' + scoreText(r) : ''}</span>
        <span class="meta">${fmtDate(r.d)}, ${esc(compLabel(r.c))}${where ? ', ' + where : ''}${r.europe ? '<span class="tag">Europe</span>' : ''}</span>
      </span>
      <span class="reign"><span class="days">${r.days}</span><span class="days-label">${r.ongoing ? 'days so far' : 'days held'}</span><span class="bar${hot ? ' hot' : ''}"><i style="width:${pct}%"></i></span></span>
    </button></li>`;
  }

  function seedRowHTML() {
    return `<li><div class="row seed">
      <span class="rank">★</span>${crestCell(SEED.club)}
      <span class="main"><span class="winner">${esc(SEED.club)}</span><span class="beat">Starting holder</span><span class="meta">August 1992, the first Premier League season</span></span>
      <span class="reign"></span>
    </div></li>`;
  }

  function viewPath() {
    const seasons = Array.from(new Set(rows.map((r) => r.se))).sort().reverse();
    const comps = Array.from(new Set(rows.filter((r) => r.c).map((r) => r.c)));
    const domestic = comps.filter((c) => !isEurope(c)).sort();
    const euro = comps.filter(isEurope).sort();
    const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
    const compOptions = [opt('', 'All competitions', !state.comp)]
      .concat(domestic.map((c) => opt(c, compLabel(c), state.comp === c)))
      .concat(euro.length ? [opt('__europe', 'All European games', state.comp === '__europe')] : [])
      .concat(euro.map((c) => opt(c, compLabel(c), state.comp === c))).join('');
    const seasonOptions = [opt('', 'All seasons', !state.season)].concat(seasons.map((s) => opt(s, seasonLabel(s), state.season === s))).join('');
    const active = state.q || state.season || state.comp;
    return `
      <div class="controls">
        <label class="sr" for="fQ">Search clubs</label>
        <input id="fQ" type="search" placeholder="Search a club" value="${esc(state.q)}" autocomplete="off">
        <label class="sr" for="fSeason">Season</label>
        <select id="fSeason">${seasonOptions}</select>
        <label class="sr" for="fComp">Competition</label>
        <select id="fComp">${compOptions}</select>
        <button type="button" class="ghost" data-action="order">${state.newest ? 'Newest first' : 'Oldest first'}</button>
        ${active ? '<button type="button" class="ghost" data-action="reset">Clear filters</button>' : ''}
      </div>
      <p class="count" id="count"></p>
      <ol class="list" id="pathList"></ol>`;
  }

  function fillPath() {
    const shown = rows.filter(matchesFilter);
    const ordered = state.newest ? shown.slice().reverse() : shown;
    const showSeed = SEED.club && !state.comp && (!state.q || norm(SEED.club).includes(norm(state.q))) && (!state.season || state.season === SEED.season);
    let html = '';
    let lastSeason = null;
    ordered.forEach((r, idx) => {
      if (r.se !== lastSeason) {
        html += `<li class="season">${seasonLabel(r.se)}</li>`;
        if (showSeed && !state.newest && r.se === SEED.season) html += seedRowHTML();
        lastSeason = r.se;
      }
      html += rowHTML(r, idx);
    });
    if (showSeed && state.newest) html += (lastSeason === SEED.season ? '' : `<li class="season">${seasonLabel(SEED.season)}</li>`) + seedRowHTML();
    if (showSeed && !ordered.length) html = `<li class="season">${seasonLabel(SEED.season)}</li>` + seedRowHTML();
    $('#pathList').innerHTML = html || '<li class="empty">Nothing matches that. Clear a filter and try again.</li>';
    const total = rows.filter((r) => !r.revert).length;
    const games = shown.filter((r) => !r.revert).length;
    $('#count').textContent = games === total ? `All ${total} transfers.` : `${games} of ${total} transfers.`;
  }

  function sortedClubs() {
    const list = clubs.slice();
    const by = state.clubSort;
    list.sort((a, b) => {
      if (by === 'name') return a.name.localeCompare(b.name);
      if (by === 'days') return b.days - a.days || b.spells.length - a.spells.length;
      if (by === 'longest') return b.longest - a.longest || b.days - a.days;
      return b.spells.length - a.spells.length || b.days - a.days;
    });
    return list;
  }

  function viewClubs() {
    const list = sortedClubs();
    const sel = (v) => (state.clubSort === v ? ' selected' : '');
    const items = list.map((c, i) => {
      const pct = Math.max(2, Math.round((c.days / maxClubDays) * 100));
      return `<li><button type="button" class="row" data-club="${esc(c.slug)}">
        <span class="rank">${i + 1}</span>${crestCell(c.name)}
        <span class="main"><span class="winner">${esc(c.name)}</span><span class="meta">${plural(c.spells.length, 'spell')}, longest reign ${plural(c.longest, 'day')}</span></span>
        <span class="reign"><span class="days">${c.days}</span><span class="days-label">days in total</span><span class="bar"><i style="width:${pct}%"></i></span></span>
      </button></li>`;
    }).join('');
    return `
      <h2 class="page-title">Clubs</h2>
      <p class="lede">${plural(clubs.length, 'club')} have held the belt. Pick one to see every spell.</p>
      <div class="controls">
        <label class="sr" for="cSort">Sort clubs</label>
        <select id="cSort">
          <option value="spells"${sel('spells')}>Most spells</option>
          <option value="days"${sel('days')}>Most days held</option>
          <option value="longest"${sel('longest')}>Longest single reign</option>
          <option value="name"${sel('name')}>A to Z</option>
        </select>
      </div>
      <ol class="list">${items}</ol>`;
  }

  function spellHTML(s, club) {
    const days = s.days == null ? '' : s.days;
    let got;
    if (s.seed) got = 'Started with the belt in August 1992.';
    else if (s.got.revert) got = `Got it back on ${fmtDate(s.got.d)}, when ${esc(s.got.h)} dropped out of the top five leagues.`;
    else got = `<button type="button" class="link" data-step="${s.got.s}">Took it from ${esc(s.got.h)}${s.got.won != null ? ' ' + scoreText(s.got) : ''}</button> on ${fmtDate(s.got.d)}.`;
    let lost;
    const n = s.lostRow;
    if (!n) lost = 'Still has it, as far as the data goes.';
    else if (n.revert) lost = `Dropped out of the top five leagues in ${seasonLabel(n.se)}, so the belt went back to ${esc(n.w)}.`;
    else lost = `<button type="button" class="link" data-step="${n.s}">Lost it to ${esc(n.w)}${n.won != null ? ' ' + scoreText(n) : ''}</button> on ${fmtDate(n.d)}.`;
    return `<li class="spell">
      <div class="reign"><span class="days">${days === '' ? '?' : days}</span><span class="days-label">${s.ongoing ? 'days so far' : 'days held'}</span></div>
      <div><p>${got}</p><p>${lost}</p></div>
    </li>`;
  }

  function viewClub(slugArg) {
    const c = clubBySlug[slugArg];
    if (!c) return `<p class="lede">I can’t find that club.</p><button type="button" class="ghost" data-nav="clubs">Back to all clubs</button>`;
    const known = c.spells.filter((s) => !s.seed);
    const spells = c.spells.slice().reverse().map((s) => spellHTML(s, c)).join('');
    return `
      <button type="button" class="ghost" data-nav="clubs">All clubs</button>
      <div class="title-line" style="margin-top:16px">${crest(c.name, 'lg')}<h2 class="page-title">${esc(c.name)}</h2></div>
      <div class="summary">
        <div><span class="days">${c.spells.length}</span><span class="days-label">${c.spells.length === 1 ? 'spell' : 'spells'}</span></div>
        <div><span class="days">${c.days}</span><span class="days-label">days in total</span></div>
        <div><span class="days">${c.longest}</span><span class="days-label">longest reign</span></div>
      </div>
      <ol class="list">${spells}</ol>
      ${known.length ? '' : '<p class="lede">Only the starting spell, so no days on record.</p>'}`;
  }

  function boardRow(rank, name, sub, val, pct, attr, crestName) {
    return `<li><button type="button" class="brow${USE_CREST ? ' cr' : ''}" ${attr}>
      <span class="rank">${rank}</span>${USE_CREST ? `<span class="cc">${crest(crestName || name, 'sm')}</span>` : ''}
      <span><span class="name">${esc(name)}</span><span class="sub">${sub}</span></span>
      <span class="val">${val}</span>
      <span class="bar${rank === 1 ? ' hot' : ''}"><i style="width:${pct}%"></i></span>
    </button></li>`;
  }

  function board(title, note, items) {
    return `<section><h3>${title}</h3><p class="note">${note}</p><ol class="board">${items.join('')}</ol></section>`;
  }

  function viewRecords() {
    const longest = allSpells.slice().sort((a, b) => b.days - a.days).slice(0, 10);
    const topDays = longest.length ? longest[0].days : 1;
    const longestBoard = board('Longest reigns', 'Days between taking the belt and losing it.', longest.map((s, i) =>
      boardRow(i + 1, s.club, `${fmtDate(s.start)} to ${s.end ? fmtDate(s.end) : 'now'}`, s.days, Math.max(3, (s.days / topDays) * 100), `data-step="${s.got.s}"`, s.club)));

    const brief = allSpells.filter((s) => !s.ongoing).sort((a, b) => a.days - b.days || (a.start < b.start ? -1 : 1)).slice(0, 10);
    const briefBoard = board('Shortest reigns', 'Here today, gone almost as quickly.', brief.map((s, i) =>
      boardRow(i + 1, s.club, `${fmtDate(s.start)}, lost it to ${s.lostRow ? esc(s.lostRow.w) : '?'}`, s.days, Math.max(3, 100 - i * 8), `data-step="${s.got.s}"`, s.club)));

    const bySpells = clubs.slice().sort((a, b) => b.spells.length - a.spells.length || b.days - a.days).slice(0, 10);
    const topSpells = bySpells.length ? bySpells[0].spells.length : 1;
    const spellsBoard = board('Most spells', 'Clubs that keep coming back for it.', bySpells.map((c, i) =>
      boardRow(i + 1, c.name, `${plural(c.days, 'day')} in total`, c.spells.length, Math.max(3, (c.spells.length / topSpells) * 100), `data-club="${esc(c.slug)}"`)));

    const byDays = clubs.slice().sort((a, b) => b.days - a.days).slice(0, 10);
    const topClubDays = byDays.length ? byDays[0].days : 1;
    const daysBoard = board('Most days holding it', 'Total time on the throne, all spells added up.', byDays.map((c, i) =>
      boardRow(i + 1, c.name, plural(c.spells.length, 'spell'), c.days, Math.max(3, (c.days / topClubDays) * 100), `data-club="${esc(c.slug)}"`)));

    const scored = rows.filter((r) => !r.revert && r.won != null);
    const margins = scored.slice().sort((a, b) => (b.won - b.lost) - (a.won - a.lost) || b.won - a.won).slice(0, 10);
    const topMargin = margins.length ? margins[0].won - margins[0].lost : 1;
    const marginBoard = board('Biggest wins to take the belt', 'Margin of victory when it changed hands.', margins.map((r, i) =>
      boardRow(i + 1, `${r.w} ${r.won}–${r.lost} ${r.h}`, `${fmtDate(r.d)}, ${esc(compLabel(r.c))}`, `+${r.won - r.lost}`, Math.max(3, ((r.won - r.lost) / topMargin) * 100), `data-step="${r.s}"`, r.w)));

    const fests = scored.slice().sort((a, b) => (b.won + b.lost) - (a.won + a.lost) || b.won - a.won).slice(0, 10);
    const topGoals = fests.length ? fests[0].won + fests[0].lost : 1;
    const festBoard = board('Goal-fests', 'Most goals in a game that moved the belt.', fests.map((r, i) =>
      boardRow(i + 1, `${r.w} ${r.won}–${r.lost} ${r.h}`, `${fmtDate(r.d)}, ${esc(compLabel(r.c))}`, r.won + r.lost, Math.max(3, ((r.won + r.lost) / topGoals) * 100), `data-step="${r.s}"`, r.w)));

    const euroRows = rows.filter((r) => r.europe);
    const euroBlock = `<section><h3>The European tours</h3><p class="note">${plural(euroRows.length, 'transfer')} happened in Europe, which is how the belt gets from one country to another.</p>
      <p><button type="button" class="ghost" data-action="europe">See them all on the path</button></p></section>`;

    return `
      <h2 class="page-title">Records</h2>
      <p class="lede">The longest, the shortest, the silliest. Click any line to open the game.</p>
      <div class="records">${longestBoard}${spellsBoard}${daysBoard}${briefBoard}${marginBoard}${festBoard}${euroBlock}</div>`;
  }

  function leaderboard(title, note, key, valueOf) {
    const list = playerList.filter((p) => valueOf(p) > 0).sort((a, b) => valueOf(b) - valueOf(a) || b.apps - a.apps || a.name.localeCompare(b.name)).slice(0, 12);
    const top = list.length ? valueOf(list[0]) : 1;
    const items = list.map((p, i) => boardRow(i + 1, p.name, esc(p.team), valueOf(p), Math.max(3, (valueOf(p) / top) * 100), `data-player="${esc(p.slug)}"`, p.chain || p.team));
    return `<section><h3>${title}</h3><p class="note">${note}</p><ol class="board">${items.join('') || '<li class="empty">Nothing yet.</li>'}</ol></section>`;
  }

  function playerResultsHTML() {
    const q = norm(state.pq).trim();
    if (!q) return '';
    const hits = playerList.filter((p) => norm(p.name).includes(q)).sort((a, b) => b.goals - a.goals || b.apps - a.apps || a.name.localeCompare(b.name)).slice(0, 20);
    if (!hits.length) return '<p class="lede">No player by that name has shown up in a belt game.</p>';
    return `<ol class="board" style="max-width:560px">${hits.map((p) => `<li><button type="button" class="brow${USE_CREST ? ' cr' : ''}" data-player="${esc(p.slug)}"><span class="rank"></span>${USE_CREST ? `<span class="cc">${crest(p.chain || p.team, 'sm')}</span>` : ''}<span><span class="name">${esc(p.name)}</span><span class="sub">${esc(p.team)}</span></span><span class="val">${p.goals}</span></button></li>`).join('')}</ol>`;
  }

  function viewPlayers() {
    if (!HAS_DETAILS) {
      return `<h2 class="page-title">Players</h2><p class="lede">Who showed up when the belt changed hands. Player stats appear here once the match data is loaded.</p>`;
    }
    const pct = detailGames ? Math.round((lineupGames / detailGames) * 100) : 0;
    return `
      <h2 class="page-title">Players</h2>
      <p class="lede">Who turned up when the belt changed hands. Only the ${detailGames} games that moved it count, so these are belt-game numbers, not career numbers.</p>
      <label class="sr" for="pSearch">Search players</label>
      <input id="pSearch" class="psearch" type="search" placeholder="Search a player" value="${esc(state.pq)}" autocomplete="off">
      <div id="pResults" style="margin-top:12px">${playerResultsHTML()}</div>
      <div class="boards">
        ${leaderboard('Most goals', 'Own goals not counted.', 'goals', (p) => p.goals)}
        ${leaderboard('Most assists', 'As FBref lists them.', 'assists', (p) => p.assists)}
        ${leaderboard('Most appearances', `Starts and substitute appearances. Only counted where FBref has a lineup, which is ${pct}% of these games.`, 'apps', (p) => p.apps)}
      </div>`;
  }

  function viewPlayer(slugArg) {
    const p = playerList.find((x) => x.slug === slugArg);
    if (!p) return `<p class="lede">I can’t find that player.</p><button type="button" class="ghost" data-nav="players">Back to players</button>`;
    const games = Array.from(p.games.values()).sort((a, b) => b.step - a.step).map((g) => {
      const r = byStep[g.step];
      const bits = [];
      if (g.g) bits.push(g.g === 1 ? 'scored' : `scored ${g.g}`);
      if (g.a) bits.push(`${g.a === 1 ? 'an assist' : g.a + ' assists'}`);
      if (g.played && !bits.length) bits.push('played');
      const role = g.role === 'took' ? 'on the side that took the belt' : g.role === 'lost' ? 'on the side that lost it' : '';
      return `<button type="button" class="game" data-step="${g.step}"><b>${esc(r.w)}</b> beat ${esc(r.h)} ${scoreText(r)}<span>${fmtDate(r.d)}, ${esc(compLabel(r.c))}. ${bits.join(', ')}${role ? ', ' + role : ''}.</span></button>`;
    }).join('');
    return `
      <button type="button" class="ghost" data-nav="players">All players</button>
      <div class="title-line" style="margin-top:16px">${crest(p.chain || p.team, 'lg')}<h2 class="page-title">${esc(p.name)}</h2></div>
      <p class="lede">${esc(p.team)}</p>
      <div class="pgrid">
        <div><span class="days">${p.goals}</span><span class="days-label">goals</span></div>
        <div><span class="days">${p.assists}</span><span class="days-label">assists</span></div>
        <div><span class="days">${p.apps}</span><span class="days-label">appearances</span></div>
      </div>
      <ul class="split">
        <li>When their side took the belt: ${plural(p.took.g, 'goal')}, ${plural(p.took.a, 'assist')}, ${plural(p.took.p, 'appearance')}.</li>
        <li>When their side lost it: ${plural(p.lost.g, 'goal')}, ${plural(p.lost.a, 'assist')}, ${plural(p.lost.p, 'appearance')}.</li>
      </ul>
      <div>${games}</div>`;
  }

  function viewAbout() {
    const reverts = rows.filter((r) => r.revert).length;
    return `
      <h2 class="page-title">How it works</h2>
      <div class="prose">
        <p>A title belt nobody awarded, nobody defends on purpose, and nobody can take except by winning. It doesn’t exist, and it has still changed hands ${rows.filter((r) => !r.revert).length} times.</p>
        <h3>The rules</h3>
        <ul>
          <li>It starts with ${esc(SEED.club)} in August 1992, the first Premier League season.</li>
          <li>Beat the holder in a game that counts and the belt is yours. A draw changes nothing.</li>
          <li>Games that count: the Premier League, La Liga, Serie A, the Bundesliga and Ligue 1, plus European club games against clubs from those five countries.</li>
          <li>If the holder loses to a club from anywhere else, the belt stays put, because there isn’t full data for those clubs.</li>
          <li>If the holder is relegated out of its league, the belt goes back to the club it was taken from. That has happened ${plural(reverts, 'time')}.</li>
          <li>It waits through the summer. Nobody can win it in July.</li>
        </ul>
        <h3>Where it comes from</h3>
        <p>The idea belongs to Tyler Budge, who made the College Football MacGuffin, a belt that has passed between college teams since the first game in 1869. This is the same game played on a European pitch with its own rules. He’s on <a href="https://www.tiktok.com/@cfbudge" target="_blank" rel="noopener">TikTok</a>, <a href="https://www.instagram.com/cf_budge/" target="_blank" rel="noopener">Instagram</a> and <a href="https://x.com/CFBudge" target="_blank" rel="noopener">X</a>, and this site isn’t affiliated with or endorsed by him.</p>
        <h3>The data</h3>
        <p>Results, goals, lineups and team stats come from <a href="https://fbref.com" target="_blank" rel="noopener">FBref</a>. Goals are on file for every game. Lineups and team stats exist for most recent games and are patchy or missing for older ones${HAS_DETAILS ? `, about ${Math.round((lineupGames / Math.max(1, detailGames)) * 100)}% of the games here have a lineup` : ''}. Each game links back to its FBref report.</p>
        <p>Reign lengths count days from the game that moved the belt to the next game that moved it. A belt that returned after a relegation counts from 1 July of that season.</p>
        <p>Player names are matched as written on FBref, so two players with the same name would be counted as one.</p>${USE_CREST ? '<p>Club crests belong to their clubs and are shown here only to identify them. If a club or rights holder would like one taken down, it comes down.</p>' : ''}
        <p>Last updated ${esc(CHAIN.built || '')}.</p>
      </div>`;
  }

  function renderTabs(view) {
    $('#tabs').innerHTML = VIEWS.map((v) => `<button type="button" class="tab" data-nav="${v}"${v === view ? ' aria-current="page"' : ''}>${NAV[v]}</button>`).join('');
  }

  function bindView(view) {
    if (view === 'path') {
      $('#fQ').addEventListener('input', (e) => { state.q = e.target.value; fillPath(); });
      $('#fSeason').addEventListener('change', (e) => { state.season = e.target.value; render('path'); });
      $('#fComp').addEventListener('change', (e) => { state.comp = e.target.value; render('path'); });
      fillPath();
      state.intro = false;
    } else if (view === 'clubs') {
      $('#cSort').addEventListener('change', (e) => { state.clubSort = e.target.value; render('clubs'); });
    } else if (view === 'players' && HAS_DETAILS) {
      $('#pSearch').addEventListener('input', (e) => { state.pq = e.target.value; $('#pResults').innerHTML = playerResultsHTML(); });
    }
  }

  function render(view, arg) {
    const home = view === 'path';
    $('#hero').hidden = !home;
    $('#machine').hidden = !home;
    renderTabs(view === 'club' ? 'clubs' : view === 'player' ? 'players' : view);
    let html;
    if (view === 'path') html = viewPath();
    else if (view === 'clubs') html = viewClubs();
    else if (view === 'club') html = viewClub(arg);
    else if (view === 'records') html = viewRecords();
    else if (view === 'players') html = viewPlayers();
    else if (view === 'player') html = viewPlayer(arg);
    else html = viewAbout();
    $('#view').innerHTML = html;
    bindView(view === 'club' ? 'clubs-detail' : view);
  }

  function parseToken(token) {
    let m = /^step-(\d+)$/.exec(token);
    if (m) return { view: 'path', open: +m[1] };
    m = /^club-(.+)$/.exec(token);
    if (m) return { view: 'club', arg: m[1] };
    m = /^player-(.+)$/.exec(token);
    if (m) return { view: 'player', arg: m[1] };
    if (VIEWS.indexOf(token) >= 0) return { view: token };
    return { view: 'path' };
  }

  function route(token) {
    if (token === undefined) token = location.hash.replace(/^#/, '');
    if (token === current) return;
    current = token;
    const t = parseToken(token);
    render(t.view, t.arg);
    if (t.open && byStep[t.open]) openMatch(t.open);
    if (t.view !== 'path' || t.open) window.scrollTo(0, 0);
  }

  function navigate(token) {
    try { if (location.hash.replace(/^#/, '') !== token) location.hash = token; } catch (err) { /* ignore */ }
    route(token);
  }

  function showOnPath(step) {
    state.q = ''; state.season = ''; state.comp = '';
    current = null;
    if (dlg.open) dlg.close();
    navigate('path');
    const el = document.getElementById('row-' + step);
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 2200);
    }
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-step],[data-club],[data-nav],[data-show],[data-copy],[data-player],[data-action]');
    if (!t) return;
    if (t.dataset.nav) { e.preventDefault(); if (dlg.open) dlg.close(); navigate(t.dataset.nav); return; }
    if (t.dataset.step) { openMatch(+t.dataset.step); return; }
    if (t.dataset.show) { showOnPath(+t.dataset.show); return; }
    if (t.dataset.club) { navigate('club-' + t.dataset.club); return; }
    if (t.dataset.player) { navigate('player-' + t.dataset.player); return; }
    if (t.dataset.copy) {
      const url = location.href.split('#')[0] + '#step-' + t.dataset.copy;
      const ok = () => { t.textContent = 'Link copied'; };
      const no = () => { t.textContent = 'Couldn’t copy here'; };
      try { navigator.clipboard.writeText(url).then(ok, no); } catch (err) { no(); }
      return;
    }
    if (t.dataset.action === 'order') { state.newest = !state.newest; render('path'); return; }
    if (t.dataset.action === 'reset') { state.q = ''; state.season = ''; state.comp = ''; render('path'); return; }
    if (t.dataset.action === 'europe') { state.q = ''; state.season = ''; state.comp = '__europe'; current = null; navigate('path'); }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id !== 'tmDate') return;
    $('#tmResult').innerHTML = machineHTML(e.target.value);
  });

  window.addEventListener('hashchange', () => route());

  if (USE_CREST) document.body.classList.add('has-crests');
  $('#built').textContent = (CHAIN.built ? `Updated ${CHAIN.built}.` : '') + (USE_CREST ? ' Club crests belong to their clubs.' : '');
  renderHero();
  renderMachine();
  route();
}());
