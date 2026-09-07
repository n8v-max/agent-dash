// T-U12 (Total spend composition) and T-U13 (Cost per completed Task) — `testing-spec.md` § 3.2,
// `spec.md` R-M1, R-M4, R-M5, R-D2, A25, A26, ticket 24.
//
// These are pure unit tests: `src/domain/**` may not reach the data layer (R-T5), so every
// figure here is authored inline. The same claims are re-asserted against the **committed**
// fixture in `src/data/spend.fixture.test.ts`, because P6 says a test that would pass against an
// empty fixture is not a test.
//
// Figures are authored so every expectation is **exact** — whole dollars and a whole seat fee,
// so no expectation needs a tolerance and none restates the implementation's own arithmetic.
//
// **The tests this file must not contain.** Nothing here prices anything: there is no token
// count, no duration and no rate card in the file, because R-M4/R-T11 make `cost` a field that
// is read. And nothing here pro-rates April: the assertion R-D2 asks for is that a 19-day month
// carries a **whole** month's seat charge and is flagged, so a test expecting 19/30ths of a fee
// would encode the correction the requirement forbids.
//
// One demonstration is deliberately absent. That `totalSpend(weekBucket, …)` does not compile is
// the whole of A25, but `ban-ts-comment` is an error in this repo, so it cannot be shown with a
// `@ts-expect-error` line. It is asserted the other way instead: the brand is a module-private
// symbol, the public shape of a period does not carry it, and `seatBearingPeriod` refuses every
// grain below monthly at runtime.

import { describe, expect, it } from "vitest";
import type { MemberFacts } from "../aggregate";
import {
  completedTaskKeys,
  costPerCompletedTask,
  costPerSession,
  OUTCOME_FILTERS,
  SEAT_BEARING_GRAINS,
  seatBearingPeriod,
  seatHolders,
  sessionCost,
  totalSpend,
  totalSpendPerCompletedTask,
  type CostPerCompletedTask,
  type GrainedPeriod,
  type SeatBearingPeriod,
  type SeatBearingResult,
  type SpendRow,
} from "./spend";

/** The fixture's own monthly seat fee. Whole dollars, so every total below is exact. */
const SEAT_FEE = 39;

/** A row, at the grain everything is stored at. `repository_id` and `work_type` ride along so a
 * Task spanning either can be authored; no figure here may key on them. */
type Row = SpendRow & { readonly repository_id: string; readonly work_type: string };

const row = (input: {
  cost: number;
  accepted: boolean;
  task: string;
  repository?: string;
  workType?: string;
}): Row => ({
  cost: input.cost,
  accepted: input.accepted,
  task_key: input.task,
  repository_id: input.repository ?? "repo_web_console",
  work_type: input.workType ?? "implementation",
});

const bucket = (input: {
  key: string;
  grain: "day" | "week" | "month";
  partial?: boolean;
  rows: readonly Row[];
}): GrainedPeriod<Row> => ({
  key: input.key,
  grain: input.grain,
  partial: input.partial ?? false,
  rows: input.rows,
});

/** Narrows, so a test asserting a total is never silently asserting a rejection. */
const granted = <T>(result: SeatBearingResult<T>): SeatBearingPeriod<T> => {
  if (!result.ok) throw new Error(`expected a seat-bearing period, got ${result.reason}`);
  return result.period;
};

/** Narrows the other way, so a rejection test cannot pass on an accidental `ok`. */
const refused = <T>(result: SeatBearingResult<T>): Extract<SeatBearingResult<T>, { ok: false }> => {
  if (result.ok) throw new Error(`expected a rejection, got a period keyed ${result.period.key}`);
  return result;
};

/** Narrows a figure, so a test asserting a value cannot be asserting `undefined`. */
const figure = (reading: CostPerCompletedTask): number => {
  if (!reading.defined) throw new Error(`expected a figure, got: ${reading.message}`);
  return reading.value;
};

