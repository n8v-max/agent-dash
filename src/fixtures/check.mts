// R-T23 — the generator asserts its own invariants as it writes, and throws loudly. A
// generator that silently produces a fixture missing the 91+ day bucket is worse than one
// that fails: the test that depends on that bucket would pass vacuously.

export const check = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`fixture invariant failed — ${message}`);
};

export const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;

/**
 * A token count, in the units the product reads them in (ticket 69). The generator's report is
 * the first place anybody reads these figures, and eleven digits is not a figure anybody reads.
 */
export const tokenFigure = (value: number): string => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return `${Math.round(value / 1_000)}K`;
};

export const near = (
  label: string,
  actual: number,
  expected: number,
  tolerance: number,
): string => {
  check(
    Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual.toFixed(4)} is not within ${tolerance} of ${expected}`,
  );
  return `${label} ${actual.toFixed(3)} (target ${expected})`;
};

export const atLeast = (label: string, actual: number, floor: number): string => {
  check(actual >= floor, `${label}: ${actual} is below the required ${floor}`);
  return `${label} ${actual}`;
};
