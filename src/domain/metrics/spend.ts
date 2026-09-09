// Spend — `CONTEXT.md` § Models & Money (Cost, Seat cost, Total spend) and § Metric Concepts,
// `spec.md` R-M1 / R-M4 / R-M5 / R-D2 / R-D4 / R-D10, A25, A26, `technical-spec.md` § 3.2 and
// R-T11, ADR-0005, ticket 24. Tested by T-U12 and T-U13.
//
// Three rules shape every figure in this file, and each is arranged as a property of the
// construction rather than as a rule a caller has to remember:
//
//   * **R-M4 / R-T11 — Cost is READ off the session row, never computed.** The platform's
//     billing system prices each session against the two rate cards and hands the figure over;
//     this application aggregates it and prices nothing (ADR-0005). There is therefore **no
//     rate-card arithmetic here**: no token count, no machine-allocation duration, no model and
//     no `machine_spec` is reachable from any type in this module. `CostBearing` is a single
//     `cost` field, and the only thing done to it is addition.
//
//     The one price that *is* multiplied is the **seat fee**, and it is a parameter rather than
//     a card lookup: a subscription is a fee per seat per month, not a measured quantity being
//     priced. `RateCards.seat.usd` is read by the caller at the data boundary and passed in.
//
//   * **R-M5 / A25 — Total spend is session Cost + Seat cost, at MONTHLY grain and coarser
//     ONLY.** Apportioning a monthly fee across days is invented precision, so a day-grain or
//     week-grain Total spend is not merely undisplayed: it has **no representation**. The gate
//     follows the branded-plan precedent `periods.ts` set for R-M11 — `totalSpend` accepts only
//     a `SeatBearingPeriod`, the type is keyed on a module-private symbol so no caller can
//     write one, and the only expression in the program that produces one is
//     `seatBearingPeriod` returning `ok` over monthly buckets. "Coarser" needs no new grain:
//     n monthly buckets are one seat-bearing period charging n whole months.
//
//     **Seats attach to `human` Members only** — a service account holds none, so it sizes no
//     seat charge, exactly as it sizes no per-capita denominator (R-M14, `aggregate.ts`).
//
//   * **R-D2 / A26 — a partial period is flagged, never pro-rated.** April is 19 days of
//     sessions carrying a whole month's seat charge, so its Cost per completed Task is inflated
//     **by construction**; the flag is what stops that reading as a finding. `months` is a count
//     of whole months and there is nothing here that could divide it by a day count. `partial`
//     travels from the bucket onto every reading, and is carried, never acted on.
//
//     **A seat-month is a month held by one seat**, so the quantity the fee is charged per is
//     `seats × months` and `TotalSpend` reports it as `seatMonths`. The period's own field is
//     `months`: it was called `seatMonths` while holding a bare month count, and the panel that
//     printed it read "18 human Members · 6 seat-months" over a figure that is 108 of them.
//
// **Cost per completed Task is the product's central claim** (`CONTEXT.md` § Metric Concepts):
// Total Cost over a period ÷ Completed Tasks in it. A **Completed Task is a Task with at least
// one accepted session**, so a non-accepted session's cost sits in the numerator while its Task
// contributes nothing to the denominator — waste raises the figure, which is the whole point.
// Tasks are counted on `task_key` alone, because a Task may span repositories and work types
// and keying on either would count one Task several times.
//
// **A period with spend and zero Completed Tasks does not divide by zero.** It returns a
// discriminated `defined: false` reading carrying no `value` at all, on the precedent
// `change.ts` set for the suppressed change: a renderer that has not narrowed has no figure in
// scope to print, so the failure the rule exists to prevent — `Infinity`, or `NaN` from 0 ÷ 0 —
// is unrepresentable rather than guarded. `null` would have been enough for a viewer and not
// enough for a type.
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

import { isSeatHolder, type MemberFacts } from "../aggregate";
import type { PeriodGrain } from "../periods";
import { ratio, type Ratio } from "../ratio";

// --- What a spend figure reads --------------------------------------------------------------

/**
 * R-M4 / R-T11 — the **only** field this module reads money from, and the only money field
 * `AgentSession` has. It is attributed upstream and stored; nothing here derives it.
 */
export type CostBearing = { readonly cost: number };

/** R-M3 — a session's only outcome field. There is no terminal status to consult. */
export type OutcomeBearing = { readonly accepted: boolean };

/** The Task a session attempted, `owner/repo#number` — external, never absent, never synthetic. */
export type TaskBearing = { readonly task_key: string };

/** Everything the join needs from a row. `AgentSession` satisfies it structurally. */
export type SpendRow = CostBearing & OutcomeBearing & TaskBearing;

/**
 * The minimum a spend reading needs from a period: its identity, R-E2's flag, and its rows.
 * `PeriodBucket<Row>` satisfies it structurally, so the figure and the chart column are the
 * same rows read once.
 */
