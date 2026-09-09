// T-E4's cost search set — the literals a leak would be made of, and nothing else.
//
// **The defect this module exists to fix: value identity is not fact identity.** The original
// construction was "every other Member's session `cost`, minus the viewer's own session costs".
// But the restricted account holds `self` over `cost` (R-A3.1), so it legitimately renders
// *readings* of its own rows — weekly totals, per-Repository totals, tile figures, and the
// ratios those same rows divide out to — and a legitimate own reading can equal some other
// Member's individual session cost by arithmetic coincidence. There are ~525 distinct
// two-decimal literals in a narrow money range, so almost any legitimate figure has a real
// chance of tripping the assertion.
//
// The fix is to make the search set **discriminate**, not to relax the claim: subtract every
// value the viewer's *own granted rows* can legitimately produce. What stays in the set is
// still a bare, unformatted decimal — requiring a leak to look like `$24.39` would be a
// weakening, because the RSC flight payload carries raw props and a leaked `24.39` would never
// match a currency pattern.
//
// **Three classes are subtracted, and each was measured against a real failure.**
//
//   1. **Sums** (ticket 31). 15 values flagged on `/demo/spend` were mirror `<td>` cells holding
//      the viewer's own weekly cost.
//   2. **Quotients** (this ticket). A sum is not the only reading a granted row has. Every ratio
//      the product renders is `numerator-over-K ÷ denominator-over-K` for one (period × grouping)
//      key K, and those land in the same narrow range: 16 literals on `/demo/spend` were the
//      R-X1 mirrors of Cost per completed Job, Cost per session and cost per completed Job by
//      template, and three on `/demo/work` — `0.7`, `0.6`, `0.86` — were **acceptance rates**.
//      `/demo/work` renders no money figure at all: `WorkPageViewModel` carries counts, rates,
//      ages and seconds and has no cost field, so a money assertion failing there was proof the
//      search was unsound rather than a finding.
//   3. **The published token rate card** (R-N11), in `./fixture`, which is not a Member datapoint
//      at all. Its cache-write multiplier `1.25` and one model's output rate `1.5` were the last
//      two `/demo/spend` literals, and neither is anybody's cost.
//
// **The quotients are taken over matching keys only.** A cross product of every sum against
// every count would blanket the value space and gut the search set; the product never renders
// one bucket's cost over another bucket's session count, so neither does this.
//
// **The subtraction is built from the viewer's own rows and nothing else** — never the Team's,
// even though `team` over `jobs` (R-A3) means the rates on `/demo/work` are genuinely computed
// over the Team's sessions. A teammate's *cost* is ungranted (the `cost` view is `self`-only),
// so building the allow-list out of teammates' rows would let an ungranted cost mask itself.
// Own rows are the conservative source: every literal removed is one the viewer holds `self`
// over, at a (period × grouping) key the product actually reports.
//
// **This reads the committed fixture JSON directly and never calls `src/data/queries.ts`** — see
// `./fixture`, which holds the reading and the period arithmetic.

import {
  civilDayIn,
  orgTimezone,
  periodKeysOf,
  teamMatesOf,
  tokenRateCardFigures,
  visibleChildSessions,
  visibleSessions,
  type SessionRow,
} from "./fixture";

// --- What the viewer's own rows can legitimately be read as ------------------------------------

/** The whole-window "bucket": the ungrouped totals a tile carries (R-N8). */
const WHOLE_WINDOW = "*";

/**
 * The groupings a panel splits by. `all` is the bucket's own reading — the row total of a
 * mirror table, the value of a single-series chart point, and what every panel falls back to
 * when the page's own filters have narrowed the population instead.
 */
const groupKeysOf = (row: SessionRow): readonly string[] => [
  "all",
  `repository:${row.repository_id}`,
  `work-type:${row.work_type}`,
  `execution-mode:${row.execution_mode}`,
  `accepted:${String(row.accepted)}`,
];

/**
 * One (period × grouping) key's rows, reduced to the four quantities every reading in this
 * product divides or sums: money, sessions, accepted sessions, and the Tasks behind them.
 *
 * The Tasks are kept as their sessions rather than as counts because the Task-grain labels are
 * order-sensitive — Rework is "a non-accepted session **followed by** another".
 */
type Bucket = {
  cost: number;
  sessions: number;
  accepted: number;
  readonly tasks: Map<string, SessionRow[]>;
};

const emptyBucket = (): Bucket => ({ cost: 0, sessions: 0, accepted: 0, tasks: new Map() });

const absorb = (bucket: Bucket, row: SessionRow): void => {
  bucket.cost += row.cost;
  bucket.sessions += 1;
  if (row.accepted) bucket.accepted += 1;
  const held = bucket.tasks.get(row.task_key);
  if (held) held.push(row);
  else bucket.tasks.set(row.task_key, [row]);
};

/**
 * The viewer's own rows, bucketed the way every panel buckets them: the grand total, each
 * period bucket at each grain, each grouping, and the **cross product** of the two — which is
 * precisely what one cell of an R-X1 chart mirror holds.
 */
const grantedBuckets = (rows: readonly SessionRow[], timezone: string): readonly Bucket[] => {
  const civilDayOf = civilDayIn(timezone);
  const buckets = new Map<string, Bucket>();
  for (const row of rows) {
    for (const period of [WHOLE_WINDOW, ...periodKeysOf(civilDayOf(row.started_at))]) {
      for (const group of groupKeysOf(row)) {
        const key = `${period}|${group}`;
        const bucket = buckets.get(key) ?? emptyBucket();
        absorb(bucket, row);
        buckets.set(key, bucket);
      }
    }
  }
  return [...buckets.values()];
};

