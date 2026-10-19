/* TT Mini Golf: the ball physics. Our own, no library. A fixed 120 Hz step (so a shot plays the same at any frame rate),
   rolling friction, slopes and ramps, wall and bumper bounces, sand, water, the cup (with EASY's bigger cup and gentle
   magnet), the windmill's blades, the moving bridge and the loop-the-loop.
   No Three.js here, so tools/check.js runs this same file in Node.

   Coordinates: metres, seen from above. x goes right, z comes toward the tee (a hole is played toward -z), and a shot's
   angle is 0 straight up the screen (-z), turning clockwise (+x). */
(function (root) {
  'use strict';
  const MG = (root.MG = root.MG || {});

  const HZ = 120, DT = 1 / HZ;
  const R = 0.09; // ball radius
  const G = 9.8 * 5 / 7; // a ball rolling (not sliding) down a slope
  const ROLL = 0.5, DRAG = 0.18; // the green: rolling resistance (m/s²) plus a drag that grows with speed (1/s)
  const SAND_ROLL = 3.0, SAND_DRAG = 1.6;
  const V_MIN = 0.5, V_MAX = 6.6; // putt speed at power 0 and at full power
  const WALL_E = 0.7; // how bouncy the walls are
  const BUMP_KICK = 2.2; // a bumper always sends the ball off at least this fast
  const V_CAP = 9;
  const REST_V = 0.03, REST_T = 0.2; // slower than this for this long and the ball has stopped
  const MAX_SHOT = 30; // a safety net: no shot runs longer (the soak check proves it never comes to this)
  const CUP = {
    normal: { r: 0.2, vcap: 1.9, magnet: 0 },
    easy: { r: 0.3, vcap: 2.6, magnet: 1.0 }, // a bigger cup, and within 1 m a slow ball is pulled in a little
  };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ------------------------------------------------------------------ shapes
  function poly(pts) {
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    for (const [x, z] of pts) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
    return { pts, minx, maxx, minz, maxz };
  }
  function inPoly(p, x, z) {
    if (x < p.minx || x > p.maxx || z < p.minz || z > p.maxz) return false;
    const pts = p.pts;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }
  function seg(ax, az, bx, bz) {
    return { ax, az, bx, bz, minx: Math.min(ax, bx) - R, maxx: Math.max(ax, bx) + R, minz: Math.min(az, bz) - R, maxz: Math.max(az, bz) + R };
  }

  // ------------------------------------------------------------------ a hole, ready to play
  // def (js/courses.js): areas (playable polygons, walled all round), blocks (solid things inside), walls (extra
  // lines), bumpers and rocks [x, z, r], sand and water polygons, slopes { poly, plane: [h0, gx, gz] } (h = h0 + gx·x +
  // gz·z), bumps { x, z, r, h }, and the moving parts: windmill, bridge, loop.
  function compile(def) {
    const H = { def, segs: [], circles: [], areas: [], blocks: [], sand: [], water: [], slopes: [], bumps: def.bumps || [] };
    const addLine = (pts, closed) => {
      const n = pts.length;
      for (let i = 0; i < (closed ? n : n - 1); i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        H.segs.push(seg(a[0], a[1], b[0], b[1]));
      }
    };
    for (const p of def.areas) { H.areas.push(poly(p)); addLine(p, true); }
    for (const p of def.blocks || []) { H.blocks.push(poly(p)); addLine(p, true); }
    for (const p of def.walls || []) addLine(p, false);
    for (const [x, z, r] of def.bumpers || []) H.circles.push({ x, z, r, kick: true });
    for (const [x, z, r] of def.rocks || []) H.circles.push({ x, z, r, kick: false });
    for (const p of def.sand || []) H.sand.push(poly(p));
    for (const p of def.water || []) H.water.push(poly(p));
    for (const s of def.slopes || []) H.slopes.push({ p: poly(s.poly), h0: s.plane[0], gx: s.plane[1], gz: s.plane[2] });
    H.base = def.base || 0;
    H.tee = { x: def.tee[0], z: def.tee[1] };
    H.cup = { x: def.cup[0], z: def.cup[1] };
    H.windmill = def.windmill || null;
    H.bridge = def.bridge || null;
    H.loop = def.loop || null;
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    for (const a of H.areas) { minx = Math.min(minx, a.minx); maxx = Math.max(maxx, a.maxx); minz = Math.min(minz, a.minz); maxz = Math.max(maxz, a.maxz); }
    H.bounds = { minx, maxx, minz, maxz };
    H.timed = !!(H.windmill || H.bridge); // shots here depend on when you hit them
    return H;
  }

  // ------------------------------------------------------------------ moving parts (they depend only on the tick)
  function windmillAngle(w, tick) { return w.phase + w.speed * tick * DT; }
  // a blade is down across the doorway when one of them points within w.arc of straight down
  function windmillBlocked(w, tick) {
    const a = windmillAngle(w, tick), step = (Math.PI * 2) / w.blades;
    let m = a % step;
    if (m < 0) m += step;
    return m < w.arc || m > step - w.arc;
  }
  function bridgeX(b, tick) { return b.x + b.amp * Math.sin((Math.PI * 2 * tick * DT) / b.period + (b.phase || 0)); }
  function bridgeU(b, tick) { return ((b.amp * Math.PI * 2) / b.period) * Math.cos((Math.PI * 2 * tick * DT) / b.period + (b.phase || 0)); }

  // the moving walls at this tick: a windmill blade across the door, the bridge's two rails
  function movers(H, tick, out) {
    out.length = 0;
    const w = H.windmill;
    if (w && windmillBlocked(w, tick)) {
      const s = seg(w.x - w.half - 0.06, w.face, w.x + w.half + 0.06, w.face);
      s.ux = 0; s.uz = 0;
      out.push(s);
    }
    const b = H.bridge;
    if (b) {
      const bx = bridgeX(b, tick), u = bridgeU(b, tick);
      for (const side of [-1, 1]) {
        const s = seg(bx + side * b.half, b.z0 - 0.12, bx + side * b.half, b.z1 + 0.12);
        s.ux = u; s.uz = 0;
        out.push(s);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ the ground under a point
  const GROUND = { h: 0, gx: 0, gz: 0, kind: 'green', ux: 0, uz: 0 };
  function ground(H, x, z, tick, out = GROUND) {
    out.ux = 0; out.uz = 0; out.kind = 'green';
    const b = H.bridge;
    if (b && z <= b.z0 && z >= b.z1) {
      const bx = bridgeX(b, tick);
      if (Math.abs(x - bx) <= b.half) {
        const k = (b.z0 - z) / (b.z0 - b.z1);
        out.h = b.h0 + (b.h1 - b.h0) * k;
        out.gx = 0;
        out.gz = -(b.h1 - b.h0) / (b.z0 - b.z1);
        out.kind = 'bridge';
        out.ux = bridgeU(b, tick);
        return out;
      }
    }
    let h = H.base, gx = 0, gz = 0;
    for (const s of H.slopes) {
      if (inPoly(s.p, x, z)) { h = s.h0 + s.gx * x + s.gz * z; gx = s.gx; gz = s.gz; break; }
    }
    for (const u of H.bumps) {
      const dx = x - u.x, dz = z - u.z, q = (dx * dx + dz * dz) / (u.r * u.r);
      if (q < 1) {
        const f = 1 - q;
        h += u.h * f * f;
        const d = (-4 * u.h * f) / (u.r * u.r); // d(h·f²)/dx = 2 h f · (-2 dx / r²)
        gx += d * dx;
        gz += d * dz;
      }
    }
    out.h = h; out.gx = gx; out.gz = gz;
    for (const p of H.water) if (inPoly(p, x, z)) { out.kind = 'water'; out.h = h - 0.1; return out; }
    for (const p of H.sand) if (inPoly(p, x, z)) { out.kind = 'sand'; return out; }
    return out;
  }

  // is this spot on the course (inside an area, not inside a solid block)?
  function onCourse(H, x, z) {
    let ok = false;
    for (const a of H.areas) if (inPoly(a, x, z)) { ok = true; break; }
    if (!ok) return false;
    for (const b of H.blocks) if (inPoly(b, x, z)) return false;
    return true;
  }

  // ------------------------------------------------------------------ the loop-the-loop
  // The ball enters at (x, z) heading -z, goes once round a vertical circle of radius R inside a clear tube, and comes
  // out w metres to the side (side = +1: to the right). Too slow and it rolls back out the way it came.
  function loopPos(L, s, out) {
    const a = s / L.R;
    out.x = L.x + L.side * L.w * clamp(a / (Math.PI * 2), 0, 1);
    out.z = L.z - L.R * Math.sin(a);
    out.y = (L.h || 0) + L.R * (1 - Math.cos(a));
    return out;
  }

  // ------------------------------------------------------------------ the world: a hole, its clock, its balls
  function world(H, level, events) {
    return { H, tick: 0, acc: 0, cup: CUP[level] || CUP.normal, moving: [], ev: events || null, level };
  }
  function ball(x, z) {
    return { x, z, vx: 0, vz: 0, y: 0, mode: 'rest', s: 0, vs: 0, restT: 0, t: 0, from: { x, z }, stuck: false, hits: 0 };
  }

  function shoot(W, b, angle, power) {
    const v = V_MIN + (V_MAX - V_MIN) * clamp(power, 0, 1);
    b.vx = Math.sin(angle) * v;
    b.vz = -Math.cos(angle) * v;
    b.mode = 'roll';
    b.restT = 0;
    b.t = 0;
    b.from = { x: b.x, z: b.z };
    b.stuck = false;
    b.hits = 0;
  }

  const emit = (W, type, a, b) => { if (W.ev) W.ev(type, a, b); };

  function hitSeg(W, b, s, ux, uz) {
    if (b.x < s.minx || b.x > s.maxx || b.z < s.minz || b.z > s.maxz) return;
    const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez;
    let t = ((b.x - s.ax) * ex + (b.z - s.az) * ez) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = b.x - (s.ax + ex * t), dz = b.z - (s.az + ez * t), d2 = dx * dx + dz * dz;
    if (d2 >= R * R) return;
    const d = Math.sqrt(d2);
    let nx, nz;
    if (d > 1e-9) { nx = dx / d; nz = dz / d; } else {
      const L = Math.sqrt(L2);
      nx = -ez / L; nz = ex / L;
      if ((b.vx - ux) * nx + (b.vz - uz) * nz > 0) { nx = -nx; nz = -nz; }
    }
    b.x += nx * (R - d);
    b.z += nz * (R - d);
    const vn = (b.vx - ux) * nx + (b.vz - uz) * nz;
    if (vn < 0) {
      const hard = -vn > 0.3;
      const e = hard ? WALL_E : 0; // a ball resting against a wall doesn't keep bouncing
      b.vx -= (1 + e) * vn * nx;
      b.vz -= (1 + e) * vn * nz;
      if (hard) {
        const tx = -nz, tz = nx, vt = (b.vx - ux) * tx + (b.vz - uz) * tz;
        b.vx -= 0.08 * vt * tx;
        b.vz -= 0.08 * vt * tz;
        b.hits++;
        emit(W, 'wall', -vn);
      }
    }
  }

  function hitCircle(W, b, c) {
    const dx = b.x - c.x, dz = b.z - c.z, rr = c.r + R, d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-9, nx = dx / d, nz = dz / d;
    b.x = c.x + nx * rr;
    b.z = c.z + nz * rr;
    const vn = b.vx * nx + b.vz * nz;
    if (c.kick) {
      // a bumper: a perfect bounce plus a kick, so it always pops the ball away
      let out = vn < 0 ? -vn : vn;
      if (vn < 0) { b.vx -= 2 * vn * nx; b.vz -= 2 * vn * nz; }
      const now = b.vx * nx + b.vz * nz;
      if (now < BUMP_KICK) { b.vx += (BUMP_KICK - now) * nx; b.vz += (BUMP_KICK - now) * nz; out = BUMP_KICK; }
      b.hits++;
      emit(W, 'bumper', out, c);
    } else if (vn < 0) {
      const hard = -vn > 0.3;
      b.vx -= (1 + (hard ? 0.6 : 0)) * vn * nx;
      b.vz -= (1 + (hard ? 0.6 : 0)) * vn * nz;
      if (hard) { b.hits++; emit(W, 'wall', -vn); }
    }
  }

  function loopStep(W, b) {
    const L = W.H.loop;
    const a = b.s / L.R;
    // no friction can hold a ball still in the tube (it would sit upside down at the top): it fades out when slow
    const fric = ROLL * Math.min(1, Math.abs(b.vs) / 0.4) + DRAG * Math.abs(b.vs);
    b.vs -= G * Math.sin(a) * DT;
    if (b.vs > 0) b.vs = Math.max(0, b.vs - fric * DT); else if (b.vs < 0) b.vs = Math.min(0, b.vs + fric * DT);
    b.s += b.vs * DT;
    const end = Math.PI * 2 * L.R;
    if (b.s >= end) {
      // out the far side, w metres over
      b.mode = 'roll';
      b.x = L.x + L.side * L.w;
      b.z = L.z - 0.001;
      b.vx = 0;
      b.vz = -b.vs;
      emit(W, 'loopOut', 1);
    } else if (b.s <= 0) {
      // not fast enough: it rolls back out the way it came
      b.mode = 'roll';
      b.x = L.x;
      b.z = L.z + 0.001;
      b.vx = 0;
      b.vz = -b.vs;
      emit(W, 'loopOut', -1);
    }
  }

  const G1 = { h: 0, gx: 0, gz: 0, kind: 'green', ux: 0, uz: 0 };
  // one 1/120 s step of a moving ball
  function step(W, b) {
    const H = W.H;
    b.t += DT;
    if (b.mode === 'loop') {
      loopStep(W, b);
      if (b.mode === 'loop' && b.t > MAX_SHOT) { b.mode = 'roll'; b.x = W.H.loop.x; b.z = W.H.loop.z + 0.01; b.vx = 0; b.vz = 0.3; b.stuck = true; }
      return;
    }
    const g = ground(H, b.x, b.z, W.tick, G1);
    if (g.kind === 'water') {
      b.mode = 'water';
      emit(W, 'splash', b.x, b.z);
      return;
    }
    let ax = -G * g.gx, az = -G * g.gz;
    let rx = b.vx - g.ux, rz = b.vz - g.uz;
    const sp0 = Math.hypot(rx, rz);
    // the cup: a dip that pulls a passing ball toward the middle (so near misses curl), and on EASY a gentle magnet
    const cx = H.cup.x - b.x, cz = H.cup.z - b.z, cd = Math.hypot(cx, cz), cup = W.cup;
    if (cd > 1e-6) {
      if (cd < cup.r) { ax += (5 * cx) / cd; az += (5 * cz) / cd; } else if (cup.magnet && cd < cup.magnet && sp0 < 2.5) {
        const m = 0.3 + 1.4 * (1 - cd / cup.magnet);
        ax += (m * cx) / cd;
        az += (m * cz) / cd;
      }
    }
    rx += ax * DT;
    rz += az * DT;
    const sp = Math.hypot(rx, rz);
    const sand = g.kind === 'sand';
    const dec = ((sand ? SAND_ROLL : ROLL) + (sand ? SAND_DRAG : DRAG) * sp) * DT;
    if (sp <= dec) { rx = 0; rz = 0; } else { const k = (sp - dec) / sp; rx *= k; rz *= k; }
    b.vx = rx + g.ux;
    b.vz = rz + g.uz;
    const v = Math.hypot(b.vx, b.vz);
    if (v > V_CAP) { b.vx *= V_CAP / v; b.vz *= V_CAP / v; }
    const pz = b.z;
    b.x += b.vx * DT;
    b.z += b.vz * DT;
    for (let pass = 0; pass < 2; pass++) {
      for (const s of H.segs) hitSeg(W, b, s, 0, 0);
      for (const s of W.moving) hitSeg(W, b, s, s.ux, s.uz);
      for (const c of H.circles) hitCircle(W, b, c);
    }
    // into the loop's tube
    const L = H.loop;
    if (L && b.vz < 0 && pz > L.z && b.z <= L.z && Math.abs(b.x - L.x) < L.half) {
      b.mode = 'loop';
      b.s = 0;
      b.vs = -b.vz;
      b.x = L.x;
      b.z = L.z;
      emit(W, 'loopIn', b.vs);
      return;
    }
    // into the cup
    const qx = H.cup.x - b.x, qz = H.cup.z - b.z, qd = Math.hypot(qx, qz);
    const rel = Math.hypot(b.vx - g.ux, b.vz - g.uz);
    if (qd < cup.r * 0.8 && rel < cup.vcap) {
      b.mode = 'cup';
      emit(W, 'cup', rel);
      return;
    }
    if (g.kind === 'sand' && sp0 > 0.4 && !b.inSand) emit(W, 'sand', sp0);
    b.inSand = g.kind === 'sand';
    // stopped? (never on the moving bridge: it tilts, so the ball always rolls off)
    if (g.kind !== 'bridge' && rel < REST_V) {
      b.restT += DT;
      if (b.restT >= REST_T) {
        if (qd < cup.r) { b.mode = 'cup'; emit(W, 'cup', 0); return; }
        b.mode = 'rest';
        b.vx = b.vz = 0;
        emit(W, 'rest');
      }
    } else b.restT = 0;
    if (b.t > MAX_SHOT) { b.mode = 'rest'; b.vx = b.vz = 0; b.stuck = true; emit(W, 'rest'); }
  }

  // one tick of the whole world: move the moving parts, then every rolling ball
  function tick(W, balls) {
    movers(W.H, W.tick, W.moving);
    for (const b of balls) if (b.mode === 'roll' || b.mode === 'loop') step(W, b);
    W.tick++;
  }
  // advance by a frame of any length; the physics always steps at exactly 120 Hz
  function advance(W, dt, balls) {
    W.acc += Math.min(dt, 0.25);
    let n = 0;
    while (W.acc >= DT - 1e-9) {
      tick(W, balls);
      W.acc -= DT;
      n++;
    }
    return n;
  }

  // where the ball is drawn (its centre), including the loop and the ground's height
  const GP = { h: 0, gx: 0, gz: 0, kind: 'green', ux: 0, uz: 0 };
  const LP = { x: 0, y: 0, z: 0 };
  function ballPos(W, b, out) {
    if (b.mode === 'loop') {
      loopPos(W.H.loop, b.s, LP);
      out.x = LP.x; out.y = LP.y + R; out.z = LP.z;
      return out;
    }
    const g = ground(W.H, b.x, b.z, W.tick, GP);
    out.x = b.x; out.z = b.z; out.y = g.h + R;
    return out;
  }

  // Play one shot to the end in a scratch world (for the aim help, the buddy's hint, the autopilot and the checks).
  // Returns where it stopped and how: rest, cup, water. opts.path collects points to draw.
  function simulate(H, level, x, z, startTick, angle, power, opts) {
    const W = world(H, level, null);
    W.tick = startTick || 0;
    const b = ball(x, z);
    shoot(W, b, angle, power);
    const path = opts && opts.path;
    let firstHit = null;
    if (opts && opts.firstHit) {
      W.ev = (type) => { if (!firstHit && (type === 'wall' || type === 'bumper')) firstHit = { x: b.x, z: b.z }; };
    }
    const maxT = (opts && opts.maxT) || MAX_SHOT + 1;
    let n = 0;
    while ((b.mode === 'roll' || b.mode === 'loop') && n < maxT * HZ) {
      tick(W, [b]);
      n++;
      if (path && n % 3 === 0) { const p = ballPos(W, b, {}); path.push(p); }
      if (opts && opts.stopAtHit && firstHit) break;
    }
    return { x: b.x, z: b.z, mode: b.mode, stuck: b.stuck, ticks: n, firstHit, hits: b.hits, ball: b, tick: W.tick };
  }

  // Where a ball rolling from (x, z) along (dx, dz) (a unit vector) first touches a wall, bumper or rock, if within
  // maxT metres: { t, nx, nz } with the normal it bounces off. For the aim guide's first bounce.
  function cast(H, moving, x, z, dx, dz, maxT) {
    let best = null;
    const tryHit = (t, nx, nz) => { if (t > 1e-4 && t < maxT && (!best || t < best.t)) best = { t, nx, nz }; };
    const circle = (cx, cz, r) => {
      const ox = x - cx, oz = z - cz, b = ox * dx + oz * dz, c = ox * ox + oz * oz - r * r, disc = b * b - c;
      if (c < 0 || disc < 0) return;
      const t = -b - Math.sqrt(disc);
      const hx = x + dx * t - cx, hz = z + dz * t - cz, l = Math.hypot(hx, hz) || 1;
      tryHit(t, hx / l, hz / l);
    };
    const line = (s) => {
      const ex = s.bx - s.ax, ez = s.bz - s.az, L = Math.hypot(ex, ez);
      let nx = -ez / L, nz = ex / L;
      let d0 = (x - s.ax) * nx + (z - s.az) * nz;
      if (d0 < 0) { nx = -nx; nz = -nz; d0 = -d0; }
      const vn = dx * nx + dz * nz;
      if (vn < -1e-9) {
        const t = (d0 - R) / -vn, px = x + dx * t, pz = z + dz * t;
        const u = ((px - s.ax) * ex + (pz - s.az) * ez) / (L * L);
        if (u >= 0 && u <= 1) tryHit(t, nx, nz);
      }
      circle(s.ax, s.az, R);
      circle(s.bx, s.bz, R);
    };
    for (const s of H.segs) line(s);
    for (const s of moving || []) line(s);
    for (const c of H.circles) circle(c.x, c.z, c.r + R);
    return best;
  }

  MG.Phys = {
    HZ, DT, R, G, V_MIN, V_MAX, CUP, MAX_SHOT,
    compile, world, ball, shoot, step, tick, advance, simulate, ballPos, ground, onCourse, inPoly,
    windmillAngle, windmillBlocked, bridgeX, loopPos, movers, cast,
  };
})(typeof window !== 'undefined' ? window : globalThis);
