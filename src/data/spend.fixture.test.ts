// T-U12 and T-U13 against the **committed** fixture (R-M1, R-M4, R-M5, R-D2, R-D4, R-D10, A25,
// A26, P3, P6), ticket 24.
//
// The pure unit tests live in `src/domain/metrics/spend.test.ts` and author every figure inline,
// because `src/domain/**` may not reach the data layer (R-T5). This file sits outside that
// boundary, so it may import `load.ts` — and it exists because P6 says a test that would pass
// against an empty fixture is not a test.
//
// The two claims this file exists to hold against real data:
//
//   * **R-D4 — seat cost is a minor share of Total spend** (rewritten, ticket 66). $4,212 of
//     seats against $55,293.74 of attributed session Cost across the six months of the window —
//     **7.1%**. It was ~46% until this ticket, on a fixture kept low-volume so that it would be;
//     the volume is now what the requirement asks for and the seat line is a small one. What the
//     figure still shows is that a consumption-only model cannot see it at all.
//
//   * **R-D10 — one `human` Member holds a seat with fewer than 5 sessions.** Noelia Gallego
//     ran **3** sessions across 167 days, costing $5.47, and holds $234 of seat. Her Cost per
//     completed Task is eighteen times the Organization's. The finding needs a person to point
//     at, and this is the assertion that she is still there.
//
// April is asserted **correct-and-flagged, not corrected** (R-D2, A26): 19 days of sessions
// carrying a whole $702 month of seats, and the flag on the bucket is what stops the resulting
// Cost per completed Task being read as a finding rather than as an artefact of the window.
//
// It reads committed output and never runs the generator (P3, R-T20), following the precedent
// `periods.fixture.test.ts` and `change.fixture.test.ts` set for the same reason.

import { describe, expect, it } from "vitest";
import {
  bucketRows,
  planPeriods,
  type PeriodBucket,
  type PeriodGrain,
  type PeriodRange,
} from "@/domain/periods";
import {
  completedTaskKeys,
  costPerCompletedTask,
  costPerSession,
  seatBearingPeriod,
  seatHolders,
  sessionCost,
  totalSpend,
  totalSpendPerCompletedTask,
  type CostPerCompletedTask,
  type SeatBearingPeriod,
  type TotalSpend,
} from "@/domain/metrics/spend";
import type { AgentSession } from "@/domain/types";
import { loadDataset } from "./load";

const { organization, members, rateCards, sessions } = loadDataset();

const WINDOW: PeriodRange = { start: organization.window_start, end: organization.window_end };
/** The last instant of the fixture window, in the Organization's timezone. P5: never a clock read. */
const NOW = `${organization.window_end}T23:59:59+02:00`;

/** The seat fee, read off the committed card at the boundary. The domain layer holds no card. */
const SEAT_FEE = rateCards.seat.usd;

const monthsOf = (rows: readonly AgentSession[], grain: PeriodGrain = "month"): readonly PeriodBucket<AgentSession>[] => {
  const result = planPeriods({ timezone: organization.timezone, grain, range: WINDOW, now: NOW });
  if (!result.ok) throw new Error(`plan unexpectedly rejected: ${result.reason}`);
  return bucketRows(result.plan, rows);
};

const MONTHS = monthsOf(sessions);

const seatBearing = (buckets: readonly PeriodBucket<AgentSession>[]): SeatBearingPeriod<AgentSession> => {
  const result = seatBearingPeriod(buckets);
  if (!result.ok) throw new Error(`expected a seat-bearing period, got ${result.reason}`);
  return result.period;
};

const spendOver = (
  buckets: readonly PeriodBucket<AgentSession>[],
  population: readonly { id: string; kind: "human" | "service_account"; seat_active: boolean }[] = members,
): TotalSpend<AgentSession> => totalSpend(seatBearing(buckets), population, SEAT_FEE);

const monthAt = (key: string): PeriodBucket<AgentSession> => {
  const bucket = MONTHS.find((held) => held.key === key);
  if (!bucket) throw new Error(`no ${key} bucket`);
  return bucket;
};

const figure = (reading: CostPerCompletedTask): number => {
  if (!reading.defined) throw new Error(`expected a figure, got: ${reading.message}`);
  return reading.value;
};

const forMember = (memberId: string): readonly AgentSession[] =>
  sessions.filter((session) => session.member_id === memberId);

const GALLEGO = "mem_ngallego";

