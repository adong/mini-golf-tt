// TT Mini Golf: how hard is it for a kid? A "kid bot" picks a decent shot (the autopilot's, without waiting for the
// windmill or the bridge), then wobbles it: a random aim and power error, hit at a random moment.
//   node tools/kids.js                  EASY with a big wobble (±12°, ±30 %) and NORMAL with a smaller one (±6°, ±15 %)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = vm.createContext({ console, Math, Date, JSON });
ctx.globalThis = ctx;
for (const f of ['physics.js', 'courses.js', 'autopilot.js', 'checks.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
const { Phys: P, Auto: A, checks } = ctx.MG;
const games = +(process.argv[2] || 6);

function play(H, level, wob, rand) {
  let x = H.tee.x, z = H.tee.z, tick = Math.floor(rand() * 2000), strokes = 0;
  const limit = level === 'easy' ? 6 : 10;
  while (strokes < limit) {
    const s = A.plan(H, level, x, z, tick, { robust: true }); // the same search as the buddy's tip
    const a = s.angle + (rand() * 2 - 1) * wob.aim * (Math.PI / 180), p = Math.min(1, Math.max(0.02, s.power * (1 + (rand() * 2 - 1) * wob.power)));
    tick += Math.floor(rand() * 240);
    const r = P.simulate(H, level, x, z, tick, a, p);
    strokes++;
    tick = r.tick;
    if (r.mode === 'cup') return { strokes, placed: false };
    if (r.mode === 'water') strokes++; else { x = r.x; z = r.z; }
  }
  return { strokes: limit, placed: true };
}

for (const course of ctx.MG.courses) {
  console.log(`\n== ${course.name}: average strokes over ${games} games per hole ==`);
  for (const [level, wob] of [['easy', { aim: 12, power: 0.3 }], ['normal', { aim: 6, power: 0.15 }]]) {
    const rand = checks.rng(level === 'easy' ? 11 : 22);
    const row = course.holes.map((def) => {
      const H = P.compile(def);
      let sum = 0, placed = 0;
      for (let g = 0; g < games; g++) { const r = play(H, level, wob, rand); sum += r.strokes; placed += r.placed ? 1 : 0; }
      return { par: def.par, avg: sum / games, placed };
    });
    const tot = row.reduce((s, r) => s + r.avg, 0), par = row.reduce((s, r) => s + r.par, 0);
    console.log(`${level.padEnd(6)} ${row.map((r) => r.avg.toFixed(1) + (r.placed ? `(${r.placed}↓)` : '')).join('  ')}   total ${tot.toFixed(1)} (par ${par})`);
  }
}
