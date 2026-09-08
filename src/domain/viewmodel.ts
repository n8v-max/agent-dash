// Boundary 2, assembled — `technical-spec.md` § 3.1 (R-T6, R-T7, R-T8), R-V1, R-V3…R-V6, R-V9,
// ticket 28. Tested by `viewmodel.test.ts`; consumed by `src/data/queries/**`.
//
// **This module is where a ViewModel is built, and it is deliberately below the seam.** R-T7
// puts the table mirror in the domain layer, so the assembly that produces it has to live here
// too — if it lived in `src/data/queries.ts` the mirror would be built above the layer the
// coverage bar (R-T34) and the boundary lint (R-T33) actually protect. `queries.ts` stays
// orchestration — load, filter, bucket, measure, assemble — over this and the metric modules.
//
// Three things are settled here rather than left to a caller:
//
//   * **R-T7 — the mirror's independence is in the derivation path, not in the values.** T-C1
//     requires the mirror's numbers to *equal* the rendered series, so they may not differ.
//     What R-T7 forbids is deriving the mirror *from the series array*, which would make it a
//     second printing of one array and prove nothing. So the **aggregation result** — a
//     (bucket key × group key) → value table — is built once, and then two paths leave it: the
//     series go through `series.ts`'s ranking, capping and painting; the mirror is summed out
//     of the table directly and never reads a `SeriesPoint`. They share the arithmetic and not
//     the array, which is what makes T-C1 a real cross-check.
//
//   * **R-V1 — `stackable` is domain-supplied and follows the partition, not the panel.** It is
//     a conjunction of three facts, all of them domain facts: the grouping is one R-V1 permits
//     to assert a partition, the measure is additive (a *ratio* is never a part of a whole,
//     however cleanly its grouping partitions the rows), and — where a roll-up computed it —
//     the dimension really did partition the population. **Team is false three times over.**
//
//   * **R-T8 — `key` is a domain-supplied stable identity.** Every key here comes from the
//     dimension (a bucket key, a Member id, a model family); no array index reaches a key, and
//     `react/no-array-index-key` guards the other end of the same rule.
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

import type { Change } from "./change";
import { capSeries, type Series, type SeriesSet } from "./series";

// --- The pieces a panel renders -------------------------------------------------------------

/** One column of a chart: its stable identity, its label, and R-E2's flag. */
export type BucketViewModel = {
  /** `2026-04`, `2026-W15`, `0-7`. A stable identity, never an index (R-T8). */
  readonly key: string;
  readonly label: string;
  /** R-E2 — clipped by the range at either end, or unfinished as of `now`. */
  readonly partial: boolean;
};

/**
 * R-X1's visually-hidden table. `rows` is row-major and aligned to `columns`: the first cell of
 * each row is the bucket label, and the rest are the series' values in `columns` order.
 */
export type MirrorViewModel = {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly (string | number)[])[];
};

/** A series as a chart renders it — `series.ts`'s shape, unchanged, so nothing re-spells it. */
export type SeriesViewModel = Series;

/** Everything a chart panel needs, and nothing else (R-T6). */
export type ChartViewModel = {
  readonly title: string;
  /** Drives the `aria-label` (R-X2). Words, because a screen reader reads it out. */
  readonly rollUpLevel: string;
  readonly buckets: readonly BucketViewModel[];
  readonly series: readonly SeriesViewModel[];
  /** R-V4 — populated only where the cap engaged; R-V6's tooltip lists what it holds. */
  readonly other: { readonly holds: readonly string[] } | null;
  /** R-V3 — the overlap statement, for Team groupings. `null` on a partition. */
  readonly overlapNote: string | null;
  /** R-V1 — domain-supplied, never a styling choice. */
  readonly stackable: boolean;
  /** R-V9 — the panel has nothing to draw and renders "no data for this selection". */
  readonly empty: boolean;
  readonly mirror: MirrorViewModel;
};

// --- R-V1, as data ---------------------------------------------------------------------------

