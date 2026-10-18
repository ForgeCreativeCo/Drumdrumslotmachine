import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import gsap from 'gsap';
import { beat } from './beat';
import { Deck, DECK_H, type DeckHandlers } from './deck';
import { MainScreen, MAIN_H } from './main-screen';
import { FONT } from './paint';
import { Particles } from './particles';
import { jaggedLine } from './symbol-fx';
import { buildTextures, tex } from './textures';
import { TopScreen, W } from './top';
import { LedStrip, linear, moneyText } from './ui';

const MIN_H = 1840;
const MAX_H = 2340;
const BEZEL = 34;

async function loadFonts(): Promise<void> {
  const faces = [
    `900 64px ${FONT.kanji}`,
    `64px ${FONT.brush}`,
    `64px ${FONT.numbers}`,
    `700 32px ${FONT.ui}`,
  ];
  const sample = '太鼓雷千の祭鬼龍鯉扇撥灯桜銭WILD0123456789.,×';
  await Promise.race([
    Promise.all(faces.map((f) => document.fonts.load(f, sample))).catch(() => undefined),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
}

/** The whole cabinet: three screens inside a bezel, standing on a casino floor. */
export class Stage {
  readonly app = new Application();
  private floor = new Container();
  private floorBg = new Graphics();
  private bokeh: { s: Sprite; phase: number; speed: number }[] = [];
  private cabinet = new Container();
  private camera = new Container();
  private shaker = new Container();
  /** Cross-screen effects, drawn above all three screens in design space. */
  private fx = new Container();
  private boltGfx = new Graphics();
  private bolts: { pts: [number, number][]; age: number; life: number; color: number; width: number }[] = [];
  private boltTimer = 0;
  private fxParticles = new Particles();
  private flashRect = new Graphics();
  private flood = new Graphics();
  private storm = false;
  /** Full-cabinet overlay in design space, above every screen and effect. */
  readonly overlay = new Container();
  private bezel = new Graphics();
  private bezelLeds: LedStrip[] = [];
  top!: TopScreen;
  main!: MainScreen;
  deck!: Deck;
  designH = 1920;
  private laidOut = false;
  private time = 0;
  private probe = { frames: 0, time: 0, done: false };

  static async create(host: HTMLElement, handlers: DeckHandlers): Promise<Stage> {
    const s = new Stage();
    await loadFonts();
    await s.app.init({
      resizeTo: window,
      antialias: true,
      background: '#050208',
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    s.app.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(s.app.canvas);
    buildTextures();
    s.build(handlers);
    return s;
  }

  private build(handlers: DeckHandlers): void {
    this.top = new TopScreen();
    this.main = new MainScreen();
    this.deck = new Deck(handlers);
    this.shaker.addChild(this.bezel, this.top, this.main, this.deck);
    this.boltGfx.blendMode = 'add';
    this.boltGfx.filters = [new GlowFilter({ distance: 22, outerStrength: 3.5, color: 0x6fc3ff, quality: 0.25 })];
    this.flood.blendMode = 'add';
    this.flood.alpha = 0;
    this.flashRect.alpha = 0;
    this.fx.addChild(this.flood, this.boltGfx, this.fxParticles, this.flashRect);
    this.camera.addChild(this.shaker);
    this.cabinet.addChild(this.camera);
    this.floor.addChild(this.floorBg);
    for (let i = 0; i < 26; i++) {
      const s = new Sprite({
        texture: tex().glow,
        anchor: 0.5,
        blendMode: 'add',
        tint: [0xff6a2a, 0xffb340, 0x9a4bff, 0x2a8aff, 0xff3a6a][i % 5],
      });
      this.bokeh.push({ s, phase: Math.random() * 10, speed: 0.3 + Math.random() * 0.6 });
      this.floor.addChild(s);
    }
    for (let i = 0; i < 2; i++) {
      const l = new LedStrip(800, 36);
      this.bezelLeds.push(l);
      this.shaker.addChild(l);
    }
    this.shaker.addChild(this.fx, this.overlay);
    this.app.stage.addChild(this.floor, this.cabinet);
    // Let taps anywhere reach the root (used to skip celebrations and wake the attract loop).
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.layout();
    window.addEventListener('resize', () => this.layout());
    this.app.ticker.add((t) => this.tick(t.deltaMS / 1000));
  }

  private layout(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const designH = Math.round(Math.max(MIN_H, Math.min(MAX_H, (W * vh) / vw)));
    // Phones fill the width with the screens; wider views show the bezel and floor.
    const portrait = vw < vh * 0.75;
    const pad = portrait ? 0 : BEZEL * 2 + 40;
    const scale = Math.min(vw / (W + pad), vh / (designH + pad));
    this.cabinet.scale.set(scale);
    this.cabinet.position.set((vw - W * scale) / 2, (vh - designH * scale) / 2);
    if (designH !== this.designH || !this.laidOut) {
      this.laidOut = true;
      this.designH = designH;
      const topH = designH - MAIN_H - DECK_H;
      this.top.layout(topH);
      this.main.y = topH;
      this.deck.y = topH + MAIN_H;
    }
    this.bezel
      .clear()
      .roundRect(-BEZEL, -BEZEL, W + BEZEL * 2, this.designH + BEZEL * 2, 46)
      .fill(linear([[0, '#2a2630'], [0.5, '#0c0a10'], [1, '#2a2630']], false))
      .stroke({ width: 4, color: 0xcfc6d8, alpha: 0.6 })
      .roundRect(-6, -6, W + 12, this.designH + 12, 18)
      .stroke({ width: 4, color: 0x000000 });
    this.flashRect.clear().rect(0, 0, W, this.designH).fill(0xffffff);
    this.flood.clear().rect(0, 0, W, this.designH).fill(linear([[0, '#ffcf40'], [0.5, '#a86a10'], [1, '#ffd86b']]));
    this.camera.pivot.set(W / 2, this.designH / 2);
    this.camera.position.set(W / 2, this.designH / 2);
    this.bezelLeds.forEach((l, i) => {
      l.position.set(i ? W + BEZEL / 2 : -BEZEL / 2, this.designH / 2 - 400);
    });

    this.floorBg
      .clear()
      .rect(0, 0, vw, vh)
      .fill(linear([[0, '#0a0410'], [0.7, '#14060c'], [1, '#050205']]));
    this.bokeh.forEach((b, i) => {
      b.s.position.set(((i * 137) % 100) / 100 * vw, ((i * 71) % 100) / 100 * vh * 0.8);
      b.s.scale.set(0.4 + ((i * 53) % 10) / 10);
    });
  }

  /** Viewport coordinates of a point in cabinet design space. */
  toViewport(x: number, y: number): [number, number] {
    const p = this.shaker.toGlobal({ x, y });
    return [p.x, p.y];
  }

  private local([x, y]: [number, number]): [number, number] {
    const p = this.shaker.toLocal({ x, y });
    return [p.x, p.y];
  }

  /** A lightning bolt along a path of viewport points; it can cross screens. */
  bolt(path: [number, number][], color = 0xdff4ff, life = 0.45, width = 6): void {
    this.bolts.push({ pts: path.map((p) => this.local(p)), age: 0, life, color, width });
    this.boltTimer = 0;
  }

  /** A spark flying between two viewport points on a curve. */
  flyTo(from: [number, number], to: [number, number], color = 0x9fd8ff, duration = 0.65): Promise<void> {
    const [x1, y1] = this.local(from);
    const [x2, y2] = this.local(to);
    const t = tex();
    const s = new Sprite({ texture: t.glowHard, anchor: 0.5, tint: color, blendMode: 'add' });
    s.scale.set(0.7);
    this.fx.addChild(s);
    const cx = (x1 + x2) / 2 + (x2 > x1 ? -120 : 120);
    const cy = Math.min(y1, y2) + (y2 - y1) * 0.35;
    const p = { k: 0 };
    return new Promise((resolve) => {
      gsap.to(p, {
        k: 1,
        duration,
        ease: 'power2.in',
        onUpdate: () => {
          const u = 1 - p.k;
          s.position.set(u * u * x1 + 2 * u * p.k * cx + p.k * p.k * x2, u * u * y1 + 2 * u * p.k * cy + p.k * p.k * y2);
          this.fxParticles.spawn(t.glow, { x: s.x, y: s.y, life: 0.35, scale: 0.35, endScale: 0.05, alpha: 0.7, tint: color, additive: true });
        },
        onComplete: () => {
          s.destroy();
          this.burst([x2, y2], color, 14, false);
          resolve();
        },
      });
    });
  }

  /** Sparks bursting from a point (viewport coordinates unless `designSpace`). */
  burst(at: [number, number], color = 0xffe08a, count = 24, viewport = true): void {
    const [x, y] = viewport ? this.local(at) : at;
    const t = tex();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 380;
      this.fxParticles.spawn(t.glowHard, {
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        gravity: 420,
        drag: 1.2,
        life: 0.6 + Math.random() * 0.6,
        scale: 0.12 + Math.random() * 0.12,
        endScale: 0.02,
        tint: color,
        additive: true,
      });
    }
  }

  /** Gold koban raining across the whole cabinet. */
  coinShower(count = 80): void {
    const t = tex();
    for (let i = 0; i < count; i++) {
      this.fxParticles.spawn(t.koban, {
        x: Math.random() * W,
        y: -60 - Math.random() * 500,
        vx: (Math.random() - 0.5) * 120,
        vy: 300 + Math.random() * 300,
        gravity: 900,
        life: 2.6,
        scale: 0.5 + Math.random() * 0.4,
        spin: (Math.random() - 0.5) * 10,
      });
    }
  }

  /** Full-cabinet flash; `onPeak` runs while the screen is white. */
  flash(onPeak?: () => void, color = 0xffffff, hold = 0.12): Promise<void> {
    this.flashRect.tint = color;
    return new Promise((resolve) => {
      gsap
        .timeline({ onComplete: resolve })
        .to(this.flashRect, { alpha: 1, duration: 0.06 })
        .call(() => onPeak?.())
        .to(this.flashRect, { alpha: 1, duration: hold })
        .to(this.flashRect, { alpha: 0, duration: 0.9, ease: 'power2.out' });
    });
  }

  /** Flood the cabinet with gold light for the Grand. */
  goldFlood(seconds: number): void {
    gsap.killTweensOf(this.flood);
    gsap
      .timeline()
      .to(this.flood, { alpha: 0.55, duration: 0.3 })
      .to(this.flood, { alpha: 0.25, duration: 0.4, yoyo: true, repeat: Math.max(1, Math.round(seconds / 0.4) - 2) })
      .to(this.flood, { alpha: 0, duration: 0.8 });
    this.celebrate(seconds);
    const n = Math.round(seconds / 0.8);
    for (let i = 0; i < n; i++) gsap.delayedCall(i * 0.8, () => this.coinShower(40));
  }

  /** Design-space rectangles of the three screens. */
  get screens(): Record<'top' | 'main' | 'deck', { x: number; y: number; w: number; h: number }> {
    const topH = this.designH - MAIN_H - DECK_H;
    return {
      top: { x: 0, y: 0, w: W, h: topH },
      main: { x: 0, y: topH, w: W, h: MAIN_H },
      deck: { x: 0, y: topH + MAIN_H, w: W, h: DECK_H },
    };
  }

  /** A short gold announcement over the reels, e.g. a retrigger. */
  toast(text: string): void {
    const m = this.screens.main;
    const t = moneyText(64, text);
    t.position.set(W / 2, m.y + 300);
    this.overlay.addChild(t);
    gsap
      .timeline({ onComplete: () => t.destroy() })
      .fromTo(t.scale, { x: 2.4, y: 2.4 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2)' })
      .to(t, { alpha: 0, y: t.y - 60, duration: 0.6, delay: 0.9 });
  }

  /** Pull the camera back so the whole cabinet reads as one stage. */
  pullBack(on: boolean): void {
    gsap.to(this.camera.scale, { x: on ? 0.94 : 1, y: on ? 0.94 : 1, duration: 1.1, ease: 'power2.inOut' });
  }

  shake(strength: 'small' | 'big' = 'small'): void {
    const a = strength === 'big' ? 18 : 7;
    gsap.killTweensOf(this.shaker);
    const tl = gsap.timeline({ onComplete: () => this.shaker.position.set(0, 0) });
    for (let i = 0; i < (strength === 'big' ? 10 : 5); i++) {
      const k = 1 - i / 10;
      tl.to(this.shaker, { x: (Math.random() - 0.5) * a * k, y: (Math.random() - 0.5) * a * k, duration: 0.04 });
    }
  }

  setStorm(on: boolean): void {
    this.storm = on;
    beat.bpm = on ? 132 : 116;
    this.top.setStorm(on);
    this.main.setStorm(on);
    for (const l of this.bezelLeds) l.mode = on ? 'storm' : 'festival';
    this.bokeh.forEach((b, i) => (b.s.tint = on ? [0x2a8aff, 0x6fc3ff, 0x9a4bff][i % 3] : [0xff6a2a, 0xffb340, 0x9a4bff, 0x2a8aff, 0xff3a6a][i % 5]));
  }

  /** Light every LED strip with the win chase for a moment. */
  celebrate(seconds = 2): void {
    const strips = [...this.main.leds, ...this.bezelLeds];
    const prev = strips.map((s) => s.mode);
    for (const s of strips) s.mode = 'win';
    gsap.delayedCall(seconds, () => strips.forEach((s, i) => s.mode === 'win' && (s.mode = prev[i])));
  }

  anticipate(on: boolean): void {
    for (const s of [...this.main.leds, ...this.bezelLeds]) {
      if (on) s.mode = 'anticipate';
      else if (s.mode === 'anticipate') s.mode = this.storm ? 'storm' : 'festival';
    }
  }

  /** After a warm-up, fall back to cheaper rendering if frames are slow. */
  private checkPerformance(dt: number): void {
    const p = this.probe;
    if (p.done || this.time < 1.5) return;
    p.frames++;
    p.time += dt;
    if (p.time < 2) return;
    p.done = true;
    if (p.frames / p.time >= 30) return;
    this.top.setLowQuality();
    if (this.app.renderer.resolution > 1) {
      this.app.renderer.resolution = 1;
      this.app.renderer.resize(window.innerWidth, window.innerHeight);
    }
  }

  private tickBolts(dt: number): void {
    if (!this.bolts.length) return;
    this.boltTimer -= dt;
    for (const b of this.bolts) b.age += dt;
    this.bolts = this.bolts.filter((b) => b.age < b.life);
    if (this.boltTimer > 0 && this.bolts.length) return;
    this.boltTimer = 0.06;
    const g = this.boltGfx.clear();
    for (const b of this.bolts) {
      const a = (1 - b.age / b.life) * (Math.random() > 0.15 ? 1 : 0.4);
      for (let i = 1; i < b.pts.length; i++) {
        const [x1, y1] = b.pts[i - 1];
        const [x2, y2] = b.pts[i];
        jaggedLine(g, x1, y1, x2, y2, 5, 0.18);
      }
      g.stroke({ width: b.width, color: b.color, alpha: a });
    }
  }

  private tick(dt: number): void {
    this.time += dt;
    this.checkPerformance(dt);
    this.top.tick(dt, this.time);
    this.main.tick(dt, this.time);
    this.deck.tick(dt, this.time);
    for (const l of this.bezelLeds) l.tick(this.time);
    this.fxParticles.update(dt);
    this.tickBolts(dt);
    for (const b of this.bokeh) b.s.alpha = 0.06 + 0.06 * Math.sin(this.time * b.speed + b.phase);
  }
}
