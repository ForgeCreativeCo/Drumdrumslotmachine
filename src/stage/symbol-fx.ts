/**
 * Per-symbol win animations. A win actor is a copy of the symbol lifted out
 * of the reel mask, so it can grow past its cell while it celebrates.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import gsap from 'gsap';
import type { SymbolId } from '../math/symbols';
import { ONI_EYES, RYU_PEARL } from './illustrations';
import { Particles } from './particles';
import { tex } from './textures';
import { bachi } from './ui';

const AURA: Partial<Record<SymbolId, number>> = {
  ONI: 0xff4a2a,
  RYU: 0x3af0c0,
  KOI: 0xffb340,
  OGI: 0xb98cff,
  WILD: 0xffd86b,
  SCATTER: 0x6fc3ff,
};

const glow = new Map<number, GlowFilter>();
function glowFor(color: number): GlowFilter {
  let f = glow.get(color);
  if (!f) {
    f = new GlowFilter({ distance: 16, outerStrength: 3, innerStrength: 0.2, color, quality: 0.25 });
    glow.set(color, f);
  }
  return f;
}

/** Map a point in the 256-unit illustration box to sprite-local pixels. */
function local(p: [number, number], scale: number, fit: [number, number, number] = [1, 0, 0]): [number, number] {
  const [k, dx, dy] = fit;
  return [((p[0] - 128) * k + dx) * scale, ((p[1] - 128) * k + dy) * scale];
}

export class WinActor extends Container {
  private sprite: Sprite;
  private aura: Sprite;
  private timelines: (gsap.core.Timeline | gsap.core.Tween)[] = [];
  private extras = new Container();
  private sparks: Particles;
  private bolt = new Graphics();
  private boltTimer = 0;

  constructor(
    readonly id: SymbolId,
    private baseScale: number,
    particles: Particles,
  ) {
    super();
    this.sparks = particles;
    const color = AURA[id] ?? 0xffe9a8;
    this.aura = new Sprite({ texture: tex().glow, anchor: 0.5, tint: color, blendMode: 'add', alpha: 0.5 });
    this.aura.scale.set(2.3);
    this.sprite = new Sprite({ texture: tex().symbols[id], anchor: 0.5 });
    this.sprite.scale.set(baseScale);
    this.sprite.filters = [glowFor(color)];
    this.bolt.blendMode = 'add';
    this.addChild(this.aura, this.sprite, this.extras, this.bolt);
    this.play();
  }

  private loop(tl: gsap.core.Timeline | gsap.core.Tween): void {
    this.timelines.push(tl);
  }

