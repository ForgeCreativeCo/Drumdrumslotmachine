import { Container, FillGradient, Graphics, Sprite, Text, type TextStyleOptions } from 'pixi.js';
import gsap from 'gsap';
import { FONT } from './paint';
import { beat } from './beat';
import { tex } from './textures';

export function linear(stops: [number, string][], vertical = true): FillGradient {
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: vertical ? { x: 0, y: 1 } : { x: 1, y: 0 },
    colorStops: stops.map(([offset, color]) => ({ offset, color })),
    textureSpace: 'local',
  });
}

export const GOLD = () =>
  linear([
    [0, '#fff8d6'],
    [0.42, '#f6cf63'],
    [0.55, '#a8701a'],
    [0.72, '#e9b544'],
    [1, '#fff0b0'],
  ]);

export const BRASS = () =>
  linear([
    [0, '#ffe9a8'],
    [0.5, '#b8862a'],
    [1, '#5a3a08'],
  ]);

export const LACQUER = () =>
  linear([
    [0, '#c0281e'],
    [0.35, '#7a1512'],
    [1, '#2a0504'],
  ]);

/** Destroy a display tree after stopping every tween on it, so none writes to a destroyed object. */
export function destroyTree(c: Container): void {
  const stop = (o: Container): void => {
    gsap.killTweensOf([o, o.position, o.scale]);
    o.children.forEach((child) => stop(child));
  };
  stop(c);
  c.destroy({ children: true });
}

/** Bevelled metallic numerals for money. */
export function moneyText(size: number, text = ''): Text {
  return new Text({
    text,
    style: {
      fontFamily: FONT.numbers,
      fontSize: size,
      fill: GOLD(),
      stroke: { color: '#3a1a02', width: Math.max(2, size * 0.08), join: 'round' },
      dropShadow: { color: '#000000', alpha: 0.7, blur: size * 0.12, distance: size * 0.06, angle: Math.PI / 2 },
      letterSpacing: size * 0.02,
    },
    anchor: 0.5,
  });
}

export function brushText(size: number, text: string, fill: TextStyleOptions['fill'] = GOLD()): Text {
  return new Text({
    text,
    style: {
      fontFamily: FONT.brush,
      fontSize: size,
      fill,
      stroke: { color: '#2a0806', width: Math.max(2, size * 0.07), join: 'round' },
      dropShadow: { color: '#000000', alpha: 0.6, blur: size * 0.1, distance: size * 0.04, angle: Math.PI / 2 },
      padding: size * 0.2,
    },
    anchor: 0.5,
  });
}

export function labelText(size: number, text: string, color = '#e8cf9a'): Text {
  return new Text({
    text,
    style: {
      fontFamily: FONT.ui,
      fontWeight: '700',
      fontSize: size,
      fill: color,
      letterSpacing: size * 0.22,
    },
    anchor: 0.5,
  });
}

/** Lacquered panel with a double gold edge. */
export function panel(w: number, h: number, r: number, fill: FillGradient | string = LACQUER()): Graphics {
  return new Graphics()
    .roundRect(0, 0, w, h, r)
    .fill(fill)
    .stroke({ width: 6, color: '#2a0806' })
    .roundRect(3, 3, w - 6, h - 6, r - 2)
    .stroke({ width: 4, fill: GOLD() })
    .roundRect(10, 10, w - 20, h - 20, Math.max(2, r - 8))
    .stroke({ width: 1.5, color: '#ffe9a8', alpha: 0.35 });
}

/** Dark inset readout window, like a backlit credit meter. */
export function inset(w: number, h: number): Graphics {
  return new Graphics()
    .roundRect(0, 0, w, h, 16)
    .fill(linear([
      [0, '#050203'],
      [1, '#1c0a08'],
    ]))
    .stroke({ width: 3, fill: BRASS() })
    .roundRect(6, 6, w - 12, h * 0.36, 12)
    .fill({ color: 0xffffff, alpha: 0.04 });
}

export class BrassButton extends Container {
  private ring: Graphics;
  private lamp: Sprite;
  private caption: Text;
  private _on = false;
  private _enabled = true;

