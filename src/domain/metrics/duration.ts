// Session duration and the human-presence spans — `CONTEXT.md` § Work (**Duration spans**) and
// § Metric Concepts (**Session duration**), `spec.md` R-M1 / R-N14 / R-N12 item 6 / A27,
// `technical-spec.md` R-T12, ticket 26. Tested by T-U19 and T-U20.
//
// **Median and p95. There is no mean, and there is nowhere to put one.** `CONTEXT.md`:
// *"Median and p95 are the meaningful aggregations; the distribution is right-skewed, so the
// mean is not."* A mean over a right-skewed distribution is dragged by the long AFK tail — the
// overnight headless run — and reports a typical session nobody ran. `DurationSummary` therefore
// has no `mean` field, this module exports no averaging function, and T-U19 asserts that as an
// **absence** over the module's own export surface rather than trusting the omission.
//
// The refusal reaches into the median itself: **percentiles are nearest-rank order statistics,
// never interpolated.** The textbook median of an even-sized sample is the midpoint of the two
// middle observations — which is a mean of two numbers, the one operation this module declines
// to perform. Nearest rank returns a duration some session actually had.
//
// **The three spans are a partition of machine allocation, keyed on the human** (R-T12):
// `interactive` + `idle` + `afk` = `machine_allocation_duration_s`, exactly, on every row. That
// exactness is what lets R-N12 item 6 stack them (R-V1); `spanFaults` is the same claim stated
// as something a fixture row can fail.
//
// **R-N14 / A27 — the composition is computed over `interactive` sessions only.** A `headless`
// session is AFK for its entire lifetime by construction, so a composition spanning both modes
// would merely rediscover which sessions were headless: on the committed fixture the AFK share
// moves from ~35% to ~61% and the figure stops being about human presence at all. The
// restriction is not a parameter — `spanComposition` takes sessions and applies it itself, the
// result's `executionMode` is the literal type `"interactive"`, and `note` carries the
// restriction in words so no surface can render the composition without saying so.
//
// **`execution_mode` is not `Member.kind`.** R-D13 seeds a `service_account` running
// `interactive` sessions and humans running `headless` ones precisely so the two bits stay
// independent. Nothing here reads a Member: the mode is a property of the session, and the
// filter above is on the session's own field.
//
// **Agent execution time is not recoverable from these three spans**, because the partition is
// keyed on the human rather than on the actor doing the work. `CONTEXT.md` accepts that
// explicitly; it is a stated limit, not a gap to close here.
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.
// `Date.parse` on a stored ISO string is deterministic — it reads a row, not a clock (P5).

import { ratio, type Ratio } from "../ratio";
import type { AgentSession } from "../types";

/** The three spans, keyed on human presence. Disjoint, and a partition of machine allocation. */
export const PRESENCE_SPANS = ["interactive", "idle", "afk"] as const;
export type PresenceSpan = (typeof PRESENCE_SPANS)[number];

/** The minimum the spans need from a session. `AgentSession` satisfies it structurally. */
export type SpanRow = Readonly<
  Pick<
    AgentSession,
    | "execution_mode"
    | "interactive_duration_s"
    | "idle_duration_s"
    | "afk_duration_s"
    | "machine_allocation_duration_s"
  >
>;

/** The minimum session duration needs: the two stored instants, and nothing derived. */
export type SessionWindow = Readonly<Pick<AgentSession, "started_at" | "ended_at">>;

/** A row's three spans under their presence names, so nothing downstream re-spells the fields. */
export const spansOf = (row: SpanRow): Readonly<Record<PresenceSpan, number>> => ({
  interactive: row.interactive_duration_s,
  idle: row.idle_duration_s,
  afk: row.afk_duration_s,
});

// --- Session duration: median and p95, and no third figure ---------------------------------

/**
 * The two aggregations the product reports, as data. The list is the whole inventory: R-M1
 * names median and p95, and a percentile absent from this record is one no surface may show.
 */
export const DURATION_PERCENTILES = { median: 0.5, p95: 0.95 } as const;

/**
 * **No `mean`.** The field is absent because the figure is meaningless on this distribution,
 * and its absence is asserted (T-U19). `null` where the population is empty — a median of no
 * sessions is not zero, and a zero would render as a real, wrong duration.
 */
export type DurationSummary = {
  readonly count: number;
  readonly median: number | null;
  readonly p95: number | null;
};

/**
 * Nearest rank: the smallest observation at or above the `p` fraction of the sorted sample. No
 * interpolation, so every figure returned is a duration a session actually had — and so that
 * the median of an even sample is not quietly the mean of two observations.
 */
const nearestRank = (sorted: readonly number[], fraction: number): number =>
  sorted[Math.max(1, Math.ceil(fraction * sorted.length)) - 1];

/** Median and p95 over a population of durations in seconds. Sorted here, so input order is free. */
export function durationSummary(seconds: readonly number[]): DurationSummary {
  if (seconds.length === 0) return { count: 0, median: null, p95: null };
  const sorted = [...seconds].sort((left, right) => left - right);
  return {
    count: sorted.length,
    median: nearestRank(sorted, DURATION_PERCENTILES.median),
    p95: nearestRank(sorted, DURATION_PERCENTILES.p95),
  };
}

