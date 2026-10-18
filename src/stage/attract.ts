/**
 * Attract mode: a looping show that plays while the machine sits idle, the
 * way a cabinet calls to people walking past. It never touches game state.
 */
import { Container, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { REELS, ROWS } from '../math/reels';
import type { SymbolId } from '../math/symbols';
import { FONT } from './paint';
import type { ReelSet } from './reels';
import type { Stage } from './stage';
import { GOLD, brushText } from './ui';

const W = 1080;
const SHOWCASE: SymbolId[] = ['ONI', 'RYU', 'KOI', 'OGI', 'WILD', 'SCATTER'];

export class Attract {
  private tl: gsap.core.Timeline | null = null;
  private prompt: Container | null = null;

  constructor(
    private stage: Stage,
    private reels: ReelSet,
  ) {}

  get active(): boolean {
    return this.tl !== null;
  }

  start(): void {
    if (this.tl) return;
    const { stage, reels } = this;
    const m = stage.screens.main;

    const prompt = new Container();
    prompt.position.set(W / 2, m.y + 330);
    const plate = new Graphics().roundRect(-380, -96, 760, 192, 40).fill({ color: 0x050208, alpha: 0.7 }).stroke({ width: 4, fill: GOLD() });
    const jp = brushText(64, '千の太鼓が待つ');
    jp.y = -40;
    const cta = new Text({
      text: 'PRESS SPIN TO PLAY',
      style: { fontFamily: FONT.numbers, fontSize: 52, fill: GOLD(), letterSpacing: 6, stroke: { color: '#2a0806', width: 6 } },
      anchor: 0.5,
    });
    cta.y = 42;
    prompt.addChild(plate, jp, cta);
    stage.overlay.addChild(prompt);
    gsap.fromTo(prompt, { alpha: 0 }, { alpha: 1, duration: 0.6 });
    gsap.to(cta.scale, { x: 1.06, y: 1.06, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.prompt = prompt;

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.5 });
    tl.call(() => {
      stage.top.awaken(true);
      stage.top.strike(1);
    }, [], 0.4);
    // Lightning sweeps the reels, left to right.
    for (let r = 0; r < REELS; r++) {
      tl.call(() => {
        const [x0, y0] = reels.cellCenter(r, 0);
        const [x1, y1] = reels.cellCenter(r, ROWS - 1);
        stage.bolt([[x0, y0 - 120], [x1, y1 + 120]], 0xdff4ff, 0.4, 5);
      }, [], 1.2 + r * 0.14);
    }
    tl.call(() => stage.celebrate(3), [], 1.2);
    // Raijin's ring lights drum by drum.
    for (let i = 1; i <= 8; i++) tl.call(() => stage.top.lightDrums(i), [], 2.2 + i * 0.15);
    tl.call(() => {
      stage.top.boostRing(5, 2);
      stage.top.fireworks(3);
    }, [], 3.4);
    // The best symbols on screen show off.
    tl.call(() => {
      const cells: [number, number][] = [];
      this.reels.current.forEach((col, r) => col.forEach((id, row) => SHOWCASE.includes(id) && cells.push([r, row])));
      if (cells.length) reels.highlight(cells);
    }, [], 4);
    tl.call(() => {
      reels.clearHighlight();
      stage.top.lightDrums(0);
      stage.top.awaken(false);
    }, [], 7);
    tl.to({}, { duration: 0.5 }, 7.5);
    this.tl = tl;
  }

  stop(): void {
    if (!this.tl) return;
    this.tl.kill();
    this.tl = null;
    this.reels.clearHighlight();
    this.stage.top.lightDrums(0);
    this.stage.top.awaken(false);
    const p = this.prompt;
    this.prompt = null;
    if (p) gsap.to(p, { alpha: 0, duration: 0.3, onComplete: () => p.destroy({ children: true }) });
  }
}
