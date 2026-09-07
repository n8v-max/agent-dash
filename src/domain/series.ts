// Series capping and ordering — `spec.md` R-V4 / R-V5 / R-V6 / R-V7, § 11 C1, A13, A14,
// `technical-spec.md` § 3.1 (the ViewModel), § 3.2, R-T8, R-T30, ticket 27. Tested by T-U11.
//
// Two rules shape every chart in the product, and both are arranged here as properties of the
// construction rather than as rules a caller has to remember:
//
//   * **R-V4 — top 4 + "Other", engaging only *above* five series.** A dimension with five or
//     fewer distinct values in the selected range renders all of them and gets no "Other" at
//     all: an "Other" bucket holding one repository reads as a rendering fault. So the cap bites
//     on Member (20) and exact Model (7), and not on Repository (5) or WorkType (5). This
//     resolves the conflict between tickets 07 and 10 in favour of the later — `spec.md` § 11 C1.
//
//   * **R-V5 — one ranking, by the chart's own measure, across the whole selected range.** The
//     set is ranked once and is then **identical in every bucket**. Ranking per bucket is
//     forbidden: it makes series identity change mid-chart, which is both misleading and the
//     exact input that triggers the `key={index}` legend reconciliation bug (R-T8, ticket 14).
//     Here it has nowhere to happen — `capSeries` ranks the whole-range tallies once and the
//     per-bucket pass only fills values into series that already exist. Ties break by **name**
//     ascending, then by key, so the order is total and the output is a pure function of input.
//
// **R-V6 — "Other" is inert.** It is not clickable and does not expand; its tooltip lists what
// it holds. Both halves are domain-supplied: `inert` is a field on the series, so a renderer
// never has to recognise a reserved key string to know not to wire a click, and `other.holds`
// carries the labels the tooltip lists. **Filtering is how a viewer reaches beyond the top four;
// the cap itself never lifts**, so there is no parameter here that widens or disables it.
//
// **R-V7 / R-T30 — the five-colour palette is never extended, and nothing *can* request a sixth
// colour.** Three things make that true by construction rather than by convention:
//
//   1. `ChartColorVar` is a closed union of exactly the five theme variables that exist in
//      `globals.css`. There is no expression in the program that names a sixth, so the silent
//      transparent-series failure has no way to be written.
//   2. The cap is **derived from the palette** (`SERIES_LIMIT = CHART_COLOR_VARS.length`), so
//      the ceiling and the colours cannot drift apart. Four named series plus "Other" fills
//      `--chart-1..5` exactly.
//   3. Colours are assigned by iterating the **palette**, not the series. A series that had no
//      colour to take could not be emitted, so `colorVar` is non-optional on the way out and
//      needs no fallback — and a fallback is what a transparent series is made of.
//
// **R-T8 — `key` is a domain-supplied stable identity, never an array index.** Keys come from
// the dimension (a Member id, a repository id, a model family) and are unchanged by capping, so
// the same series is the same key across a bucket switch and across a roll-up switch (A14).
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

/**
 * The chart palette, in assignment order — the five variables `globals.css` defines and the
 * only five that exist. `--chart-6` is not absent by omission; R-V7 says it is never defined.
 */
export const CHART_COLOR_VARS = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
] as const;

/** A theme colour a series may take. A closed union: there is no sixth to name (R-V7). */
export type ChartColorVar = (typeof CHART_COLOR_VARS)[number];

/**
 * **Five.** The most series a chart renders, and the point above which the cap engages — at
 * five it does not. Derived from the palette so the ceiling cannot drift from the colours.
 */
export const SERIES_LIMIT = CHART_COLOR_VARS.length;

/** **Four.** The named series kept when the cap engages; "Other" takes the fifth colour. */
export const NAMED_SERIES_CAP = SERIES_LIMIT - 1;

/**
 * The reserved identity of the "Other" bucket. A dimension value keyed `other` would be
 * indistinguishable from it; no key in the committed fixture is, and
 * `src/data/series.fixture.test.ts` asserts that, so the collision is a guarded impossibility
 * rather than a silent correction.
 */
export const OTHER_SERIES_KEY = "other";

/** What "Other" is called. The one label in this module that is not read off the data. */
export const OTHER_SERIES_LABEL = "Other";

/** One series' value in one bucket. `bucket` is the period key, so a point names its own column. */
export type SeriesPoint = {
  readonly bucket: string;
  readonly value: number;
};

/**
 * A series as a chart renders it. Structurally the `SeriesViewModel` of `technical-spec.md`
 * § 3.1, plus the R-V6 fact a renderer would otherwise have to infer from the key.
 */
export type Series = {
  /** Domain-supplied stable identity — never an array index (R-T8). */
  readonly key: string;
  /** The display label, already resolved. Ties in the ranking break on this, ascending. */
  readonly label: string;
  readonly colorVar: ChartColorVar;
  /** R-V6 — true for "Other" alone: not clickable, does not expand. */
  readonly inert: boolean;
  /** One point per bucket, in bucket order. Every series has all of them (R-V5, A14). */
  readonly points: readonly SeriesPoint[];
};

/**
 * The capped, ordered set. `other` is populated **only when the cap engaged** (R-V4) and lists
 * what the bucket holds, for the R-V6 tooltip.
 */
