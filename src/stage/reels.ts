import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { GlowFilter, MotionBlurFilter } from 'pixi-filters';
import gsap from 'gsap';
import type { StickyWild } from '../math/game';
import { REELS, ROWS, randomSymbol, type Grid } from '../math/reels';
import { cryptoRng } from '../math/rng';
import type { SymbolId } from '../math/symbols';
import { FONT } from './paint';
import { Particles } from './particles';
import { WinActor, crackle, jaggedLine } from './symbol-fx';
import { tex } from './textures';
import { GOLD, bachi } from './ui';

export const CELL = 180;
export const GAP = 8;
export const WINDOW_W = REELS * CELL + (REELS - 1) * GAP;
export const WINDOW_H = ROWS * CELL;

const SPRITE_SCALE = (CELL / 256) * 0.95;

export interface ReelSpinOptions {
  turbo: boolean;
  free: boolean;
  onStop?: (reel: number) => void;
  onAnticipate?: (reel: number) => void;
}

interface ReelPlan {
  /** Seconds from spin start until this reel lands. */
  stopAt: number;
  anticipate: boolean;
  anticipateAt: number;
}

/** One reel: a virtual strip rendered by ROWS + 1 recycled sprites. */
class Reel extends Container {
  private strip: SymbolId[] = [];
  pos = 1;
  private sprites: Sprite[] = [];
  private blur = new MotionBlurFilter({ velocity: { x: 0, y: 0 }, kernelSize: 9 });
  private last = 1;
  speed = 0;
  spinning = false;

  constructor(
    readonly index: number,
    initial: SymbolId[],
  ) {
    super();
    for (let k = 0; k <= ROWS; k++) {
      const s = new Sprite({ anchor: 0.5 });
      s.scale.set(SPRITE_SCALE);
      s.x = CELL / 2;
      this.sprites.push(s);
      this.addChild(s);
    }
    this.setColumn(initial);
  }

  private pad(): SymbolId {
    return randomSymbol(this.index, cryptoRng);
  }

  setColumn(col: SymbolId[]): void {
    this.strip = [this.pad(), ...col, this.pad()];
    this.pos = 1;
    this.render();
  }

  /** Sprite showing `row` once the reel is at rest. */
  sprite(row: number): Sprite {
    return this.sprites[row];
  }

  render(): void {
    const base = Math.floor(this.pos);
    const frac = this.pos - base;
    const t = tex().symbols;
    this.sprites.forEach((s, k) => {
      const id = this.strip[Math.max(0, Math.min(this.strip.length - 1, base + k))];
      s.texture = t[id];
      s.y = (k - frac) * CELL + CELL / 2;
    });
  }

  tick(dt: number): void {
    if (dt > 0) this.speed = (this.last - this.pos) / dt;
    this.last = this.pos;
    const v = Math.abs(this.speed);
    if (v > 3) {
      this.blur.velocity = { x: 0, y: Math.min(60, v * 1.6) };
      if (!this.filters?.length) this.filters = [this.blur];
    } else if (this.filters?.length) {
      this.filters = [];
    }
  }

