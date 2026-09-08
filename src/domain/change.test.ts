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
  type PeriodReading,
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

const between = (prior: PeriodReading | undefined, current: PeriodReading): Change =>
  changeBetween({ current, prior });

/** R-M18 — a period the measure is undefined over. Not a period holding zero. */
const noReading = (key: string): PeriodReading => ({ key, value: null, partial: false });

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

  it("admits exactly four reasons to suppress, and not one of them is about size", () => {
    // The canary for the rule this ticket exists to keep out: a magnitude cut-off would have to
    // name itself here, and naming it breaks this expectation before it reaches a chart. C13
    // added the third — still a statement about the prior period, still not about size — and
    // ticket 40 the fourth, which is about a period having no figure at all (R-M18).
    expect(CHANGE_SUPPRESSIONS).toEqual([
      "no-figure-to-compare",
      "no-prior-period",
      "prior-period-holds-nothing",
      "prior-period-incomplete",
    ]);
  });
});

// --- R-M18 — a period with no figure is not a period holding zero (ticket 40) ---------------
//
// A ratio over a zero denominator is `null` (`ratio.ts`), and a tile prints it as an em dash
// with the metric module's own reason under it. Before this rule the query layer coerced the
// same `null` to `0` on its way to the floor, so the tile printed "—" and, beside it,
// "−100% on the prior period": a fall to nothing, off a month whose measure was never defined.

describe("a null reading suppresses the change, and does not read as a fall to zero", () => {
  it("suppresses when the current period has no figure", () => {
    const change = between(figure("2026-04", 200), noReading("2026-05"));

    expect(change).toMatchObject({ shown: false, reason: "no-figure-to-compare" });
    expect(change.shown ? "" : change.message).toContain("2026-05");
  });

  it("does not report it as a fall to nothing", () => {
    const dropped = between(figure("2026-04", 200), figure("2026-05", 0));
    const undefinedOver = between(figure("2026-04", 200), noReading("2026-05"));

    // A measured zero *is* a fall, and R-M12 shows it: the floor is on the base, not the current
    // period. An undefined reading is not a fall at all, and the two must not read alike.
    expect(shown(dropped).ratio).toBe(-1);
    expect(undefinedOver.shown).toBe(false);
  });

  it("suppresses when the prior period has no figure, naming the prior period", () => {
    const change = between(noReading("2026-04"), figure("2026-05", 12));

    expect(change).toMatchObject({ shown: false, reason: "no-figure-to-compare" });
    expect(change.shown ? "" : change.message).toContain("2026-04");
  });

  it("prefers 'no prior period' to 'no figure' where there is no earlier period at all", () => {
    expect(between(undefined, figure("2026-04", 42))).toMatchObject({
      reason: "no-prior-period",
    });
  });

  it("reports the current period's absence before the prior period's", () => {
    // Both are absent. The useful thing to tell a reader is that the figure they are looking at
    // does not exist, not that the one they cannot see does not either.
    const change = between(noReading("2026-04"), noReading("2026-05"));

    expect(change.shown ? "" : change.message).toContain("2026-05");
  });

  it("carries the incomplete flag through the suppression, as the other reasons do", () => {
    const change = between(partialFigure("2026-04", 5), noReading("2026-05"));

    expect(change).toMatchObject({ shown: false, incomplete: true });
  });
});

describe("incompleteness: flagged on the current period, withheld on the prior (R-M13, C13)", () => {
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

  it("suppresses against a clipped prior period, and says which month was unfinished", () => {
    // C13's asymmetry, and the case that motivated it. April is clipped at the window's start,
    // so the fixture only half covers it; comparing a whole May against it reports a rise that
    // is an artefact of the window. The viewer never chose to look at April — under C12 it is
    // read from outside the selected range — so there is nothing on screen to qualify.
    const change = between(partialFigure("2026-04", 50), figure("2026-05", 75));

    expect(change).toMatchObject({ shown: false, reason: "prior-period-incomplete" });
    expect(change.shown ? "" : change.message).toContain("2026-04");
    expect(change.incomplete).toBe(true);
  });

  it("is not pro-rating: the unfinished month is declined as a baseline, not extrapolated", () => {
    // R-E2 forbids inventing the missing days. C13 declines to divide by them, which is a
    // different act — nothing here scales 50 up to a notional whole month.
    const change = between(partialFigure("2026-04", 50), figure("2026-05", 75));

    expect(change.shown).toBe(false);
    expect(change.prior?.value).toBe(50);
  });

  it("leaves a comparison of two finished periods unflagged", () => {
    expect(shown(between(figure("2026-05", 4), figure("2026-06", 5))).incomplete).toBe(false);
  });

  it("reports a prior period that is both empty and unfinished as empty", () => {
    // Both rules fire; the order in `changeBetween` decides which is reported, and "holds
    // nothing" is the more useful of the two things to tell someone.
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

    // April is clipped, so April → May is withheld under C13 rather than shown.
    expect(between(april, may)).toMatchObject({ shown: false, reason: "prior-period-incomplete" });
    // May → June is a fall to nothing off a base of 20: shown, at −100%.
    expect(shown(between(may, june)).ratio).toBe(-1);
    // June → anything has no base at all: suppressed.
    expect(between(june, figure("2026-07", 30)).shown).toBe(false);
  });
});
