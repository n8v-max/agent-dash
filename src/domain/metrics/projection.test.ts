// T-U21 — Projection (R-N23, R-N24, P5).
//
// Three claims, asserted as three claims:
//
//   1. the extrapolation is elapsed-proportional, and `now` is injected;
//   2. **at 10% elapsed and at 90% elapsed the method is identical and the elapsed fraction
//      differs** — both asserted, because they are different claims;
//   3. **no confidence band is produced** (R-N24) — asserted as an absence, over the returned
//      object and over the module's own exports.

import { describe, expect, it } from "vitest";
import {
  PROJECTION_METHOD,
  projectPeriodSpend,
  type Projection,
  type ProjectionInput,
} from "./projection";

/** September 2026 — 30 days, the month `/demo/projection` lands on in the committed window. */
const SEPTEMBER = { key: "2026-09", startsOn: "2026-09-01", endsOn: "2026-09-30" };

const TIMEZONE = "Europe/Madrid";

const projection = (input: Partial<ProjectionInput> & { readonly now: string }): Projection => {
  const result = projectPeriodSpend({
    period: SEPTEMBER,
    actual: 1_000,
    timezone: TIMEZONE,
    ...input,
  });
  if (!result.ok) throw new Error(`expected a projection, got ${result.reason}: ${result.message}`);
  return result.projection;
};

// 3 of 30 days elapsed, the current day included; 27 of 30.
const AT_10_PERCENT = "2026-09-03T09:00:00+02:00";
const AT_90_PERCENT = "2026-09-27T09:00:00+02:00";

describe("T-U21 — elapsed-proportional extrapolation, with `now` injected (P5)", () => {
  it("projects the actual figure by the reciprocal of the elapsed share", () => {
    const at10 = projection({ now: AT_10_PERCENT, actual: 1_000 });

    expect(at10.elapsed).toEqual({ days: 3, totalDays: 30, fraction: 0.1 });
    expect(at10.projected).toBeCloseTo(10_000, 6);
    expect(at10.actual).toBe(1_000);
  });

  it("counts the current day as elapsed, because its spend is already in the actual figure", () => {
    // The first day of the month: one day of thirty, never zero of thirty.
    expect(projection({ now: "2026-09-01T23:30:00+02:00" }).elapsed).toEqual({
      days: 1,
      totalDays: 30,
      fraction: 1 / 30,
    });
  });

  it("takes `now` as an argument — the same input twice is the same projection", () => {
    expect(projection({ now: AT_10_PERCENT })).toEqual(projection({ now: AT_10_PERCENT }));
  });

  it("moves only with `now`: nothing else about the call changed the elapsed share", () => {
    const early = projection({ now: AT_10_PERCENT });
    const late = projection({ now: AT_90_PERCENT });

    expect(early.elapsed.totalDays).toBe(late.elapsed.totalDays);
    expect(early.elapsed.days).toBeLessThan(late.elapsed.days);
  });

  it("reads the civil day in the Organization's timezone, not in UTC (R-M10)", () => {
    // 22:30 UTC on 2 September is already 3 September in Madrid — the third day, not the second.
    expect(projection({ now: "2026-09-02T22:30:00Z" }).elapsed.days).toBe(3);
  });
});

describe("T-U21 — the method is identical and the elapsed fraction differs", () => {
  const at10 = projection({ now: AT_10_PERCENT, actual: 1_000 });
  const at90 = projection({ now: AT_90_PERCENT, actual: 9_000 });

  it("states one method, unchanged between 10% elapsed and 90% elapsed", () => {
    expect(at10.method).toBe(PROJECTION_METHOD);
    expect(at90.method).toBe(PROJECTION_METHOD);
    expect(at90.method).toBe(at10.method);
  });

  it("applies that one method identically at both — actual over the elapsed share", () => {
    expect(at10.projected).toBeCloseTo(at10.actual / at10.elapsed.fraction, 6);
    expect(at90.projected).toBeCloseTo(at90.actual / at90.elapsed.fraction, 6);
  });

  it("reports elapsed fractions that differ, because they are different claims", () => {
    expect(at10.elapsed.fraction).toBeCloseTo(0.1, 6);
    expect(at90.elapsed.fraction).toBeCloseTo(0.9, 6);
    expect(at90.elapsed.fraction).not.toBe(at10.elapsed.fraction);
  });

  it("flags both as incomplete periods, and a closed period as complete (R-N23)", () => {
    expect(at10.incomplete).toBe(true);
    expect(at90.incomplete).toBe(true);
    expect(projection({ now: "2026-10-04T09:00:00+02:00" }).incomplete).toBe(false);
  });
});

