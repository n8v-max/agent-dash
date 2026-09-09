// T-U1 — `(rows, timezone, grain) → period buckets` (`testing-spec.md` § 3.1, R-M10, R-M11,
// R-E2, A3, A7, A26) — and T-U8, the aggregation-side counterpart (`testing-spec.md` § 3.2).
//
// `src/domain/**` is pure (R-T5), and that applies to its tests: this file reads no fixture and
// touches no filesystem. Every row it needs is built inline. The committed 22:00–24:00 and
// post-midnight rows are bucketed for real in `src/data/periods.fixture.test.ts`, which may
// import `load.ts` because it sits outside the boundary.
//
// ## The case that carries the weight (inherited from ticket 19)
//
// A7 and T-U1 both name a session at **23:30 Europe/Madrid** and ask that it bucket to that
// local day "not the previous UTC day". The fixture window is entirely CEST (UTC+2), so 23:30
// Madrid is 21:30 UTC **on the same date**: local runs *ahead* of UTC, not behind it, and a
// naive UTC implementation buckets that row exactly where a correct one does. **The 23:30 case
// cannot fail.** It is kept below because A7 names it and it must stay satisfied.
//
// The rows where the UTC date and the Madrid date genuinely differ are the ones just after
// **local midnight**: 00:30 Madrid is 22:30 UTC on the *previous* day. Every "not UTC"
// assertion below is therefore made twice — once on a 23:30 row, for A7, and once on a
// post-midnight row, which is the one that actually falls over against a UTC implementation.
// A test that covered only 23:30 would be a test that passes against the bug it exists to catch.
//
// No spec was edited and no requirement was re-decided; this is added coverage.
//
// ## Not covered: DST transitions
//
// **No DST transition falls inside the fixture window** (R-D5, `testing-spec.md` § 8), so the
// ambiguous hour (a local time that occurs twice) and the missing hour (one that never occurs)
// are explicitly *not* covered. The gap is deliberate, not an oversight. It is also narrow:
// `periods.ts` only ever reads a civil date *off* an instant, which is exact through any
// transition — it never has to construct an instant from a local civil datetime, which is the
// operation that is ambiguous. `records the window carries no DST transition` below asserts the
// premise rather than assuming it.

import { describe, expect, it } from "vitest";
import {
  PERIOD_GRAINS,
  availableGrains,
  bucketRows,
  civilDayIn,
  civilDaysBetween,
  parseGrain,
  planPeriods,
  priorMonthStart,
  type PeriodBucket,
  type PeriodGrain,
  type PeriodPlan,
  type PeriodRange,
} from "./periods";

const MADRID = "Europe/Madrid";

/** The fixture window (R-D2) and the instant the product is demonstrated at. */
const WINDOW: PeriodRange = { start: "2026-04-12", end: "2026-09-08" };
const NOW = "2026-09-08T12:00:00+02:00";

type TestRow = { readonly id: string; readonly started_at: string; readonly cost: number };

const row = (id: string, startedAt: string, cost = 1): TestRow => ({
  id,
  started_at: startedAt,
  cost,
});

/** Civil-date arithmetic for the assertions themselves, independent of the module under test. */
const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** The UTC civil date of an instant — the answer a naive implementation would give. */
const utcDate = (instant: string): string => new Date(instant).toISOString().slice(0, 10);

const planFor = (
  grain: PeriodGrain,
  range: PeriodRange,
  timezone = MADRID,
  now = NOW,
): PeriodPlan => {
  const result = planPeriods({ timezone, grain, range, now });
  if (!result.ok) throw new Error(`plan unexpectedly rejected: ${result.reason}`);
  return result.plan;
};

/** The key of the bucket holding a row id, or `undefined` if no bucket holds it. */
const keyHolding = (buckets: readonly PeriodBucket<TestRow>[], id: string): string | undefined =>
  buckets.find((bucket) => bucket.rows.some((held) => held.id === id))?.key;

const bucketFor = (rows: readonly TestRow[], grain: PeriodGrain, range: PeriodRange, tz = MADRID) =>
  bucketRows(planFor(grain, range, tz), rows);

