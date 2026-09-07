// Period bucketing — `CONTEXT.md` § Period semantics, `spec.md` R-M10, R-M11, R-E2, R-D2, R-D5,
// `technical-spec.md` § 3.2, ticket 22. Tested by T-U1 and T-U8.
//
// The one place an off-by-one is both easy to write and invisible in a chart, so the whole
// module is arranged so that the two ways of getting it wrong are unavailable rather than
// discouraged:
//
//   * **R-M10 — boundaries fall in the Organization's declared timezone, never UTC.** Every
//     instant a row carries is converted to a *civil date* in that timezone before anything is
//     compared, and from that point on the module computes in civil-date space only. There is
//     no code path here that reads the process's local zone: the single conversion goes through
//     `Intl.DateTimeFormat` with an explicit `timeZone`, which needs no dependency and is
//     deterministic. `new Date(isoString)` parses; the zero-argument form never appears (P5).
//
//   * **R-M11 — day grain is available only over ranges of two months or less.** It is not
//     checked here and warned about there: `bucketRows` takes a `PeriodPlan`, and the only
//     expression in the program that produces one is `planPeriods` returning `ok`. The plan is
//     keyed on a module-private symbol, so it cannot be written by hand. An over-long day-grain
//     request therefore has no representation to render — the control layer (ticket 30) calls
//     the same `planPeriods`/`availableGrains` at URL-parse time and never offers the grain.
//
//   * **R-E2 — a partial period is flagged, never withheld or pro-rated.** One flag with three
//     causes, which is why it is one mechanism and not three: the period is clipped at the
//     start of the range (April), clipped at its end (September), or has not finished as of
//     `now` (the current month on `/demo/projection`).
//
// **"Now" is an argument** (P5). The fixture window ends 2026-09-08; a function reading the wall
// clock passes today and fails tomorrow. `now` is validated into the plan alongside the range.
//
// **Weeks start on Monday (ISO-8601), and week keys are ISO week-numbering keys** — `2026-W15`.
// Europe/Madrid is an ISO-week country, so a Sunday start would cut the working week in half on
// every chart. The week a date belongs to is fixed by that week's Thursday, which is what makes
// the turn of the year unambiguous.
//
// **No DST transition falls inside the fixture window** (R-D5), so the ambiguous-hour and
// missing-hour cases are explicitly not covered. The conversion above is exact for any instant;
// what is untested is a *local civil datetime* that occurs twice or not at all, and this module
// never has to construct one — it only ever reads a date off an instant. Recorded in the test
// file so a future reader does not mistake the gap for an oversight.
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

/** The three grains. `quarter` was dropped (`spec.md` § 11 C7) and nothing implements one. */
export const PERIOD_GRAINS = ["day", "week", "month"] as const;
export type PeriodGrain = (typeof PERIOD_GRAINS)[number];

/** The grains that survive R-M11 on any range. What a control offers when day grain does not fit. */
const COARSE_GRAINS: readonly PeriodGrain[] = ["week", "month"];

/**
 * An **inclusive** range of civil dates, `YYYY-MM-DD`, read in the Organization's timezone.
 * Civil rather than instants because that is how a viewer states a range: "12 Apr – 8 Sep".
 */
export type PeriodRange = { readonly start: string; readonly end: string };

/** The minimum a row needs to be bucketed. `AgentSession` satisfies it. */
export type PeriodRow = { readonly started_at: string };

const MS_PER_DAY = 86_400_000;
const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// --- Civil-date arithmetic ----------------------------------------------------------------
//
// The internal representation of a boundary is a **day number**: whole days since 1970-01-01,
// with no time and no zone attached. Two civil dates in the same zone compare by subtraction,
// which is the arithmetic a bucket boundary actually needs.

/** A civil year-month-day. No instant is attached, and none is needed. */
type CivilParts = { readonly year: number; readonly month: number; readonly day: number };

/** `Date.UTC` is arithmetic over numbers — it reads no clock — and it normalises overflow. */
const dayNumberOf = (parts: CivilParts): number =>
  Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY;

