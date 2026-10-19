/* TT Mini Golf: the 3D scene. Builds each hole from its data (the green, the walls, sand, water, bumpers, the windmill,
   the bridge, the loop's tube, the tunnel hill and the garden round it), draws the balls, the aim guide, the buddy's
   glowing hint, the players with their putters, particles, and moves the camera. Everything is boxes, spheres and
   canvas-painted textures: no image or model files. */
(function () {
  'use strict';
  const T = THREE, Kit = window.Kit, MG = window.MG, P = MG.Phys, gfx = Kit.gfx;
  const { std, makeCanvas, toTexture } = gfx;

  let renderer, scene, camera, sun, hemi, groundMesh;
  let hole = null; // the current hole's meshes and moving parts
  const balls = [];
  const view = { w: 1, h: 1 };
  const cam = {
    pos: new T.Vector3(0, 9, 9), look: new T.Vector3(), wantPos: new T.Vector3(0, 9, 9), wantLook: new T.Vector3(),
    snap: true, k: 4,
  };

  // ------------------------------------------------------------------ setup
  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.background = new T.Color('#9edcff');
    scene.fog = new T.Fog('#cdefff', 30, 70);
    camera = new T.PerspectiveCamera(50, 1, 0.1, 200);
    hemi = new T.HemisphereLight('#ffffff', '#6aa35a', 0.75);
    scene.add(hemi);
    sun = new T.DirectionalLight('#fff4dc', 1.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    // the garden lawn under everything, and a few clouds
    groundMesh = new T.Mesh(new T.PlaneGeometry(220, 220), std('#7fd46a', { map: grassTex('#ffffff'), roughness: 1 }));
    groundMesh.material.map.repeat.set(70, 70);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.35;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    clouds();
    makeAimBits();
    makeParticles();
  }

  function fit(w, h) {
    view.w = w; view.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 55 : 48;
    camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ textures
  const texCache = {};
  function stripeTex(c1, c2) {
    const key = 'stripe' + c1 + c2;
    if (texCache[key]) return texCache[key];
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = c1;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = c2;
    g.fillRect(0, 0, 256, 64);
    g.fillRect(0, 128, 256, 64);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,40,0'},${0.05 + Math.random() * 0.06})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const t = toTexture(c, true);
    return (texCache[key] = t);
  }
  // a slope: arrows pointing downhill, the way a ball would roll
  function chevronTex(c1, c2) {
    const key = 'chev' + c1 + c2;
    if (texCache[key]) return texCache[key];
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = gfx.shade(c1, 0.12);
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = gfx.shade(c2, 0.35);
    g.lineWidth = 12;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath(); g.moveTo(28, 82); g.lineTo(64, 46); g.lineTo(100, 82); g.stroke();
    return (texCache[key] = toTexture(c, true));
  }
  function grassTex(base) {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.4 ? '255,255,255' : '40,60,40'},${0.08 + Math.random() * 0.1})`;
      g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 3);
    }
    return toTexture(c, true);
  }
  function sandTex(base, grain) {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : grain || '140,100,40'},${0.15 + Math.random() * 0.2})`;
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    return toTexture(c, true);
  }
  function waterTex(base) {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      const y0 = k * 22 + 8;
      for (let x = 0; x <= 128; x += 4) g.lineTo(x, y0 + Math.sin((x / 128) * Math.PI * 4 + k) * 4);
      g.stroke();
    }
    return toTexture(c, true);
  }
  function dotsTex(base, dot) {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = dot;
    [[30, 30, 14], [90, 40, 10], [60, 90, 16], [105, 100, 9], [20, 100, 8]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    return toTexture(c);
  }

  // ------------------------------------------------------------------ geometry helpers
  // the height of the course at a point, ignoring the bridge and the water (for building the meshes)
  function heightFn(H) {
    const Hs = Object.assign({}, H, { bridge: null, water: [] });
    const g = { h: 0, gx: 0, gz: 0, kind: 'green', ux: 0, uz: 0 };
    return (x, z) => P.ground(Hs, x, z, 0, g).h;
  }

  // clip a polygon to an axis-aligned box (Sutherland-Hodgman)
  function clipBox(pts, x0, z0, x1, z1) {
    let out = pts;
    const clip = (inside, cut) => {
      const res = [];
      for (let i = 0; i < out.length; i++) {
        const a = out[i], b = out[(i + 1) % out.length], ia = inside(a), ib = inside(b);
        if (ia) res.push(a);
        if (ia !== ib) res.push(cut(a, b));
      }
      out = res;
    };
    const cx = (v) => (a, b) => { const t = (v - a[0]) / (b[0] - a[0]); return [v, a[1] + t * (b[1] - a[1])]; };
    const cz = (v) => (a, b) => { const t = (v - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), v]; };
    clip((p) => p[0] >= x0, cx(x0));
    if (out.length) clip((p) => p[0] <= x1, cx(x1));
    if (out.length) clip((p) => p[1] >= z0, cz(z0));
    if (out.length) clip((p) => p[1] <= z1, cz(z1));
    return out;
  }

  // triangles of a polygon, facing up, at heights from hFn
  function pushPoly(pos, uv, pts, hFn, lift, uvScale, uvFn) {
    if (pts.length < 3) return;
    const faces = T.ShapeUtils.triangulateShape(pts.map((p) => new T.Vector2(p[0], p[1])), []);
    for (const f of faces) {
      let [a, b, c] = f.map((i) => pts[i]);
      const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
      if (ny < 0) { const t = b; b = c; c = t; }
      for (const p of [a, b, c]) {
        pos.push(p[0], hFn(p[0], p[1]) + lift, p[1]);
        if (uvFn) uv.push(...uvFn(p[0], p[1])); else uv.push(p[0] * uvScale, -p[1] * uvScale);
      }
    }
  }

  // the playing surface of one area, in 20 cm cells clipped to the area's outline (so slopes and ramps bend smoothly)
  // which: 'flat' or 'slope' (slopes get painted arrows pointing the way the ball rolls)
  const GP = { h: 0, gx: 0, gz: 0, kind: 'green', ux: 0, uz: 0 };
  function surfaceGeo(H, area, hFn, skip, which) {
    const pos = [], uv = [], C = 0.2;
    const Hs = Object.assign({}, H, { bridge: null, water: [] });
    const pts = area.pts;
    for (let x = Math.floor(area.minx / C) * C; x < area.maxx - 1e-6; x += C) {
      for (let z = Math.floor(area.minz / C) * C; z < area.maxz - 1e-6; z += C) {
        const poly = clipBox(pts, x, z, x + C, z + C);
        if (poly.length < 3) continue;
        let mx = 0, mz = 0;
        for (const p of poly) { mx += p[0]; mz += p[1]; }
        mx /= poly.length; mz /= poly.length;
        if (skip(mx, mz)) continue;
        const g = P.ground(Hs, mx, mz, 0, GP), gl = Math.hypot(g.gx, g.gz);
        if ((gl > 0.02) !== (which === 'slope')) continue;
        if (which === 'slope') {
          const dx = -g.gx / gl, dz = -g.gz / gl; // downhill
          pushPoly(pos, uv, poly, hFn, 0, 0.5, (x, z) => [(x * -dz + z * dx) * 0.8, (x * dx + z * dz) * 0.8]);
        } else pushPoly(pos, uv, poly, hFn, 0, 0.5);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }

  function flatPolyGeo(pts, y, uvScale = 0.5) {
    const pos = [], uv = [];
    pushPoly(pos, uv, pts, () => y, 0, uvScale);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }

  // A wall along a segment: its inside face exactly on the line the ball bounces off, its top following the ground
  // (up ramps), its outside face reaching down to the lawn. mats: [ends, top, outside, inside]
  const WALL_T = 0.14, WALL_H = 0.24, BOTTOM = -0.6;
  function wallMesh(a, b, out, hFn, mats, parent) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / 0.5));
    const geo = new T.BoxGeometry(1, 1, 1, n, 1, 1);
    const p = geo.attributes.position;
    const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
    for (let i = 0; i < p.count; i++) {
      const t = p.getX(i) + 0.5, top = p.getY(i) > 0, o = p.getZ(i) + 0.5;
      const x = a[0] + dx * len * t, z = a[1] + dz * len * t;
      const hin = hFn(x - out[0] * 0.15, z - out[1] * 0.15);
      p.setXYZ(i, x + out[0] * o * WALL_T, top ? hin + WALL_H : BOTTOM, z + out[1] * o * WALL_T);
    }
    geo.computeVertexNormals();
    // BoxGeometry groups: +x, -x, +y, -y, +z (outside), -z (inside)
    const m = new T.Mesh(geo, [mats[0], mats[0], mats[1], mats[1], mats[2], mats[3]]);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function outwardOf(polyObj, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const nx = dz / L, nz = -dx / L, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    return P.inPoly(polyObj, mx + nx * 0.05, mz + nz * 0.05) ? [-nx, -nz] : [nx, nz];
  }

  // ------------------------------------------------------------------ building a hole
  function clearHole() {
    if (!hole) return;
    scene.remove(hole.group);
    hole.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    hole = null;
  }

  function buildHole(H, theme, number) {
    clearHole();
    const g = new T.Group();
    scene.add(g);
    hole = { group: g, H, theme, water: [], bumpers: [], hFn: heightFn(H), t: 0 };
    const hFn = hole.hFn;
    scene.background = new T.Color(theme.sky);
    scene.fog.color = new T.Color(theme.fog);
    groundMesh.material.color = new T.Color(theme.ground);

    const laneMat = std('#ffffff', { map: stripeTex(theme.lane, theme.lane2), roughness: 0.95 });
    const wallMats = [std(theme.wall), std(theme.wall, { roughness: 0.6 }), std(theme.wallSide), std(theme.wall)];
    const rimMat = std(theme.rim, { roughness: 0.5 });
    const special = !!(H.windmill || H.def.tunnel);

    // the green
    const inBlock = (x, z) => H.blocks.some((b) => P.inPoly(b, x, z));
    const inWater = (x, z) => H.water.some((w) => P.inPoly(w, x, z));
    for (const area of H.areas) {
      const skip = (x, z) => inWater(x, z) || inBlock(x, z);
      const m = new T.Mesh(surfaceGeo(H, area, hFn, skip, 'flat'), laneMat);
      m.receiveShadow = true;
      g.add(m);
      if (H.slopes.length || H.bumps.length) {
        const sm = new T.Mesh(surfaceGeo(H, area, hFn, skip, 'slope'), std('#ffffff', { map: chevronTex(theme.lane, theme.lane2), roughness: 0.95 }));
        sm.receiveShadow = true;
        g.add(sm);
      }
      // walls all round it, with a little round post on each outside corner
      const pts = area.pts;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        wallMesh(a, b, outwardOf(area, a, b), hFn, wallMats, g);
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[(i + pts.length - 1) % pts.length], v = pts[i], b = pts[(i + 1) % pts.length];
        const o1 = outwardOf(area, a, v), o2 = outwardOf(area, v, b);
        const cross = (v[0] - a[0]) * (b[1] - v[1]) - (v[1] - a[1]) * (b[0] - v[0]);
        const bx = o1[0] + o2[0], bz = o1[1] + o2[1], bl = Math.hypot(bx, bz) || 1;
        // only where the corner points out (inside corners would poke into the green)
        if (P.inPoly(area, v[0] - (bx / bl) * 0.1, v[1] - (bz / bl) * 0.1) && Math.sign(cross) !== 0) {
          const h = hFn(v[0] - (bx / bl) * 0.2, v[1] - (bz / bl) * 0.2);
          const post = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, h + WALL_H + 0.06 - BOTTOM, 10), rimMat);
          post.position.set(v[0] + (bx / bl) * 0.08, (h + WALL_H + 0.06 + BOTTOM) / 2, v[1] + (bz / bl) * 0.08);
          post.castShadow = true;
          g.add(post);
        }
      }
    }
    // solid blocks (the windmill and the hill draw their own)
    if (!special) {
      for (const b of H.blocks) {
        const sh = new T.Shape(b.pts.map((p) => new T.Vector2(p[0], -p[1])));
        const top = Math.max(...b.pts.map((p) => hFn(p[0], p[1]))) + WALL_H + 0.1;
        const m = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: top - BOTTOM, bevelEnabled: false }), wallMats[0]);
        m.rotation.x = -Math.PI / 2;
        m.position.y = BOTTOM;
        m.castShadow = m.receiveShadow = true;
        g.add(m);
      }
    }
    // sand
    if (H.sand.length) {
      const sm = std('#ffffff', { map: sandTex(theme.sand, theme.props === 'candy' ? '255,120,190' : null), roughness: theme.props === 'candy' ? 0.5 : 1 });
      sm.map.repeat.set(1, 1);
      for (const s of H.sand) {
        const pos = [], uv = [];
        pushPoly(pos, uv, s.pts, hFn, 0.008, 0.8);
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        geo.computeVertexNormals();
        const m = new T.Mesh(geo, sm);
        m.receiveShadow = true;
        g.add(m);
      }
    }
    // water: a rippling surface over a deep blue bed, with sides
    for (const w of H.water) {
      let cx = 0, cz = 0;
      for (const p of w.pts) { cx += p[0]; cz += p[1]; }
      cx /= w.pts.length; cz /= w.pts.length;
      const lvl = Math.min(...w.pts.map((p) => hFn(p[0], p[1]))) - 0.12;
      const tex = waterTex(theme.water);
      const wm = new T.Mesh(flatPolyGeo(w.pts, lvl, 0.6), std('#ffffff', { map: tex, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.88 }));
      g.add(wm);
      hole.water.push(tex);
      const bed = new T.Mesh(flatPolyGeo(w.pts, lvl - 0.3), std(gfx.shade(theme.water, -0.45)));
      g.add(bed);
      const sideMat = std(gfx.shade(theme.water, -0.3), { side: T.DoubleSide });
      for (let i = 0; i < w.pts.length; i++) {
        const a = w.pts[i], b = w.pts[(i + 1) % w.pts.length];
        const ha = hFn(a[0], a[1]), hb = hFn(b[0], b[1]);
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute([a[0], ha, a[1], b[0], hb, b[1], b[0], lvl - 0.3, b[1], a[0], ha, a[1], b[0], lvl - 0.3, b[1], a[0], lvl - 0.3, a[1]], 3));
        geo.computeVertexNormals();
        g.add(new T.Mesh(geo, sideMat));
      }
    }
    // bumpers (red mushrooms with white spots) and rocks
    const capMat = std('#ffffff', { map: dotsTex(theme.bumper || '#ff4b5c', '#ffffff'), roughness: 0.5 });
    const stemMat = std('#fff6e6');
    const rockMat = std(theme.rock || '#a9a9b8', { roughness: theme.rock ? 0.35 : 0.9, flatShading: !theme.rock });
    for (const c of H.circles) {
      const h = hFn(c.x, c.z);
      if (c.kick) {
        const grp = new T.Group();
        grp.position.set(c.x, h, c.z);
        const stem = new T.Mesh(new T.CylinderGeometry(c.r * 0.62, c.r * 0.72, 0.3, 16), stemMat);
        stem.position.y = 0.15;
        const cap = new T.Mesh(new T.SphereGeometry(c.r * 1.08, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
        cap.position.y = 0.26;
        cap.scale.y = 0.75;
        stem.castShadow = cap.castShadow = true;
        grp.add(stem, cap);
        g.add(grp);
        hole.bumpers.push({ c, grp, pop: 0 });
      } else {
        const r = new T.Mesh(theme.rock ? new T.SphereGeometry(c.r * 1.05, 18, 12) : new T.DodecahedronGeometry(c.r * 1.05, 0), rockMat);
        r.position.set(c.x, h + c.r * 0.35, c.z);
        r.scale.y = 0.75;
        r.rotation.y = c.x * 3 + c.z;
        r.castShadow = r.receiveShadow = true;
        g.add(r);
      }
    }
    if (H.windmill) hole.windmill = buildWindmill(g, H.windmill, hFn, theme);
    if (H.bridge) hole.bridge = buildBridge(g, H.bridge);
    if (H.loop) buildLoop(g, H.loop);
    if (H.def.tunnel) buildHill(g, H.def.tunnel, theme);
    // the tee mat
    const tee = new T.Mesh(new T.BoxGeometry(0.9, 0.02, 0.7), std('#2f7d3a', { roughness: 1 }));
    tee.position.set(H.tee.x, hFn(H.tee.x, H.tee.z) + 0.006, H.tee.z);
    tee.receiveShadow = true;
    g.add(tee);
    for (const s of [-1, 1]) {
      const m = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), rimMat);
      m.position.set(H.tee.x + s * 0.4, tee.position.y + 0.04, H.tee.z + 0.3);
      g.add(m);
    }
    buildCup(g, H, number, theme);
    if (theme.props === 'candy') candyland(g, H, theme); else garden(g, H, theme);
    // shadows cover the whole hole
    const b = H.bounds, cx = (b.minx + b.maxx) / 2, cz = (b.minz + b.maxz) / 2;
    const span = Math.max(b.maxx - b.minx, b.maxz - b.minz) / 2 + 4;
    sun.position.set(cx + 6, 14, cz + 8);
    sun.target.position.set(cx, 0, cz);
    const sc = sun.shadow.camera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = 50;
    sc.updateProjectionMatrix();
    return hole;
  }

  function buildCup(g, H, number, theme) {
    const h = hole.hFn(H.cup.x, H.cup.z);
    const cup = new T.Group();
    cup.position.set(H.cup.x, h, H.cup.z);
    g.add(cup);
    const holeTex = gfx.radialTexture(128, [[0, '#050805'], [0.75, '#0d150d'], [0.92, '#2a3a2a'], [1, '#2a3a2a']]);
    const disc = new T.Mesh(new T.CircleGeometry(1, 32), new T.MeshBasicMaterial({ map: holeTex }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.006;
    const ring = new T.Mesh(new T.RingGeometry(1, 1.12, 40), new T.MeshBasicMaterial({ color: '#ffffff' }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.007;
    const sizer = new T.Group();
    sizer.add(disc, ring);
    cup.add(sizer);
    // the flag, with the hole's number
    const flag = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 1.5, 8), std('#ffffff'));
    pole.position.y = 0.75;
    pole.castShadow = true;
    const [c, cg] = makeCanvas(128, 96);
    cg.fillStyle = theme.rim;
    cg.beginPath(); cg.moveTo(0, 0); cg.lineTo(128, 48); cg.lineTo(0, 96); cg.closePath(); cg.fill();
    cg.fillStyle = '#ffffff';
    cg.font = `bold 50px ${gfx.FONT}`;
    cg.textAlign = 'center';
    cg.textBaseline = 'middle';
    cg.fillText(String(number), 42, 50);
    const cloth = new T.Mesh(new T.PlaneGeometry(0.62, 0.46, 6, 1), new T.MeshStandardMaterial({ map: toTexture(c), transparent: true, side: T.DoubleSide, roughness: 0.8 }));
    cloth.position.set(0.31, 1.25, 0);
    cloth.castShadow = true;
    flag.add(pole, cloth);
    cup.add(flag);
    hole.cup = { group: cup, sizer, flag, cloth, lift: 0 };
  }

  function buildWindmill(g, w, hFn, theme) {
    const x = w.x, face = w.face - 0.08, back = w.back, lane = w.lane, half = w.half;
    const depth = face - back, zc = (face + back) / 2, top = 2.2;
    const look = theme.mill || {};
    const wallMat = std(look.wall || '#f6e7cf'), trim = std(look.trim || '#d24a3a'), roofMat = std(look.roof || '#8a4cd6', { flatShading: true }), wood = std(look.trim ? '#ffffff' : '#8a5a2b');
    const box = (x0, x1, y0, y1, mat) => {
      const m = new T.Mesh(new T.BoxGeometry(x1 - x0, y1 - y0, depth), mat);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, zc);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return m;
    };
    box(-lane - 0.3, x - half, BOTTOM, top, wallMat);
    box(x + half, lane + 0.3, BOTTOM, top, wallMat);
    box(x - half, x + half, 0.62, top, wallMat);
    // a red frame round the door
    const fr = new T.Mesh(new T.BoxGeometry(half * 2 + 0.2, 0.12, 0.06), trim);
    fr.position.set(x, 0.66, face + 0.03);
    g.add(fr);
    const roof = new T.Mesh(new T.ConeGeometry((lane + 0.6) * 1.15, 1.6, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = (depth + 0.5) / ((lane + 0.6) * 1.6);
    roof.position.set(x, top + 0.8, zc);
    roof.castShadow = true;
    g.add(roof);
    // the sails turn on a hub in front of the door; when one points down it blocks the doorway
    const rotor = new T.Group();
    rotor.position.set(x, 1.45, face + 0.16);
    const hub = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 0.16, 12), trim);
    hub.rotation.x = Math.PI / 2;
    rotor.add(hub);
    const sail = std('#ffffff', { side: T.DoubleSide });
    for (let k = 0; k < w.blades; k++) {
      const arm = new T.Group();
      arm.rotation.z = (k / w.blades) * Math.PI * 2;
      const pole = new T.Mesh(new T.BoxGeometry(0.07, 1.4, 0.06), wood);
      pole.position.y = -0.72;
      const cloth = new T.Mesh(new T.BoxGeometry(0.36, 1.0, 0.03), sail);
      cloth.position.set(0.2, -0.84, 0.02);
      pole.castShadow = cloth.castShadow = true;
      arm.add(pole, cloth);
      rotor.add(arm);
    }
    g.add(rotor);
    return { rotor, w };
  }

  function buildBridge(g, b) {
    const grp = new T.Group();
    const len = b.z0 - b.z1, slope = Math.atan2(b.h0 - b.h1, len);
    const plank = std('#c98a4b'), plank2 = std('#a8693a');
    const deck = new T.Group();
    deck.rotation.x = -slope;
    deck.position.set(0, (b.h0 + b.h1) / 2, (b.z0 + b.z1) / 2);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const p = new T.Mesh(new T.BoxGeometry(b.half * 2, 0.07, len / n - 0.02), i % 2 ? plank : plank2);
      p.position.set(0, -0.035, -len / 2 + (i + 0.5) * (len / n));
      p.castShadow = p.receiveShadow = true;
      deck.add(p);
    }
    for (const s of [-1, 1]) {
      const rail = new T.Mesh(new T.BoxGeometry(0.08, 0.2, len - 0.24), std('#ffd27a'));
      rail.position.set(s * (b.half + 0.04), 0.1, 0);
      rail.castShadow = true;
      deck.add(rail);
      for (const e of [-1, 1]) {
        const post = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.34, 8), std('#ff5a5f'));
        post.position.set(s * (b.half + 0.04), 0.14, e * (len / 2 - 0.15));
        deck.add(post);
      }
    }
    grp.add(deck);
    g.add(grp);
    return { grp, b };
  }

  function buildLoop(g, L) {
    const R = P.R;
    const curve = new T.Curve();
    const tmp = { x: 0, y: 0, z: 0 };
    curve.getPoint = (t, out = new T.Vector3()) => {
      P.loopPos(L, t * Math.PI * 2 * L.R, tmp);
      return out.set(tmp.x, tmp.y + R, tmp.z);
    };
    const tube = new T.Mesh(new T.TubeGeometry(curve, 90, 0.2, 14, false), new T.MeshStandardMaterial({ color: '#a8ecff', transparent: true, opacity: 0.32, roughness: 0.1, side: T.DoubleSide, depthWrite: false }));
    g.add(tube);
    // two red rails under the ball's path, and posts holding it up
    for (const s of [-1, 1]) {
      const rail = new T.Curve();
      rail.getPoint = (t, out = new T.Vector3()) => {
        const a = t * Math.PI * 2;
        P.loopPos(L, a * L.R, tmp);
        // outward from the loop's middle, where the ball presses
        const ox = 0, oy = -Math.cos(a), oz = -Math.sin(a);
        return out.set(tmp.x + s * 0.08 + ox, tmp.y + R + oy * 0.1, tmp.z + oz * 0.1);
      };
      g.add(new T.Mesh(new T.TubeGeometry(rail, 90, 0.025, 6, false), std('#ff5a5f', { roughness: 0.4 })));
    }
    for (const s of [-1, 1]) {
      const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, L.R * 2 + 0.6, 8), std('#ffd27a'));
      pole.position.set(L.x + (s < 0 ? -0.35 : L.side * L.w + 0.35), (L.h || 0) + L.R, L.z);
      pole.castShadow = true;
      g.add(pole);
    }
    const bar = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, L.w + 0.7, 8), std('#ffd27a'));
    bar.rotation.z = Math.PI / 2;
    bar.position.set(L.x + (L.side * L.w) / 2, (L.h || 0) + L.R * 2 + 0.3, L.z);
    g.add(bar);
  }

  // the grassy hill with its tunnels: a rounded slab, extruded along the lane, with arch-shaped holes
  function buildHill(g, t, theme) {
    const sh = new T.Shape();
    const x0 = t.x0 - 0.3, x1 = t.x1 + 0.3, mid = (x0 + x1) / 2;
    sh.moveTo(x0, BOTTOM);
    sh.lineTo(x1, BOTTOM);
    sh.lineTo(x1, 0.4);
    sh.bezierCurveTo(x1, 1.5, mid + 0.8, 1.9, mid, 1.9);
    sh.bezierCurveTo(mid - 0.8, 1.9, x0, 1.5, x0, 0.4);
    sh.lineTo(x0, BOTTOM);
    for (const [a, b] of t.holes) {
      const hole = new T.Path();
      const r = (b - a) / 2;
      hole.moveTo(a, -0.05);
      hole.lineTo(b, -0.05);
      hole.lineTo(b, 0.3);
      hole.absarc(a + r, 0.3, r, 0, Math.PI, false);
      hole.lineTo(a, -0.05);
      sh.holes.push(hole);
    }
    const geo = new T.ExtrudeGeometry(sh, { depth: t.z0 - t.z1, bevelEnabled: false, curveSegments: 18 });
    const m = new T.Mesh(geo, std(theme.hill, { roughness: 1 }));
    m.position.z = t.z1;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    // stone rims round the tunnel mouths
    const stone = std('#d8d2c4', { roughness: 1 });
    for (const [a, b] of t.holes) {
      for (const z of [t.z0 + 0.01, t.z1 - 0.01]) {
        const r = (b - a) / 2;
        const arch = new T.Mesh(new T.TorusGeometry(r + 0.06, 0.07, 6, 16, Math.PI), stone);
        arch.position.set(a + r, 0.3, z);
        g.add(arch);
      }
    }
    // flowers on top
    flowersAt(g, Array.from({ length: 14 }, (_, i) => [x0 + 0.4 + (i % 7) * ((x1 - x0 - 0.8) / 6), 0, t.z1 + 0.6 + Math.floor(i / 7) * (t.z0 - t.z1 - 1.2)]), (x, z) => {
      const u = (x - mid) / ((x1 - x0) / 2);
      return 1.9 - 1.3 * u * u;
    });
  }

  // ------------------------------------------------------------------ the garden round the course
  let flowerGeo = null;
  function flowersAt(g, spots, hAt) {
    if (!spots.length) return;
    flowerGeo = flowerGeo || {
      stem: new T.CylinderGeometry(0.02, 0.02, 0.4, 5).translate(0, 0.2, 0),
      head: new T.SphereGeometry(0.1, 8, 6).translate(0, 0.42, 0),
      eye: new T.SphereGeometry(0.05, 6, 5).translate(0, 0.45, 0.06),
    };
    const cols = ['#ff5a8a', '#ffd400', '#ff8a1f', '#b06bff', '#ffffff', '#ff3d3d'];
    const stems = new T.InstancedMesh(flowerGeo.stem, std('#3a9a3a'), spots.length);
    const heads = new T.InstancedMesh(flowerGeo.head, std('#ffffff', { roughness: 0.6 }), spots.length);
    const eyes = new T.InstancedMesh(flowerGeo.eye, std('#ffe14a'), spots.length);
    const m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3();
    spots.forEach(([x, , z], i) => {
      const k = 0.8 + ((i * 37) % 10) / 20;
      p.set(x, hAt(x, z), z);
      q.setFromAxisAngle(new T.Vector3(0, 1, 0), i * 1.7);
      s.set(k, k, k);
      m.compose(p, q, s);
      stems.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
      eyes.setMatrixAt(i, m);
      heads.setColorAt(i, new T.Color(cols[i % cols.length]));
    });
    stems.castShadow = heads.castShadow = true;
    g.add(stems, heads, eyes);
  }

  function garden(g, H, theme) {
    const rand = MG.checks.rng(H.def.name.length * 97 + 13);
    const b = H.bounds, M = 3.4;
    const x0 = b.minx - M, x1 = b.maxx + M, z0 = b.minz - M, z1 = b.maxz + M;
    const near = (x, z, d) => {
      for (let a = 0; a < 8; a++) if (P.onCourse(H, x + Math.cos(a) * d, z + Math.sin(a) * d) || H.areas.some((ar) => P.inPoly(ar, x + Math.cos(a) * d, z + Math.sin(a) * d))) return true;
      return H.areas.some((ar) => P.inPoly(ar, x, z));
    };
    const spots = [], bushes = [];
    for (let i = 0; i < 400 && spots.length < 70; i++) {
      const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0);
      if (!near(x, z, 0.55)) spots.push([x, 0, z]);
    }
    flowersAt(g, spots, () => -0.35);
    const bushMat = std('#3faa4a', { roughness: 1, flatShading: true });
    for (let i = 0; i < 300 && bushes.length < 12; i++) {
      const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0);
      if (!near(x, z, 1.1)) bushes.push([x, z]);
    }
    for (const [x, z] of bushes) {
      for (let k = 0; k < 3; k++) {
        const r = 0.35 + rand() * 0.25;
        const m = new T.Mesh(new T.IcosahedronGeometry(r, 1), bushMat);
        m.position.set(x + (k - 1) * 0.35, -0.35 + r * 0.7, z + (rand() - 0.5) * 0.3);
        m.castShadow = true;
        g.add(m);
      }
    }
    // trees outside the fence
    const trunk = std('#8a5a2b'), leaf = std('#4cc04a', { flatShading: true }), leaf2 = std('#62d65a', { flatShading: true });
    const trees = [[x0 - 1.5, z0 + 2], [x1 + 1.6, z0 + 4], [x0 - 2, (z0 + z1) / 2], [x1 + 2, z1 - 3], [x0 - 1, z1 + 1.5], [x1 + 1, z0 - 1.5]];
    for (const [x, z] of trees) {
      const t = new T.Mesh(new T.CylinderGeometry(0.18, 0.25, 2.2, 8), trunk);
      t.position.set(x, -0.35 + 1.1, z);
      t.castShadow = true;
      g.add(t);
      [[0, 2.5, 0, 1.3, leaf], [0.5, 3.1, 0.2, 0.9, leaf2], [-0.5, 3.0, -0.2, 0.85, leaf2]].forEach(([dx, y, dz, r, mat]) => {
        const f = new T.Mesh(new T.IcosahedronGeometry(r, 1), mat);
        f.position.set(x + dx, -0.35 + y, z + dz);
        f.castShadow = true;
        g.add(f);
      });
    }
    // a white picket fence
    const pick = new T.BoxGeometry(0.1, 0.7, 0.05).translate(0, 0.35, 0);
    const per = 2 * (x1 - x0 + z1 - z0), n = Math.floor(per / 0.32);
    const fence = new T.InstancedMesh(pick, std('#ffffff'), n);
    const m = new T.Matrix4();
    for (let i = 0; i < n; i++) {
      let d = i * 0.32, x, z, rot = 0;
      if (d < x1 - x0) { x = x0 + d; z = z0; } else if ((d -= x1 - x0) < z1 - z0) { x = x1; z = z0 + d; rot = Math.PI / 2; } else if ((d -= z1 - z0) < x1 - x0) { x = x1 - d; z = z1; } else { d -= x1 - x0; x = x0; z = z1 - d; rot = Math.PI / 2; }
      m.makeRotationY(rot).setPosition(x, -0.35, z);
      fence.setMatrixAt(i, m);
    }
    fence.castShadow = true;
    g.add(fence);
    for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]) {
      const len = Math.hypot(bx - ax, bz - az);
      const rail = new T.Mesh(new T.BoxGeometry(len, 0.07, 0.04), std('#ffffff'));
      rail.position.set((ax + bx) / 2, -0.35 + 0.45, (az + bz) / 2);
      rail.rotation.y = -Math.atan2(bz - az, bx - ax);
      g.add(rail);
    }
  }

  // ------------------------------------------------------------------ Candy Land round the course
  function swirlTex(a, b) {
    const key = 'swirl' + a + b;
    if (texCache[key]) return texCache[key];
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = b;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = a;
    g.lineWidth = 9;
    g.beginPath();
    for (let t = 0; t < 6 * Math.PI; t += 0.1) g.lineTo(64 + Math.cos(t) * t * 3.3, 64 + Math.sin(t) * t * 3.3);
    g.stroke();
    return (texCache[key] = toTexture(c));
  }
  function stripeCaneTex() {
    if (texCache.cane) return texCache.cane;
    const [c, g] = makeCanvas(64, 64);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#ff3d5f';
    for (let k = -64; k < 128; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 14, 0); g.lineTo(k + 14 + 64, 64); g.lineTo(k + 64, 64); g.fill(); }
    return (texCache.cane = toTexture(c, true));
  }
  function candyland(g, H, theme) {
    const rand = MG.checks.rng(H.def.name.length * 131 + 7);
    const b = H.bounds, M = 3.4;
    const x0 = b.minx - M, x1 = b.maxx + M, z0 = b.minz - M, z1 = b.maxz + M;
    const near = (x, z, d) => {
      for (let a = 0; a < 8; a++) if (H.areas.some((ar) => P.inPoly(ar, x + Math.cos(a) * d, z + Math.sin(a) * d))) return true;
      return H.areas.some((ar) => P.inPoly(ar, x, z));
    };
    const COLS = ['#ff4f9a', '#ffd400', '#18d4ff', '#7ed957', '#b06bff', '#ff8a1f'];
    // little lollipops and wrapped sweets scattered on the pink ground
    const spots = [];
    for (let i = 0; i < 400 && spots.length < 50; i++) {
      const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0);
      if (!near(x, z, 0.55)) spots.push([x, z]);
    }
    const sticks = new T.InstancedMesh(new T.CylinderGeometry(0.025, 0.025, 0.55, 5).translate(0, 0.27, 0), std('#ffffff'), spots.length);
    const pops = new T.InstancedMesh(new T.CylinderGeometry(0.17, 0.17, 0.06, 14).rotateX(Math.PI / 2).translate(0, 0.62, 0), std('#ffffff', { roughness: 0.3 }), spots.length);
    const m = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(1, 1, 1), pv = new T.Vector3(), up = new T.Vector3(0, 1, 0);
    spots.forEach(([x, z], i) => {
      q.setFromAxisAngle(up, rand() * Math.PI * 2);
      m.compose(pv.set(x, -0.35, z), q, sc);
      sticks.setMatrixAt(i, m);
      pops.setMatrixAt(i, m);
      pops.setColorAt(i, new T.Color(COLS[i % COLS.length]));
    });
    sticks.castShadow = pops.castShadow = true;
    g.add(sticks, pops);
    // gumdrops instead of bushes
    for (let i = 0, n = 0; i < 300 && n < 12; i++) {
      const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0);
      if (near(x, z, 1.0)) continue;
      n++;
      const r = 0.35 + rand() * 0.25;
      const gd = new T.Mesh(new T.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(COLS[n % COLS.length], { roughness: 0.25, transparent: true, opacity: 0.92 }));
      gd.scale.y = 1.3;
      gd.position.set(x, -0.35, z);
      gd.castShadow = true;
      g.add(gd);
    }
    // giant lollipops and candy canes outside the fence
    const stick = std('#ffffff');
    const trees = [[x0 - 1.5, z0 + 2], [x1 + 1.6, z0 + 4], [x0 - 2, (z0 + z1) / 2], [x1 + 2, z1 - 3], [x0 - 1, z1 + 1.5], [x1 + 1, z0 - 1.5]];
    trees.forEach(([x, z], i) => {
      if (i % 3 === 2) {
        const cane = new T.Group();
        const tex = stripeCaneTex();
        const mat = std('#ffffff', { map: tex, roughness: 0.4 });
        const pole = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 3, 12), mat);
        pole.position.y = 1.5;
        const hook = new T.Mesh(new T.TorusGeometry(0.45, 0.16, 10, 18, Math.PI), mat);
        hook.position.set(0.45, 3, 0);
        cane.add(pole, hook);
        cane.position.set(x, -0.35, z);
        cane.rotation.y = i;
        cane.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        g.add(cane);
        return;
      }
      const st = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 2.8, 8), stick);
      st.position.set(x, -0.35 + 1.4, z);
      const disc = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 0.22, 32), [std(COLS[i % COLS.length]), std('#ffffff', { map: swirlTex(COLS[i % COLS.length], '#ffffff'), roughness: 0.3 }), std('#ffffff', { map: swirlTex(COLS[i % COLS.length], '#ffffff'), roughness: 0.3 })]);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(x, -0.35 + 3.6, z);
      disc.lookAt(cam.pos.x, disc.position.y, cam.pos.z);
      disc.rotateX(Math.PI / 2);
      st.castShadow = disc.castShadow = true;
      g.add(st, disc);
    });
    // a candy-cane fence: red and white posts
    const post = new T.CylinderGeometry(0.06, 0.06, 0.75, 6).translate(0, 0.37, 0);
    const per = 2 * (x1 - x0 + z1 - z0), n = Math.floor(per / 0.32);
    const fence = new T.InstancedMesh(post, std('#ffffff', { roughness: 0.4 }), n);
    for (let i = 0; i < n; i++) {
      let d = i * 0.32, x, z;
      if (d < x1 - x0) { x = x0 + d; z = z0; } else if ((d -= x1 - x0) < z1 - z0) { x = x1; z = z0 + d; } else if ((d -= z1 - z0) < x1 - x0) { x = x1 - d; z = z1; } else { d -= x1 - x0; x = x0; z = z1 - d; }
      m.makeTranslation(x, -0.35, z);
      fence.setMatrixAt(i, m);
      fence.setColorAt(i, new T.Color(i % 2 ? '#ffffff' : '#ff3d5f'));
    }
    fence.castShadow = true;
    g.add(fence);
  }

  function clouds() {
    const mat = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 });
    const rand = MG.checks.rng(5);
    for (let i = 0; i < 9; i++) {
      const c = new T.Group();
      const a = (i / 9) * Math.PI * 2, d = 55 + rand() * 25;
      c.position.set(Math.cos(a) * d, 14 + rand() * 10, Math.sin(a) * d);
      for (let k = 0; k < 4; k++) {
        const s = new T.Mesh(new T.SphereGeometry(2.4 + rand() * 1.6, 10, 8), mat);
        s.position.set(k * 2.6 - 4, rand() * 1.2, rand() * 1.5);
        c.add(s);
      }
      c.lookAt(0, c.position.y, 0);
      scene.add(c);
    }
  }

  // ------------------------------------------------------------------ balls
  function makeBall(color) {
    const m = new T.Mesh(new T.SphereGeometry(P.R, 24, 16), std(color, { roughness: 0.35 }));
    m.castShadow = true;
    // a little stripe so you can see it roll
    const band = new T.Mesh(new T.TorusGeometry(P.R * 0.99, P.R * 0.18, 6, 24), std('#ffffff', { roughness: 0.4 }));
    m.add(band);
    const ring = new T.Mesh(new T.RingGeometry(P.R * 1.7, P.R * 2.3, 32), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    scene.add(m, ring);
    const b = { mesh: m, ring, color, last: new T.Vector3(), q: new T.Quaternion() };
    balls.push(b);
    return b;
  }
  const axis = new T.Vector3(), dq = new T.Quaternion();
  function placeBall(b, x, y, z, opts = {}) {
    const m = b.mesh;
    const dx = x - b.last.x, dz = z - b.last.z, d = Math.hypot(dx, dz);
    if (d > 1e-5 && d < 1) {
      axis.set(dz, 0, -dx).normalize();
      dq.setFromAxisAngle(axis, d / P.R);
      m.quaternion.premultiply(dq);
    }
    b.last.set(x, y, z);
    m.position.set(x, y + (opts.drop || 0), z);
    m.visible = opts.visible !== false;
    m.material.transparent = !!opts.ghost;
    m.material.opacity = opts.ghost ? 0.45 : 1;
    b.ring.visible = !!opts.ring && m.visible;
    b.ring.position.set(x, y - P.R + 0.012, z);
    if (opts.ring) { const s = 1 + Math.sin(performance.now() / 180) * 0.12; b.ring.scale.set(s, s, s); }
  }

  // ------------------------------------------------------------------ the aim guide, the buddy's hint line
  const aim = {};
  function makeAimBits() {
    const N = 48;
    aim.dots = new T.InstancedMesh(new T.SphereGeometry(0.045, 8, 6), new T.MeshBasicMaterial({ color: '#ffffff' }), N);
    aim.dots.count = 0;
    aim.dots.frustumCulled = false;
    aim.hint = new T.InstancedMesh(new T.SphereGeometry(0.07, 10, 8), new T.MeshBasicMaterial({ color: '#ffe14a', transparent: true, opacity: 0.95 }), N);
    aim.hint.count = 0;
    aim.hint.frustumCulled = false;
    aim.halo = new T.InstancedMesh(new T.PlaneGeometry(0.42, 0.42), new T.MeshBasicMaterial({ map: gfx.glowTexture(), color: '#ffd400', transparent: true, depthWrite: false, blending: T.AdditiveBlending }), N);
    aim.halo.count = 0;
    aim.halo.frustumCulled = false;
    // the stretched band behind the ball while you pull back (the slingshot)
    aim.band = new T.Mesh(new T.BoxGeometry(1, 0.03, 1), new T.MeshBasicMaterial({ color: '#ff4b5c', transparent: true, opacity: 0.75 }));
    aim.band.visible = false;
    scene.add(aim.dots, aim.hint, aim.halo, aim.band);
  }
  const M4 = new T.Matrix4(), V3 = new T.Vector3(), Q = new T.Quaternion(), S1 = new T.Vector3(1, 1, 1);
  // points: [[x, y, z], ...]
  function showAim(points, color) {
    aim.dots.material.color.set(color || '#ffffff');
    const n = Math.min(points.length, 48);
    for (let i = 0; i < n; i++) {
      const [x, y, z] = points[i];
      const s = 1 - (i / n) * 0.45;
      M4.compose(V3.set(x, y, z), Q, S1.set(s, s, s));
      aim.dots.setMatrixAt(i, M4);
    }
    aim.dots.count = n;
    aim.dots.instanceMatrix.needsUpdate = true;
  }
  function showBand(x, y, z, angle, len) {
    aim.band.visible = len > 0.02;
    aim.band.scale.set(0.06, 1, len);
    aim.band.rotation.y = -angle;
    aim.band.position.set(x - Math.sin(angle) * len / 2, y, z + Math.cos(angle) * len / 2);
  }
  function showHint(points) {
    const n = Math.min(points.length, 48);
    const t = performance.now() / 1000;
    const camQ = camera.quaternion;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = points[i];
      const pulse = 1 + 0.35 * Math.sin(t * 6 - i * 0.6);
      M4.compose(V3.set(x, y, z), Q.identity(), S1.set(pulse, pulse, pulse));
      aim.hint.setMatrixAt(i, M4);
      M4.compose(V3.set(x, y, z), camQ, S1.set(pulse, pulse, pulse));
      aim.halo.setMatrixAt(i, M4);
    }
    Q.identity();
    aim.hint.count = aim.halo.count = n;
    aim.hint.instanceMatrix.needsUpdate = aim.halo.instanceMatrix.needsUpdate = true;
  }
  function hideAim() { aim.dots.count = 0; aim.band.visible = false; }
  function hideHint() { aim.hint.count = 0; aim.halo.count = 0; }

  // ------------------------------------------------------------------ particles: confetti, splashes, puffs, sparkles
  const parts = [];
  let confettiMesh, dotMesh;
  const PMAX = 400;
  function makeParticles() {
    confettiMesh = new T.InstancedMesh(new T.PlaneGeometry(0.09, 0.14), new T.MeshBasicMaterial({ side: T.DoubleSide }), PMAX);
    dotMesh = new T.InstancedMesh(new T.IcosahedronGeometry(0.06, 0), new T.MeshBasicMaterial({ transparent: true, opacity: 0.9 }), PMAX);
    confettiMesh.frustumCulled = dotMesh.frustumCulled = false;
    confettiMesh.count = dotMesh.count = 0;
    const white = new T.Color('#ffffff');
    for (let i = 0; i < PMAX; i++) { confettiMesh.setColorAt(i, white); dotMesh.setColorAt(i, white); }
    scene.add(confettiMesh, dotMesh);
  }
  function emit(kind, x, y, z, n, opts = {}) {
    const rand = Math.random;
    for (let i = 0; i < n && parts.length < PMAX * 2; i++) {
      const a = rand() * Math.PI * 2, sp = (opts.speed || 2) * (0.4 + rand() * 0.8);
      parts.push({
        kind, x: x + (rand() - 0.5) * (opts.spread || 0.1), y, z: z + (rand() - 0.5) * (opts.spread || 0.1),
        vx: Math.cos(a) * sp * (opts.flat || 1), vy: (opts.up || 3) * (0.6 + rand() * 0.7), vz: Math.sin(a) * sp * (opts.flat || 1),
        life: (opts.life || 1) * (0.7 + rand() * 0.6), t: 0, size: (opts.size || 1) * (0.6 + rand() * 0.8),
        color: new T.Color(Array.isArray(opts.color) ? opts.color[Math.floor(rand() * opts.color.length)] : opts.color || '#ffffff'),
        rx: rand() * 6, ry: rand() * 6, spin: (rand() - 0.5) * 14, g: opts.gravity === undefined ? 9 : opts.gravity, drag: opts.drag || 0,
      });
    }
  }
  const CONF = ['#ff3d7f', '#ffd400', '#18d4ff', '#3fe0b0', '#ff8a1f', '#9b6bff', '#ffffff'];
  const fx = {
    confetti(x, y, z) { emit('c', x, y + 0.5, z, 160, { speed: 3.2, up: 7, life: 2.6, color: CONF, gravity: 5, drag: 1.6, spread: 0.6 }); },
    splash(x, y, z) { emit('d', x, y, z, 40, { speed: 1.6, up: 3.6, life: 0.9, color: (hole && hole.theme.splash) || ['#ffffff', '#bfe9ff', '#7fd0ff'], size: 1 }); },
    sand(x, y, z) { emit('d', x, y, z, 18, { speed: 0.9, up: 1.6, life: 0.6, color: ['#f6dc92', '#e8c46a', '#fff1c4'], size: 0.8 }); },
    poof(x, y, z) { emit('d', x, y + 0.6, z, 30, { speed: 1.8, up: 1.4, life: 0.7, color: ['#ffffff', '#fff3c4', '#e8e8ff'], size: 2.2, gravity: -1, drag: 3, spread: 0.6 }); },
    sparkle(x, y, z) { emit('d', x, y + 0.1, z, 26, { speed: 1.4, up: 3, life: 0.8, color: ['#ffd400', '#ffffff', '#fff3a0'], size: 0.8, gravity: 4 }); },
    bump(x, y, z) { emit('d', x, y + 0.2, z, 10, { speed: 1.5, up: 1.5, life: 0.4, color: ['#ffffff', '#ffd400'], size: 0.6 }); },
  };
  function updateParticles(dt) {
    let nc = 0, nd = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.vy -= p.g * dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= p.kind === 'c' ? Math.exp(-p.drag * 0.6 * dt) : k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
      const fade = Math.min(1, (p.life - p.t) / 0.3);
      const s = p.size * fade;
      Q.setFromEuler(new T.Euler(p.rx, p.ry, 0));
      M4.compose(V3.set(p.x, p.y, p.z), Q, S1.set(s, s, s));
      if (p.kind === 'c' && nc < PMAX) { confettiMesh.setMatrixAt(nc, M4); confettiMesh.setColorAt(nc, p.color); nc++; } else if (nd < PMAX) { dotMesh.setMatrixAt(nd, M4); dotMesh.setColorAt(nd, p.color); nd++; }
    }
    Q.identity();
    confettiMesh.count = nc;
    dotMesh.count = nd;
    confettiMesh.instanceMatrix.needsUpdate = dotMesh.instanceMatrix.needsUpdate = true;
    if (confettiMesh.instanceColor) confettiMesh.instanceColor.needsUpdate = true;
    if (dotMesh.instanceColor) dotMesh.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------ people: the players with putters, the buddy
  const shaftMat = () => std('#c9ccd6', { metalness: 0.6, roughness: 0.3 });
  function makePerson(entry, scale) {
    const p = Kit.people.build(entry.look);
    const holder = new T.Group();
    holder.add(p.root);
    holder.scale.setScalar(scale);
    p.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(holder);
    // the putter: a grip at his hands, a shaft down to a head that sits just behind the ball
    const putter = new T.Group();
    putter.position.set(0, 0.86, -0.34);
    const len = Math.hypot(0.81, 0.3);
    const shaft = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, len, 6), shaftMat());
    shaft.position.set(0, -0.405, -0.15);
    shaft.rotation.x = Math.atan2(0.3, 0.81);
    const grip = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.22, 8), std('#222233'));
    grip.position.set(0, -0.09, -0.035);
    grip.rotation.x = shaft.rotation.x;
    const head = new T.Mesh(new T.BoxGeometry(0.28, 0.07, 0.08), std(entry.tag || '#ffd400', { metalness: 0.3, roughness: 0.4 }));
    head.position.set(0, -0.81, -0.3);
    putter.add(shaft, grip, head);
    putter.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    p.root.add(putter);
    return { holder, p, putter, entry, scale, ph: Math.random() * 6, swing: 0, mode: 'stand', jump: 0, tag: null };
  }
  function removePerson(pp) {
    if (!pp) return;
    scene.remove(pp.holder);
  }
  // where to stand to putt the ball at (x, y, z) toward angle a (his left side toward the target)
  const LOCAL_BALL = new T.Vector3(-0.1, 0, -0.66);
  function standToPutt(pp, x, y, z, a) {
    const th = Math.atan2(-Math.cos(a), -Math.sin(a));
    V3.copy(LOCAL_BALL).multiplyScalar(pp.scale).applyAxisAngle(new T.Vector3(0, 1, 0), th);
    pp.holder.position.set(x - V3.x, y - P.R, z - V3.z);
    pp.holder.rotation.y = th;
  }
  function facePoint(pp, x, z) {
    const dx = x - pp.holder.position.x, dz = z - pp.holder.position.z;
    pp.holder.rotation.y = Math.atan2(-dx, -dz);
  }
  // putting stance: knees soft, arms down to the grip; swing > 0 is the backswing
  function puttPose(pp, k) {
    const p = pp.p, to = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    to(p.legL.rotation, 'x', 0.08); to(p.legR.rotation, 'x', -0.04);
    to(p.legL.rotation, 'z', 0); to(p.legR.rotation, 'z', 0);
    to(p.armL.rotation, 'x', 0.5); to(p.armR.rotation, 'x', 0.5);
    to(p.armL.rotation, 'z', 0.32 + pp.swing * 0.9); to(p.armR.rotation, 'z', -0.32 + pp.swing * 0.9);
    to(p.hips.rotation, 'x', -0.12); to(p.hips.rotation, 'y', 0);
    to(p.head.rotation, 'x', 0.35);
    p.hips.position.y = p.hipY;
    p.rig.scale.setScalar(1);
    if (p.fingers) for (const f of p.fingers) f.visible = false;
    pp.putter.rotation.z = pp.swing;
  }
  function animPerson(pp, dt) {
    pp.ph += dt * 8;
    const k = 1 - Math.exp(-14 * dt);
    if (pp.mode === 'putt') { pp.putter.visible = true; puttPose(pp, k); }
    else {
      pp.putter.visible = pp.mode === 'stand' && pp.withPutter !== false;
      Kit.people.pose(pp.p, pp.ph, pp.mode === 'stand' ? 'none' : pp.mode, k);
      // stand still while celebrating (the kit's peace and wave stride)
      if (pp.mode !== 'run' && pp.mode !== 'walk') { pp.p.legL.rotation.x *= 0.2; pp.p.legR.rotation.x *= 0.2; }
    }
    // a hop (for the jump shot)
    if (pp.jump > 0) {
      pp.jump = Math.max(0, pp.jump - dt);
      const u = 1 - pp.jump / 0.7;
      pp.p.root.position.y = Math.sin(Math.min(1, u) * Math.PI) * 0.7;
    } else pp.p.root.position.y = 0;
  }

  // ------------------------------------------------------------------ per-frame: moving parts, water, flag, camera
  function update(Wd, dt, info) {
    if (!hole) return;
    hole.t += dt;
    const tick = Wd ? Wd.tick + Wd.acc * P.HZ : hole.t * P.HZ;
    if (hole.windmill) hole.windmill.rotor.rotation.z = P.windmillAngle(hole.windmill.w, tick);
    if (hole.bridge) hole.bridge.grp.position.x = P.bridgeX(hole.bridge.b, tick);
    for (const t of hole.water) { t.offset.x = (hole.t * 0.05) % 1; t.offset.y = (hole.t * 0.12) % 1; }
    for (const b of hole.bumpers) {
      b.pop = Math.max(0, b.pop - dt * 4);
      const s = 1 + Math.sin(b.pop * Math.PI) * 0.22;
      b.grp.scale.set(s, 1 + (s - 1) * 0.5, s);
    }
    const c = hole.cup;
    // the flag lifts out when a ball gets close, so it never hides the cup
    const want = info && info.flagUp ? 1 : 0;
    c.lift += (want - c.lift) * Math.min(1, dt * 5);
    c.flag.position.y = c.lift * 0.9;
    c.flag.visible = c.lift < 0.97;
    const pos = c.cloth.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + 0.31;
      pos.setZ(i, Math.sin(hole.t * 5 + x * 7) * 0.05 * x);
    }
    pos.needsUpdate = true;
    if (info && info.cupR) c.sizer.scale.set(info.cupR, 1, info.cupR);
    updateParticles(dt);
    // camera
    const k = cam.snap ? 1 : 1 - Math.exp(-cam.k * dt);
    cam.snap = false;
    cam.pos.lerp(cam.wantPos, k);
    cam.look.lerp(cam.wantLook, k);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
  }

  // follow: from behind the target, looking along yaw (0 = up the hole, -z)
  function camFollow(x, y, z, yaw, opts = {}) {
    const asp = view.w / view.h;
    const dist = (asp < 0.75 ? 9.4 : asp < 1.2 ? 7.6 : asp < 1.8 ? 6.8 : 7.4) * (opts.zoom || 1);
    const pitch = asp < 1 ? 0.98 : asp < 1.8 ? 0.8 : 0.88;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw), lead = asp < 1 ? 1.9 : 1.4;
    cam.wantLook.set(x + fx * lead, y, z + fz * lead);
    cam.wantPos.set(cam.wantLook.x - fx * dist * Math.cos(pitch), y + dist * Math.sin(pitch), cam.wantLook.z - fz * dist * Math.cos(pitch));
    cam.k = opts.k || 4;
    if (opts.snap) cam.snap = true;
  }
  // the whole hole, from above and a little behind
  function camOverview(H, opts = {}) {
    const b = H.bounds, cx = (b.minx + b.maxx) / 2, cz = (b.minz + b.maxz) / 2;
    const Lx = b.maxx - b.minx + 1.6, Lz = b.maxz - b.minz + 1.6;
    const pitch = 1.12, vt = Math.tan((camera.fov * Math.PI) / 360), asp = view.w / view.h;
    const dz = (Lz * Math.sin(pitch)) / (2 * vt), dx = Lx / (2 * vt * asp);
    const dist = Math.max(dz, dx) * 1.08 * (opts.zoom || 1) + 1.5;
    cam.wantLook.set(cx, 0, cz);
    cam.wantPos.set(cx, dist * Math.sin(pitch), cz + dist * Math.cos(pitch));
    cam.k = opts.k || 3;
    if (opts.snap) cam.snap = true;
  }
  function camOrbit(H, t) {
    const b = H.bounds, cx = (b.minx + b.maxx) / 2, cz = (b.minz + b.maxz) / 2;
    const r = Math.max(b.maxx - b.minx, b.maxz - b.minz) * 0.75 + 4;
    cam.wantLook.set(cx, 0, cz);
    cam.wantPos.set(cx + Math.sin(t * 0.12) * r, r * 0.75, cz + Math.cos(t * 0.12) * r);
    cam.k = 2;
  }

  // ------------------------------------------------------------------ screen <-> world
  const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), ndc = new T.Vector2();
  function pick(sx, sy, y) {
    ndc.set((sx / view.w) * 2 - 1, -(sy / view.h) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    plane.constant = -y;
    const out = new T.Vector3();
    return ray.ray.intersectPlane(plane, out) ? out : null;
  }
  function project(x, y, z) {
    V3.set(x, y, z).project(camera);
    return { x: ((V3.x + 1) / 2) * view.w, y: ((1 - V3.y) / 2) * view.h, behind: V3.z > 1 };
  }

  function render() { renderer.render(scene, camera); }

  // a treat flying from the buddy to the player, then sitting on the grass
  function treatSprite(emoji) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture(emoji), depthWrite: false }));
    s.scale.set(0.5, 0.5, 1);
    scene.add(s);
    return s;
  }
  function removeObj(o) { if (o) scene.remove(o); }

  MG.scene = {
    init, fit, buildHole, update, render, makeBall, placeBall, showAim, showBand, hideAim, showHint, hideHint,
    camFollow, camOverview, camOrbit, pick, project, fx, makePerson, removePerson, standToPutt, facePoint, animPerson,
    treatSprite, removeObj,
    bumperPop(c) { if (!hole) return; const b = hole.bumpers.find((u) => u.c === c); if (b) b.pop = 1; },
    get hole() { return hole; }, get camera() { return camera; }, get scene() { return scene; },
    height(x, z) { return hole ? hole.hFn(x, z) : 0; },
  };
})();