// --- T-U1 · A7 and the case that discriminates --------------------------------------------

describe("T-U1 — a row buckets by its date in the Organization's timezone, not UTC (R-M10, A7)", () => {
  // Both rows are shaped on real committed sessions: ses_0443 starts 2026-08-01T00:58:51+02:00
  // and one late row starts 2026-06-30T23:20:03+02:00.
  const lateEvening = row("late-evening", "2026-07-31T23:30:00+02:00");
  const afterMidnight = row("after-midnight", "2026-08-01T00:58:51+02:00");
  const july = { start: "2026-07-01", end: "2026-08-31" } satisfies PeriodRange;

  it("buckets a 23:30 Europe/Madrid session to that local day (A7)", () => {
    const buckets = bucketFor([lateEvening], "day", july);
    expect(keyHolding(buckets, "late-evening")).toBe("2026-07-31");
  });

  it("records that the 23:30 case cannot discriminate at CEST — UTC agrees with it", () => {
    // Not an incidental assertion: it is the reason the next test exists. If this ever fails,
    // the window has acquired a winter month and 23:30 has become a discriminating case again.
    expect(utcDate(lateEvening.started_at)).toBe("2026-07-31");
    expect(bucketFor([lateEvening], "day", july, "UTC")[30]?.rows).toHaveLength(1);
  });

  it("buckets a 00:58 Europe/Madrid session to the local day, where UTC would use the day before", () => {
    // The discriminating case: 00:58 Madrid is 22:58 UTC on the *previous* date.
    expect(utcDate(afterMidnight.started_at)).toBe("2026-07-31");

    expect(keyHolding(bucketFor([afterMidnight], "day", july), "after-midnight")).toBe("2026-08-01");
    expect(keyHolding(bucketFor([afterMidnight], "day", july, "UTC"), "after-midnight")).toBe(
      "2026-07-31",
    );
  });

  it("moves the same row across a week boundary when the timezone moves it across midnight", () => {
    // 2026-08-03 is a Monday, so a post-midnight row there is the first row of ISO week 32
    // locally and the last row of week 31 in UTC.
    const mondayMorning = row("monday-00-30", "2026-08-03T00:30:00+02:00");
    expect(utcDate(mondayMorning.started_at)).toBe("2026-08-02");

    expect(keyHolding(bucketFor([mondayMorning], "week", july), "monday-00-30")).toBe("2026-W32");
    expect(keyHolding(bucketFor([mondayMorning], "week", july, "UTC"), "monday-00-30")).toBe(
      "2026-W31",
    );
  });

  it("moves the same row across a month boundary too", () => {
    expect(keyHolding(bucketFor([afterMidnight], "month", july), "after-midnight")).toBe("2026-08");
    expect(keyHolding(bucketFor([afterMidnight], "month", july, "UTC"), "after-midnight")).toBe(
      "2026-07",
    );
  });

  it("drops a row whose timestamp is not an instant, and one outside the range", () => {
    const rows = [row("junk", "not-an-instant"), row("early", "2026-06-30T12:00:00+02:00")];
    const buckets = bucketFor(rows, "day", july);
    expect(keyHolding(buckets, "junk")).toBeUndefined();
    expect(keyHolding(buckets, "early")).toBeUndefined();
  });

  it("records the window carries no DST transition, so that case is not covered", () => {
    const offsetAt = (instant: string): string | undefined =>
      new Intl.DateTimeFormat("en-US", { timeZone: MADRID, timeZoneName: "longOffset" })
        .formatToParts(new Date(instant))
        .find((part) => part.type === "timeZoneName")?.value;

    expect(offsetAt(`${WINDOW.start}T00:00:00Z`)).toBe("GMT+02:00");
    expect(offsetAt(`${WINDOW.end}T23:59:59Z`)).toBe("GMT+02:00");
  });
});

// --- T-U1 · the partition ------------------------------------------------------------------