const civilDateOf = (day: number): string => new Date(day * MS_PER_DAY).toISOString().slice(0, 10);

const partsOf = (day: number): CivilParts => {
  const at = new Date(day * MS_PER_DAY);
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() };
};

/**
 * `YYYY-MM-DD` → day number, or `undefined`. The round trip is the validation: `Date.UTC` rolls
 * 2026-02-31 over into March, so a date that does not survive re-formatting was never a date.
 */
const parseCivilDate = (text: string): number | undefined => {
  if (!CIVIL_DATE_PATTERN.test(text)) return undefined;
  const day = dayNumberOf({
    year: Number(text.slice(0, 4)),
    month: Number(text.slice(5, 7)),
    day: Number(text.slice(8, 10)),
  });
  return civilDateOf(day) === text ? day : undefined;
};

/** ISO-8601 weekday: 1 = Monday … 7 = Sunday. Day 0 (1970-01-01) was a Thursday. */
const isoWeekday = (day: number): number => ((((day + 3) % 7) + 7) % 7) + 1;

const startOfWeek = (day: number): number => day - (isoWeekday(day) - 1);

const startOfMonth = (day: number): number => dayNumberOf({ ...partsOf(day), day: 1 });

/**
 * Calendar month arithmetic, clamped to the target month's last day: 31 January plus one month
 * is 28 February and not 3 March. Without the clamp the R-M11 limit would quietly stretch by a
 * day or two for ranges starting on the 29th, 30th or 31st.
 */
const addMonths = (day: number, months: number): number => {
  const parts = partsOf(day);
  const rolled = dayNumberOf({ year: parts.year, month: parts.month + months, day: parts.day });
  const lastOfTarget = dayNumberOf({ year: parts.year, month: parts.month + months + 1, day: 0 });
  return Math.min(rolled, lastOfTarget);
};

/** `2026-04`. */
const monthKey = (day: number): string => civilDateOf(day).slice(0, 7);

/**
 * `2026-W15` — the ISO week-numbering key. The week's Thursday fixes both the week-numbering
 * year and the week number, because 4 January is by definition in week 1.
 */
const isoWeekKey = (day: number): string => {
  const monday = startOfWeek(day);
  const year = partsOf(monday + 3).year;
  const firstMonday = startOfWeek(dayNumberOf({ year, month: 1, day: 4 }));
  return `${year}-W${String((monday - firstMonday) / 7 + 1).padStart(2, "0")}`;
};

/** How one grain finds its boundaries. Written as data so no branch chooses between them. */
type Boundary = {
  readonly startOf: (day: number) => number;
  readonly next: (start: number) => number;
  readonly keyOf: (start: number) => string;
};

const BOUNDARIES: Readonly<Record<PeriodGrain, Boundary>> = {
  day: { startOf: (day) => day, next: (start) => start + 1, keyOf: civilDateOf },
  week: { startOf: startOfWeek, next: (start) => start + 7, keyOf: isoWeekKey },
  month: { startOf: startOfMonth, next: (start) => addMonths(start, 1), keyOf: monthKey },
};

// --- The one timezone conversion ----------------------------------------------------------

/** An instant → the civil day it fell on in one fixed timezone. `undefined` if it is not an instant. */
type LocalDayOf = (instant: string) => number | undefined;

/** `undefined` for an unknown IANA zone: `Intl.DateTimeFormat` throws on one, and we do not. */
const formatterFor = (timezone: string): Intl.DateTimeFormat | undefined => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return undefined;
  }
};

/**
 * Builds the conversion once per plan. Parts are assembled explicitly rather than read out of a
 * formatted string, so the result does not depend on a locale's date order.
 */
const localDayFactory = (timezone: string): LocalDayOf | undefined => {
  const formatter = formatterFor(timezone);
  if (!formatter) return undefined;
  return (instant) => {
    const at = new Date(instant);
    if (Number.isNaN(at.getTime())) return undefined;
    const fields = Object.fromEntries(
      formatter.formatToParts(at).map((part) => [part.type, part.value]),
    );
    return parseCivilDate(`${fields.year}-${fields.month}-${fields.day}`);
  };
};

