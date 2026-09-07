// T-U19 — session duration, and T-U20 — the human-presence spans (`testing-spec.md` § 3.2,
// `spec.md` R-M1, R-N14, A27, `technical-spec.md` R-T12), ticket 26.
//
// These are pure unit tests: `src/domain/**` may not reach the data layer (R-T5), so every row
// below is authored inline and every figure is exact. The same claims are re-asserted against
// the committed fixture in `src/data/duration.fixture.test.ts` (P6), where R-D13's interactive
// service account and headless humans make `execution_mode` and `Member.kind` genuinely
// independent.
//
// **The test this file must not contain.** T-U19 is explicit that the mean *is not computed*.
// So there is no expectation below naming an average, and the absence is asserted twice — over
// the summary's own keys and over the module's export surface — so that adding a mean later
// fails a test rather than passing one silently.

import { describe, expect, it } from "vitest";
import * as durationModule from "./duration";
import {
  DURATION_PERCENTILES,
  PRESENCE_SPANS,
  durationSummary,
  sessionDurationSeconds,
  sessionDurationSummary,
  spanComposition,
  spanFaults,
  medianOf,
  spansOf,
  type SpanRow,
} from "./duration";

/** A row carrying the three spans and the total they must make. */
const row = (
  mode: SpanRow["execution_mode"],
  spans: readonly [number, number, number],
  machine = spans[0] + spans[1] + spans[2],
): SpanRow => ({
  execution_mode: mode,
  interactive_duration_s: spans[0],
  idle_duration_s: spans[1],
  afk_duration_s: spans[2],
  machine_allocation_duration_s: machine,
});

/**
 * A right-skewed sample: nine ordinary sessions and one overnight run. The mean is 3804 — a
 * figure larger than nine of the ten sessions and one that nobody ran. That is the whole
 * reason R-M1 asks for the median and p95 instead.
 */
const RIGHT_SKEWED = [300, 60, 120, 36_000, 180, 60, 600, 240, 360, 120];
const MEAN_OF_RIGHT_SKEWED = 3804;

describe("T-U19 — median and p95, on a right-skewed distribution (R-M1)", () => {
  const summary = durationSummary(RIGHT_SKEWED);

  it("reports the median and p95 and nothing between them", () => {
    expect(summary).toEqual({ count: 10, median: 180, p95: 36_000 });
    expect(DURATION_PERCENTILES).toEqual({ median: 0.5, p95: 0.95 });
  });

  it("puts the mean above nine of the ten sessions — which is why it is not reported", () => {
    const mean = RIGHT_SKEWED.reduce((running, value) => running + value, 0) / RIGHT_SKEWED.length;
    expect(mean).toBe(MEAN_OF_RIGHT_SKEWED);
    expect(RIGHT_SKEWED.filter((value) => value < mean)).toHaveLength(9);
    // Computed here, in the test, purely to show what the module declines to return.
    expect(summary.median).not.toBe(mean);
    expect(Object.values(summary)).not.toContain(mean);
  });

  it("does not interpolate: the median of an even sample is an observation, not a midpoint", () => {
    // Interpolating would return 15 — the mean of two observations, which is exactly the
    // operation this module refuses to perform anywhere.
    expect(durationSummary([10, 20]).median).toBe(10);
    expect(durationSummary([10, 20]).median).not.toBe(15);
    expect(durationSummary([1, 2, 3, 4])).toEqual({ count: 4, median: 2, p95: 4 });
  });

  it("sorts its input, so the answer does not depend on the order rows arrived in", () => {
    expect(durationSummary([...RIGHT_SKEWED].reverse())).toEqual(summary);
    expect(durationSummary([...RIGHT_SKEWED].sort((left, right) => left - right))).toEqual(summary);
  });

  it("returns null rather than zero over an empty population", () => {
    // A median of no sessions is not a session of no seconds, and a zero would render as one.
    expect(durationSummary([])).toEqual({ count: 0, median: null, p95: null });
  });

  it("returns the one observation for a population of one, at both percentiles", () => {
    expect(durationSummary([90])).toEqual({ count: 1, median: 90, p95: 90 });
  });
});

describe("T-U19 — the API does not expose a mean, asserted as an absence", () => {
  it("carries exactly three fields on the summary, and no fourth to fill in", () => {
    expect(Object.keys(durationSummary(RIGHT_SKEWED)).sort()).toEqual(["count", "median", "p95"]);
    expect("mean" in durationSummary(RIGHT_SKEWED)).toBe(false);
    expect("average" in durationSummary(RIGHT_SKEWED)).toBe(false);
  });

  it("exports no averaging function under any of its names", () => {
    const averaging = Object.keys(durationModule).filter((name) =>
      /mean|average|avg/i.test(name),
    );
    expect(averaging).toEqual([]);
  });

  it("names only the two percentiles the product reports", () => {
    expect(Object.keys(DURATION_PERCENTILES)).toEqual(["median", "p95"]);
  });
});

describe("T-U19 — session duration is wall clock from start to end", () => {
  const session = { started_at: "2026-04-29T22:05:24+02:00", ended_at: "2026-04-30T00:04:35+02:00" };

  it("reads the two stored instants, across a midnight and an offset", () => {
    expect(sessionDurationSeconds(session)).toBe(7151);
  });

  it("summarises a population of sessions with the same two percentiles", () => {
    const sessions = [
      session,
      { started_at: "2026-05-02T09:00:00+02:00", ended_at: "2026-05-02T09:10:00+02:00" },
      { started_at: "2026-05-02T11:00:00+02:00", ended_at: "2026-05-02T11:30:00+02:00" },
    ];
    expect(sessionDurationSummary(sessions)).toEqual({ count: 3, median: 1800, p95: 7151 });
    expect(sessionDurationSummary([])).toEqual({ count: 0, median: null, p95: null });
  });
});

