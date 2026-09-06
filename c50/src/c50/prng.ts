/**
 * Mulberry32 deterministic pseudo-random number generator.
 */
export class PRNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: readonly T[]): T {
    const idx = this.nextInt(0, arr.length - 1);
    return arr[idx];
  }

  choice<T>(arr: readonly T[]): T {
    return this.pick(arr);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}
