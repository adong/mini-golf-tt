/* TT Mini Golf: the courses. Our own hole designs, as plain data (no Three.js, so tools/check.js reads this too).
   Each hole is drawn from above in metres: x to the right, played toward -z. js/physics.js explains the fields.
   The look of each course (colours, props) lives in theme; js/scene.js paints it. */
(function (root) {
  'use strict';
  const MG = (root.MG = root.MG || {});

  const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const circ = (x, z, r, n = 18) => Array.from({ length: n }, (_, i) => [x + r * Math.cos((i / n) * Math.PI * 2), z + r * Math.sin((i / n) * Math.PI * 2)]);

  // A windmill across a lane: two solid walls with a doorway between, blades turning in front of the door, and a door
  // floor that tilts gently forward so the ball never stops right under a blade.
  function windmill(h, o) {
    const { x, face, depth, half, lane } = o;
    h.blocks = (h.blocks || []).concat([rect(-lane, face, x - half, face - depth), rect(x + half, face, lane, face - depth)]);
    h.windmill = { x, face: face + 0.08, back: face - depth, half, lane, speed: o.speed || 1.6, blades: 4, arc: 0.24, phase: o.phase || 0.3 };
    return h;
  }

  const GARDEN = [
    {
      name: 'Hello Green', par: 2,
      tee: [0, 0], cup: [0, -7.6],
      areas: [rect(-1.2, 1.6, 1.2, -9.6)],
    },
    {
      name: 'Dog Leg', par: 3,
      tee: [0, 0], cup: [6.3, -7.8],
      // the corner is cut at 45°: bank off it and the ball turns right toward the cup
      areas: [[[-1.2, 1.6], [1.2, 1.6], [1.2, -6.6], [7.6, -6.6], [7.6, -9.0], [0.2, -9.0], [-1.2, -7.6]]],
      rocks: [[3.6, -6.6, 0.3]],
    },
    {
      name: 'Up the Ramp', par: 3,
      tee: [0, 0], cup: [0, -11.4],
      areas: [rect(-1.2, 1.6, 1.2, -14.4)],
      // flat, then a ramp up 0.6 m, then the top green: too soft and the ball rolls back down
      slopes: [
        { poly: rect(-1.2, -3.8, 1.2, -6.8), plane: [-0.76, 0, -0.2] },
        { poly: rect(-1.2, -6.8, 1.2, -14.4), plane: [0.6, 0, 0] },
      ],
      rocks: [[0.6, -9.3, 0.3]],
    },
    {
      name: 'Bumper Garden', par: 3,
      tee: [0, 0], cup: [0.8, -10.6],
      areas: [rect(-2.2, 1.6, 2.2, -12.6)],
      bumpers: [[0, -4.0, 0.36], [-1.15, -5.9, 0.36], [1.15, -5.9, 0.36], [0, -7.8, 0.36], [-1.2, -9.8, 0.36]],
    },
    {
      name: 'Sandy Snake', par: 3,
      tee: [0, 0], cup: [4.0, -13.8],
      areas: [[[-1.2, 1.6], [1.2, 1.6], [1.2, -4.6], [5.2, -7.6], [5.2, -16.0], [2.8, -16.0], [2.8, -10.0], [-1.2, -7.0]]],
      sand: [circ(2.0, -7.3, 0.75), circ(4.0, -11.6, 0.6)],
    },
    windmill({
      name: 'Windmill', par: 3,
      tee: [0, 0], cup: [0, -11.2],
      areas: [rect(-1.2, 1.6, 1.2, -13.6)],
      slopes: [
        { poly: rect(-1.2, -5.0, 1.2, -6.6), plane: [0.5, 0, 0.1] }, // the door floor: 0 at z = -5, down 0.16 m by z = -6.6
        { poly: rect(-1.2, -6.6, 1.2, -13.6), plane: [-0.16, 0, 0] },
      ],
    }, { x: 0, face: -5.4, depth: 1.2, half: 0.38, lane: 1.2 }),
    {
      name: 'Bridge', par: 3,
      tee: [0, 0], cup: [0.5, -10.0],
      areas: [rect(-1.6, 1.6, 1.6, -12.6)],
      slopes: [{ poly: rect(-1.6, 1.6, 1.6, -4.4), plane: [0.2, 0, 0] }],
      water: [rect(-1.6, -4.4, 1.6, -6.4)],
      // the bridge slides left and right over the stream, and tilts down toward the far bank
      bridge: { x: 0, amp: 0.6, period: 5, half: 0.6, z0: -4.4, z1: -6.4, h0: 0.2, h1: 0 },
    },
    {
      name: 'Tunnel Hill', par: 3,
      tee: [0, 0], cup: [-1.1, -12.0],
      areas: [rect(-2.2, 1.6, 2.2, -14.6)],
      // a grassy hill with two tunnels through it; the right one comes out by the pond
      blocks: [rect(-2.2, -4.6, -1.75, -8.6), rect(-0.95, -4.6, 0.95, -8.6), rect(1.75, -4.6, 2.2, -8.6)],
      water: [rect(0.4, -10.0, 2.2, -13.2)],
      tunnel: { z0: -4.6, z1: -8.6, x0: -2.2, x1: 2.2, holes: [[-1.75, -0.95], [0.95, 1.75]] },
    },
    {
      name: 'Loop-the-Loop', par: 3,
      tee: [0, 0.6], cup: [0.8, -10.2],
      areas: [
        // the tee and the funnel into the loop's chute
        [[-1.2, 1.6], [1.2, 1.6], [1.2, -1.4], [0.32, -3.0], [0.32, -4.8], [-0.32, -4.8], [-0.32, -3.0], [-1.2, -1.4]],
        // the loop's way out, and the last green
        [[0.45, -4.2], [1.15, -4.2], [1.15, -5.6], [2.0, -6.4], [2.0, -12.6], [-1.2, -12.6], [-1.2, -6.4], [0.45, -5.6]],
      ],
      // hit it hard: the ball goes round the loop and comes out 0.8 m to the right, heading for the cup
      loop: { x: 0, z: -4.4, R: 0.5, w: 0.8, side: 1, half: 0.32, h: 0 },
    },
  ];

  // Candy Land: the same tricks in sweeter places. Sugar is the sand, the river is chocolate, the bumpers are gumdrops.
  const CANDY = [
    {
      name: 'Lollipop Lane', par: 2,
      tee: [0, 0], cup: [0, -8.6],
      areas: [rect(-1.2, 1.6, 1.2, -10.6)],
      bumps: [{ x: 0, z: -4.4, r: 1.1, h: 0.16 }], // a little hill in the middle
    },
    {
      name: 'Gumdrop Zigzag', par: 3,
      tee: [0, 0], cup: [-4.4, -11.4],
      areas: [[[-1.2, 1.6], [1.2, 1.6], [1.2, -6.4], [-3.2, -6.4], [-3.2, -13.0], [-5.6, -13.0], [-5.6, -4.0], [-1.2, -4.0]]],
      bumpers: [[-2.4, -5.2, 0.32], [-4.4, -8.4, 0.32]],
    },
    {
      name: 'Chocolate River', par: 3,
      tee: [0, 0], cup: [-0.8, -10.2],
      areas: [rect(-1.8, 1.6, 1.8, -12.6)],
      slopes: [{ poly: rect(-1.8, 1.6, 1.8, -4.0), plane: [0.25, 0, 0] }],
      water: [rect(-1.8, -4.0, 1.8, -6.4)],
      bridge: { x: 0, amp: 0.9, period: 4.4, half: 0.55, z0: -4.0, z1: -6.4, h0: 0.25, h1: 0 },
    },
    {
      name: 'Sugar Dunes', par: 3,
      tee: [0, 0], cup: [0.2, -11.0],
      areas: [rect(-2.0, 1.6, 2.0, -13.0)],
      bumps: [{ x: -0.8, z: -4.6, r: 1.2, h: 0.25 }, { x: 1.0, z: -7.6, r: 1.2, h: 0.25 }],
      sand: [circ(0.9, -4.2, 0.6), circ(-0.9, -8.0, 0.7), circ(1.3, -10.6, 0.5)],
    },
    windmill({
      name: 'Candy Mill', par: 3,
      tee: [0, 0], cup: [0, -11.8],
      areas: [rect(-1.2, 1.6, 1.2, -14.0)],
      slopes: [
        { poly: rect(-1.2, -5.6, 1.2, -7.2), plane: [0.56, 0, 0.1] },
        { poly: rect(-1.2, -7.2, 1.2, -14.0), plane: [-0.16, 0, 0] },
      ],
      rocks: [[0, -9.6, 0.35]],
    }, { x: 0, face: -6.0, depth: 1.2, half: 0.38, lane: 1.2, speed: 2.1 }),
    {
      name: 'Rainbow Ramp', par: 3,
      tee: [0, 0], cup: [0.5, -12.2],
      areas: [rect(-1.2, 1.6, 1.2, -14.2)],
      // up, across the top, and down the other side
      slopes: [
        { poly: rect(-1.2, -3.0, 1.2, -5.4), plane: [-0.6, 0, -0.2] },
        { poly: rect(-1.2, -5.4, 1.2, -7.4), plane: [0.48, 0, 0] },
        { poly: rect(-1.2, -7.4, 1.2, -9.8), plane: [1.96, 0, 0.2] },
      ],
      bumpers: [[-0.55, -6.4, 0.3]],
    },
    {
      name: 'Marshmallow Hill', par: 3,
      tee: [0, 0], cup: [1.2, -12.0],
      areas: [rect(-2.4, 1.6, 2.4, -14.6)],
      blocks: [rect(-2.4, -5.0, -2.0, -9.0), rect(-1.3, -5.0, -0.35, -9.0), rect(0.35, -5.0, 1.3, -9.0), rect(2.0, -5.0, 2.4, -9.0)],
      water: [rect(-2.4, -10.4, -0.8, -12.8)],
      tunnel: { z0: -5.0, z1: -9.0, x0: -2.4, x1: 2.4, holes: [[-2.0, -1.3], [-0.35, 0.35], [1.3, 2.0]] },
    },
    {
      name: 'Cupcake Bowl', par: 2,
      tee: [0, 0], cup: [0, -8.0],
      areas: [[[-1.2, 1.6], [1.2, 1.6], [1.2, -3.6], [2.6, -5.0], [2.6, -11.0], [1.2, -12.4], [-1.2, -12.4], [-2.6, -11.0], [-2.6, -5.0], [-1.2, -3.6]]],
      // a big bowl that rolls everything toward the cup in its middle, ringed with gumdrops
      bumps: [{ x: 0, z: -8.0, r: 2.3, h: -0.35 }],
      bumpers: [[-1.75, -6.25, 0.3], [1.75, -6.25, 0.3], [-1.75, -9.75, 0.3], [1.75, -9.75, 0.3]],
      rocks: [[0, -4.9, 0.35]],
    },
    {
      name: 'Sprinkle Loop', par: 3,
      tee: [0, 0.6], cup: [-0.4, -12.0],
      areas: [
        [[-1.2, 1.6], [1.2, 1.6], [1.2, -1.4], [0.32, -3.0], [0.32, -4.8], [-0.32, -4.8], [-0.32, -3.0], [-1.2, -1.4]],
        [[-0.45, -4.2], [-1.15, -4.2], [-1.15, -5.6], [-2.0, -6.4], [-2.0, -13.6], [1.2, -13.6], [1.2, -6.4], [-0.45, -5.6]],
      ],
      loop: { x: 0, z: -4.4, R: 0.5, w: 0.8, side: -1, half: 0.32, h: 0 },
      bumpers: [[-0.8, -8.6, 0.3], [0.4, -10.2, 0.3]],
    },
  ];

  MG.courses = [
    {
      id: 'garden', name: 'Sunny Garden', emoji: '🌻', holes: GARDEN,
      theme: {
        sky: '#8fd8ff', fog: '#cdefff', ground: '#7fd46a', ground2: '#6cc35a', lane: '#3fbf4f', lane2: '#38b048',
        wall: '#ffffff', wallSide: '#d9884a', rim: '#ff5a5f', sand: '#f6dc92', water: '#3aa8f0', hill: '#62c050',
        props: 'garden',
      },
    },
    {
      id: 'candy', name: 'Candy Land', emoji: '🍭', holes: CANDY,
      theme: {
        sky: '#ffd8f0', fog: '#ffe9f6', ground: '#ffc2e2', ground2: '#ffb0d8', lane: '#7fe3d0', lane2: '#6ad6c2',
        wall: '#ffffff', wallSide: '#ff6fae', rim: '#ff3d7f', sand: '#fff6fb', water: '#7a4428', hill: '#fff0f7',
        bumper: '#b06bff', rock: '#ff9fd0', mill: { wall: '#fff3d6', roof: '#ff4f9a', trim: '#18b8d4' },
        splash: ['#7a4428', '#a8673e', '#5a2f18'],
        props: 'candy',
      },
    },
  ];
  MG.shapes = { rect, circ };
})(typeof window !== 'undefined' ? window : globalThis);