// --- The roster -----------------------------------------------------------------------------
//
// Three seat-holders, and three Members who hold no seat for three different reasons. The
// service account carrying `seat_active: true` is the point of the roster: R-M5 attaches seats
// to `kind`, so a denominator reading only the flag would charge for it.

const member = (id: string, kind: MemberFacts["kind"], seatActive: boolean): MemberFacts => ({
  id,
  kind,
  seat_active: seatActive,
});

const ROSTER: readonly MemberFacts[] = [
  member("mem_ncastells", "human", true),
  member("mem_aruiz", "human", true),
  member("mem_ngallego", "human", true),
  member("mem_lapsed", "human", false),
  member("svc_deploy", "service_account", true),
  member("svc_nightly", "service_account", false),
];

const SEATS = 3;

describe("seats attach to human Members only (R-M5, T-U12)", () => {
  it("counts the three active humans and none of the three others", () => {
    expect(seatHolders(ROSTER).map((held) => held.id)).toEqual([
      "mem_ncastells",
      "mem_aruiz",
      "mem_ngallego",
    ]);
  });

  it("holds no seat for a service account, however its seat flag is set", () => {
    const accounts = ROSTER.filter((held) => held.kind === "service_account");

    expect(accounts).toHaveLength(2);
    expect(seatHolders(accounts)).toEqual([]);
  });

  it("holds no seat for a human whose seat has lapsed", () => {
    expect(seatHolders([member("mem_lapsed", "human", false)])).toEqual([]);
  });
});

describe("Total spend is unavailable below monthly grain (R-M5, A25, T-U12)", () => {
  const rows = [row({ cost: 10, accepted: true, task: "equilibrio/web-console#1" })];

  it("refuses day grain, and names the grains that do carry a seat charge", () => {
    const refusal = refused(seatBearingPeriod([bucket({ key: "2026-04-12", grain: "day", rows })]));

    expect(refusal.reason).toBe("grain-is-finer-than-monthly");
    expect(refusal.available).toEqual(["month"]);
    expect(refusal.message).toContain("invented precision");
    // The refused arm carries no period at all, so nothing downstream can reach a total that
    // was never granted — the same shape `change.ts` uses for a suppressed figure.
    expect("period" in refusal).toBe(false);
  });

  it("refuses week grain on the same rule", () => {
    expect(refused(seatBearingPeriod([bucket({ key: "2026-W16", grain: "week", rows })])).reason)
      .toBe("grain-is-finer-than-monthly");
  });

  it("refuses a run of months holding one week among them", () => {
    const refusal = refused(
      seatBearingPeriod([
        bucket({ key: "2026-04", grain: "month", rows }),
        bucket({ key: "2026-W20", grain: "week", rows }),
        bucket({ key: "2026-06", grain: "month", rows }),
      ]),
    );

    expect(refusal.reason).toBe("grain-is-finer-than-monthly");
    expect(refusal.message).toContain("2026-W20");
  });

  it("refuses no period at all", () => {
    expect(refused(seatBearingPeriod<Row>([])).reason).toBe("no-period");
  });

  it("offers exactly one grain, and it is monthly", () => {
    expect(SEAT_BEARING_GRAINS).toEqual(["month"]);
  });

  it("brands the granted period with a symbol no caller can write", () => {
    // A25 in the form the type system enforces it: `totalSpend` takes a `SeatBearingPeriod`, and
    // the only key distinguishing one from an ordinary bucket is a module-private symbol. A
    // hand-written lookalike carries none, so it is not assignable and the call does not compile.
    const period = granted(seatBearingPeriod([bucket({ key: "2026-04", grain: "month", rows })]));

    expect(Object.getOwnPropertySymbols(period)).toHaveLength(1);
    expect(Object.getOwnPropertySymbols({ ...bucket({ key: "2026-04", grain: "month", rows }) }))
      .toEqual([]);
  });
});

