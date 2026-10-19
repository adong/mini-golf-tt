# TT Mini Golf

[![TT Mini Golf title screen](docs/screenshot.jpg)](https://adong.github.io/mini-golf-tt/)

Press **?** any time (or tap the round **?** button on the left edge) to see the keys. The game waits while you look.
Tap the language button under it (the A文 icon) to switch between English and 中文; the dashboard and every game remember the choice.

**中文：** 3D 迷你高尔夫：和 Teddy、Tommy 一起在阳光花园打 9 个球洞，有坡道、蘑菇弹弹、大风车、移动小桥和大回环。

A 3D mini golf course in a sunny garden, starring Teddy and Tommy. Pull back from the ball like a slingshot and let go to putt. Nine holes get trickier as you go: a straight green, a dog-leg, a ramp, mushroom bumpers, a sandy snake, a windmill whose sails block the door, a sliding bridge over a stream, a hill with two tunnels, and a loop-the-loop. Play alone or take turns with your brother on one device, and call him over any time for a tip.
It's built with Claude Code from plain JavaScript and Three.js, in the same style as Metro Surfer and the other Teddy & Tommy games. There are no image, model or audio files: the course is boxes, spheres and canvas-painted textures, the characters come from the shared kit (`kit/`), and every sound is synthesised.

The name lives in one place, [js/title.js](js/title.js). "TT Mini Golf" is a working title until Alan names it.

## Play

- **Double-click `index.html`.** It works offline, because Three.js and the kit are copied into `kit/`. Without internet the logo falls back from the Bungee font to Arial Black.
- **Send one file:** `dist/mini-golf-tt.html` is the whole game in one file. AirDrop or email it, then open it in a browser.
- **Rebuild that file** after any edit: `python3 kit/tools/bundle.py . --name mini-golf-tt`
- **Get kit updates** from `~/claude-games/kit`: `python3 ../kit/tools/sync.py .`, then rebuild.
- **On the title screen** pick 1 PLAYER or 2 PLAYERS, each golfer with ◀ ▶ (Teddy, Tommy and the rest of the kit's cast), and 🐣 EASY or 🔥 NORMAL for each golfer. Then ▶ PLAY.
- **Saved per browser:** 1 or 2 players, the golfers picked, each golfer's EASY/NORMAL, and each golfer's best round (fewest strokes) per level. `index.html` and `dist/mini-golf-tt.html` each keep their own, because they're different ways of opening the game.

### EASY and NORMAL

| | 🐣 EASY (Tommy, 5) | 🔥 NORMAL (Teddy, 8) |
|---|---|---|
| aim line | long: it runs to the first wall or bumper and shows the bounce | short (1.5 m) |
| cup | bigger (30 cm radius), and a slow ball within 1 m is pulled gently in | 20 cm radius, no help |
| stroke limit | after 6 strokes the ball is put in for you, with a cheer | 10 strokes at most |
| par | not shown | shown on the hole, the banner and the scorecard |

In 2 players each golfer has his own level, so Teddy can play NORMAL while Tommy plays EASY on the same course.

### Turns and the scorecard

- One player plays every stroke. Two players take turns stroke by stroke ("TOMMY'S TURN!"). The other golfer's ball stays on the course as a see-through ghost; balls don't knock each other.
- A golfer who has holed out is skipped until everyone is in. Then the scorecard shows each hole's strokes, par (when anyone plays NORMAL), the totals and a ⭐ for every hole in one.
- After hole 9 the final scorecard names the winner (fewest strokes) or a tie, and has ↻ PLAY AGAIN.

### Celebrations

When the ball drops, the golfer runs to the cup and does his signature move: Teddy's boxing or his 🏀 jump shot (taking turns), Tommy's Y with peace fingers. Everyone else waves. NORMAL calls out BIRDIE! or EAGLE! under par. A hole in one gets a fanfare, confetti and a big HOLE IN ONE!

## Holes

The Sunny Garden course, par 26. Every hole is our own design, drawn as data in [js/courses.js](js/courses.js).

| # | Hole | Par | What's there |
|---|---|---|---|
| 1 | Hello Green | 2 | a straight green to learn the putt |
| 2 | Dog Leg | 3 | a right turn; the corner is cut at 45°, so a straight putt into it banks round toward the cup. A rock sits on the inside corner |
| 3 | Up the Ramp | 3 | a 0.6 m ramp up to the top green (painted arrows show the slope). Too soft and the ball rolls back down |
| 4 | Bumper Garden | 3 | five red mushroom bumpers that pop the ball away |
| 5 | Sandy Snake | 3 | an S-bend with two sand traps, one right in front of the cup. Sand slows the ball hard |
| 6 | Windmill | 3 | the sails turn across the windmill's door; time your putt between them. The door's floor tilts forward, so a ball never stops under a sail |
| 7 | Bridge | 3 | a stream across the green and a bridge sliding left and right over it. Miss the bridge: SPLASH! +1 |
| 8 | Tunnel Hill | 3 | a grassy hill with two tunnels. The left one comes out near the cup, the right one by the pond |
| 9 | Loop-the-Loop | 3 | a funnel into a clear loop tube: hit it hard and the ball goes round and comes out on the last green. Too soft and it rolls back to you |

### The physics

Our own, in [js/physics.js](js/physics.js), with no library and no Three.js:

- **A fixed 120 Hz step.** Each frame adds its time to a store and the physics takes as many 1/120 s steps as fit, so a putt plays exactly the same at 30, 60 or 120 frames a second.
- **Rolling:** rolling resistance plus a drag that grows with speed, so a full-power putt rolls about 18 m on the flat. Sand slows it about six times as hard.
- **Slopes and ramps:** each part of a hole can be a tilted plane; a rolling ball feels 5/7 of gravity along the slope.
- **Walls** bounce the ball back at 70 % of its speed (and a ball resting against a wall doesn't keep bouncing). Bumpers always send it off at 2.2 m/s or more. Rocks are softer.
- **The cup** is a little dip that pulls a passing ball toward its middle, so near misses curl. It catches a ball over its middle going slower than 1.9 m/s (2.6 on EASY).
- **Water:** the ball comes back to where you hit it from, with a splash and one stroke added.
- **Moving parts** depend only on the step count: the windmill's sails, the bridge (which tilts toward the far bank, so a ball never stops on it) and its rails, which carry the ball with it.
- **The loop** is a vertical circle inside a tube; along it the ball slows with gravity and friction. Fast enough and it comes out 0.8 m to the side; too slow and it rolls back out the way it came.

## Controls

| Mouse | Touch | Keys | |
|---|---|---|---|
| press anywhere, drag back, let go | drag back from the ball, let go | `←` `→` aim, hold `Space`, let go | putt: further back (or longer held) is harder |
| click where to go | tap where to go | `↑` `↓` aim a tiny bit | aim |
| hold still on a spot, let go | tap-and-hold a spot, let go | hold `Space` | aim at the spot and charge the power (it swings up and down) |
| 🔭 button | 🔭 button | `C` | see the whole hole (and back) |
| ↺ button | ↺ button | `R` | start the hole again |
| buddy button (bottom right) | same | `T` | call your brother for a tip |
| ❚❚ button | ❚❚ button | `P` / `Esc` | pause |
| 🔊 button | 🔊 button | `M` | sound on/off |
| ▶ buttons | same | `Enter` | start, next hole, play again |

- **The slingshot:** the direction is worked out on the ground, from where you pressed to where your finger is now, so it feels the same at any camera angle. Full power is a pull of 40 % of the screen's shorter side (130 to 330 px). A red band stretches back from the ball, the aim line shows the way, the power bar fills green to yellow to red, and your golfer draws his putter back as you pull. Pull back to where you started to cancel.
- **The camera** follows the ball from behind, looking along the way to the cup (round corners and through doors, from the autopilot's distance map). It swings to the side while the ball is in the loop. 🔭 / `C` shows the whole hole from above; you can aim and putt from there too.
- Each hole starts with a fly-over of the whole hole and its name; tap or press `Space` to skip it.

## Companion

Tap the big orange button with your brother's face (bottom right) or press **T**, as often as you like. The other brother comes: Tommy for everyone, Teddy when Tommy is the golfer (`Kit.roster.buddyFor`). In 2 players it works the same for either brother, and the brother who is waiting his turn goes over to help.

- **He pops in** with a puff beside the green, at his buddy size (`buddyScale`), wearing a name tag, and says hi with his signature move: Tommy's Y with peace fingers, or Teddy's boxing.
- **He tosses a treat** (🍦 💧 🧃 🍪 🍉 🍌) that flies to your golfer's feet: "🍦 ICE CREAM FROM TOMMY!"
- **He gives a tip:** a glowing gold line shows where to aim, a gold mark on the power bar shows how hard, and a toast says it in words: "TOMMY SAYS: AIM HERE, SOFT!" (SOFT, MEDIUM, HARD or SUPER HARD). The tip comes from the autopilot's search (below), run a little each frame so nothing stutters.
  - It picks shots that still work when a kid is a bit off (2.5 to 5° either way, 12 % harder or softer) and, by the windmill and the bridge, a moment early or late. Holed shots with fewer bounces and a softer hit win.
  - Aim within 6° of the tip and the aim clicks onto it; let go within 10 % of its power and the putt uses the tip's power. The arrow keys start from the tip.
- After your putt he says bye (Tommy's Y again, or Teddy's jump shot with a 🏀) and pops out. Call him again for the next shot.

## How it was checked

**Headless, in Node:** `node tools/check.js` runs the page's own `js/physics.js`, `js/courses.js`, `js/autopilot.js` and `js/checks.js` without a browser. In the page the same checks run as `game.check()`.

- **Every hole is solvable:** the autopilot (thousands of trial putts per stroke, scored by the distance still to go along the course, waiting for the sails or the bridge when it wants) sinks every hole within par + 1 on NORMAL's small cup with no magnet. It needs 1 or 2 strokes on each.
- **Random soak:** 1,000 random putts per hole (9,000 in all; random direction, power and moment, one after another from wherever the ball stops). The ball never left the course, never went NaN, and always stopped (the longest roll took 11.8 s; the 30 s safety stop never fired).
  - The soak earned its keep: it found a ball that crept to the very top of the loop and stayed there, held by rolling friction, upside down. Friction in the tube now fades out when the ball is slow, so gravity always wins, and the safety stop also covers the loop. Every entry speed from 3 to 6 m/s (in 1 mm/s steps) now leaves the loop within 3.7 s.
- **Frame rate:** four putts per hole, stepped in frames of 1/30, 1/60 and 1/120 s, end at exactly the same spot (`===` on the coordinates) and the same way (stopped, in the cup or in the water).
- **The check can fail:** `node tools/check.js --fail` walls in hole 1's cup with a ring of rocks, and the solvable check reports it NOT sunk, as it should.

**How hard is it for a kid?** `node tools/kids.js` plays every hole with a "kid bot" that takes the buddy's tip and then wobbles it, hitting at a random moment:

| Golfer (a wobble on every putt) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Total (par 26) |
|---|---|---|---|---|---|---|---|---|---|---|
| EASY, ±12° and ±30 % | 1.7 | 2.0 | 2.2 | 2.7 | 3.0 | 3.7 | 3.3 | 3.8 | 3.3 | 25.7 |
| NORMAL, ±6° and ±15 % | 2.3 | 2.2 | 2.0 | 2.2 | 2.7 | 3.0 | 2.3 | 2.7 | 2.3 | 21.7 |

Averages of 6 rounds. On EASY the ball was put in after 6 strokes once on the Bridge and twice on the Loop. The bot takes the tip on every putt, so it is a kid who calls his brother every time; without tips it would be harder.

**In the Browser pane** (time driven by `game.step()`, because the hidden pane throttles `requestAnimationFrame`):

```js
game.hold(true); game.autoPause = false          // only game.step() moves time
game.start({ players: ['teddy', 'tommy'], levels: ['normal', 'easy'] })
game.step(3)                                     // advance 3 s at 60 fps, then draw
game.drag(x0, y0, x1, y1)                        // a real drag through the pointer handlers (CSS px)
game.shoot(angle, power); game.autoShot()        // a putt; the autopilot's putt
game.buddy(); game.hint()                        // call the brother; his tip
game.goto(5); game.overview(); game.check()      // jump to hole 6; whole-hole camera; the headless checks
game.info()                                      // state, turn, strokes, scores, every ball, the buddy
```

- **Flows:** title, hole fly-over, aiming, rolling, the cup and the celebration, water and +1, EASY's put-in after 6 strokes, the scorecard after each hole, the final scorecard with a winner, a whole 2-player round played by the autopilot, pause and resume, restart a hole.
- **Inputs:** the drag (slingshot) path, tap to aim, the arrows and Space.
- **Buddy:** both brothers as buddy, treats, tips, the snap onto the tip; in 2 players the waiting brother goes to help.
- **Screens:** desktop, iPad (1024 x 768), phone portrait (390 x 844) and phone landscape (740 x 360).
- **中文:** with `Kit.lang.set('zh')`, the title (1 and 2 players), the fly-over, aiming, the buddy, every toast, pause, both scorecards, the ? panel and another hole: `Kit.lang.untranslated()` is `[]`, and a made-up English toast shows up in it (so it can fail). In English mode nothing on the page is Chinese except the kit's language button tooltip, which names the language a tap switches to.
- No console errors.

## Files

```
index.html          page, HUD and screens (CSS inline)
js/title.js         the game's name, in one place
js/physics.js       the ball physics: fixed 120 Hz steps, slopes, walls, bumpers, sand, water, cup, windmill, bridge, loop
js/courses.js       the holes, as data, and each course's colours
js/autopilot.js     the distance map along the course, the shot search (the buddy's tip), autoplay
js/checks.js        solvable / soak / frame-rate / blocked-cup checks (game.check() and tools/check.js)
js/sfx.js           putt, wall, bumper, cup, splash, sand, loop, cheer, fanfare... on Kit.sound.tone / hiss
js/scene.js         Three.js: the hole meshes, garden, windmill, bridge, loop tube, tunnel hill, balls, aim guide,
                    hint line, particles, golfers with putters, camera
js/buddy.js         the brother's visit: pop in, signature move, treat, tip, goodbye
js/game.js          title, turns, input, strokes, EASY/NORMAL, scorecard, celebrations, HUD, main loop, window.game
js/keys.js          the keys the ? panel shows (Kit.help)
js/zh.js            中文 (Kit.lang); names and the game's name stay English
tools/check.js      the headless checks in Node
tools/kids.js       the kid-bot difficulty table
kit/                copy of ~/claude-games/kit; edit the kit there, not here
dist/mini-golf-tt.html  the single-file build
```

## Kit candidates

These live in this game for now:

- `puttPose` and the putter in `js/scene.js`: a putting stance with a swinging putter, and `standToPutt` to place a golfer beside a ball facing the right way.
- The surface builder in `js/scene.js`: any polygon cut into 20 cm cells that follow a height function, so slopes bend smoothly, plus walls that follow the ground up ramps.
- The distance map in `js/autopilot.js` (Dijkstra on a 10 cm grid with portals), for any game whose bots need "how far along the course".

## Not verified

- **Sound:** every effect and the music run through Web Audio without errors, but no one has listened to them yet.
- **Real touch devices:** touch uses the same pointer events as the mouse, tested with scripted drags and in phone and iPad emulation, not with fingers on a real iPad or phone or in iOS Safari. How far a full-power pull should be (40 % of the screen) may need tuning once Teddy and Tommy try it.
- **Frame rate on an iPad:** the game draws real shadows and a few thousand flower and fence instances; it hasn't been timed on a device.
- **Real kids' difficulty:** the kid bot is a guess at how wobbly a 5- and an 8-year-old are.
- **file://:** the page uses only classic `<script src>` tags and no fetches, so double-click should work. The Browser pane can't open `file://` pages, so it was tested from a local server.