/**
 * The median of any sample, on the same nearest-rank rule.
 *
 * It lives in this module because this is where percentile arithmetic is defined
 * (`DURATION_PERCENTILES`), and R-N17's comparator — a Member's value beside their Comparison
 * group's **median** — must be the same median a duration is read with. Two implementations
 * would let one surface interpolate where the other does not, on the same fixture.
 */
export const medianOf = (values: readonly number[]): number | null => durationSummary(values).median;

/**
 * **Session duration — wall-clock from start to end**, `CONTEXT.md` § Metric Concepts. Read off
 * the two stored instants rather than off `machine_allocation_duration_s`: the two are the same
 * number on every committed row and `src/data/duration.fixture.test.ts` asserts it, but they
 * are different claims — one is when the session ran, the other is what it held a machine for.
 */
export const sessionDurationSeconds = (session: SessionWindow): number =>
  (Date.parse(session.ended_at) - Date.parse(session.started_at)) / 1000;

/** Median and p95 of wall-clock session duration over a population. Still no mean. */
export const sessionDurationSummary = (sessions: readonly SessionWindow[]): DurationSummary =>
  durationSummary(sessions.map(sessionDurationSeconds));

// --- Human-presence spans: a partition, over interactive sessions only ----------------------

/**
 * The ways a row can fail to be a valid span partition. A closed vocabulary, so a new way to be
 * wrong has to be named here rather than appear as a loose boolean somewhere.
 */
export const SPAN_FAULTS = [
  "negative-span",
  "spans-do-not-sum",
  "headless-holds-human-time",
] as const;
export type SpanFault = (typeof SPAN_FAULTS)[number];

/**
 * R-T12 and the `headless` invariant, as something a row can fail. The generator asserts both
 * as it writes; this is the re-assertion over committed data, and it is here rather than in the
 * fixture test so the rule has one statement that both layers read.
 *
 * A well-formed row returns `[]`. `headless` is checked on the session's own `execution_mode`
 * and never on a Member (R-D13).
 */
export function spanFaults(row: SpanRow): readonly SpanFault[] {
  const spans = spansOf(row);
  const faults: SpanFault[] = [];
  if (PRESENCE_SPANS.some((span) => spans[span] < 0)) faults.push("negative-span");
  const sum = PRESENCE_SPANS.reduce((running, span) => running + spans[span], 0);
  if (sum !== row.machine_allocation_duration_s) faults.push("spans-do-not-sum");
  if (row.execution_mode === "headless" && (spans.interactive > 0 || spans.idle > 0)) {
    faults.push("headless-holds-human-time");
  }
  return faults;
}

/** One span's figure and its share of machine allocation. */
export type SpanSlice = {
  readonly key: PresenceSpan;
  readonly total: number;
  /**
   * Share of `total`, or **`null` over a population that held no machine time at all**
   * (`ratio.ts`, R-M18). It read `0` until ticket 40: a share of nothing is not one third, and
   * it is not zero either — three spans each drawn at 0% claim a composition that was measured
   * and found empty, where the truth is that nothing was measured.
   */
  readonly share: Ratio;
};

/**
 * The R-N12 item 6 composition. `stackable` is `true` as a literal because the three spans
 * partition machine allocation exactly (R-T12), which is the one condition R-V1 stacks under.
 */
export type SpanComposition = {
  /** R-N14 — the population, in the type. There is no other value this field can hold. */
  readonly executionMode: "interactive";
  readonly sessions: number;
  /** The `headless` sessions the restriction left out, so a caption can say how many. */
  readonly excluded: number;
  readonly slices: readonly SpanSlice[];
  /** The slices summed — and the population's machine allocation exactly (R-T12). */
  readonly total: number;
  readonly stackable: true;
  /** A27 — the restriction in words, computed with the figures so it cannot contradict them. */
  readonly note: string;
};

const noteFor = (kept: number, excluded: number): string =>
  `Interactive sessions only: ${kept} of ${kept + excluded}. ` +
  `${excluded} headless ${excluded === 1 ? "session is" : "sessions are"} excluded — a headless ` +
  "session is AFK for its entire lifetime by construction, so including it would only " +
  "rediscover which sessions were headless.";

/**
 * **The composition, over `interactive` sessions only** (R-N14, A27).
 *
 * There is no mode parameter and no unfiltered variant: the restriction is applied here, once,
 * and a caller cannot opt out of it. The excluded count and the note come out of the same pass
 * as the figures, so the caption cannot disagree with the chart.
 */
export function spanComposition(sessions: readonly SpanRow[]): SpanComposition {
  const population = sessions.filter((session) => session.execution_mode === "interactive");
  const totals: Record<PresenceSpan, number> = { interactive: 0, idle: 0, afk: 0 };
  for (const row of population) {
    const spans = spansOf(row);
    for (const span of PRESENCE_SPANS) totals[span] += spans[span];
  }

  const total = PRESENCE_SPANS.reduce((running, span) => running + totals[span], 0);
  const excluded = sessions.length - population.length;
  return {
    executionMode: "interactive",
    sessions: population.length,
    excluded,
    slices: PRESENCE_SPANS.map((key) => ({
      key,
      total: totals[key],
      share: ratio(totals[key], total),
    })),
    total,
    stackable: true,
    note: noteFor(population.length, excluded),
  };
}