export type SpendPeriod<Row> = {
  /** Stable identity — `2026-04`, `2026-04..2026-09`. Never an index (R-T8). */
  readonly key: string;
  /** R-E2 — clipped by the range at either end, or unfinished. Carried, never acted on. */
  readonly partial: boolean;
  readonly rows: readonly Row[];
};

/** A period that still carries the grain the R-M5 gate reads. `PeriodBucket<Row>` satisfies it. */
export type GrainedPeriod<Row> = SpendPeriod<Row> & { readonly grain: PeriodGrain };

// --- The gate: where "monthly and coarser only" is made unrepresentable (R-M5, A25) ---------

/**
 * The grains a seat fee may be charged against. `day` and `week` are absent **by decision**,
 * not by omission: a control reads this list and offers nothing finer.
 */
export const SEAT_BEARING_GRAINS = ["month"] as const;
export type SeatBearingGrain = (typeof SEAT_BEARING_GRAINS)[number];

/**
 * Module-private, and deliberately not exported. A `SeatBearingPeriod` is therefore not
 * structurally forgeable: no caller can write this key, so no caller can hand `totalSpend` a
 * period the gate refused. That is R-M5 made unrepresentable rather than warned about — there
 * is no "render it anyway" path to forget to guard.
 */
const SEAT_BEARING: unique symbol = Symbol("spend/seat-bearing");

/** A checked run of whole months. The only input `totalSpend` accepts. */
export type SeatBearingPeriod<Row> = SpendPeriod<Row> & {
  /**
   * **Whole** months charged. Never fractional: R-D2 forbids pro-rating a partial month.
   *
   * It is `months`, not `seatMonths`: it counts *months*, and one seat is charged for each of
   * them. A seat-month is a month **held by one seat**, so the seat-month count over a population
   * is `seats × months` — 18 human Members over 6 months is 108, not 6. `TotalSpend.seatMonths`
   * below is that product, and this field was carrying its name while holding one of its factors.
   */
  readonly months: number;
  readonly [SEAT_BEARING]: true;
};

/** Why a request holds no seat charge. Closed, so a control can map each to its own copy. */
export const SEAT_REJECTIONS = ["no-period", "grain-is-finer-than-monthly"] as const;
export type SeatRejectionReason = (typeof SEAT_REJECTIONS)[number];

export type SeatRejection = {
  readonly ok: false;
  readonly reason: SeatRejectionReason;
  readonly message: string;
  /** The grains that *do* carry a seat charge — what the control offers instead. */
  readonly available: readonly SeatBearingGrain[];
};

export type SeatBearingResult<Row> =
  | { readonly ok: true; readonly period: SeatBearingPeriod<Row> }
  | SeatRejection;

const reject = (reason: SeatRejectionReason, message: string): SeatRejection => ({
  ok: false,
  reason,
  message,
  available: SEAT_BEARING_GRAINS,
});

/** `2026-04` for one month; `2026-04..2026-09` for a run. Month keys sort chronologically. */
const spanKey = (keys: readonly string[]): string => {
  const sorted = [...new Set(keys)].sort((left, right) => left.localeCompare(right));
  return sorted.length === 1 ? sorted[0] : `${sorted[0]}..${sorted[sorted.length - 1]}`;
};

/**
 * **The gate.** One or more monthly buckets become one seat-bearing period; anything finer has
 * no seat charge and therefore no Total spend (R-M5, A25).
 *
 * "Monthly grain **and coarser**" needs no coarser grain to exist: six monthly buckets are one
 * period charging six whole months, which is how the window-wide figure is reached. Months are
 * counted by **distinct key**, so a bucket list holding the same month twice cannot charge for
 * it twice.
 */
export function seatBearingPeriod<Row>(
  buckets: readonly GrainedPeriod<Row>[],
): SeatBearingResult<Row> {
  if (buckets.length === 0) {
    return reject("no-period", "a seat charge needs at least one monthly period (R-M5)");
  }

  const finer = buckets.find((bucket) => bucket.grain !== "month");
  if (finer) {
    return reject(
      "grain-is-finer-than-monthly",
      `${finer.key} is at ${finer.grain} grain; apportioning a monthly seat fee across ` +
        "days is invented precision, so Total spend is available at monthly grain and " +
        "coarser only (R-M5, A25)",
    );
  }

  const keys = buckets.map((bucket) => bucket.key);
  return {
    ok: true,
    period: {
      key: spanKey(keys),
      months: new Set(keys).size,
      // R-E2 — one partial month makes the run partial. Flagged, never pro-rated (R-D2).
      partial: buckets.some((bucket) => bucket.partial),
      rows: buckets.flatMap((bucket) => bucket.rows),
      [SEAT_BEARING]: true,
    },
  };
}

