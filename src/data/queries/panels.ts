// The pieces every page's panels are assembled from. Orchestration only: the arithmetic is in
// `src/domain/**` and the ViewModel assembly is in `src/domain/viewmodel.ts` (R-T7).
//
// Two things live here because more than one page needs them and two copies would be two
// answers:
//
//   * **the subject grouping** — Member / Team / Organization, resolved through `aggregate.ts`
//     so that `partition`, the R-V3 overlap note and the placement all come out of the pass
//     that computed the totals, and no panel can reach a different conclusion about who is on
//     a Team;
//   * **the aggregation result** — (bucket × group) → value, which is the table both the series
//     and the mirror are built from (R-T7);
//   * **the chart's form** (R-V12) — whether a subject level is read over time or as ranked bars
//     over the whole period. It sits beside the grouping it is a fact about, so the three panels
//     the subject control reaches cannot draw one Member two different ways on two pages.

import {
  rollUp,
  type MemberFacts,
  type PerCapita,
  type Rollup,
  type RollupLevel,
} from "@/domain/aggregate";
import { changeBetween, type Change, type PeriodReading } from "@/domain/change";
import type { PeriodBucket } from "@/domain/periods";
import type { AgentSession, Member } from "@/domain/types";
import type { BucketViewModel, ChartForm, Cell, Grouping } from "@/domain/viewmodel";
import type { ClassView, PageContext } from "./context";

/**
 * The key every subject the viewer cannot resolve by name is counted into (R-A6, R-A9).
 *
 * A `team`-scoped grant reaches its Team **aggregated**: those rows belong in the totals and
 * must not become one series per person, which would be an identified breakdown built out of an
 * aggregated grant. Collapsing them into a single key is what keeps the figure available and
 * the identity withheld.
 */
export const UNNAMED_GROUP_KEY = "unnamed";
const UNNAMED_GROUP_LABEL = "Unnamed Members";

/** How the Member dimension's three levels read out loud, for the R-X2 `aria-label`. */
const ROLLUP_WORDS: Readonly<Record<RollupLevel, string>> = {
  member: "Member",
  team: "Team",
  organization: "Organization",
};

const GROUPING_OF: Readonly<Record<RollupLevel, Grouping>> = {
  member: "member",
  team: "team",
  organization: "organization",
};

/**
 * **R-V12 — the form each subject level is read in.**
 *
 * Team and Organization are a handful of series over the page's buckets and read as a trend.
 * **Member is not**: twenty of them capped to four plus "Other" (R-V4) is five lines crossing
 * each other over twenty-two weeks, and a reader takes nothing off any of the five. So a Member
 * subject drops the time axis and becomes one bar per person over the whole selected period, in
 * R-V5's whole-range order — which is the ordering the cap already computed.
 *
 * It lives here, beside the placement and the overlap note, so that the three panels the subject
 * control reaches cannot disagree about which form the level is read in.
 */
const FORM_OF: Readonly<Record<RollupLevel, ChartForm>> = {
  member: "ranked",
  team: "series",
  organization: "series",
};

/** The subject grouping, resolved: how rows are keyed, labelled, and whether they partition. */
export type Subject = {
  readonly grouping: Grouping;
  readonly rollUpLevel: string;
  /** R-V12 — domain-supplied, and the same answer for every panel on the page. */
  readonly form: ChartForm;
  readonly keysOf: (row: AgentSession) => readonly string[];
  readonly labelOf: (key: string) => string;
  /** `Rollup.partition` — false for Team, and the third conjunct of `stackable` (R-V1). */
  readonly partition: boolean;
  /** R-V3's sentence, computed with the totals. `null` on a partitioning level. */
  readonly overlapNote: string | null;
  readonly rollup: Rollup;
};

const facts = (members: readonly Member[]): readonly MemberFacts[] => members;

/**
 * The subject grouping for one panel's measure.
 *
 * The roll-up is computed with the panel's own measure, so `partition`, `overlap` and the
 * placement behind `keysOf` are the same pass that produced the totals — `aggregate.ts` is
 * arranged that way precisely so the overlap note cannot disagree with the figure it sits under.
 */
export function subjectGrouping(
  context: PageContext,
  view: ClassView,
  measure: (row: AgentSession) => number,
): Subject {
  const level = context.params.subject;
  const rollup = rollUp(
    { rows: view.rows, measure, members: facts(context.population), teams: context.data.teams },
    level,
  );
  const named = (key: string): boolean => level !== "member" || view.identified.has(key);

  return {
    grouping: GROUPING_OF[level],
    rollUpLevel: ROLLUP_WORDS[level],
    form: FORM_OF[level],
    keysOf: (row) =>
      (rollup.placement.get(row.member_id) ?? []).map((key) => (named(key) ? key : UNNAMED_GROUP_KEY)),
    labelOf: (key) => {
      if (key === UNNAMED_GROUP_KEY) return UNNAMED_GROUP_LABEL;
      if (level === "member") return context.label.member(key);
      return level === "team" ? context.label.team(key) : context.data.organization.name;
    },
    partition: rollup.partition,
    overlapNote: rollup.overlap.note,
    rollup,
  };
}

