// `/demo` — the summary (R-N4…R-N8). Four tiles, nothing below them.
//
// **Month-locked** (R-N6): Total spend does not exist below monthly grain (R-M5), and a tile
// that silently changed metric with the period is the failure the unaccepted-spend tile was cut
// to avoid. The period control offers month and nothing else, so this query reads month buckets
// and ignores the page grain entirely.
//
// **Every figure tile carries a change** (R-N7), subject to the change floor (R-M12) and C13's
// partial baseline — both `change.ts`'s decisions, carried here and never re-made. The fourth
// tile is not a figure tile and carries neither (C11).
//
// **The comparison reads outside the selection** (C12): `monthsOf` takes the prior month from
// `comparisonMonths`, so choosing a single month no longer leaves the page with nothing to
// compare against.

import type { Change } from "@/domain/change";
import {
  completedTaskKeys,
  seatBearingPeriod,
  totalSpend,
  totalSpendPerCompletedTask,
  type TotalSpend,
} from "@/domain/metrics/spend";
import type { PeriodBucket } from "@/domain/periods";
import { WORK_TYPE_KEYS, type AgentSession } from "@/domain/types";
import {
  chartViewModel,
  type BucketViewModel,
  type ChartViewModel,
  type FigureUnit,
} from "@/domain/viewmodel";
import type { Viewer } from "@/domain/access";
import type { ControlSet } from "../params";
import { pageContext, type PageContext } from "./context";
import {
  aggregationCells,
  bucketAxis,
  monthsOf,
  readingOf,
  type MonthReading,
} from "./panels";

/** R-N5 — a tile is itself the link to the page carrying its evidence, so it holds the href. */
type SummaryTileBase = {
  readonly key: string;
  readonly title: string;
  readonly href: string;
  readonly period: BucketViewModel;
};

/**
 * **Two kinds of tile, not one kind with optional halves** (C11).
 *
 * The fourth tile carries a breakdown and *no headline figure*: it was built from the Completed
 * Tasks tile's own reading, so `/demo` printed the same number and the same delta twice on the
 * page graded for the ten-second read. Modelled as a union rather than as a nullable `value`,
 * because `null` already means *withheld or undefined* on `TileViewModel` (R-A6) — reusing it
 * for "this tile has no figure by design" would make two different absences indistinguishable to
 * the component rendering them.
 */
export type SummaryTile =
  | (SummaryTileBase & { readonly kind: "breakdown"; readonly chart: ChartViewModel })
  | (SummaryTileBase & {
      readonly kind: "figure";
      readonly value: number | null;
      readonly unit: FigureUnit;
      readonly caption: string | null;
      readonly change: Change;
    });

export type SummaryPageViewModel = {
  readonly orgSlug: string;
  readonly orgName: string;
  /** The month reported, and R-E2's flag on it. September is unfinished in the committed window. */
  readonly period: BucketViewModel;
  /** The four tiles of R-N4, in that order. */
  readonly tiles: readonly SummaryTile[];
};

const spendOver = (
  bucket: PeriodBucket<AgentSession> | undefined,
  context: PageContext,
): TotalSpend<AgentSession> | null => {
  if (!bucket) return null;
  const period = seatBearingPeriod([bucket]);
  if (!period.ok) return null;
  return totalSpend(period.period, context.population, context.data.rateCards.seat.usd);
};

const completedTasks = (rows: readonly AgentSession[]): number => completedTaskKeys(rows).length;

/** A month with no seat-bearing period behind it reads as nothing at all. */
const NO_MONTH: MonthReading = { value: null };

type TileInput = {
  readonly key: string;
  readonly title: string;
  readonly unit: FigureUnit;
  readonly href: string;
  readonly value: number | null;
  readonly caption?: string | null;
  readonly change: Change;
  readonly period: BucketViewModel;
};

const tile = (input: TileInput): SummaryTile => ({
  kind: "figure",
  key: input.key,
  title: input.title,
  value: input.value,
  unit: input.unit,
  caption: input.caption ?? null,
  period: input.period,
  change: input.change,
  href: input.href,
});

