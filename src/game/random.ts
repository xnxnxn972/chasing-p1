/**
 * Deterministic pseudo-randomness. Everything in a career — potential, team
 * development, AI drivers, race noise, regulation shifts, which decisions fire —
 * is drawn from one seed, so `same seed + same decisions ~= same career`.
 */

/** FNV-1a style string hash -> 32-bit unsigned int. */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  private state: number;

  constructor(seed: string | number) {
    const n = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
    // Avoid the degenerate zero state.
    this.state = n === 0 ? 0x9e3779b9 : n;
  }

  /** mulberry32 — small, fast, good enough for a career sim. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** Weighted pick. Weights must be non-negative; at least one positive. */
  pickWeighted<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0;
    for (const item of items) total += Math.max(0, weight(item));
    if (total <= 0) return this.pick(items);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= Math.max(0, weight(item));
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  shuffle<T>(items: T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Standard normal via Box-Muller, scaled. */
  gauss(mean = 0, sd = 1): number {
    const u = Math.max(this.next(), 1e-9);
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Serialisable position in the stream, so a career can be stepped and stored. */
  snapshot(): number {
    return this.state;
  }

  /** A fresh independent stream, derived deterministically from this one. */
  fork(label: string): Rng {
    return new Rng(hashSeed(label + ':' + this.state.toString(36)));
  }
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** A short, pronounceable seed the player can share. */
export function makeSeed(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