describe("the committed fixture is not empty of what these figures need (P6)", () => {
  it("spans the six months of the window, with both ends flagged partial (R-D2, A26)", () => {
    expect(MONTHS.map((bucket) => bucket.key)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(MONTHS.map((bucket) => bucket.partial)).toEqual([true, false, false, false, false, true]);
  });

  it("carries an attributed cost on every visible session, and no hidden one (R-M4, R-M2)", () => {
    expect(sessions).toHaveLength(7761);
    expect(sessions.every((session) => Number.isFinite(session.cost) && session.cost > 0)).toBe(true);
    expect(sessions.some((session) => session.hidden)).toBe(false);
  });

  it("carries 18 seat-holding humans and 2 service accounts holding none (R-M5, R-D3)", () => {
    expect(members).toHaveLength(20);
    expect(seatHolders(members)).toHaveLength(18);
    expect(members.filter((member) => member.kind === "service_account")).toHaveLength(2);
    expect(seatHolders(members.filter((member) => member.kind === "service_account"))).toEqual([]);
  });

  it("carries a seat fee on the committed card, in whole dollars per human per month", () => {
    expect(SEAT_FEE).toBe(39);
    expect(rateCards.seat.unit).toBe("usd_per_human_member_per_month");
  });
});

describe("Total spend is session Cost + Seat cost (R-M1, R-M5, R-D4, T-U12)", () => {
  const WINDOW_SPEND = spendOver(MONTHS);

  it("charges six whole months of 18 seats across the window", () => {
    expect(WINDOW_SPEND.key).toBe("2026-04..2026-09");
    expect(WINDOW_SPEND.seats).toBe(18);
    expect(WINDOW_SPEND.months).toBe(6);
    // A seat-month is one month held by one seat, so 18 seats over 6 months is 108 of them —
    // and $4,212 is 108 × the $39 fee, not 6 × anything (ticket 41).
    expect(WINDOW_SPEND.seatMonths).toBe(108);
    expect(WINDOW_SPEND.seatCost).toBe(4212);
    expect(WINDOW_SPEND.seatCost).toBe(WINDOW_SPEND.seatMonths * SEAT_FEE);
  });

  it("adds them to the attributed session Cost, and to nothing else", () => {
    expect(WINDOW_SPEND.sessionCost).toBeCloseTo(55_293.74, 2);
    expect(WINDOW_SPEND.sessionCost).toBeCloseTo(sessionCost(sessions), 10);
    expect(WINDOW_SPEND.total).toBeCloseTo(59_505.74, 2);
  });

  it("makes seats a minor but real share of what the Organization actually pays (R-D4)", () => {
    // **Rewritten by ticket 66, which demoted this finding rather than preserving it.** The
    // fixture used to be held at ~750 attempts so that seats came out at ~46% of Total spend;
    // it now runs at the volume R-D4 asks for and they come out at 7.1%. The claim that
    // survives is the one that never depended on the magnitude: a consumption-only model reads
    // $55,294 and is $4,212 short, because a seat is not a session and nothing in the session
    // stream can imply one.
    expect(WINDOW_SPEND.seatShare).toBeCloseTo(0.0708, 4);
    expect(WINDOW_SPEND.seatShare).toBeLessThan(0.25);
    expect(WINDOW_SPEND.total - WINDOW_SPEND.sessionCost).toBe(WINDOW_SPEND.seatCost);
  });

  it("would read 20 seats if `kind` were ignored, so the exclusion is doing work", () => {
    const everyone = members.map((member) => ({ ...member, seat_active: true }));

    expect(seatHolders(everyone)).toHaveLength(18);
    expect(everyone).toHaveLength(20);
  });

  it("carries the window's partial ends onto the window figure (R-E2, A26)", () => {
    expect(WINDOW_SPEND.partial).toBe(true);
  });
});

describe("Total spend is unavailable below monthly grain (R-M5, A25, T-U12)", () => {
  it("refuses the same window's weekly buckets", () => {
    const weeks = monthsOf(sessions, "week");
    const result = seatBearingPeriod(weeks);

    expect(weeks.length).toBeGreaterThan(20);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "grain-is-finer-than-monthly", available: ["month"] });
  });

  it("refuses a daily bucket, which the fixture window cannot even plan at (R-M11)", () => {
    // 12 Apr – 8 Sep is longer than two months, so `planPeriods` refuses day grain outright.
    // The seat gate refuses it a second time, on its own rule, from a hand-built bucket.
    const plan = planPeriods({
      timezone: organization.timezone,
      grain: "day",
      range: WINDOW,
      now: NOW,
    });

    expect(plan).toMatchObject({ ok: false, reason: "day-grain-needs-a-shorter-range" });
    expect(
      seatBearingPeriod([
        { key: "2026-04-12", grain: "day", partial: false, rows: sessions.slice(0, 3) },
      ]),
    ).toMatchObject({ reason: "grain-is-finer-than-monthly" });
  });

  it("has no month-grain figure a week-grain caller could reach instead", () => {
    const result = seatBearingPeriod(monthsOf(sessions, "week"));

    expect("period" in result).toBe(false);
  });
});

