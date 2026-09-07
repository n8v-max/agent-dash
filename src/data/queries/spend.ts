// `/demo/spend` — what we spend, and what we get for it (R-N9, R-N10, R-N11).
//
// **The page opens with the ratio, not with Total spend** (R-N10): Total spend has already been
// read on the summary, and the ratio is the differentiator. The panel order below is R-N9's,
// and it is the order the ViewModel declares its fields in.
//
// **Total spend reads month buckets whatever the page grain is** (R-M5, A25). A seat fee
// apportioned across days is invented precision, so `seatBearingPeriod` refuses anything finer
// than a month — which means the honest panel is one that shows months, not one that shows a
// rejection where a chart should be. The page grain still drives every other panel.

import type { Viewer } from "@/domain/access";
import {
  completedTaskKeys,
  costPerSession,
  seatBearingPeriod,
  sessionCost,
  totalSpend,
  type CostPerSession,
  type TotalSpend,
  type OutcomeFilter,
} from "@/domain/metrics/spend";
import type { PeriodBucket } from "@/domain/periods";
import { WORK_TYPE_KEYS, type AgentSession } from "@/domain/types";
import { chartViewModel, type Cell, type ChartViewModel } from "@/domain/viewmodel";
import type { ControlSet } from "../params";
import { adoptionSection, type AdoptionSection } from "./adoption";
import { pageContext, type PageContext } from "./context";
import { aggregationCells, bucketAxis, subjectGrouping, sumOf } from "./panels";

/** R-N9 panel 2 — Total spend, split into session Cost and Seat cost (R-M5). */
export type TotalSpendPanel = {
  readonly chart: ChartViewModel;
  readonly sessionCost: number;
  readonly seatCost: number;
  readonly total: number;
  /** Active human Members. A service account holds no seat (R-M5, R-M14). */
  readonly seats: number;
  readonly seatMonths: number;
  /** `seatCost / total` — R-D4's headline. `null` over a period that cost nothing. */
  readonly seatShare: number | null;
  readonly partial: boolean;
  /** Why this panel is monthly whatever the page grain is (R-M5). */
  readonly note: string;
};

/** R-N9 panel 3 — Cost per session, under the `accepted` filter (R-M1). */
export type CostPerSessionPanel = {
  readonly chart: ChartViewModel;
  readonly outcome: OutcomeFilter;
  readonly range: CostPerSession;
};

export type SpendPageViewModel = {
  readonly orgSlug: string;
  readonly costPerCompletedTask: ChartViewModel;
  readonly totalSpend: TotalSpendPanel;
  readonly costPerSession: CostPerSessionPanel;
  readonly costPerCompletedTaskByWorkType: ChartViewModel;
  readonly costByRepository: ChartViewModel;
  readonly adoption: AdoptionSection;
};

const costOf = (row: AgentSession): number => row.cost;

const SEAT_GROUPS = { session: "session", seat: "seat" } as const;

const MONTHLY_NOTE =
  "Total spend is reported monthly whatever the page grain is: a seat fee apportioned across " +
  "days is invented precision, so the figure exists at monthly grain and coarser only (R-M5).";

/**
 * **Cost per completed Task, per bucket.** The join, one bucket at a time: every session's cost
 * is in the numerator and only Completed Tasks are in the denominator, so waste raises it.
 *
 * A bucket holding spend and no Completed Task has no reading — `null`, so no cell is emitted
 * and nothing is drawn at zero, which would claim the work was free rather than unfinished.
 */
const ratioOf = (rows: readonly AgentSession[]): number | null => {
  const completed = completedTaskKeys(rows).length;
  return completed === 0 ? null : sessionCost(rows) / completed;
};

/** What a period with no month in it reads as: nothing, rather than a missing panel. */
const NO_SPEND = {
  sessionCost: 0,
  seatCost: 0,
  total: 0,
  seats: 0,
  seatMonths: 0,
  seatShare: null,
  partial: false,
} as const;

const spendOver = (
  context: PageContext,
  months: readonly PeriodBucket<AgentSession>[],
): TotalSpend<AgentSession> | null => {
  const period = seatBearingPeriod(months);
  return period.ok
    ? totalSpend(period.period, context.population, context.data.rateCards.seat.usd)
    : null;
};

const seatCells = (
  context: PageContext,
  months: readonly PeriodBucket<AgentSession>[],
): readonly Cell[] =>
  months.flatMap((bucket) => {
    const figure = spendOver(context, [bucket]);
    if (!figure) return [];
    return [
      { bucket: bucket.key, group: SEAT_GROUPS.session, value: figure.sessionCost },
      { bucket: bucket.key, group: SEAT_GROUPS.seat, value: figure.seatCost },
    ];
  });

