(() => {
  'use strict';

  /* ================= Config ================= */
  const STORE_KEY = 'troupeau:v1';
  const LEVELS = {
    1: { name: 'Doux', pts: 1 },
    2: { name: 'Frisé', pts: 2 },
    3: { name: 'Sauvage', pts: 3 },
  };
  const FLASH = { name: 'Flash', pts: 3, lines: 5 };
  const FLASH_CHANCE = 0.2; // ~1 carte sur 5 est une carte flash
  const TEAM_COLORS = ['#FF5C7A', '#4D9FFF', '#8EDB6A', '#FFC93C', '#B57CFF', '#FF9A3C'];
  const DEFAULT_NAMES = ['Les Frisés', 'Les Tondus', 'Les Bouclettes', 'Les Bêlants', 'Les Pelotes', 'Les Agneaux'];
  const TARGETS = [10, 15, 20];
  const MAX_TEAMS = 6;
  const GAME_SCREENS = ['handoff', 'card', 'same', 'diff'];
  const LEGACY_SCREENS = ['level', 'countdown', 'verdict']; // anciennes versions sauvegardées
  const TONES = { same: 'same', diff: 'diff' };

  const ICON = {
    menu: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    back: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    phone: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M13.5 2 4 14h6.5L9 22l11-13h-6.8z"/></svg>',
    crown: '<svg class="crown" viewBox="0 0 60 40" aria-hidden="true"><path d="M4 35 L7 8 L20 21 L30 3 L40 21 L53 8 L56 35 Z" fill="#FFC93C" stroke="#1B1714" stroke-width="3.5" stroke-linejoin="round"/><circle cx="30" cy="25" r="4" fill="#FF5C7A" stroke="#1B1714" stroke-width="2.5"/></svg>',
  };

  /* ================= État ================= */
  const app = document.getElementById('app');
  const sheet = document.getElementById('sheet');

  const defaults = () => ({
    screen: 'home',
    inGame: false,
    resumeTo: null,
    rulesFrom: 'home',
    setup: { names: ['', ''], target: 10 },
    teams: [],
    target: 10,
    current: 0,
    firstTurn: true,
    pot: 0,
    streak: 0,
    gain: 0,
    lost: 0,
    kind: 'normal', // 'normal' | 'flash'
    level: 1,
    prompt: '',
    flash: [],
    flashStep: 0,
    skipsLeft: 1,
    used: { 1: [], 2: [], 3: [], flash: [] },
    sound: true,
  });

  let S = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = Object.assign(defaults(), JSON.parse(raw));
        d.used = Object.assign(defaults().used, d.used);
        return d;
      }
    } catch (e) { /* stockage indisponible : on joue sans */ }
    return defaults();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* idem */ }
  }

  /* ================= Utilitaires ================= */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const team = (i = S.current) => S.teams[i];
  const readerIndex = () => (S.current + 1) % S.teams.length;
  const sheep = (cls = '') => `<svg class="sheep ${cls}" viewBox="0 0 120 100" aria-hidden="true"><use href="#sheep"/></svg>`;
  const pts = (n) => `${n} pt${n > 1 ? 's' : ''}`;
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  const cardPts = () => (S.kind === 'flash' ? FLASH.pts : LEVELS[S.level].pts);

  /* Minuteurs liés à l'écran courant (annulés à chaque navigation) */
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  /* ================= Effets exagérés ================= */
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* Texte découpé lettre par lettre (mots insécables) pour les animer une à une */
  function bounceText(lines) {
    let i = 0;
    return lines.map((line) => line.split(' ').map((word) => `<span class="word">${[...word].map((ch) => {
      const r = Math.round((Math.random() - 0.5) * 24);
      return `<span class="l" style="--i:${i++};--r:${r}deg">${esc(ch)}</span>`;
    }).join('')}</span>`).join(' ')).join('<br>');
  }
  const popWords = (text) => text.split(' ').map((w, i) => `<span class="w" style="--i:${i}">${esc(w)}</span>`).join(' ');

  const FX = {
    shake(level = 'md') {
      if (reduceMotion()) return;
      app.classList.remove('shake-sm', 'shake-md', 'shake-lg');
      void app.offsetWidth;
      app.classList.add(`shake-${level}`);
      setTimeout(() => app.classList.remove(`shake-${level}`), 700);
    },
    flash(color, bolt = false) {
      if (reduceMotion()) return;
      const f = document.createElement('div');
      f.className = 'flashbang';
      f.style.setProperty('--c', color);
      if (bolt) f.innerHTML = `<div class="flashbang__bolt">${ICON.bolt}</div>`;
      document.body.append(f);
      setTimeout(() => f.remove(), 900);
    },
    burst(x, y, n = 18) {
      if (reduceMotion()) return;
      const colors = ['#FFFFFF', '#FFC93C', '#FF5C7A', '#4D9FFF', '#8EDB6A', '#B57CFF'];
      let html = `<span class="ring" style="--x:${x}px;--y:${y}px"></span>`;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const d = 90 + Math.random() * 160;
        html += `<span class="spark" style="--x:${x}px;--y:${y}px;--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d)}px;--s:${Math.round(10 + Math.random() * 20)}px;--r:${Math.round(Math.random() * 540)}deg;--c:${colors[i % colors.length]}"></span>`;
      }
      const layer = document.createElement('div');
      layer.className = 'fx-layer';
      layer.innerHTML = html;
      document.body.append(layer);
      setTimeout(() => layer.remove(), 1100);
    },
    burstFrom(el, n) {
      if (!el) return;
      const r = el.getBoundingClientRect();
      FX.burst(r.left + r.width / 2, r.top + r.height / 2, n);
    },
    boing(el) {
      el.classList.remove('is-boing');
      void el.offsetWidth;
      el.classList.add('is-boing');
    },
  };

  /* Joue une animation de sortie sur un élément, puis enchaîne (taps bloqués entre-temps) */
  let busy = false;
  function leave(el, cls, ms, then) {
    if (!el || reduceMotion()) { then(); return; }
    busy = true;
    el.classList.add(cls);
    setTimeout(() => { busy = false; then(); }, ms);
  }

  /* Tirage sans remise dans un paquet ; on remélange quand il est vide */
  function pickFrom(pool, key, avoid) {
    let used = S.used[key] || [];
    if (used.length >= pool.length) used = [];
    const free = pool.map((_, i) => i).filter((i) => !used.includes(i) && i !== avoid);
    const pick = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * pool.length);
    S.used[key] = [...used, pick];
    return pick;
  }

  function drawCard() {
    if (Math.random() < FLASH_CHANCE) {
      S.kind = 'flash';
      S.flash = window.FLASH[pickFrom(window.FLASH, 'flash')];
      S.flashStep = 0;
    } else {
      S.kind = 'normal';
      S.level = 1 + Math.floor(Math.random() * 3);
      const pool = window.PROMPTS[S.level];
      S.prompt = pool[pickFrom(pool, S.level, pool.indexOf(S.prompt))];
    }
  }

  /* ================= Son (Web Audio, synthétisé) ================= */
  let ctx = null;
  function unlockAudio() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  function tone(freq, dur = 0.12, type = 'triangle', vol = 0.18, when = 0) {
    if (!S.sound || !ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  function bleat(when = 0) {
    if (!S.sound || !ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(560, t);
    o.frequency.linearRampToValueAtTime(470, t + 0.75);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 12;
    const vib = ctx.createGain();
    vib.gain.value = 30;
    const trem = ctx.createGain();
    trem.gain.value = 0.55;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.45;
    lfo.connect(vib).connect(o.frequency);
    lfo.connect(tremDepth).connect(trem.gain);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1500;
    filter.Q.value = 5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.28, t + 0.05);
    env.gain.setValueAtTime(0.28, t + 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    o.connect(filter).connect(trem).connect(env).connect(ctx.destination);
    o.start(t); lfo.start(t);
    o.stop(t + 0.9); lfo.stop(t + 0.9);
  }
  const sfx = {
    step: (i) => tone(520 + i * 90, 0.1, 'triangle', 0.2),
    win: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, i * 0.08)); bleat(0.3); },
    lose: () => { tone(330, 0.22, 'triangle', 0.2); tone(233, 0.4, 'triangle', 0.2, 0.2); },
    fanfare: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.07, i * 0.12)),
  };

  /* ================= Écran allumé (Wake Lock) ================= */
  let wake = null;
  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && !wake) {
        wake = await navigator.wakeLock.request('screen');
        wake.addEventListener('release', () => { wake = null; });
      }
    } catch (e) { wake = null; }
  }
  function releaseWake() {
    try { wake && wake.release(); } catch (e) {}
    wake = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.inGame) keepAwake();
  });

  /* ================= Pelotes de laine ================= */
  function puffs(n = 26) {
    const layer = document.createElement('div');
    layer.className = 'puffs';
    const colors = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFC93C', '#FF5C7A', '#4D9FFF'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span');
      p.className = 'puff';
      p.style.cssText = [
        `--s:${10 + Math.random() * 22}px`,
        `left:${Math.random() * 100}%`,
        `--d:${1.6 + Math.random() * 1.4}s`,
        `--delay:${Math.random() * 0.45}s`,
        `--x:${(Math.random() - 0.5) * 140}px`,
        `--r:${Math.random() * 360}deg`,
        `--c:${colors[i % colors.length]}`,
      ].join(';');
      layer.append(p);
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), 3800);
  }

  /* ================= Composants ================= */
  function topbar() {
    const t = team();
    return `
      <header class="topbar">
        <span class="chip" style="--team:${t.color}"><span class="chip__dot"></span>${esc(t.name)}</span>
        ${S.pot > 0 ? `<span class="pot-pill">Pot ${S.pot}</span>` : ''}
        <button class="icon-btn" data-action="menu" aria-label="Menu">${ICON.menu}</button>
      </header>`;
  }

  function potBanner() {
    return S.streak > 0
      ? `<p class="banner">Carte n°${S.streak + 1} · ${pts(S.pot)} dans le pot. Un raté et tout s’envole&nbsp;!</p>`
      : '';
  }

  function scoreboard() {
    const reader = readerIndex();
    return `
      <ul class="scores">
        ${S.teams.map((t, i) => `
          <li class="score ${i === S.current ? 'is-active' : ''}" style="--team:${t.color};--i:${i}">
            <div class="score__top">
              <span class="score__name">${esc(t.name)}</span>
              ${i === S.current ? '<span class="tag">Troupeau</span>' : i === reader ? '<span class="tag tag--alt">Berger</span>' : ''}
              <b class="score__pts">${t.score}</b>
            </div>
            <div class="bar"><span style="width:${Math.min(100, Math.round((t.score / S.target) * 100))}%"></span></div>
          </li>`).join('')}
      </ul>
      <p class="goal">Premier troupeau à ${S.target} points</p>`;
  }

  function flashLine(line, i) {
    const state = i < S.flashStep ? 'is-done' : i === S.flashStep ? 'is-current' : '';
    return `
      <li class="flash-line ${state}" style="--i:${i}">
        <span class="flash-line__n">${i < S.flashStep ? ICON.check : i + 1}</span>
        <span class="flash-line__t">${esc(line)}</span>
      </li>`;
  }

  /* ================= Vues ================= */
  const VIEWS = {
    home() {
      const canResume = S.inGame && S.teams.length;
      return `
        <section class="screen">
          <div class="body">
            <div class="home-hero">
              ${sheep('sheep--hero')}
              <div class="hop-shadow" aria-hidden="true"></div>
              <h1 class="logo" aria-label="Troupeau"><span aria-hidden="true">${bounceText(['Troupeau'])}</span></h1>
              <p class="tagline">Pensez pareil. Bêlez ensemble.</p>
            </div>
          </div>
          <div class="actions">
            ${canResume ? '<button class="btn btn--primary" data-action="resume">Reprendre la partie</button>' : ''}
            <button class="btn ${canResume ? '' : 'btn--primary'}" data-action="newGame">Nouvelle partie</button>
            <button class="btn btn--ghost" data-action="rules">Comment jouer&nbsp;?</button>
          </div>
        </section>`;
    },

    setup() {
      const { names, target } = S.setup;
      return `
        <section class="screen">
          <header class="topbar">
            <button class="icon-btn" data-action="home" aria-label="Retour">${ICON.back}</button>
            <h2 class="topbar__title">Les troupeaux</h2>
          </header>
          <div class="body">
            <p class="hint">De 2 à 6 équipes de <strong>2 ou 3 joueurs</strong>. Donnez-leur un nom qui bêle.</p>
            <ul class="team-list">
              ${names.map((n, i) => `
                <li class="team-row" style="--team:${TEAM_COLORS[i]};--i:${i}">
                  <span class="team-row__dot"></span>
                  <label class="sr-only" for="team-${i}">Nom de l'équipe ${i + 1}</label>
                  <input id="team-${i}" data-team-input data-index="${i}" maxlength="20" autocomplete="off" autocapitalize="words" enterkeyhint="${i < names.length - 1 ? 'next' : 'done'}"
                    placeholder="${esc(DEFAULT_NAMES[i])}" value="${esc(n)}">
                  <button class="icon-btn" data-action="removeTeam" data-index="${i}" aria-label="Retirer l'équipe ${i + 1}" ${names.length <= 2 ? 'disabled' : ''}>${ICON.close}</button>
                </li>`).join('')}
            </ul>
            ${names.length < MAX_TEAMS ? '<button class="btn btn--dashed" data-action="addTeam">+ Ajouter un troupeau</button>' : ''}
            <h3 class="section-label">Objectif</h3>
            <div class="segmented" role="group" aria-label="Points pour gagner">
              ${TARGETS.map((v) => `<button class="btn" data-action="setTarget" data-value="${v}" aria-pressed="${v === target}">${v}<small>points</small></button>`).join('')}
            </div>
          </div>
          <div class="actions">
            <button class="btn btn--primary" data-action="startGame">C'est parti&nbsp;!</button>
          </div>
        </section>`;
    },

    rules() {
      return `
        <section class="screen">
          <header class="topbar">
            <button class="icon-btn" data-action="back" aria-label="Retour">${ICON.back}</button>
            <h2 class="topbar__title">Comment jouer</h2>
          </header>
          <div class="body rules">
            <article class="rule">
              <h3>Le but</h3>
              <p>Répondre <strong>exactement la même chose</strong> que vos coéquipiers, en même temps. Le premier troupeau qui atteint l'objectif gagne.</p>
            </article>
            <article class="rule">
              <h3>Avant de jouer</h3>
              <p>Formez des équipes de 2 ou 3. Si un troupeau a un joueur de plus, le Berger désigne qui se tait avant chaque réponse.</p>
            </article>
            <article class="rule">
              <h3>Un tour</h3>
              <ol>
                <li>Le téléphone passe à l'équipe suivante&nbsp;: c'est le <strong>Berger</strong>. Il lit et il arbitre.</li>
                <li>Une carte est tirée au hasard&nbsp;:
                  <span class="lvl-inline lvl-1">Doux +1</span>
                  <span class="lvl-inline lvl-2">Frisé +2</span>
                  <span class="lvl-inline lvl-3">Sauvage +3</span>
                  ou <span class="lvl-inline lvl-flash">Flash +3</span></li>
                <li>Le Berger lit le thème à voix haute.</li>
                <li>Le troupeau réfléchit <strong>en silence</strong>, compte «&nbsp;1, 2, 3&nbsp;» à voix haute et tout le monde répond en même temps.</li>
                <li>Le Berger juge&nbsp;: même réponse pour tout le monde&nbsp;? Les points vont dans le pot.</li>
              </ol>
            </article>
            <article class="rule">
              <h3>Cartes flash</h3>
              <p>Cinq débuts de phrases à compléter, lus <strong>à la suite</strong>. Le troupeau répond en chœur à chacune, sans réfléchir. Les cinq réponses doivent être identiques pour gagner 3&nbsp;points.</p>
            </article>
            <article class="rule">
              <h3>Tout ou rien</h3>
              <p>Après une réussite, le troupeau choisit&nbsp;: <strong>encaisser</strong> le pot, ou tirer <strong>une autre carte</strong> pour le grossir. Un seul raté et tout le pot du tour s'envole.</p>
            </article>
            <article class="rule">
              <h3>Le Berger est roi</h3>
              <ul>
                <li>Une fois par tour, il peut changer de carte avant de la lire.</li>
                <li>Pluriels et articles, on est cool&nbsp;: «&nbsp;les chats&nbsp;» = «&nbsp;chat&nbsp;».</li>
                <li>Synonymes, non&nbsp;: «&nbsp;auto&nbsp;» ≠ «&nbsp;voiture&nbsp;».</li>
              </ul>
            </article>
          </div>
          <div class="actions">
            <button class="btn btn--primary" data-action="back">Compris&nbsp;!</button>
          </div>
        </section>`;
    },

    handoff() {
      const t = team();
      const r = team(readerIndex());
      return `
        <section class="screen">
          <header class="topbar">
            <span class="eyebrow">${S.firstTurn ? 'Tiré au sort' : 'Nouveau tour'}</span>
            <button class="icon-btn" data-action="menu" aria-label="Menu">${ICON.menu}</button>
          </header>
          <div class="body body--center">
            <p class="eyebrow">Au tour du troupeau</p>
            <div class="team-badge team-badge--big" style="--team:${t.color}">${esc(t.name)}</div>
            <div class="pass-card">
              ${sheep('sheep--pass')}
              <p class="pass-card__row">${ICON.phone} Passe le téléphone au Berger&nbsp;:</p>
              <div class="team-badge" style="--team:${r.color}">${esc(r.name)}</div>
              <p class="hint">Le Berger lit les cartes et juge les réponses.</p>
            </div>
            ${scoreboard()}
          </div>
          <div class="actions">
            <button class="btn btn--primary" data-action="draw">C'est nous le Berger</button>
          </div>
        </section>`;
    },

    card() {
      return S.kind === 'flash' ? VIEWS.flashCard() : VIEWS.normalCard();
    },

    normalCard() {
      const L = LEVELS[S.level];
      return `
        <section class="screen">
          ${topbar()}
          <div class="body">
            ${potBanner()}
            <p class="eyebrow">Berger, lis à voix haute</p>
            <article class="prompt-card lvl-${S.level}">
              <div class="prompt-card__head">
                <span class="prompt-card__lvl">${L.name}</span>
                <span class="prompt-card__lvl">+${L.pts}</span>
              </div>
              <p class="prompt-card__text" aria-label="${esc(S.prompt)}"><span aria-hidden="true">${popWords(S.prompt)}</span></p>
              ${sheep()}
            </article>
            <p class="hint">Le troupeau réfléchit <strong>en silence</strong>, compte «&nbsp;1, 2, 3&nbsp;» et tout le monde répond en même temps.</p>
          </div>
          <div class="actions">
            <div class="verdict">
              <button class="btn btn--yes" data-action="verdict" data-value="same">${ICON.check}Même réponse</button>
              <button class="btn btn--no" data-action="verdict" data-value="diff">${ICON.cross}Pas pareil</button>
            </div>
            ${S.skipsLeft > 0 ? '<button class="btn btn--ghost" data-action="skip">Changer de carte (1 joker)</button>' : ''}
          </div>
        </section>`;
    },

    flashCard() {
      return `
        <section class="screen">
          ${topbar()}
          <div class="body">
            ${potBanner()}
            <p class="eyebrow">Carte flash · enchaîne les 5 phrases</p>
            <article class="flash-card">
              <div class="prompt-card__head">
                <span class="prompt-card__lvl">${ICON.bolt}Flash</span>
                <span class="prompt-card__lvl">+${FLASH.pts}</span>
              </div>
              <ol class="flash-list">${S.flash.map(flashLine).join('')}</ol>
            </article>
            <p class="hint">Lis la phrase, le troupeau la complète <strong>en chœur</strong>. Une seule fausse note et la carte est ratée.</p>
          </div>
          <div class="actions">
            <div class="verdict">
              <button class="btn btn--yes" data-action="flashStep" data-value="same">${ICON.check}Pareil</button>
              <button class="btn btn--no" data-action="flashStep" data-value="diff">${ICON.cross}Raté</button>
            </div>
            ${S.skipsLeft > 0 && S.flashStep === 0 ? '<button class="btn btn--ghost" data-action="skip">Changer de carte (1 joker)</button>' : ''}
          </div>
        </section>`;
    },

    same() {
      const t = team();
      const wins = t.score + S.pot >= S.target;
      return `
        <section class="screen screen--same">
          ${topbar()}
          <div class="body body--center">
            <div class="herd herd--sync">${sheep()}${sheep()}${sheep()}</div>
            <h2 class="big-title" aria-label="${S.kind === 'flash' ? 'Flash réussi !' : 'Bêêêlle unanimité !'}"><span aria-hidden="true">${S.kind === 'flash'
              ? bounceText(['Flash', 'réussi !'])
              : bounceText(['Bêêêlle', 'unanimité !'])}</span></h2>
            <p class="gain">+${S.gain} dans le pot</p>
            <div class="pot">
              <span class="pot__label">Pot du tour</span>
              <span class="pot__value">${reduceMotion() ? S.pot : S.pot - S.gain}</span>
              <span class="pot__sub">Score&nbsp;: ${t.score} → ${t.score + S.pot}</span>
            </div>
            <p class="hint"><strong>Troupeau</strong>, à vous de choisir&nbsp;:</p>
          </div>
          <div class="actions">
            ${wins
              ? '<button class="btn btn--primary" data-action="bank">Encaisser et gagner&nbsp;!</button>'
              : `<button class="btn btn--primary" data-action="bank">Encaisser ${pts(S.pot)}</button>
                 <button class="btn" data-action="again">Encore une carte · tout ou rien</button>`}
          </div>
        </section>`;
    },

    diff() {
      return `
        <section class="screen screen--diff">
          ${topbar()}
          <div class="body body--center">
            <div class="herd herd--scatter">${sheep()}${sheep()}${sheep()}</div>
            <h2 class="big-title" aria-label="Le troupeau s'est dispersé…"><span aria-hidden="true">${bounceText(['Le troupeau', 's’est dispersé…'])}</span></h2>
            <p class="lead">${S.lost > 0 ? `${pts(S.lost)} perdus en route.` : 'Pas de point pour ce tour.'}</p>
          </div>
          <div class="actions">
            <button class="btn btn--primary" data-action="nextTurn">Troupeau suivant</button>
          </div>
        </section>`;
    },

    win() {
      const t = team();
      const ranking = [...S.teams].sort((a, b) => b.score - a.score);
      return `
        <section class="screen">
          <div class="body body--center">
            <div class="winner-mark">${ICON.crown}${sheep()}</div>
            <p class="eyebrow">Le troupeau le plus soudé</p>
            <div class="team-badge team-badge--big" style="--team:${t.color}">${esc(t.name)}</div>
            <ol class="ranking">
              ${ranking.map((x, i) => `<li style="--team:${x.color};--i:${i}"><i></i><span>${esc(x.name)}</span><b>${x.score}</b></li>`).join('')}
            </ol>
          </div>
          <div class="actions">
            <button class="btn btn--primary" data-action="rematch">Revanche&nbsp;!</button>
            <button class="btn btn--ghost" data-action="newGame">Nouvelles équipes</button>
          </div>
        </section>`;
    },
  };

  /* Effets lancés après l'affichage d'un écran */
  const AFTER = {
    handoff() {
      later(() => FX.shake('md'), 520); // le badge d'équipe s'écrase comme un tampon
    },
    card() {
      later(() => FX.shake('sm'), 620); // la carte claque sur la table
    },
    same() {
      sfx.win();
      buzz([40, 50, 40]);
      FX.burst(window.innerWidth / 2, window.innerHeight * 0.3, 28);
      puffs(36);
      // Le pot compte jusqu'à sa nouvelle valeur, point par point
      const el = app.querySelector('.pot__value');
      const from = S.pot - S.gain;
      if (!reduceMotion()) {
        for (let k = 1; k <= S.gain; k++) {
          later(() => {
            el.textContent = from + k;
            el.classList.remove('pop');
            void el.offsetWidth;
            el.classList.add('pop');
            tone(660 + k * 120, 0.12, 'triangle', 0.18);
            FX.burstFrom(el, 10);
          }, 900 + k * 260);
        }
      }
    },
    diff() {
      sfx.lose();
      buzz(320);
      FX.shake('lg');
      later(() => FX.shake('md'), 650);
    },
    win() {
      puffs(60);
      FX.burst(window.innerWidth / 2, window.innerHeight * 0.45, 36);
      later(() => puffs(40), 900);
      later(() => { FX.shake('lg'); FX.burstFrom(app.querySelector('.crown'), 22); }, 1500); // la couronne atterrit
      sfx.fanfare();
      buzz([60, 60, 60, 60, 160]);
    },
  };

  /* ================= Navigation ================= */
  function go(screen) {
    clearTimers();
    S.screen = screen;
    save();
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    document.body.dataset.tone = TONES[S.screen] || '';
    app.innerHTML = VIEWS[S.screen]();
    const after = AFTER[S.screen];
    if (after) after();
  }

  function resetTurn() {
    S.pot = 0;
    S.streak = 0;
    S.gain = 0;
    S.lost = 0;
    S.skipsLeft = 1;
  }

  function nextTurn() {
    S.current = (S.current + 1) % S.teams.length;
    S.firstTurn = false;
    resetTurn();
    go('handoff');
  }

  function success() {
    S.gain = cardPts();
    S.pot += S.gain;
    S.streak += 1;
    go('same');
  }

  function failure() {
    S.lost = S.pot;
    S.pot = 0;
    go('diff');
  }

  /* Avance d'une ligne sur la carte flash sans redessiner l'écran */
  function advanceFlashLine() {
    const card = app.querySelector('.flash-card');
    const lines = app.querySelectorAll('.flash-line');
    card.classList.add('is-live');
    const done = lines[S.flashStep - 1];
    done.className = 'flash-line is-done';
    done.querySelector('.flash-line__n').innerHTML = ICON.check;
    if (lines[S.flashStep]) lines[S.flashStep].className = 'flash-line is-current';
    FX.burstFrom(done.querySelector('.flash-line__n'), 12);
    FX.shake('sm');
    const joker = app.querySelector('[data-action="skip"]');
    if (joker) joker.remove();
  }

  /* La carte en jeu (normale ou flash) */
  const currentCard = () => app.querySelector('.prompt-card, .flash-card');

  /* Raté : flash rouge, grosse secousse, la carte tombe de la table */
  function crash() {
    FX.flash('#FF5C7A');
    FX.shake('lg');
    buzz([80, 40, 120]);
    leave(currentCard(), 'is-falling', 520, failure);
  }

  function startSetup() {
    S.inGame = false;
    releaseWake();
    S.setup = {
      names: S.teams.length >= 2 ? S.teams.map((t, i) => (t.name === DEFAULT_NAMES[i] ? '' : t.name)) : ['', ''],
      target: S.target || 10,
    };
    go('setup');
  }

  /* ================= Menu & confirmation ================= */
  function openMenu() {
    sheet.innerHTML = `
      <div class="sheet__backdrop" data-action="closeMenu"></div>
      <div class="sheet__panel" role="dialog" aria-modal="true" aria-label="Menu de la partie">
        <div class="sheet__grip"></div>
        <h3 class="sheet__title">Scores</h3>
        ${scoreboard()}
        <div class="sheet__actions">
          <button class="btn btn--small" data-action="toggleSound">Son : ${S.sound ? 'activé' : 'coupé'}</button>
          <button class="btn btn--small" data-action="rules">Règles</button>
          <button class="btn btn--small btn--danger" data-action="quit">Abandonner la partie</button>
          <button class="btn btn--primary" data-action="closeMenu">Reprendre</button>
        </div>
      </div>`;
    sheet.hidden = false;
  }

  let pendingConfirm = null;
  function closeMenu() {
    sheet.hidden = true;
    sheet.innerHTML = '';
    pendingConfirm = null;
  }

  /* Confirmation intégrée (window.confirm est bloqué dans certains contextes) */
  function ask(message, yesLabel, onYes) {
    sheet.innerHTML = `
      <div class="sheet__backdrop" data-action="closeMenu"></div>
      <div class="sheet__panel" role="alertdialog" aria-modal="true" aria-label="${esc(message)}">
        <div class="sheet__grip"></div>
        <h3 class="sheet__title">${esc(message)}</h3>
        <div class="sheet__actions">
          <button class="btn btn--no" data-action="confirmYes">${esc(yesLabel)}</button>
          <button class="btn" data-action="closeMenu">Annuler</button>
        </div>
      </div>`;
    sheet.hidden = false;
    pendingConfirm = onYes;
  }

  /* ================= Actions ================= */
  const ACTIONS = {
    home: () => go('home'),

    resume() {
      keepAwake();
      go(S.resumeTo && VIEWS[S.resumeTo] ? S.resumeTo : 'handoff');
    },

    newGame() {
      if (S.inGame) {
        ask('Une partie est en cours. On en commence une nouvelle ?', 'Nouvelle partie', startSetup);
        return;
      }
      startSetup();
    },

    confirmYes() {
      const fn = pendingConfirm;
      closeMenu();
      if (fn) fn();
    },

    rules() {
      S.rulesFrom = S.screen === 'rules' ? S.rulesFrom : S.screen;
      closeMenu();
      go('rules');
    },

    back: () => go(S.rulesFrom || 'home'),

    addTeam() {
      if (S.setup.names.length >= MAX_TEAMS) return;
      S.setup.names.push('');
      save();
      render();
      // Seule la nouvelle équipe tombe du ciel, les autres restent en place
      const rows = [...app.querySelectorAll('.team-row')];
      rows.slice(0, -1).forEach((r) => { r.style.animation = 'none'; });
      app.querySelector('.screen').style.animation = 'none';
      app.querySelectorAll('.screen > *').forEach((c) => { c.style.animation = 'none'; });
      rows[rows.length - 1].querySelector('input').focus();
    },

    removeTeam(el) {
      if (S.setup.names.length <= 2) return;
      leave(el.closest('.team-row'), 'is-out', 280, () => {
        S.setup.names.splice(+el.dataset.index, 1);
        save();
        render();
        app.querySelectorAll('.team-row, .screen > *').forEach((r) => { r.style.animation = 'none'; });
      });
    },

    setTarget(el) {
      S.setup.target = +el.dataset.value;
      save();
      app.querySelectorAll('[data-action="setTarget"]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === el));
      });
      FX.burstFrom(el, 10);
    },

    startGame() {
      S.teams = S.setup.names.map((n, i) => ({
        name: (n.trim() || DEFAULT_NAMES[i]).slice(0, 20),
        color: TEAM_COLORS[i],
        score: 0,
      }));
      S.target = S.setup.target;
      S.current = Math.floor(Math.random() * S.teams.length);
      S.firstTurn = true;
      S.inGame = true;
      resetTurn();
      keepAwake();
      go('handoff');
    },

    draw() {
      drawCard();
      go('card');
    },

    skip() {
      if (S.skipsLeft <= 0) return;
      S.skipsLeft -= 1;
      // La carte est balancée hors de l'écran avant d'en tirer une autre
      leave(currentCard(), 'is-tossed', 420, () => {
        drawCard();
        go('card');
      });
    },

    verdict(el) {
      if (el.dataset.value !== 'same') { crash(); return; }
      FX.burstFrom(el, 24);
      FX.flash('#8EDB6A');
      leave(currentCard(), 'is-popped', 340, success);
    },

    flashStep(el) {
      if (el.dataset.value !== 'same') { crash(); return; }
      S.flashStep += 1;
      save();
      sfx.step(S.flashStep);
      buzz(20);
      advanceFlashLine();
      if (S.flashStep >= FLASH.lines) {
        // Cinq sur cinq : éclair plein écran
        busy = true;
        setTimeout(() => {
          busy = false;
          FX.flash('#FFFFFF', true);
          FX.shake('lg');
          leave(currentCard(), 'is-popped', 420, success);
        }, reduceMotion() ? 0 : 280);
      }
    },

    bank() {
      const t = team();
      FX.burstFrom(app.querySelector('.pot'), 30);
      leave(app.querySelector('.pot'), 'is-banked', 480, () => {
        t.score += S.pot;
        S.pot = 0;
        if (t.score >= S.target) {
          S.inGame = false;
          releaseWake();
          go('win');
        } else {
          nextTurn();
        }
      });
    },

    again() {
      drawCard();
      go('card');
    },

    nextTurn,

    rematch() {
      S.teams.forEach((t) => { t.score = 0; });
      S.current = Math.floor(Math.random() * S.teams.length);
      S.firstTurn = true;
      S.inGame = true;
      resetTurn();
      keepAwake();
      go('handoff');
    },

    menu: openMenu,
    closeMenu,

    toggleSound() {
      S.sound = !S.sound;
      save();
      openMenu();
    },

    quit() {
      ask('Abandonner la partie en cours ?', 'Abandonner', () => {
        S.inGame = false;
        releaseWake();
        go('home');
      });
    },
  };

  /* ================= Événements ================= */
  document.addEventListener('click', (e) => {
    unlockAudio();
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled || busy) return;
    if (el.classList.contains('btn') || el.classList.contains('icon-btn')) FX.boing(el);
    const fn = ACTIONS[el.dataset.action];
    if (fn) fn(el);
  });

  document.addEventListener('input', (e) => {
    if (e.target.matches('[data-team-input]')) {
      S.setup.names[+e.target.dataset.index] = e.target.value;
      save();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) closeMenu();
    if (e.key === 'Enter' && e.target.matches('[data-team-input]')) {
      e.preventDefault();
      const inputs = [...app.querySelectorAll('[data-team-input]')];
      const next = inputs[inputs.indexOf(e.target) + 1];
      next ? next.focus() : e.target.blur();
    }
  });

  /* ================= Démarrage ================= */
  if (LEGACY_SCREENS.includes(S.screen)) {
    // Sauvegarde d'une ancienne version : on reprend sur une carte si elle existe
    S.screen = S.prompt ? 'card' : 'handoff';
    S.kind = 'normal';
  }
  if (GAME_SCREENS.includes(S.screen) || S.screen === 'win' || S.screen === 'rules') {
    S.resumeTo = S.inGame && GAME_SCREENS.includes(S.screen) ? S.screen : null;
    S.screen = 'home';
  }
  if (!S.inGame) S.resumeTo = null;
  render();
})();