describe("T-U20 — the three spans partition machine allocation exactly (R-T12)", () => {
  it("reads the three spans under their presence names", () => {
    expect(spansOf(row("interactive", [100, 50, 250]))).toEqual({
      interactive: 100,
      idle: 50,
      afk: 250,
    });
    expect(PRESENCE_SPANS).toEqual(["interactive", "idle", "afk"]);
  });

  it("finds no fault in a well-formed row, in either execution mode", () => {
    expect(spanFaults(row("interactive", [100, 50, 250]))).toEqual([]);
    expect(spanFaults(row("headless", [0, 0, 800]))).toEqual([]);
  });

  it("faults a row whose spans do not sum to machine allocation", () => {
    // One second out is a fault: R-T12 says exactly, and a stacked composition that is one
    // second short is a composition asserting a partition it does not have (R-V1).
    expect(spanFaults(row("interactive", [100, 50, 250], 401))).toEqual(["spans-do-not-sum"]);
    expect(spanFaults(row("interactive", [100, 50, 250], 399))).toEqual(["spans-do-not-sum"]);
  });

  it("faults a headless row holding any human time at all", () => {
    // A headless session is AFK for its entire lifetime by construction: 100% AFK, zero
    // interactive, zero idle. One second of either is the invariant broken.
    expect(spanFaults(row("headless", [1, 0, 799]))).toEqual(["headless-holds-human-time"]);
    expect(spanFaults(row("headless", [0, 1, 799]))).toEqual(["headless-holds-human-time"]);
    // The same spans on an interactive row are ordinary and fault nothing.
    expect(spanFaults(row("interactive", [1, 0, 799]))).toEqual([]);
  });

  it("faults a negative span, and reports every fault a row commits", () => {
    const broken = row("headless", [5, -10, 800], 800);
    expect(spanFaults(broken)).toEqual([
      "negative-span",
      "spans-do-not-sum",
      "headless-holds-human-time",
    ]);
  });
});

describe("T-U20 — the composition is computed over interactive sessions only (R-N14, A27)", () => {
  const SESSIONS: readonly SpanRow[] = [
    row("interactive", [100, 50, 250]),
    row("interactive", [200, 100, 100]),
    // 800 AFK seconds that must not reach the composition.
    row("headless", [0, 0, 800]),
  ];
  const composition = spanComposition(SESSIONS);

  it("totals the two interactive sessions and leaves the headless one out", () => {
    expect(composition.sessions).toBe(2);
    expect(composition.excluded).toBe(1);
    expect(composition.total).toBe(800);
    expect(composition.slices).toEqual([
      { key: "interactive", total: 300, share: 0.375 },
      { key: "idle", total: 150, share: 0.1875 },
      { key: "afk", total: 350, share: 0.4375 },
    ]);
  });

  it("would report a different AFK share over both modes — the reading R-N14 forbids", () => {
    // Over all three sessions AFK is 1150 of 1600, or 71.875%. A composition spanning both
    // modes reports the headless population's existence, not human presence.
    const acrossBothModes = 1150 / 1600;
    expect(composition.slices[2]?.share).not.toBeCloseTo(acrossBothModes, 5);
    expect(composition.slices[2]?.share).toBeCloseTo(350 / 800, 12);
  });

  it("takes no execution mode: the restriction is not a caller's to lift", () => {
    // Handing it only headless rows yields an empty composition rather than a headless one,
    // because there is no parameter that selects the population.
    const headlessOnly = spanComposition([row("headless", [0, 0, 800])]);
    expect(headlessOnly.executionMode).toBe("interactive");
    expect(headlessOnly.sessions).toBe(0);
    expect(headlessOnly.excluded).toBe(1);
    expect(headlessOnly.total).toBe(0);
    expect(headlessOnly.slices.map((slice) => slice.share)).toEqual([0, 0, 0]);
    expect(spanComposition([]).total).toBe(0);
  });

  it("states the restriction in words, with the counts the figures were computed from (A27)", () => {
    expect(composition.note).toContain("Interactive sessions only: 2 of 3");
    expect(composition.note).toContain("1 headless session is excluded");
    expect(spanComposition([...SESSIONS, row("headless", [0, 0, 10])]).note).toContain(
      "2 headless sessions are excluded",
    );
  });

  it("stacks legitimately, because the slices sum to the total exactly (R-V1)", () => {
    expect(composition.stackable).toBe(true);
    const summed = composition.slices.reduce((running, slice) => running + slice.total, 0);
    expect(summed).toBe(composition.total);
    expect(composition.slices.reduce((running, slice) => running + slice.share, 0)).toBeCloseTo(1, 12);
    // And the total is the interactive population's machine allocation, read independently.
    const machine = SESSIONS.filter((session) => session.execution_mode === "interactive").reduce(
      (running, session) => running + session.machine_allocation_duration_s,
      0,
    );
    expect(composition.total).toBe(machine);
  });
});

describe("the median R-N17's comparator reads", () => {
  it("is the nearest-rank median — an observation, never the mean of two", () => {
    expect(medianOf([4, 1, 3, 2])).toBe(2);
    expect(medianOf([10, 20, 30])).toBe(20);
  });

  it("is `null` over an empty sample — a median of nothing is not zero", () => {
    expect(medianOf([])).toBeNull();
  });

  it("is the same arithmetic a duration is read with, on the same sample", () => {
    const sample = [90, 30, 60, 5000];
    expect(medianOf(sample)).toBe(durationSummary(sample).median);
  });
});
