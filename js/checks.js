/* TT Mini Golf: the headless checks. The page runs them as game.check() and tools/check.js runs them in Node; both use
   the very same physics, courses and autopilot files.
   - solvable: the autopilot sinks every hole within par + 1 (NORMAL's small cup, no magnet)
   - soak: thousands of random shots; the ball never leaves the course, never goes NaN and always stops
   - fps: the same shot ends in exactly the same place at 30, 60 and 120 frames a second
   - blocked: a hole with its cup walled in must FAIL the solvable check (so the check can fail) */
(function (root) {
  'use strict';
  const MG = (root.MG = root.MG || {});
  const P = MG.Phys, A = MG.Auto;

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function solvable(holes, level = 'normal') {
    return holes.map((def, i) => {
      const H = P.compile(def);
      const r = A.autoplay(H, level, def.par + 1);
      return { hole: i + 1, name: def.name, par: def.par, strokes: r.strokes, holed: r.holed, ok: r.holed && r.strokes <= def.par + 1, shots: r.shots };
    });
  }

  // random shots, one after another from wherever the ball stops (back to the tee after the cup, back to the spot
  // it was hit from after the water), checking every 1/120 s step
  function soak(holes, shotsPerHole = 400, seed = 7, level = 'normal') {
    const rand = rng(seed);
    return holes.map((def, i) => {
      const H = P.compile(def);
      const W = P.world(H, level, null);
      const b = P.ball(H.tee.x, H.tee.z);
      const out = { hole: i + 1, name: def.name, shots: 0, escapes: 0, stuck: 0, nan: 0, cups: 0, water: 0, longest: 0, where: null };
      for (let n = 0; n < shotsPerHole; n++) {
        W.tick += Math.floor(rand() * 600);
        P.shoot(W, b, rand() * Math.PI * 2, rand());
        out.shots++;
        let steps = 0, escaped = false;
        while (b.mode === 'roll' || b.mode === 'loop') {
          P.tick(W, [b]);
          steps++;
          if (!(Number.isFinite(b.x) && Number.isFinite(b.z))) { out.nan++; break; }
          if (b.mode === 'roll' && !escaped && !P.onCourse(H, b.x, b.z)) { escaped = true; out.escapes++; out.where = out.where || [b.x, b.z]; }
        }
        out.longest = Math.max(out.longest, steps * P.DT);
        if (b.stuck) out.stuck++;
        if (b.mode === 'cup') { out.cups++; Object.assign(b, P.ball(H.tee.x, H.tee.z)); }
        else if (b.mode === 'water') { out.water++; const f = b.from; Object.assign(b, P.ball(f.x, f.z)); }
        else if (escaped || !Number.isFinite(b.x)) Object.assign(b, P.ball(H.tee.x, H.tee.z));
      }
      out.ok = !out.escapes && !out.stuck && !out.nan;
      return out;
    });
  }

  // the same shots stepped by frames of 1/30, 1/60 and 1/120 s must stop at exactly the same spot
  function fps(holes, level = 'normal') {
    return holes.map((def, i) => {
      const H = P.compile(def);
      const F = A.field(H);
      const t = F.ahead(H.tee.x, H.tee.z, 4);
      const aim = Math.atan2(t.x - H.tee.x, -(t.z - H.tee.z));
      const shots = [[aim, 0.45], [aim, 0.9], [aim + 0.35, 0.7], [aim - 0.6, 1]];
      let ok = true;
      const ends = shots.map(([a, p]) => {
        const res = [30, 60, 120].map((f) => {
          const W = P.world(H, level, null);
          const b = P.ball(H.tee.x, H.tee.z);
          P.shoot(W, b, a, p);
          for (let n = 0; n < f * 40 && (b.mode === 'roll' || b.mode === 'loop'); n++) P.advance(W, 1 / f, [b]);
          return { x: b.x, z: b.z, mode: b.mode };
        });
        const same = res.every((r) => r.x === res[0].x && r.z === res[0].z && r.mode === res[0].mode);
        if (!same) ok = false;
        return { same, end: res[0], all: res };
      });
      return { hole: i + 1, name: def.name, ok, ends };
    });
  }

  // a copy of hole 1 with its cup walled in by rocks: nobody can sink it
  function blockedHole(holes) {
    const def = JSON.parse(JSON.stringify(holes[0]));
    const [cx, cz] = def.cup;
    def.name = 'Blocked cup';
    def.rocks = [];
    for (let k = 0; k < 12; k++) def.rocks.push([cx + Math.cos((k / 12) * Math.PI * 2) * 0.6, cz + Math.sin((k / 12) * Math.PI * 2) * 0.6, 0.2]);
    return def;
  }

  function run(holes, opts = {}) {
    const t0 = Date.now();
    const report = {};
    report.solvable = solvable(holes, opts.level || 'normal');
    report.soak = soak(holes, opts.shots || 400, opts.seed || 7);
    report.fps = fps(holes);
    report.blocked = solvable([blockedHole(holes)])[0];
    report.ok = report.solvable.every((h) => h.ok) && report.soak.every((h) => h.ok) && report.fps.every((h) => h.ok) && !report.blocked.ok;
    report.seconds = (Date.now() - t0) / 1000;
    return report;
  }

  MG.checks = { run, solvable, soak, fps, blockedHole, rng };
})(typeof window !== 'undefined' ? window : globalThis);
