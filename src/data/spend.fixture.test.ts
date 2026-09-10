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
//     seats — 108 seat-months at $39, and the only money figure here that is authored rather
//     than attributed — against a session bill an order of magnitude larger. It was ~46% until
//     ticket 66, on a fixture kept low-volume so that it would be. What the figure still shows
//     is that a consumption-only model cannot see the seat line at all.
//
//     **The session-cost figures are derived from the rows, not written down** (ticket 67). They
//     move with the WorkType mix — an implementation runs 1.7× an ordinary session — and a
//     literal here would be a number to re-type on every fixture change without ever having
//     checked anything the rows do not already say. The seat side stays literal: it is authored.
//
//   * **R-D10 — one `human` Member holds a seat with fewer than 5 sessions.** Noelia Gallego
//     ran **3** sessions across 167 days and holds $234 of seat. Her Cost per completed Task is
//     an order of magnitude above the Organization's. The finding needs a person to point at,
//     and this is the assertion that she is still there.
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
    expect(WINDOW_SPEND.sessionCost).toBeCloseTo(sessionCost(sessions), 10);
    expect(WINDOW_SPEND.total).toBeCloseTo(WINDOW_SPEND.sessionCost + 4212, 2);
    // Nothing but the two: no third term, and no rate card consulted on this side (ADR-0005).
    expect(WINDOW_SPEND.total - WINDOW_SPEND.sessionCost).toBe(WINDOW_SPEND.seatCost);
  });

  it("makes seats a minor but real share of what the Organization actually pays (R-D4)", () => {
    // **Rewritten by ticket 66, which demoted this finding rather than preserving it.** The
    // fixture used to be held at ~750 attempts so that seats came out at ~46% of Total spend;
    // it now runs at the volume R-D4 asks for and they come out at 7.1%. The claim that
    // survives is the one that never depended on the magnitude: a consumption-only model reads
    // the session bill and is $4,212 short, because a seat is not a session and nothing in the
    // session stream can imply one.
    expect(WINDOW_SPEND.seatShare).toBeCloseTo(
      WINDOW_SPEND.seatCost / (WINDOW_SPEND.seatCost + WINDOW_SPEND.sessionCost),
      10,
    );
    expect(WINDOW_SPEND.seatShare ?? 1).toBeGreaterThan(0.02);
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

  it("holds 630 sessions, and April still carries the whole seat month", () => {
    // The session count is the schedule's, and R-D4's ramp puts April at its lowest — the one
    // figure here ticket 67 could not move, because it moved no slot.
    expect(APRIL.rows).toHaveLength(630);
    expect(APRIL_SPEND.total).toBeCloseTo(APRIL_SPEND.sessionCost + 702, 2);
    // April's seat share is the *highest* of the six months, because the month is whole and
    // the sessions in it are 19 days of a ramp at its lowest.
    expect(APRIL_SPEND.seatShare ?? 0).toBeGreaterThan(spendOver(MONTHS).seatShare ?? 1);
  });

  it("inflates April's Cost per completed Task by construction, and reports it flagged", () => {
    const april = totalSpendPerCompletedTask(APRIL_SPEND);
    const may = totalSpendPerCompletedTask(spendOver([MAY]));

    expect(april.completedTasks).toBe(completedTaskKeys(APRIL.rows).length);
    // Inflated, flagged, and left alone. The comparison is against **April pro-rated** rather
    // than against May: pro-rating is the correction R-D2 forbids, so the artefact is exactly
    // the gap between the figure the product states and the figure a pro-rated month would.
    const proRated = (APRIL_SPEND.sessionCost + (702 * 19) / 30) / april.completedTasks;

    expect(figure(april)).toBeGreaterThan(proRated);
    expect(figure(may)).toBeGreaterThan(0);
    expect(april.partial).toBe(true);
    expect(may.partial).toBe(false);
  });

  it("is the seat charge that does it: it lands harder on April than on any whole month", () => {
    const upliftIn = (bucket: typeof APRIL): number =>
      figure(totalSpendPerCompletedTask(spendOver([bucket]))) - figure(costPerCompletedTask(bucket));

    // The whole of the difference between the two readings is the seat month, spread over the
    // month's own Completed Tasks — and $702 is 18 seats at $39, not a share of anything.
    expect(upliftIn(APRIL)).toBeCloseTo(702 / completedTaskKeys(APRIL.rows).length, 6);
    // April carries a whole month of seats against 19 days of a ramp at its lowest, so it
    // delivers the fewest Completed Tasks and the same $702 lands hardest on it.
    expect(upliftIn(APRIL)).toBeGreaterThan(upliftIn(MAY));
  });
});

