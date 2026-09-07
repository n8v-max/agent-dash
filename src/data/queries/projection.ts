// `/demo/projection` — where the current month lands (R-N23, R-N24, R-N25).
//
// **The method is stated, the elapsed fraction is shown as a share, and the incomplete-period
// flag is present** (R-N23). All three come off `metrics/projection.ts`, which is where the
// extrapolation lives; this module is orchestration — it decides which period is being
// projected and what "spend to date" is over it.
//
// **The seat charge is not extrapolated.** R-M5 charges a seat by whole months and R-D2 forbids
// pro-rating one across elapsed days, so a month's seat cost is already its final figure on day
// one. Only session Cost is elapsed-proportional. Extrapolating the total would inflate the
// projection by the seat fee's own reciprocal-of-elapsed, which would be a forecast of a figure
// that is not forecast at all.
//
// **R-N24 — no confidence band**, in the domain module and therefore here: there is no field on
// this ViewModel that could carry one.
//
// **R-N25 — nothing else in the product depends on this page.**

import type { Viewer } from "@/domain/access";
import {
  projectPeriodSpend,
  type Elapsed,
  type Projection,
} from "@/domain/metrics/projection";
import { seatBearingPeriod, sessionCost, totalSpend } from "@/domain/metrics/spend";
import { bucketRows, planPeriods, type PeriodBucket } from "@/domain/periods";
import type { AgentSession } from "@/domain/types";
import {
  chartViewModel,
  type BucketViewModel,
  type ChartViewModel,
  type TileViewModel,
} from "@/domain/viewmodel";
import type { ControlSet } from "../params";
import { pageContext, type PageContext } from "./context";

export type ProjectionFigures = {
  readonly sessionCost: number;
  readonly seatCost: number;
  readonly total: number;
};

export type ProjectionPageViewModel = {
  readonly orgSlug: string;
  /** The month being projected, carrying R-E2's flag — it is unfinished, which is the point. */
  readonly period: BucketViewModel;
  /** R-N23 — the share of the period elapsed, as days over days and as a fraction. */
  readonly elapsed: Elapsed;
  /** R-N23's one sentence, constant: the method does not change with the elapsed share. */
  readonly method: string;
  /** R-N23's incomplete-period flag. */
  readonly incomplete: boolean;
  readonly actual: ProjectionFigures;
  /** `null` before any of the period has elapsed — there is no basis, so there is no figure. */
  readonly projected: ProjectionFigures | null;
  /** Two tiles: spend to date, and the month-end projection R-V8 labels "estimated". */
  readonly tiles: readonly TileViewModel[];
  /** Actual spend by day within the month, so the extrapolation sits beside what it read. */
  readonly chart: ChartViewModel;
  /** Why the seat charge is not extrapolated (R-M5, R-D2). */
  readonly note: string;
  /** Populated where the month cannot be projected at all; both figures are then absent. */
  readonly unavailable: string | null;
};

const SEAT_NOTE =
  "Only session Cost is extrapolated. A seat is charged by whole months and is never pro-rated " +
  "across elapsed days (R-M5), so this month's seat cost is already its final figure.";

const NO_ELAPSED: Elapsed = { days: 0, totalDays: 0, fraction: 0 };

const dailyChart = (
  context: PageContext,
  month: PeriodBucket<AgentSession> | undefined,
): ChartViewModel => {
  const plan =
    month &&
    planPeriods({
      timezone: context.data.organization.timezone,
      grain: "day",
      range: { start: month.startsOn, end: month.endsOn },
      now: context.params.now,
    });
  const days = plan?.ok ? bucketRows(plan.plan, month?.rows ?? []) : [];

  return chartViewModel({
    title: "Actual spend to date",
    rollUpLevel: "Organization",
    // One series over one population: there is no grouping, so there is nothing to stack.
    grouping: "organization",
    measure: "additive",
    buckets: days.map((day) => context.label.bucket(day)),
    cells: days
      .filter((day) => day.rows.length > 0)
      .map((day) => ({ bucket: day.key, group: "actual", value: sessionCost(day.rows) })),
    labelOf: () => "Session cost",
    bucketColumn: "Day",
  });
};