  spin(target: SymbolId[], plan: ReelPlan, opts: ReelSpinOptions): Promise<void> {
    const windup = 0.14;
    const settle = 0.22;
    const overshoot = 0.17;
    const accel = 1.4;
    const k = plan.anticipate ? 3 : 2;
    const decel = plan.anticipate ? 7 : 2.4;
    const cruiseSpeed = opts.turbo ? 30 : 24;
    const T = Math.max(0.4, plan.stopAt - windup - settle);
    const fillers = Math.max(6, Math.round(cruiseSpeed * T - accel - (k - 1) * decel - 3.3));

    const current = this.strip.slice(Math.floor(this.pos), Math.floor(this.pos) + ROWS);
    this.strip = [
      this.pad(),
      ...target,
      ...Array.from({ length: fillers }, () => randomSymbol(this.index, cryptoRng, opts.free)),
      ...current,
      this.pad(),
    ];
    const start = this.strip.length - 1 - ROWS;
    this.pos = this.last = start;
    this.spinning = true;
    for (const sp of this.sprites) {
      gsap.killTweensOf(sp);
      sp.x = CELL / 2;
    }
    this.render();

    // Velocity-continuous phases: accelerate, cruise, decelerate, settle.
    const cruise = start + 0.3 - accel - (1 + decel);
    const v = (2 * accel + cruise + k * decel) / T;
    const update = () => this.render();

    return new Promise((resolve) => {
      gsap
        .timeline({ onUpdate: update })
        .to(this, { pos: start + 0.3, duration: windup, ease: 'power2.out'})
        .to(this, { pos: start + 0.3 - accel, duration: (2 * accel) / v, ease: 'power2.in'})
        .to(this, { pos: 1 + decel, duration: cruise / v, ease: 'none'})
        .to(this, { pos: 1 - overshoot, duration: (k * decel) / v, ease: k === 3 ? 'power3.out' : 'power2.out'})
        .to(this, {
          pos: 1,
          duration: settle,
          ease: 'sine.inOut',
          onComplete: () => {
            this.speed = 0;
            this.spinning = false;
            this.filters = [];
            this.strip = [this.strip[0], ...target, this.pad()];
            this.pos = 1;
            this.render();
            for (let r = 0; r < ROWS; r++) {
              const s = this.sprites[r];
              gsap.fromTo(
                s.scale,
                { x: SPRITE_SCALE * 1.05, y: SPRITE_SCALE * 0.9 },
                { x: SPRITE_SCALE, y: SPRITE_SCALE, duration: 0.45, ease: 'elastic.out(1, 0.45)' },
              );
            }
            resolve();
          },
        });
    });
  }
}

export class ReelSet extends Container {
  private reels: Reel[] = [];
  private grid: Grid;
  private sticky = new Container();
  private stickyMap = new Map<number, Container>();
  private cage = new Graphics();
  private cageReel = -1;
  private cageTimer = 0;
  private dimmers: Graphics[] = [];
  private flashes = new Container();
  private puffs = new Particles();
  private winGlow = new GlowFilter({ distance: 16, outerStrength: 3, innerStrength: 0.3, color: 0xffd86b, quality: 0.25 });
  private thunderGlow = new GlowFilter({ distance: 18, outerStrength: 4, color: 0x9fd8ff, quality: 0.25 });
  private stickyGlow = new GlowFilter({ distance: 14, outerStrength: 2.5, color: 0xffc040, quality: 0.25 });
  private pulses: gsap.core.Tween[] = [];
  private actors = new Container();
  private actorSparks = new Particles();
  private hidden: Sprite[] = [];
  private bolts = new Graphics();
  private boltLinks: [number, number, number, number][] = [];
  private boltAge = 0;
  private boltTimer = 0;
  private ambient = new Graphics();
  private ambientTimer = 0;
  private glints = new Container();
  private glintTimer = 1.5;
  private strikes = new Container();
  private storm = false;

  constructor() {
    super();
    this.grid = Array.from({ length: REELS }, (_, r) => Array.from({ length: ROWS }, () => randomSymbol(r, cryptoRng)));

    const reelLayer = new Container();
    for (let r = 0; r < REELS; r++) {
      const holder = new Container();
      holder.x = r * (CELL + GAP);
      // Recessed drum-skin backing behind each reel.
      holder.addChild(
        new Graphics().rect(0, 0, CELL, WINDOW_H).fill({ color: 0x140606 }).rect(0, 0, CELL, WINDOW_H).fill({ color: 0x2a0f0b, alpha: 0.6 }),
      );
      const reel = new Reel(r, this.grid[r]);
      const mask = new Graphics().rect(0, 0, CELL, WINDOW_H).fill(0xffffff);
      holder.addChild(reel, mask);
      reel.mask = mask;
      // Cylinder shading: dark top and bottom, a soft highlight band.
      const shade = new Sprite(tex().reelShade);
      shade.width = CELL;
      shade.height = WINDOW_H;
      holder.addChild(shade);
      const dim = new Graphics().rect(0, 0, CELL, WINDOW_H).fill({ color: 0x02030a });
      dim.alpha = 0;
      holder.addChild(dim);
      this.dimmers.push(dim);
      reelLayer.addChild(holder);
      this.reels.push(reel);
    }

    // Glass: a faint diagonal sheen over the whole window.
    const glass = new Graphics()
      .poly([0, 0, WINDOW_W * 0.35, 0, WINDOW_W * 0.12, WINDOW_H, 0, WINDOW_H])
      .fill({ color: 0xffffff, alpha: 0.035 });

    this.cage.blendMode = 'add';
    this.cage.filters = [new GlowFilter({ distance: 20, outerStrength: 3, color: 0x6fc3ff, quality: 0.25 })];
    this.flashes.blendMode = 'add';
    this.ambient.blendMode = 'add';
    this.bolts.blendMode = 'add';
    this.bolts.filters = [new GlowFilter({ distance: 18, outerStrength: 3, color: 0xffd86b, quality: 0.25 })];
    this.glints.blendMode = 'add';
    this.addChild(
      reelLayer,
      glass,
      this.glints,
      this.ambient,
      this.bolts,
      this.actors,
      this.sticky,
      this.strikes,
      this.flashes,
      this.cage,
      this.puffs,
      this.actorSparks,
    );
  }