describe("Total spend is session Cost + Seat cost (R-M1, R-M5, T-U12)", () => {
  const APRIL_ROWS = [
    row({ cost: 60, accepted: true, task: "equilibrio/web-console#11" }),
    row({ cost: 30, accepted: false, task: "equilibrio/web-console#12" }),
    row({ cost: 10, accepted: true, task: "equilibrio/api-gateway#13" }),
  ];

  const april = granted(
    seatBearingPeriod([bucket({ key: "2026-04", grain: "month", partial: true, rows: APRIL_ROWS })]),
  );

  it("adds a whole month of seats to the attributed session Cost", () => {
    const spend = totalSpend(april, ROSTER, SEAT_FEE);

    expect(spend.sessionCost).toBe(100);
    expect(spend.seats).toBe(SEATS);
    expect(spend.seatMonths).toBe(1);
    expect(spend.seatCost).toBe(117);
    expect(spend.total).toBe(217);
  });

  it("reports the seat share, which is what makes a low-usage population legible", () => {
    expect(totalSpend(april, ROSTER, SEAT_FEE).seatShare).toBeCloseTo(117 / 217, 12);
  });

  it("charges no seat for a population that holds none", () => {
    const accounts = ROSTER.filter((held) => held.kind === "service_account");
    const spend = totalSpend(april, accounts, SEAT_FEE);

    expect(spend.seats).toBe(0);
    expect(spend.seatCost).toBe(0);
    expect(spend.total).toBe(100);
  });

  it("reports no seat share over a period that cost nothing at all", () => {
    const empty = granted(seatBearingPeriod([bucket({ key: "2026-04", grain: "month", rows: [] })]));
    const spend = totalSpend(empty, [], SEAT_FEE);

    expect(spend.total).toBe(0);
    // Not 0 and not NaN: there is no share of nothing.
    expect(spend.seatShare).toBeNull();
  });

  it("charges whole months over a run of them, and keys the run by its ends", () => {
    const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
    const run = granted(
      seatBearingPeriod(
        months.map((key, index) =>
          bucket({
            key,
            grain: "month",
            partial: index === 0 || index === months.length - 1,
            rows: [row({ cost: 10, accepted: true, task: `equilibrio/web-console#${key}` })],
          }),
        ),
      ),
    );
    const spend = totalSpend(run, ROSTER, SEAT_FEE);

    expect(spend.key).toBe("2026-04..2026-09");
    expect(spend.seatMonths).toBe(6);
    expect(spend.seatCost).toBe(6 * SEATS * SEAT_FEE);
    expect(spend.sessionCost).toBe(60);
    // R-E2 — one partial month makes the run partial. Flagged, never withheld (A26).
    expect(spend.partial).toBe(true);
  });

  it("charges a month once even if it is handed in twice", () => {
    const twice = granted(
      seatBearingPeriod([
        bucket({ key: "2026-04", grain: "month", rows: APRIL_ROWS }),
        bucket({ key: "2026-04", grain: "month", rows: [] }),
      ]),
    );

    expect(twice.seatMonths).toBe(1);
    expect(twice.key).toBe("2026-04");
  });

  it("carries the partial flag off a finished month as false", () => {
    const may = granted(
      seatBearingPeriod([bucket({ key: "2026-05", grain: "month", rows: APRIL_ROWS })]),
    );

    expect(totalSpend(may, ROSTER, SEAT_FEE).partial).toBe(false);
  });
});