describe("waste sits in the numerator and not the denominator (R-M1, T-U13)", () => {
  const APRIL = monthAt("2026-04");

  it("counts April's Completed Tasks as a strict subset of the Tasks attempted in it", () => {
    const attempted = new Set(APRIL.rows.map((row) => row.task_key));
    const completed = completedTaskKeys(APRIL.rows);

    expect(attempted.size).toBeGreaterThan(completed.length);
    expect(completed.length).toBeGreaterThan(0);
    // Every completed key is one of the attempted ones — waste is in the numerator, never in
    // the denominator, and the denominator is not the session count either.
    expect(completed.filter((key) => !attempted.has(key))).toEqual([]);
    expect(completed.length).toBeLessThan(APRIL.rows.length);
  });

  it("keeps every session's cost in the numerator, accepted or not", () => {
    const accepted = costPerSession(APRIL, "accepted");
    const rejected = costPerSession(APRIL, "not-accepted");

    expect(accepted.sessions + rejected.sessions).toBe(630);
    expect(costPerCompletedTask(APRIL).cost).toBeCloseTo(accepted.cost + rejected.cost, 10);
    // The denominator ignores the rejected half entirely, which is what raises the figure.
    expect(rejected.cost).toBeGreaterThan(0);
  });

  // **The direction reversed with R-D17** (ticket 70). It used to read *lower* across the window
  // than in April: the frontier tier's token share fell from 25% to 10%, so the average priced
  // token got cheaper as the sessions got more numerous, and that outran the seat fee April
  // carries against nineteen days of sessions. R-D17 now runs the other way — `claude-fable-5-1`
  // and `gpt-6-astra` arrive and grow — so the same figure rises. Both readings are derived from
  // the committed rows and neither is written down as a number; what is asserted is the
  // direction, which is the thing R-D17 is a claim about.
  it("reads a higher figure across the window than in April, as the mix gets dearer (R-D17)", () => {
    const window = totalSpendPerCompletedTask(spendOver(MONTHS));

    expect(window.completedTasks).toBe(completedTaskKeys(sessions).length);
    expect(figure(window)).toBeGreaterThan(figure(totalSpendPerCompletedTask(spendOver([APRIL]))));
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

  it("costs a handful of dollars of sessions and $234 of seat: her bill is the seat", () => {
    expect(HER_SPEND.seats).toBe(1);
    expect(HER_SPEND.months).toBe(6);
    // One seat over six months: the one population where the two counts coincide.
    expect(HER_SPEND.seatMonths).toBe(6);
    expect(HER_SPEND.seatCost).toBe(234);
    expect(HER_SPEND.sessionCost).toBeCloseTo(sessionCost(ROWS), 10);
    expect(HER_SPEND.sessionCost).toBeLessThan(20);
    expect(HER_SPEND.seatShare ?? 0).toBeGreaterThan(0.9);
  });

  it("is the highest cost per unit of work in the Organization", () => {
    const hers = totalSpendPerCompletedTask(HER_SPEND);
    const org = totalSpendPerCompletedTask(spendOver(MONTHS));

    // **The highest of anyone's**, which is the claim rather than any particular multiple: the
    // multiple is a function of how much her peers ran and of what their tokens cost, and two
    // tickets have moved both (67 the work mix, 70 the Model roster and R-D17's direction). So
    // the multiples below are floors well under what the fixture reads, and the *ranking* is
    // the exact assertion.
    const perMember = members
      .filter((member) => member.kind === "human")
      .map((member) =>
        figure(
          totalSpendPerCompletedTask(
            totalSpend(seatBearing(monthsOf(forMember(member.id))), [member], SEAT_FEE),
          ),
        ),
      );
    const ranked = [...perMember].sort((left, right) => right - left);

    expect(hers.completedTasks).toBe(completedTaskKeys(ROWS).length);
    expect(hers.completedTasks).toBeGreaterThan(0);
    expect(figure(hers)).toBe(Math.max(...perMember));
    // Above the Organization's own figure, and an order of magnitude above the median Member's
    // — which is the shape of the finding, and the half of it that does not move with the price
    // of a token.
    expect(figure(hers)).toBeGreaterThan(2 * figure(org));
    expect(figure(hers)).toBeGreaterThan(5 * ranked[Math.floor(ranked.length / 2)]);
  });

  it("is invisible to a consumption-only reading, which is the point of R-D10", () => {
    // On session Cost alone she is the *cheapest* person per Completed Task in the fixture.
    // Only Total spend can see her, and only at monthly grain and coarser (R-M5).
    const consumption = costPerCompletedTask({ key: "window", partial: true, rows: ROWS });

    expect(figure(consumption)).toBeCloseTo(sessionCost(ROWS) / completedTaskKeys(ROWS).length, 6);
    expect(figure(consumption)).toBeLessThan(figure(totalSpendPerCompletedTask(spendOver(MONTHS))));
  });

  it("reads a month of real spend and no Completed Task as an absence, not as a zero", () => {
    // A whole $39 seat and real session Cost against nothing delivered — a finished month whose
    // figure is an **absence** rather than a zero (R-M18).
    //
    // **The population is a slice of committed rows rather than a whole Member-month**, because
    // since ticket 67 the fixture holds no barren Member-month at all: every Job that was built
    // is reviewed and 86% of reviews are accepted (R-D22, R-D6), so anybody who ran anything in
    // a month completed a Task in it. Her rejected rows are real rows with real attributed cost,
    // and they are what the metric is handed.
    const rejected = HER_MONTHS.flatMap((bucket) => bucket.rows).filter((row) => !row.accepted);
    const peer = sessions.filter((row) => !row.accepted).slice(0, 4);
    const barren = [...rejected, ...peer].map((row) => ({ ...row, member_id: GALLEGO }));
    const months = monthsOf(barren).filter((bucket) => !bucket.partial);
    const reading = totalSpendPerCompletedTask(totalSpend(seatBearing(months), HER, SEAT_FEE));

    expect(months.length).toBeGreaterThan(0);
    expect(completedTaskKeys(barren)).toEqual([]);
    expect(reading.completedTasks).toBe(0);
    expect(reading.defined).toBe(false);
    expect(reading.cost).toBeGreaterThan(SEAT_FEE);
    expect("value" in reading).toBe(false);
    expect(reading.partial).toBe(false);
  });
});
