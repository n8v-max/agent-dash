// Period generators — ticket 51, testing-spec T-U29. Feeds the property that period buckets
// **partition** the selected range, with the boundaries falling in the Organization's declared
// timezone (`CONTEXT.md` § Period semantics, `spec.md` R-M10, R-M11, R-E2).
//
// **What this module has to make reachable.** A partition property that only ever saw UTC
// instants at midday would pass against a `periods.ts` that never converted anything: the bug it
// exists to catch is a row landing in the adjacent bucket because the boundary was computed in
// the wrong zone. So the instants it builds carry a **written UTC offset that is not the
// Organization's** — a session stamped `+02:00` read in `Pacific/Kiritimati` is a different civil
// day — and the minute-of-day is biased hard towards the two midnights either side of it. The
// property counts how often the timezone actually moved a row and fails if the answer is "never".
//
// The zones are picked for the same reason: `Asia/Kolkata` (+05:30) and `Pacific/Chatham`
// (+12:45) have half- and quarter-hour offsets, and `Pacific/Kiritimati` (+14:00) is the extreme
// of the range — three zones where a whole-hour arithmetic shortcut in the conversion would show.
//
// **Determinism (P5, R-T5).** Every value here is a pure function of numbers fast-check chose
// with its own seeded generator. There is no `new Date()`, no `Date.now()` and no `Math.random()`:
// `Date.UTC` and `new Date(ms)` are arithmetic over an argument, which is exactly the reading
// `periods.ts` itself is built on.

import fc from "fast-check";
import { PERIOD_GRAINS, type PeriodRequest, type PeriodRow } from "../periods";

/** Milliseconds in a civil day. The unit day numbers are counted in. */
export const MS_PER_DAY = 86_400_000;

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1440;

/** Whole days since 1970-01-01 → `YYYY-MM-DD`. `new Date(ms)` is arithmetic over an argument. */
const civilDateAt = (day: number): string =>
  new Date(day * MS_PER_DAY).toISOString().slice(0, 10);

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * An instant, written the way a session row writes one: ISO 8601 **with an offset**, and the
 * offset is not necessarily the Organization's. `utcMs` fixes *which* instant it is; `offset`
 * only fixes how it is spelled, which is the distinction a string comparison would lose.
 */
export const instantAt = (utcMs: number, offsetMinutes: number): string => {
  const local = new Date(utcMs + offsetMinutes * MS_PER_MINUTE).toISOString().slice(0, 19);
  const size = Math.abs(offsetMinutes);
  const sign = offsetMinutes < 0 ? "-" : "+";
  return `${local}${sign}${pad(Math.floor(size / 60))}:${pad(size % 60)}`;
};

/** IANA zones spanning the offset range, including two that are not a whole number of hours. */
const TIMEZONES = [
  "UTC",
  "Europe/Madrid",
  "America/Los_Angeles",
  "Asia/Kolkata",
  "Pacific/Kiritimati",
  "Pacific/Chatham",
] as const;

/** The offsets a row's timestamp is *written* with. Deliberately unrelated to the zone above. */
const WRITTEN_OFFSETS = [-480, -300, 0, 60, 120, 330, 765, 840];

/** Midnight, the minute either side of it, and midday — where an off-by-one bucket shows. */
const EDGE_MINUTES = [0, 1, 30, 719, 720, 721, 1438, 1439];

const minuteArb = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom(...EDGE_MINUTES) },
  { weight: 1, arbitrary: fc.integer({ min: 0, max: MINUTES_PER_DAY - 1 }) },
);

const offsetArb = fc.constantFrom(...WRITTEN_OFFSETS);

/** An instant somewhere on one of the civil days `from..to`, spelled with an arbitrary offset. */
const instantBetweenArb = (from: number, to: number) =>
  fc
    .record({ day: fc.integer({ min: from, max: to }), minute: minuteArb, offset: offsetArb })
    .map((at) => instantAt(at.day * MS_PER_DAY + at.minute * MS_PER_MINUTE, at.offset));

/** 2026-04-12 — the first day of the committed fixture's window, as a day number. */
const ANCHOR_DAY = Date.UTC(2026, 3, 12) / MS_PER_DAY;

/**
 * Range lengths. Weighted towards ranges day grain **fits** (R-M11 is two months or less) so the
 * partition is exercised at all three grains, while the long tail still reaches the rejection.
 */
const spanArb = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: 0, max: 55 }) },
  { weight: 1, arbitrary: fc.integer({ min: 56, max: 400 }) },
);

/** A request, the range it names as day numbers, and rows scattered across and around it. */
export type PeriodCase = {
  readonly request: PeriodRequest;
  /** The range's own first and last civil day — what the buckets have to cover exactly. */
  readonly firstDay: number;
  readonly lastDay: number;
  /** Rows from two days before the range to two days after it: in, out, and on the edge. */
  readonly rows: readonly PeriodRow[];
};

const requestOf = (base: {
  timezone: string;
  grain: (typeof PERIOD_GRAINS)[number];
  firstDay: number;
  span: number;
  nowPick: number;
  nowMinute: number;
  nowOffset: number;
}): { request: PeriodRequest; firstDay: number; lastDay: number } => {
  const lastDay = base.firstDay + base.span;
  // `now` lands from two days before the range to two days after it, so a period that has not
  // finished (R-E2's third cause) is reached as often as one that has.
  const nowDay = base.firstDay - 2 + Math.round((base.nowPick / 100) * (base.span + 4));
  return {
    firstDay: base.firstDay,
    lastDay,
    request: {
      timezone: base.timezone,
      grain: base.grain,
      range: { start: civilDateAt(base.firstDay), end: civilDateAt(lastDay) },
      now: instantAt(nowDay * MS_PER_DAY + base.nowMinute * MS_PER_MINUTE, base.nowOffset),
    },
  };
};

/** A whole period case: a checkable request plus the rows the buckets have to place. */
export const periodCaseArb: fc.Arbitrary<PeriodCase> = fc
  .record({
    timezone: fc.constantFrom(...TIMEZONES),
    grain: fc.constantFrom(...PERIOD_GRAINS),
    firstDay: fc.integer({ min: ANCHOR_DAY - 400, max: ANCHOR_DAY + 400 }),
    span: spanArb,
    nowPick: fc.integer({ min: 0, max: 100 }),
    nowMinute: minuteArb,
    nowOffset: offsetArb,
  })
  .map(requestOf)
  .chain((planned) =>
    fc
      .array(instantBetweenArb(planned.firstDay - 2, planned.lastDay + 2), { maxLength: 12 })
      .map((instants) => ({
        ...planned,
        rows: instants.map((started) => ({ started_at: started })),
      })),
  );