/**
 * **R-N8's breakdown, over the reported month alone, unstacked** (C11).
 *
 * Two things changed here, and they are the same decision seen twice.
 *
 * **It does not partition, so it does not stack.** The old justification — every AgentSession
 * references exactly one WorkType — is true of *sessions*; this tile counts *Tasks*, and a Task's
 * sessions may span several WorkTypes. Measured on the committed fixture, August 2026: the slices
 * summed to 162 against the Completed Tasks tile's 150. Stacking asserted a whole the measure did
 * not have, which is what R-V1 exists to forbid. `partition: false` is therefore a domain fact
 * about (grouping × measure), not a styling retreat.
 *
 * **One bucket, so R-V5's ranking is the sort.** The series set is ranked by the measure across
 * the whole range (R-V5); with the range narrowed to the reported month, that ranking *is*
 * "longest first". No sort is written here, and none could disagree with the legend's order.
 */
const workTypeMix = (context: PageContext, month: PeriodBucket<AgentSession> | undefined) => {
  const buckets = month ? [month] : [];
  return chartViewModel({
    title: "Completed Jobs by template",
    rollUpLevel: "WorkType",
    grouping: "work_type",
    measure: "additive",
    buckets: bucketAxis(context, buckets),
    cells: aggregationCells({
      buckets,
      keysOf: (row) => [row.work_type],
      valueOf: (rows) => completedTasks(rows),
      // R-N8 — all five render; the cap engages only above five (R-V4), so no "Other" appears.
      groups: [...WORK_TYPE_KEYS],
    }),
    labelOf: (key) => context.label.workType(key),
    // C11 — WorkType partitions sessions, not Tasks. This tile counts Tasks.
    partition: false,
  });
};

/**
 * **`/demo`** — the summary. One call, four tiles, and the whole page's arithmetic done once.
 *
 * R-T16: `viewer` is the first parameter and there is no overload without it. It is producible
 * only by `resolveViewer`, so an unfiltered summary has no expression.
 */
export function summaryPage(viewer: Viewer, params: ControlSet): SummaryPageViewModel {
  const context = pageContext(viewer, params);
  const cost = monthsOf(context.view("cost"));
  const jobs = monthsOf(context.view("jobs"));
  const slug = params.orgSlug;

  const spend = readingOf(cost, (bucket) => ({ value: spendOver(bucket, context)?.total ?? null }));
  const tasks = readingOf(jobs, (bucket) => ({ value: completedTasks(bucket.rows) }));
  const ratio = readingOf(cost, (bucket) => {
    const total = spendOver(bucket, context);
    if (!total) return NO_MONTH;
    const reading = totalSpendPerCompletedTask(total);
    return reading.defined
      ? { value: reading.value }
      : { value: null, caption: reading.message };
  });

  const period = context.label.bucket(jobs.current ?? { key: params.range.end, partial: true });

  return {
    orgSlug: slug,
    orgName: context.data.organization.name,
    period,
    tiles: [
      tile({ key: "total-spend", title: "Total spend", unit: "usd", href: `/${slug}/spend`, period, ...spend }),
      tile({
        key: "completed-tasks",
        title: "Completed Jobs",
        unit: "count",
        href: `/${slug}/work`,
        period,
        ...tasks,
      }),
      tile({
        key: "cost-per-completed-task",
        title: "Cost per completed Job",
        unit: "usd_per_task",
        href: `/${slug}/spend`,
        period,
        ...ratio,
      }),
      {
        kind: "breakdown",
        key: "completed-tasks-by-work-type",
        title: "Completed Jobs by template",
        href: `/${slug}/work`,
        period,
        // C11 — no `...tasks`. Spreading the Completed Tasks reading here is what printed the
        // same figure and the same delta on two tiles side by side.
        chart: workTypeMix(context, jobs.current),
      },
    ],
  };
}
