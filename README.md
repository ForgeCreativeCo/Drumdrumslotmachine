# 太鼓雷 Taiko Thunder

A Japanese taiko-drum slot machine for the browser, built mobile-first. Its
three-stage bonus, the **Festival of a Thousand Drums**, starts with a rhythm
game. This is a play-money portfolio demo: no real money and no purchases.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (deploy anywhere)
```

Add `?festival` to the URL to make the first spin trigger the bonus.

Controls: tap the drum or press **Space** to spin. In the rhythm stage, tap the
drum **centre for DON** and the **rim for KA**, or use the keys F/J/Space (DON)
and D/K (KA).

## The game

- **5×3 reels, 243 ways.** Wins pay left to right on adjacent reels.
- **Symbols:** 鬼 Oni Drum Master, 龍 Dragon, 鯉 Golden Koi, 扇 War Fan,
  撥 Bachi, 灯 Lantern, 桜 Sakura, 銭 Mon Coin.
- **Taiko Wild** (reels 2–5) substitutes for every symbol except 雷.
- **雷 Raijin Thunder scatter:** 3/4/5 anywhere pays 2×/10×/50× the bet and
  starts the Festival with 6/8/10 free spins.

### Festival of a Thousand Drums

1. **The Summoning.** Play 18 drum notes. Your accuracy sets **Drum Power**,
   from ×1 to ×10 on a convex curve, and it applies to every free-spin win. You
   can also tap AUTO-PLAY to let the drummers play at average skill.
2. **Drum Storm.** Wilds that land **lock in place** and gain +1× each spin
   (max ×2). A way uses its highest wild multiplier. 3+ 雷 add 5 spins.
3. **Raijin's Crescendo.** Every new wild and every 雷 that lands charges
   Raijin's drum meter. When the spins end, lightning strikes each charge:
   6 = Mini (5×), 8 = Minor (15×), 11 = Major (50×), 15 = Grand (500×).

## Maths

All game logic lives in `src/math/` as pure, seedable TypeScript. The reel
strips are generated from symbol counts with a fixed seed.

```bash
npm test                       # unit tests
npm run sim -- 4000000 42      # Monte Carlo RTP report
```

Typical results over 4M spins, at average rhythm skill:

| Metric | Value |
| --- | --- |
| RTP | ~96% (base ways ~54%, scatter ~1.4%, free spins ~34%, crescendo ~6%) |
| Hit frequency | ~35% |
| Bonus frequency | ~1 in 170 spins |
| Average bonus | ~70× bet |

Skilled rhythm play raises the RTP, by design.

## Presentation

The game renders as a three-screen cabinet in WebGL using PixiJS, with GSAP
for timing.

- **Top screen** (`src/stage/top.ts`): a 2.5D festival night with parallax
  mountains, a shrine, mist, swaying lanterns and falling petals (rain during
  the bonus). Raijin's ring of drums orbits the logo. Lit jackpot plaques sit
  at the bottom, and during free spins the drum meter appears above them.
- **Main screen** (`src/stage/main-screen.ts`, `src/stage/reels.ts`): reels in
  a lacquered drum-hoop frame with cylinder shading and real motion blur.
  - Reels accelerate, cruise, then overshoot and settle, with no jumps in
    speed.
  - Each reel stop kicks up dust and petals and hits the side drums.
  - When a third 雷 could still land, the remaining reel is caged in
    lightning, the other reels dim and the camera pushes in.
- **Button deck** (`src/stage/deck.ts`): the credit and win meters, a koban
  coin stack for the bet, and the big drum, which bachi strike when you spin.
- One beat clock (`src/stage/beat.ts`) drives the lantern sway, the LED strips
  and the drum pulses.
- All art is code-built with canvas painters. The high symbols are painted
  illustrations (`src/stage/illustrations.ts`): an oni mask, a dragon coiled
  round a flaming pearl, a leaping koi and a war fan, each on a gold-rimmed
  roundel. The low symbols are carved wood plaques.
- Winning symbols lift out of the reels as animated actors
  (`src/stage/symbol-fx.ts`):
  - the Oni roars with burning eyes;
  - the Dragon sways and its pearl glows;
  - the Koi leaps and splashes;
  - the Fan flutters and throws petals;
  - the Wild is drummed by bachi;
  - the Thunder spins and crackles.
- Lightning joins each winning symbol to every winning symbol on the next
  reel, drawing the ways themselves. Wins smaller than the bet are marked
  quietly rather than celebrated.
- When a Wild lands, bachi strike it and a ripple runs across the reels.
- At rest, scatters crackle and high symbols catch an occasional glint.

### The Festival on the cabinet

The bonus plays on the machine itself, with no pop-ups
(`src/stage/summoning.ts`, `src/stage/festival-panels.ts`):

1. **Arrival:** Raijin's bolts strike each scatter. A white-out thunderclap
   relights every screen as a storm, and 雷神 rises in the drum ring.
2. **The Summoning:** the rhythm lane takes over the reel window, and the
   deck's big drum becomes the pad (centre = DON, rim = KA; keys F/J/D/K also
   work). Drum Power builds on the top screen, with fireworks on perfect hits.
3. **Drum Storm:** sparks from new wilds and 雷 fly up into the meter orbs,
   and the Drum Power stays on the top screen.
4. **Raijin's Crescendo:** the camera pulls back. Each charge is a bolt from
   the sky, through its meter orb, down into the counter on the reels screen.
   Each tier on the ladder and the matching top plaque light as they are
   reached, and the Grand floods the cabinet gold.
5. **Summary:** shown in the reel window. A second flash returns the cabinet
   to the festival night.

Cross-screen effects (bolts, flying sparks, coin showers, flashes) live on
one layer above all three screens (`Stage.bolt`, `flyTo`, `coinShower`,
`flash`, `goldFlood`).

### Win climb, attract mode and tempo

- **Win climb** (`src/stage/win-climb.ts`):
  - For 15× the bet or more, the amount counts up on a festival banner over
    the reels.
  - Each time it crosses a tier (Big 15×, Mega 40×, Epic 100×), the banner
    slams in a new title. Raijin strikes the sky, the drum ring spins up,
    fireworks fire and a rising koto run plays.
  - Koban pour into a growing pile on the button deck.
  - A tap, Space or Enter skips to the final amount.
- **Attract mode** (`src/stage/attract.ts`):
  - After 20 idle seconds, Raijin wakes and lightning sweeps the reels.
  - The drum ring lights up drum by drum, the best symbols on screen show
    off, and a "Press Spin to Play" prompt pulses.
  - The first tap or key press only wakes the machine.
- **One tempo:**
  - A soft festival groove plays in the base game (116 bpm) and the storm
    groove in the bonus (132 bpm), both on the same beat clock that drives
    the lanterns, LEDs and drum pulses.
  - Win stings and climb runs start on the next eighth note.
  - The groove drops out during the Summoning, so the player's drumming is
    the music.

### Adding painted backdrops

Put `backdrop-festival.jpg` (and optionally `backdrop-storm.jpg`) in
`src/assets/`. The top screen uses them in place of the procedural mountains
and shrine. Wide 16:9 paintings work best.

### Accessibility and performance

- The canvas is backed by a screen-reader control panel and a live region for
  game messages.
- Keyboard: Space spins, A autoplay, T turbo, M mute, I info.
- Motion is reduced when the device asks for it.
- If the first seconds render below 30 fps, the game drops bloom and renders
  at 1× resolution.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` runs the tests, builds the game, and publishes
