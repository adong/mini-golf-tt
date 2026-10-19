/* TT Mini Golf: the autopilot. It finds a good shot by trying lots of them in scratch worlds (js/physics.js simulate)
   and scoring where each one stops by how far it still is from the cup *along the course* (a distance map that goes
   round walls, through the windmill door and the loop). The buddy's hint and the headless checks both use it.
   No Three.js, so tools/check.js runs it in Node. */
(function (root) {
  'use strict';
  const MG = (root.MG = root.MG || {});
  const P = MG.Phys;
  const CELL = 0.1;

  // ------------------------------------------------------------------ the distance map (Dijkstra on a 10 cm grid)
  function field(H) {
    if (H._field) return H._field;
    const { minx, maxx, minz, maxz } = H.bounds;
    const nx = Math.ceil((maxx - minx) / CELL) + 1, nz = Math.ceil((maxz - minz) / CELL) + 1;
    const cost = new Float32Array(nx * nz); // 0 = can't be there
    const R = P.R * 0.95;
    const br = H.bridge;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = minx + i * CELL, z = minz + j * CELL;
        if (!P.onCourse(H, x, z)) continue;
        let ok = true;
        for (const s of H.segs) {
          const ex = s.bx - s.ax, ez = s.bz - s.az;
          let t = ((x - s.ax) * ex + (z - s.az) * ez) / (ex * ex + ez * ez);
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dx = x - s.ax - ex * t, dz = z - s.az - ez * t;
          if (dx * dx + dz * dz < R * R) { ok = false; break; }
        }
        if (!ok) continue;
        for (const c of H.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + R) { ok = false; break; }
        if (!ok) continue;
        let c = 1;
        for (const w of H.water) if (P.inPoly(w, x, z)) c = 0;
        if (br && z <= br.z0 && z >= br.z1 && Math.abs(x - br.x) <= br.amp + br.half - P.R) c = 1.5; // across the bridge
        if (c === 1 && H.sand.some((s) => P.inPoly(s, x, z))) c = 3; // sand is slow going
        cost[j * nx + i] = c;
      }
    }
    const dist = new Float64Array(nx * nz).fill(Infinity);
    const idx = (x, z) => {
      const i = Math.round((x - minx) / CELL), j = Math.round((z - minz) / CELL);
      return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i;
    };
    // a small binary heap
    const heap = [], push = (d, k) => {
      heap.push([d, k]);
      let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    }, pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const start = idx(H.cup.x, H.cup.z);
    dist[start] = 0;
    push(0, start);
    // the loop: from just past its far end you can get back to just before its mouth
    const L = H.loop;
    const loopOut = L ? idx(L.x + L.side * L.w, L.z - 0.15) : -1, loopIn = L ? idx(L.x, L.z + 0.15) : -1;
    const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (heap.length) {
      const [d, k] = pop();
      if (d > dist[k]) continue;
      const i = k % nx, j = (k - i) / nx;
      for (const [di, dj, w] of N8) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const n = b * nx + a;
        if (!cost[n]) continue;
        const nd = d + w * CELL * (cost[n] + cost[k]) * 0.5;
        if (nd < dist[n]) { dist[n] = nd; push(nd, n); }
      }
      if (k === loopOut && loopIn >= 0) {
        const nd = d + Math.PI * 2 * L.R;
        if (nd < dist[loopIn]) { dist[loopIn] = nd; push(nd, loopIn); }
      }
    }
    // distance from any point: the nearest reachable cell nearby
    function at(x, z) {
      const i0 = Math.round((x - minx) / CELL), j0 = Math.round((z - minz) / CELL);
      let best = Infinity;
      for (let r = 0; r <= 3 && best === Infinity; r++) {
        for (let dj = -r; dj <= r; dj++) {
          for (let di = -r; di <= r; di++) {
            if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
            const a = i0 + di, b = j0 + dj;
            if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
            const v = dist[b * nx + a] + r * CELL;
            if (v < best) best = v;
          }
        }
      }
      return best === Infinity ? 99 : best;
    }
    // a point a few metres further along the way to the cup (the camera looks there)
    function ahead(x, z, metres) {
      let cx = x, cz = z, d = at(x, z);
      const target = Math.max(0, d - metres);
      for (let n = 0; n < 200 && d > target + 0.05; n++) {
        let bx = cx, bz = cz, bd = d;
        for (let a = 0; a < 16; a++) {
          const tx = cx + Math.cos((a / 16) * Math.PI * 2) * 0.2, tz = cz + Math.sin((a / 16) * Math.PI * 2) * 0.2;
          const td = at(tx, tz);
          if (td < bd) { bd = td; bx = tx; bz = tz; }
        }
        if (bd >= d) break;
        cx = bx; cz = bz; d = bd;
      }
      return { x: cx, z: cz };
    }
    H._field = { at, ahead, nx, nz, minx, minz, cell: CELL, dist, cost };
    return H._field;
  }

  // ------------------------------------------------------------------ finding a shot
  const RAD = Math.PI / 180;
  // how long the moving parts take to repeat, so the autopilot knows how long it might wait
  function cycle(H) {
    if (H.bridge) return H.bridge.period;
    if (H.windmill) return (Math.PI * 2) / H.windmill.blades / H.windmill.speed;
    return 0;
  }

  // Search shots from (x, z) at this tick. Returns { angle, power, delay, mode, score }.
  // opts.robust: prefer shots that still work a little off (and, on the windmill or bridge, a little early or late)
  // opts.wait: the autopilot may wait for the moving parts (delay in seconds before hitting)
  function plan(H, level, x, z, tick, opts = {}) {
    const it = planSteps(H, level, x, z, tick, opts);
    for (;;) { const r = it.next(); if (r.done) return r.value; }
  }
  // the same search, a little at a time: the page runs it over a few frames so the buddy's hint never freezes it
  function* planSteps(H, level, x, z, tick, opts = {}) {
    const F = field(H);
    let sims = 0;
    const pace = () => ++sims % 60 === 0;
    const here = F.at(x, z);
    // in the cup is best, and the simplest way in best of all: fewer bounces, a softer hit
    const score = (r, p) => (r.mode === 'cup' ? -10 + 0.4 * Math.min(r.hits, 5) + 0.5 * p : r.mode === 'water' ? here + 4 : r.stuck ? here + 50 : F.at(r.x, r.z));
    const run = (a, p, d) => P.simulate(H, level, x, z, tick + Math.round(d * P.HZ), a, p);
    const C = cycle(H);
    const delays = opts.wait && C ? [0, C / 3, (2 * C) / 3] : [0];
    let cands = [];
    for (let ai = 0; ai < 120; ai++) {
      for (let pi = 0; pi < 12; pi++) {
        const a = ai * 3 * RAD, p = 0.03 + 0.97 * Math.pow(pi / 11, 1.5); // more soft putts
        for (const d of delays) { const r = run(a, p, d); cands.push({ a, p, d, s: score(r, p), mode: r.mode }); if (pace()) yield; }
      }
    }
    cands.sort((u, v) => u.s - v.s);
    const top = [];
    for (const c of cands) {
      if (top.length >= 6) break;
      if (top.some((t) => Math.abs(t.a - c.a) < 7 * RAD && Math.abs(t.p - c.p) < 0.2 && t.d === c.d)) continue;
      top.push(c);
    }
    // refine around the best few
    let fine = [];
    for (const t of top) {
      for (let da = -2; da <= 2; da++) {
        for (let dp = -2; dp <= 2; dp++) {
          const a = t.a + da * RAD, p = Math.min(1, Math.max(0, t.p + dp * 0.025));
          const r = run(a, p, t.d);
          fine.push({ a, p, d: t.d, s: score(r, p), mode: r.mode });
          if (pace()) yield;
        }
      }
    }
    // on the windmill and the bridge, the autopilot may also pick its moment
    if (opts.wait && C) {
      fine.sort((u, v) => u.s - v.s);
      const more = [];
      for (const t of fine.slice(0, 8)) {
        for (let k = 0; k < 16; k++) {
          const d = (k / 16) * C;
          const r = run(t.a, t.p, d);
          more.push({ a: t.a, p: t.p, d, s: score(r, t.p), mode: r.mode });
        }
      }
      fine = fine.concat(more);
    }
    fine.sort((u, v) => u.s - v.s);
    let best = fine[0];
    if (opts.robust) {
      // average each good shot with its near neighbours (and, where things move, a few moments around it)
      const pool = fine.filter((c) => c.s <= best.s + 1.2).slice(0, 12);
      // kid-sized slips: 2° either way, 12 % harder or softer
      const jit = [[0, 0], [2.5, 0], [-2.5, 0], [5, 0], [-5, 0], [0, 0.12], [0, -0.12], [2.5, 0.08], [-2.5, -0.08]];
      const dts = H.timed && !opts.wait ? [0, 0.3, 0.6, 0.9, 1.2] : [0];
      let bestMean = Infinity;
      for (const c of pool) {
        let sum = 0, n = 0;
        for (const [ja, jp] of jit) {
          for (const dt of dts) {
            const r = run(c.a + ja * RAD, Math.min(1, Math.max(0, c.p * (1 + jp))), c.d + dt);
            sum += Math.min(score(r, c.p), here + 4);
            n++;
            if (pace()) yield;
          }
        }
        const mean = sum / n;
        if (mean < bestMean) { bestMean = mean; best = Object.assign({}, c, { mean }); }
      }
    }
    return { angle: best.a, power: best.p, delay: best.d, mode: best.mode, score: best.s, mean: best.mean };
  }

  // Play a hole by itself, shot after shot (a water ball comes back with a stroke added). For the checks.
  function autoplay(H, level, maxStrokes, opts = {}) {
    let x = H.tee.x, z = H.tee.z, tick = opts.tick || 0, strokes = 0;
    const shots = [];
    while (strokes < maxStrokes) {
      const s = plan(H, level, x, z, tick, { robust: opts.robust !== false, wait: true });
      tick += Math.round(s.delay * P.HZ);
      const r = P.simulate(H, level, x, z, tick, s.angle, s.power);
      strokes++;
      tick = r.tick;
      shots.push({ x, z, angle: s.angle, power: s.power, delay: s.delay, end: r.mode, ex: r.x, ez: r.z });
      if (r.mode === 'cup') return { holed: true, strokes, shots };
      if (r.mode === 'water') strokes++;
      else { x = r.x; z = r.z; }
    }
    return { holed: false, strokes, shots };
  }

  MG.Auto = { field, plan, planSteps, autoplay, cycle };
})(typeof window !== 'undefined' ? window : globalThis);