describe("T-U1 — day, week and month partition the range with no gaps and no double-counting", () => {
  // 91 rows, one a day from 1 Apr to 30 Jun, every one of them at 00:30 local — so every row
  // sits on a different UTC date than its Madrid date. A UTC implementation misplaces all 91.
  const rows = Array.from({ length: 91 }, (_, index) =>
    row(`r${index}`, `${addDays("2026-04-01", index)}T00:30:00+02:00`),
  );
  // Two months less a day, so day grain is admissible over it (R-M11).
  const range = { start: "2026-04-12", end: "2026-06-11" } satisfies PeriodRange;
  const inRange = rows.filter(
    (candidate) =>
      candidate.started_at.slice(0, 10) >= range.start &&
      candidate.started_at.slice(0, 10) <= range.end,
  );

  it("has 61 rows inside the range, none of which UTC would place there unchanged", () => {
    expect(inRange).toHaveLength(61);
    for (const candidate of rows) {
      expect(utcDate(candidate.started_at)).toBe(addDays(candidate.started_at.slice(0, 10), -1));
    }
  });

  it.each([...PERIOD_GRAINS])("covers the range end to end at %s grain", (grain) => {
    const buckets = bucketFor(rows, grain, range);
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets[0]?.startsOn.localeCompare(range.start)).toBeLessThanOrEqual(0);
    expect(buckets.at(-1)?.endsOn.localeCompare(range.end)).toBeGreaterThanOrEqual(0);
  });

  it.each([...PERIOD_GRAINS])("leaves no gap and no overlap between buckets at %s grain", (grain) => {
    const buckets = bucketFor(rows, grain, range);
    for (const bucket of buckets) {
      expect(bucket.grain).toBe(grain);
      expect(bucket.endsOn.localeCompare(bucket.startsOn)).toBeGreaterThanOrEqual(0);
    }
    // Each bucket starts the day after the one before it ends: no gap, and no overlap.
    for (const [index, next] of buckets.slice(1).entries()) {
      expect(next.startsOn).toBe(addDays(buckets[index].endsOn, 1));
    }
    expect(new Set(buckets.map((bucket) => bucket.key)).size).toBe(buckets.length);
  });

  it.each([...PERIOD_GRAINS])("holds every in-range row exactly once at %s grain", (grain) => {
    const held = bucketFor(rows, grain, range).flatMap((bucket) =>
      bucket.rows.map((bucketed) => bucketed.id),
    );
    expect(held).toHaveLength(inRange.length);
    expect(new Set(held)).toEqual(new Set(inRange.map((candidate) => candidate.id)));
  });

  it("does not invent buckets for empty periods — it emits them", () => {
    const single = [row("only", "2026-05-04T09:00:00+02:00")];
    const buckets = bucketFor(single, "week", range);
    expect(buckets.filter((bucket) => bucket.rows.length === 0)).toHaveLength(buckets.length - 1);
  });
});

// --- T-U1 · R-M11, made unrepresentable ----------------------------------------------------