describe("April is correct-and-flagged, never pro-rated (R-D2, A26, T-U12)", () => {
  // 19 days of sessions — 12 April to 30 April — against a whole month's seat charge. The
  // figure that comes out is inflated **by construction**, and the flag is what stops it being
  // read as a finding.
  const NINETEEN_DAYS = [
    row({ cost: 8, accepted: false, task: "equilibrio/mobile-app#197" }),
    row({ cost: 12, accepted: true, task: "equilibrio/web-console#41" }),
  ];

  const april = granted(
    seatBearingPeriod([
      bucket({ key: "2026-04", grain: "month", partial: true, rows: NINETEEN_DAYS }),
    ]),
  );
  const may = granted(
    seatBearingPeriod([bucket({ key: "2026-05", grain: "month", rows: NINETEEN_DAYS })]),
  );

  it("charges the same whole month for 19 days as for a complete one", () => {
    // 19/30ths of $117 is $74.10. The requirement is that no such number exists here.
    expect(totalSpend(april, ROSTER, SEAT_FEE).seatCost).toBe(117);
    expect(totalSpend(april, ROSTER, SEAT_FEE).seatCost).toBe(
      totalSpend(may, ROSTER, SEAT_FEE).seatCost,
    );
  });

  it("counts whole months, so there is no fraction for a day count to reach", () => {
    expect(april.seatMonths).toBe(1);
    expect(Number.isInteger(april.seatMonths)).toBe(true);
  });

  it("flags the period rather than correcting the figure", () => {
    const spend = totalSpend(april, ROSTER, SEAT_FEE);
    const reading = totalSpendPerCompletedTask(spend);

    expect(spend.partial).toBe(true);
    expect(reading.partial).toBe(true);
    // $20 of sessions + $117 of seats over one Completed Task. Correct, flagged, uncorrected.
    expect(figure(reading)).toBe(137);
  });

  it("inflates April against May by exactly the seat charge it should not apportion", () => {
    const inflated = figure(totalSpendPerCompletedTask(totalSpend(april, ROSTER, SEAT_FEE)));
    const sessionsOnly = figure(costPerCompletedTask(april));

    expect(sessionsOnly).toBe(20);
    expect(inflated - sessionsOnly).toBe(117);
  });
});

describe("Cost per session, with the accepted filter (R-M1, R-M4)", () => {
  const ROWS = [
    row({ cost: 10, accepted: true, task: "equilibrio/web-console#1" }),
    row({ cost: 20, accepted: false, task: "equilibrio/web-console#2" }),
    row({ cost: 30, accepted: true, task: "equilibrio/web-console#3" }),
    row({ cost: 40, accepted: false, task: "equilibrio/web-console#4" }),
  ];
  const period = { key: "2026-W16", partial: false, rows: ROWS };

  it("reads the attributed cost off every row and divides by the row count", () => {
    const reading = costPerSession(period);

    expect(reading.outcome).toBe("any");
    expect(reading.sessions).toBe(4);
    expect(reading.cost).toBe(100);
    expect(reading.value).toBe(25);
  });

  it("narrows to accepted sessions", () => {
    expect(costPerSession(period, "accepted")).toMatchObject({ sessions: 2, cost: 40, value: 20 });
  });

  it("narrows to the sessions that produced nothing, which cost more each here", () => {
    expect(costPerSession(period, "not-accepted")).toMatchObject({
      sessions: 2,
      cost: 60,
      value: 30,
    });
  });

  it("carries no seat cost, because a per-session figure may not apportion one (R-M5)", () => {
    // The whole period costs 100 whichever way it is sliced; nothing here adds a subscription.
    const parts = OUTCOME_FILTERS.filter((filter) => filter !== "any");

    expect(parts.reduce((running, filter) => running + costPerSession(period, filter).cost, 0))
      .toBe(costPerSession(period).cost);
  });

  it("reports no figure over no sessions rather than dividing zero by zero", () => {
    const empty = costPerSession({ key: "2026-W17", partial: true, rows: [] });

    expect(empty.sessions).toBe(0);
    expect(empty.cost).toBe(0);
    expect(empty.value).toBeNull();
    expect(empty.partial).toBe(true);
  });

  it("sums the attributed figures and nothing else", () => {
    expect(sessionCost(ROWS)).toBe(100);
    expect(sessionCost([])).toBe(0);
  });
});