/**
 * The groupings a chart in this product is built over. Closed, because `stackable` is decided
 * by a total lookup on it: a grouping absent from this list has no chart to appear on.
 */
export const GROUPINGS = [
  "work_type",
  "model",
  "execution_mode",
  "presence_span",
  "machine_spec",
  "cost_component",
  "repository",
  "team",
  "member",
  "organization",
  "measure",
] as const;
export type Grouping = (typeof GROUPINGS)[number];

/**
 * **R-V1's table, as data.** True where the grouping's geometry may assert a partition of the
 * measure it groups.
 *
 * `spec.md` § 11 C8 narrowed ticket 10's blanket "no stacking, anywhere" to "stack only
 * partitions", so this is a list of permissions and not a list of instructions: a `false` here
 * can never be a false claim, while a `true` on **Team** would be exactly the false claim R-V3
 * describes. Team, Repository and Member are all `false` — Team and Repository because R-V1
 * names them non-additive, Member because R-V1 does not name it among the permitted groupings
 * and stacking is permitted rather than required.
 *
 * `cost_component` is session Cost beside Seat cost: R-M5 puts the two outside each other and
 * R-M1 makes their sum Total spend exactly, so they partition it (R-N9 panel 2). `measure` is
 * the grouping of two unlike readings on one chart — a median beside a p95, Rework beside
 * Decomposition — which partitions nothing at all.
 */
export const STACKABLE_GROUPINGS: Readonly<Record<Grouping, boolean>> = {
  work_type: true,
  model: true,
  execution_mode: true,
  presence_span: true,
  machine_spec: true,
  cost_component: true,
  repository: false,
  team: false,
  member: false,
  organization: false,
  measure: false,
};

/**
 * Whether a chart's measure is a sum of row figures or a reading derived from two of them.
 * A **ratio is never stackable**: cost per completed Task by WorkType groups on a partition of
 * the sessions, and the five ratios still do not add up to an Organization ratio.
 */
export const MEASURE_KINDS = ["additive", "ratio"] as const;
export type MeasureKind = (typeof MEASURE_KINDS)[number];

/**
 * R-V1, in one expression. The three facts are ANDed, so any one of them can veto the geometry
 * and none of them can be overridden by a panel.
 */
export function stackable(input: {
  readonly grouping: Grouping;
  readonly measure: MeasureKind;
  /** `Rollup.partition`, where a roll-up computed one. Absent groupings partition by definition. */
  readonly partition?: boolean;
}): boolean {
  return (
    STACKABLE_GROUPINGS[input.grouping] && input.measure === "additive" && (input.partition ?? true)
  );
}

// --- The aggregation result: one table, two paths out of it (R-T7) --------------------------

/**
 * One (bucket × group) figure — the aggregation result, at the grain the chart claims. It is
 * what both the series and the mirror are built from, and the only thing either of them reads.
 */
export type Cell = {
  readonly bucket: string;
  readonly group: string;
  readonly value: number;
};

/** Everything a chart is assembled from. Bundled, so `max-params` cannot be met by dropping one. */
export type ChartInput = {
  readonly title: string;
  readonly rollUpLevel: string;
  readonly grouping: Grouping;
  readonly measure: MeasureKind;
  readonly buckets: readonly BucketViewModel[];
  readonly cells: readonly Cell[];
  /** Group key → display label. Ties in R-V5's ranking break on it, so it is load-bearing. */
  readonly labelOf?: (key: string) => string;
  /** `Rollup.partition` where one was computed — the third conjunct of `stackable`. */
  readonly partition?: boolean;
  /** R-V3's sentence, computed with the totals by `aggregate.ts`. */
  readonly overlapNote?: string | null;
  /** The mirror's first column header. The buckets are periods unless a panel says otherwise. */
  readonly bucketColumn?: string;
};

/** group key → bucket key → value. The table both paths read; neither reads the other's output. */
type Grid = ReadonlyMap<string, ReadonlyMap<string, number>>;

