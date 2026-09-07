// T-U14, T-U15 and T-U16 — acceptance within a WorkType, Rework and Decomposition, and the
// Incomplete Task age buckets (`testing-spec.md` § 3.4, `spec.md` R-M6 / R-M16, A21), ticket 25.
//
// These are pure unit tests: `src/domain/**` may not reach the data layer (R-T5), so every row
// here is authored inline. The same claims are re-asserted against the **committed** fixture in
// `src/data/efficacy.fixture.test.ts`, because P6 says a test that would pass against an empty
// fixture is not a test — in particular R-D9's four non-empty age buckets, which is the property
// that keeps T-U16 from going vacuous.
//
// **No clock is read anywhere below** (P5). Every instant is derived from one authored base, so
// these tests pass on the same day they passed yesterday. The fixture window ends 2026-09-08 and
// the base below is inside it, which is why a wall-clock read would be invisible today and wrong
// tomorrow.
//
// Three things this file deliberately asserts as **absences**, because each is a number the
// product must be unable to state rather than merely choose not to show:
//
//   * no export produces a cross-WorkType acceptance rate (A21);
//   * Rework never consults a WorkType — the cross-type case counts, and the input type carries
//     no WorkType to narrow on;
//   * no age lands in two buckets, day 90 included.

import { describe, expect, it } from "vitest";
import { WORK_TYPE_KEYS, type WorkTypeKey } from "../types";
import * as efficacy from "./efficacy";
import {
  INCOMPLETE_AGE_BUCKETS,
  acceptanceRateByWorkType,
  acceptanceRateWithin,
  decompositionRate,
  incompleteTaskAges,
  reworkRate,
  taskFacts,
  type AcceptanceRate,
  type IncompleteAgeBucketKey,
  type IncompleteTaskAges,
  type SessionOutcome,
  type TaskFacts,
  type TaskSession,
} from "./efficacy";

/** A session as the *fixture* shapes one: it carries a WorkType even at Task grain. */
type Row = TaskSession & { readonly work_type: WorkTypeKey };

/** The one authored instant everything below is measured from. Never a clock read (P5). */
const NOW = "2026-09-08T12:00:00Z";
const NOW_AT = Date.parse(NOW);
const MS_PER_DAY = 86_400_000;

/** An instant `days` (and optionally `hours`) before `NOW`. Arithmetic, not a clock. */
const daysBefore = (days: number, hours = 0): string =>
  new Date(NOW_AT - days * MS_PER_DAY - hours * 3_600_000).toISOString();

const outcome = (workType: WorkTypeKey, accepted: boolean): SessionOutcome => ({
  work_type: workType,
  accepted,
});

/** A session on a Task, `startedDaysAgo` before `NOW`. It is what orders the Task's sessions. */
const session = (
  taskKey: string,
  workType: WorkTypeKey,
  accepted: boolean,
  startedDaysAgo: number,
): Row => ({
  task_key: taskKey,
  work_type: workType,
  accepted,
  started_at: daysBefore(startedDaysAgo),
  ended_at: daysBefore(startedDaysAgo),
});

const factsFor = (rows: readonly Row[]): TaskFacts => {
  const [facts, ...rest] = taskFacts(rows);
  if (!facts || rest.length > 0) throw new Error(`expected exactly one Task, got ${rest.length + 1}`);
  return facts;
};

const bucketOf = (report: IncompleteTaskAges, key: IncompleteAgeBucketKey): number => {
  const bucket = report.buckets.find((held) => held.key === key);
  if (!bucket) throw new Error(`no ${key} bucket`);
  return bucket.count;
};

/** A Task with one unaccepted session that ended `days` ago — the only shape the buckets read. */
const incompleteAged = (taskKey: string, days: number, hours = 0): Row => ({
  task_key: taskKey,
  work_type: "implementation",
  accepted: false,
  started_at: daysBefore(days + 1, hours),
  ended_at: daysBefore(days, hours),
});

