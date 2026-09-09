// `/demo/spend` — what we spend, and what we get for it (R-N9, R-N10, R-N11).
//
// **The page opens with the ratio, not with Total spend** (R-N10): Total spend has already been
// read on the summary, and the ratio is the differentiator. The panel order below is R-N9's,
// and it is the order the ViewModel declares its fields in.
//
// **Two panels read month buckets whatever the page grain is** (R-M5, A25, R-N9.1). For Total
// spend a seat fee apportioned across days is invented precision, so `seatBearingPeriod` refuses
// anything finer than a month — the honest panel is one that shows months, not one that shows a
// rejection where a chart should be. For Cost by Repository it is legibility: five repositories
// over twenty-two weeks is a hundred and ten bars. Both carry the same one-line note.
//
// **At `subject=member` the panels the subject control reaches lose their time axis** (R-V12).
// Twenty Members capped to four plus "Other" is five lines crossing each other; ranked bars over
// the whole selected period is the same data as a reading. The *query* decides that — `form` is
// a domain fact on the ViewModel, like `stackable` — and `panels.ts` decides it once for the
// three panels, so no two of them can disagree.

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
  subjectAxis,
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
  /** Whole months the seat fee is charged over. Never fractional (R-D2). */
  readonly months: number;
  /** `seats × months` — the quantity the fee is charged per. 18 humans over 6 months is 108. */
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

/**
 * R-N9 panel 5 — Cost by Repository, at month grain whatever the page grain is (R-N9.1).
 *
 * It is a panel rather than a bare chart because it now carries the same qualification Total
 * spend does, and the note has to travel on the ViewModel: a panel that spelled it itself would
 * be a second answer to why the buckets on it are not the page's.
 */
export type CostByRepositoryPanel = {
  readonly chart: ChartViewModel;
  /** Why this panel is monthly whatever the page grain is. The same line Total spend carries. */
  readonly note: string;
};

export type SpendPageViewModel = {
  readonly orgSlug: string;
  /** C14 — which panels below are divided, and by how many. Copy is the component's. */
  readonly perCapita: PerCapitaReading;
  readonly costPerCompletedTask: ChartViewModel;
  readonly totalSpend: TotalSpendPanel;
  readonly costPerSession: CostPerSessionPanel;
  readonly costPerCompletedTaskByWorkType: ChartViewModel;
  readonly costByRepository: CostByRepositoryPanel;
  readonly adoption: AdoptionSection;
};

const costOf = (row: AgentSession): number => row.cost;

const SEAT_GROUPS = { session: "session", seat: "seat" } as const;

/**
 * **Why two of this page's panels read months whatever the page grain is** (R-M5, R-N9.1, A25).
 *
 * One sentence, carried by both, because it is one consequence: below a month neither figure is
 * honest. Total spend cannot exist there at all — a seat fee apportioned across days is invented
 * precision (R-M5) — and Cost by Repository can, but as twenty-two weeks of five bars, which is
 * a chart nobody reads. Each panel's own reason stays in its own copy; what is shared is the
 * grain, and it is written once so the two panels cannot drift into two different claims about
 * the same buckets.
 */
const MONTHLY_NOTE =
  "This panel reads months whatever the page grain is: a finer bucket would be either invented " +
  "precision or more bars than can be read, so the figure is reported at monthly grain and " +
  "coarser only.";

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
  months: 0,
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
    months: spend.months,
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
  const axis = subjectAxis(context, view, subject);
  const reading = (rows: readonly AgentSession[]): CostPerSession =>
    costPerSession({ key: "range", partial: false, rows }, outcome);

  return {
    chart: chartViewModel({
      title: "Cost per session",
      rollUpLevel: subject.rollUpLevel,
      grouping: subject.grouping,
      // An average is not a part of a whole, whatever it is grouped by (R-V1).
      measure: "ratio",
      // R-V12 — one bar per Member over the period; a series over the page's buckets otherwise.
      form: subject.form,
      buckets: axis.axis,
      cells: aggregationCells({
        buckets: axis.buckets,
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

/**
 * **R-N9 panel 5 — Cost by Repository, over months** (R-N9.1).
 *
 * It reads `view.months` rather than the page's own buckets, for the reason `MONTHLY_NOTE`
 * gives: at week grain over the committed window this panel drew twenty-two groups of five
 * bars, and five repositories × twenty-two weeks is a texture rather than a comparison. The
 * grain is fixed in the query, not in the panel — the same discipline Total spend already
 * follows (R-M5, A25), and the same sentence says so on both.
 */
const byRepository = (
  context: PageContext,
  months: readonly PeriodBucket<AgentSession>[],
  divisor: number,
): CostByRepositoryPanel => ({
  chart: chartViewModel({
    title: divisor === 1 ? "Cost by Repository" : "Cost by Repository, per Member",
    rollUpLevel: "Repository",
    // R-V1 — a Task's sessions may span repositories, so Repository is not a partition.
    grouping: "repository",
    measure: "additive",
    buckets: bucketAxis(context, months),
    cells: aggregationCells({
      buckets: months,
      keysOf: (row) => [row.repository_id],
      valueOf: (rows) => sumOf(costOf)(rows) / divisor,
    }),
    labelOf: (key) => context.label.repository(key),
    partition: false,
  }),
  note: MONTHLY_NOTE,
});

/**
 * **`/demo/spend`.** One call, seven panels and the rate card, over one load, one permission
 * filter and one bucketing (R-T16, R-T17).
 */
export function spendPage(viewer: Viewer, params: ControlSet): SpendPageViewModel {
  const context = pageContext(viewer, params);
  const view = context.view("cost");
  const subject = subjectGrouping(context, view, costOf);
  const axis = subjectAxis(context, view, subject);

  // C14 — the toggle divides only where a division states something. `available` is false over a
  // population of one, so a single-Member view is offered nothing rather than offered identity.
  const population = populationPerCapita(context);
  // R-M18 — `perCapitaDivisor` is `null` where there is nothing to divide by, so `on` is the
  // one place that decides, and `divisor` is 1 only where it multiplies nothing.
  const perMember = context.params.perCapita ? perCapitaDivisor(population) : null;
  const on = perMember !== null;
  const divisor = perMember ?? 1;

  return {
    orgSlug: params.orgSlug,
    perCapita: { on, denominator: population.denominator, available: population.available },
    costPerCompletedTask: chartViewModel({
      title: "Cost per completed Job",
      rollUpLevel: subject.rollUpLevel,
      grouping: subject.grouping,
      measure: "ratio",
      // R-V12 — the query chooses the form, and every panel under the subject control gets the
      // same one, so the page cannot draw a Member as bars here and as a line beside it.
      form: subject.form,
      buckets: axis.axis,
      cells: aggregationCells({
        buckets: axis.buckets,
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
    // R-N9.1 — months, whatever the page grain is, exactly as Total spend above.
    costByRepository: byRepository(context, view.months, divisor),
    adoption: adoptionSection(context),
  };
}
