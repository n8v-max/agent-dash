// `/demo` — the summary (R-N4…R-N8). Four tiles, nothing below them.
//
// **Month-locked** (R-N6): Total spend does not exist below monthly grain (R-M5), and a tile
// that silently changed metric with the period is the failure the unaccepted-spend tile was cut
// to avoid. The period control offers month and nothing else, so this query reads month buckets
// and ignores the page grain entirely.
//
// **Every tile carries a change figure** (R-N7), subject to the change floor (R-M12) — which is
// `change.ts`'s decision, carried here and never re-made.

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
  type TileViewModel,
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
export type SummaryTile = TileViewModel & {
  readonly href: string;
  /** R-N8's small stacked area. `null` on the three figure tiles. */
  readonly chart: ChartViewModel | null;
};

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
  readonly chart?: ChartViewModel | null;
};

const tile = (input: TileInput): SummaryTile => ({
  key: input.key,
  title: input.title,
  value: input.value,
  unit: input.unit,
  caption: input.caption ?? null,
  period: input.period,
  change: input.change,
  href: input.href,
  chart: input.chart ?? null,
});

const workTypeMix = (context: PageContext): ChartViewModel =>
  chartViewModel({
    title: "Completed Jobs by template",
    rollUpLevel: "WorkType",
    grouping: "work_type",
    // R-N8 — WorkType is a true partition of the sessions, so the geometry may assert one.
    measure: "additive",
    buckets: bucketAxis(context, context.view("jobs").months),
    cells: aggregationCells({
      buckets: context.view("jobs").months,
      keysOf: (row) => [row.work_type],
      valueOf: (rows) => completedTasks(rows),
      // R-N8 — all five render; the cap engages only above five (R-V4), so no "Other" appears.
      groups: [...WORK_TYPE_KEYS],
    }),
    labelOf: (key) => context.label.workType(key),
    partition: true,
  });

/**
 * **`/demo`** — the summary. One call, four tiles, and the whole page's arithmetic done once.
 *
 * R-T16: `viewer` is the first parameter and there is no overload without it. It is producible
 * only by `resolveViewer`, so an unfiltered summary has no expression.
 */
export function summaryPage(viewer: Viewer, params: ControlSet): SummaryPageViewModel {
  const context = pageContext(viewer, params);
  const cost = monthsOf(context.view("cost").months);
  const jobs = monthsOf(context.view("jobs").months);
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
      tile({
        key: "completed-tasks-by-work-type",
        title: "Completed Jobs by template",
        unit: "count",
        href: `/${slug}/work`,
        period,
        ...tasks,
        chart: workTypeMix(context),
      }),
    ],
  };
}
