import { REELS, ROWS, randomSymbol, type Grid } from '../math/reels';
import { cryptoRng } from '../math/rng';
import type { StickyWild } from '../math/game';
import type { SymbolId } from '../math/symbols';
import { symbolSvg } from './art';

export interface SpinOptions {
  turbo: boolean;
  free: boolean;
  /** Called as each reel lands. */
  onStop?: (reel: number) => void;
  /** Called when a reel starts its slowed, drum-rolled anticipation. */
  onAnticipate?: (reel: number) => void;
}

function cellHtml(id: SymbolId): string {
  return `<div class="cell" data-sym="${id}">${symbolSvg(id)}</div>`;
}

export class ReelsView {
  private reelEls: HTMLElement[] = [];
  private strips: HTMLElement[] = [];
  private stickyLayer: HTMLElement;
  private grid: Grid;

  constructor(private root: HTMLElement) {
    this.grid = Array.from({ length: REELS }, (_, r) =>
      Array.from({ length: ROWS }, () => randomSymbol(r, cryptoRng)),
    );
    root.innerHTML = '';
    for (let r = 0; r < REELS; r++) {
      const reel = document.createElement('div');
      reel.className = 'reel';
      const strip = document.createElement('div');
      strip.className = 'strip';
      reel.appendChild(strip);
      root.appendChild(reel);
      this.reelEls.push(reel);
      this.strips.push(strip);
    }
    this.stickyLayer = document.createElement('div');
    this.stickyLayer.className = 'sticky-layer';
    root.appendChild(this.stickyLayer);
    this.setGrid(this.grid);
  }

  setGrid(grid: Grid): void {
    this.grid = grid.map((c) => [...c]);
    grid.forEach((col, r) => {
      this.strips[r].style.transform = '';
      this.strips[r].innerHTML = col.map(cellHtml).join('');
    });
  }

  cell(reel: number, row: number): HTMLElement {
    return this.strips[reel].children[row] as HTMLElement;
  }

  /** Centre of a cell in viewport coordinates. */
  cellCenter(reel: number, row: number): [number, number] {
    const r = this.reelEls[reel].getBoundingClientRect();
    const h = r.height / ROWS;
    return [r.left + r.width / 2, r.top + h * (row + 0.5)];
  }

  async spin(target: Grid, opts: SpinOptions): Promise<void> {
    this.clearHighlight();
    const h = this.reelEls[0].clientHeight / ROWS;
    const base = opts.turbo ? 320 : 650;
    const gap = opts.turbo ? 90 : 190;
    const anticipation = opts.turbo ? 900 : 1500;

    // Anticipate any reel that could complete a bonus trigger.
    let scattersBefore = 0;
    let end = 0;
    const plans = target.map((col, r) => {
      const anticipate = scattersBefore >= 2 && r > 0;
      const start = end;
      end = (r === 0 ? base : end + gap) + (anticipate ? anticipation : 0);
      if (col.includes('SCATTER')) scattersBefore++;
      return { duration: end, anticipate, anticipateAt: start };
    });

    const done = plans.map(({ duration, anticipate, anticipateAt }, r) => {
      const strip = this.strips[r];
      const fillers = Math.max(8, Math.round(duration / (opts.turbo ? 45 : 55)));
      const cells: SymbolId[] = [
        ...target[r],
        ...Array.from({ length: fillers }, () => randomSymbol(r, cryptoRng, opts.free)),
        ...this.grid[r],
      ];
      strip.innerHTML = cells.map(cellHtml).join('');
      const from = -(cells.length - ROWS) * h;
      strip.classList.add('spinning');

      if (anticipate) {
        window.setTimeout(() => {
          this.reelEls[r].classList.add('anticipate');
          opts.onAnticipate?.(r);
        }, anticipateAt);
      }

      const anim = strip.animate(
        [
          { transform: `translateY(${from}px)`, easing: 'cubic-bezier(.45,.05,.55,.95)' },
          { transform: `translateY(${from + h * 0.4}px)`, offset: 0.06, easing: 'linear' },
          { transform: `translateY(${h * 0.18}px)`, offset: 0.93, easing: 'cubic-bezier(.3,0,.4,1)' },
          { transform: 'translateY(0px)' },
        ],
        { duration, fill: 'forwards' },
      );
      return anim.finished.then(() => {
        strip.classList.remove('spinning');
        this.reelEls[r].classList.remove('anticipate');
        anim.cancel();
        strip.innerHTML = target[r].map(cellHtml).join('');
        opts.onStop?.(r);
      });
    });

    await Promise.all(done);
    this.grid = target.map((c) => [...c]);
  }

  highlight(positions: [number, number][]): void {
    const keep = new Set(positions.map(([r, row]) => r * ROWS + row));
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        const el = this.cell(r, row);
        const on = keep.has(r * ROWS + row);
        el.classList.toggle('win', on);
        el.classList.toggle('dim', !on);
      }
    }
  }

  pulse(positions: [number, number][], cls = 'pop'): void {
    for (const [r, row] of positions) {
      const el = this.cell(r, row);
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    }
  }

  clearHighlight(): void {
    this.root.querySelectorAll('.cell').forEach((c) => c.classList.remove('win', 'dim', 'pop'));
  }

  /** Locked wilds sit on their own layer so they stay put while the reels spin beneath. */
  setSticky(wilds: StickyWild[], fresh: StickyWild[] = []): void {
    const freshKeys = new Set(fresh.map((w) => w.reel * ROWS + w.row));
    const existing = new Map<number, HTMLElement>();
    this.stickyLayer.querySelectorAll<HTMLElement>('.sticky').forEach((el) => existing.set(Number(el.dataset.key), el));
    const live = new Set<number>();
    for (const w of wilds) {
      const key = w.reel * ROWS + w.row;
      live.add(key);
      let el = existing.get(key);
      if (!el) {
        el = document.createElement('div');
        el.className = 'sticky';
        el.dataset.key = String(key);
        el.style.gridColumn = String(w.reel + 1);
        el.style.gridRow = String(w.row + 1);
        el.innerHTML = `${symbolSvg('WILD')}<span class="badge"></span>`;
        this.stickyLayer.appendChild(el);
      }
      const badge = el.querySelector('.badge')!;
      const label = `×${w.mult}`;
      if (badge.textContent !== label) {
        badge.textContent = label;
        if (!freshKeys.has(key)) {
          el.classList.remove('beat');
          void el.offsetWidth;
          el.classList.add('beat');
        }
      }
      if (freshKeys.has(key)) el.classList.add('stamp');
    }
    existing.forEach((el, key) => !live.has(key) && el.remove());
  }

  clearSticky(): void {
    this.stickyLayer.innerHTML = '';
  }
}
