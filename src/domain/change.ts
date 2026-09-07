// Period-over-period change and the change floor — `CONTEXT.md` § Period semantics
// (**Comparison floor**), `spec.md` R-M12 / R-M13 / R-N7 / A8, `technical-spec.md` § 3.2,
// ticket 27. Tested by T-U3.
//
// **The floor is a count of one, not a magnitude threshold.** A change figure is suppressed
// only when the prior period holds *nothing at all* to compare against. Above nothing it is
// shown, however large: two to three sessions week-over-week really is +50%, and on a narrow
// self-view that is the honest reading, not noise.
//
// That is the whole rule, and the module is deliberately arranged so the other rule — the one
// every dashboard reaches for — cannot be added by accident:
//
//   * **There is no threshold constant here, and no place to put one.** A percentage cut-off
//     ("hide changes under 20%") is the position ticket 05 explicitly rejected. Every vendor
//     shipping a magnitude floor ships it to gate **alerts**, and alerting is out of scope
//     (`spec.md` § 1). A configurable threshold defaulting to zero would be the same rule with
//     a switch on it, so there is no option object and no parameter to widen.
//
//   * **Suppression is a closed vocabulary** (`CHANGE_SUPPRESSIONS`), and both of its members
//     say the same thing about the *prior* period: it does not exist, or it holds nothing. Any
//     future reason would have to be named here, in a list a reader compares against R-M12.
//
//   * **The ratio is unreachable when the figure is suppressed.** `Change` is a discriminated
//     union: a renderer that has not narrowed on `shown` has no `ratio` in scope to print, so
//     "suppressed" cannot degrade into "rendered as ∞ or NaN". That is the failure the floor
//     exists to prevent, made unrepresentable rather than guarded.
//
// **R-M13 — comparison is unrestricted; incompleteness is flagged, not withheld.** `Comparison`
// holds two figures and asserts no relation between them: any period may be compared with any
// other, adjacent or not. A period that has not finished carries `partial` from its bucket, and
// that flag travels onto the result as `incomplete` — it never suppresses. Suppression has
// exactly one cause, and an unfinished period is not it.
//
// **Direction is read off the absolute difference, not the ratio**, so it states what happened
// to the figure whatever the arithmetic does to the sign.
//
// Every measure in this product is non-negative by construction — counts, durations, and
// attributed costs (R-M4) — so a shown `ratio` is a change against a positive base.
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

/**
 * One period's figure: its stable identity, what the measure came to over it, and whether the
 * period is incomplete (R-E2). `partial` is carried, never acted on — see `incomplete`.
 */
export type PeriodFigure = {
  /** The period's key — `2026-04`, `2026-W15`. A stable identity, never an index (R-T8). */
  readonly key: string;
  readonly value: number;
  /** R-E2 — clipped by the range at either end, or not finished as of `now`. */
  readonly partial: boolean;
};

/**
 * The two periods being compared. **No adjacency is required or implied** (R-M13): the type
 * names a current and a prior figure and nothing else about their relationship.
 *
 * `prior` is `undefined` where there is no earlier period to compare against at all — the first
 * bucket of a range. That is a suppression, on the same rule and for the same reason as a prior
 * period holding nothing: there is no basis.
 */
export type Comparison = {
  readonly current: PeriodFigure;
  readonly prior: PeriodFigure | undefined;
};

/** Which way the figure moved. Read off the absolute difference, so it is sign-honest. */
export const CHANGE_DIRECTIONS = ["up", "down", "flat"] as const;
export type ChangeDirection = (typeof CHANGE_DIRECTIONS)[number];

/**
 * Why a change figure is suppressed. R-M12 admits exactly these two, and both are statements
 * about the prior period's *existence*, never about the size of the change.
 */
export const CHANGE_SUPPRESSIONS = ["no-prior-period", "prior-period-holds-nothing"] as const;
export type ChangeSuppression = (typeof CHANGE_SUPPRESSIONS)[number];

/** A change figure the product shows. However large: the floor is on the base, not the size. */
export type ChangeShown = {
  readonly shown: true;
  readonly current: PeriodFigure;
  readonly prior: PeriodFigure;
  /** `current − prior`, in the measure's own units. */
  readonly absolute: number;
  /** `(current − prior) / prior`, a fraction. `0.5` is +50%; formatting belongs upstream. */
  readonly ratio: number;
  readonly direction: ChangeDirection;
  /** R-M13 — either period is unfinished or clipped. A flag on a shown figure, never a veto. */
  readonly incomplete: boolean;
};

/** No figure. There is no `ratio` here, so nothing downstream can print one. */
export type ChangeSuppressed = {
  readonly shown: false;
  readonly reason: ChangeSuppression;
  /** Why, in words, for the copy that stands where the figure would have been. */
  readonly message: string;
  readonly current: PeriodFigure;
  readonly prior: PeriodFigure | null;
  readonly incomplete: boolean;
};

export type Change = ChangeShown | ChangeSuppressed;

const directionOf = (absolute: number): ChangeDirection => {
  if (absolute > 0) return "up";
  return absolute < 0 ? "down" : "flat";
};

const incompleteIn = (current: PeriodFigure, prior: PeriodFigure | undefined): boolean =>
  current.partial || (prior?.partial ?? false);

/**
 * **R-M12 — the change floor.** The figure is suppressed when, and only when, the prior period
 * holds nothing: no prior period at all, or one whose figure is zero. Everything else is shown.
 *
 * There is deliberately no second condition. A prior period of 2 against a current of 3 returns
 * `+0.5` and a prior of 1 against a current of 1000 returns `+999`; both are shown, because the
 * product's position is that a large change off a small base is the honest reading rather than
 * noise to be filtered. A current period of zero against a prior that held something is shown
 * too — the floor is on the base, and a fall to nothing is exactly the reading a viewer needs.
 */
export function changeBetween(comparison: Comparison): Change {
  const { current, prior } = comparison;
  const incomplete = incompleteIn(current, prior);

  if (prior === undefined) {
    return {
      shown: false,
      reason: "no-prior-period",
      message: `${current.key} has no prior period to compare against`,
      current,
      prior: null,
      incomplete,
    };
  }

  if (prior.value === 0) {
    return {
      shown: false,
      reason: "prior-period-holds-nothing",
      message: `${prior.key} holds nothing to compare ${current.key} against`,
      current,
      prior,
      incomplete,
    };
  }

  const absolute = current.value - prior.value;
  return {
    shown: true,
    current,
    prior,
    absolute,
    ratio: absolute / prior.value,
    direction: directionOf(absolute),
    incomplete,
  };
}

/** The minimum a figure needs from a bucket. `PeriodBucket<Row>` satisfies it structurally. */
export type FigureBucket<Row> = {
  readonly key: string;
  readonly partial: boolean;
  readonly rows: readonly Row[];
};

/**
 * Buckets → one figure each, in bucket order. The bridge from `periods.ts` to a comparison, so
 * that the figure compared and the bucket rendered are the same number read once.
 */
export function periodFigures<Row>(
  buckets: readonly FigureBucket<Row>[],
  measure: (row: Row) => number,
): readonly PeriodFigure[] {
  return buckets.map((bucket) => ({
    key: bucket.key,
    value: bucket.rows.reduce((running, row) => running + measure(row), 0),
    partial: bucket.partial,
  }));
}
