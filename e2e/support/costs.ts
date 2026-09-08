// T-E4's cost search set — the literals a leak would be made of, and nothing else.
//
// **The defect this module exists to fix: value identity is not fact identity.** The earlier
// construction was "every other Member's session `cost`, minus the viewer's own session costs".
// But the restricted account holds `self` over `cost` (R-A3.1), so it legitimately renders
// *aggregates* of its own rows — weekly totals, per-Repository totals, tile figures — and a
// legitimate own-aggregate can equal some other Member's individual session cost by arithmetic
// coincidence. Ticket 31 measured exactly that: 15 values flagged on `/demo/spend` were all
// mirror `<td>` cells holding the viewer's own weekly cost, colliding by value with rows the
// viewer holds no grant over. There are 439 distinct two-decimal literals in a narrow money
// range, so almost any legitimate money figure has a real chance of tripping the assertion.
//
// The fix is to make the search set **discriminate**, not to relax the claim: subtract every
// value the viewer's *own granted rows* can legitimately produce. What stays in the set is
// still a bare, unformatted decimal — requiring a leak to look like `$24.39` would be a
// weakening, because the RSC flight payload carries raw props and a leaked `24.39` would never
// match a currency pattern.
//
// **This reads the committed fixture JSON directly and never calls `src/data/queries.ts`.**
// Deciding what the test permits by running the code under test is circular: a filter that
// wrongly emitted another Member's rows would emit the same values into the allow-list, and the
// leak would become invisible. The only thing borrowed from the application is R-M2 — hidden
// rows are dropped, exactly as `src/data/load.ts` drops them at parse — because a row nothing
// can render is not a row anything can leak.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The fields of a raw fixture session row this module reads. Deliberately the JSON shape and
 * not `AgentSession`: importing the domain type is harmless, but stating the shape here is what
 * makes the "no application code decides what the test allows" property visible at a glance.
 */
type SessionRow = {
  readonly member_id: string;
  readonly cost: number;
  readonly hidden: boolean;
  readonly started_at: string;
  readonly repository_id: string;
  readonly work_type: string;
  readonly execution_mode: string;
  readonly accepted: boolean;
};

const FIXTURE_DIRECTORY = join(process.cwd(), "src", "fixtures", "data");

const readFixture = <Shape>(...path: readonly string[]): Shape =>
  JSON.parse(readFileSync(join(FIXTURE_DIRECTORY, ...path), "utf8")) as Shape;

/** R-M10 — boundaries fall in the Organization's declared timezone, never UTC. */
const orgTimezone = (): string =>
  readFixture<{ readonly timezone: string }>("organization.json").timezone;

/**
 * Every session the product can render, hidden rows already gone (R-M2). Read straight off
 * disk: `load.ts` is the application's door to the fixture, and this is not the application.
 */
const visibleSessions = (): readonly SessionRow[] =>
  readdirSync(join(FIXTURE_DIRECTORY, "sessions"))
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => readFixture<readonly SessionRow[]>("sessions", name))
    .filter((row) => !row.hidden);

