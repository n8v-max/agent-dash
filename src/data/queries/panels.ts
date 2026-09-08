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
//     and the mirror are built from (R-T7).

import {
  rollUp,
  type MemberFacts,
  type PerCapita,
  type Rollup,
  type RollupLevel,
} from "@/domain/aggregate";
import { changeBetween, type Change, type PeriodFigure } from "@/domain/change";
import type { PeriodBucket } from "@/domain/periods";
import type { AgentSession, Member } from "@/domain/types";
import type { BucketViewModel, Cell, Grouping } from "@/domain/viewmodel";
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

/** The subject grouping, resolved: how rows are keyed, labelled, and whether they partition. */
export type Subject = {
  readonly grouping: Grouping;
  readonly rollUpLevel: string;
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

/** Sum of a measure over rows — the additive reading, and the commonest `valueOf`. */
export const sumOf =
  (measure: (row: AgentSession) => number) =>
  (rows: readonly AgentSession[]): number =>
    rows.reduce((running, row) => running + measure(row), 0);

export type CellInput = {
  readonly buckets: readonly PeriodBucket<AgentSession>[];
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

/** A divisor that cannot be zero. `available` is what says whether the figure means anything. */
export const perCapitaDivisor = (population: PerCapita): number =>
  population.denominator === 0 ? 1 : population.denominator;

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
const MISSING_PERIOD: PeriodFigure = { key: "none", value: 0, partial: true };

const figureOf = (
  bucket: PeriodBucket<AgentSession> | undefined,
  value: number,
): PeriodFigure | undefined =>
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
    change: changeBetween({
      current: figureOf(months.current, current.value ?? 0) ?? MISSING_PERIOD,
      prior: figureOf(months.prior, prior.value ?? 0),
    }),
  };
};