describe("T-U1 — day grain over a range longer than two months is rejected (A3, R-M11)", () => {
  it("rejects day grain over the fixture window and says what is available instead", () => {
    const result = planPeriods({ timezone: MADRID, grain: "day", range: WINDOW, now: NOW });
    expect(result).toMatchObject({ ok: false, reason: "day-grain-needs-a-shorter-range" });
    expect(result).not.toHaveProperty("plan");
    if (result.ok) throw new Error("unreachable");
    expect(result.available).toEqual(["week", "month"]);
    expect(result.message).toContain("R-M11");
  });

  it("leaves week and month grain available over the same window", () => {
    expect(availableGrains(WINDOW)).toEqual(["week", "month"]);
    for (const grain of ["week", "month"] as const) {
      expect(bucketFor([], grain, WINDOW).length).toBeGreaterThan(0);
    }
  });

  it("admits exactly two calendar months and refuses one day more", () => {
    expect(availableGrains({ start: "2026-04-01", end: "2026-05-31" })).toEqual(PERIOD_GRAINS);
    expect(availableGrains({ start: "2026-04-01", end: "2026-06-01" })).toEqual(["week", "month"]);
  });

  it("clamps the two-month limit to the target month's last day", () => {
    // 31 December plus two months is 28 February, not 3 March: the limit does not stretch.
    expect(availableGrains({ start: "2026-12-31", end: "2027-02-27" })).toEqual(PERIOD_GRAINS);
    expect(availableGrains({ start: "2026-12-31", end: "2027-02-28" })).toEqual(["week", "month"]);
  });

  it("offers no grain at all for a range that is not a range", () => {
    expect(availableGrains({ start: "2026-04-12", end: "2026-04-11" })).toEqual([]);
    expect(availableGrains({ start: "not-a-date", end: "2026-04-11" })).toEqual([]);
  });

  it("parses a grain out of a URL and refuses anything else", () => {
    expect(parseGrain("day")).toBe("day");
    expect(parseGrain("month")).toBe("month");
    expect(parseGrain("quarter")).toBeUndefined();
    expect(parseGrain(undefined)).toBeUndefined();
  });

  // `bucketRows` takes a `PeriodPlan`, whose brand key is a module-private symbol. A rejected
  // request therefore has no value that `bucketRows` will accept: the invalid state has no
  // representation, rather than being rendered with a warning attached.
  it("returns a rejection carrying no plan, so there is nothing to render anyway", () => {
    const rejections = [
      planPeriods({ timezone: MADRID, grain: "day", range: { start: "x", end: "y" }, now: NOW }),
      planPeriods({ timezone: "Mars/Olympus", grain: "month", range: WINDOW, now: NOW }),
      planPeriods({ timezone: MADRID, grain: "month", range: WINDOW, now: "yesterday" }),
    ];
    expect(rejections.map((result) => (result.ok ? "ok" : result.reason))).toEqual([
      "invalid-range",
      "unknown-timezone",
      "invalid-now",
    ]);
    for (const result of rejections) expect(result).not.toHaveProperty("plan");
  });

  it("rejects a civil date that the calendar does not have", () => {
    const result = planPeriods({
      timezone: MADRID,
      grain: "month",
      range: { start: "2026-02-31", end: "2026-04-12" },
      now: NOW,
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid-range" });
  });
});

// --- T-U1 · R-E2, one partial mechanism -----------------------------------------------------

describe("T-U1 — a period that has not finished carries partial: true (R-E2, R-D2, A26)", () => {
  const flags = (grain: PeriodGrain, range: PeriodRange, now = NOW) =>
    bucketRows(planFor(grain, range, MADRID, now), []).map((bucket) => ({
      key: bucket.key,
      partial: bucket.partial,
    }));

  it("flags April and September across the fixture window, and nothing between", () => {
    expect(flags("month", WINDOW)).toEqual([
      { key: "2026-04", partial: true },
      { key: "2026-05", partial: false },
      { key: "2026-06", partial: false },
      { key: "2026-07", partial: false },
      { key: "2026-08", partial: false },
      { key: "2026-09", partial: true },
    ]);
  });

  it("flags April because the range clips it, not because it has not finished", () => {
    // April 2026 ended five months before `now`. The flag is the same mechanism at both ends of
    // the window: one flag, three causes (clipped start, clipped end, unfinished).
    const [april] = flags("month", WINDOW);
    expect(april).toEqual({ key: "2026-04", partial: true });
    expect(flags("month", { start: "2026-04-01", end: "2026-05-31" })[0]).toEqual({
      key: "2026-04",
      partial: false,
    });
  });

  it("flags the current month on an unclipped range — the /demo/projection case", () => {
    const september = { start: "2026-09-01", end: "2026-09-30" } satisfies PeriodRange;
    expect(flags("month", september)).toEqual([{ key: "2026-09", partial: true }]);
    // "Now" is an argument (P5): the same range and the same rows, a month later, is complete.
    expect(flags("month", september, "2026-10-01T00:00:00+02:00")).toEqual([
      { key: "2026-09", partial: false },
    ]);
  });

  it("flags today and not yesterday at day grain", () => {
    expect(flags("day", { start: "2026-09-06", end: "2026-09-08" })).toEqual([
      { key: "2026-09-06", partial: false },
      { key: "2026-09-07", partial: false },
      { key: "2026-09-08", partial: true },
    ]);
  });

  it("reads `now` in the Organization's timezone as well", () => {
    // 2026-09-01T00:30+02:00 is 2026-08-31T22:30 UTC. August has finished in Madrid; a UTC
    // reading of `now` would still be inside it and would flag August partial.
    const now = "2026-09-01T00:30:00+02:00";
    expect(utcDate(now)).toBe("2026-08-31");
    expect(flags("month", { start: "2026-08-01", end: "2026-09-30" }, now)).toEqual([
      { key: "2026-08", partial: false },
      { key: "2026-09", partial: true },
    ]);
  });

  it("flags the clipped first and last week of the window", () => {
    const weeks = flags("week", WINDOW);
    expect(weeks[0]).toEqual({ key: "2026-W15", partial: true });
    expect(weeks[1]).toEqual({ key: "2026-W16", partial: false });
    expect(weeks.at(-1)).toEqual({ key: "2026-W37", partial: true });
  });
});

// --- T-U8 · the aggregation-side counterpart ------------------------------------------------

describe("T-U8 — the aggregate over a timezone-bounded range (R-M10)", () => {
  // T-U1 proves a row buckets correctly. T-U8 proves the *total* over a timezone-bounded range
  // is right: the month's own boundaries move with the Organization's declared timezone rather
  // than with the server's, and the rows near midnight move with them.
  const rows = [
    row("late-evening", "2026-07-31T23:30:00+02:00", 100),
    row("after-midnight", "2026-08-01T00:58:51+02:00", 10),
    row("midday", "2026-08-05T12:00:00+02:00", 1000),
  ];
  const range = { start: "2026-07-01", end: "2026-08-31" } satisfies PeriodRange;

  const totals = (timezone: string): Record<string, number> =>
    Object.fromEntries(
      bucketFor(rows, "month", range, timezone).map((bucket) => [
        bucket.key,
        bucket.rows.reduce((sum, held) => sum + held.cost, 0),
      ]),
    );

  it("puts the post-midnight session in the local month, where UTC would bill it to the previous one", () => {
    expect(totals(MADRID)).toEqual({ "2026-07": 100, "2026-08": 1010 });
    expect(totals("UTC")).toEqual({ "2026-07": 110, "2026-08": 1000 });
  });

  it("keeps the 23:30 session in its local month as well (A7)", () => {
    // At CEST this row agrees with UTC — kept because A7 names it. The 10 above is the
    // difference the declared timezone actually makes; the 100 is the case that cannot fail.
    expect(keyHolding(bucketFor(rows, "month", range), "late-evening")).toBe("2026-07");
  });

  it("moves the boundaries with the declared timezone, not with the server's", () => {
    // Pacific/Auckland is UTC+12 in July, so all three rows fall in its August. Nothing here
    // reads the process's zone: every conversion goes through an explicit `timeZone`.
    expect(totals("Pacific/Auckland")).toEqual({ "2026-07": 0, "2026-08": 1110 });
  });

  it("totals to the same figure in every timezone — the rows move, the sum does not", () => {
    for (const timezone of [MADRID, "UTC", "Pacific/Auckland"]) {
      const sum = Object.values(totals(timezone)).reduce((left, right) => left + right, 0);
      expect(sum).toBe(1110);
    }
  });
});

// The two civil-date helpers `metrics/projection.ts` reads. They exist here rather than there
// because this module owns the program's single `Intl` conversion (R-M10): a second one would
// be a second answer to "what day is it in Madrid".
describe("civil days, in the Organization's declared timezone", () => {
  it("reads the civil day an instant fell on in that timezone, not in UTC", () => {
    expect(civilDayIn("Europe/Madrid", "2026-09-02T22:30:00Z")).toBe("2026-09-03");
    expect(civilDayIn("UTC", "2026-09-02T22:30:00Z")).toBe("2026-09-02");
  });

  it("has no day for an unknown timezone, and none for a string that is not an instant", () => {
    expect(civilDayIn("Mars/Olympus_Mons", "2026-09-02T22:30:00Z")).toBeUndefined();
    expect(civilDayIn("Europe/Madrid", "yesterday")).toBeUndefined();
  });

  it("counts whole civil days between two dates, signed", () => {
    expect(civilDaysBetween("2026-09-01", "2026-09-08")).toBe(7);
    expect(civilDaysBetween("2026-09-08", "2026-09-08")).toBe(0);
    expect(civilDaysBetween("2026-09-30", "2026-09-01")).toBe(-29);
  });

  it("counts across a month boundary and across the CEST/CET change alike", () => {
    // 2026-10-25 is the DST change in Madrid; the count is in civil days, so it is unaffected.
    expect(civilDaysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(civilDaysBetween("2026-08-31", "2026-09-01")).toBe(1);
  });

  it("has no count where either end is not a civil date", () => {
    expect(civilDaysBetween("September", "2026-09-08")).toBeUndefined();
    expect(civilDaysBetween("2026-09-01", "2026-02-31")).toBeUndefined();
  });
});

// --- The turn of the year, and the month before a January -----------------------------------
//
// Neither case is in the fixture window (R-D2 runs 2026-04-12 to 2026-09-08), so neither was
// reached by anything above. Ticket 52's mutation run found them the way a gap like this is
// normally found: the arithmetic that decides them survived being changed.
//
// No spec was edited and no requirement was re-decided; this is added coverage.

describe("the ISO week key is fixed by the week's Thursday, so the year turn is unambiguous", () => {
  // The discriminating case, and the only one there is: a week that *starts* in one year and
  // belongs to the next. 2025-12-29 is a Monday; its Thursday is 2026-01-01, so the whole week
  // is 2026-W01 — including the three days of it that fall in 2025. Reading the year off the
  // Monday instead would file those three days under 2025, and reading it off any day but the
  // Thursday gets one end of the week or the other wrong.
  const yearTurn: PeriodRange = { start: "2025-12-22", end: "2026-01-11" };

  it("files the December days of a January week under the January week-numbering year", () => {
    const weeks = bucketFor(
      [row("mon-29-dec", "2025-12-29T09:00:00+01:00"), row("thu-01-jan", "2026-01-01T09:00:00+01:00")],
      "week",
      yearTurn,
    );

    expect(keyHolding(weeks, "mon-29-dec")).toBe("2026-W01");
    expect(keyHolding(weeks, "thu-01-jan")).toBe("2026-W01");
  });

  it("numbers the weeks either side of the turn in order, and pads a single-digit week", () => {
    // "2026-W01", not "2026-W1": the key is sorted and compared as text everywhere it travels
    // (R-T8), and an unpadded week sorts after "2026-W10".
    expect(bucketFor([], "week", yearTurn).map((bucket) => bucket.key)).toEqual([
      "2025-W52",
      "2026-W01",
      "2026-W02",
    ]);
  });
});

describe("priorMonthStart widens a range backwards by one whole month", () => {
  it("steps back to the first of the month before", () => {
    expect(priorMonthStart("2026-05-12")).toBe("2026-04-01");
    expect(priorMonthStart("2026-12-31")).toBe("2026-11-01");
  });

  it("crosses the turn of the year rather than naming a month zero", () => {
    expect(priorMonthStart("2026-01-01")).toBe("2025-12-01");
    expect(priorMonthStart("2026-01-31")).toBe("2025-12-01");
  });

  it("has no prior month for anything that is not exactly a civil date", () => {
    // The anchors are the point: a date with an instant glued to either end is not a date, and
    // accepting one would widen the range off a string the caller never meant as a day.
    expect(priorMonthStart("2026-05-12T00:00:00Z")).toBeUndefined();
    expect(priorMonthStart("from 2026-05-12")).toBeUndefined();
    expect(priorMonthStart("2026-05")).toBeUndefined();
    expect(priorMonthStart("")).toBeUndefined();
  });

  it("has no prior month for a well-shaped date naming no month of the year", () => {
    expect(priorMonthStart("2026-13-01")).toBeUndefined();
    expect(priorMonthStart("2026-00-01")).toBeUndefined();
  });
});