const agesOf = (rows: readonly Row[], now = NOW): IncompleteTaskAges =>
  incompleteTaskAges(taskFacts(rows), now);

// ---------------------------------------------------------------------------------------------
// T-U14 — Acceptance rate is computed within a WorkType only (R-M6, A21)
// ---------------------------------------------------------------------------------------------

/**
 * A deliberately lopsided mixed population: `review` accepts 2 of 3, `deploy` 0 of 2 and
 * `implementation` 1 of 1. The cross-WorkType figure a naive implementation would produce is
 * 3 of 6 — a number equal to none of the three, so a test that accidentally averaged them
 * would show it.
 */
const MIXED: readonly SessionOutcome[] = [
  outcome("review", true),
  outcome("review", true),
  outcome("review", false),
  outcome("deploy", false),
  outcome("deploy", false),
  outcome("implementation", true),
];

describe("T-U14 — acceptance rate is computed within a WorkType (R-M6, A21)", () => {
  it("divides a WorkType's accepted sessions by that WorkType's own sessions", () => {
    expect(acceptanceRateWithin("review", MIXED)).toEqual({
      work_type: "review",
      sessions: 3,
      accepted: 2,
      rate: 2 / 3,
    });
  });

  it("counts no other WorkType's sessions, in either the numerator or the denominator", () => {
    const reviewOnly = MIXED.filter((row) => row.work_type === "review");

    // The same figure whether the other four types are in the population or not: rows of
    // another WorkType are gone before anything is counted.
    expect(acceptanceRateWithin("review", MIXED)).toEqual(acceptanceRateWithin("review", reviewOnly));
    expect(acceptanceRateWithin("deploy", MIXED)).toMatchObject({ sessions: 2, accepted: 0, rate: 0 });
    // The cross-WorkType figure over this population is 3 accepted of 6. No function here
    // returns it, and no WorkType's own rate is anywhere near it.
    const crossWorkType = MIXED.filter((row) => row.accepted).length / MIXED.length;
    const distances = WORK_TYPE_KEYS.map((key) => acceptanceRateWithin(key, MIXED).rate)
      .filter((rate): rate is number => rate !== null)
      .map((rate) => Math.abs(rate - crossWorkType));

    expect(distances).toHaveLength(3);
    expect(Math.min(...distances)).toBeGreaterThan(0.1);
  });

  it("returns null rather than dividing by zero where a WorkType ran nothing", () => {
    expect(acceptanceRateWithin("refactor", MIXED)).toEqual({
      work_type: "refactor",
      sessions: 0,
      accepted: 0,
      rate: null,
    });
    expect(acceptanceRateWithin("review", []).rate).toBeNull();
  });

  it("names its WorkType on every figure, so a rate cannot be shown without its criterion", () => {
    for (const key of WORK_TYPE_KEYS) {
      expect(acceptanceRateWithin(key, MIXED).work_type).toBe(key);
    }
  });

  it("keys the whole-vocabulary view by WorkType — there is no key for an org-level figure", () => {
    const byType = acceptanceRateByWorkType(MIXED);

    expect(Object.keys(byType).sort()).toEqual([...WORK_TYPE_KEYS].sort());
    // The absence, stated: no `total`, no `overall`, no `organization`, no `all`.
    for (const forbidden of ["total", "overall", "organization", "all", "combined", "average"]) {
      expect(byType).not.toHaveProperty(forbidden);
    }
    expect(byType.review).toEqual(acceptanceRateWithin("review", MIXED));
    expect(byType.deploy.rate).toBe(0);
    expect(byType.bugfix.rate).toBeNull();
  });

  it("offers no argument naming every WorkType: the vocabulary has no `all` member", () => {
    // `acceptanceRateWithin` requires a `WorkTypeKey`, and the union is exactly these five.
    expect([...WORK_TYPE_KEYS]).toEqual([
      "implementation",
      "refactor",
      "bugfix",
      "review",
      "deploy",
    ]);
    expect(WORK_TYPE_KEYS).not.toContain("all");
    // Two required parameters, the first of them the WorkType. There is no one-argument form
    // that could mean "over everything".
    expect(acceptanceRateWithin).toHaveLength(2);
  });

  it("exports no aggregate entry point that could produce a cross-WorkType figure", () => {
    const exported = Object.keys(efficacy);

    expect(exported).toContain("acceptanceRateWithin");
    expect(exported).toContain("acceptanceRateByWorkType");
    // A21 as an absence over the whole module surface, not just over one function's signature.
    const aggregate = exported.filter((name) =>
      /^acceptance/i.test(name) && !/within|byworktype/i.test(name),
    );
    expect(aggregate).toEqual([]);
    expect(
      exported.filter((name) => /overall|organi[sz]ation|acrossworktypes|combinedacceptance/i.test(name)),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// T-U15 — Rework and Decomposition (R-M1, `CONTEXT.md` § Work)
// ---------------------------------------------------------------------------------------------

describe("T-U15 — Rework is a failed session followed by another, of any WorkType", () => {
  it("labels a Task where a non-accepted session is followed by a second attempt", () => {
    const facts = factsFor([
      session("acme/api#1", "implementation", false, 20),
      session("acme/api#1", "implementation", true, 10),
    ]);

    expect(facts).toMatchObject({ task_key: "acme/api#1", sessions: 2, accepted: 1, rework: true });
  });

  it("counts the cross-WorkType follow-up: a failed `review` then an `implementation`", () => {
    // The clause ticket 05 dropped. `TaskSession` carries no `work_type` at all, so there is
    // nothing here for a same-type restriction to read — the rows below carry one anyway, to
    // show that a real session shape is accepted and that the WorkType changes nothing.
    const crossType = factsFor([
      session("acme/api#2", "review", false, 30),
      session("acme/api#2", "implementation", true, 12),
    ]);
    const sameType = factsFor([
      session("acme/api#3", "review", false, 30),
      session("acme/api#3", "review", true, 12),
    ]);

    expect(crossType.rework).toBe(true);
    // Identical labels: the follow-up's WorkType is not a fact this metric consults.
    expect({ ...crossType, task_key: "" }).toEqual({ ...sameType, task_key: "" });
  });

  it("does not label a single failed session — nothing followed it", () => {
    const facts = factsFor([session("acme/api#4", "deploy", false, 40)]);

    expect(facts).toMatchObject({ sessions: 1, accepted: 0, rework: false, completed: false });
  });

  it("does not label a failure that is the Task's *last* session", () => {
    // Accepted, then a later session that failed: no non-accepted session was followed by
    // anything, so this is not a second attempt at the Task.
    const facts = factsFor([
      session("acme/api#5", "implementation", true, 20),
      session("acme/api#5", "refactor", false, 5),
    ]);

    expect(facts).toMatchObject({ sessions: 2, rework: false, completed: true });
  });

  it("reads `followed by` off the sessions' own order, not the input's", () => {
    const forwards = factsFor([
      session("acme/api#6", "bugfix", false, 30),
      session("acme/api#6", "bugfix", true, 3),
    ]);
    const backwards = factsFor([
      session("acme/api#6", "bugfix", true, 3),
      session("acme/api#6", "bugfix", false, 30),
    ]);

    expect(backwards).toEqual(forwards);
    expect(backwards.rework).toBe(true);
  });
});

describe("T-U15 — Decomposition is more than one *accepted* session", () => {
  it("labels a Task with two accepted sessions", () => {
    const facts = factsFor([
      session("acme/api#7", "implementation", true, 30),
      session("acme/api#7", "deploy", true, 20),
    ]);

    expect(facts).toMatchObject({ accepted: 2, decomposition: true, rework: false });
  });

  it("does not label a second session that was not accepted — that is repetition, not a split", () => {
    const facts = factsFor([
      session("acme/api#8", "implementation", false, 30),
      session("acme/api#8", "implementation", false, 20),
    ]);

    expect(facts).toMatchObject({ sessions: 2, accepted: 0, decomposition: false, rework: true });
  });

  it("does not label a single accepted session however long the Task ran", () => {
    expect(factsFor([session("acme/api#9", "review", true, 90)])).toMatchObject({
      accepted: 1,
      decomposition: false,
    });
  });
});

describe("T-U15 — Rework and Decomposition are independent labels, not a partition", () => {
  /** One Task per combination. A partition could not hold the first of them. */
  const ROWS: readonly Row[] = [
    // Both: failed, then split across two accepted sessions of *different* WorkTypes.
    session("acme/api#10", "implementation", false, 40),
    session("acme/api#10", "review", true, 30),
    session("acme/api#10", "bugfix", true, 20),
    // Rework only.
    session("acme/api#11", "bugfix", false, 40),
    session("acme/api#11", "bugfix", true, 30),
    // Decomposition only.
    session("acme/api#12", "implementation", true, 40),
    session("acme/api#12", "deploy", true, 30),
    // Neither.
    session("acme/api#13", "refactor", true, 40),
  ];

  const TASKS = taskFacts(ROWS);
  const labelled = (key: string): TaskFacts => {
    const facts = TASKS.find((held) => held.task_key === key);
    if (!facts) throw new Error(`no ${key}`);
    return facts;
  };

  it("labels one Task with both — a long Task can be repeated *and* split", () => {
    expect(labelled("acme/api#10")).toMatchObject({
      sessions: 3,
      accepted: 2,
      rework: true,
      decomposition: true,
      completed: true,
    });
  });

  it("reaches all four combinations, which is what makes them two labels and not one", () => {
    const combinations = TASKS.map((task) => `${task.rework ? "R" : "-"}${task.decomposition ? "D" : "-"}`);

    expect(combinations.sort()).toEqual(["--", "-D", "R-", "RD"]);
    expect(labelled("acme/api#11")).toMatchObject({ rework: true, decomposition: false });
    expect(labelled("acme/api#12")).toMatchObject({ rework: false, decomposition: true });
    expect(labelled("acme/api#13")).toMatchObject({ rework: false, decomposition: false });
  });

  it("counts the both-Task in each rate, so the two rates sum past the Tasks exhibiting either", () => {
    expect(reworkRate(TASKS)).toEqual({ tasks: 4, count: 2, rate: 0.5 });
    expect(decompositionRate(TASKS)).toEqual({ tasks: 4, count: 2, rate: 0.5 });
    // 2 + 2 = 4 labels over 3 labelled Tasks. A partition would have made this 3.
    const either = TASKS.filter((task) => task.rework || task.decomposition).length;
    expect(reworkRate(TASKS).count + decompositionRate(TASKS).count).toBeGreaterThan(either);
  });

  it("divides by every Task in the population, Completed and Incomplete alike", () => {
    expect(reworkRate(TASKS).tasks).toBe(TASKS.length);
    expect(decompositionRate(TASKS).tasks).toBe(TASKS.length);
  });

  it("returns null rather than dividing by zero over an empty population", () => {
    expect(reworkRate([])).toEqual({ tasks: 0, count: 0, rate: null });
    expect(decompositionRate([])).toEqual({ tasks: 0, count: 0, rate: null });
    expect(taskFacts([])).toEqual([]);
  });

  it("groups sessions by Task key and returns them in a stable order", () => {
    expect(TASKS.map((task) => task.task_key)).toEqual([
      "acme/api#10",
      "acme/api#11",
      "acme/api#12",
      "acme/api#13",
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// T-U16 — Incomplete Task age buckets (R-M16, R-D9, P5)
// ---------------------------------------------------------------------------------------------

describe("T-U16 — the four buckets are half-open and do not double-cover day 90", () => {
  it("declares 0–7 · 8–30 · 31–90 · 91+, contiguous and open-ended at the top", () => {
    expect(INCOMPLETE_AGE_BUCKETS.map((bucket) => bucket.key)).toEqual([
      "0-7",
      "8-30",
      "31-90",
      "91+",
    ]);
    // R-M16's wording is `91+`, not `90+`: the third bucket ends *after* day 90.
    expect(INCOMPLETE_AGE_BUCKETS.map((bucket) => bucket.fromDays)).toEqual([0, 8, 31, 91]);
    expect(INCOMPLETE_AGE_BUCKETS.map((bucket) => bucket.toDaysExclusive)).toEqual([8, 31, 91, null]);

    // Each bucket starts exactly where the previous one stopped: no gap, and no day covered
    // twice — the off-by-one this test exists to prevent.
    INCOMPLETE_AGE_BUCKETS.forEach((bucket, index) => {
      if (index === 0) return;
      expect(bucket.fromDays).toBe(INCOMPLETE_AGE_BUCKETS[index - 1].toDaysExclusive);
    });
  });

  it("puts a Task aged exactly 90 days in one bucket only", () => {
    const report = agesOf([incompleteAged("acme/api#90", 90)]);

    expect(report.tasks.map((task) => task.ageDays)).toEqual([90]);
    expect(report.tasks.map((task) => task.bucket)).toEqual(["31-90"]);
    expect(bucketOf(report, "31-90")).toBe(1);
    expect(bucketOf(report, "91+")).toBe(0);
    expect(report.total).toBe(1);
  });

  it("separates day 89, day 90 and day 91", () => {
    const report = agesOf([
      incompleteAged("acme/api#89", 89),
      incompleteAged("acme/api#90", 90),
      incompleteAged("acme/api#91", 91),
    ]);
    const placed = new Map(report.tasks.map((task) => [task.task_key, task.bucket]));

    expect(placed.get("acme/api#89")).toBe("31-90");
    expect(placed.get("acme/api#90")).toBe("31-90");
    expect(placed.get("acme/api#91")).toBe("91+");
    expect(bucketOf(report, "31-90")).toBe(2);
    expect(bucketOf(report, "91+")).toBe(1);
  });

  it("separates the other two boundaries the same way: 7/8 and 30/31", () => {
    const report = agesOf([
      incompleteAged("acme/api#7", 7),
      incompleteAged("acme/api#8", 8),
      incompleteAged("acme/api#30", 30),
      incompleteAged("acme/api#31", 31),
    ]);
    const placed = new Map(report.tasks.map((task) => [task.task_key, task.bucket]));

    expect(placed.get("acme/api#7")).toBe("0-7");
    expect(placed.get("acme/api#8")).toBe("8-30");
    expect(placed.get("acme/api#30")).toBe("8-30");
    expect(placed.get("acme/api#31")).toBe("31-90");
  });

  it("places every age from 0 to 120 in exactly one bucket, and in the declared one", () => {
    for (let age = 0; age <= 120; age += 1) {
      const report = agesOf([incompleteAged("acme/api#0", age)]);
      const declared = INCOMPLETE_AGE_BUCKETS.filter(
        (bucket) =>
          age >= bucket.fromDays &&
          (bucket.toDaysExclusive === null || age < bucket.toDaysExclusive),
      );

      expect(declared).toHaveLength(1);
      expect(report.tasks[0].bucket).toBe(declared[0].key);
      expect(report.buckets.reduce((running, bucket) => running + bucket.count, 0)).toBe(1);
    }
  });

  it("floors a part-day: 7 days and 23 hours is 7 days old, and 90 days and 23 hours is 90", () => {
    const report = agesOf([incompleteAged("acme/api#a", 7, 23), incompleteAged("acme/api#b", 90, 23)]);
    const placed = new Map(report.tasks.map((task) => [task.task_key, task.bucket]));

    expect(report.tasks.map((task) => task.ageDays)).toEqual([7, 90]);
    expect(placed.get("acme/api#a")).toBe("0-7");
    expect(placed.get("acme/api#b")).toBe("31-90");
  });
});

describe("T-U16 — Incomplete is a Task with no accepted session, and nothing more", () => {
  it("excludes every Task that has an accepted session, however many failures preceded it", () => {
    const report = agesOf([
      session("acme/api#20", "implementation", false, 100),
      session("acme/api#20", "implementation", false, 95),
      session("acme/api#20", "bugfix", true, 92),
      incompleteAged("acme/api#21", 95),
    ]);

    expect(report.tasks.map((task) => task.task_key)).toEqual(["acme/api#21"]);
    expect(report.total).toBe(1);
  });

  it("ages from the Task's most recent session, not its first", () => {
    const facts = factsFor([
      incompleteAged("acme/api#22", 120),
      incompleteAged("acme/api#22", 4),
      incompleteAged("acme/api#22", 60),
    ]);
    const report = incompleteTaskAges([facts], NOW);

    expect(report.tasks[0].ageDays).toBe(4);
    expect(report.tasks[0].bucket).toBe("0-7");
    expect(facts.lastSessionEndedAt).toBe(daysBefore(4));
  });

  it("returns all four buckets even when three of them are empty", () => {
    const report = agesOf([incompleteAged("acme/api#23", 200)]);

    expect(report.buckets.map((bucket) => bucket.count)).toEqual([0, 0, 0, 1]);
    expect(report.buckets.map((bucket) => bucket.label)).toEqual([
      "0–7 days",
      "8–30 days",
      "31–90 days",
      "91+ days",
    ]);
    expect(report.buckets.map((bucket) => bucket.taskKeys)).toEqual([[], [], [], ["acme/api#23"]]);
  });

  it("holds nothing at all when every Task is Completed", () => {
    const report = agesOf([session("acme/api#24", "review", true, 200)]);

    expect(report).toEqual({
      buckets: report.buckets,
      tasks: [],
      unaged: [],
      total: 0,
    });
    expect(report.buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });

  it("carries no status, threshold or `abandoned` label — an age is all it says", () => {
    const report = agesOf([incompleteAged("acme/api#25", 140)]);
    const [task] = report.tasks;

    expect(Object.keys(task).sort()).toEqual([
      "ageDays",
      "bucket",
      "lastSessionEndedAt",
      "task_key",
    ]);
    for (const forbidden of ["status", "abandoned", "stale", "threshold", "inFlight"]) {
      expect(task).not.toHaveProperty(forbidden);
      expect(report).not.toHaveProperty(forbidden);
    }
  });
});

describe("T-U16 — `now` is injected (P5)", () => {
  const ROWS: readonly Row[] = [incompleteAged("acme/api#26", 10)];

  it("buckets the same rows differently as `now` moves, and reads no clock to do it", () => {
    const today = agesOf(ROWS);
    const inNinetyDays = agesOf(ROWS, new Date(NOW_AT + 90 * MS_PER_DAY).toISOString());

    expect(today.tasks[0].ageDays).toBe(10);
    expect(today.tasks[0].bucket).toBe("8-30");
    expect(inNinetyDays.tasks[0].ageDays).toBe(100);
    expect(inNinetyDays.tasks[0].bucket).toBe("91+");
  });

  it("ages a Task whose last session ends after `now` at 0 rather than negatively", () => {
    const report = agesOf(ROWS, new Date(NOW_AT - 30 * MS_PER_DAY).toISOString());

    expect(report.tasks[0].ageDays).toBe(0);
    expect(report.tasks[0].bucket).toBe("0-7");
  });

  it("ages nothing against a `now` that is not an instant, rather than dating from the epoch", () => {
    const report = agesOf(ROWS, "not-an-instant");

    expect(report.unaged).toEqual(["acme/api#26"]);
    expect(report.tasks).toEqual([]);
    expect(report.total).toBe(0);
    expect(report.buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });

  it("ages nothing for a Task whose last session carries no readable instant", () => {
    const unreadable: Row = {
      task_key: "acme/api#27",
      work_type: "deploy",
      accepted: false,
      started_at: "whenever",
      ended_at: "whenever",
    };
    const report = agesOf([unreadable, ...ROWS]);

    expect(report.unaged).toEqual(["acme/api#27"]);
    expect(report.tasks.map((task) => task.task_key)).toEqual(["acme/api#26"]);
    // The bucket counts sum to the Tasks that *were* aged, so the two cannot disagree.
    expect(report.buckets.reduce((running, bucket) => running + bucket.count, 0)).toBe(report.total);
  });
});

describe("session order is read off the sessions, whatever shape they arrive in", () => {
  /** A session spanning two dates, for the cases where start order and end order disagree. */
  const span = (spec: {
    readonly task: string;
    readonly accepted: boolean;
    readonly startedDaysAgo: number;
    readonly endedDaysAgo: number;
  }): Row => ({
    task_key: spec.task,
    work_type: "implementation",
    accepted: spec.accepted,
    started_at: daysBefore(spec.startedDaysAgo),
    ended_at: daysBefore(spec.endedDaysAgo),
  });

  it("ages from the latest end, not from the last session to start", () => {
    // A long session that started first and finished last, overlapped by a short later one.
    const facts = factsFor([
      span({ task: "acme/api#30", accepted: false, startedDaysAgo: 30, endedDaysAgo: 2 }),
      span({ task: "acme/api#30", accepted: false, startedDaysAgo: 10, endedDaysAgo: 9 }),
    ]);

    expect(facts.lastSessionEndedAt).toBe(daysBefore(2));
    expect(incompleteTaskAges([facts], NOW).tasks[0]).toMatchObject({ ageDays: 2, bucket: "0-7" });
  });

  it("breaks a tie on the start by the end, so the order is total", () => {
    const failedFirst = factsFor([
      span({ task: "acme/api#31", accepted: false, startedDaysAgo: 20, endedDaysAgo: 19 }),
      span({ task: "acme/api#31", accepted: true, startedDaysAgo: 20, endedDaysAgo: 12 }),
    ]);
    const sameTwoReversed = factsFor([
      span({ task: "acme/api#31", accepted: true, startedDaysAgo: 20, endedDaysAgo: 12 }),
      span({ task: "acme/api#31", accepted: false, startedDaysAgo: 20, endedDaysAgo: 19 }),
    ]);

    // Same start: the session that finished first is the one the other followed.
    expect(failedFirst).toMatchObject({ rework: true, decomposition: false, completed: true });
    expect(sameTwoReversed).toEqual(failedFirst);
  });

  it("still groups a session carrying no readable instant, and ages the Task from a readable one", () => {
    const unreadable: Row = {
      task_key: "acme/api#32",
      work_type: "review",
      accepted: false,
      started_at: "whenever",
      ended_at: "whenever",
    };
    const facts = factsFor([unreadable, incompleteAged("acme/api#32", 45)]);

    expect(facts.sessions).toBe(2);
    expect(facts.lastSessionEndedAt).toBe(daysBefore(45));
    expect(incompleteTaskAges([facts], NOW).tasks[0]).toMatchObject({ ageDays: 45, bucket: "31-90" });
  });
});

describe("the shapes are the ones the rest of the product consumes", () => {
  it("accepts a row carrying more fields than it reads", () => {
    // `AgentSession` satisfies `TaskSession` and `SessionOutcome` structurally; nothing here
    // needs a projection step, and nothing here can reach a field it was not given.
    const rate: AcceptanceRate = acceptanceRateWithin("implementation", MIXED);
    const facts: readonly TaskFacts[] = taskFacts([session("acme/api#28", "implementation", true, 1)]);

    expect(rate.work_type).toBe("implementation");
    expect(facts[0].sessions).toBe(1);
  });
});
