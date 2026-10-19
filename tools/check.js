// TT Mini Golf: the headless checks in Node, on the same js files the page uses (no browser, no Three.js).
//   node tools/check.js                 every course: solvable, random-shot soak, frame-rate check, blocked cup
//   node tools/check.js --shots 3000    a longer soak (shots per hole)
//   node tools/check.js --fail          prove the check can fail: hole 1 with its cup walled in must not pass
//   node tools/check.js --hole 6        one hole only (1-based), with the autopilot's shots printed
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..', 'js');
const ctx = vm.createContext({ console, Math, Date, JSON });
ctx.globalThis = ctx;
for (const f of ['physics.js', 'courses.js', 'autopilot.js', 'checks.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
const MG = ctx.MG;

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const shots = +opt('--shots', 400);
const fail = args.includes('--fail');
const only = opt('--hole', null);
const level = opt('--level', 'normal');
const deg = (r) => ((r * 180) / Math.PI).toFixed(1);

let allOk = true;
for (const course of MG.courses) {
  let holes = course.holes;
  if (fail) holes = [MG.checks.blockedHole(holes)];
  if (only) holes = [holes[+only - 1]];
  console.log(`\n== ${course.name} (${holes.length} holes, ${level}) ==`);
  const t0 = Date.now();
  const sol = MG.checks.solvable(holes, level);
  for (const h of sol) {
    console.log(`${h.ok ? 'ok  ' : 'FAIL'} hole ${h.hole} ${h.name.padEnd(14)} par ${h.par}: ${h.holed ? 'sunk in ' + h.strokes : 'NOT sunk after ' + h.strokes}`);
    if (only || !h.ok) for (const s of h.shots) console.log(`       from (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) aim ${deg(s.angle)}° power ${s.power.toFixed(2)} wait ${s.delay.toFixed(2)}s -> ${s.end} (${s.ex.toFixed(2)}, ${s.ez.toFixed(2)})`);
  }
  console.log(`   (autopilot ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const t1 = Date.now();
  const soak = MG.checks.soak(holes, shots, 7, level);
  for (const h of soak) {
    console.log(`${h.ok ? 'ok  ' : 'FAIL'} soak ${h.hole} ${h.name.padEnd(14)} ${h.shots} shots: ${h.escapes} off the course, ${h.stuck} stuck, ${h.nan} NaN; ${h.cups} in the cup, ${h.water} in the water, longest ${h.longest.toFixed(1)} s${h.where ? ' first escape at ' + h.where.map((v) => v.toFixed(2)) : ''}`);
  }
  console.log(`   (soak ${((Date.now() - t1) / 1000).toFixed(1)} s)`);
  const fps = MG.checks.fps(holes, level);
  for (const h of fps) console.log(`${h.ok ? 'ok  ' : 'FAIL'} fps  ${h.hole} ${h.name.padEnd(14)} ${h.ends.map((e) => (e.same ? '=' : '≠') + e.end.mode).join(' ')}`);
  const ok = sol.every((h) => h.ok) && soak.every((h) => h.ok) && fps.every((h) => h.ok);
  allOk = allOk && ok;
}
if (fail) {
  console.log(allOk ? '\nThe blocked cup PASSED: the check is broken.' : '\nAs expected, the blocked cup FAILS the check: the check can fail.');
  process.exit(allOk ? 1 : 0);
}
console.log(allOk ? '\nALL CHECKS PASS' : '\nSOME CHECKS FAILED');
process.exit(allOk ? 0 : 1);
