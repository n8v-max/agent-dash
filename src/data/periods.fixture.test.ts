// T-U1 / T-U8 against the **committed** fixture (R-D2, R-D5, A7, A26, P3, P6).
//
// The pure unit tests live in `src/domain/periods.test.ts` and build every row inline, because
// `src/domain/**` may not reach the data layer (R-T5). This file sits outside that boundary, so
// it may import `load.ts` — and it exists because P6 says a test that would pass against an
// empty fixture is not a test. R-D5 seeds the timezone edge rows on purpose; T-F6 asserts they
// exist; this asserts they *bucket to the right period*, which is the claim they were seeded for.
//
// It reads committed output and never runs the generator (P3, R-T20).

import { describe, expect, it } from "vitest";
import { bucketRows, planPeriods, type PeriodGrain, type PeriodRange } from "@/domain/periods";
import type { AgentSession } from "@/domain/types";
import { loadDataset } from "./load";

const { organization, sessions } = loadDataset();

const WINDOW: PeriodRange = { start: organization.window_start, end: organization.window_end };
/** The last instant of the fixture window, in the Organization's timezone. P5: never a clock read. */
const NOW = `${organization.window_end}T23:59:59+02:00`;

const bucketsFor = (grain: PeriodGrain, range: PeriodRange, rows: readonly AgentSession[]) => {
  const result = planPeriods({ timezone: organization.timezone, grain, range, now: NOW });
  if (!result.ok) throw new Error(`plan unexpectedly rejected: ${result.reason}`);
  return bucketRows(result.plan, rows);
};

/** The Madrid civil date a row was launched on. The fixture writes rows with a +02:00 offset. */
const localDate = (session: AgentSession): string => session.started_at.slice(0, 10);
const utcDate = (session: AgentSession): string =>
  new Date(session.started_at).toISOString().slice(0, 10);

/** R-D5's literal population: 22:00–24:00 Europe/Madrid. What A7 and T-F6 name. */
const lateEvening = sessions.filter((session) => Number(session.started_at.slice(11, 13)) >= 22);
/** The discriminating population: rows whose UTC date is genuinely a different date. */
const crossesUtcMidnight = sessions.filter((session) => utcDate(session) !== localDate(session));

describe("the committed fixture is not empty of the rows these claims need (P6, R-D5)", () => {
  it("carries 22:00–24:00 Madrid rows and post-midnight rows that UTC would misplace", () => {
    expect(lateEvening.length).toBeGreaterThan(10);
    expect(crossesUtcMidnight.length).toBeGreaterThan(10);
    // Every crossing row is just after local midnight — 00:xx or 01:xx — because at UTC+2 that
    // is the only way a Madrid date and a UTC date can differ (ticket 19).
    const dayBefore = (date: string): string =>
      new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    for (const session of crossesUtcMidnight) {
      expect(Number(session.started_at.slice(11, 13))).toBeLessThan(2);
      expect(utcDate(session)).toBe(dayBefore(localDate(session)));
    }
  });

  it("declares Europe/Madrid and the 12 Apr – 25 Sep window (R-D1, R-D2)", () => {
    expect(organization.timezone).toBe("Europe/Madrid");
    expect(WINDOW).toEqual({ start: "2026-04-12", end: "2026-09-25" });
  });
});

describe("T-U1 — committed rows bucket to their Madrid day, not their UTC day (A7, R-M10)", () => {
  // Two calendar months exactly, so day grain is admissible (R-M11), and the sub-window holds
  // both populations including the one month-boundary crossing row in the fixture.
  const twoMonths: PeriodRange = { start: "2026-07-01", end: "2026-08-31" };
  const inWindow = (session: AgentSession) =>
    localDate(session) >= twoMonths.start && localDate(session) <= twoMonths.end;

  const dayBuckets = bucketsFor("day", twoMonths, sessions);
  const keyHolding = (id: string) =>
    dayBuckets.find((bucket) => bucket.rows.some((row) => row.id === id))?.key;

  it("puts every committed 22:00–24:00 row on its local day (A7)", () => {
    const late = lateEvening.filter(inWindow);
    expect(late.length).toBeGreaterThan(0);
    for (const session of late) expect(keyHolding(session.id)).toBe(localDate(session));
  });

  it("puts every committed post-midnight row on its local day, not the previous UTC day", () => {
    const crossing = crossesUtcMidnight.filter(inWindow);
    expect(crossing.length).toBeGreaterThan(0);
    for (const session of crossing) {
      expect(keyHolding(session.id)).toBe(localDate(session));
      expect(keyHolding(session.id)).not.toBe(utcDate(session));
    }
  });

  it("holds every in-window session exactly once, with no gaps between days", () => {
    const held = dayBuckets.flatMap((bucket) => bucket.rows.map((row) => row.id));
    expect(new Set(held).size).toBe(held.length);
    expect(new Set(held)).toEqual(new Set(sessions.filter(inWindow).map((row) => row.id)));
    expect(dayBuckets).toHaveLength(62);
  });
});

describe("T-U8 — the aggregate over the fixture window (A26, R-D2, R-E2)", () => {
  const months = bucketsFor("month", WINDOW, sessions);

  it("spans April to September, flagging April and September partial (A26)", () => {
    expect(months.map((bucket) => bucket.key)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(months.map((bucket) => bucket.partial)).toEqual([true, false, false, false, false, true]);
  });

  it("partitions the whole window — every visible session in exactly one month", () => {
    const held = months.flatMap((bucket) => bucket.rows.map((row) => row.id));
    expect(held).toHaveLength(sessions.length);
    expect(new Set(held).size).toBe(sessions.length);
    for (const bucket of months) {
      for (const session of bucket.rows) expect(localDate(session).slice(0, 7)).toBe(bucket.key);
    }
  });

  it("bills the month-boundary session to the month its Organization worked it", () => {
    // A session opening just after local midnight on the 1st sits on the *previous* UTC day and
    // therefore in the previous UTC month. A UTC-bucketed total puts its cost there; the
    // Organization's declared timezone puts it in the month it actually worked.
    //
    // Stated over **every** such row rather than over one named id (ticket 66): at this volume
    // the fixture carries several, spread across four of the five month boundaries, and naming
    // one would make the claim a fact about that row rather than about the rule.
    const crossing = crossesUtcMidnight.filter((session) => localDate(session).endsWith("-01"));
    expect(crossing.length).toBeGreaterThan(0);

    const monthOf = (key: string) => months.find((bucket) => bucket.key === key);
    for (const session of crossing) {
      const local = localDate(session).slice(0, 7);
      const utc = utcDate(session).slice(0, 7);
      expect(monthOf(local)?.rows).toContain(session);
      // The two disagree, and the Organization's month is the one that holds the row.
      expect(utc).not.toBe(local);
      expect(monthOf(utc)?.rows ?? []).not.toContain(session);
    }
  });

  it("rejects day grain over the 167-day window (A3, R-M11)", () => {
    const result = planPeriods({
      timezone: organization.timezone,
      grain: "day",
      range: WINDOW,
      now: NOW,
    });
    expect(result).toMatchObject({ ok: false, reason: "day-grain-needs-a-shorter-range" });
  });
});
