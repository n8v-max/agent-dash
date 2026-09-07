// T-U3 — the change-floor rule (`testing-spec.md` § 3.1, `spec.md` R-M12, R-M13, A8), ticket 27.
//
// These are pure unit tests: `src/domain/**` may not reach the data layer (R-T5), so every
// figure here is authored inline. The claims are re-asserted against the *committed* fixture in
// `src/data/change.fixture.test.ts`, because P6 says a test that would pass against an empty
// fixture is not a test.
//
// **The test this file must not contain.** T-U3 is explicit: *"The floor is a count of one, not
// a magnitude threshold. A test asserting a percentage cut-off would encode the position the
// metric set explicitly rejected."* So there is no expectation anywhere below that a change is
// hidden for being small, or for being implausibly large. The opposite is asserted, repeatedly
// and at both ends of the scale: +999 off a base of one is shown, and so is +1% off a base of
// a thousand. The only thing that suppresses a figure is a prior period holding nothing.
//
// Figures are authored so every expectation is exact — no floating-point tolerance is needed
// and no expectation restates the implementation's own arithmetic.

import { describe, expect, it } from "vitest";
import {
  CHANGE_SUPPRESSIONS,
  changeBetween,
  periodFigures,
  type Change,
  type ChangeShown,
  type PeriodFigure,
} from "./change";

/** A finished period. `partial` is the R-E2 flag, and it is false unless a test is about it. */
const figure = (key: string, value: number): PeriodFigure => ({ key, value, partial: false });
const partialFigure = (key: string, value: number): PeriodFigure => ({
  key,
  value,
  partial: true,
});

/** Narrows, so a test asserting a ratio cannot silently be asserting `undefined`. */
const shown = (change: Change): ChangeShown => {
  if (!change.shown) throw new Error(`expected a shown change, got ${change.reason}`);
  return change;
};

const between = (prior: PeriodFigure | undefined, current: PeriodFigure): Change =>
  changeBetween({ current, prior });

describe("the floor is a count of one (R-M12, T-U3, A8)", () => {
  it("suppresses the figure when the prior period holds zero", () => {
    const change = between(figure("2026-04", 0), figure("2026-05", 12));

    expect(change.shown).toBe(false);
    expect(change).toMatchObject({ reason: "prior-period-holds-nothing" });
    // The suppressed variant carries no ratio at all, so nothing downstream can print an
    // Infinity or a NaN where the product said there is no figure.
    expect("ratio" in change).toBe(false);
    expect("absolute" in change).toBe(false);
  });

  it("shows the figure when the prior period holds one — two-to-three really is +50%", () => {
    // `CONTEXT.md` § Period semantics, in its own words: "two to three sessions week-over-week
    // really is +50%, and on a narrow self-view that is the honest reading, not noise."
    const weekOverWeek = shown(between(figure("2026-W20", 2), figure("2026-W21", 3)));

    expect(weekOverWeek.ratio).toBe(0.5);
    expect(weekOverWeek.absolute).toBe(1);
    expect(weekOverWeek.direction).toBe("up");
  });

  it("shows it however large, off a prior period of exactly one", () => {
    // A magnitude floor would hide the biggest of these. Every one is shown, and the ratios
    // are asserted exactly, so a cut-off placed anywhere on this scale fails a case.
    const ratios = [2, 10, 100, 1000].map(
      (current) => shown(between(figure("prior", 1), figure("current", current))).ratio,
    );

    expect(ratios).toEqual([1, 9, 99, 999]);
  });

  it("shows it however small, which is the same rule read from the other end", () => {
    // A tenth of a percent, off a base of a thousand. The floor has nothing to say about it:
    // it is a rule about the prior period holding something, not about the size of the move.
    const tiny = shown(between(figure("prior", 1024), figure("current", 1025)));

    expect(tiny.ratio).toBe(1 / 1024);
    expect(tiny.absolute).toBe(1);
    expect(tiny.direction).toBe("up");
  });

  it("shows a fall to nothing: the floor is on the base, never on the current period", () => {
    const collapsed = shown(between(figure("2026-04", 100), figure("2026-05", 0)));

    expect(collapsed.ratio).toBe(-1);
    expect(collapsed.absolute).toBe(-100);
    expect(collapsed.direction).toBe("down");
  });

  it("suppresses when, and only when, the prior period holds nothing (A8)", () => {
    // A8 is an iff, so the sweep asserts both directions at once. A magnitude threshold placed
    // anywhere — 10%, 500%, one unit — makes at least one row of this grid disagree, because
    // the grid spans changes of 0%, ±50%, ±99900% and everything the product can show.
    const bases = [0, 0.5, 1, 2, 3, 1000];
    const currents = [0, 1, 3, 1000];

    const grid = bases.flatMap((base) =>
      currents.map((current) => ({
        base,
        current,
        shown: between(figure("prior", base), figure("current", current)).shown,
      })),
    );

    expect(grid.filter((cell) => cell.shown)).toHaveLength(
      bases.filter((base) => base !== 0).length * currents.length,
    );
    expect(grid.every((cell) => cell.shown === (cell.base !== 0))).toBe(true);
  });

  it("suppresses when there is no prior period at all, and says which reason it was", () => {
    const change = between(undefined, figure("2026-04", 42));

    expect(change).toMatchObject({ shown: false, reason: "no-prior-period", prior: null });
    expect(change.shown ? "" : change.message).toContain("2026-04");
  });

  it("admits exactly two reasons to suppress, both about the prior period's existence", () => {
    // The canary for the rule this ticket exists to keep out: a magnitude cut-off would have to
    // name itself here, and naming it breaks this expectation before it reaches a chart.
    expect(CHANGE_SUPPRESSIONS).toEqual(["no-prior-period", "prior-period-holds-nothing"]);
  });
});