export type SeriesSet = {
  readonly series: readonly Series[];
  readonly other: { readonly holds: readonly string[] } | null;
};

/** The minimum a series needs from a bucket. `PeriodBucket<Row>` satisfies it structurally. */
export type SeriesBucket<Row> = {
  readonly key: string;
  readonly rows: readonly Row[];
};

/**
 * Everything the cap reads. **The buckets are the only population**: ranking and plotting come
 * from the same rows, so the whole-range ranking cannot be computed over a different set than
 * the one the chart draws. Rows outside the range are absent because bucketing already dropped
 * them (`periods.ts`), not because a second filter here agrees with the first one.
 */
export type SeriesInput<Row> = {
  readonly buckets: readonly SeriesBucket<Row>[];
  /**
   * The grouping — a row's **keys**, plural, on the same placement shape `aggregate.ts` uses.
   * One key is the ordinary case; several is R-V3's non-additive Team, where a Member on two
   * Teams contributes their full figure to each; **none** places the row in no series at all,
   * which is the rule an unattributable row already meets in the roll-up. A single-key
   * signature would have made a Team-grouped chart silently undercount.
   */
  readonly seriesKeysOf: (row: Row) => readonly string[];
  /** The chart's own measure — the one the ranking is by (R-V5). */
  readonly measure: (row: Row) => number;
  /** Key → display label. Ties break on the label, so this is load-bearing, not cosmetic. */
  readonly labelOf?: (key: string) => string;
};

/** A whole-range total plus the per-bucket values behind it. Mutable only inside this module. */
type Tally = {
  readonly key: string;
  readonly label: string;
  total: number;
  readonly values: number[];
};

const emptyValues = (length: number): number[] => Array.from({ length }, () => 0);

/**
 * One pass over every bucket, accumulating the whole-range total and the per-bucket values
 * together. They are the same additions read twice, so a bucket's column cannot disagree with
 * the total that ranked its series.
 */
const tally = <Row>(input: SeriesInput<Row>): readonly Tally[] => {
  const labelOf = input.labelOf ?? ((key: string) => key);
  const held = new Map<string, Tally>();
  let index = 0;
  for (const bucket of input.buckets) {
    for (const row of bucket.rows) {
      const value = input.measure(row);
      for (const key of input.seriesKeysOf(row)) {
        const existing =
          held.get(key) ??
          { key, label: labelOf(key), total: 0, values: emptyValues(input.buckets.length) };
        // The full figure into every key the row belongs to — never a share of it (R-V3).
        existing.total += value;
        existing.values[index] += value;
        held.set(key, existing);
      }
    }
    index += 1;
  }
  return [...held.values()];
};

/**
 * R-V5's order: the chart's own measure across the whole selected range, descending; ties break
 * by **name** ascending. The key is the final tiebreak so that two series sharing a label still
 * have one deterministic order rather than the input's.
 */
const byWholeRangeMeasure = (left: Tally, right: Tally): number =>
  right.total - left.total ||
  left.label.localeCompare(right.label) ||
  left.key.localeCompare(right.key);

/** The bucket the cap sweeps the tail into. Its values are the tail's, bucket by bucket. */
const otherTally = (tail: readonly Tally[], bucketCount: number): Tally => ({
  key: OTHER_SERIES_KEY,
  label: OTHER_SERIES_LABEL,
  total: tail.reduce((running, held) => running + held.total, 0),
  values: emptyValues(bucketCount).map((_zero, index) =>
    tail.reduce((running, held) => running + held.values[index], 0),
  ),
});

/**
 * Colours, assigned by walking the **palette** rather than the series (R-V7, R-T30). The output
 * length is therefore bounded by the palette itself: a sixth series would have no colour to
 * take and so could not be emitted. It never arises — the cap already ran — but the ceiling
 * holds here without a guard, which is what "unreachable by construction" means.
 */
const paint = (
  ranked: readonly Tally[],
  buckets: readonly { readonly key: string }[],
): readonly Series[] =>
  CHART_COLOR_VARS.flatMap((colorVar, index) => {
    const held = ranked.at(index);
    if (!held) return [];
    return [
      {
        key: held.key,
        label: held.label,
        colorVar,
        inert: held.key === OTHER_SERIES_KEY,
        points: buckets.map((bucket, at) => ({ bucket: bucket.key, value: held.values[at] })),
      },
    ];
  });

/**
 * **The cap.** Rank the distinct values present in the selected range by the chart's own
 * measure over the whole of it, then bucket everything past the top four into "Other" — but
 * only when there are more than five (R-V4).
 *
 * Five Repositories render as five series and `other` is `null`; twenty Members render as four
 * plus "Other". The two halves are one expression, so neither can be changed without the other
 * being read.
 */
export function capSeries<Row>(input: SeriesInput<Row>): SeriesSet {
  const ranked = [...tally(input)].sort(byWholeRangeMeasure);
  if (ranked.length <= SERIES_LIMIT) {
    return { series: paint(ranked, input.buckets), other: null };
  }

  const kept = ranked.slice(0, NAMED_SERIES_CAP);
  const swept = ranked.slice(NAMED_SERIES_CAP);
  return {
    series: paint([...kept, otherTally(swept, input.buckets.length)], input.buckets),
    // R-V6 — what the tooltip lists, in the same ranked order the chart itself is in.
    other: { holds: swept.map((held) => held.label) },
  };
}