// --- The plan: where R-M11 is made unrepresentable ------------------------------------------

type Bounds = { readonly firstDay: number; readonly lastDay: number };

/** Everything `planPeriods` proved, carried so that `bucketRows` re-checks and re-parses nothing. */
type Validated = Bounds & { readonly nowDay: number; readonly localDayOf: LocalDayOf };

/**
 * Module-private, and deliberately not exported. A `PeriodPlan` is therefore not structurally
 * forgeable: no caller can write this key, so no caller can hand `bucketRows` a grain/range
 * combination that `planPeriods` refused. That is R-M11 made unrepresentable rather than warned
 * about — there is no "render it anyway" path to forget to guard.
 */
const VALIDATED: unique symbol = Symbol("periods/validated");

/** A checked (timezone × grain × range × now). The only input `bucketRows` accepts. */
export type PeriodPlan = {
  readonly grain: PeriodGrain;
  readonly timezone: string;
  readonly range: PeriodRange;
  readonly [VALIDATED]: Validated;
};

/** What a caller asks for. `now` is here because P5 makes it an argument, never a wall-clock read. */
export type PeriodRequest = {
  readonly timezone: string;
  readonly grain: PeriodGrain;
  readonly range: PeriodRange;
  /** An ISO 8601 instant. The Organization's timezone decides which civil day it falls on. */
  readonly now: string;
};

/** Why a request has no plan. Closed vocabulary, so a control can map each to its own copy. */
export const PLAN_REJECTIONS = [
  "invalid-range",
  "unknown-timezone",
  "invalid-now",
  "day-grain-needs-a-shorter-range",
] as const;
export type PlanRejectionReason = (typeof PLAN_REJECTIONS)[number];

export type PlanRejection = {
  readonly ok: false;
  readonly reason: PlanRejectionReason;
  readonly message: string;
  /** The grains that *are* available for this range — what the control offers instead. */
  readonly available: readonly PeriodGrain[];
};

export type PlanResult = { readonly ok: true; readonly plan: PeriodPlan } | PlanRejection;

const boundsOf = (range: PeriodRange): Bounds | undefined => {
  const firstDay = parseCivilDate(range.start);
  const lastDay = parseCivilDate(range.end);
  if (firstDay === undefined || lastDay === undefined || lastDay < firstDay) return undefined;
  return { firstDay, lastDay };
};

/**
 * R-M11, as a calendar fact rather than a day count: the range must end **before** the same
 * day-of-month two months on. 1 Apr – 31 May fits ("two months or less"); 12 Apr – 8 Sep does
 * not. A day count would have to pick between 59 and 62 and would be wrong in some month.
 */
const dayGrainFits = (bounds: Bounds): boolean => bounds.lastDay < addMonths(bounds.firstDay, 2);

/**
 * The grains a control may offer for this range (R-M11). A malformed range offers none: a range
 * that is not a range has no grain, and the control has nothing to render.
 */
export function availableGrains(range: PeriodRange): readonly PeriodGrain[] {
  const bounds = boundsOf(range);
  if (!bounds) return [];
  return dayGrainFits(bounds) ? PERIOD_GRAINS : COARSE_GRAINS;
}

/** Parses a grain out of a URL segment or query string. An unknown grain is not a grain. */
export function parseGrain(text: string | undefined): PeriodGrain | undefined {
  return PERIOD_GRAINS.find((grain) => grain === text);
}

const reject = (
  reason: PlanRejectionReason,
  message: string,
  range: PeriodRange,
): PlanRejection => ({ ok: false, reason, message, available: availableGrains(range) });

/**
 * The gate. Everything downstream of an `ok` result is total: `bucketRows` cannot throw and
 * cannot reject, because every way of being wrong was spent here.
 */
