/** A source of uniform random numbers in [0, 1). */
export type Rng = () => number;

/** Small, fast seeded PRNG, used for tests, simulation and fixed reel strips. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const buf = new Uint32Array(1);

/** Crypto-backed RNG used for live play. */
export const cryptoRng: Rng = () => {
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
};

export function pickInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}