describe("a Completed Task is a Task with at least one accepted session (T-U13)", () => {
  it("counts a Task once however many accepted sessions it holds", () => {
    const rows = [
      row({ cost: 1, accepted: true, task: "equilibrio/api-gateway#412" }),
      row({ cost: 1, accepted: true, task: "equilibrio/api-gateway#412" }),
    ];

    expect(completedTaskKeys(rows)).toEqual(["equilibrio/api-gateway#412"]);
  });

  it("counts a Task that spans repositories and work types once, not once per pair", () => {
    // `CONTEXT.md`: a Task is addressed by one **or more** AgentSessions, and the follow-up need
    // not attempt the same class of work. Keying on either label would inflate the denominator.
    const rows = [
      row({
        cost: 1,
        accepted: true,
        task: "equilibrio/api-gateway#412",
        repository: "repo_api_gateway",
        workType: "review",
      }),
      row({
        cost: 1,
        accepted: true,
        task: "equilibrio/api-gateway#412",
        repository: "repo_web_console",
        workType: "implementation",
      }),
    ];

    expect(completedTaskKeys(rows)).toEqual(["equilibrio/api-gateway#412"]);
  });

  it("excludes a Task whose every session was rejected", () => {
    const rows = [
      row({ cost: 1, accepted: false, task: "equilibrio/web-console#1" }),
      row({ cost: 1, accepted: true, task: "equilibrio/web-console#2" }),
    ];

    expect(completedTaskKeys(rows)).toEqual(["equilibrio/web-console#2"]);
  });

  it("returns the keys sorted, so the set is a pure function of the rows", () => {
    const rows = ["#9", "#1", "#5"].map((suffix) =>
      row({ cost: 1, accepted: true, task: `equilibrio/web-console${suffix}` }),
    );

    expect(completedTaskKeys(rows)).toEqual([
      "equilibrio/web-console#1",
      "equilibrio/web-console#5",
      "equilibrio/web-console#9",
    ]);
  });
});

describe("waste sits in the numerator and not the denominator (R-M1, T-U13)", () => {
  // Task 41 took two attempts and landed. Task 42 took two and never did. Task 43 landed first
  // time. $150 of spend bought **two** Completed Tasks.
  const ROWS = [
    row({ cost: 10, accepted: false, task: "equilibrio/web-console#41" }),
    row({ cost: 20, accepted: true, task: "equilibrio/web-console#41" }),
    row({ cost: 30, accepted: false, task: "equilibrio/web-console#42" }),
    row({ cost: 40, accepted: false, task: "equilibrio/web-console#42" }),
    row({ cost: 50, accepted: true, task: "equilibrio/web-console#43" }),
  ];
  const period = { key: "2026-05", partial: false, rows: ROWS };

  it("divides every session's cost by the Tasks that actually completed", () => {
    const reading = costPerCompletedTask(period);

    expect(reading.sessions).toBe(5);
    expect(reading.cost).toBe(150);
    expect(reading.completedTasks).toBe(2);
    expect(figure(reading)).toBe(75);
    // The denominator counts Completed Tasks, never Tasks: 3 attempted, 2 delivered. Counting
    // attempted Tasks would read 50 and would make failure look cheaper than it is.
    expect(reading.completedTasks).not.toBe(3);
  });

  it("counts no accepted session twice, however many a Task holds", () => {
    // Three accepted sessions across two Tasks — Decomposition, not two deliveries.
    const decomposed = [
      row({ cost: 20, accepted: true, task: "equilibrio/web-console#41" }),
      row({ cost: 20, accepted: true, task: "equilibrio/web-console#41" }),
      row({ cost: 20, accepted: true, task: "equilibrio/web-console#43" }),
    ];

    expect(costPerCompletedTask({ key: "2026-05", partial: false, rows: decomposed }))
      .toMatchObject({ completedTasks: 2, cost: 60 });
  });

  it("raises the figure when a failed attempt is added and nothing more is delivered", () => {
    const before = figure(costPerCompletedTask(period));
    const after = figure(
      costPerCompletedTask({
        key: "2026-05",
        partial: false,
        rows: [...ROWS, row({ cost: 90, accepted: false, task: "equilibrio/web-console#44" })],
      }),
    );

    expect(after).toBeGreaterThan(before);
    expect(after).toBe(120);
  });

  it("lowers it when the same money delivers a Task instead of failing at one", () => {
    const delivered = ROWS.map((held) =>
      held.task_key === "equilibrio/web-console#42" ? { ...held, accepted: true } : held,
    );

    expect(figure(costPerCompletedTask({ key: "2026-05", partial: false, rows: delivered })))
      .toBe(50);
  });

  it("folds the seat charge into the numerator and leaves the denominator alone", () => {
    const month = granted(seatBearingPeriod([bucket({ key: "2026-05", grain: "month", rows: ROWS })]));
    const reading = totalSpendPerCompletedTask(totalSpend(month, ROSTER, SEAT_FEE));

    expect(reading.seatCost).toBe(117);
    expect(reading.cost).toBe(267);
    expect(reading.completedTasks).toBe(2);
    expect(figure(reading)).toBe(133.5);
  });

  it("carries no seat charge in the session-Cost reading, which is available at every grain", () => {
    expect(costPerCompletedTask({ key: "2026-04-12", partial: true, rows: ROWS }).seatCost).toBe(0);
  });
});