export function planPeriods(request: PeriodRequest): PlanResult {
  const { range, grain, timezone } = request;
  const bounds = boundsOf(range);
  if (!bounds) {
    return reject("invalid-range", `${range.start}..${range.end} is not a YYYY-MM-DD range`, range);
  }

  const localDayOf = localDayFactory(timezone);
  if (!localDayOf) {
    return reject("unknown-timezone", `${timezone} is not an IANA timezone`, range);
  }

  const nowDay = localDayOf(request.now);
  if (nowDay === undefined) {
    return reject("invalid-now", `${request.now} is not an ISO 8601 instant`, range);
  }

  if (grain === "day" && !dayGrainFits(bounds)) {
    return reject(
      "day-grain-needs-a-shorter-range",
      `day grain covers two months or less; ${range.start}..${range.end} is longer (R-M11)`,
      range,
    );
  }

  return {
    ok: true,
    plan: { grain, timezone, range, [VALIDATED]: { ...bounds, nowDay, localDayOf } },
  };
}

// --- Bucketing --------------------------------------------------------------------------

export type PeriodBucket<Row extends PeriodRow> = {
  /** Stable identity — `2026-04-12`, `2026-W15`, `2026-04`. A React `key`, never an index (R-T8). */
  readonly key: string;
  readonly grain: PeriodGrain;
  /** The period's own first civil day in the Organization's timezone, unclipped by the range. */
  readonly startsOn: string;
  /** The period's own last civil day, inclusive. */
  readonly endsOn: string;
  /** R-E2 — the period is clipped by the range at either end, or has not finished as of `now`. */
  readonly partial: boolean;
  readonly rows: readonly Row[];
};

/**
 * The three causes of R-E2's one flag: clipped at the start of the range (April), clipped at its
 * end, or not yet finished as of `now` (September, and the current month on `/demo/projection`).
 */
const isPartial = (start: number, endExclusive: number, validated: Validated): boolean =>
  start < validated.firstDay ||
  endExclusive - 1 > validated.lastDay ||
  validated.nowDay < endExclusive;

/**
 * Rows land by the civil day they *started* on, in the Organization's timezone. A row outside
 * the range — or carrying a timestamp that is not an instant — lands nowhere, which is what
 * keeps the returned buckets a partition of the range rather than of the input.
 */
const rowsByBucketStart = <Row extends PeriodRow>(
  plan: PeriodPlan,
  rows: readonly Row[],
): ReadonlyMap<number, Row[]> => {
  const { firstDay, lastDay, localDayOf } = plan[VALIDATED];
  const startOf = BOUNDARIES[plan.grain].startOf;
  const held = new Map<number, Row[]>();
  for (const row of rows) {
    const day = localDayOf(row.started_at);
    if (day === undefined || day < firstDay || day > lastDay) continue;
    const existing = held.get(startOf(day));
    if (existing) existing.push(row);
    else held.set(startOf(day), [row]);
  }
  return held;
};

/**
 * `(rows, timezone, grain) → buckets`, with the timezone and grain already checked into a plan.
 *
 * The buckets **partition the range**: they are contiguous, every one between the ends is
 * present even when it holds nothing, and every in-range row is in exactly one of them.
 */
export function bucketRows<Row extends PeriodRow>(
  plan: PeriodPlan,
  rows: readonly Row[],
): readonly PeriodBucket<Row>[] {
  const validated = plan[VALIDATED];
  const boundary = BOUNDARIES[plan.grain];
  const held = rowsByBucketStart(plan, rows);

  const buckets: PeriodBucket<Row>[] = [];
  for (
    let start = boundary.startOf(validated.firstDay);
    start <= validated.lastDay;
    start = boundary.next(start)
  ) {
    const endExclusive = boundary.next(start);
    buckets.push({
      key: boundary.keyOf(start),
      grain: plan.grain,
      startsOn: civilDateOf(start),
      endsOn: civilDateOf(endExclusive - 1),
      partial: isPartial(start, endExclusive, validated),
      rows: held.get(start) ?? [],
    });
  }
  return buckets;
}