/** The page's buckets as a chart's columns, labelled and carrying R-E2's flag. */
export const bucketAxis = (
  context: PageContext,
  buckets: readonly PeriodBucket<AgentSession>[],
): readonly BucketViewModel[] => buckets.map((bucket) => context.label.bucket(bucket));

/**
 * The whole of what the aggregation reads off a bucket: its identity, and its rows.
 *
 * Stated structurally rather than as `PeriodBucket<AgentSession>` so that R-V12's whole-range
 * bucket can be one without fabricating a grain, a first day and a last day it does not have.
 * A `PeriodBucket` satisfies it, so every existing caller is unchanged.
 */
export type CellBucket = {
  readonly key: string;
  readonly rows: readonly AgentSession[];
};

/**
 * The identity of the one bucket a ranked chart holds. It is not a period key: no grain
 * produces it, so it cannot collide with one, and `bucketLabel` never sees it — the label is
 * composed below from the period labels it spans.
 */
const WHOLE_RANGE_KEY = "range";

/**
 * **What a subject-grouped panel aggregates over, and what it draws** (R-V12).
 *
 * A `series` panel is the page's own buckets, unchanged. A `ranked` one collapses them into a
 * single bucket covering the whole selected period, so the cap's whole-range ranking (R-V5) is
 * the order of the bars and there is no time axis left to read.
 */
export type SubjectAxis = {
  /** What the cells are grouped over — the page's buckets, or the one that spans them. */
  readonly buckets: readonly CellBucket[];
  /** What the chart draws as its columns, labelled and carrying R-E2's flag. */
  readonly axis: readonly BucketViewModel[];
};

export const subjectAxis = (
  context: PageContext,
  view: ClassView,
  subject: Subject,
): SubjectAxis => {
  if (subject.form === "series") {
    return { buckets: view.buckets, axis: bucketAxis(context, view.buckets) };
  }

  const labelled = bucketAxis(context, view.buckets);
  const first = labelled.at(0);
  const last = labelled.at(-1);
  // A range holding no bucket has no period to name, and one bar under a blank label would be a
  // reading. `chartViewModel` reads no bucket and no cell as R-V9's empty panel instead.
  if (!first || !last) return { buckets: [], axis: [] };

  return {
    // `view.rows` is the buckets' own rows flattened (`context.ts`), never a second filter over
    // the dataset — so the ranked panel and the series panel beside it read one population.
    buckets: [{ key: WHOLE_RANGE_KEY, rows: view.rows }],
    axis: [
      {
        key: WHOLE_RANGE_KEY,
        label: first.key === last.key ? first.label : `${first.label} – ${last.label}`,
        // R-E2 — a period assembled out of a clipped or unfinished bucket is itself partial.
        partial: labelled.some((bucket) => bucket.partial),
      },
    ],
  };
};

/** Sum of a measure over rows — the additive reading, and the commonest `valueOf`. */
export const sumOf =
  (measure: (row: AgentSession) => number) =>
  (rows: readonly AgentSession[]): number =>
    rows.reduce((running, row) => running + measure(row), 0);

export type CellInput = {
  readonly buckets: readonly CellBucket[];
  /** A row's group keys — several on a Team grouping, where the full figure lands in each (R-V3). */
  readonly keysOf: (row: AgentSession) => readonly string[];
  /**
   * The reading for one group in one bucket — the group's key is passed because a panel may
   * read a different field per series (the three duration spans, a median beside a p95).
   * `null` where the reading is undefined, and no cell is emitted for it.
   */
  readonly valueOf: (rows: readonly AgentSession[], group: string) => number | null;
  /**
   * The groups that must appear whether or not they hold rows — the five WorkTypes, the three
   * spans. Without it a WorkType that ran nothing in the range would silently leave the legend,
   * and R-N8 requires all five.
   */
  readonly groups?: readonly string[];
};

const rowsByGroup = (
  rows: readonly AgentSession[],
  keysOf: (row: AgentSession) => readonly string[],
): ReadonlyMap<string, AgentSession[]> => {
  const held = new Map<string, AgentSession[]>();
  for (const row of rows) {
    for (const key of keysOf(row)) {
      const existing = held.get(key);
      if (existing) existing.push(row);
      else held.set(key, [row]);
    }
  }
  return held;
};

const NO_ROWS: readonly AgentSession[] = [];

/**
 * **The aggregation result** (R-T7): one value per (bucket × group), and the single input both
 * the series and the mirror are built from.
 *
 * A panel holding no row in any bucket produces **no cells at all**, which is what R-V9's
 * `empty` reads — including when `groups` would otherwise have forced a row of zeros into a
 * panel a filter has emptied.
 */