describe("T-U21 — no confidence band is produced (R-N24)", () => {
  const at10 = projection({ now: AT_10_PERCENT });

  it("returns no band, interval, bound or confidence figure of any name", () => {
    const forbidden = /band|confidence|interval|lower|upper|margin|min|max|p\d+|stderr/i;
    const keys = [...Object.keys(at10), ...Object.keys(at10.elapsed)];

    expect(keys.filter((key) => forbidden.test(key))).toEqual([]);
  });

  it("returns exactly one projected figure, and it is a number or nothing", () => {
    expect(Object.keys(at10).sort()).toEqual([
      "actual",
      "elapsed",
      "incomplete",
      "key",
      "method",
      "projected",
    ]);
    expect(typeof at10.projected).toBe("number");
  });

  it("says the method in one sentence and puts no interval in it", () => {
    expect(PROJECTION_METHOD).toMatch(/^[^.]+\.$/);
    expect(PROJECTION_METHOD).not.toMatch(/band|confidence|interval|estimate/i);
  });
});

describe("a period with no elapsed share, and a period that has closed", () => {
  it("projects nothing before the period opens — there is no basis, so there is no figure", () => {
    const before = projection({ now: "2026-08-20T09:00:00+02:00" });

    expect(before.elapsed).toEqual({ days: 0, totalDays: 30, fraction: 0 });
    expect(before.projected).toBeNull();
  });

  it("returns the actual figure once the period has closed — a month is measured, not forecast", () => {
    const after = projection({ now: "2026-11-01T09:00:00+02:00", actual: 8_500 });

    expect(after.elapsed).toEqual({ days: 30, totalDays: 30, fraction: 1 });
    expect(after.projected).toBe(8_500);
  });

  it("projects a single-day period the moment it starts", () => {
    const result = projectPeriodSpend({
      period: { key: "2026-09-08", startsOn: "2026-09-08", endsOn: "2026-09-08" },
      actual: 42,
      now: "2026-09-08T09:00:00+02:00",
      timezone: TIMEZONE,
    });

    expect(result).toMatchObject({ ok: true, projection: { projected: 42 } });
  });
});

describe("what has no projection at all", () => {
  it("rejects a period whose edges are not civil dates", () => {
    const result = projectPeriodSpend({
      period: { key: "2026-09", startsOn: "September", endsOn: "2026-09-30" },
      actual: 100,
      now: AT_10_PERCENT,
      timezone: TIMEZONE,
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid-period" });
  });

  it("rejects a period that ends before it starts", () => {
    const result = projectPeriodSpend({
      period: { key: "2026-09", startsOn: "2026-09-30", endsOn: "2026-09-01" },
      actual: 100,
      now: AT_10_PERCENT,
      timezone: TIMEZONE,
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid-period" });
  });

  it("rejects a `now` that is not an instant, rather than dating it from the epoch", () => {
    const result = projectPeriodSpend({
      period: SEPTEMBER,
      actual: 100,
      now: "yesterday",
      timezone: TIMEZONE,
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid-now" });
  });

  it("rejects an unknown timezone, because the period's edges are civil days in one", () => {
    const result = projectPeriodSpend({
      period: SEPTEMBER,
      actual: 100,
      now: AT_10_PERCENT,
      timezone: "Mars/Olympus_Mons",
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid-now" });
  });
});