describe("April is correct-and-flagged, never pro-rated (R-D2, A26, T-U12, T-U13)", () => {
  const APRIL = monthAt("2026-04");
  const MAY = monthAt("2026-05");
  const APRIL_SPEND = spendOver([APRIL]);

  it("covers 19 of April's 30 days, and says so with a flag rather than a correction", () => {
    expect(organization.window_start).toBe("2026-04-12");
    // The bucket is April itself — 1st to 30th — clipped by the range, which is what `partial`
    // records. Nothing here shortens the month or lengthens the range.
    expect(APRIL.startsOn).toBe("2026-04-01");
    expect(APRIL.endsOn).toBe("2026-04-30");
    expect(APRIL.partial).toBe(true);
    expect(APRIL_SPEND.partial).toBe(true);
  });

  it("charges a whole month of seats against those 19 days", () => {
    expect(APRIL_SPEND.months).toBe(1);
    expect(APRIL_SPEND.seatMonths).toBe(18);
    expect(APRIL_SPEND.seatCost).toBe(702);
    // 19/30ths of $702 is $444.60. The requirement is that no such number exists here: the
    // charge against a clipped April is identical to the charge against a complete May.
    expect(APRIL_SPEND.seatCost).toBe(spendOver([MAY]).seatCost);
  });

  it("holds 630 sessions costing $5,537.11, and April still carries the whole seat month", () => {
    expect(APRIL.rows).toHaveLength(630);
    expect(APRIL_SPEND.sessionCost).toBeCloseTo(5537.11, 2);
    expect(APRIL_SPEND.total).toBeCloseTo(6239.11, 2);
    // 11.3% against the window's 7.1%: April's seat share is the *highest* of the six months,
    // because the month is whole and the sessions in it are 19 days of a ramp at its lowest.
    expect(APRIL_SPEND.seatShare).toBeCloseTo(0.1125, 3);
    expect(APRIL_SPEND.seatShare ?? 0).toBeGreaterThan(spendOver(MONTHS).seatShare ?? 1);
  });

  it("inflates April's Cost per completed Task by construction, and reports it flagged", () => {
    const april = totalSpendPerCompletedTask(APRIL_SPEND);
    const may = totalSpendPerCompletedTask(spendOver([MAY]));

    expect(april.completedTasks).toBe(356);
    expect(figure(april)).toBeCloseTo(17.53, 2);
    expect(figure(may)).toBeCloseTo(15.15, 2);
    // Inflated, flagged, and left alone. A pro-rated April would read ~$16 and would hide the
    // very artefact R-D2 wants a reader to see the flag next to.
    expect(figure(april)).toBeGreaterThan(figure(may));
    expect(april.partial).toBe(true);
    expect(may.partial).toBe(false);
  });

  it("is the seat charge that does it: on session Cost alone April is the cheaper month", () => {
    expect(figure(costPerCompletedTask(APRIL))).toBeCloseTo(15.55, 2);
    expect(figure(costPerCompletedTask(MAY))).toBeCloseTo(13.96, 2);
    expect(figure(totalSpendPerCompletedTask(APRIL_SPEND)) - figure(costPerCompletedTask(APRIL)))
      .toBeCloseTo(702 / 356, 6);
  });
});