  setStorm(on: boolean): void {
    this.storm = on;
    const f = this.bolts.filters?.[0] as GlowFilter | undefined;
    if (f) f.color = on ? 0x6fc3ff : 0xffd86b;
  }

  setGrid(grid: Grid): void {
    this.grid = grid.map((c) => [...c]);
    this.reels.forEach((r, i) => r.setColumn(this.grid[i]));
  }

  cellLocal(reel: number, row: number): { x: number; y: number } {
    return { x: reel * (CELL + GAP) + CELL / 2, y: row * CELL + CELL / 2 };
  }

  /** Centre of a cell in viewport (CSS pixel) coordinates. */
  cellCenter(reel: number, row: number): [number, number] {
    const p = this.toGlobal(this.cellLocal(reel, row));
    return [p.x, p.y];
  }

  async spin(target: Grid, opts: ReelSpinOptions): Promise<void> {
    this.clearHighlight();
    const base = opts.turbo ? 0.42 : 0.75;
    const gap = opts.turbo ? 0.1 : 0.2;
    const anticipation = opts.turbo ? 1.1 : 1.9;

    let scattersBefore = 0;
    let end = 0;
    const plans: ReelPlan[] = target.map((col, r) => {
      const anticipate = scattersBefore >= 2 && r > 0;
      const anticipateAt = end;
      end = (r === 0 ? base : end + gap) + (anticipate ? anticipation : 0);
      if (col.includes('SCATTER')) scattersBefore++;
      return { stopAt: end, anticipate, anticipateAt };
    });

    const timers: gsap.core.Tween[] = [];
    const done = plans.map((plan, r) => {
      if (plan.anticipate) {
        timers.push(
          gsap.delayedCall(plan.anticipateAt, () => {
            this.startCage(r);
            opts.onAnticipate?.(r);
          }),
        );
      }
      return this.reels[r].spin(target[r], plan, opts).then(() => {
        if (this.cageReel === r) this.stopCage();
        this.grid[r] = [...target[r]];
        this.puff(r);
        target[r].forEach((id, row) => {
          if (id === 'WILD' && !this.stickyMap.has(r * ROWS + row)) this.strikeWild(r, row);
        });
        opts.onStop?.(r);
      });
    });
    await Promise.all(done);
    timers.forEach((t) => t.kill());
    this.stopCage();
    this.grid = target.map((c) => [...c]);
  }

  private startCage(r: number): void {
    this.cageReel = r;
    this.dimmers.forEach((d, i) => gsap.to(d, { alpha: i === r ? 0 : 0.55, duration: 0.3 }));
  }

  private stopCage(): void {
    this.cageReel = -1;
    this.cage.clear();
    this.dimmers.forEach((d) => gsap.to(d, { alpha: 0, duration: 0.25 }));
  }

  private drawCage(): void {
    const g = this.cage.clear();
    const r = this.cageReel;
    if (r < 0) return;
    const x0 = r * (CELL + GAP);
    const bolt = (x: number) => {
      let y = 0;
      g.moveTo(x, 0);
      while (y < WINDOW_H) {
        y += 18 + Math.random() * 30;
        g.lineTo(x + (Math.random() - 0.5) * 22, Math.min(WINDOW_H, y));
      }
    };
    bolt(x0 + 4);
    bolt(x0 + CELL - 4);
    g.stroke({ width: 3, color: 0xcfeeff, alpha: 0.9 });
    g.rect(x0, 0, CELL, WINDOW_H).stroke({ width: 4, color: 0x6fc3ff, alpha: 0.5 + Math.random() * 0.5 });
  }

