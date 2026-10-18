import { Application, Container, Graphics, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { beat } from './beat';
import { Deck, DECK_H, type DeckHandlers } from './deck';
import { MainScreen, MAIN_H } from './main-screen';
import { FONT } from './paint';
import { buildTextures, tex } from './textures';
import { TopScreen, W } from './top';
import { LedStrip, linear } from './ui';

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
  private shaker = new Container();
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
    this.cabinet.addChild(this.shaker);
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
    this.app.stage.addChild(this.floor, this.cabinet);
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
      else if (s.mode === 'anticipate') s.mode = document.body.classList.contains('storm') ? 'storm' : 'festival';
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

  private tick(dt: number): void {
    this.time += dt;
    this.checkPerformance(dt);
    this.top.tick(dt, this.time);
    this.main.tick(dt, this.time);
    this.deck.tick(dt, this.time);
    for (const l of this.bezelLeds) l.tick(this.time);
    for (const b of this.bokeh) b.s.alpha = 0.06 + 0.06 * Math.sin(this.time * b.speed + b.phase);
  }
}
