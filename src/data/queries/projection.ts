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
  projectDaily,
  projectPeriodSpend,
  type DailyProjection,
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

/** The month's attributed figures, as `totalSpend` reports them. Internal: what leaves this
 * module is the component breakdown below, so nothing downstream holds two shapes for one month. */
type MonthSpend = {
  readonly sessionCost: number;
  readonly seatCost: number;
  readonly total: number;
};

/**
 * **The four figures the page is built from, as four figures** (ticket 42).
 *
 * A reader cannot verify a projected total they are shown only the answer to, and the two
 * components are not interchangeable: one is extrapolated and the other is not (R-M5, R-D2).
 * Carrying them separately is what lets the tile print the arithmetic and what makes the
 * identity below a property of the ViewModel rather than of a component's layout.
 *
 * **`projectedTotal === projectedSession + seat`, by construction.** It is assigned as that sum
 * in `projectedComponents`, so the two cannot drift and the assertion in `queries.test.ts` is an
 * equality rather than a tolerance.
 */
export type ProjectionComponents = {
  /** Session Cost attributed over the month so far (R-M4). The only figure extrapolated. */
  readonly sessionToDate: number;
  /**
   * The month's **whole** seat charge. A seat is charged by whole months and never pro-rated
   * across elapsed days (R-M5, R-D2), so it is already its final figure and crosses unchanged.
   */
  readonly seat: number;
  /** `sessionToDate` over the elapsed share. `null` where no share has elapsed. */
  readonly projectedSession: number | null;
  /** `projectedSession + seat`. `null` with `projectedSession`, never a bare seat charge. */
  readonly projectedTotal: number | null;
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
  /** The two components of each figure, and the identity between them (ticket 42). */
  readonly components: ProjectionComponents;
  /** Two tiles: spend to date, and the month-end projection R-V8 labels "estimated". */
  readonly tiles: readonly TileViewModel[];
  /** Actual spend by day within the month, so the extrapolation sits beside what it read. */
  readonly chart: ChartViewModel;
  /**
   * Why the seat charge is beside the daily bars rather than in them (R-M5, R-D2), and — where
   * the month is being forecast — what the lighter bars stacked on them are (ticket 64).
   */
  readonly note: string;
  /** Populated where the month cannot be projected at all; both figures are then absent. */
  readonly unavailable: string | null;
};

/**
 * The chart's note, and the reason there is a note rather than a fourteenth bar.
 *
 * R-M5 charges a seat by whole months, so a daily series carrying it would apportion a monthly
 * fee across days — the invented precision R-M5 names. The seat charge is stated beside the
 * bars, at the grain it is actually charged at, and the bars stay session Cost alone.
 */
const SEAT_NOTE =
  "A seat is charged by whole months and is never pro-rated across days, so it is stated here " +
  "rather than spread over the bars.";

/**
 * **Why the chart has a second, lighter series** (ticket 64, R-N23).
 *
 * One sentence, and it names the method the panel has already stated rather than restating it:
 * the projected bars are the *same* elapsed-proportional division, drawn per day. It is said
 * only where the bars are actually drawn — a note claiming a forecast on a chart that has none
 * is worse than no note.
 */
const PROJECTED_NOTE =
  "Projected bars share the method above: today's spend rate, carried to the end of the month.";

/** The chart's two group keys. Presentation reads `ACTUAL_SERIES`/`PROJECTED_SERIES`, never a string. */
const ACTUAL_SERIES = "actual";
const PROJECTED_SERIES = "projected";

/** The two series' labels. R-V8's marker belongs to the forecast and to nothing beside it. */
const SERIES_LABELS: Readonly<Record<string, string>> = {
  [ACTUAL_SERIES]: "Session cost",
  [PROJECTED_SERIES]: "Projected (estimated)",
};

const NO_ELAPSED: Elapsed = { days: 0, totalDays: 0, fraction: 0 };

/** One civil day of the month: its identity, R-E2's flag, and what was attributed to it. */
type DaySpend = { readonly key: string; readonly partial: boolean; readonly actual: number };

/** The month's days and what was attributed to each, at the grain the forecast is computed on. */
const dailySpend = (
  context: PageContext,
  month: PeriodBucket<AgentSession>,
): readonly DaySpend[] => {
  const plan = planPeriods({
    timezone: context.data.organization.timezone,
    grain: "day",
    range: { start: month.startsOn, end: month.endsOn },
    now: context.params.now,
  });
  if (!plan.ok) return [];
  return bucketRows(plan.plan, month.rows).map((day) => ({
    key: day.key,
    partial: day.partial,
    actual: sessionCost(day.rows),
  }));
};

/**
 * **The two stacked series, bar by bar** (ticket 64).
 *
 * The `actual` cell is what a day cost; the `projected` cell is what the method says is still to
 * come on it. They are emitted for **every** civil day of the month, today and the ones still
 * ahead included — a day with no session is a zero bar, not a missing one, once the whole month
 * is being forecast, and a chart that skipped it would draw a shorter September than the one the
 * projection is over.
 *
 * The seat charge is in neither series (R-M5, R-D2): it is stated beside the bars in words.
 */