describe("comparison is unrestricted; incompleteness is flagged, not withheld (R-M13)", () => {
  it("compares two periods that are not adjacent", () => {
    const change = shown(between(figure("2026-04", 200), figure("2026-09", 250)));

    expect(change.ratio).toBe(0.25);
    expect(change.prior.key).toBe("2026-04");
    expect(change.current.key).toBe("2026-09");
  });

  it("shows the figure for an unfinished current period, and flags it", () => {
    const change = shown(between(figure("2026-08", 80), partialFigure("2026-09", 20)));

    expect(change.incomplete).toBe(true);
    expect(change.ratio).toBe(-0.75);
  });

  it("shows the figure for a clipped prior period, and flags it", () => {
    const change = shown(between(partialFigure("2026-04", 50), figure("2026-05", 75)));

    expect(change.incomplete).toBe(true);
    expect(change.ratio).toBe(0.5);
  });

  it("leaves a comparison of two finished periods unflagged", () => {
    expect(shown(between(figure("2026-05", 4), figure("2026-06", 5))).incomplete).toBe(false);
  });

  it("still suppresses a partial prior period that holds nothing — for the zero, not the flag", () => {
    const change = between(partialFigure("2026-04", 0), figure("2026-05", 9));

    expect(change).toMatchObject({ shown: false, reason: "prior-period-holds-nothing" });
    expect(change.incomplete).toBe(true);
  });
});

describe("direction is read off the difference, so it states what happened", () => {
  it("names up, down and flat", () => {
    const directions = [
      [5, 6],
      [6, 5],
      [5, 5],
    ].map(([prior, current]) =>
      shown(between(figure("prior", prior), figure("current", current))).direction,
    );

    expect(directions).toEqual(["up", "down", "flat"]);
  });

  it("reports a flat comparison as a zero ratio rather than as no figure", () => {
    const flat = shown(between(figure("2026-05", 12), figure("2026-06", 12)));

    expect(flat.ratio).toBe(0);
    expect(flat.absolute).toBe(0);
  });
});

describe("figures are read off period buckets once (the bridge to periods.ts)", () => {
  const buckets = [
    { key: "2026-04", partial: true, rows: [{ cost: 10 }, { cost: 5 }] },
    { key: "2026-05", partial: false, rows: [{ cost: 20 }] },
    { key: "2026-06", partial: false, rows: [] },
  ];
  const cost = (row: { cost: number }): number => row.cost;

  it("sums the measure per bucket, in bucket order, carrying the partial flag", () => {
    expect(periodFigures(buckets, cost)).toEqual([
      { key: "2026-04", value: 15, partial: true },
      { key: "2026-05", value: 20, partial: false },
      { key: "2026-06", value: 0, partial: false },
    ]);
  });

  it("suppresses the change out of an empty bucket and shows the change into one", () => {
    const [april, may, june] = periodFigures(buckets, cost);

    expect(between(april, may).shown).toBe(true);
    // May → June is a fall to nothing off a base of 20: shown, at −100%.
    expect(shown(between(may, june)).ratio).toBe(-1);
    // June → anything has no base at all: suppressed.
    expect(between(june, figure("2026-07", 30)).shown).toBe(false);
  });
});
