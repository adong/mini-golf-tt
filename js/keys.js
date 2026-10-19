/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.MG_TITLE || 'TT Mini Golf',
  keys: [
    ['aim', '← →'],
    ['aim a tiny bit', '↑ ↓'],
    ['putt: hold for power, let go', 'Space'],
    ['call your brother for a tip', 'T'],
    ['see the whole hole', 'C'],
    ['start the hole again', 'R'],
    ['start · next hole', 'Enter'],
    ['pause', 'P or Esc'],
    ['sound on / off', 'M'],
  ],
  note: 'Mouse: drag back from the ball like a slingshot and let go. 2 players take turns on the same keys.',
  touch: 'Drag back from the ball and let go to putt: further back is harder. Or tap where to go, then hold and let go. Tap your brother\'s face (bottom right) for a tip.',
});