const gridOf = (cells: readonly Cell[]): Grid => {
  const grid = new Map<string, Map<string, number>>();
  for (const cell of cells) {
    const held = grid.get(cell.group) ?? new Map<string, number>();
    held.set(cell.bucket, (held.get(cell.bucket) ?? 0) + cell.value);
    grid.set(cell.group, held);
  }
  return grid;
};

const valueAt = (grid: Grid, group: string, bucket: string): number =>
  grid.get(group)?.get(bucket) ?? 0;

/**
 * Path one: the cells, bucketed, through `series.ts` — whole-range ranking, the top-4 + "Other"
 * cap (R-V4, R-V5) and the palette (R-V7). One cell is one "row"; its value is the measure.
 */
const seriesFrom = (input: ChartInput): SeriesSet => {
  const held = new Map<string, Cell[]>();
  for (const cell of input.cells) {
    const existing = held.get(cell.bucket);
    if (existing) existing.push(cell);
    else held.set(cell.bucket, [cell]);
  }
  return capSeries<Cell>({
    buckets: input.buckets.map((bucket) => ({ key: bucket.key, rows: held.get(bucket.key) ?? [] })),
    seriesKeysOf: (cell) => [cell.group],
    measure: (cell) => cell.value,
    labelOf: input.labelOf,
  });
};

/**
 * **Path two: the mirror, summed out of the grid** (R-T7).
 *
 * It takes the *identity and order* of its columns from the capped set — they must agree, or
 * the mirror would describe a chart nobody is looking at — and every *number* from the grid.
 * No `SeriesPoint` is read here: a named column is that group's own cell, and the "Other"
 * column is an independent sum over exactly the groups the cap did not name. T-C1 then
 * compares two traversals of one table rather than one array printed twice.
 */
const mirrorFrom = (input: ChartInput, set: SeriesSet, grid: Grid): MirrorViewModel => {
  const named = new Set(set.series.filter((series) => !series.inert).map((series) => series.key));
  const swept = [...grid.keys()].filter((key) => !named.has(key));
  const cellFor = (series: Series, bucket: string): number =>
    series.inert
      ? swept.reduce((running, key) => running + valueAt(grid, key, bucket), 0)
      : valueAt(grid, series.key, bucket);

  return {
    columns: [input.bucketColumn ?? "Period", ...set.series.map((series) => series.label)],
    rows: input.buckets.map((bucket) => [
      bucket.label,
      ...set.series.map((series) => cellFor(series, bucket.key)),
    ]),
  };
};

/**
 * **The chart ViewModel.** Everything a panel renders, resolved: there is nothing left in it to
 * filter, bucket, sum, sort, rank, cap or compare (R-T6).
 *
 * `empty` is "the aggregation produced no cell at all" rather than "every value is zero": a
 * period that genuinely cost nothing is a reading, and R-V9's fallback is for a filter that
 * emptied the panel.
 */
export function chartViewModel(input: ChartInput): ChartViewModel {
  const set = seriesFrom(input);
  return {
    title: input.title,
    rollUpLevel: input.rollUpLevel,
    buckets: input.buckets,
    series: set.series,
    other: set.other,
    overlapNote: input.overlapNote ?? null,
    stackable: stackable(input),
    empty: input.cells.length === 0,
    mirror: mirrorFrom(input, set, gridOf(input.cells)),
  };
}

// --- Tiles ------------------------------------------------------------------------------------

/**
 * What a figure is in. Presentation formats it; the unit is a domain fact, because whether a
 * number is money or a count is not a styling choice. R-V8's labels are **not** here: they are
 * copy and they live in `components/`.
 */
export const FIGURE_UNITS = ["usd", "count", "usd_per_task", "tokens", "share", "seconds"] as const;
export type FigureUnit = (typeof FIGURE_UNITS)[number];

