// Series generators — ticket 51, testing-spec T-U34. Feeds the property that the capped set —
// the top four plus "Other" — sums to the same figure as the uncapped grouping (R-V4, R-V5,
// A13).
//
// **What this module has to make reachable.** The cap engages *above* five series and not at
// five, so a generator whose populations never passed five would exercise the branch that returns
// everything and never the branch that sweeps a tail — and the property would read as coverage of
// a rule it had not met. Three shaping choices answer that:
//
//   * **The key pool is weighted towards six and above**, and every key in it is guaranteed a row,
//     so the number of series the cap actually sees *is* the pool size rather than whatever
//     survived a random draw. Both sides of the boundary — exactly five, and six — are reachable
//     and counted by the property.
//   * **A row may carry several keys.** That is R-V3's non-additive Team grouping, where a Member
//     on two Teams contributes their full figure to each; the "sums to the ungrouped total"
//     identity is then over (row × key) pairs, not over rows, and a single-key generator would
//     never have told the two apart.
//   * **A row may carry none**, which places it in no series at all — the same rule an
//     unattributable row already meets in the roll-up. It has to be in the population, because a
//     capped sum that quietly included it would be wrong in the one direction nobody checks.
//
// Values are whole numbers: the identity is asserted as an equality rather than a tolerance, and
// floating-point addition is not associative, so a generator producing binary fractions would be
// testing summation order instead of the cap.
//
// Determinism (P5, R-T5): pure functions of what fast-check's seeded generator chose.

import fc from "fast-check";
import type { SeriesBucket } from "../series";

/** A row that knows which series it belongs to. The `seriesKeysOf` shape, made data. */
export type KeyedRow = {
  readonly keys: readonly string[];
  readonly value: number;
};

/** A whole chart's input: the buckets, the keys the rows reach, and what an absent bucket reads. */
export type SeriesCase = {
  readonly buckets: readonly SeriesBucket<KeyedRow>[];
  /** Every key present in the rows, by construction — the population the cap ranks. */
  readonly keys: readonly string[];
  /** `0` is the additive reading, `null` the ratio one (R-M18). Both are generated. */
  readonly absent: number | null;
};

// Weighted so that the cap engages on most runs, while five-and-under — where `other` must be
// `null` — stays common enough to assert.
const groupCountArb = fc.oneof(
  { weight: 2, arbitrary: fc.integer({ min: 1, max: 5 }) },
  { weight: 3, arbitrary: fc.integer({ min: 6, max: 12 }) },
);

type Placed = { readonly at: number; readonly row: KeyedRow };

/** One row per key, so the number of series the cap sees is the pool size and not a draw. */
const seedRowsArb = (keys: readonly string[], bucketCount: number): fc.Arbitrary<readonly Placed[]> =>
  fc
    .array(
      fc.record({ at: fc.integer({ min: 0, max: bucketCount - 1 }), value: fc.nat({ max: 5000 }) }),
      { minLength: keys.length, maxLength: keys.length },
    )
    .map((seeds) =>
      seeds.map((seed, index) => ({ at: seed.at, row: { keys: [keys[index]], value: seed.value } })),
    );

const extraRowsArb = (keys: readonly string[], bucketCount: number): fc.Arbitrary<readonly Placed[]> =>
  fc.array(
    fc
      .record({
        at: fc.integer({ min: 0, max: bucketCount - 1 }),
        value: fc.nat({ max: 5000 }),
        keys: fc.uniqueArray(fc.constantFrom(...keys), { maxLength: Math.min(keys.length, 3) }),
      })
      .map((extra) => ({ at: extra.at, row: { keys: extra.keys, value: extra.value } })),
    { maxLength: 10 },
  );

const bucketsOf = (bucketCount: number, placed: readonly Placed[]): readonly SeriesBucket<KeyedRow>[] =>
  Array.from({ length: bucketCount }, (_unused, index) => ({
    key: `2026-W${String(index + 10).padStart(2, "0")}`,
    rows: placed.filter((held) => held.at === index).map((held) => held.row),
  }));

/** A chart's worth of rows: 1–5 buckets, 1–12 series, every one of them present in the data. */
export const seriesCaseArb: fc.Arbitrary<SeriesCase> = fc
  .record({
    groupCount: groupCountArb,
    bucketCount: fc.integer({ min: 1, max: 5 }),
    absent: fc.constantFrom<number | null>(0, null),
  })
  .chain((size) => {
    const keys = Array.from({ length: size.groupCount }, (_unused, index) => `grp_${index + 1}`);
    return fc
      .tuple(seedRowsArb(keys, size.bucketCount), extraRowsArb(keys, size.bucketCount))
      .map(([seeds, extras]) => ({
        buckets: bucketsOf(size.bucketCount, [...seeds, ...extras]),
        keys,
        absent: size.absent,
      }));
  });
