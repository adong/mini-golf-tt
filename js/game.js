/* TT Mini Golf: the game. The title screen, holes and turns (1 player, or 2 taking turns), aiming (drag back like a
   slingshot, tap-and-hold, or the arrows and Space), strokes, EASY's helps, the scorecard, celebrations, the buddy,
   the HUD and window.game for testing.
   Load order: kit, title.js, physics.js, courses.js, autopilot.js, checks.js, sfx.js, scene.js, buddy.js, then this. */
(function () {
  'use strict';
  const Kit = window.Kit, MG = window.MG, P = MG.Phys, A = MG.Auto, SC = MG.scene, S = Kit.sound, sfx = MG.sfx, buddy = MG.buddy;

  // ---------------------------------------------------------------- tuning
  const LIMIT = { easy: 6, normal: 10 }; // EASY: after 6 strokes the ball is put in for you; NORMAL: 10 at most
  const GUIDE = { normal: 1.5 }; // NORMAL's aim line (m); EASY's runs to the first bounce and a bit after
  const BASE = 0.8; // people are drawn at 80 % of the kit's size
  const SNAP_ANGLE = 6 * (Math.PI / 180), SNAP_POWER = 0.1; // close to the buddy's tip and the aim clicks onto it
  const BALL_COLORS = { teddy: '#3d9bff', tommy: '#ff9f1c', zoom: '#ff3d7f', luna: '#b06bff', bolt: '#c9ccd6', bruno: '#a0662d', zombie: '#7ed957' };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ttMiniGolf.' + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ttMiniGolf.' + k, String(v)); } catch (e) { /* storage blocked */ } },
  };

  // ---------------------------------------------------------------- state
  const G = {
    state: 'loading', prev: null, stateT: 0, held: false, autoPause: true, clock: 0,
    nPlayers: 1, picks: ['teddy', 'tommy'], course: 0, hole: 0, turn: 0, players: [],
    H: null, W: null, overview: false, aim: 0, power: 0, yaw: 0, hint: null, snapped: false, pendingTurn: null,
    lastShot: null, celebrate: 0,
  };
  let thumbs = {};
  const ROSTER = () => Kit.roster.list;

  // ---------------------------------------------------------------- DOM
  const $ = (id) => document.getElementById(id);
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  function toast(text, cls) {
    if (G.state === 'title') return;
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), cls === 'big' ? 2700 : cls === 'hint' ? 3300 : 1900);
    while (box.children.length > 3) box.firstChild.remove();
  }

  const cur = () => G.players[G.turn];
  const def = () => MG.courses[G.course].holes[G.hole];
  const theme = () => MG.courses[G.course].theme;

  // ---------------------------------------------------------------- boot
  function boot() {
    SC.init($('game'));
    thumbs = Kit.portraits(ROSTER());
    buddy.init({
      toast, sfx,
      hole: () => G.H,
      ballPos: () => { const p = cur(); return p ? P.ballPos(G.W, p.ball, {}) : { x: 0, y: 0, z: 0 }; },
      // the treat lands just behind your golfer, clear of the ball
      playerFeet: () => {
        const pp = cur() && cur().person;
        const v = pp ? pp.holder.position.clone() : new THREE.Vector3();
        const th = pp ? pp.holder.rotation.y : 0;
        v.x += Math.sin(th) * 0.45; v.z += Math.cos(th) * 0.45; v.y += 0.2;
        return v;
      },
      plan: () => {
        const p = cur();
        if (!p || !G.W) return null;
        return A.planSteps(G.H, p.level, p.ball.x, p.ball.z, G.W.tick, { robust: true });
      },
      gotHint,
    });
    G.picks = [store.get('p1', 'teddy'), store.get('p2', 'tommy')].map((id) => (Kit.roster.get(id) ? id : 'teddy'));
    G.nPlayers = +store.get('n', 1) === 2 ? 2 : 1;
    G.course = clamp(+store.get('course', 0) || 0, 0, MG.courses.length - 1);
    buildLogo();
    buildTitle();
    wireUI();
    resize();
    window.addEventListener('resize', resize);
    toTitle();
    show('loading', false);
    G.last = performance.now();
    requestAnimationFrame(loop);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w && h) SC.fit(w, h);
  }

  function buildLogo() {
    const t = window.MG_TITLE || 'Mini Golf';
    const i = t.indexOf(' ');
    const l1 = i > 0 ? t.slice(0, i) : t, l2 = i > 0 ? t.slice(i + 1) : '';
    const tt = (s) => s.toUpperCase().replace(/TT/g, '<em>T</em><em>T</em>');
    $('logo').innerHTML = `<span class="l1">${tt(l1)}</span>` + (l2 ? `<span class="l2">${tt(l2)} ⛳</span>` : '');
  }

  // ---------------------------------------------------------------- title: players, levels, course
  const levelOf = (id) => store.get('level.' + id, 'easy') === 'normal' ? 'normal' : 'easy';
  function buildTitle() {
    const slots = $('slots');
    slots.innerHTML = '';
    for (let i = 0; i < 2; i++) {
      const s = document.createElement('div');
      s.className = 'slot';
      s.dataset.i = i;
      s.innerHTML = `<div class="who">PLAYER ${i + 1}</div>
        <div class="face"><button class="arrow" data-d="-1" aria-label="Previous">◀</button><img alt=""><button class="arrow" data-d="1" aria-label="Next">▶</button></div>
        <div class="nm"></div>
        <div class="seg" role="group" aria-label="How hard"><button data-level="easy">🐣 EASY</button><button data-level="normal">🔥 NORMAL</button></div>`;
      s.querySelectorAll('.arrow').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); S.init(); sfx('click'); cyclePick(i, +b.dataset.d); }));
      s.querySelector('img').addEventListener('click', () => { S.init(); sfx('click'); cyclePick(i, 1); });
      s.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', (e) => {
        e.stopPropagation(); S.init(); sfx('click');
        store.set('level.' + G.picks[i], b.dataset.level);
        refreshTitle();
      }));
      slots.appendChild(s);
    }
    const cs = $('courses');
    cs.innerHTML = '';
    if (MG.courses.length > 1) {
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', 'Course');
      MG.courses.forEach((c, i) => {
        const b = document.createElement('button');
        b.dataset.c = i;
        b.textContent = `${c.emoji} ${c.name.toUpperCase()}`;
        b.addEventListener('click', (e) => { e.stopPropagation(); S.init(); sfx('click'); G.course = i; store.set('course', i); refreshTitle(); showTitleHole(); });
        seg.appendChild(b);
      });
      cs.appendChild(seg);
    }
    refreshTitle();
  }
  function cyclePick(i, d) {
    const list = ROSTER().map((c) => c.id);
    let k = list.indexOf(G.picks[i]);
    for (let n = 0; n < list.length; n++) {
      k = (k + d + list.length) % list.length;
      if (G.nPlayers === 1 || list[k] !== G.picks[1 - i]) break;
    }
    G.picks[i] = list[k];
    store.set('p' + (i + 1), list[k]);
    refreshTitle();
    titleCast();
  }
  function setPlayers(n) {
    G.nPlayers = n;
    store.set('n', n);
    if (n === 2 && G.picks[0] === G.picks[1]) G.picks[1] = Kit.roster.buddyFor(G.picks[0]);
    refreshTitle();
    titleCast();
  }
  function refreshTitle() {
    document.querySelectorAll('#modeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === G.nPlayers)));
    document.querySelectorAll('#slots .slot').forEach((s, i) => {
      const id = G.picks[i], e = Kit.roster.get(id);
      s.style.display = i < G.nPlayers ? '' : 'none';
      s.dataset.id = id;
      s.querySelector('img').src = thumbs[id];
      s.querySelector('.nm').textContent = e.name;
      s.querySelector('.who').textContent = G.nPlayers === 1 ? 'YOUR GOLFER' : `PLAYER ${i + 1}`;
      const lv = levelOf(id);
      s.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === lv)));
    });
    document.querySelectorAll('#courses button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.c === G.course)));
    const id = G.picks[0], lv = levelOf(id), best = +store.get(`best.${MG.courses[G.course].id}.${lv}.${id}`, 0);
    $('bestLine').innerHTML = best ? `<span>${Kit.roster.get(id).name}'S BEST</span> <b>${best}</b>` : '';
  }

  // the title screen shows hole 1 of the course with your golfers on the tee, the camera drifting round
  function showTitleHole() {
    G.H = P.compile(MG.courses[G.course].holes[0]);
    G.W = P.world(G.H, 'easy', null);
    SC.buildHole(G.H, theme(), 1);
    titleCast();
  }
  function titleCast() {
    if (G.state !== 'title') return;
    for (const p of G.players) { SC.removePerson(p.person); p.vis && (p.vis.mesh.visible = p.vis.ring.visible = false); }
    G.players = [];
    for (let i = 0; i < G.nPlayers; i++) G.players.push(makePlayer(G.picks[i], levelOf(G.picks[i]), i));
    const H = G.H;
    G.players.forEach((p, i) => {
      p.ball.x = H.tee.x + (i ? 0.5 : 0);
      p.ball.z = H.tee.z;
      const bp = P.ballPos(G.W, p.ball, {});
      if (i === 0) SC.standToPutt(p.person, bp.x, bp.y, bp.z, 0);
      else { p.person.holder.position.set(H.tee.x + 1.6, -0.35, H.tee.z + 1.6); p.person.mode = 'peace'; }
      if (i === 0) p.person.mode = 'putt';
    });
    G.turn = 0;
  }

  function makePlayer(id, level, i) {
    const entry = Kit.roster.get(id);
    const person = SC.makePerson(entry, (entry.buddyScale || 0.85) * BASE);
    person.mode = 'stand';
    const color = BALL_COLORS[id] || '#ffffff';
    const vis = G.vis && G.vis[i] ? G.vis[i] : null;
    const v = vis || SC.makeBall(color);
    if (vis) { v.mesh.material.color.set(color); v.ring.material.color.set(color); v.color = color; }
    (G.vis = G.vis || [])[i] = v;
    return { id, entry, level, i, person, vis: v, color, ball: P.ball(0, 0), strokes: 0, scores: [], stars: [], placed: [], holed: false };
  }

  // ---------------------------------------------------------------- flow
  function setState(s) { G.state = s; G.stateT = 0; }

  function toTitle() {
    buddy.dismiss();
    setState('title');
    show('title', true); show('hud', false); show('pause', false); show('card', false); show('banner', false);
    SC.hideAim(); SC.hideHint();
    S.music('title');
    refreshTitle();
    showTitleHole();
  }

  function startGame(opts = {}) {
    buddy.dismiss();
    for (const p of G.players) SC.removePerson(p.person);
    if (opts.players) {
      G.nPlayers = Math.min(2, opts.players.length);
      G.picks = [opts.players[0], opts.players[1] || Kit.roster.buddyFor(opts.players[0])];
    }
    if (opts.course !== undefined) G.course = opts.course;
    G.players = [];
    for (let i = 0; i < G.nPlayers; i++) {
      const id = G.picks[i];
      G.players.push(makePlayer(id, (opts.levels && opts.levels[i]) || levelOf(id), i));
    }
    G.hole = opts.hole || 0;
    show('title', false); show('card', false); show('pause', false); show('hud', true);
    buildPlayersHud();
    S.music('play');
    startHole();
  }

  function startHole(quick) {
    const d = def();
    G.H = P.compile(d);
    G.W = P.world(G.H, 'normal', onEvent);
    A.field(G.H);
    SC.buildHole(G.H, theme(), G.hole + 1);
    G.players.forEach((p) => {
      p.ball = P.ball(G.H.tee.x, G.H.tee.z);
      p.strokes = 0;
      p.holed = false;
      p.scores[G.hole] = undefined;
      p.person.holder.visible = true;
    });
    G.turn = 0;
    G.overview = false;
    G.hint = null;
    buddy.dismiss();
    $('holeNo').textContent = `HOLE ${G.hole + 1}`;
    $('holeOf').textContent = `/ ${MG.courses[G.course].holes.length}`;
    $('holeName').textContent = d.name;
    const anyNormal = G.players.some((p) => p.level === 'normal');
    $('parText').textContent = `PAR ${d.par}`;
    $('parText').style.display = anyNormal ? '' : 'none';
    $('bannerNo').textContent = `HOLE ${G.hole + 1}`;
    $('bannerName').textContent = d.name;
    $('bannerPar').textContent = `PAR ${d.par}`;
    $('bannerPar').style.display = anyNormal ? '' : 'none';
    // the other golfers wait by the tee
    G.players.forEach((p, i) => {
      if (i) { p.person.mode = 'stand'; p.person.holder.position.set(G.H.tee.x + 1.4 + i * 0.4, -0.35, G.H.tee.z + 1.7); }
    });
    if (quick) { beginTurn(true); return; }
    setState('intro');
    show('banner', true);
    SC.camOverview(G.H, { snap: true });
    updateHud();
  }

  // the camera looks along the way to the cup (round corners, through the door...)
  function pathYaw(x, z) {
    const F = A.field(G.H);
    const a = F.ahead(x, z, 3.5);
    if (Math.hypot(a.x - x, a.z - z) < 0.25) {
      if (Math.hypot(G.H.cup.x - x, G.H.cup.z - z) < 0.3) return G.yaw;
      return Math.atan2(G.H.cup.x - x, -(G.H.cup.z - z));
    }
    return Math.atan2(a.x - x, -(a.z - z));
  }

  function beginTurn(snap) {
    show('banner', false);
    const p = cur();
    G.W.cup = P.CUP[p.level];
    const bp = P.ballPos(G.W, p.ball, {});
    G.yaw = pathYaw(p.ball.x, p.ball.z);
    G.aim = G.yaw;
    if (G.hint && G.hint.player !== p) G.hint = null;
    G.power = 0;
    G.snapped = false;
    drag = null;
    key.charge = false;
    // walk over to the ball
    p.person.walkFrom = p.person.holder.position.clone();
    p.person.walkT = snap ? 1 : 0;
    p.person.mode = 'putt';
    p.person.swing = 0;
    SC.standToPutt(p.person, bp.x, bp.y, bp.z, G.aim);
    p.person.walkTo = p.person.holder.position.clone();
    p.person.walkRot = p.person.holder.rotation.y;
    if (!snap) p.person.holder.position.copy(p.person.walkFrom);
    if (!G.overview) SC.camFollow(bp.x, bp.y, bp.z, G.yaw, { snap: !!snap, k: 3 });
    buddy.setEntry(Kit.roster.get(Kit.roster.buddyFor(p.id)));
    setBuddyButton();
    setState('aim');
    updateHud();
  }

  function shoot(angle, power) {
    if (G.state !== 'aim') return;
    const p = cur();
    S.init();
    if (G.hint && Math.abs(wrapA(angle - G.hint.angle)) < SNAP_ANGLE && Math.abs(power - G.hint.power) < SNAP_POWER) { angle = G.hint.angle; power = G.hint.power; }
    power = clamp(power, 0.02, 1);
    p.strokes++;
    G.W.cup = P.CUP[p.level];
    P.shoot(G.W, p.ball, angle, power);
    G.lastShot = { angle, power, player: p.i, tick: G.W.tick };
    sfx('putt', power);
    p.person.swing = -0.35 - power * 0.3; // follow-through
    p.person.mode = 'putt';
    G.hint = null;
    SC.hideAim(); SC.hideHint();
    show('power', false);
    $('game').classList.remove('aiming');
    setState('roll');
    updateHud();
  }

  // physics events: sounds and sparkle
  function onEvent(type, a, b) {
    const p = cur();
    if (!p) return;
    const bp = P.ballPos(G.W, p.ball, {});
    if (type === 'wall') { if (a > 0.5) sfx('wall', a); if (G.W.moving.length && G.H.windmill && Math.abs(p.ball.z - G.H.windmill.face) < 0.3) sfx('blade'); }
    else if (type === 'bumper') { sfx('bumper'); SC.bumperPop(b); SC.fx.bump(bp.x, bp.y, bp.z); }
    else if (type === 'sand') { sfx('sand'); SC.fx.sand(bp.x, bp.y, bp.z); }
    else if (type === 'loopIn') sfx('loop');
    else if (type === 'loopOut') { if (a > 0) toast('AROUND THE LOOP!'); else toast('MORE POWER!'); }
    else if (type === 'splash') { sfx('splash'); SC.fx.splash(p.ball.x, SC.height(p.ball.x, p.ball.z) - 0.1, p.ball.z); }
  }

  function ballStopped() {
    const p = cur();
    if (p.ball.mode === 'cup') return holed(false);
    if (p.ball.mode === 'water') {
      p.strokes++;
      toast('SPLASH! +1', 'water');
      setState('water');
      updateHud();
      return;
    }
    buddy.shotDone();
    afterShot();
  }

  // past the stroke limit, the ball goes in for you
  function afterShot() {
    const p = cur();
    if (p.strokes >= LIMIT[p.level]) return holed(true);
    nextTurn();
  }

  function holed(placed) {
    const p = cur();
    p.holed = true;
    if (placed) {
      p.strokes = Math.min(p.strokes, LIMIT[p.level]);
      p.ball.mode = 'cup';
      p.ball.x = G.H.cup.x;
      p.ball.z = G.H.cup.z;
    }
    p.scores[G.hole] = p.strokes;
    p.placed[G.hole] = !!placed;
    const one = !placed && p.strokes === 1;
    p.stars[G.hole] = one;
    const d = def(), diff = p.strokes - d.par;
    const cp = { x: G.H.cup.x, y: SC.height(G.H.cup.x, G.H.cup.z), z: G.H.cup.z };
    sfx('cup');
    SC.fx.sparkle(cp.x, cp.y, cp.z);
    if (one) {
      setTimeout(() => sfx('fanfare'), 250);
      SC.fx.confetti(cp.x, cp.y, cp.z);
      SC.fx.confetti(p.person.holder.position.x, 0.5, p.person.holder.position.z);
      toast('HOLE IN ONE!', 'big');
    } else if (placed) {
      sfx('cheer');
      toast(p.level === 'easy' ? 'GOOD TRY! IN IT GOES!' : 'TEN STROKES: IN IT GOES!');
    } else {
      sfx('cheer', diff < 0);
      let word = 'IN THE HOLE!';
      if (p.level === 'normal') word = diff <= -2 ? 'EAGLE!' : diff === -1 ? 'BIRDIE!' : diff === 0 ? 'PAR!' : 'IN THE HOLE!';
      else word = diff < 0 ? 'SUPER SHOT!' : 'IN THE HOLE!';
      toast(word);
      if (diff < 0) SC.fx.confetti(cp.x, cp.y, cp.z);
    }
    // he runs over to the cup, then does his signature move facing us
    const pp = p.person;
    const fx = Math.sin(G.yaw), fz = -Math.cos(G.yaw);
    let spot = null;
    for (const side of [1, -1]) {
      const x = cp.x - fx * 0.8 + fz * -0.7 * side, z = cp.z - fz * 0.8 + fx * 0.7 * side;
      if (!spot && P.onCourse(G.H, x, z)) spot = { x, z };
    }
    spot = spot || { x: cp.x - fx * 0.6, z: cp.z - fz * 0.6 };
    pp.runFrom = pp.holder.position.clone();
    pp.runTo = new THREE.Vector3(spot.x, SC.height(spot.x, spot.z), spot.z);
    pp.runT = 0;
    pp.mode = 'run';
    const sigs = p.entry.signature || ['wave'];
    G.celebrate = (G.celebrate + 1) % 2;
    pp.sig = sigs.length > 1 ? sigs[G.celebrate % sigs.length] : sigs[0];
    buddy.shotDone();
    setState('holed');
    updateHud();
  }

  function nextTurn() {
    const n = G.players.length;
    if (G.players.every((p) => p.holed)) return endHole();
    let t = G.turn;
    for (let k = 0; k < n; k++) { t = (t + 1) % n; if (!G.players[t].holed) break; }
    const changed = t !== G.turn;
    // the golfer who just played steps back beside his ball
    const old = cur();
    if (changed) {
      old.person.mode = 'stand';
      buddy.dismiss();
      G.turn = t;
      sfx('turn');
      toast(`${cur().entry.name}'S TURN!`);
    }
    beginTurn(false);
  }

  function endHole() {
    setState('card');
    showCard(false);
  }

  // ---------------------------------------------------------------- the scorecard
  function showCard(final) {
    const holes = MG.courses[G.course].holes;
    const anyNormal = G.players.some((p) => p.level === 'normal');
    let h = '<tr><th>HOLE</th>' + holes.map((_, i) => `<th class="${i === G.hole && !final ? 'now' : ''}">${i + 1}</th>`).join('') + '<th>TOTAL</th></tr>';
    if (anyNormal) h += '<tr class="parrow"><td class="nm">PAR</td>' + holes.map((d) => `<td>${d.par}</td>`).join('') + `<td>${holes.reduce((s, d) => s + d.par, 0)}</td></tr>`;
    for (const p of G.players) {
      let tot = 0;
      h += `<tr><td class="nm">${p.entry.name}</td>`;
      holes.forEach((d, i) => {
        const s = p.scores[i];
        if (s !== undefined) tot += s;
        const cls = [i === G.hole && !final ? 'now' : '', p.placed[i] ? 'placed' : p.level === 'normal' && s !== undefined ? (s < d.par ? 'under' : s > d.par + 1 ? 'over2' : '') : ''].join(' ');
        h += `<td class="${cls}">${s === undefined ? '' : s}${p.stars[i] ? '<span class="star">⭐</span>' : ''}</td>`;
      });
      h += `<td class="tot">${tot}</td></tr>`;
      p.total = tot;
    }
    $('cardTable').innerHTML = h;
    const last = G.hole >= holes.length - 1;
    show('card', true);
    show('hud', false);
    $('cardBtns').style.display = final ? 'none' : '';
    $('overBtns').style.display = final ? '' : 'none';
    $('nextBtn').textContent = last ? '🏆 SEE THE SCORES' : '▶ NEXT HOLE';
    if (!final) {
      $('cardTitle').textContent = `HOLE ${G.hole + 1} DONE!`;
      $('cardSub').textContent = '';
    } else {
      const stars = G.players.reduce((s, p) => s + p.stars.filter(Boolean).length, 0);
      if (G.players.length === 2) {
        const [a, b] = G.players;
        $('cardTitle').textContent = a.total === b.total ? "IT'S A TIE!" : `${(a.total < b.total ? a : b).entry.name} WINS!`;
      } else $('cardTitle').textContent = 'GREAT ROUND!';
      $('cardSub').textContent = stars ? `⭐ ${stars} × HOLE IN ONE!` : '';
      // best scores (lowest total), per golfer, course and level
      for (const p of G.players) {
        const k = `best.${MG.courses[G.course].id}.${p.level}.${p.id}`;
        const old = +store.get(k, 0);
        if (!old || p.total < old) store.set(k, p.total);
      }
      sfx('fanfare');
      S.music('over');
    }
  }

  function nextFromCard() {
    if (G.state === 'card') {
      const holes = MG.courses[G.course].holes;
      if (G.hole >= holes.length - 1) { setState('over'); showCard(true); return; }
      G.hole++;
      show('card', false);
      show('hud', true);
      startHole();
    }
  }

  // ---------------------------------------------------------------- HUD
  function buildPlayersHud() {
    $('players').innerHTML = G.players.map((p) => `<div class="pl" data-i="${p.i}"><img alt="" src="${thumbs[p.id]}"><span class="ball" style="background:${p.color}"></span><span class="nm">${p.entry.name}</span><span class="st">0</span></div>`).join('');
  }
  function updateHud() {
    document.querySelectorAll('#players .pl').forEach((el, i) => {
      const p = G.players[i];
      if (!p) return;
      el.classList.toggle('on', i === G.turn && G.players.length > 1);
      el.classList.toggle('done', p.holed);
      el.querySelector('.st').textContent = p.strokes;
    });
    $('camBtn').classList.toggle('on', G.overview);
  }
  function setBuddyButton() {
    const p = cur();
    if (!p) return;
    const bid = Kit.roster.buddyFor(p.id), be = Kit.roster.get(bid);
    $('buddyFace').src = thumbs[bid];
    $('buddyName').textContent = be.name;
    $('buddyBtn').title = `Call ${be.name[0] + be.name.slice(1).toLowerCase()} for a tip (T)`;
  }

  // ---------------------------------------------------------------- the buddy
  function callBuddy() {
    if (!['aim', 'roll', 'holed', 'water', 'intro'].includes(G.state)) return;
    S.init();
    if (G.state === 'intro') beginTurn(true);
    buddy.call();
  }
  function gotHint(h, name) {
    const p = cur();
    if (!h || !p) return;
    G.hint = Object.assign({ player: p, x: p.ball.x, z: p.ball.z }, h);
    const word = h.power < 0.3 ? 'SOFT' : h.power < 0.55 ? 'MEDIUM' : h.power < 0.8 ? 'HARD' : 'SUPER HARD';
    sfx('hint');
    toast(`${name} SAYS: AIM HERE, ${word}!`, 'hint');
    // the arrows start from his tip
    if (G.state === 'aim' && !drag) G.aim = h.angle;
  }

  // ---------------------------------------------------------------- input: drag (slingshot), tap-and-hold, keys
  let drag = null;
  const key = { left: false, right: false, up: false, down: false, charge: false, dir: 1, held: 0 };
  const fullPx = () => clamp(Math.min(window.innerWidth, window.innerHeight) * 0.4, 130, 330);

  function onDown(e) {
    if (G.state === 'intro') { beginTurn(false); return; }
    if (G.state !== 'aim' || drag) return;
    S.init();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: 0, mode: 'pending' };
    try { $('game').setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.mode === 'pending' && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > 12) {
      drag.mode = 'sling';
      $('game').classList.add('aiming');
    }
    if (drag.mode === 'sling') slingAim();
  }
  function slingAim() {
    const p = cur(), bp = P.ballPos(G.W, p.ball, {});
    const a = SC.pick(drag.x0, drag.y0, bp.y), b = SC.pick(drag.x, drag.y, bp.y);
    const px = Math.hypot(drag.x - drag.x0, drag.y - drag.y0);
    if (a && b && Math.hypot(a.x - b.x, a.z - b.z) > 1e-3) G.aim = Math.atan2(a.x - b.x, -(a.z - b.z));
    G.power = clamp((px - 12) / fullPx(), 0, 1);
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    $('game').classList.remove('aiming');
    if (G.state !== 'aim') return;
    if (d.mode === 'sling') {
      if (G.power > 0.03) shoot(G.aim, G.power); else G.power = 0;
    } else if (d.mode === 'charge') {
      shoot(G.aim, G.power);
    } else aimAt(d.x0, d.y0); // a tap: aim there
  }
  function onCancel(e) { if (drag && e.pointerId === drag.id) { drag = null; G.power = 0; $('game').classList.remove('aiming'); } }
  function aimAt(sx, sy) {
    const p = cur(), bp = P.ballPos(G.W, p.ball, {});
    const q = SC.pick(sx, sy, bp.y);
    if (q && Math.hypot(q.x - bp.x, q.z - bp.z) > 0.4) G.aim = Math.atan2(q.x - bp.x, -(q.z - bp.z));
  }

  function onKey(e) {
    if (e.repeat && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); return; }
    const k = e.code;
    if (k === 'KeyM') { toggleMute(); return; }
    if (G.state === 'title') {
      if (k === 'Enter' || k === 'Space') { e.preventDefault(); S.init(); startGame(); }
      else if (k === 'KeyT') { S.init(); }
      return;
    }
    if (G.state === 'card' || G.state === 'over') {
      if (k === 'Enter' || k === 'Space') { e.preventDefault(); if (G.state === 'card') nextFromCard(); else startGame(); }
      else if (k === 'Escape' && G.state === 'over') toTitle();
      return;
    }
    if (k === 'KeyP' || k === 'Escape') { G.state === 'paused' ? resume() : pause(); return; }
    if (G.state === 'paused') { if (k === 'Enter' || k === 'Space') resume(); return; }
    if (G.state === 'intro' && (k === 'Space' || k === 'Enter')) { e.preventDefault(); beginTurn(false); return; }
    if (k === 'KeyT' || k === 'KeyB') { callBuddy(); return; }
    if (k === 'KeyC') { toggleOverview(); return; }
    if (k === 'KeyR') { restartHole(); return; }
    if (k === 'ArrowLeft') { key.left = true; e.preventDefault(); }
    else if (k === 'ArrowRight') { key.right = true; e.preventDefault(); }
    else if (k === 'ArrowUp') { key.up = true; e.preventDefault(); }
    else if (k === 'ArrowDown') { key.down = true; e.preventDefault(); }
    else if ((k === 'Space' || k === 'Enter') && G.state === 'aim') {
      e.preventDefault();
      S.init();
      if (!key.charge) { key.charge = true; key.dir = 1; G.power = 0; }
    }
  }
  function onKeyUp(e) {
    const k = e.code;
    if (k === 'ArrowLeft') key.left = false;
    else if (k === 'ArrowRight') key.right = false;
    else if (k === 'ArrowUp') key.up = false;
    else if (k === 'ArrowDown') key.down = false;
    else if ((k === 'Space' || k === 'Enter') && key.charge) {
      key.charge = false;
      if (G.state === 'aim' && G.power > 0.02) shoot(G.aim, G.power); else G.power = 0;
    }
  }

  function toggleOverview() {
    if (!['aim', 'roll', 'holed', 'water'].includes(G.state)) return;
    G.overview = !G.overview;
    sfx('click');
    if (G.overview) SC.camOverview(G.H);
    updateHud();
  }
  function restartHole() {
    if (!['aim', 'roll', 'holed', 'water'].includes(G.state)) return;
    sfx('click');
    toast('START THE HOLE AGAIN');
    startHole(true);
  }
  function pause() {
    if (!['aim', 'roll', 'holed', 'water', 'intro'].includes(G.state)) return;
    G.prev = G.state;
    G.prevT = G.stateT;
    G.state = 'paused';
    show('pause', true);
    S.music('pause');
    key.charge = false;
    drag = null;
  }
  function resume() {
    if (G.state !== 'paused') return;
    G.state = G.prev;
    G.stateT = G.prevT;
    show('pause', false);
    S.music('play');
  }
  function toggleMute() {
    const m = S.toggleMute();
    $('muteBtn').textContent = m ? '🔇' : '🔊';
  }

  function wireUI() {
    const tap = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); S.init(); sfx('click'); fn(); e.currentTarget.blur(); });
    tap('playBtn', () => startGame());
    tap('againBtn', () => startGame());
    tap('menuBtn', () => toTitle());
    tap('resumeBtn', () => resume());
    tap('quitBtn', () => toTitle());
    tap('pauseBtn', () => pause());
    tap('muteBtn', () => toggleMute());
    tap('camBtn', () => toggleOverview());
    tap('restartBtn', () => restartHole());
    tap('nextBtn', () => nextFromCard());
    for (const id of ['buddyBtn', 'camBtn', 'restartBtn', 'pauseBtn', 'muteBtn']) $(id).addEventListener('pointerdown', (e) => e.stopPropagation());
    tap('buddyBtn', () => callBuddy());
    document.querySelectorAll('#modeSeg button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); S.init(); sfx('click'); setPlayers(+b.dataset.n); }));
    $('muteBtn').textContent = S.isMuted() ? '🔇' : '🔊';
    const cv = $('game');
    cv.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (G.autoPause) pause(); S.suspend(); } else S.resume();
    });
    window.addEventListener('blur', () => { key.left = key.right = key.up = key.down = false; });
  }

  // ---------------------------------------------------------------- the aim guide
  const guidePts = [];
  function drawGuide() {
    const p = cur(), bp = P.ballPos(G.W, p.ball, {});
    const dx = Math.sin(G.aim), dz = -Math.cos(G.aim);
    guidePts.length = 0;
    const y = bp.y;
    const at = (x, z) => [x, SC.height(x, z) + P.R * 0.6, z];
    if (p.level === 'easy') {
      // EASY: a long line to the first bounce, then where it bounces to
      const hit = P.cast(G.H, G.W.moving, bp.x, bp.z, dx, dz, 14);
      const len = hit ? hit.t : 14;
      for (let s = 0.3; s < len; s += 0.3) guidePts.push(at(bp.x + dx * s, bp.z + dz * s));
      if (hit) {
        const hx = bp.x + dx * hit.t, hz = bp.z + dz * hit.t;
        const dn = dx * hit.nx + dz * hit.nz, rx = dx - 2 * dn * hit.nx, rz = dz - 2 * dn * hit.nz;
        const hit2 = P.cast(G.H, G.W.moving, hx + rx * 0.01, hz + rz * 0.01, rx, rz, 1.8);
        const l2 = hit2 ? hit2.t : 1.8;
        for (let s = 0.15; s < l2; s += 0.3) guidePts.push(at(hx + rx * s, hz + rz * s));
      }
    } else {
      for (let s = 0.3; s <= GUIDE.normal; s += 0.3) guidePts.push(at(bp.x + dx * s, bp.z + dz * s));
    }
    const pw = G.power;
    const col = G.snapped ? '#ffe14a' : pw <= 0.01 ? '#ffffff' : pw < 0.5 ? '#7dff8a' : pw < 0.8 ? '#ffe14a' : '#ff6a4c';
    SC.showAim(guidePts, col);
    SC.showBand(bp.x, y, bp.z, G.aim, drag && drag.mode === 'sling' ? G.power * 1.1 : 0);
    $('powerFill').style.clipPath = `inset(0 ${(1 - pw) * 100}% 0 0)`;
    show('power', pw > 0.005 || key.charge || !!G.hint);
  }
  const hintPts = [];
  function drawHint() {
    const h = G.hint, p = cur();
    if (!h || G.state !== 'aim' || h.player !== p) { SC.hideHint(); $('powerMark').classList.remove('on'); return; }
    const bp = P.ballPos(G.W, p.ball, {});
    const dx = Math.sin(h.angle), dz = -Math.cos(h.angle);
    const len = 1 + h.power * 3.2;
    hintPts.length = 0;
    for (let s = 0.35; s <= len; s += 0.32) hintPts.push([bp.x + dx * s, SC.height(bp.x + dx * s, bp.z + dz * s) + 0.08, bp.z + dz * s]);
    SC.showHint(hintPts);
    $('powerMark').classList.add('on');
    $('powerMark').style.left = `${h.power * 100}%`;
  }

  // ---------------------------------------------------------------- the main loop
  function update(dt) {
    G.clock += dt;
    G.stateT += dt;
    if (G.state === 'paused') return;
    const st = G.state;
    if (st === 'title') {
      SC.camOrbit(G.H, G.clock);
      P.advance(G.W, dt, []);
      for (const p of G.players) {
        SC.animPerson(p.person, dt);
        const bp = P.ballPos(G.W, p.ball, {});
        SC.placeBall(p.vis, bp.x, bp.y, bp.z, { ring: false });
      }
      SC.update(G.W, dt, { cupR: P.CUP.easy.r });
      return;
    }
    if (!G.W) return;
    const p = cur();
    // the world keeps turning: windmill, bridge, rolling balls
    P.advance(G.W, dt, G.players.map((q) => q.ball));
    if (st === 'intro') {
      if (G.stateT > 2.4) beginTurn(false);
    } else if (st === 'aim') {
      // keys: turn the aim, charge the power (it swings up and down while Space is held)
      const turn = (key.right ? 1 : 0) - (key.left ? 1 : 0), fine = (key.down ? 1 : 0) - (key.up ? 1 : 0);
      if (turn || fine) {
        key.held += dt;
        G.aim = wrapA(G.aim + turn * dt * (key.held > 0.5 ? 1.8 : 0.9) + fine * dt * 0.25);
      } else key.held = 0;
      if (key.charge) {
        G.power += key.dir * dt / 1.1;
        if (G.power >= 1) { G.power = 1; key.dir = -1; }
        if (G.power <= 0) { G.power = 0; key.dir = 1; }
      }
      if (drag && drag.mode === 'pending') {
        drag.t += dt;
        if (drag.t > 0.35) { drag.mode = 'charge'; aimAt(drag.x0, drag.y0); key.dir = 1; G.power = 0; }
      }
      if (drag && drag.mode === 'charge') {
        G.power += key.dir * dt / 1.3;
        if (G.power >= 1) { G.power = 1; key.dir = -1; }
        if (G.power <= 0) { G.power = 0; key.dir = 1; }
      }
      // close to the buddy's tip? click onto it
      G.snapped = false;
      if (G.hint && G.hint.player === p && Math.abs(wrapA(G.aim - G.hint.angle)) < SNAP_ANGLE) {
        if (drag || key.left || key.right || key.charge) G.aim = G.hint.angle;
        G.snapped = !G.power || Math.abs(G.power - G.hint.power) < SNAP_POWER;
      }
      drawGuide();
      // walking up to the ball, then the putter follows your pull
      const pp = p.person;
      if (pp.walkT < 1) {
        pp.walkT = Math.min(1, pp.walkT + dt / 0.6);
        pp.holder.position.lerpVectors(pp.walkFrom, pp.walkTo, pp.walkT);
        pp.mode = pp.walkT < 1 ? 'run' : 'putt';
        if (pp.walkT < 1) SC.facePoint(pp, pp.walkTo.x, pp.walkTo.z);
      } else {
        pp.mode = 'putt';
        const bp = P.ballPos(G.W, p.ball, {});
        SC.standToPutt(pp, bp.x, bp.y, bp.z, G.aim);
        pp.swing += (G.power * 0.75 - pp.swing) * Math.min(1, dt * 14);
      }
    } else if (st === 'roll') {
      p.person.swing += (-0.5 - p.person.swing) * Math.min(1, dt * 10);
      if (p.ball.mode !== 'roll' && p.ball.mode !== 'loop') ballStopped();
    } else if (st === 'water') {
      if (G.stateT > 1.3) {
        const f = p.ball.from;
        Object.assign(p.ball, P.ball(f.x, f.z));
        p.ball.from = f;
        SC.fx.poof(f.x, SC.height(f.x, f.z), f.z);
        buddy.shotDone();
        afterShot();
      }
    } else if (st === 'holed') {
      const pp = p.person;
      if (pp.runT < 1) {
        pp.runT = Math.min(1, pp.runT + dt / Math.max(0.35, Math.min(0.9, pp.runFrom.distanceTo(pp.runTo) / 7)));
        pp.holder.position.lerpVectors(pp.runFrom, pp.runTo, pp.runT);
        SC.facePoint(pp, pp.runTo.x, pp.runTo.z);
        if (pp.runT >= 1) {
          pp.mode = pp.sig;
          const cpos = SC.camera.position;
          SC.facePoint(pp, cpos.x, cpos.z);
          if (pp.mode === 'jumpshot') {
            pp.jump = 0.7;
            const s = SC.treatSprite('🏀');
            s.position.copy(pp.holder.position);
            s.position.y += 2.2 * pp.scale;
            p.hoopBall = { s, t: 0 };
          }
        }
      }
      if (p.hoopBall) {
        const hb = p.hoopBall;
        hb.t += dt;
        hb.s.position.y += dt * 3.5;
        hb.s.position.x += dt * 1.2;
        if (hb.t > 1) { SC.removeObj(hb.s); p.hoopBall = null; }
      }
      if (G.stateT > (p.stars[G.hole] ? 3.2 : 2.6)) { p.person.mode = 'stand'; nextTurn(); }
    }
    // camera
    if (G.overview) SC.camOverview(G.H, { k: 3 });
    else if (st === 'roll' || st === 'water' || st === 'holed' || st === 'aim') {
      const bp = P.ballPos(G.W, p.ball, {});
      // swing round to the side while the ball goes round the loop, so you can see it
      G.loopCam = p.ball.mode === 'loop' ? 1.2 : Math.max(0, (G.loopCam || 0) - dt);
      G.camSide = (G.camSide || 0) + ((G.loopCam > 0 ? 0.95 : 0) - (G.camSide || 0)) * Math.min(1, dt * 3);
      SC.camFollow(bp.x, bp.y, bp.z, G.yaw + G.camSide, { k: st === 'roll' ? 3.2 : 3 });
    }
    // balls: the one playing is solid with a ring; the others are see-through
    G.players.forEach((q, i) => {
      const bp = P.ballPos(G.W, q.ball, {});
      let drop = 0, visible = true;
      if (q.ball.mode === 'cup') {
        // drop it into the cup
        q.dropT = (q.dropT || 0) + dt;
        drop = -Math.min(0.3, q.dropT * 1.2);
        visible = q.dropT < 0.5 && i === G.turn;
        bp.x = G.H.cup.x; bp.z = G.H.cup.z;
      } else q.dropT = 0;
      if (q.ball.mode === 'water') { drop = -0.12; visible = G.stateT < 0.3; }
      // hidden in the tunnel
      const tn = G.H.def.tunnel;
      if (tn && bp.z < tn.z0 - 0.05 && bp.z > tn.z1 + 0.05) visible = false;
      SC.placeBall(q.vis, bp.x, bp.y, bp.z, { drop, visible, ghost: i !== G.turn, ring: i === G.turn && st === 'aim' });
      // a waiting brother who has been called over to help is with the buddy, not by the tee
      q.person.holder.visible = i === G.turn || !(buddy.here() && buddy.entryId() === q.id);
      if (i !== G.turn || st !== 'aim') SC.animPerson(q.person, dt);
    });
    if (st === 'aim') SC.animPerson(p.person, dt);
    drawHint();
    if (st !== 'aim') { SC.hideAim(); if (!G.hint) show('power', false); }
    buddy.update(dt);
    const near = G.players.some((q) => q.ball.mode !== 'cup' && Math.hypot(q.ball.x - G.H.cup.x, q.ball.z - G.H.cup.z) < 2.2);
    SC.update(G.W, dt, { cupR: P.CUP[p.level].r, flagUp: near || st === 'holed' });
  }

  function loop(now) {
    const dt = Math.min(0.1, Math.max(0, (now - G.last) / 1000));
    G.last = now;
    if (!G.held) update(dt);
    SC.render();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- window.game: for tests
  // The Browser pane throttles requestAnimationFrame while hidden, so tests drive time themselves:
  //   game.hold(true); game.autoPause = false; game.start({ players: ['teddy'] }); game.step(3); game.shoot(0, 0.5)
  window.game = {
    get autoPause() { return G.autoPause; },
    set autoPause(v) { G.autoPause = !!v; },
    hold(on) { G.held = on !== false; },
    start(opts = {}) { S.init(); startGame(opts); return this.info(); },
    // advance the game by `seconds` in frames of 1/fps, drawing at the end
    step(seconds = 1, fps = 60) {
      const n = Math.round(seconds * fps);
      for (let i = 0; i < n; i++) update(1 / fps);
      SC.render();
      return this.info();
    },
    shoot(angle, power) { shoot(angle, power); return this.info(); },
    aim(angle) { G.aim = angle; return G.aim; },
    // play the current golfer's shot like the autopilot would (for tests)
    autoShot() {
      const p = cur();
      const s = A.plan(G.H, p.level, p.ball.x, p.ball.z, G.W.tick, { robust: true });
      shoot(s.angle, s.power);
      return s;
    },
    buddy() { callBuddy(); return buddy.info(); },
    buddyInfo: () => buddy.info(),
    hint: () => G.hint && { angle: G.hint.angle, power: G.hint.power, mode: G.hint.mode },
    overview() { toggleOverview(); return G.overview; },
    restart() { restartHole(); },
    pause, resume, toTitle, next: () => nextFromCard(),
    goto(hole) { G.hole = hole; show('card', false); show('title', false); show('hud', true); startHole(true); return this.info(); },
    card(final) { setState(final ? 'over' : 'card'); showCard(!!final); },
    key(code, down = true) { (down ? onKey : onKeyUp)({ code, repeat: false, preventDefault() {} }); },
    pointer(type, x, y, id = 1) { ({ down: onDown, move: onMove, up: onUp })[type]({ pointerId: id, clientX: x, clientY: y }); },
    // a real drag through the pointer handlers: from (x0, y0) to (x1, y1) in CSS px, then let go
    drag(x0, y0, x1, y1, release = true) {
      onDown({ pointerId: 7, clientX: x0, clientY: y0 });
      for (let i = 1; i <= 8; i++) onMove({ pointerId: 7, clientX: x0 + ((x1 - x0) * i) / 8, clientY: y0 + ((y1 - y0) * i) / 8 });
      const r = { aim: G.aim, power: G.power };
      if (release) onUp({ pointerId: 7, clientX: x1, clientY: y1 });
      return r;
    },
    project(x, y, z) { return SC.project(x, y, z); },
    toast(text, cls) { toast(text, cls); },
    ballScreen() { const p = cur(); const bp = P.ballPos(G.W, p.ball, {}); return SC.project(bp.x, bp.y, bp.z); },
    check(opts) { return MG.checks.run(MG.courses[(opts && opts.course) || 0].holes, opts); },
    info() {
      const p = cur();
      return {
        state: G.state, hole: G.hole + 1, course: MG.courses[G.course].id, turn: G.turn, aim: G.aim, power: G.power, overview: G.overview,
        tick: G.W && G.W.tick,
        players: G.players.map((q) => ({ id: q.id, level: q.level, strokes: q.strokes, scores: q.scores.slice(), holed: q.holed, ball: { x: +q.ball.x.toFixed(3), z: +q.ball.z.toFixed(3), mode: q.ball.mode } })),
        buddy: buddy.info(), hint: G.hint && { angle: G.hint.angle, power: G.hint.power },
        current: p && p.id,
      };
    },
    get G() { return G; },
  };

  boot();
})();