// --- Session Cost, aggregated (R-M4) --------------------------------------------------------

/** Attributed costs summed. The only arithmetic this module performs on money off a row. */
export const sessionCost = (rows: readonly CostBearing[]): number =>
  rows.reduce((running, row) => running + row.cost, 0);

// --- Seats (R-M5) ---------------------------------------------------------------------------

/**
 * The Members a seat fee is charged for (R-M5) — `human` only; a service account holds none.
 *
 * The predicate is `aggregate.ts`'s, imported rather than restated, so the seat charge and R-M14's
 * per-capita denominator cannot come to different conclusions about how many people the
 * Organization pays for.
 */
export const seatHolders = (members: readonly MemberFacts[]): readonly MemberFacts[] =>
  members.filter(isSeatHolder);

// --- Total spend (R-M1, R-M5, A25) ----------------------------------------------------------

/**
 * The only figure that represents what the Organization actually pays. It rolls up to Member,
 * Team and Organization by being handed the rows and the population of each.
 */
export type TotalSpend<Row> = SpendPeriod<Row> & {
  /** Attributed session Cost over the period. Token and machine cost, already blended. */
  readonly sessionCost: number;
  /** `seatMonths × fee`, i.e. `seats × months × fee`. Never pro-rated by elapsed days (R-D2). */
  readonly seatCost: number;
  readonly total: number;
  /** Active **human** Members. Service accounts hold no seat. */
  readonly seats: number;
  /** Whole months in the period. One seat is charged for each of them. */
  readonly months: number;
  /**
   * **`seats × months` — the quantity the seat fee is charged per.** One seat-month is one month
   * held by one seat, so a population of 18 human Members over 6 months holds 108 of them, and
   * `seatCost` is exactly `seatMonths × fee`. It is stated because the panel says it: a subtitle
   * reading "18 human Members · 6 seat-months" put a month count under a seat-month label, which
   * is out by the size of the Organization.
   */
  readonly seatMonths: number;
  /**
   * `seatCost / total` — R-D4's headline, and what makes a low-usage Member legible. `null`
   * over a period that cost nothing at all, which is the only way the total can be zero
   * (`ratio.ts`, R-M18).
   */
  readonly seatShare: Ratio;
};

/**
 * **Total spend** — session Cost + Seat cost (R-M1, R-M5).
 *
 * Unreachable below monthly grain: the first parameter can only have come from
 * `seatBearingPeriod`. `seatFeeUsd` is the subscription fee, passed in from `RateCards.seat`
 * at the data boundary — this module holds no card and looks nothing up.
 */
export function totalSpend<Row extends CostBearing>(
  period: SeatBearingPeriod<Row>,
  members: readonly MemberFacts[],
  seatFeeUsd: number,
): TotalSpend<Row> {
  const cost = sessionCost(period.rows);
  const seats = seatHolders(members).length;
  // The seat charge, written as the quantity times the price it is charged at, so the figure and
  // the sentence a panel writes under it come out of the same expression.
  const seatMonths = seats * period.months;
  const seatCost = seatMonths * seatFeeUsd;
  const total = cost + seatCost;
  return {
    key: period.key,
    partial: period.partial,
    rows: period.rows,
    sessionCost: cost,
    seatCost,
    total,
    seats,
    months: period.months,
    seatMonths,
    seatShare: ratio(seatCost, total),
  };
}

// --- Cost per session (R-M1) ----------------------------------------------------------------

/** R-M1's `accepted` filter, as a closed vocabulary rather than a boolean nobody can read. */
export const OUTCOME_FILTERS = ["any", "accepted", "not-accepted"] as const;
export type OutcomeFilter = (typeof OUTCOME_FILTERS)[number];

/**
 * The filter, as one expression over the one outcome field there is (R-M3): `any` keeps every
 * row, and the other two split them on `accepted`. Written as a function rather than a lookup
 * table because a table keyed on `"not-accepted"` is an object literal method, which the
 * repo's `naming-convention` rule requires to be camelCase — and renaming the *vocabulary* to
 * suit a lint rule would put a control's URL value at the mercy of a formatting convention.
 */
const matches =
  (outcome: OutcomeFilter) =>
  (row: OutcomeBearing): boolean =>
    outcome === "any" || row.accepted === (outcome === "accepted");

export type CostPerSession = {
  readonly key: string;
  readonly partial: boolean;
  readonly outcome: OutcomeFilter;
  readonly sessions: number;
  readonly cost: number;
  /** `cost / sessions`, or `null` over no sessions — where the cost is necessarily zero too. */
  readonly value: Ratio;
  /**
   * Why there is no reading, in the words a headline figure prints beside its em dash (ticket 40,
   * R-M18). `null` where there *is* one, so a surface cannot print a reason under a figure.
   */
  readonly message: string | null;
};