describe("waste sits in the numerator and not the denominator (R-M1, T-U13)", () => {
  const APRIL = monthAt("2026-04");

  it("counts 356 Completed Tasks out of 473 Tasks attempted in April", () => {
    const attempted = new Set(APRIL.rows.map((row) => row.task_key));

    expect(attempted.size).toBe(473);
    expect(completedTaskKeys(APRIL.rows)).toHaveLength(356);
  });

  it("keeps every session's cost in the numerator, accepted or not", () => {
    const accepted = costPerSession(APRIL, "accepted");
    const rejected = costPerSession(APRIL, "not-accepted");

    expect(accepted.sessions + rejected.sessions).toBe(630);
    expect(costPerCompletedTask(APRIL).cost).toBeCloseTo(accepted.cost + rejected.cost, 10);
    // The denominator ignores the rejected half entirely, which is what raises the figure.
    expect(rejected.cost).toBeGreaterThan(0);
  });

  it("reads a lower figure across the window than in any month, as adoption ramps (R-D4)", () => {
    const window = totalSpendPerCompletedTask(spendOver(MONTHS));

    expect(window.completedTasks).toBe(4432);
    expect(figure(window)).toBeCloseTo(13.43, 2);
  });

  it("counts a Task once even where its sessions span work types (R-D8, R-D14)", () => {
    const byTask = new Map<string, Set<string>>();
    for (const session of sessions) {
      const held = byTask.get(session.task_key) ?? new Set<string>();
      held.add(session.work_type);
      byTask.set(session.task_key, held);
    }
    const spanning = [...byTask].filter(([, kinds]) => kinds.size > 1);

    expect(spanning.length).toBeGreaterThan(0);
    expect(completedTaskKeys(sessions)).toHaveLength(new Set(
      sessions.filter((session) => session.accepted).map((session) => session.task_key),
    ).size);
  });
});

describe("a seat held against near-zero usage (R-D10, T-U12, T-U13)", () => {
  const ROWS = forMember(GALLEGO);
  const HER = members.filter((member) => member.id === GALLEGO);
  const HER_MONTHS = monthsOf(ROWS);
  const HER_SPEND = totalSpend(seatBearing(HER_MONTHS), HER, SEAT_FEE);

  it("is a human holding a seat, with fewer than 5 sessions across 167 days", () => {
    expect(HER).toHaveLength(1);
    expect(HER[0]).toMatchObject({ kind: "human", seat_active: true, full_name: "Noelia Gallego" });
    expect(ROWS).toHaveLength(3);
    expect(ROWS.length).toBeLessThan(5);
  });

  it("costs $5.47 of sessions and $234 of seat, so 98% of her bill is the seat", () => {
    expect(HER_SPEND.seats).toBe(1);
    expect(HER_SPEND.months).toBe(6);
    // One seat over six months: the one population where the two counts coincide.
    expect(HER_SPEND.seatMonths).toBe(6);
    expect(HER_SPEND.seatCost).toBe(234);
    expect(HER_SPEND.sessionCost).toBeCloseTo(5.47, 2);
    expect(HER_SPEND.seatShare).toBeCloseTo(0.9772, 4);
  });

  it("is the highest cost per unit of work in the Organization, by seventeen times", () => {
    const hers = totalSpendPerCompletedTask(HER_SPEND);
    const org = totalSpendPerCompletedTask(spendOver(MONTHS));

    expect(hers.completedTasks).toBe(1);
    expect(figure(hers)).toBeCloseTo(239.47, 2);
    expect(figure(hers) / figure(org)).toBeGreaterThan(15);
  });

  it("is invisible to a consumption-only reading, which is the point of R-D10", () => {
    // On session Cost alone she is the *cheapest* person per Completed Task in the fixture.
    // Only Total spend can see her, and only at monthly grain and coarser (R-M5).
    const consumption = costPerCompletedTask({ key: "window", partial: true, rows: ROWS });

    expect(figure(consumption)).toBeCloseTo(5.47, 2);
    expect(figure(consumption)).toBeLessThan(figure(totalSpendPerCompletedTask(spendOver(MONTHS))));
  });

  it("holds a month with real spend and no Completed Task, which yields no figure at all", () => {
    // May: one session, rejected. So May is $1.49 of session Cost plus a whole $39 seat against
    // nothing delivered — a whole finished month whose figure is an absence rather than a zero.
    const may = HER_MONTHS.find((bucket) => bucket.key === "2026-05");
    if (!may) throw new Error("no May bucket");
    const reading = totalSpendPerCompletedTask(totalSpend(seatBearing([may]), HER, SEAT_FEE));

    expect(may.rows).toHaveLength(1);
    expect(reading.completedTasks).toBe(0);
    expect(reading.defined).toBe(false);
    expect(reading.cost).toBeCloseTo(40.49, 2);
    expect("value" in reading).toBe(false);
    expect(reading.partial).toBe(false);
  });
});
