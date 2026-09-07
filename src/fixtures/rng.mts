// A seeded PRNG and the sampling helpers built on it. mulberry32: 32-bit state, one
// multiply-shift round, uniform enough for fixture shaping and identical on every platform.
// P3: the fixture is deterministic, so `Math.random()` appears nowhere in this directory.

export type Rng = () => number;

export const mulberry32 = (seed: number): Rng => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const intBetween = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

export const chance = (rng: Rng, probability: number): boolean => rng() < probability;

export const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)];

export const pickWeighted = <T,>(rng: Rng, entries: readonly (readonly [T, number])[]): T => {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = rng() * total;
  for (const [value, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return value;
  }
  return entries[entries.length - 1][0];
};

export const shuffled = <T,>(rng: Rng, items: readonly T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Box-Muller. One draw per call; the discarded pair-half costs nothing at this scale.
export const gaussian = (rng: Rng): number => {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export const logNormal = (rng: Rng, median: number, sigma: number): number =>
  median * Math.exp(sigma * gaussian(rng));

// Knuth's method. Only ever called with small lambda here, so the loop is short.
export const poisson = (rng: Rng, lambda: number): number => {
  const limit = Math.exp(-lambda);
  let count = 0;
  let product = rng();
  while (product > limit) {
    count += 1;
    product *= rng();
  }
  return count;
};

// Hamilton's method: floor everything, then hand the remaining units to the largest
// fractional parts. Keeps every share-derived integer count summing exactly to `total`.
export const largestRemainder = (weights: readonly number[], total: number): number[] => {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  const exact = weights.map((weight) => (weight / sum) * total);
  const counts = exact.map(Math.floor);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  let remaining = total - counts.reduce((acc, count) => acc + count, 0);
  for (const { index } of order) {
    if (remaining <= 0) break;
    counts[index] += 1;
    remaining -= 1;
  }
  return counts;
};

export const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const quantile = (values: readonly number[], fraction: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(fraction * sorted.length));
  return sorted[index];
};

export const sum = (values: readonly number[]): number =>
  values.reduce((acc, value) => acc + value, 0);