describe("spend with zero Completed Tasks does not divide by zero (T-U13)", () => {
  // The R-D10 shape: a seat-holder whose month held one session, and it failed.
  const FAILED = [row({ cost: 8.23, accepted: false, task: "equilibrio/mobile-app#197" })];

  it("returns no figure at all, rather than Infinity", () => {
    const reading = costPerCompletedTask({ key: "2026-04", partial: true, rows: FAILED });

    expect(reading.defined).toBe(false);
    expect(reading.completedTasks).toBe(0);
    expect(reading.cost).toBeCloseTo(8.23, 12);
    // The undefined arm carries no `value`, so nothing downstream can print an Infinity where
    // the product said there is no figure — the shape `change.ts` uses for the same reason.
    expect("value" in reading).toBe(false);
  });

  it("says in words what the period bought, naming the spend that has nothing to show", () => {
    const reading = costPerCompletedTask({ key: "2026-04", partial: true, rows: FAILED });

    expect(reading).toMatchObject({
      defined: false,
      message: "2026-04 holds $8.23 of spend and no Completed Task to divide it by",
    });
  });

  it("returns no figure over a seat charge either, which is the larger of the two cases", () => {
    const april = granted(
      seatBearingPeriod([
        bucket({ key: "2026-04", grain: "month", partial: true, rows: FAILED }),
      ]),
    );
    const reading = totalSpendPerCompletedTask(totalSpend(april, ROSTER, SEAT_FEE));

    expect(reading.defined).toBe(false);
    expect(reading.cost).toBeCloseTo(125.23, 12);
    expect(reading.seatCost).toBe(117);
    expect("value" in reading).toBe(false);
    expect(reading.partial).toBe(true);
  });

  it("returns no figure over an empty period, rather than 0 ÷ 0", () => {
    const reading = costPerCompletedTask({ key: "2026-04", partial: false, rows: [] });

    expect(reading.defined).toBe(false);
    expect(reading.sessions).toBe(0);
    expect(reading.cost).toBe(0);
    expect("value" in reading).toBe(false);
  });

  it("returns a figure the moment one Task lands, and the whole period's cost is in it", () => {
    const landed = [...FAILED, row({ cost: 1.77, accepted: true, task: "equilibrio/mobile-app#197" })];
    const reading = costPerCompletedTask({ key: "2026-07", partial: false, rows: landed });

    expect(reading.completedTasks).toBe(1);
    expect(figure(reading)).toBe(10);
  });
});

describe("this module prices nothing (R-M4, R-T11, ADR-0005)", () => {
  it("reads cost off the row and is indifferent to how it got there", () => {
    // Two rows carrying the same attributed cost are the same money to every figure here,
    // whatever tokens or machine time produced it — there is no field to consult that would
    // let them differ, which is R-T11 expressed as an absence.
    const tokenHeavy = row({ cost: 42, accepted: true, task: "equilibrio/api-gateway#1" });
    const computeHeavy = row({ cost: 42, accepted: true, task: "equilibrio/terraform-infra#1" });

    expect(sessionCost([tokenHeavy])).toBe(sessionCost([computeHeavy]));
    expect(Object.keys(tokenHeavy)).not.toContain("token_usage");
  });
});
