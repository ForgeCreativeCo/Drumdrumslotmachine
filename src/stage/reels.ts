import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { GlowFilter, MotionBlurFilter } from 'pixi-filters';
import gsap from 'gsap';
import type { StickyWild } from '../math/game';
import { REELS, ROWS, randomSymbol, type Grid } from '../math/reels';
import { cryptoRng } from '../math/rng';
import type { SymbolId } from '../math/symbols';
import { FONT } from './paint';
import { Particles } from './particles';
import { tex } from './textures';
import { GOLD } from './ui';

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
    this.addChild(reelLayer, glass, this.sticky, this.flashes, this.cage, this.puffs);
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
        this.puff(r);
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

  highlight(positions: [number, number][]): void {
    this.clearHighlight();
    const keep = new Set(positions.map(([r, row]) => r * ROWS + row));
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        const s = this.reels[r].sprite(row);
        if (keep.has(r * ROWS + row)) {
          s.tint = 0xffffff;
          s.filters = [this.winGlow];
          this.pulses.push(
            gsap.to(s.scale, { x: SPRITE_SCALE * 1.07, y: SPRITE_SCALE * 1.07, duration: 0.45, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
          );
        } else {
          s.tint = 0x5d5a6a;
        }
      }
    }
  }

  clearHighlight(): void {
    this.pulses.forEach((p) => p.kill());
    this.pulses = [];
    for (const reel of this.reels) {
      for (let row = 0; row <= ROWS; row++) {
        const s = reel.sprite(row);
        s.tint = 0xffffff;
        s.filters = [];
        s.scale.set(SPRITE_SCALE);
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
    if (this.cageReel >= 0) {
      this.cageTimer -= dt;
      if (this.cageTimer <= 0) {
        this.drawCage();
        this.cageTimer = 0.06;
      }
    }
  }

  /** Index of the reel being anticipated, or -1. */
  get anticipating(): number {
    return this.cageReel;
  }
}
