// T-U19 and T-U20 against the **committed** fixture (`spec.md` R-M1, R-N14, A27, R-D13,
// `technical-spec.md` R-T12, P6), ticket 26.
//
// The pure unit tests live in `src/domain/metrics/duration.test.ts` and author every row inline,
// because `src/domain/**` may not reach the data layer (R-T5). This file sits outside that
// boundary, so it may import `load.ts` — and it exists because P6 says a test that would pass
// against an empty fixture is not a test.
//
// **The committed fixture is the dataset both tests ask for.** Its session durations are
// genuinely right-skewed — the mean sits above 460 of the 742 sessions — so "the mean is not
// meaningful" is a fact about these rows rather than a claim in a comment. And R-D13 seeds all
// four cells of `execution_mode × Member.kind`: the deploy service account runs 47 interactive
// sessions and humans run 185 headless ones, so a composition restricted by *mode* cannot be
// mistaken for one restricted by *who ran it*.
//
// It reads committed output and never runs the generator (P3, R-T20). It follows the precedent
// `aggregate.fixture.test.ts` set for the same reason.

import { describe, expect, it } from "vitest";
import {
  PRESENCE_SPANS,
  durationSummary,
  sessionDurationSeconds,
  sessionDurationSummary,
  spanComposition,
  spanFaults,
  spansOf,
} from "@/domain/metrics/duration";
import { loadDataset } from "./load";

const { members, sessions } = loadDataset();

const kindOf = new Map(members.map((member) => [member.id, member.kind]));
const interactive = sessions.filter((session) => session.execution_mode === "interactive");
const headless = sessions.filter((session) => session.execution_mode === "headless");

const totalOf = (rows: readonly { machine_allocation_duration_s: number }[]): number =>
  rows.reduce((running, row) => running + row.machine_allocation_duration_s, 0);

describe("T-U19 — median and p95 on the committed, right-skewed distribution (R-M1)", () => {
  const summary = sessionDurationSummary(sessions);

  it("reports the fixture's median and p95", () => {
    expect(summary).toEqual({ count: 742, median: 8512, p95: 21_293 });
  });

  it("is right-skewed on real rows: the mean sits above 62% of the sessions", () => {
    const durations = sessions.map(sessionDurationSeconds);
    const mean = durations.reduce((running, value) => running + value, 0) / durations.length;
    expect(mean).toBeCloseTo(10_020.36, 2);
    expect(mean).toBeGreaterThan(summary.median ?? 0);
    expect(durations.filter((value) => value < mean)).toHaveLength(460);
    // The figure the product declines to report, computed here only to show the gap: it is
    // 18% above the median, and no session ran for it.
    expect(summary.median).not.toBe(mean);
  });

  it("returns durations sessions actually had, at both percentiles", () => {
    const durations = sessions.map(sessionDurationSeconds);
    expect(durations).toContain(summary.median);
    expect(durations).toContain(summary.p95);
  });

  it("reads the same figure off the stored spans as off the two stored instants", () => {
    // Wall clock and machine allocation are different claims that happen to agree on every
    // committed row. Asserting it here is what lets `duration.ts` prefer the instants.
    for (const session of sessions) {
      expect(sessionDurationSeconds(session)).toBe(session.machine_allocation_duration_s);
    }
    expect(durationSummary(sessions.map((session) => session.machine_allocation_duration_s))).toEqual(
      sessionDurationSummary(sessions),
    );
  });
});

describe("T-U20 — the three spans sum to machine allocation on every row (R-T12)", () => {
  it("finds no span fault anywhere in the committed fixture", () => {
    const faulty = sessions
      .filter((session) => spanFaults(session).length > 0)
      .map((session) => `${session.id}: ${spanFaults(session).join(", ")}`);
    expect(faulty).toEqual([]);
  });

  it("sums exactly, row by row — not within a tolerance", () => {
    for (const session of sessions) {
      const spans = spansOf(session);
      const summed = PRESENCE_SPANS.reduce((running, span) => running + spans[span], 0);
      expect(summed).toBe(session.machine_allocation_duration_s);
    }
  });

  it("makes every headless session 100% AFK, with zero interactive and zero idle", () => {
    expect(headless).toHaveLength(263);
    for (const session of headless) {
      expect(spansOf(session)).toEqual({
        interactive: 0,
        idle: 0,
        afk: session.machine_allocation_duration_s,
      });
    }
  });
});

describe("T-U20 — the composition is interactive sessions only (R-N14, A27)", () => {
  const composition = spanComposition(sessions);

  it("totals the 479 interactive sessions and excludes the 263 headless ones", () => {
    expect(composition.sessions).toBe(479);
    expect(composition.excluded).toBe(263);
    expect(composition.sessions + composition.excluded).toBe(sessions.length);
    expect(composition.total).toBe(totalOf(interactive));
    expect(composition.slices).toEqual([
      { key: "interactive", total: 1_645_977, share: 1_645_977 / 4_398_464 },
      { key: "idle", total: 1_230_125, share: 1_230_125 / 4_398_464 },
      { key: "afk", total: 1_522_362, share: 1_522_362 / 4_398_464 },
    ]);
  });

  it("reports an AFK share of 35%, where both modes together would report 61%", () => {
    // The reading R-N14 forbids, computed here so the difference is a number rather than an
    // argument: including the headless population nearly doubles the AFK share, and the
    // composition stops being about human presence at all.
    const afkAcrossBothModes =
      sessions.reduce((running, session) => running + session.afk_duration_s, 0) / totalOf(sessions);
    expect(afkAcrossBothModes).toBeCloseTo(0.613, 3);
    expect(composition.slices[2]?.share).toBeCloseTo(0.346, 3);
  });

  it("stacks legitimately: the slices sum to the population's machine allocation (R-V1)", () => {
    expect(composition.stackable).toBe(true);
    expect(composition.slices.reduce((running, slice) => running + slice.total, 0)).toBe(
      composition.total,
    );
    expect(
      composition.slices.reduce((running, slice) => running + (slice.share ?? 0), 0),
    ).toBeCloseTo(1, 12);
  });

  it("says so, in words, with the counts it was computed from (A27)", () => {
    expect(composition.note).toContain("Interactive sessions only: 479 of 742");
    expect(composition.note).toContain("263 headless sessions are excluded");
  });
});

describe("R-D13 — `execution_mode` and `Member.kind` are independent, and stay so", () => {
  const cell = (kind: string, mode: string): number =>
    sessions.filter(
      (session) => kindOf.get(session.member_id) === kind && session.execution_mode === mode,
    ).length;

  it("fills all four cells: an interactive service account and headless humans", () => {
    expect(cell("service_account", "interactive")).toBe(47);
    expect(cell("human", "headless")).toBe(185);
    expect(cell("human", "interactive")).toBe(432);
    expect(cell("service_account", "headless")).toBe(78);
  });

  it("restricts the composition by mode, and by nothing about who ran the session", () => {
    // Restricting by Member.kind instead would keep the 78 headless service-account sessions
    // and drop the 47 interactive ones, and the totals would differ. They do differ, which is
    // what proves the filter reads the session's own field.
    const byHumanMembers = spanComposition(
      sessions.filter((session) => kindOf.get(session.member_id) === "human"),
    );
    expect(byHumanMembers.sessions).toBe(432);
    expect(byHumanMembers.total).not.toBe(spanComposition(sessions).total);
    // And the mode-restricted population includes the service account's interactive sessions.
    expect(spanComposition(sessions).sessions).toBe(432 + 47);
  });
});
