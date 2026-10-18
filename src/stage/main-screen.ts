import { Container, Graphics, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import gsap from 'gsap';
import { beat } from './beat';
import { FONT, paintSeigaiha } from './paint';
import { CELL, GAP, ReelSet, WINDOW_H, WINDOW_W } from './reels';
import { tex } from './textures';
import { GOLD, LedStrip, brushText, destroyTree, linear, moneyText } from './ui';

export const MAIN_H = 900;
const W = 1080;
const WIN_X = (W - WINDOW_W) / 2;
const WIN_Y = 118;

/** The reel screen: lacquered drum-hoop frame, reels, win banner and side lighting. */
export class MainScreen extends Container {
  readonly reels = new ReelSet();
  private content = new Container();
  private wall = new Graphics();
  private pattern: TilingSprite;
  private frame = new Container();
  private tacks = new Container();
  private sideDrums: Sprite[] = [];
  readonly leds: LedStrip[] = [];
  private stats: Text;
  private win: Text;
  private info: Text;
  private winGlow: Sprite;
  private panel = new Container();
  private panelContent = new Container();

  constructor() {
    super();
    this.wall.rect(0, 0, W, MAIN_H).fill(linear([
      [0, '#1c0806'],
      [0.5, '#2a0d09'],
      [1, '#120404'],
    ]));
    this.pattern = new TilingSprite({ texture: Texture.from(paintSeigaiha(96)), width: W, height: MAIN_H });
    this.addChild(this.wall, this.pattern);

    this.buildFrame();
    this.reels.position.set(WIN_X, WIN_Y);
    this.buildPanel();
    this.content.addChild(this.frame, this.reels, this.panel, this.tacks);
    this.content.pivot.set(W / 2, WIN_Y + WINDOW_H / 2);
    this.content.position.set(W / 2, WIN_Y + WINDOW_H / 2);
    this.addChild(this.content);

    for (const side of [0, 1]) {
      const d = new Sprite({ texture: tex().drumLacquer, anchor: { x: 0.5, y: 0.6 } });
      d.scale.set(0.5);
      d.position.set(side ? W - 104 : 104, 800);
      this.sideDrums.push(d);
      this.addChild(d);
    }

    this.winGlow = new Sprite({ texture: tex().glow, anchor: 0.5, tint: 0xffb340, blendMode: 'add', alpha: 0 });
    this.winGlow.scale.set(6, 1.6);
    this.winGlow.position.set(W / 2, 804);
    this.stats = new Text({
      text: '',
      style: { fontFamily: FONT.numbers, fontSize: 30, fill: '#cfeeff', letterSpacing: 3, stroke: { color: '#050a20', width: 5 } },
      anchor: 0.5,
    });
    this.stats.position.set(W / 2, 738);
    this.win = moneyText(86, '');
    this.win.position.set(W / 2, 804);
    this.info = new Text({
      text: '',
      style: { fontFamily: FONT.ui, fontWeight: '700', fontSize: 28, fill: '#f3e3bd', align: 'center', wordWrap: true, wordWrapWidth: 760 },
      anchor: 0.5,
    });
    this.info.position.set(W / 2, 870);
    this.addChild(this.winGlow, this.stats, this.win, this.info);

    for (const side of [0, 1]) {
      const s = new LedStrip(MAIN_H - 40);
      s.position.set(side ? W - 14 : 14, 20);
      this.leds.push(s);
      this.addChild(s);
    }
  }

  private buildFrame(): void {
    const x = WIN_X - 40;
    const y = WIN_Y - 46;
    const w = WINDOW_W + 80;
    const h = WINDOW_H + 92;
    const g = new Graphics()
      // Drop shadow onto the wall.
      .roundRect(x + 6, y + 14, w, h, 34)
      .fill({ color: 0x000000, alpha: 0.55 })
      // Lacquered hoop.
      .roundRect(x, y, w, h, 34)
      .fill(linear([
        [0, '#d0372a'],
        [0.12, '#8a150f'],
        [0.88, '#5a0c09'],
        [1, '#2a0504'],
      ]))
      .stroke({ width: 7, fill: GOLD() })
      .roundRect(x + 14, y + 14, w - 28, h - 28, 24)
      .stroke({ width: 2, color: 0xffe9a8, alpha: 0.45 })
      // Recess around the reel window.
      .roundRect(WIN_X - 12, WIN_Y - 12, WINDOW_W + 24, WINDOW_H + 24, 14)
      .fill({ color: 0x0a0203 })
      .stroke({ width: 5, fill: GOLD() });
    // Glossy lacquer highlight.
    g.roundRect(x + 20, y + 6, w - 40, 22, 11).fill({ color: 0xffffff, alpha: 0.12 });
    // Reel separators.
    for (let r = 1; r < 5; r++) {
      const sx = WIN_X + r * (CELL + GAP) - GAP / 2;
      g.rect(sx - 2, WIN_Y, 4, WINDOW_H).fill(linear([[0, '#3a1a06'], [0.5, '#e9b544'], [1, '#3a1a06']], false));
    }
    this.frame.addChild(g);

    // Drum tacks along the hoop, like a taiko's rim.
    const t = tex();
    for (const ty of [y + 30, y + h - 30]) {
      for (let tx = x + 48; tx <= x + w - 48; tx += 36) {
        const tack = new Sprite({ texture: t.dot, anchor: 0.5, tint: 0xffd86b });
        tack.scale.set(0.42);
        tack.position.set(tx, ty);
        const hi = new Sprite({ texture: t.dot, anchor: 0.5, tint: 0xfffbe8 });
        hi.scale.set(0.15);
        hi.position.set(tx - 3, ty - 3);
        this.tacks.addChild(tack, hi);
      }
    }

    // Hanging sign.
    const sign = new Container();
    sign.position.set(W / 2, y - 6);
    sign.addChild(
      new Graphics()
        .roundRect(-170, -40, 340, 80, 18)
        .fill(linear([[0, '#2a0806'], [1, '#0e0302']]))
        .stroke({ width: 5, fill: GOLD() }),
      brushText(46, '千の太鼓'),
    );
    this.frame.addChild(sign);
  }

  private buildPanel(): void {
    const bg = new Graphics()
      .roundRect(-4, -4, WINDOW_W + 8, WINDOW_H + 8, 12)
      .fill(linear([[0, '#0c1640'], [0.6, '#060a22'], [1, '#02030c']]))
      .stroke({ width: 3, fill: GOLD() });
    const pattern = new TilingSprite({ texture: Texture.from(paintSeigaiha(80, 'rgba(111,195,255,.07)')), width: WINDOW_W, height: WINDOW_H });
    this.panel.addChild(bg, pattern, this.panelContent);
    this.panel.position.set(WIN_X, WIN_Y);
    this.panel.visible = false;
  }

  /** Take over the reel window with a bonus panel; returns its empty content layer (932 x 540). */
  openPanel(): Container {
    this.panelContent.removeChildren().forEach(destroyTree);
    gsap.killTweensOf(this.panel);
    this.panel.visible = true;
    if (this.panel.alpha < 1) gsap.fromTo(this.panel, { alpha: this.panel.alpha }, { alpha: 1, duration: 0.35 });
    return this.panelContent;
  }

  closePanel(): Promise<void> {
    return new Promise((resolve) => {
      gsap.to(this.panel, {
        alpha: 0,
        duration: 0.35,
        onComplete: () => {
          this.panel.visible = false;
          this.panelContent.removeChildren().forEach(destroyTree);
          resolve();
        },
      });
    });
  }

  setInfo(text: string): void {
    this.info.text = text;
  }

  setStats(text: string | null): void {
    this.stats.text = text ?? '';
  }

  setWin(text: string | null): void {
    this.win.text = text ?? '';
    gsap.killTweensOf(this.winGlow);
    if (text) {
      gsap.fromTo(this.win.scale, { x: 1.25, y: 1.25 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(2.5)' });
      gsap.fromTo(this.winGlow, { alpha: 0.9 }, { alpha: 0.35, duration: 0.8 });
    } else {
      this.winGlow.alpha = 0;
    }
  }

  /** Camera push towards an anticipated reel. */
  push(reel: number): void {
    const cx = WIN_X + reel * (CELL + GAP) + CELL / 2;
    gsap.to(this.content.scale, { x: 1.045, y: 1.045, duration: 0.8, ease: 'power2.out' });
    gsap.to(this.content.pivot, { x: W / 2 + (cx - W / 2) * 0.12, duration: 0.8, ease: 'power2.out' });
  }

  release(): void {
    gsap.to(this.content.scale, { x: 1, y: 1, duration: 0.4, ease: 'power2.out' });
    gsap.to(this.content.pivot, { x: W / 2, duration: 0.4, ease: 'power2.out' });
  }

  /** The side drums answer each reel stop. */
  drumHit(i: number): void {
    const d = this.sideDrums[i % 2];
    gsap.fromTo(d.scale, { x: 0.54, y: 0.44 }, { x: 0.5, y: 0.5, duration: 0.35, ease: 'elastic.out(1, 0.4)' });
    gsap.fromTo(this.content, { y: WIN_Y + WINDOW_H / 2 + 5 }, { y: WIN_Y + WINDOW_H / 2, duration: 0.18, ease: 'power2.out' });
  }

  setStorm(on: boolean): void {
    this.reels.setStorm(on);
    this.sideDrums.forEach((d) => (d.texture = on ? tex().drumStorm : tex().drumLacquer));
    this.pattern.tint = on ? 0x6f9cff : 0xffffff;
    this.wall.tint = on ? 0x5a6aa8 : 0xffffff;
    for (const l of this.leds) l.mode = on ? 'storm' : 'festival';
  }

  tick(dt: number, time: number): void {
    this.reels.tick(dt);
    this.pattern.tilePosition.x += dt * 4;
    for (const l of this.leds) l.tick(time);
    const p = beat.pulse(6);
    for (const d of this.sideDrums) d.alpha = 0.92 + p * 0.08;
  }
}