  private play(): void {
    const s = this.sprite;
    const k = this.baseScale;
    this.loop(gsap.to(this.aura, { alpha: 0.9, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    this.loop(gsap.to(this.aura.scale, { x: 2.7, y: 2.7, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }));

    switch (this.id) {
      case 'ONI': {
        // Roar: swell, shudder, settle. Eyes burn.
        for (const e of ONI_EYES) {
          const eye = new Sprite({ texture: tex().glowHard, anchor: 0.5, tint: 0xffd040, blendMode: 'add' });
          const [x, y] = local(e, k);
          eye.position.set(x, y);
          eye.scale.set(0.32);
          this.extras.addChild(eye);
          this.loop(gsap.to(eye, { alpha: 0.35, duration: 0.08, yoyo: true, repeat: -1, ease: 'none' }));
        }
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
        tl.to(s.scale, { x: k * 1.18, y: k * 1.18, duration: 0.18, ease: 'back.out(3)' });
        for (let i = 0; i < 6; i++) tl.to(this, { rotation: i % 2 ? 0.06 : -0.06, duration: 0.05 });
        tl.to(this, { rotation: 0, duration: 0.08 });
        tl.to(s.scale, { x: k * 1.06, y: k * 1.06, duration: 0.35, ease: 'sine.out' });
        this.loop(tl);
        break;
      }
      case 'RYU': {
        const pearl = new Sprite({ texture: tex().glowHard, anchor: 0.5, tint: 0xbff4ff, blendMode: 'add' });
        const [x, y] = local(RYU_PEARL, k, [0.93, -4, 0]);
        pearl.position.set(x, y);
        pearl.scale.set(0.34);
        pearl.alpha = 0.75;
        this.extras.addChild(pearl);
        this.loop(gsap.to(pearl.scale, { x: 0.5, y: 0.5, duration: 0.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
        this.loop(gsap.to(this, { rotation: 0.08, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
        this.loop(gsap.fromTo(s.scale, { x: k, y: k }, { x: k * 1.12, y: k * 1.12, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
        break;
      }
      case 'KOI': {
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.25 });
        tl.to(s, { y: -26, rotation: -0.18, duration: 0.32, ease: 'power2.out' })
          .to(s.scale, { x: k * 1.14, y: k * 1.14, duration: 0.32, ease: 'power2.out' }, 0)
          .to(s, { y: 0, rotation: 0, duration: 0.36, ease: 'bounce.out' })
          .to(s.scale, { x: k, y: k, duration: 0.36 }, '<')
          .call(() => this.splash());
        this.loop(tl);
        break;
      }
      case 'OGI': {
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.2 });
        tl.to(s.scale, { x: k * 0.82, duration: 0.14, ease: 'power2.in' })
          .to(s.scale, { x: k * 1.16, y: k * 1.1, duration: 0.22, ease: 'back.out(3)' })
          .call(() => this.petals())
          .to(s.scale, { x: k * 1.04, y: k * 1.04, duration: 0.4, ease: 'sine.out' });
        this.loop(tl);
        break;
      }
      case 'WILD': {
        const [l, r] = [bachi(), bachi()];
        for (const [b, side] of [
          [l, -1],
          [r, 1],
        ] as [Graphics, number][]) {
          b.scale.set(0.42);
          b.position.set(side * 46, -66);
          b.rotation = side * 0.7;
          this.extras.addChild(b);
        }
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.15 });
        tl.to(l, { rotation: -0.25, x: -24, y: -40, duration: 0.09, ease: 'power3.in' })
          .call(() => this.ring())
          .to(s.scale, { x: k * 1.12, y: k * 0.94, duration: 0.06 }, '<')
          .to(l, { rotation: -0.7, x: -46, y: -66, duration: 0.22, ease: 'back.out(2)' })
          .to(s.scale, { x: k * 1.04, y: k * 1.04, duration: 0.25, ease: 'elastic.out(1, 0.4)' }, '<')
          .to(r, { rotation: 0.25, x: 24, y: -40, duration: 0.09, ease: 'power3.in' })
          .call(() => this.ring())
          .to(s.scale, { x: k * 1.12, y: k * 0.94, duration: 0.06 }, '<')
          .to(r, { rotation: 0.7, x: 46, y: -66, duration: 0.22, ease: 'back.out(2)' })
          .to(s.scale, { x: k * 1.04, y: k * 1.04, duration: 0.25, ease: 'elastic.out(1, 0.4)' }, '<');
        this.loop(tl);
        break;
      }
      case 'SCATTER':
        this.loop(gsap.to(s, { rotation: Math.PI * 2, duration: 6, repeat: -1, ease: 'none' }));
        this.loop(gsap.to(s.scale, { x: k * 1.1, y: k * 1.1, duration: 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
        break;
      default:
        this.aura.alpha = 0.3;
        this.loop(gsap.to(s.scale, { x: k * 1.08, y: k * 1.08, duration: 0.45, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    }
  }

  private splash(): void {
    const t = tex();
    for (let i = 0; i < 8; i++) {
      this.sparks.spawn(t.dot, {
        x: this.x + (Math.random() - 0.5) * 70,
        y: this.y + 60,
        vx: (Math.random() - 0.5) * 160,
        vy: -140 - Math.random() * 120,
        gravity: 520,
        life: 0.7,
        scale: 0.18 + Math.random() * 0.12,
        tint: 0xdff4ff,
      });
    }
  }

  private petals(): void {
    const t = tex();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2;
      this.sparks.spawn(t.petal, {
        x: this.x,
        y: this.y - 20,
        vx: Math.cos(a) * 200,
        vy: Math.sin(a) * 200,
        gravity: 180,
        drag: 1.5,
        life: 1,
        scale: 0.6,
        spin: 5,
      });
    }
  }

  /** Drum-skin shockwave ring. */
  private ring(): void {
    const g = new Graphics().circle(0, 0, 40).stroke({ width: 6, color: 0xffe9a8 });
    g.blendMode = 'add';
    g.y = -6;
    this.extras.addChild(g);
    gsap.to(g.scale, { x: 2.4, y: 1.6, duration: 0.45, ease: 'power2.out' });
    gsap.to(g, { alpha: 0, duration: 0.45, onComplete: () => g.destroy() });
  }

  tick(dt: number): void {
    if (this.id !== 'SCATTER') return;
    this.boltTimer -= dt;
    if (this.boltTimer > 0) return;
    this.boltTimer = 0.07;
    crackle(this.bolt.clear(), 0, 0, 70, 3);
  }

  destroy(): void {
    this.timelines.forEach((t) => t.kill());
    gsap.killTweensOf(this);
    super.destroy({ children: true });
  }
}

/** Short jagged arcs radiating around a point, redrawn each flicker. */
export function crackle(g: Graphics, x: number, y: number, r: number, n: number, color = 0xcfeeff): void {
  for (let i = 0; i < n; i++) {
    let a = Math.random() * Math.PI * 2;
    let rr = r * 0.55;
    g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    for (let k = 0; k < 5; k++) {
      rr += r * 0.1;
      a += (Math.random() - 0.5) * 0.5;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
  }
  g.stroke({ width: 2.5, color, alpha: 0.9 });
}

/** Midpoint-displacement bolt between two points. */
export function jaggedLine(g: Graphics, x1: number, y1: number, x2: number, y2: number, depth = 4, spread = 0.22): void {
  let pts: [number, number][] = [
    [x1, y1],
    [x2, y2],
  ];
  let off = Math.hypot(x2 - x1, y2 - y1) * spread;
  for (let d = 0; d < depth; d++) {
    const next: [number, number][] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const o = (Math.random() - 0.5) * 2 * off;
      next.push([(ax + bx) / 2 + (-(by - ay) / len) * o, (ay + by) / 2 + ((bx - ax) / len) * o], pts[i]);
    }
    pts = next;
    off /= 2;
  }
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
}