const figuresFor = (
  context: PageContext,
  month: PeriodBucket<AgentSession> | undefined,
): ProjectionFigures => {
  const period = month && seatBearingPeriod([month]);
  if (!period?.ok) return { sessionCost: 0, seatCost: 0, total: 0 };
  const spend = totalSpend(period.period, context.population, context.data.rateCards.seat.usd);
  return { sessionCost: spend.sessionCost, seatCost: spend.seatCost, total: spend.total };
};

const tilesFor = (input: {
  readonly period: BucketViewModel;
  readonly actual: ProjectionFigures;
  readonly projected: ProjectionFigures | null;
}): readonly TileViewModel[] => [
  {
    key: "spend-to-date",
    title: "Spend to date",
    value: input.actual.total,
    unit: "usd",
    caption: null,
    period: input.period,
    // R-M12 is about period-over-period movement; this page compares a month with itself, so
    // there is no prior period and the floor suppresses on that arm rather than inventing one.
    change: {
      shown: false,
      reason: "no-prior-period",
      message: "This page reports one month against its own elapsed share, not against another.",
      current: { key: input.period.key, value: input.actual.total, partial: input.period.partial },
      prior: null,
      incomplete: input.period.partial,
    },
  },
  {
    key: "projected-cost",
    // R-V8 — **"Estimated"** belongs to this figure alone, and the label is copy: it is applied
    // in `components/`, not here.
    title: "Projected month-end spend",
    value: input.projected?.total ?? null,
    unit: "usd",
    caption: input.projected ? null : "None of this period has elapsed yet.",
    period: input.period,
    change: {
      shown: false,
      reason: "no-prior-period",
      message: "A projection is a forecast of this month, not a comparison with another.",
      current: {
        key: input.period.key,
        value: input.projected?.total ?? 0,
        partial: input.period.partial,
      },
      prior: null,
      incomplete: true,
    },
  },
];

const projectionOf = (
  context: PageContext,
  month: PeriodBucket<AgentSession> | undefined,
  actual: ProjectionFigures,
): Projection | null => {
  if (!month) return null;
  const result = projectPeriodSpend({
    period: { key: month.key, startsOn: month.startsOn, endsOn: month.endsOn },
    // Only session Cost is extrapolated (R-M5, R-D2) — the seat charge is added back whole.
    actual: actual.sessionCost,
    now: context.params.now,
    timezone: context.data.organization.timezone,
  });
  return result.ok ? result.projection : null;
};

/**
 * The projected total: the extrapolated session Cost with the month's whole seat charge added
 * back. `null` where no share has elapsed, so nothing downstream can print a figure that had no
 * basis.
 */
const projectedFigures = (
  projection: Projection | null,
  actual: ProjectionFigures,
): ProjectionFigures | null => {
  const extrapolated = projection?.projected;
  if (extrapolated === undefined || extrapolated === null) return null;
  return {
    sessionCost: extrapolated,
    seatCost: actual.seatCost,
    total: extrapolated + actual.seatCost,
  };
};

/**
 * **`/demo/projection`.** One call: the month, the elapsed share, the method, and the two
 * figures.
 *
 * R-T16: `viewer` first, and there is no callable form without it.
 */
export function projectionPage(viewer: Viewer, params: ControlSet): ProjectionPageViewModel {
  const context = pageContext(viewer, params);
  const month = context.view("cost").months.at(-1);
  const actual = figuresFor(context, month);
  const projection = projectionOf(context, month, actual);
  const period = context.label.bucket(month ?? { key: params.range.end, partial: true });

  const projected = projectedFigures(projection, actual);

  return {
    orgSlug: params.orgSlug,
    period,
    elapsed: projection?.elapsed ?? NO_ELAPSED,
    method: projection?.method ?? "",
    incomplete: projection?.incomplete ?? period.partial,
    actual,
    projected,
    tiles: tilesFor({ period, actual, projected }),
    chart: dailyChart(context, month),
    note: SEAT_NOTE,
    // Set whenever there is no figure — a month outside the range, or one that has not begun.
    unavailable: projected
      ? null
      : "This period cannot be projected: there is no elapsed share to extrapolate from.",
  };
}
