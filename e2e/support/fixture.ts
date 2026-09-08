// The committed fixture, read as data — the half of T-E4's search set that must not be decided
// by the application.
//
// **Split out of `./costs` for size only.** Everything here was in that file's header and still
// obeys it: the fixture JSON is read straight off disk with `node:fs`, and nothing in `src/` is
// called to decide what the test allows. Using `src/data/load.ts` or `src/domain/periods.ts`
// here would be circular — a filter that wrongly emitted another Member's rows would emit the
// same values into the allow-list, and the leak would become invisible. The only rule borrowed
// from the product is R-M2: hidden rows are dropped, exactly as `load.ts` drops them at parse,
// because a row nothing can render is not a row anything can leak.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The fields of a raw fixture session row this suite reads. Deliberately the JSON shape and not
 * `AgentSession`: importing the domain type is harmless, but stating the shape here is what
 * makes the "no application code decides what the test allows" property visible at a glance.
 */
export type SessionRow = {
  readonly member_id: string;
  readonly cost: number;
  readonly hidden: boolean;
  readonly started_at: string;
  readonly ended_at: string;
  readonly task_key: string;
  readonly repository_id: string;
  readonly work_type: string;
  readonly execution_mode: string;
  readonly accepted: boolean;
};

const FIXTURE_DIRECTORY = join(process.cwd(), "src", "fixtures", "data");

const readFixture = <Shape>(...path: readonly string[]): Shape =>
  JSON.parse(readFileSync(join(FIXTURE_DIRECTORY, ...path), "utf8")) as Shape;

/** R-M10 — boundaries fall in the Organization's declared timezone, never UTC. */
export const orgTimezone = (): string =>
  readFixture<{ readonly timezone: string }>("organization.json").timezone;

/**
 * Every session the product can render, hidden rows already gone (R-M2). Read straight off
 * disk: `load.ts` is the application's door to the fixture, and this is not the application.
 */
export const visibleSessions = (): readonly SessionRow[] =>
  readdirSync(join(FIXTURE_DIRECTORY, "sessions"))
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => readFixture<readonly SessionRow[]>("sessions", name))
    .filter((row) => !row.hidden);

// --- The published token rate card (R-N11) ----------------------------------------------------
//
// **A rate card is not a Member's datapoint.** R-N11 requires the illustrative *token* card to
// render as a collapsed table at the foot of `/demo/spend` — it is the published evidence for
// every money figure in the product, identical for every viewer, and no subject scope governs
// it. Two of its figures collide by value with other Members' session costs (`1.25`, the cache-
// write multiplier, and `1.5`, one model's output rate), which is the same value-identity
// confusion the quotient subtraction exists to fix, on a different kind of figure.
//
// **The compute card is deliberately absent from this list.** A18 says it appears on no surface
// and T-E9 crawls for it; leaving its rates in T-E4's search set means two tests would fail if
// it ever shipped, which is strictly stronger than one.

type TokenRate = {
  readonly uncached_input: number;
  readonly cache_read: number;
  readonly cache_write: number;
  readonly output: number;
};

type RateCards = {
  readonly token: {
    /** The derivation multipliers, rendered as `1.25×` beside the per-model rates. */
    readonly derivation: TokenRate;
    readonly rates: readonly TokenRate[];
  };
};

/** The four priced token classes. Named, so a `model_id` string cannot arrive as a "figure". */
const TOKEN_CLASSES = ["uncached_input", "cache_read", "cache_write", "output"] as const;

const figuresOf = (rate: TokenRate): readonly number[] =>
  TOKEN_CLASSES.map((tokenClass) => rate[tokenClass]);

/** Every number the R-N11 token card puts on the page: the multipliers and the per-model rates. */
export const tokenRateCardFigures = (): readonly number[] => {
  const card = readFixture<RateCards>("rate_cards.json").token;
  return [...figuresOf(card.derivation), ...card.rates.flatMap(figuresOf)];
};

// --- Period bucketing, reimplemented rather than imported --------------------------------------
//
// `src/domain/periods.ts` is the product's own answer to "which week is this row in", and the
// test asking it would again be the code under test deciding what the test allows. It is thirty
// lines of civil-date arithmetic; the convention it follows — ISO weeks, Monday start, buckets
// in the Organization's timezone — is what is being matched, not the implementation.

const MS_PER_DAY = 86_400_000;

/** `YYYY-MM-DD` → whole days since 1970-01-01. `Date.UTC` is arithmetic, not a clock read. */
const dayNumberOf = (civil: string): number =>
  Date.UTC(Number(civil.slice(0, 4)), Number(civil.slice(5, 7)) - 1, Number(civil.slice(8, 10))) /
  MS_PER_DAY;

/** Day 0 (1970-01-01) was a Thursday, so `day + 3` is days since the preceding Monday. */
const startOfWeek = (day: number): number => day - ((((day + 3) % 7) + 7) % 7);

/** `2026-W15` — the ISO week-numbering key, fixed by the week's Thursday. */
const isoWeekKey = (day: number): string => {
  const monday = startOfWeek(day);
  const year = new Date((monday + 3) * MS_PER_DAY).getUTCFullYear();
  const firstMonday = startOfWeek(dayNumberOf(`${year}-01-04`));
  return `${year}-W${String((monday - firstMonday) / 7 + 1).padStart(2, "0")}`;
};

/** An instant → the civil day it fell on in one fixed timezone. Built once per call site. */
export const civilDayIn = (timezone: string): ((instant: string) => string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (instant) => {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
};

/** The three grains a row lands in: `2026-08-03`, `2026-W32`, `2026-08`. */
export const periodKeysOf = (civil: string): readonly string[] => [
  civil,
  isoWeekKey(dayNumberOf(civil)),
  civil.slice(0, 7),
];
