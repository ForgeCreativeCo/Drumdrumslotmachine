import { Container, Sprite, type Texture } from 'pixi.js';

export interface SpawnOptions {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  life?: number;
  gravity?: number;
  drag?: number;
  scale?: number;
  /** Scale reached at the end of life. */
  endScale?: number;
  spin?: number;
  tint?: number;
  alpha?: number;
  additive?: boolean;
  /** Sway amplitude for drifting petals. */
  sway?: number;
}

interface P extends Required<Omit<SpawnOptions, 'x' | 'y' | 'tint' | 'additive'>> {
  s: Sprite;
  age: number;
  seed: number;
}

/** Minimal sprite particle system; one per layer that needs it. */
export class Particles extends Container {
  private live: P[] = [];
  private pool: Sprite[] = [];

  spawn(texture: Texture, o: SpawnOptions): void {
    const s = this.pool.pop() ?? new Sprite();
    s.texture = texture;
    s.anchor.set(0.5);
    s.position.set(o.x, o.y);
    s.tint = o.tint ?? 0xffffff;
    s.blendMode = o.additive ? 'add' : 'normal';
    s.alpha = o.alpha ?? 1;
    s.scale.set(o.scale ?? 1);
    s.rotation = Math.random() * Math.PI * 2;
    s.visible = true;
    this.addChild(s);
    this.live.push({
      s,
      vx: o.vx ?? 0,
      vy: o.vy ?? 0,
      life: o.life ?? 1,
      gravity: o.gravity ?? 0,
      drag: o.drag ?? 0,
      scale: o.scale ?? 1,
      endScale: o.endScale ?? o.scale ?? 1,
      spin: o.spin ?? 0,
      alpha: o.alpha ?? 1,
      sway: o.sway ?? 0,
      age: 0,
      seed: Math.random() * 10,
    });
  }

  /** Remove every live particle at once. */
  clear(): void {
    for (const p of this.live) {
      p.s.visible = false;
      this.removeChild(p.s);
      this.pool.push(p.s);
    }
    this.live = [];
  }

  get count(): number {
    return this.live.length;
  }

  update(dt: number): void {
    this.live = this.live.filter((p) => {
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.s.visible = false;
        this.removeChild(p.s);
        this.pool.push(p.s);
        return false;
      }
      p.vy += p.gravity * dt;
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.s.x += (p.vx + Math.sin(p.age * 2 + p.seed) * p.sway) * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.spin * dt;
      p.s.scale.set(p.scale + (p.endScale - p.scale) * k);
      p.s.alpha = p.alpha * Math.min(1, (1 - k) * 3);
      return true;
    });
  }
}