`dist/` to GitHub Pages on every push to `main`. You can also start it by hand
from the Actions tab. One-time setup: in the repository's **Settings → Pages →
Build and deployment**, set **Source** to **GitHub Actions**. Pages can't
serve the repository's files directly, because the root `index.html` loads
the unbuilt `src/main.ts`. The site is served from
`https://<owner>.github.io/<repo>/`, and the relative `base` in
`vite.config.ts` lets the build and its service worker work under that path.

## Installing as an app (PWA)

The production build (`npm run build`) is an installable Progressive Web App.
Serve `dist/` over HTTPS, then use **Install app** in Chrome or Edge, or
**Share → Add to Home Screen** in Safari on iOS. It opens fullscreen and plays
offline after the first visit.

- `public/manifest.webmanifest` holds the app's name, colours and icons.
  `public/icons/` holds the icons. Regenerate them with
  `node scripts/make-icons.mjs public/icons`, which needs the `playwright`
  package and network access for Google Fonts.
- `pwa/sw.js` is the service worker template. A small plugin in
  `vite.config.ts` emits it as `dist/sw.js`, filling in every built file to
  precache and a version hash. Each new build installs a fresh cache and
  deletes the old one. Page loads try the network for 3 seconds, so updates
  arrive on the next launch, then fall back to the cache. Google Fonts are
  cached as they load.
- The worker registers only in production builds, and only when the page has
  a manifest link. The artifact page has no manifest link, so it never
  registers one.

## Publishing as an artifact

```bash
npm run artifact -- <out-dir>
```

This writes `taiko-thunder.html` with the CSS inlined, plus the script chunks
in `assets/`, and prints the publish map. Chunk names change whenever the
bundle changes, so publish every file in the map (including the `null`
entries, which remove the previous build's chunks), not just the entry. The artifact viewer enforces a Content Security Policy without
`unsafe-eval`, so the stage imports `pixi.js/unsafe-eval` to replace Pixi's
generated code with CSP-safe versions. Publish the page with those files alongside it. The chunks stay
separate because a single merged bundle breaks Pixi's lazy-loaded renderer
modules.

## Tech

Vite + TypeScript, PixiJS 8 and pixi-filters for rendering, and GSAP for
animation timing. The maths in `src/math/` has no dependencies.

- Only the info page and the out-of-credits gift are DOM; everything else is
  drawn by the stage.
- All sound (taiko, rim clicks, shime, kane, gong, thunder, koto stings and the
  music) is synthesized live with Web Audio, so there are no audio assets. The
  base game plays a traditional-style ensemble in the hirajoshi scale: a
  shinobue-style flute over a running koto pattern with a light drum. The Drum
  Storm switches to a cinematic sound: sub-heavy drums, a shamisen ostinato,
  bass and pad in the darker in-scale. Everything runs through a hall reverb;
  wins add harp-like shimmers and booms in the current scale and duck the music. That includes the pachislot cues: the lever pull, stop-button clacks,
  the chance-up rise under anticipation, the キュイン (kyuin) when the third 雷
  lands, and the freeze that cuts the music before the Festival.