const totalSpendPanel = (context: PageContext): TotalSpendPanel => {
  const months = context.view("cost").months;
  const spend = spendOver(context, months) ?? NO_SPEND;

  return {
    chart: chartViewModel({
      title: "Total spend",
      rollUpLevel: "Organization",
      // R-M1/R-M5 — session Cost and Seat cost sit outside each other and sum to Total spend
      // exactly, so this is a partition and the geometry may assert one (R-V1).
      grouping: "cost_component",
      measure: "additive",
      buckets: bucketAxis(context, months),
      cells: seatCells(context, months),
      labelOf: (key) => (key === SEAT_GROUPS.seat ? "Seat cost" : "Session cost"),
      partition: true,
    }),
    sessionCost: spend.sessionCost,
    seatCost: spend.seatCost,
    total: spend.total,
    seats: spend.seats,
    seatMonths: spend.seatMonths,
    seatShare: spend.seatShare,
    partial: spend.partial,
    note: MONTHLY_NOTE,
  };
};

const costPerSessionPanel = (context: PageContext): CostPerSessionPanel => {
  const view = context.view("cost");
  const outcome = context.params.accepted;
  const subject = subjectGrouping(context, view, costOf);
  const reading = (rows: readonly AgentSession[]): CostPerSession =>
    costPerSession({ key: "range", partial: false, rows }, outcome);

  return {
    chart: chartViewModel({
      title: "Cost per session",
      rollUpLevel: subject.rollUpLevel,
      grouping: subject.grouping,
      // An average is not a part of a whole, whatever it is grouped by (R-V1).
      measure: "ratio",
      buckets: bucketAxis(context, view.buckets),
      cells: aggregationCells({
        buckets: view.buckets,
        keysOf: subject.keysOf,
        valueOf: (rows) => reading(rows).value,
      }),
      labelOf: subject.labelOf,
      partition: subject.partition,
      overlapNote: subject.overlapNote,
    }),
    outcome,
    range: reading(view.rows),
  };
};

const byWorkType = (context: PageContext, buckets: readonly PeriodBucket<AgentSession>[]) =>
  chartViewModel({
    title: "Cost per completed Job by template",
    rollUpLevel: "WorkType",
    grouping: "work_type",
    // WorkType partitions the sessions; it does **not** partition a ratio, and five ratios do
    // not add up to an Organization ratio. Not stackable (R-V1).
    measure: "ratio",
    buckets: bucketAxis(context, buckets),
    cells: aggregationCells({
      buckets,
      keysOf: (row) => [row.work_type],
      valueOf: ratioOf,
      // Every WorkType renders unless the page's own filter narrowed to one: a forced series of
      // zeros beside a filter a viewer set themselves reads as a rendering fault.
      groups: context.params.workType ? [context.params.workType] : [...WORK_TYPE_KEYS],
    }),
    labelOf: (key) => context.label.workType(key),
    partition: true,
  });

const byRepository = (context: PageContext, buckets: readonly PeriodBucket<AgentSession>[]) =>
  chartViewModel({
    title: "Cost by Repository",
    rollUpLevel: "Repository",
    // R-V1 — a Task's sessions may span repositories, so Repository is not a partition.
    grouping: "repository",
    measure: "additive",
    buckets: bucketAxis(context, buckets),
    cells: aggregationCells({
      buckets,
      keysOf: (row) => [row.repository_id],
      valueOf: sumOf(costOf),
    }),
    labelOf: (key) => context.label.repository(key),
    partition: false,
  });

/**
 * **`/demo/spend`.** One call, seven panels and the rate card, over one load, one permission
 * filter and one bucketing (R-T16, R-T17).
 */
export function spendPage(viewer: Viewer, params: ControlSet): SpendPageViewModel {
  const context = pageContext(viewer, params);
  const view = context.view("cost");
  const subject = subjectGrouping(context, view, costOf);

  return {
    orgSlug: params.orgSlug,
    costPerCompletedTask: chartViewModel({
      title: "Cost per completed Job",
      rollUpLevel: subject.rollUpLevel,
      grouping: subject.grouping,
      measure: "ratio",
      buckets: bucketAxis(context, view.buckets),
      cells: aggregationCells({
        buckets: view.buckets,
        keysOf: subject.keysOf,
        valueOf: ratioOf,
      }),
      labelOf: subject.labelOf,
      partition: subject.partition,
      overlapNote: subject.overlapNote,
    }),
    totalSpend: totalSpendPanel(context),
    costPerSession: costPerSessionPanel(context),
    costPerCompletedTaskByWorkType: byWorkType(context, view.buckets),
    costByRepository: byRepository(context, view.buckets),
    adoption: adoptionSection(context),
  };
}
