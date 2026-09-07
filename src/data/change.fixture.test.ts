// T-U3 against the **committed** fixture (R-M12, R-M13, A8, P3, P6).
//
// The pure unit tests live in `src/domain/change.test.ts` and author every figure inline,
// because `src/domain/**` may not reach the data layer (R-T5). This file sits outside that
// boundary, so it may import `load.ts` — and it exists because P6 says a test that would pass
// against an empty fixture is not a test.
//
// The floor is a rule about *narrow* views, so it needs a narrow view to act on. The committed
// roster supplies one: Noelia Gallego runs 1 · 0 · 0 · 1 · 1 · 0 sessions across the six months
// of the window. Two of her month-over-month comparisons have nothing to compare against and
// are suppressed; the two that do are shown, one of them a fall of −100%. Elena Sáez goes from
// one session in May to five in June — **+400% off a base of one, shown**, which is the case a
// magnitude threshold would delete and the reason R-M12 refuses to have one.
//
// It reads committed output and never runs the generator (P3, R-T20). It follows the precedent
// `periods.fixture.test.ts` set for the same reason.

import { describe, expect, it } from "vitest";
import {
  changeBetween,
  periodFigures,
  type Change,
  type PeriodFigure,
} from "@/domain/change";
import { bucketRows, planPeriods, type PeriodRange } from "@/domain/periods";
import type { AgentSession } from "@/domain/types";
import { loadDataset } from "./load";

const { organization, members, sessions } = loadDataset();

const WINDOW: PeriodRange = { start: organization.window_start, end: organization.window_end };
/** The last instant of the fixture window, in the Organization's timezone. P5: never a clock read. */
const NOW = `${organization.window_end}T23:59:59+02:00`;

const one = (): number => 1;

/** Monthly session counts over the whole window, for whatever population is handed in. */
const monthlyCounts = (rows: readonly AgentSession[]): readonly PeriodFigure[] => {
  const result = planPeriods({
    timezone: organization.timezone,
    grain: "month",
    range: WINDOW,
    now: NOW,
  });
  if (!result.ok) throw new Error(`plan unexpectedly rejected: ${result.reason}`);
  return periodFigures(bucketRows(result.plan, rows), one);
};

const forMember = (memberId: string): readonly PeriodFigure[] =>
  monthlyCounts(sessions.filter((session) => session.member_id === memberId));

const ORG = monthlyCounts(sessions);
const GALLEGO = forMember("mem_ngallego");
const SAEZ = forMember("mem_esaez");

/** April … September. The window is 12 Apr – 8 Sep, so the ends are partial (R-D2, A26). */
const monthAt = (figures: readonly PeriodFigure[], key: string): PeriodFigure => {
  const figure = figures.find((held) => held.key === key);
  if (!figure) throw new Error(`no ${key} bucket`);
  return figure;
};

const changeInto = (figures: readonly PeriodFigure[], key: string): Change => {
  const index = figures.findIndex((held) => held.key === key);
  return changeBetween({ current: figures[index], prior: figures[index - 1] });
};

