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
import {
  aggregationCells,
  bucketAxis,
  perCapitaDivisor,
  populationPerCapita,
  subjectGrouping,
  sumOf,
} from "./panels";

/**
 * **C14 — per-capita, where the measure is money and adds up.**
 *
 * R-C1 declared a per-capita control for this page and no panel read it, so the control rendered
 * and changed nothing. It is wired to the two *additive money* panels — Total spend and Cost by
 * Repository — and deliberately not to the three ratios: Cost per completed Job, Cost per session
 * and the by-template breakdown are already normalised, and dividing a rate by a headcount states
 * nothing.
 *
 * **Total spend stays `additive` under the toggle**, unlike `work.ts`'s velocity panel which
 * becomes a `ratio`. The two are not inconsistent: session cost per Member and seat cost per
 * Member still sum exactly to total spend per Member, so the geometry's part-to-whole claim
 * survives the division and R-V1 has no reason to veto it. Declaring it a ratio would be a false
 * negative, and `stackable` is a domain fact rather than a preference either way.
 */
export type PerCapitaReading = {
  readonly on: boolean;
  /** R-M14 — active human Members. Service accounts hold no seat and are not in it. */
  readonly denominator: number;
  /** False where the population is one Member or none: there is nothing to divide out. */
  readonly available: boolean;
};

/** R-N9 panel 2 — Total spend, split into session Cost and Seat cost. */
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
  /** Why this panel is monthly whatever the page grain is. */
  readonly note: string;
};

/** R-N9 panel 3 — Cost per session, under the `accepted` filter. */
export type CostPerSessionPanel = {
  readonly chart: ChartViewModel;
  readonly outcome: OutcomeFilter;
  readonly range: CostPerSession;
};

export type SpendPageViewModel = {
  readonly orgSlug: string;
  /** C14 — which panels below are divided, and by how many. Copy is the component's. */
  readonly perCapita: PerCapitaReading;
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
  "days is invented precision, so the figure exists at monthly grain and coarser only.";

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

const totalSpendPanel = (context: PageContext, divisor: number): TotalSpendPanel => {
  const months = context.view("cost").months;
  const spend = spendOver(context, months) ?? NO_SPEND;
  const per = (value: number): number => value / divisor;

  return {
    chart: chartViewModel({
      title: divisor === 1 ? "Total spend" : "Total spend, per Member",
      rollUpLevel: "Organization",
      // R-M1/R-M5 — session Cost and Seat cost sit outside each other and sum to Total spend
      // exactly, so this is a partition and the geometry may assert one (R-V1).
      grouping: "cost_component",
      measure: "additive",
      buckets: bucketAxis(context, months),
      cells: seatCells(context, months).map((cell) => ({ ...cell, value: per(cell.value) })),
      labelOf: (key) => (key === SEAT_GROUPS.seat ? "Seat cost" : "Session cost"),
      partition: true,
    }),
    sessionCost: per(spend.sessionCost),
    seatCost: per(spend.seatCost),
    total: per(spend.total),
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

const byRepository = (
  context: PageContext,
  buckets: readonly PeriodBucket<AgentSession>[],
  divisor: number,
) =>
  chartViewModel({
    title: divisor === 1 ? "Cost by Repository" : "Cost by Repository, per Member",
    rollUpLevel: "Repository",
    // R-V1 — a Task's sessions may span repositories, so Repository is not a partition.
    grouping: "repository",
    measure: "additive",
    buckets: bucketAxis(context, buckets),
    cells: aggregationCells({
      buckets,
      keysOf: (row) => [row.repository_id],
      valueOf: (rows) => sumOf(costOf)(rows) / divisor,
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

  // C14 — the toggle divides only where a division states something. `available` is false over a
  // population of one, so a single-Member view is offered nothing rather than offered identity.
  const population = populationPerCapita(context);
  const on = context.params.perCapita && population.available;
  const divisor = on ? perCapitaDivisor(population) : 1;

  return {
    orgSlug: params.orgSlug,
    perCapita: { on, denominator: population.denominator, available: population.available },
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
    totalSpend: totalSpendPanel(context, divisor),
    costPerSession: costPerSessionPanel(context),
    costPerCompletedTaskByWorkType: byWorkType(context, view.buckets),
    costByRepository: byRepository(context, view.buckets, divisor),
    adoption: adoptionSection(context),
  };
}
