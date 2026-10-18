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
   can also tap "Let the drummers play" to auto-play at average skill.
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
- All art is code-built with canvas painters (`src/stage/paint.ts`).

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

## Publishing as an artifact

```bash
npm run artifact -- <out-dir>
```

This writes `taiko-thunder.html` with the CSS inlined, plus the script chunks
in `assets/`. Publish the page with those files alongside it. The chunks stay
separate because a single merged bundle breaks Pixi's lazy-loaded renderer
modules.

## Tech

Vite + TypeScript, PixiJS 8 and pixi-filters for rendering, and GSAP for
animation timing. The maths in `src/math/` has no dependencies.

- The bonus dialogs and big-win overlays are still DOM for now.
- All sound (taiko, rim clicks, shime, kane, gong, thunder, koto stings and the
  festival groove) is synthesized live with Web Audio, so there are no audio
  assets.
