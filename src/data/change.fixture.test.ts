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

  it("shows every month-over-month figure in the roster when, and only when, both months carry it (A8, C13)", () => {
    // The sweep runs over all 20 committed Members × the five adjacent month pairs — 100 real
    // comparisons spanning ratios from −100% to +∞-adjacent. Every one of them is shown exactly
    // when its base is non-zero and finished **and the month on screen is finished too**, so a
    // cut-off placed at any magnitude fails this test, and so does a build that quietly
    // reinstated a part-month on either side of the comparison.
    const comparisons = members.flatMap((member) => {
      const figures = forMember(member.id);
      return figures.slice(1).map((current, index) => ({
        current,
        prior: figures[index],
        change: changeBetween({ current, prior: figures[index] }),
      }));
    });

    expect(comparisons).toHaveLength(members.length * 5);
    expect(
      comparisons.every(
        (held) =>
          held.change.shown ===
          (held.prior.value > 0 && !held.prior.partial && !held.current.partial),
      ),
    ).toBe(true);
    // …and the fixture really does exercise every side of that: empty bases, part-months at both
    // ends of the window, and the majority that are neither.
    expect(comparisons.filter((held) => !held.change.shown).length).toBeGreaterThan(0);
    expect(
      comparisons.filter((held) => !held.change.shown && held.prior.partial).length,
    ).toBeGreaterThan(0);
    expect(
      comparisons.filter((held) => !held.change.shown && held.current.partial).length,
    ).toBeGreaterThan(0);
    expect(comparisons.filter((held) => held.change.shown).length).toBeGreaterThan(40);
  });

  it("shows the org-wide month-over-month figure wherever both months are whole", () => {
    const june = changeInto(ORG, "2026-06");

    expect(june).toMatchObject({ shown: true, absolute: 11, direction: "up" });
    // Every pair except the two the window clips: the one whose baseline is April, and the one
    // whose current month is September (C13).
    const shownInto = ORG.slice(1).map((figure, index) => ({
      key: figure.key,
      shown: changeInto(ORG, figure.key).shown,
      clipped: ORG[index].partial || figure.partial,
    }));
    expect(shownInto.every((held) => held.shown === !held.clipped)).toBe(true);
    expect(shownInto.filter((held) => held.clipped).map((held) => held.key)).toEqual([
      "2026-05",
      "2026-09",
    ]);
  });
});

describe("R-M13 / C13 — an unfinished month on either side withholds the figure", () => {
  it("withholds August → September, because September is clipped by the window (C13, amended)", () => {
    // Eight days of September against the whole of August. Shown, it read as a −74% collapse in
    // spend across the whole page; the collapse is the calendar. This is the reading `/demo`
    // opens on now that the month picker defaults to the current month, which is why C13's
    // original asymmetry — flag the current period, withhold the baseline — did not survive.
    const september = changeInto(ORG, "2026-09");

    expect(september).toMatchObject({
      shown: false,
      reason: "current-period-incomplete",
      incomplete: true,
    });
    expect(monthAt(ORG, "2026-09").partial).toBe(true);
  });

  it("withholds April → May, because April is clipped at the start of the window (C13)", () => {
    // The case that decided C13's baseline rule on committed rows: April is half a month of
    // data, and comparing a whole May against it reported a rise the fixture does not contain.
    expect(changeInto(ORG, "2026-05")).toMatchObject({
      shown: false,
      reason: "prior-period-incomplete",
      incomplete: true,
    });
  });

  it("leaves a comparison of two whole months unflagged", () => {
    expect(changeInto(ORG, "2026-08")).toMatchObject({ shown: true, incomplete: false });
  });

  it("distinguishes the three suppressions by reason, not merely by outcome", () => {
    // Gallego's April is partial and holds one session, so April → May is withheld for the
    // *baseline*. Her May holds nothing, so May → June is withheld for the *zero*. August →
    // September is withheld for the month *on screen*. All three are absent figures; they are
    // different facts about the page and the copy says which.
    expect(changeInto(GALLEGO, "2026-05")).toMatchObject({
      shown: false,
      reason: "prior-period-incomplete",
      incomplete: true,
    });
    expect(changeInto(GALLEGO, "2026-06")).toMatchObject({
      shown: false,
      reason: "prior-period-holds-nothing",
      incomplete: false,
    });
    expect(changeInto(ORG, "2026-09")).toMatchObject({
      shown: false,
      reason: "current-period-incomplete",
      incomplete: true,
    });
  });
});