export function aggregationCells(input: CellInput): readonly Cell[] {
  if (!input.buckets.some((bucket) => bucket.rows.length > 0)) return [];

  const cells: Cell[] = [];
  for (const bucket of input.buckets) {
    const grouped = rowsByGroup(bucket.rows, input.keysOf);
    const keys = input.groups ?? [...grouped.keys()];
    for (const key of keys) {
      const value = input.valueOf(grouped.get(key) ?? NO_ROWS, key);
      if (value !== null) cells.push({ bucket: bucket.key, group: key, value });
    }
  }
  return cells;
}

// --- The month pair every tile is read against (R-N7, R-M12) ---------------------------------

/** The month being reported and the one before it — the only two periods a tile ever reads. */
export type Months = {
  readonly current: PeriodBucket<AgentSession> | undefined;
  readonly prior: PeriodBucket<AgentSession> | undefined;
};

/**
 * The reported month, and the month before it (C12).
 *
 * **The prior month is not `months.at(-2)`.** It is looked up in `comparisonMonths`, which is
 * bucketed over a range widened back by one month, so the comparison survives a selection that
 * contains only one month. Before C12 the page's month picker clipped the range to a single
 * bucket and every change figure on it suppressed at once — the one control on `/demo` made the
 * page worse each time it was used.
 *
 * The lookup is by *key*, not by index: the two bucketings have different lengths and different
 * starts, and an index into the wrong one would silently compare the wrong pair of months.
 */
export const monthsOf = (view: {
  readonly months: readonly PeriodBucket<AgentSession>[];
  readonly comparisonMonths: readonly PeriodBucket<AgentSession>[];
}): Months => {
  const current = view.months.at(-1);
  if (current === undefined) return { current: undefined, prior: undefined };

  const at = view.comparisonMonths.findIndex((bucket) => bucket.key === current.key);
  return { current, prior: at > 0 ? view.comparisonMonths[at - 1] : undefined };
};

/**
 * **R-M14's denominator, computed once and read by every page that offers per-capita.**
 *
 * It is the *population's* active human Members — never the rows' authors, and never recomputed
 * per bucket. `aggregate.ts` records the reasoning at length: a denominator that varied with the
 * measure would make two metrics over one population disagree about its size, and it would delete
 * exactly the Member R-D10 seeds, a seat held against near-zero usage, which is the sharpest
 * finding in the product.
 *
 * Extracted here when C14 wired per-capita into `/demo/spend`: it was `work.ts`'s inline
 * expression, and a second copy of it in `spend.ts` would have been a second answer to "how many
 * people is this divided by" — the two would disagree the first time either was touched.
 */
export const populationPerCapita = (context: PageContext): PerCapita =>
  rollUp(
    { rows: [], measure: () => 0, members: context.population, teams: context.data.teams },
    "organization",
  ).perCapita;

/**
 * **The divisor a page divides by, or `null` where there is none** (R-M14, R-M18).
 *
 * It read `population.denominator === 0 ? 1 : population.denominator` until ticket 40, which is
 * a zero denominator producing a figure: dividing by one leaves the raw total in place under a
 * "per Member" title, so a population holding no seat would have read as a population of one.
 * `available` is already false over such a population — it requires a denominator above zero —
 * so this returns that fact instead of papering over it, and a caller that has not checked it
 * has nothing to divide by.
 */
export const perCapitaDivisor = (population: PerCapita): number | null =>
  population.available ? population.denominator : null;

/** One tile's figure, the words for its absence, and its period-over-period change (R-N7). */
export type Reading = {
  readonly value: number | null;
  readonly caption: string | null;
  readonly change: Change;
};

/** What one month reads as. `caption` carries the metric module's own words where there is none. */
export type MonthReading = { readonly value: number | null; readonly caption?: string | null };

const NO_READING: MonthReading = { value: null };

/** There is no month at all — an empty dataset. The floor suppresses on `no-prior-period`. */
const MISSING_PERIOD: PeriodReading = { key: "none", value: 0, partial: true };

const figureOf = (
  bucket: PeriodBucket<AgentSession> | undefined,
  value: number | null,
): PeriodReading | undefined =>
  bucket === undefined ? undefined : { key: bucket.key, value, partial: bucket.partial };

/**
 * A figure for the reported month, one for the month before, and R-M12's floor between them.
 * Every tile on every page is built through this, so no two tiles can compare a different pair
 * of periods from the one beside them.
 */
export const readingOf = (
  months: Months,
  valueOf: (bucket: PeriodBucket<AgentSession>) => MonthReading,
): Reading => {
  const read = (bucket: PeriodBucket<AgentSession> | undefined): MonthReading =>
    bucket ? valueOf(bucket) : NO_READING;
  const current = read(months.current);
  const prior = read(months.prior);
  return {
    value: current.value,
    caption: current.caption ?? null,
    // R-M18 — the readings travel to the floor **as they are**. `?? 0` stood here until ticket
    // 40, and it made a tile that prints "—" print "−100% on the prior period" beside it: a fall
    // to nothing, reported off a month whose measure was never defined. `changeBetween`
    // suppresses on either absence now, with its own reason.
    change: changeBetween({
      current: figureOf(months.current, current.value) ?? MISSING_PERIOD,
      prior: figureOf(months.prior, prior.value),
    }),
  };
};
