// ChartViewModels, authored by hand, for the component tests in this directory.
//
// **They are literals, not queries.** `src/components/**` may import `src/domain` for types only
// (R-T6) — the rule that keeps computation out of the rendering layer — so a component test
// cannot call `chartViewModel()` to build its input, and should not want to. What a component
// owes is "render the ViewModel you were handed, faithfully"; what the *ViewModel* owes — that
// the cap engaged at the right point (R-V4), that the ranking is whole-range (R-V5), that the
// mirror was summed independently of the series (R-T7), that `stackable` follows the partition
// (R-V1) — is `src/domain/viewmodel.test.ts`'s claim, over the real functions.
//
// The mirror here is built from the same table as the series, which is exactly what R-T7 forbids
// the *domain* layer from doing. That is the right trade for a fixture: the independence of the
// two derivation paths is a property of the domain module and is asserted there; here the point
// is that a component renders both and that they agree on screen.

import type { ChartViewModel, SeriesViewModel } from "@/domain/viewmodel";

/** The five theme variables `globals.css` defines, in assignment order (R-V7). */
const PALETTE: readonly SeriesViewModel["colorVar"][] = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
];

/** The reserved identity of the capped tail, as `src/domain/series.ts` spells it. */
export const OTHER_KEY = "other";

export type SeriesSpec = {
  readonly key: string;
  readonly label: string;
  readonly values: readonly number[];
};

export type ChartSpec = {
  readonly title?: string;
  readonly rollUpLevel?: string;
  /** Bucket labels. The key is the label lower-cased, which is enough to be stable and distinct. */
  readonly buckets?: readonly string[];
  readonly series?: readonly SeriesSpec[];
  /** R-V4 — what the "Other" bucket holds. Present only where the cap engaged. */
  readonly holds?: readonly string[];
  readonly stackable?: boolean;
  readonly overlapNote?: string | null;
  readonly bucketColumn?: string;
};

const DEFAULT_BUCKETS = ["April", "May", "June"];

const bucketKey = (label: string): string => label.toLowerCase();

export const seriesSpec = (key: string, label: string, base: number): SeriesSpec => ({
  key,
  label,
  values: [base, base + 1, base + 2],
});

/** Four Members plus the capped "Other" — what a 20-Member grouping reaches a chart as (R-V4). */
export const MEMBER_SERIES: readonly SeriesSpec[] = [
  seriesSpec("mem_0001", "Ada Lovelace", 40),
  seriesSpec("mem_0002", "Grace Hopper", 30),
  seriesSpec("mem_0003", "Alan Turing", 20),
  seriesSpec("mem_0004", "Katherine Johnson", 10),
  seriesSpec(OTHER_KEY, "Other", 60),
];

export const MEMBER_HOLDS = ["Barbara Liskov", "Donald Knuth", "Edsger Dijkstra"];

/** The other side of the roll-up switch: four Teams, no cap, no "Other" (R-V4). */
export const TEAM_SERIES: readonly SeriesSpec[] = [
  seriesSpec("team_platform", "Platform", 70),
  seriesSpec("team_data", "Data", 50),
  seriesSpec("team_mobile", "Mobile", 30),
  seriesSpec("team_infra", "Infrastructure", 10),
];

/** A ChartViewModel exactly as `src/domain/viewmodel.ts` would have assembled one. */
export function chartFixture(spec: ChartSpec = {}): ChartViewModel {
  const bucketLabels = spec.buckets ?? DEFAULT_BUCKETS;
  const specs = spec.series ?? MEMBER_SERIES;
  const buckets = bucketLabels.map((label) => ({
    key: bucketKey(label),
    label,
    partial: false,
  }));
  const series: readonly SeriesViewModel[] = specs.map((held, at) => ({
    key: held.key,
    label: held.label,
    colorVar: PALETTE[at] ?? "--chart-5",
    inert: held.key === OTHER_KEY,
    points: buckets.map((bucket, index) => ({ bucket: bucket.key, value: held.values[index] ?? 0 })),
  }));

  return {
    title: spec.title ?? "Cost per session",
    rollUpLevel: spec.rollUpLevel ?? "Member",
    buckets,
    series,
    other: spec.holds ? { holds: spec.holds } : null,
    overlapNote: spec.overlapNote ?? null,
    stackable: spec.stackable ?? false,
    empty: specs.length === 0,
    mirror: {
      columns: [spec.bucketColumn ?? "Period", ...specs.map((held) => held.label)],
      rows: buckets.map((bucket, index) => [
        bucket.label,
        ...specs.map((held) => held.values[index] ?? 0),
      ]),
    },
  };
}
