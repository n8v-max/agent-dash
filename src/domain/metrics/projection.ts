// Projected cost — `spec.md` R-N23, R-N24, R-M1, `CONTEXT.md` § Metric Concepts, ticket 28.
// Tested by T-U21 in `projection.test.ts`.
//
// **Elapsed-proportional extrapolation, and nothing else.** Actual spend to date, divided by the
// share of the period that has elapsed. There is no model, no smoothing, no seasonality and no
// weighting: over authored fixture data every one of those would be fabricated precision, and
// the honest statement available here is the method plus the elapsed fraction.
//
// **R-N24 — no confidence band is produced.** Not "is not rendered": there is no field on the
// return type to carry one, no bound is computed, and T-U21 asserts the absence. A band over
// data an author wrote would be rigour-shaped decoration; the method statement and the elapsed
// share are what a reader actually needs, because *a projection at 10% elapsed and one at 90%
// are different claims*.
//
// **P5 — `now` is an argument.** Nothing here reads a clock. The fixture window ends
// 2026-09-08, so a wall-clock read would make every projection in the product change meaning
// the day after the window closes, and the tests would rot with it. The civil day `now` falls
// on is resolved through `periods.ts` in the Organization's timezone (R-M10), because the
// period being projected has civil-date edges and comparing an instant against them in UTC
// would move the boundary by up to a day.
//
// **`actual` is passed in, never computed here** (R-M4, R-T11, ADR-0005). This module divides;
// it does not price and it does not sum sessions.
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

import { civilDayIn, civilDaysBetween } from "../periods";
import { ratio, type Ratio } from "../ratio";

/**
 * The period being projected: its identity and its own civil edges, unclipped by any range.
 * `PeriodBucket` satisfies it structurally, so the month a chart draws and the month projected
 * are the same month read once.
 */
export type ProjectedPeriod = {
  readonly key: string;
  /** The period's first civil day, `YYYY-MM-DD`, in the Organization's timezone. */
  readonly startsOn: string;
  /** The period's last civil day, inclusive. */
  readonly endsOn: string;
};

export type ProjectionInput = {
  readonly period: ProjectedPeriod;
  /** Spend to date over the period — attributed upstream, summed upstream (R-M4). */
  readonly actual: number;
  /** An ISO 8601 instant, supplied by the caller (P5). Never read from a clock. */
  readonly now: string;
  /** The Organization's declared timezone. Period boundaries fall in it, never in UTC (R-M10). */
  readonly timezone: string;
};

/**
 * How much of the period has passed. Days rather than hours: the period's edges are civil days,
 * and a figure claiming to know the hour of a fixture would be inventing one.
 */
export type Elapsed = {
  /** Whole days elapsed, the current day included. Clamped into `1..totalDays` once the period starts. */
  readonly days: number;
  readonly totalDays: number;
  /** `days / totalDays`, in `0..1`. The share R-N23 shows beside the figure. */
  readonly fraction: number;
};

/**
 * **The projection. Note what is absent: there is no band, no interval, no low/high pair, and
 * no confidence figure of any kind** (R-N24).
 */
export type Projection = {
  readonly key: string;
  readonly actual: number;
  readonly elapsed: Elapsed;
  /**
   * `actual / elapsed.fraction` — the whole method. `null` before the period has begun, where
   * there is no elapsed share to divide by and therefore no basis for a claim (`ratio.ts`,
   * R-M18: a zero denominator is an absent reading, never a zero one).
   */
  readonly projected: Ratio;
  /** R-N23's incomplete-period flag: the period has not finished as of `now`. */
  readonly incomplete: boolean;
  /**
   * R-N23's one sentence. **Constant** — the method is the same claim at 10% elapsed and at
   * 90% elapsed, and it is the *elapsed fraction* beside it that differs. T-U21 asserts both,
   * which is only expressible because the two are separate fields.
   */
  readonly method: typeof PROJECTION_METHOD;
};

/** Why a projection has no basis. Closed, so a surface can map each to its own copy. */
export const PROJECTION_REJECTIONS = ["invalid-period", "invalid-now"] as const;
export type ProjectionRejectionReason = (typeof PROJECTION_REJECTIONS)[number];

export type ProjectionResult =
  | { readonly ok: true; readonly projection: Projection }
  | {
      readonly ok: false;
      readonly reason: ProjectionRejectionReason;
      readonly message: string;
    };

/**
 * The method, stated once (R-N23). It carries no figure, so it cannot vary with one — which is
 * what lets T-U21 assert that the method at 10% elapsed and at 90% elapsed is identical.
 */
export const PROJECTION_METHOD =
  "Spend to date, extrapolated to the end of the period in proportion to the period elapsed.";

const reject = (
  reason: ProjectionRejectionReason,
  message: string,
): ProjectionResult => ({ ok: false, reason, message });

/**
 * Days elapsed, the current day **included**: today's spend is already inside `actual`, so a
 * denominator that excluded today would divide a figure by a share that does not contain it and
 * over-project by one day's worth on day one. Before the period opens nothing has elapsed;
 * after it closes the whole of it has.
 */
const elapsedDays = (sinceStart: number, totalDays: number): number => {
  if (sinceStart < 0) return 0;
  return Math.min(sinceStart + 1, totalDays);
};

/**
 * **The projection** — R-N23, and the only extrapolation in the product.
 *
 * Once the period has closed the elapsed share is 1 and the projection is the actual figure
 * exactly: a finished month is measured, not forecast, and the arithmetic says so without a
 * branch claiming it.
 */
export function projectPeriodSpend(input: ProjectionInput): ProjectionResult {
  const { period } = input;
  const span = civilDaysBetween(period.startsOn, period.endsOn);
  if (span === undefined || span < 0) {
    return reject(
      "invalid-period",
      `${period.startsOn}..${period.endsOn} is not a period to project over`,
    );
  }

  const today = civilDayIn(input.timezone, input.now);
  const sinceStart = today === undefined ? undefined : civilDaysBetween(period.startsOn, today);
  if (sinceStart === undefined) {
    return reject(
      "invalid-now",
      `${input.now} is not an ISO 8601 instant in ${input.timezone}, so no share has elapsed`,
    );
  }

  const totalDays = span + 1;
  const days = elapsedDays(sinceStart, totalDays);
  const fraction = days / totalDays;
  return {
    ok: true,
    projection: {
      key: period.key,
      actual: input.actual,
      elapsed: { days, totalDays, fraction },
      projected: ratio(input.actual, fraction),
      incomplete: days < totalDays,
      method: PROJECTION_METHOD,
    },
  };
}