// --- The Task-grain labels, restated rather than imported --------------------------------------
//
// `src/domain/metrics/efficacy.ts` owns these for the product; restating them keeps the rule
// this file exists for. They are three one-line predicates and the definitions are R-M1's.

/** Start, then end — the order `efficacy.ts` reads "followed by" off. */
const inSessionOrder = (left: SessionRow, right: SessionRow): number =>
  Date.parse(left.started_at) - Date.parse(right.started_at) ||
  Date.parse(left.ended_at) - Date.parse(right.ended_at);

/** A Completed Task is a Task with at least one accepted session. */
const isCompleted = (sessions: readonly SessionRow[]): boolean =>
  sessions.some((session) => session.accepted);

/** Rework — a non-accepted session with another session after it, of any WorkType. */
const isRework = (sessions: readonly SessionRow[]): boolean =>
  [...sessions]
    .sort(inSessionOrder)
    .slice(0, -1)
    .some((session) => !session.accepted);

/** Decomposition — a second *accepted* session: work deliberately split, not work repeated. */
const isDecomposition = (sessions: readonly SessionRow[]): boolean =>
  sessions.filter((session) => session.accepted).length > 1;

const countOf = (
  tasks: ReadonlyMap<string, SessionRow[]>,
  holds: (sessions: readonly SessionRow[]) => boolean,
): number => [...tasks.values()].filter((sessions) => holds(sessions)).length;

/** A quotient, or nothing at all. Every denominator in this module goes through it. */
const over = (numerator: number, denominator: number): readonly number[] =>
  denominator === 0 ? [] : [numerator / denominator];

/**
 * The **money** ratios one (period × grouping) key reads out to: Cost per session and Cost per
 * completed Job (`/demo/spend`). Taken over the viewer's own rows only — a teammate's cost is
 * ungranted, so a teammate's money quotient could mask an ungranted cost.
 */
const moneyQuotients = (bucket: Bucket): readonly number[] => [
  ...over(bucket.cost, bucket.sessions),
  ...over(bucket.cost, countOf(bucket.tasks, isCompleted)),
];

/**
 * The **count** ratios: the acceptance rate (`/demo/work`, R-M6) and the two Task-grain rates
 * beside it. Every one of them is a count over a count and **cannot be a cost** — which is why
 * they are subtracted over the viewer's *Team* as well as over its own rows. R-A3 grants `team`
 * over `jobs`, so `/demo/work` computes these across the Team; a rate it renders is a figure the
 * viewer is entitled to, whatever some unrelated session happens to have cost.
 */
const countQuotients = (bucket: Bucket): readonly number[] => {
  const tasks = bucket.tasks.size;
  return [
    ...over(bucket.accepted, bucket.sessions),
    ...over(countOf(bucket.tasks, isRework), tasks),
    ...over(countOf(bucket.tasks, isDecomposition), tasks),
  ];
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
 * of collision that is impossible to reason about and trivial to measure. A quotient goes through
 * the **same** path as a sum, so `0.7`, `0.70` and `0.666…` are all covered identically.
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
 * Cost literals the viewer holds no grant over, and which nothing on the page can legitimately
 * produce.
 *
 * Both sides go through the same three renderings, which is what keeps the two comparable: an
 * ungranted cost of `2` is searched for as `2.00` because that is the only shape of it a
 * decimal search can find, and the viewer's own cost of `2` is subtracted in the same shape.
 * Subtracted, in order: the viewer's own individual session costs, every total those rows
 * aggregate to, every ratio those same rows divide out to at the same key, and the published
 * token rate card. What remains is a value that can only have come from a row the viewer holds
 * no scope over — which is the claim T-E4 makes.
 */
export const ungrantedCostLiterals = (viewerMemberId: string): ReadonlySet<string> => {
  // Roots carrying their fan-out — the population every page aggregates — and the child rows,
  // whose own cost `/demo/history` prints under the root that spawned them (R-M19, R-N20.2).
  const rows = [...visibleSessions(), ...visibleChildSessions()];
  const own = rows.filter((row) => row.member_id === viewerMemberId);
  // Bucketed over roots alone: a child is never a row in an aggregate, so no total or ratio in
  // the product is ever read over one.
  const buckets = grantedBuckets(
    own.filter((row) => row.parent_session_id === null),
    orgTimezone(),
  );

  // R-A3 — `team` over `jobs`, so the Task- and session-grain *rates* are read across the Team.
  // Counts only: no money figure is ever taken from this population.
  const mates = teamMatesOf(viewerMemberId);
  const teamBuckets = grantedBuckets(
    rows.filter((row) => row.parent_session_id === null && mates.has(row.member_id)),
    orgTimezone(),
  );

  const granted = literalsFor([
    ...own.map((row) => row.cost),
    ...buckets.map((bucket) => bucket.cost),
    ...buckets.flatMap(moneyQuotients),
    ...buckets.flatMap(countQuotients),
    ...teamBuckets.flatMap(countQuotients),
    ...tokenRateCardFigures(),
  ]);
  const ungranted = literalsFor(
    rows.filter((row) => row.member_id !== viewerMemberId).map((row) => row.cost),
  );

  for (const literal of granted) ungranted.delete(literal);
  return ungranted;
};