  constructor(
    readonly radius: number,
    text: string,
    onTap: () => void,
  ) {
    super();
    this.lamp = new Sprite({ texture: tex().glow, anchor: 0.5, tint: 0xffb340, blendMode: 'add' });
    this.lamp.scale.set((radius * 3.2) / 128);
    this.lamp.alpha = 0;
    this.ring = new Graphics();
    this.caption = new Text({
      text,
      style: { fontFamily: FONT.ui, fontWeight: '700', fontSize: radius * 0.42, fill: '#2a0806', letterSpacing: 2 },
      anchor: 0.5,
    });
    this.addChild(this.lamp, this.ring, this.caption);
    this.draw();
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => {
      if (!this._enabled) return;
      this.scale.set(0.92);
    });
    const up = () => this.scale.set(1);
    this.on('pointerup', up).on('pointerupoutside', up);
    this.on('pointertap', () => this._enabled && onTap());
  }

  private draw(): void {
    const r = this.radius;
    this.ring
      .clear()
      .circle(0, 4, r)
      .fill({ color: 0x000000, alpha: 0.5 })
      .circle(0, 0, r)
      .fill(BRASS())
      .circle(0, 0, r * 0.82)
      .fill(this._on ? linear([[0, '#fff3c0'], [1, '#f0a020']]) : linear([[0, '#e9cf8a'], [1, '#8a6018']]))
      .circle(0, -r * 0.25, r * 0.55)
      .fill({ color: 0xffffff, alpha: 0.18 });
  }

  set text(v: string) {
    this.caption.text = v;
  }

  set lit(v: boolean) {
    if (v === this._on) return;
    this._on = v;
    this.draw();
  }

  set enabled(v: boolean) {
    this._enabled = v;
    this.alpha = v ? 1 : 0.45;
    this.cursor = v ? 'pointer' : 'default';
  }

  tick(): void {
    this.lamp.alpha = this._on ? 0.55 + beat.pulse(4) * 0.35 : 0;
  }
}

export type LedMode = 'festival' | 'storm' | 'win' | 'anticipate';

const LED_COLORS: Record<LedMode, number[]> = {
  festival: [0xffb340, 0xff6a2a, 0xffd86b],
  storm: [0x6fc3ff, 0x9a7bff, 0xbfe6ff],
  win: [0xffe08a, 0xff6a2a, 0xfff4c0, 0xff3a2a],
  anticipate: [0x9fd8ff, 0xffffff],
};

/** A vertical strip of LEDs that chases on the beat, like a cabinet's side lighting. */
export class LedStrip extends Container {
  private dots: Sprite[] = [];
  mode: LedMode = 'festival';

  constructor(length: number, spacing = 30) {
    super();
    const n = Math.floor(length / spacing);
    for (let i = 0; i < n; i++) {
      const s = new Sprite({ texture: tex().glowHard, anchor: 0.5, blendMode: 'add' });
      s.scale.set(0.34);
      s.y = i * spacing + spacing / 2;
      this.dots.push(s);
      this.addChild(s);
    }
  }

  tick(time: number): void {
    const colors = LED_COLORS[this.mode];
    const speed = this.mode === 'win' ? 4 : this.mode === 'anticipate' ? 6 : 1;
    const b = beat.beats() * speed;
    const n = this.dots.length;
    this.dots.forEach((d, i) => {
      const head = ((b * 4) % n + n) % n;
      const dist = Math.min(Math.abs(i - head), n - Math.abs(i - head));
      const chase = Math.exp(-dist * 0.6);
      const breath = 0.25 + 0.15 * Math.sin(time * 1.5 + i * 0.3);
      d.alpha = Math.min(1, breath + chase * 0.9);
      d.tint = colors[(i + Math.floor(b)) % colors.length];
    });
  }
}

/** A drumstick, 250 units long, centred on its middle. */
export function bachi(): Graphics {
  return new Graphics()
    .roundRect(-9, -125, 18, 250, 9)
    .fill(linear([[0, '#e8c48a'], [0.5, '#b9864a'], [1, '#6a4420']], false))
    .stroke({ width: 2, color: 0x3a2008 });
}

/** Lacquered pill button with a gold edge, for in-cabinet prompts. */
export class PlaqueButton extends Container {
  private _enabled = true;

  constructor(text: string, w: number, onTap: () => void, primary = true) {
    super();
    const h = 76;
    const body = new Graphics()
      .roundRect(-w / 2, -h / 2 + 6, w, h, h / 2)
      .fill({ color: 0x000000, alpha: 0.5 })
      .roundRect(-w / 2, -h / 2, w, h, h / 2)
      .fill(primary ? linear([[0, '#ff6b4e'], [1, '#8a120c']]) : linear([[0, '#1c2a5a'], [1, '#070c24']]))
      .stroke({ width: 4, fill: GOLD() })
      .roundRect(-w / 2 + 10, -h / 2 + 6, w - 20, h * 0.36, h / 4)
      .fill({ color: 0xffffff, alpha: 0.14 });
    const label = new Text({
      text,
      style: { fontFamily: FONT.numbers, fontSize: 28, fill: primary ? '#ffffff' : '#ffe9a8', letterSpacing: 4, stroke: { color: '#2a0806', width: 4 } },
      anchor: 0.5,
    });
    this.addChild(body, label);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => this._enabled && this.scale.set(0.95));
    const up = () => this.scale.set(1);
    this.on('pointerup', up).on('pointerupoutside', up);
    this.on('pointertap', () => this._enabled && onTap());
  }

  set enabled(v: boolean) {
    this._enabled = v;
    this.alpha = v ? 1 : 0.4;
  }
}
