interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'petal' | 'spark' | 'coin';
  rot: number;
  vr: number;
  gravity: number;
}

interface Bolt {
  points: [number, number][][];
  life: number;
  maxLife: number;
  color: string;
}

const PETAL_COLORS = ['#ffc6d9', '#ffb0c8', '#ffd8e4', '#f99ab8'];

/** Full-screen canvas for petals, sparks, coins and lightning. */
export class Fx {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private bolts: Bolt[] = [];
  private dpr = 1;
  private last = performance.now();
  private petalRate = 0.6;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Petals per second, scaled to screen width. */
  setPetals(rate: number): void {
    this.petalRate = rate;
  }

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * this.dpr;
    this.canvas.height = window.innerHeight * this.dpr;
  }

  private spawnPetal(): void {
    const w = window.innerWidth;
    this.particles.push({
      x: Math.random() * w * 1.2 - w * 0.1,
      y: -20,
      vx: 15 + Math.random() * 25,
      vy: 25 + Math.random() * 30,
      life: 0,
      maxLife: 14,
      size: 5 + Math.random() * 6,
      color: PETAL_COLORS[(Math.random() * PETAL_COLORS.length) | 0],
      kind: 'petal',
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 2,
      gravity: 0,
    });
  }

  burst(x: number, y: number, count = 24, colors = ['#ffe08a', '#ff8a3c', '#fff']): void {
    if (this.reduced) count = Math.ceil(count / 4);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.6,
        size: 2 + Math.random() * 3,
        color: colors[i % colors.length],
        kind: 'spark',
        rot: 0,
        vr: 0,
        gravity: 300,
      });
    }
  }

  coins(count = 60): void {
    if (this.reduced) count = Math.ceil(count / 4);
    const w = window.innerWidth;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: -20 - Math.random() * 300,
        vx: (Math.random() - 0.5) * 60,
        vy: 100 + Math.random() * 200,
        life: 0,
        maxLife: 4,
        size: 7 + Math.random() * 6,
        color: '#f3c75a',
        kind: 'coin',
        rot: Math.random() * Math.PI,
        vr: 4 + Math.random() * 6,
        gravity: 420,
      });
    }
  }

  /** Jagged bolt between two points, with a couple of forks. */
  lightning(x1: number, y1: number, x2: number, y2: number, color = '#bfe6ff'): void {
    const main = jagged(x1, y1, x2, y2, 6);
    const branches: [number, number][][] = [main];
    for (let i = 0; i < 2; i++) {
      const [bx, by] = main[2 + ((Math.random() * (main.length - 4)) | 0)];
      const a = Math.atan2(y2 - y1, x2 - x1) + (Math.random() - 0.5) * 1.6;
      const len = Math.hypot(x2 - x1, y2 - y1) * (0.15 + Math.random() * 0.2);
      branches.push(jagged(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, 3));
    }
    this.bolts.push({ points: branches, life: 0, maxLife: 0.45, color });
    this.burst(x2, y2, 18, ['#ffffff', color, '#7fc8ff']);
  }

  private frame(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (!this.reduced && Math.random() < this.petalRate * dt * (window.innerWidth / 800)) this.spawnPetal();

    const h = window.innerHeight;
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      p.vy += p.gravity * dt;
      if (p.kind === 'petal') p.vx += Math.sin(now / 700 + p.rot) * 6 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.life > p.maxLife || p.y > h + 40) return false;
      const fade = Math.min(1, (p.maxLife - p.life) / (p.kind === 'spark' ? p.maxLife : 0.6));
      ctx.globalAlpha = Math.max(0, fade);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === 'petal') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'coin') {
        ctx.scale(Math.cos(p.rot * 1.5), 1);
        ctx.fillStyle = '#c99426';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.78, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8a5a00';
        ctx.fillRect(-p.size * 0.25, -p.size * 0.25, p.size * 0.5, p.size * 0.5);
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return true;
    });

    this.bolts = this.bolts.filter((b) => {
      b.life += dt;
      if (b.life > b.maxLife) return false;
      const flicker = Math.random() > 0.15 ? 1 : 0.4;
      const a = (1 - b.life / b.maxLife) * flicker;
      for (const [i, pts] of b.points.entries()) {
        for (const [w, col, blur] of [
          [i === 0 ? 9 : 5, b.color, 24],
          [i === 0 ? 3 : 1.5, '#ffffff', 0],
        ] as const) {
          ctx.globalAlpha = a;
          ctx.strokeStyle = col;
          ctx.lineWidth = w;
          ctx.shadowColor = b.color;
          ctx.shadowBlur = blur;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
      return true;
    });

    ctx.globalAlpha = 1;
    requestAnimationFrame((t) => this.frame(t));
  }
}

/** Midpoint-displacement polyline. */
function jagged(x1: number, y1: number, x2: number, y2: number, depth: number): [number, number][] {
  let pts: [number, number][] = [
    [x1, y1],
    [x2, y2],
  ];
  let offset = Math.hypot(x2 - x1, y2 - y1) * 0.18;
  for (let d = 0; d < depth; d++) {
    const next: [number, number][] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      const o = (Math.random() - 0.5) * 2 * offset;
      next.push([(ax + bx) / 2 + nx * o, (ay + by) / 2 + ny * o], pts[i]);
    }
    pts = next;
    offset /= 2;
  }
  return pts;
}
