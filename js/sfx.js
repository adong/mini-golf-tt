/* TT Mini Golf: the game's own sounds, built on Kit.sound.tone / hiss (Web Audio, no files). MG.sfx(name, arg) plays
   one of these or, failing that, a kit sound of that name (click, coin, swish...). */
(function () {
  'use strict';
  const S = Kit.sound;
  const { tone, hiss } = S;
  const OWN = {
    // the putter tapping the ball: a woody "tock", louder for harder putts
    putt(power) {
      const v = 0.4 + Math.min(1, power || 0.5) * 0.6;
      tone({ type: 'triangle', f: 1250, to: 700, dur: 0.06, vol: 0.16 * v });
      tone({ type: 'sine', f: 420, to: 260, dur: 0.08, vol: 0.12 * v });
      hiss({ filter: 'bandpass', f: 3000, q: 2, dur: 0.03, vol: 0.06 * v });
    },
    // the ball against a wall: a hollow "thock"
    wall(speed) {
      const v = Math.min(1, (speed || 1) / 4);
      tone({ type: 'triangle', f: 620, to: 380, dur: 0.07, vol: 0.05 + 0.12 * v });
      hiss({ filter: 'lowpass', f: 1400, dur: 0.04, vol: 0.05 * v });
    },
    // a mushroom bumper: boing!
    bumper() {
      tone({ type: 'sine', f: 260, to: 720, dur: 0.16, vol: 0.16 });
      tone({ type: 'square', f: 520, to: 1100, dur: 0.1, vol: 0.04, lp: 2500 });
    },
    // in the cup: a rattle and a plop
    cup() {
      [0, 0.06, 0.11].forEach((at, i) => tone({ type: 'triangle', f: 900 - i * 140, at, dur: 0.05, vol: 0.12 }));
      tone({ type: 'sine', f: 180, to: 90, at: 0.16, dur: 0.18, vol: 0.22 });
      hiss({ filter: 'lowpass', f: 600, at: 0.16, dur: 0.1, vol: 0.06 });
    },
    splash() {
      hiss({ filter: 'lowpass', f: 2600, to: 500, dur: 0.6, vol: 0.22, attack: 0.01 });
      tone({ type: 'sine', f: 300, to: 120, dur: 0.25, vol: 0.12 });
      [0.12, 0.2, 0.31].forEach((at) => tone({ type: 'sine', f: 900 + at * 900, to: 1400, at, dur: 0.06, vol: 0.05 }));
    },
    sand() { hiss({ filter: 'bandpass', f: 1800, q: 0.7, dur: 0.25, vol: 0.12 }); },
    // round the loop: a rising whoosh
    loop() { hiss({ filter: 'bandpass', f: 400, to: 2400, q: 1.2, dur: 0.7, vol: 0.12, attack: 0.1 }); tone({ type: 'sine', f: 300, to: 900, dur: 0.7, vol: 0.05 }); },
    // the windmill's blade knocking the ball back
    blade() { tone({ type: 'square', f: 220, to: 140, dur: 0.08, vol: 0.06, lp: 1200 }); },
    // the ball dropping on the ramp or grass after the tunnel or the loop
    roll() { hiss({ filter: 'lowpass', f: 300, to: 180, dur: 0.3, vol: 0.05 }); },
    // the turn passing to the other player
    turn() { tone({ type: 'triangle', f: 660, dur: 0.08, vol: 0.08 }); tone({ type: 'triangle', f: 880, at: 0.09, dur: 0.12, vol: 0.08 }); },
    // the kids' cheer: a happy chord and a swell of "yay" noise
    cheer(big) {
      [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.05, dur: 0.16, vol: 0.09 }));
      hiss({ filter: 'bandpass', f: 1300, to: 1700, q: 0.6, dur: big ? 1.2 : 0.7, vol: big ? 0.14 : 0.08, attack: 0.1 });
    },
    // HOLE IN ONE: a fanfare
    fanfare() {
      [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.4], [784, 0.56], [1047, 0.68]].forEach(([f, at]) => tone({ type: 'triangle', f, at, dur: at > 0.6 ? 0.6 : 0.14, vol: 0.14 }));
      [[262, 0.4], [330, 0.4], [392, 0.4]].forEach(([f, at]) => tone({ type: 'sawtooth', f, at, dur: 0.7, vol: 0.04, lp: 1800 }));
    },
    // a nice soft "aww" (never a raspberry)
    aww() { tone({ type: 'triangle', f: 523, to: 392, dur: 0.45, vol: 0.09 }); tone({ type: 'triangle', f: 392, to: 330, at: 0.4, dur: 0.5, vol: 0.08 }); },
    treat() { [988, 1319, 1568].forEach((f, i) => tone({ type: 'sine', f, at: i * 0.07, dur: 0.18, vol: 0.09 })); },
    poof() { tone({ f: 300, to: 900, dur: 0.18, vol: 0.06 }); hiss({ f: 2000, dur: 0.15, vol: 0.05 }); },
    // the buddy's tip: a sparkly "ding ding"
    hint() { [1319, 1760, 2093].forEach((f, i) => tone({ type: 'sine', f, at: i * 0.09, dur: 0.22, vol: 0.07 })); },
    // the aim ticking round with the keys
    tick() { tone({ type: 'square', f: 1500, dur: 0.02, vol: 0.025 }); },
  };
  window.MG = window.MG || {};
  MG.sfx = function (name, arg) {
    if (OWN[name]) return OWN[name](arg);
    if (typeof S[name] === 'function') return S[name](arg);
  };
})();