/** One headline figure with its period-over-period change (R-N4, R-N7). */
export type TileViewModel = {
  readonly key: string;
  readonly title: string;
  /** `null` where the figure is undefined — no Completed Task to divide by, no session to average. */
  readonly value: number | null;
  readonly unit: FigureUnit;
  /** Why the value is `null`, in the words the metric module computed. */
  readonly caption: string | null;
  readonly period: BucketViewModel;
  /** R-M12 — the change floor, decided in `change.ts` and carried, never re-decided. */
  readonly change: Change;
};

// --- Tables -----------------------------------------------------------------------------------

/**
 * One column of a table. `numeric` drives alignment; `sortable` is R-N15's per-column fact.
 *
 * **`unit` is the same domain fact `TileViewModel.unit` is** — whether a number is money, a count
 * or a token volume is not a styling choice, and a table is the one surface where the column
 * decides it rather than the figure. Without it `/demo/people` rendered its Cost column through a
 * bare `maximumFractionDigits: 2` and printed `310.5` beside a tile reading `$310.50` (ticket
 * 41). Optional, because a text column has no unit and neither does a bare count.
 */
export type TableColumn = {
  readonly key: string;
  readonly label: string;
  readonly numeric: boolean;
  readonly sortable: boolean;
  readonly unit?: FigureUnit;
};

/** A cell. `null` is *withheld* — a figure the viewer holds no grant for (R-A6). */
export type TableCell = string | number | null;

/** One row, carrying its own stable identity (R-T8) and its cells in column order. */
export type TableRow = {
  readonly key: string;
  readonly cells: readonly TableCell[];
};

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/** Which column a table is sorted by, and which way. Resolved — the component does not sort. */
export type TableSort = {
  readonly column: string;
  readonly direction: SortDirection;
};

/**
 * A table, generic in its row so a page can hang more on a row than its cells — the expandable
 * `/demo/history` row (R-N20.1) carries its own token classes and Model mix, and must survive
 * the sort with them attached.
 */
export type TableViewModelOf<Row extends TableRow> = {
  readonly columns: readonly TableColumn[];
  readonly rows: readonly Row[];
  readonly sort: TableSort;
  readonly empty: boolean;
  /** R-A9 — rows that reached the totals without resolving to a name. `null` where none did. */
  readonly note: string | null;
};

export type TableViewModel = TableViewModelOf<TableRow>;

/** Numbers compare as numbers and everything else as text. Neither ever sees a `null`. */
const compareValues = (left: string | number, right: string | number): number =>
  typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right));

/**
 * The direction is applied to the *values* only, so a withheld figure sorts last whichever way
 * the column is sorted: `null` is not a small number, and letting it flip with the direction
 * would let the absence of a grant decide who is at the top of the table.
 */
const compareCells = (sign: number) => (left: TableCell, right: TableCell): number => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return sign * compareValues(left, right);
};

/**
 * **The table ViewModel, sorted here** (R-T6). A component receiving this has no comparator in
 * scope, so a sort it renders is a sort the domain layer decided.
 *
 * An unknown sort column leaves the rows in the order they were built in rather than throwing:
 * the sort is a control value, and a control value that does not name a column is the URL's
 * problem to coerce (R-T26), never a reason for a page to 500.
 */
export function tableViewModel<Row extends TableRow>(input: {
  readonly columns: readonly TableColumn[];
  readonly rows: readonly Row[];
  readonly sort: TableSort;
  readonly note?: string | null;
}): TableViewModelOf<Row> {
  const at = input.columns.findIndex((column) => column.key === input.sort.column);
  const sign = input.sort.direction === "asc" ? 1 : -1;
  const rows =
    at === -1
      ? input.rows
      : [...input.rows].sort(
          (left, right) =>
            compareCells(sign)(left.cells[at], right.cells[at]) ||
            left.key.localeCompare(right.key),
        );

  return {
    columns: input.columns,
    rows,
    sort: input.sort,
    empty: rows.length === 0,
    note: input.note ?? null,
  };
}