// --- Period bucketing, reimplemented rather than imported ------------------------------------
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
const civilDayIn = (timezone: string): ((instant: string) => string) => {
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
const periodKeysOf = (civil: string): readonly string[] => [
  civil,
  isoWeekKey(dayNumberOf(civil)),
  civil.slice(0, 7),
];

// --- What the viewer's own rows can legitimately add up to -------------------------------------

/** The whole-window "bucket": the ungrouped totals a tile carries (R-N8). */
const WHOLE_WINDOW = "*";

/**
 * The groupings a cost panel splits by. `all` is the bucket's own total — the row total of a
 * mirror table, and the value of a single-series chart point.
 */
const groupKeysOf = (row: SessionRow): readonly string[] => [
  "all",
  `repository:${row.repository_id}`,
  `work-type:${row.work_type}`,
  `execution-mode:${row.execution_mode}`,
  `accepted:${String(row.accepted)}`,
];

/**
 * Every total the viewer's own rows can produce: the grand total, each period bucket at each
 * grain, each grouping, and the **cross product** of the two — which is precisely what one cell
 * of an R-X1 chart mirror holds.
 */
const grantedTotals = (rows: readonly SessionRow[], timezone: string): readonly number[] => {
  const civilDayOf = civilDayIn(timezone);
  const totals = new Map<string, number>();
  for (const row of rows) {
    for (const period of [WHOLE_WINDOW, ...periodKeysOf(civilDayOf(row.started_at))]) {
      for (const group of groupKeysOf(row)) {
        const key = `${period}|${group}`;
        totals.set(key, (totals.get(key) ?? 0) + row.cost);
      }
    }
  }
  return [...totals.values()];
};

// --- Literals ----------------------------------------------------------------------------------

/** Locale-pinned exactly as `table-mirror.tsx` and `data-table.tsx` pin it. */
const MONEY = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/**
 * Every decimal literal a string contains, as written.
 *
 * The lookarounds exclude letters and hyphens as well as digits and dots, so a decimal that is
 * part of a longer *identifier* is not read as a number. Without that, `gemini-3.1-pro-preview`
 * contributes `3.1` — and some Member's session cost is 3.1, so R-N20.1's Model mix (the one
 * surface in the product allowed to carry a per-session Model breakdown) tripped T-E4 on a model
 * version string. Measured on the restricted `/demo/history` payload: the difference between the
 * loose and strict forms is exactly `{3.1, 3.5}`, both from model ids.
 *
 * This does not narrow the search for a leak. A cost that has actually escaped reaches the wire as
 * `,24.39]`, `"24.39"`, `>24.39<` or `$24.39` — every one of those still matches, because none of
 * the excluded characters can sit against the digits. The named guards hold either way: `24.39`
 * stays in the search set and `13.04` stays out.
 */
const DECIMAL_LITERAL = /(?<![\d.\-A-Za-z])\d+\.\d+(?![\d.\-A-Za-z])/g;

export const decimalsIn = (payload: string): ReadonlySet<string> =>
  new Set(payload.match(DECIMAL_LITERAL) ?? []);

/**
 * The literals one legitimate figure could contribute to the payload, found the same way the
 * payload is searched rather than guessed at.
 *
 * Three renderings, because the figure reaches the browser in three shapes: the raw prop in the
 * RSC flight payload (`String`), a two-decimal money figure, and the grouped `en-GB` form —
 * whose thousands separator means `1,234.56` contributes the literal `234.56`, which is the kind
 * of collision that is impossible to reason about and trivial to measure.
 */
const literalsOf = (value: number): readonly string[] =>
  [String(value), value.toFixed(2), MONEY.format(value)].flatMap(
    (rendering) => rendering.match(DECIMAL_LITERAL) ?? [],
  );

const literalsFor = (figures: readonly number[]): Set<string> => {
  const literals = new Set<string>();
  for (const figure of figures) {
    for (const literal of literalsOf(figure)) literals.add(literal);
  }
  return literals;
};

/**
 * Cost literals the viewer holds no grant over, and which its own granted rows cannot produce.
 *
 * Both sides go through the same three renderings, which is what keeps the two comparable: an
 * ungranted cost of `2` is searched for as `2.00` because that is the only shape of it a
 * decimal search can find, and the viewer's own cost of `2` is subtracted in the same shape.
 * Subtracted, in order: the viewer's own individual session costs, and every total those rows
 * can legitimately be aggregated into. What remains is a value that can only have come from a
 * row the viewer holds no scope over — which is the claim T-E4 makes.
 */
export const ungrantedCostLiterals = (viewerMemberId: string): ReadonlySet<string> => {
  const rows = visibleSessions();
  const own = rows.filter((row) => row.member_id === viewerMemberId);

  const granted = literalsFor([...own.map((row) => row.cost), ...grantedTotals(own, orgTimezone())]);
  const ungranted = literalsFor(
    rows.filter((row) => row.member_id !== viewerMemberId).map((row) => row.cost),
  );

  for (const literal of granted) ungranted.delete(literal);
  return ungranted;
};