const cellsFor = (
  spend: readonly DaySpend[],
  forecast: DailyProjection | null,
): readonly { readonly bucket: string; readonly group: string; readonly value: number }[] => {
  if (!forecast) {
    return spend.map((day) => ({ bucket: day.key, group: ACTUAL_SERIES, value: day.actual }));
  }
  return forecast.days.flatMap((day) => [
    { bucket: day.day, group: ACTUAL_SERIES, value: day.actual },
    { bucket: day.day, group: PROJECTED_SERIES, value: day.projected },
  ]);
};

const dailyChart = (
  context: PageContext,
  spend: readonly DaySpend[],
  forecast: DailyProjection | null,
): ChartViewModel =>
  chartViewModel({
    title: "Daily session cost",
    rollUpLevel: "Organization",
    // Spend already attributed to a day, beside the remainder carried onto it. The two are
    // outside each other by construction and sum to the projected session cost exactly, which
    // is what R-V1 asks of a grouping before its geometry may stack.
    grouping: "projection_component",
    measure: "additive",
    buckets: spend.map((day) => context.label.bucket(day)),
    cells: cellsFor(spend, forecast),
    labelOf: (key) => SERIES_LABELS[key] ?? key,
    // R-V8 — which series is the forecast, as a fact. The lighter fill and the marker are copy.
    estimated: forecast ? PROJECTED_SERIES : undefined,
    bucketColumn: "Day",
  });

/**
 * **The daily forecast** (ticket 64) — `projectDaily`, over the same month, the same `now` and
 * the same rows the tile's figure was read off. `null` where the month has no basis to be
 * forecast from, which is the same condition that leaves `projectedTotal` absent: the chart then
 * draws the days it has and claims nothing about the ones it does not.
 */
const forecastOf = (
  context: PageContext,
  month: PeriodBucket<AgentSession> | undefined,
  spend: readonly DaySpend[],
): DailyProjection | null => {
  if (!month) return null;
  const result = projectDaily({
    period: { key: month.key, startsOn: month.startsOn, endsOn: month.endsOn },
    spend: spend.map((day) => ({ day: day.key, actual: day.actual })),
    now: context.params.now,
    timezone: context.data.organization.timezone,
  });
  return result.ok ? result.projection : null;
};

/**
 * **The chart and the sentence under it, decided together.**
 *
 * The note claims a forecast exactly when the chart draws one, which is why they leave this
 * module as one value rather than as two fields a caller pairs up. A month with no basis to be
 * projected from gets the seat sentence alone: a note about projected bars that are not there
 * would be the page describing a chart nobody is looking at.
 */
const chartAndNote = (
  context: PageContext,
  month: PeriodBucket<AgentSession> | undefined,
): { readonly chart: ChartViewModel; readonly note: string } => {
  const spend = month ? dailySpend(context, month) : [];
  const forecast = forecastOf(context, month, spend);
  return {
    chart: dailyChart(context, spend, forecast),
    note: forecast ? `${SEAT_NOTE} ${PROJECTED_NOTE}` : SEAT_NOTE,
  };
};

const figuresFor = (
  context: PageContext,
  month: PeriodBucket<AgentSession> | undefined,
): MonthSpend => {
  const period = month && seatBearingPeriod([month]);
  if (!period?.ok) return { sessionCost: 0, seatCost: 0, total: 0 };
  const spend = totalSpend(period.period, context.population, context.data.rateCards.seat.usd);
  return { sessionCost: spend.sessionCost, seatCost: spend.seatCost, total: spend.total };
};

const tilesFor = (input: {
  readonly period: BucketViewModel;
  readonly actual: MonthSpend;
  readonly components: ProjectionComponents;
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
    value: input.components.projectedTotal,
    unit: "usd",
    caption:
      input.components.projectedTotal === null ? "None of this period has elapsed yet." : null,
    period: input.period,
    change: {
      shown: false,
      reason: "no-prior-period",
      message: "A projection is a forecast of this month, not a comparison with another.",
      current: {
        key: input.period.key,
        value: input.components.projectedTotal ?? 0,
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
  actual: MonthSpend,
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
 * **The four components, and the identity between them** (ticket 42).
 *
 * `projectedTotal` is *assigned* the sum of the other two rather than read off a second total,
 * which is what makes `projectedTotal === projectedSession + seat` an identity of the ViewModel
 * instead of an agreement between two figures. Both projected fields are `null` together where
 * no share has elapsed: a projected total that was only the seat charge would read as a forecast
 * of a month nobody has spent anything in.
 */
const componentsOf = (
  projection: Projection | null,
  actual: MonthSpend,
): ProjectionComponents => {
  const extrapolated = projection?.projected ?? null;
  return {
    sessionToDate: actual.sessionCost,
    seat: actual.seatCost,
    projectedSession: extrapolated,
    projectedTotal: extrapolated === null ? null : extrapolated + actual.seatCost,
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

  const components = componentsOf(projection, actual);
  const daily = chartAndNote(context, month);

  return {
    orgSlug: params.orgSlug,
    period,
    elapsed: projection?.elapsed ?? NO_ELAPSED,
    method: projection?.method ?? "",
    incomplete: projection?.incomplete ?? period.partial,
    components,
    tiles: tilesFor({ period, actual, components }),
    chart: daily.chart,
    note: daily.note,
    // Set whenever there is no figure — a month outside the range, or one that has not begun.
    unavailable:
      components.projectedTotal === null
        ? "This period cannot be projected: there is no elapsed share to extrapolate from."
        : null,
  };
}