/**
 * What the period was missing, named by the outcome filter that was applied to it. Written as a
 * function rather than a lookup for the reason `matches` is: a table keyed on `"not-accepted"`
 * would put a control's URL value at the mercy of a naming convention.
 */
const noSessionPhrase = (outcome: OutcomeFilter): string => {
  if (outcome === "any") return "no session";
  return outcome === "accepted" ? "no accepted session" : "no unaccepted session";
};

/**
 * **Cost per session** — attributed session Cost aggregated over a period, optionally within
 * one outcome. Seat cost is **not** here: R-M5 puts it outside session Cost, and a per-session
 * figure carrying a share of a monthly fee would be the apportioning R-M5 forbids.
 *
 * Over no sessions there is no spend either — 0 ÷ 0 — so the reading is `null` rather than a
 * message, on the `perCapita` precedent in `aggregate.ts`. Contrast Cost per completed Task,
 * where the numerator can be large while the denominator is zero.
 */
export function costPerSession<Row extends CostBearing & OutcomeBearing>(
  period: SpendPeriod<Row>,
  outcome: OutcomeFilter = "any",
): CostPerSession {
  const rows = period.rows.filter(matches(outcome));
  const cost = sessionCost(rows);
  const value = ratio(cost, rows.length);
  return {
    key: period.key,
    partial: period.partial,
    outcome,
    sessions: rows.length,
    cost,
    value,
    message: value === null ? `${period.key} holds ${noSessionPhrase(outcome)} to average` : null,
  };
}

// --- Cost per completed Task (R-M1) ---------------------------------------------------------

/**
 * **A Completed Task is a Task with at least one accepted session** (`CONTEXT.md` § Work).
 * Keyed on `task_key` **alone**: a Task may span repositories and work types, and keying on
 * either would split one Task into several and inflate the denominator.
 */
export function completedTaskKeys<Row extends OutcomeBearing & TaskBearing>(
  rows: readonly Row[],
): readonly string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.accepted) keys.add(row.task_key);
  }
  return [...keys].sort((left, right) => left.localeCompare(right));
}

/** What a period cost and what it delivered. The `defined: false` arm carries **no** `value`. */
export type CostPerCompletedTask = {
  readonly key: string;
  readonly partial: boolean;
  /** The numerator. Every session's cost, accepted or not, plus any seat charge folded in. */
  readonly cost: number;
  /** The share of the numerator that is seats. Zero below monthly grain, where there is none. */
  readonly seatCost: number;
  readonly sessions: number;
  /** The denominator: Tasks with at least one accepted session. */
  readonly completedTasks: number;
} & (
  | { readonly defined: true; readonly value: number }
  | { readonly defined: false; readonly message: string }
);

/**
 * The join, once. Waste is already in `cost` — it came off the rows, every one of them — and is
 * absent from `completedTasks`, so it raises the figure.
 */
const perCompletedTask = <Row extends SpendRow>(
  period: SpendPeriod<Row>,
  cost: number,
  seatCost: number,
): CostPerCompletedTask => {
  const completedTasks = completedTaskKeys(period.rows).length;
  const reading = {
    key: period.key,
    partial: period.partial,
    cost,
    seatCost,
    sessions: period.rows.length,
    completedTasks,
  };
  // `ratio.ts` decides, so this figure cannot come to a different conclusion about a zero
  // denominator than Cost per session, an Acceptance rate or a per-capita figure does. The
  // discriminated union is the *stronger* statement of the same rule: R-M18 says a ratio over a
  // zero denominator is `null`, and here there is not even a `value` field to hold the null.
  const value = ratio(cost, completedTasks);
  if (value === null) {
    return {
      ...reading,
      defined: false,
      message: `${period.key} holds $${cost.toFixed(2)} of spend and no Completed Task to divide it by`,
    };
  }
  return { ...reading, defined: true, value };
};

/**
 * **Cost per completed Task** over session Cost alone — available at every grain, because it
 * carries no seat charge (R-M5).
 */
export function costPerCompletedTask<Row extends SpendRow>(
  period: SpendPeriod<Row>,
): CostPerCompletedTask {
  return perCompletedTask(period, sessionCost(period.rows), 0);
}

/**
 * **Cost per completed Task over Total spend** — the figure R-D2 is about. Monthly and coarser
 * only, by taking a `TotalSpend` that nothing below monthly can produce.
 *
 * April is 19 days of sessions against a whole month's seat charge, so this figure is inflated
 * **by construction**. It is returned correct and `partial`; it is never corrected.
 */
export function totalSpendPerCompletedTask<Row extends SpendRow>(
  spend: TotalSpend<Row>,
): CostPerCompletedTask {
  return perCompletedTask(spend, spend.total, spend.seatCost);
}