  /** Dust and petals kicked up where a reel lands. */
  private puff(r: number): void {
    const t = tex();
    const x0 = r * (CELL + GAP);
    for (let i = 0; i < 7; i++) {
      this.puffs.spawn(t.glow, {
        x: x0 + Math.random() * CELL,
        y: WINDOW_H - 6,
        vx: (Math.random() - 0.5) * 120,
        vy: -30 - Math.random() * 60,
        life: 0.5,
        scale: 0.25,
        endScale: 0.7,
        alpha: 0.35,
        tint: 0xffd9a0,
        additive: true,
        drag: 2,
      });
    }
    for (let i = 0; i < 3; i++) {
      this.puffs.spawn(t.petal, {
        x: x0 + Math.random() * CELL,
        y: WINDOW_H - 10,
        vx: (Math.random() - 0.5) * 160,
        vy: -120 - Math.random() * 80,
        gravity: 260,
        life: 0.9,
        scale: 0.5,
        spin: 6,
      });
    }
  }

  /**
   * Celebrate winning cells. Winners lift out of the reel as animated actors,
   * `bolts` are joined reel to reel with lightning, and everything else dims.
   * A quiet highlight (wins smaller than the bet) only marks the cells.
   */
  highlight(positions: [number, number][], opts: { bolts?: [number, number][]; quiet?: boolean } = {}): void {
    this.clearHighlight();
    const keep = new Set(positions.map(([r, row]) => r * ROWS + row));
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        const s = this.reels[r].sprite(row);
        const key = r * ROWS + row;
        if (!keep.has(key)) {
          s.tint = 0x5d5a6a;
          continue;
        }
        if (opts.quiet || this.stickyMap.has(key)) {
          s.filters = [this.winGlow];
          continue;
        }
        const { x, y } = this.cellLocal(r, row);
        const actor = new WinActor(this.grid[r][row], SPRITE_SCALE, this.actorSparks);
        actor.position.set(x, y);
        this.actors.addChild(actor);
        s.alpha = 0;
        this.hidden.push(s);
      }
    }
    if (opts.bolts && !opts.quiet) this.lightning(opts.bolts);
  }

  /** Join every winning cell to every winning cell on the next reel: the ways, drawn. */
  private lightning(positions: [number, number][]): void {
    const byReel = new Map<number, number[]>();
    for (const [r, row] of positions) byReel.set(r, [...(byReel.get(r) ?? []), row]);
    this.boltLinks = [];
    for (const [r, rows] of byReel) {
      const next = byReel.get(r + 1);
      if (!next) continue;
      for (const a of rows) {
        for (const b of next) {
          const p = this.cellLocal(r, a);
          const q = this.cellLocal(r + 1, b);
          this.boltLinks.push([p.x, p.y, q.x, q.y]);
        }
      }
    }
    this.boltAge = 0;
    this.boltTimer = 0;
  }

  clearHighlight(): void {
    this.pulses.forEach((p) => p.kill());
    this.pulses = [];
    this.actors.removeChildren().forEach((a) => a.destroy());
    for (const s of this.hidden) s.alpha = 1;
    this.hidden = [];
    this.boltLinks = [];
    this.bolts.clear();
    for (const reel of this.reels) {
      for (let row = 0; row <= ROWS; row++) {
        const s = reel.sprite(row);
        s.tint = 0xffffff;
        s.filters = [];
        s.scale.set(SPRITE_SCALE);
      }
    }
  }

  /** Bachi strike a wild as it lands, and the hit ripples across the reels. */
  strikeWild(r: number, row: number): void {
    const { x, y } = this.cellLocal(r, row);
    const c = new Container();
    c.position.set(x, y);
    const sticks = [bachi(), bachi()];
    sticks.forEach((b, i) => {
      const side = i ? 1 : -1;
      b.scale.set(0.42);
      b.position.set(side * 60, -84);
      b.rotation = side * 0.9;
      c.addChild(b);
    });
    this.strikes.addChild(c);
    const tl = gsap.timeline({ onComplete: () => c.destroy({ children: true }) });
    tl.to(sticks[0], { rotation: -0.3, x: -26, y: -44, duration: 0.1, ease: 'power3.in' }, 0)
      .to(sticks[1], { rotation: 0.3, x: 26, y: -44, duration: 0.1, ease: 'power3.in' }, 0.04)
      .call(() => this.ripple(r, row), [], 0.1)
      .to(sticks, { alpha: 0, y: -100, duration: 0.35, ease: 'power2.out' }, 0.2);
  }

  private ripple(r0: number, row0: number): void {
    const { x, y } = this.cellLocal(r0, row0);
    const ring = new Graphics().circle(0, 0, 60).stroke({ width: 6, color: 0xffe9a8 });
    ring.blendMode = 'add';
    ring.position.set(x, y);
    this.flashes.addChild(ring);
    gsap.to(ring.scale, { x: 4.2, y: 4.2, duration: 0.6, ease: 'power2.out' });
    gsap.to(ring, { alpha: 0, duration: 0.6, ease: 'power2.in', onComplete: () => ring.destroy() });
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        if (r === r0 && row === row0) continue;
        const s = this.reels[r].sprite(row);
        const p = this.cellLocal(r, row);
        const dist = Math.hypot(p.x - x, p.y - y);
        const push = 14 * Math.max(0.2, 1 - dist / 700);
        const dx = ((p.x - x) / (dist || 1)) * push;
        const dy = ((p.y - y) / (dist || 1)) * push;
        const bx = s.x;
        const by = s.y;
        gsap
          .timeline({ delay: dist / 1400 })
          .to(s, { x: bx + dx, y: by + dy, duration: 0.08, ease: 'power2.out' })
          .to(s, { x: bx, y: by, duration: 0.4, ease: 'elastic.out(1, 0.35)' });
      }
    }
  }

  /** A quick flash on cells, e.g. a scatter landing. */
  pulse(positions: [number, number][], kind: 'pop' | 'thunder' = 'pop'): void {
    for (const [r, row] of positions) {
      const s = this.reels[r].sprite(row);
      gsap.fromTo(s.scale, { x: SPRITE_SCALE * 1.25, y: SPRITE_SCALE * 1.25 }, { x: SPRITE_SCALE, y: SPRITE_SCALE, duration: 0.5, ease: 'back.out(2)' });
      if (kind === 'thunder') {
        s.filters = [this.thunderGlow];
        gsap.delayedCall(1.2, () => {
          if (s.filters?.[0] === this.thunderGlow) s.filters = [];
        });
        const { x, y } = this.cellLocal(r, row);
        const f = new Sprite({ texture: tex().glow, anchor: 0.5, tint: 0x9fd8ff, x, y });
        f.scale.set(1.2);
        this.flashes.addChild(f);
        gsap.to(f, { alpha: 0, duration: 0.7, onComplete: () => f.destroy() });
        gsap.to(f.scale, { x: 3.2, y: 3.2, duration: 0.7, ease: 'power2.out' });
      }
    }
  }

  setSticky(wilds: StickyWild[], fresh: StickyWild[] = []): void {
    const freshKeys = new Set(fresh.map((w) => w.reel * ROWS + w.row));
    const live = new Set<number>();
    for (const w of wilds) {
      const key = w.reel * ROWS + w.row;
      live.add(key);
      let c = this.stickyMap.get(key);
      if (!c) {
        c = new Container();
        const { x, y } = this.cellLocal(w.reel, w.row);
        c.position.set(x, y);
        const halo = new Sprite({ texture: tex().glow, anchor: 0.5, tint: 0xffb340, blendMode: 'add', alpha: 0.6 });
        halo.scale.set(2.2);
        const frame = new Graphics()
          .roundRect(-CELL / 2 + 3, -CELL / 2 + 3, CELL - 6, CELL - 6, 18)
          .fill({ color: 0x2a0806, alpha: 0.85 })
          .stroke({ width: 5, fill: GOLD() });
        const wild = new Sprite({ texture: tex().symbols.WILD, anchor: 0.5 });
        wild.scale.set(SPRITE_SCALE);
        wild.filters = [this.stickyGlow];
        const badge = new Container();
        badge.position.set(CELL / 2 - 34, -CELL / 2 + 26);
        badge.addChild(
          new Graphics().roundRect(-30, -20, 60, 40, 20).fill({ color: 0xc0281e }).stroke({ width: 3, color: 0xfff1c2 }),
          new Text({
            text: '',
            style: { fontFamily: FONT.numbers, fontSize: 24, fill: '#ffffff', stroke: { color: '#3a0807', width: 3 } },
            anchor: 0.5,
          }),
        );
        badge.label = 'badge';
        c.addChild(halo, frame, wild, badge);
        this.sticky.addChild(c);
        this.stickyMap.set(key, c);
      }
      const badge = c.getChildByLabel('badge') as Container;
      const label = badge.children[1] as Text;
      const text = `×${w.mult}`;
      if (label.text !== text) {
        label.text = text;
        if (!freshKeys.has(key)) gsap.fromTo(badge.scale, { x: 1.7, y: 1.7 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(3)' });
      }
      if (freshKeys.has(key)) {
        gsap.fromTo(c.scale, { x: 1.8, y: 1.8 }, { x: 1, y: 1, duration: 0.45, ease: 'back.out(2.2)' });
        gsap.fromTo(c, { alpha: 0 }, { alpha: 1, duration: 0.2 });
      }
    }
    for (const [key, c] of this.stickyMap) {
      if (!live.has(key)) {
        c.destroy({ children: true });
        this.stickyMap.delete(key);
      }
    }
  }

  clearSticky(): void {
    this.setSticky([]);
  }

  tick(dt: number): void {
    for (const r of this.reels) r.tick(dt);
    this.puffs.update(dt);
    this.actorSparks.update(dt);
    for (const a of this.actors.children as WinActor[]) a.tick(dt);
    this.tickBolts(dt);
    this.tickAmbient(dt);
    if (this.cageReel >= 0) {
      this.cageTimer -= dt;
      if (this.cageTimer <= 0) {
        this.drawCage();
        this.cageTimer = 0.06;
      }
    }
  }

  private tickBolts(dt: number): void {
    if (!this.boltLinks.length) return;
    this.boltAge += dt;
    this.boltTimer -= dt;
    if (this.boltTimer > 0) return;
    this.boltTimer = 0.07;
    const g = this.bolts.clear();
    // Bolts arc out reel by reel, then keep crackling.
    const reach = this.boltAge * 9;
    const color = this.storm ? 0xdff4ff : 0xfff1c2;
    for (const [x1, y1, x2, y2] of this.boltLinks) {
      const step = (x1 - CELL / 2) / (CELL + GAP);
      if (step > reach) continue;
      const k = Math.min(1, reach - step);
      jaggedLine(g, x1, y1, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 4);
    }
    g.stroke({ width: 4, color, alpha: 0.95 });
  }

  /** Scatters crackle at rest; high symbols catch an occasional glint. */
  private tickAmbient(dt: number): void {
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 0.09;
      const g = this.ambient.clear();
      this.grid.forEach((col, r) => {
        if (this.reels[r].spinning) return;
        col.forEach((id, row) => {
          if (id !== 'SCATTER' || this.stickyMap.has(r * ROWS + row)) return;
          const { x, y } = this.cellLocal(r, row);
          if (Math.random() < 0.7) crackle(g, x, y, CELL * 0.55, 2, 0xbfe6ff);
        });
      });
    }
    this.glintTimer -= dt;
    if (this.glintTimer > 0) return;
    this.glintTimer = 1.4 + Math.random() * 1.6;
    const candidates: [number, number][] = [];
    this.grid.forEach((col, r) => {
      if (this.reels[r].spinning) return;
      col.forEach((id, row) => {
        if (['ONI', 'RYU', 'KOI', 'OGI', 'WILD'].includes(id) && this.reels[r].sprite(row).alpha > 0) candidates.push([r, row]);
      });
    });
    if (!candidates.length) return;
    const [r, row] = candidates[Math.floor(Math.random() * candidates.length)];
    const { x, y } = this.cellLocal(r, row);
    const g = new Sprite({ texture: tex().symbols[this.grid[r][row]], anchor: 0.5, x, y, alpha: 0 });
    g.scale.set(SPRITE_SCALE);
    this.glints.addChild(g);
    gsap
      .timeline({ onComplete: () => g.destroy() })
      .to(g, { alpha: 0.5, duration: 0.25, ease: 'sine.out' })
      .to(g.scale, { x: SPRITE_SCALE * 1.04, y: SPRITE_SCALE * 1.04, duration: 0.5 }, 0)
      .to(g, { alpha: 0, duration: 0.45, ease: 'sine.in' });
  }

  /** Index of the reel being anticipated, or -1. */
  get anticipating(): number {
    return this.cageReel;
  }
}
