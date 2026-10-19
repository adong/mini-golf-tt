/* TT Mini Golf: the brother who comes to help. Call him (T or his face button) any time, as often as you like.
   He pops in beside the green at his buddy size, says hi with his signature move (Tommy's Y with peace fingers,
   Teddy's boxing), tosses a treat, and gives a tip: a glowing aim line and how hard to hit, found by the autopilot.
   When your shot is done he says bye (Tommy's Y again, Teddy's jump shot) and pops out.
   The game passes in hooks: toast, sfx, where the ball is, and plan() which starts the autopilot's search. */
(function () {
  'use strict';
  const T = THREE, Kit = window.Kit, MG = window.MG, SC = MG.scene;
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const BASE = 0.8; // everyone on the course is drawn at 80 % of the kit's 2 m

  const B = {
    entry: null, person: null, state: 'away', t: 0, treatN: 0, hooks: null, spot: null,
    treats: [], flying: null, search: null, hint: null, calls: 0, bye: false, sigIdx: 0,
  };

  function init(hooks) { B.hooks = hooks; }

  function setEntry(entry) {
    if (B.entry && entry && B.entry.id === entry.id) return;
    dismiss(true);
    B.entry = entry;
  }

  const nice = () => B.entry.name;
  const sig = (which) => Kit.roster.signature(B.entry, which);

  // somewhere on the grass beside the green, near the ball, toward the camera
  function findSpot(H, bx, bz) {
    const cam = SC.camera.position;
    let best = null, bestD = Infinity;
    for (let r = 1.2; r <= 4.4; r += 0.4) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2, x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
        let clear = true;
        for (let j = 0; j < 8 && clear; j++) {
          const qx = x + Math.cos(j) * 0.45, qz = z + Math.sin(j) * 0.45;
          if (H.areas.some((ar) => MG.Phys.inPoly(ar, qx, qz))) clear = false;
        }
        if (H.def.tunnel && x > H.def.tunnel.x0 - 0.5 && x < H.def.tunnel.x1 + 0.5 && z < H.def.tunnel.z0 + 0.5 && z > H.def.tunnel.z1 - 0.5) clear = false;
        if (H.windmill && Math.abs(z - (H.windmill.face + H.windmill.back) / 2) < 1.6) clear = false;
        if (!clear) continue;
        // well inside the screen, and as close to the ball as we can
        const sp = SC.project(x, 0.6, z), w = window.innerWidth, hh = window.innerHeight;
        const off = Math.max(0, 0.12 * w - sp.x, sp.x - 0.88 * w, 0.3 * hh - sp.y, sp.y - 0.78 * hh) + (sp.behind ? 1e4 : 0);
        const d = off * 0.05 + r + Math.hypot(x - cam.x, z - cam.z) * 0.1;
        if (d < bestD) { bestD = d; best = { x, z }; }
      }
    }
    return best || { x: bx + 2, z: bz };
  }

  // He's called. First time: pop in. Already here: say hi again and bring another treat (and a fresh tip).
  function call() {
    if (!B.entry) return;
    const h = B.hooks;
    const ball = h.ballPos();
    B.calls++;
    if (B.state === 'away' || B.state === 'out') {
      B.spot = findSpot(h.hole(), ball.x, ball.z);
      if (!B.person) B.person = SC.makePerson(B.entry, (B.entry.buddyScale || 0.85) * BASE);
      B.person.withPutter = false;
      B.person.putter.visible = false;
      B.person.holder.visible = true;
      B.person.holder.position.set(B.spot.x, -0.35, B.spot.z);
      if (!B.person.tag) {
        B.person.tag = Kit.gfx.nameTag(B.entry.name, B.entry.tag || '#ffd27a');
        B.person.tag.position.y = 2.45;
        B.person.p.root.add(B.person.tag);
      }
      SC.fx.poof(B.spot.x, -0.35, B.spot.z);
      h.sfx('poof');
      h.toast(`${nice()} IS HERE!`, 'buddy');
    }
    B.state = 'hello';
    B.t = 0;
    B.bye = false;
    B.person.mode = sig('hello');
    if (B.person.mode === 'jumpshot') B.person.jump = 0.7;
    B.treatN++;
    startHint();
  }

  // ask the autopilot for a good shot from where the ball is now (it runs a little each frame)
  function startHint() {
    B.hint = null;
    B.search = B.hooks.plan();
  }

  function tossTreat() {
    const h = B.hooks;
    const [emoji, name] = TREATS[(B.treatN - 1) % TREATS.length];
    const s = SC.treatSprite(emoji);
    const from = B.person.holder.position.clone();
    from.y += 1.4 * B.person.scale;
    const to = h.playerFeet();
    B.flying = { s, from, to, t: 0, emoji, name };
    h.sfx('swish');
  }

  function update(dt) {
    const pp = B.person;
    // the autopilot's search, a slice per frame
    if (B.search) {
      const t0 = performance.now();
      let r;
      do { r = B.search.next(); } while (!r.done && performance.now() - t0 < 9);
      if (r.done) { B.search = null; B.hint = r.value; if (B.hint) B.hooks.gotHint(B.hint, nice()); }
    }
    if (B.flying) {
      const f = B.flying;
      f.t += dt / 0.8;
      const u = Math.min(1, f.t);
      f.s.position.lerpVectors(f.from, f.to, u);
      f.s.position.y += Math.sin(u * Math.PI) * 1.4;
      f.s.material.rotation = u * 6;
      if (u >= 1) {
        B.hooks.sfx('treat');
        B.hooks.toast(`${f.emoji} ${f.name} FROM ${nice()}!`, 'buddy');
        f.s.material.rotation = 0;
        B.treats.push({ s: f.s, t: 0 });
        B.flying = null;
      }
    }
    for (let i = B.treats.length - 1; i >= 0; i--) {
      const tr = B.treats[i];
      tr.t += dt;
      const k = tr.t < 4 ? 1 : Math.max(0, 1 - (tr.t - 4) / 0.6);
      tr.s.scale.set(0.5 * k, 0.5 * k, 1);
      tr.s.position.y += Math.sin(tr.t * 4) * 0.002;
      if (k <= 0) { SC.removeObj(tr.s); B.treats.splice(i, 1); }
    }
    if (!pp || B.state === 'away') return;
    B.t += dt;
    const ball = B.hooks.ballPos();
    if (B.state !== 'out') SC.facePoint(pp, ball.x, ball.z);
    if (B.state === 'hello') {
      if (B.t > 0.9 && !B.flying && B.treatN > B.tossed) { B.tossed = B.treatN; tossTreat(); }
      if (B.t > 1.7) { B.state = 'help'; B.t = 0; pp.mode = 'give'; }
    } else if (B.state === 'help') {
      // pointing the way while you aim, then cheering on
      if (B.t > 2.2) pp.mode = sig('hello') === 'peace' ? 'peace' : 'stand';
      if (B.bye && B.t > 0.2) goodbye();
    } else if (B.state === 'bye') {
      if (B.t > 1.3) {
        SC.fx.poof(pp.holder.position.x, -0.35, pp.holder.position.z);
        B.hooks.sfx('poof');
        pp.holder.visible = false;
        B.state = 'away';
      }
    }
    SC.animPerson(pp, dt);
  }
  B.tossed = 0;

  function goodbye() {
    if (!B.person || B.state === 'away' || B.state === 'bye') return;
    B.state = 'bye';
    B.t = 0;
    B.person.mode = sig('goodbye');
    if (B.person.mode === 'jumpshot') {
      B.person.jump = 0.7;
      const s = SC.treatSprite('🏀');
      s.position.copy(B.person.holder.position);
      s.position.y += 1.9 * B.person.scale;
      B.treats.push({ s, t: 3.2 });
    }
  }

  // the shot he helped with is done: he waves goodbye once he has finished his hello
  function shotDone() { if (B.state === 'help' || B.state === 'hello') B.bye = true; if (B.state === 'help') goodbye(); }

  function dismiss(now) {
    B.search = null;
    B.hint = null;
    if (B.flying) { SC.removeObj(B.flying.s); B.flying = null; }
    for (const tr of B.treats) SC.removeObj(tr.s);
    B.treats = [];
    if (B.person) {
      if (now) { SC.removePerson(B.person); B.person = null; } else B.person.holder.visible = false;
    }
    B.state = 'away';
  }

  const here = () => B.state !== 'away';
  const thinking = () => !!B.search;
  const info = () => ({ state: B.state, entry: B.entry && B.entry.id, calls: B.calls, hint: B.hint, thinking: !!B.search, treats: B.treatN, spot: B.spot });

  MG.buddy = { entryId: () => B.entry && B.entry.id, init, setEntry, call, update, dismiss, shotDone, here, thinking, info, get hint() { return B.hint; }, clearHint() { B.hint = null; } };
})();