describe("the committed fixture is not empty of what the floor needs (P6)", () => {
  it("spans six months, and every one of them holds sessions org-wide", () => {
    expect(ORG.map((figure) => figure.key)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(ORG.map((figure) => figure.value)).toEqual([31, 100, 111, 189, 247, 64]);
    expect(ORG.map((figure) => figure.partial)).toEqual([true, false, false, false, false, true]);
  });

  it("carries a Member whose months hold nothing, which is what the floor acts on", () => {
    expect(GALLEGO.map((figure) => figure.value)).toEqual([1, 0, 0, 1, 1, 0]);
  });

  it("carries a Member who goes from one session to five, which is what it must not act on", () => {
    expect(SAEZ.map((figure) => figure.value)).toEqual([1, 1, 5, 4, 5, 2]);
  });

  it("counts the same sessions the dataset ships, and no hidden one", () => {
    expect(ORG.reduce((running, figure) => running + figure.value, 0)).toBe(sessions.length);
    expect(sessions.some((session) => session.hidden)).toBe(false);
  });
});

describe("T-U3 — the floor is a count of one, on committed rows (R-M12, A8)", () => {
  it("suppresses June → July, where the prior month holds nothing and the current holds one", () => {
    const change = changeInto(GALLEGO, "2026-07");

    expect(change).toMatchObject({ shown: false, reason: "prior-period-holds-nothing" });
    expect(monthAt(GALLEGO, "2026-06").value).toBe(0);
    expect(monthAt(GALLEGO, "2026-07").value).toBe(1);
  });

  it("suppresses May → June, where neither month holds anything", () => {
    expect(changeInto(GALLEGO, "2026-06")).toMatchObject({
      shown: false,
      reason: "prior-period-holds-nothing",
    });
  });

  it("shows July → August off a base of one, flat, rather than suppressing a small figure", () => {
    expect(changeInto(GALLEGO, "2026-08")).toMatchObject({
      shown: true,
      ratio: 0,
      direction: "flat",
    });
  });

  it("shows May → June at +400% off a base of one — the case a magnitude floor would delete", () => {
    expect(changeInto(SAEZ, "2026-06")).toMatchObject({
      shown: true,
      absolute: 4,
      ratio: 4,
      direction: "up",
    });
  });

  it("shows every month-over-month figure in the roster when, and only when, the prior month holds something (A8)", () => {
    // The sweep runs over all 20 committed Members × the five adjacent month pairs — 100 real
    // comparisons spanning ratios from −100% to +∞-adjacent. Every one of them is shown exactly
    // when its base is non-zero, so a cut-off placed at any magnitude fails this test.
    const comparisons = members.flatMap((member) => {
      const figures = forMember(member.id);
      return figures.slice(1).map((current, index) => ({
        prior: figures[index],
        change: changeBetween({ current, prior: figures[index] }),
      }));
    });

    expect(comparisons).toHaveLength(members.length * 5);
    expect(comparisons.every((held) => held.change.shown === (held.prior.value > 0))).toBe(true);
    // …and the fixture really does exercise both sides of the iff.
    expect(comparisons.filter((held) => !held.change.shown).length).toBeGreaterThan(0);
    expect(comparisons.filter((held) => held.change.shown).length).toBeGreaterThan(80);
  });

  it("shows the org-wide month-over-month figure, which never wants the floor at all", () => {
    const june = changeInto(ORG, "2026-06");

    expect(june).toMatchObject({ shown: true, absolute: 11, direction: "up" });
    expect(ORG.slice(1).every((_figure, index) => changeInto(ORG, ORG[index + 1].key).shown)).toBe(
      true,
    );
  });
});

describe("R-M13 — incompleteness is flagged on committed rows, never withheld", () => {
  it("shows August → September and flags it, because September is clipped by the window", () => {
    const september = changeInto(ORG, "2026-09");

    expect(september).toMatchObject({ shown: true, direction: "down", incomplete: true });
    expect(monthAt(ORG, "2026-09").partial).toBe(true);
  });

  it("shows April → May and flags it, because April is clipped at the start of the window", () => {
    expect(changeInto(ORG, "2026-05")).toMatchObject({ shown: true, incomplete: true });
  });

  it("leaves a comparison of two whole months unflagged", () => {
    expect(changeInto(ORG, "2026-08")).toMatchObject({ shown: true, incomplete: false });
  });

  it("suppresses on the floor alone: a partial month that holds nothing, and one that does not", () => {
    // Gallego's April is partial and holds one session, so April → May is shown and flagged.
    // Her May holds nothing, so May → June is suppressed. The flag decided neither.
    expect(changeInto(GALLEGO, "2026-05")).toMatchObject({
      shown: true,
      ratio: -1,
      incomplete: true,
    });
    expect(changeInto(GALLEGO, "2026-06")).toMatchObject({ shown: false, incomplete: false });
  });
});
