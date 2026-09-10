// T-U14 / T-U15 / T-U16 against the **committed** fixture (R-D6, R-D8, R-D9, A21, P3, P6).
//
// The pure unit tests live in `src/domain/metrics/efficacy.test.ts` and author every row inline,
// because `src/domain/**` may not reach the data layer (R-T5). This file sits outside that
// boundary, so it may import `load.ts` — and it exists because P6 says a test that would pass
// against an empty fixture is not a test. Three of the four figures in `efficacy.ts` would pass
// their unit tests against no data at all, and the fourth — the four age buckets — is the one
// `testing-spec.md` § 6 names explicitly: *"a fixture that quietly loses the 90+ day bucket makes
// T-U16 pass vacuously"*. So the properties the generator seeded are asserted here, on the rows
// the product actually ships: R-D6's five acceptance rates, R-D8's 18% / 12%, and R-D9's four
// non-empty buckets.
//
// It reads committed output and never runs the generator (P3, R-T20). It follows the precedent
// `periods.fixture.test.ts` and `change.fixture.test.ts` set for the same reason.

import { describe, expect, it } from "vitest";
import {
  INCOMPLETE_AGE_BUCKETS,
  acceptanceRateByWorkType,
  acceptanceRateWithin,
  decompositionRate,
  incompleteTaskAges,
  reworkRate,
  taskFacts,
  type IncompleteAgeBucketKey,
  type TaskFacts,
} from "@/domain/metrics/efficacy";
import { WORK_TYPE_KEYS, type AgentSession, type WorkTypeKey } from "@/domain/types";
import { loadDataset } from "./load";

const { organization, sessions } = loadDataset();

/** The last instant of the fixture window, in the Organization's timezone. P5: never a clock read. */
const NOW = `${organization.window_end}T23:59:59+02:00`;

const TASKS = taskFacts(sessions);

const sessionsOn = (taskKey: string): readonly AgentSession[] =>
  sessions
    .filter((session) => session.task_key === taskKey)
    .toSorted((left, right) => Date.parse(left.started_at) - Date.parse(right.started_at));

const factsOn = (taskKey: string): TaskFacts => {
  const facts = TASKS.find((task) => task.task_key === taskKey);
  if (!facts) throw new Error(`no Task ${taskKey} in the committed fixture`);
  return facts;
};

const AGES = incompleteTaskAges(TASKS, NOW);

const countIn = (key: IncompleteAgeBucketKey): number => {
  const bucket = AGES.buckets.find((held) => held.key === key);
  if (!bucket) throw new Error(`no ${key} bucket`);
  return bucket.count;
};

describe("the committed fixture carries what these metrics need (P6)", () => {
  it("holds 7,761 sessions across every Task they name — the population every figure divides", () => {
    // The **root** count is structural: it is the schedule R-D4 draws, and ticket 67 moved no
    // slot. The **Task** count is not, and is derived rather than written down — ticket 67 took
    // it from 5,970 to a smaller number by putting the reviews on the Tasks they review instead
    // of on Tasks of their own, and a literal here would have to be re-typed on every such
    // change without ever having said anything the rows do not.
    expect(sessions).toHaveLength(7761);
    expect(TASKS).toHaveLength(new Set(sessions.map((session) => session.task_key)).size);
    expect(TASKS.length).toBeGreaterThan(2000);
    expect(TASKS.reduce((running, task) => running + task.sessions, 0)).toBe(sessions.length);
  });

  it("runs every WorkType, so no acceptance rate below is null for want of data", () => {
    for (const key of WORK_TYPE_KEYS) {
      expect(acceptanceRateWithin(key, sessions).sessions).toBeGreaterThan(0);
    }
  });
});

describe("T-U14 — acceptance rate by WorkType on the shipped rows (R-D6, A21)", () => {
  it("reproduces R-D6: review 0.86 · bugfix 0.79 · implementation 0.71 · refactor 0.58 · deploy 0.34", () => {
    const byType = acceptanceRateByWorkType(sessions);

    expect(byType.review.rate).toBeCloseTo(0.86, 2);
    expect(byType.bugfix.rate).toBeCloseTo(0.79, 2);
    expect(byType.implementation.rate).toBeCloseTo(0.71, 2);
    expect(byType.refactor.rate).toBeCloseTo(0.58, 2);
    expect(byType.deploy.rate).toBeCloseTo(0.34, 2);
  });

  it("counts each criterion's own sessions and no other's", () => {
    const byType = acceptanceRateByWorkType(sessions);
    const denominators = WORK_TYPE_KEYS.map((key) => byType[key].sessions);

    // Each denominator is that WorkType's own rows and nothing else. Derived rather than
    // written down: the five counts move with R-D22's mix, and what has to hold is that they
    // are the rows themselves — a literal would restate the fixture, not check it.
    expect(denominators).toEqual(
      WORK_TYPE_KEYS.map((key) => sessions.filter((session) => session.work_type === key).length),
    );
    expect(Math.min(...denominators)).toBeGreaterThan(0);
    // The five denominators partition the session population — no session is counted twice and
    // none is counted nowhere, because every session declares exactly one WorkType.
    expect(denominators.reduce((running, held) => running + held, 0)).toBe(sessions.length);
  });

  it("states no figure spanning two criteria — the 0.66 the product refuses to compute", () => {
    // 493 accepted of 742 is 0.66 org-wide. It is a real division over real rows, and it means
    // nothing: `deploy` accepts on a landed commit, `review` on a submitted review. No function
    // in `efficacy.ts` produces it, so it is computed *here*, in the test, purely to show it
    // matches none of the five figures the product does state (R-M6, A21).
    const crossWorkType =
      sessions.filter((session) => session.accepted).length / sessions.length;
    const byType = acceptanceRateByWorkType(sessions);

    expect(crossWorkType).toBeCloseTo(0.66, 2);
    for (const key of WORK_TYPE_KEYS) {
      // No WorkType's own reading is within a percentage point of it.
      expect(Math.abs((byType[key].rate ?? 0) - crossWorkType)).toBeGreaterThan(0.01);
    }
    // The spread it hides: 0.34 to 0.86, and every WorkType's own reading is on one side of it.
    expect(Math.max(...WORK_TYPE_KEYS.map((key) => byType[key].rate ?? 0))).toBeGreaterThan(crossWorkType);
    expect(Math.min(...WORK_TYPE_KEYS.map((key) => byType[key].rate ?? 1))).toBeLessThan(crossWorkType);
  });
});

describe("T-U15 — Rework and Decomposition on the shipped rows (R-D8)", () => {
  it("reproduces R-D8: Rework 18% of Tasks, Decomposition 12%, over non-review sessions", () => {
    // The rates are the requirement and stay literal. The counts behind them are the rates
    // times the population and are derived from it, so that a change in Task volume shows up
    // as a rate that moved rather than as three numbers to re-type.
    expect(reworkRate(TASKS).tasks).toBe(TASKS.length);
    expect(reworkRate(TASKS).count).toBe(Math.round(0.18 * TASKS.length));
    expect(reworkRate(TASKS).rate).toBeCloseTo(0.18, 2);
    expect(decompositionRate(TASKS).tasks).toBe(TASKS.length);
    expect(decompositionRate(TASKS).count).toBe(Math.round(0.12 * TASKS.length));
    expect(decompositionRate(TASKS).rate).toBeCloseTo(0.12, 2);
  });

  it("would read Decomposition on nearly every Task if a review counted as an attempt", () => {
    // ticket 67 — the reason `factsFor` narrows to non-review sessions. Every Job that was
    // built is reviewed (R-D22), so counting a review as a second accepted attempt turns "work
    // deliberately split" into "work that was reviewed" and the label stops meaning anything.
    const naive = TASKS.filter(
      (task) => sessionsOn(task.task_key).filter((session) => session.accepted).length > 1,
    );

    expect(naive.length / TASKS.length).toBeGreaterThan(0.4);
    expect(decompositionRate(TASKS).rate).toBeCloseTo(0.12, 2);
  });

  it("holds Tasks in all four label combinations — the labels do not partition the fixture", () => {
    const combinations = new Map<string, number>();
    for (const task of TASKS) {
      const key = `${task.rework ? "R" : "-"}${task.decomposition ? "D" : "-"}`;
      combinations.set(key, (combinations.get(key) ?? 0) + 1);
    }

    expect([...combinations.keys()].toSorted()).toEqual(["--", "-D", "R-", "RD"]);
    expect([...combinations.values()].reduce((running, held) => running + held, 0)).toBe(
      TASKS.length,
    );
    // The two rates sum past the Tasks exhibiting either, by exactly the both-Tasks — which is
    // what "independent labels, not a partition" means arithmetically.
    const both = combinations.get("RD") ?? 0;
    const either = TASKS.filter((task) => task.rework || task.decomposition).length;

    expect(both).toBeGreaterThan(0);
    expect(reworkRate(TASKS).count + decompositionRate(TASKS).count).toBe(either + both);
  });

  it("names a Task exhibiting both — a failed Job, then two accepted ones on the same Task", () => {
    // The Task is *found* rather than named: ticket 67 renumbered every issue, so a key written
    // down here would be a key to re-type. What the case asserts is the shape.
    const both = TASKS.find((task) => task.rework && task.decomposition);
    const built = sessionsOn(both?.task_key ?? "").filter(
      (session) => session.work_type !== "review",
    );

    expect(both).toBeDefined();
    expect(built.length).toBeGreaterThanOrEqual(3);
    expect(built[0].accepted).toBe(false);
    expect(built.filter((session) => session.accepted).length).toBeGreaterThan(1);
    expect(both).toMatchObject({ rework: true, decomposition: true, completed: true });
  });

  it("counts the cross-WorkType follow-up — the clause ticket 05 dropped and 67 did not restore", () => {
    // Every Task whose Rework label comes from a failed session followed by a session of a
    // *different* WorkType. Under the strict same-type reading these would not be Rework, and
    // the rate would fall below R-D8's 18%. The consequence is accepted, not a bug.
    //
    // Read over the Task's **non-review** sessions, because that is the population the label is
    // read over since ticket 67 — a review following a failed Job is not the follow-up attempt.
    const crossType = TASKS.filter((task) => {
      const built = sessionsOn(task.task_key).filter((session) => session.work_type !== "review");
      return built.some(
        (session, index) =>
          !session.accepted &&
          built.slice(index + 1).some((later) => later.work_type !== session.work_type),
      );
    });

    expect(crossType.length).toBeGreaterThan(100);
    expect(crossType.every((task) => task.rework)).toBe(true);
    // A strict subset of the Rework Tasks: the same-type follow-ups are the rest.
    expect(crossType.length).toBeLessThan(reworkRate(TASKS).count);
  });
});

describe("T-U16 — Incomplete Task age buckets on the shipped rows (R-D9)", () => {
  it("fills all four buckets, so T-U16 cannot pass vacuously (P6, R-D9)", () => {
    expect(AGES.buckets.map((bucket) => bucket.count).reduce((a, b) => a + b, 0)).toBe(AGES.total);
    for (const bucket of AGES.buckets) {
      expect(bucket.count).toBeGreaterThan(0);
    }
    // 91+ is reachable inside the 167-day window, so the oldest bucket is not empty by
    // construction — which is exactly what R-D9 was seeded to guarantee.
    expect(countIn("91+")).toBeGreaterThan(0);
    expect(Math.max(...AGES.tasks.map((task) => task.ageDays))).toBeGreaterThan(91);
  });

  it("counts every Task with no accepted session, and only those", () => {
    const incomplete = TASKS.filter((task) => !task.completed);

    expect(AGES.total).toBe(incomplete.length);
    expect(AGES.total).toBeGreaterThan(200);
    expect(AGES.buckets.reduce((running, bucket) => running + bucket.count, 0)).toBe(AGES.total);
    expect(AGES.tasks.every((task) => factsOn(task.task_key).accepted === 0)).toBe(true);
  });

  it("ages every one of them: the fixture carries no unreadable instant", () => {
    expect(AGES.unaged).toEqual([]);
    expect(AGES.tasks.every((task) => Number.isInteger(task.ageDays))).toBe(true);
    expect(Math.min(...AGES.tasks.map((task) => task.ageDays))).toBeGreaterThanOrEqual(0);
  });

  it("ages a Task whose last session ran past `now` at 0, rather than at a negative age", () => {
    // The clamp, exercised over committed rows by reading them from **inside** the window: every
    // Task still to be worked on that date has a last session in its future, and is as recent as
    // the injected clock allows. A `now` at the end of the window reaches the same code with
    // whatever rows happen to overrun 25 September, which is a population the fixture is not
    // obliged to hold; this one is hundreds of rows and does not depend on the mix (P5, P6).
    const midway = `${organization.window_start}T23:59:59+02:00`;
    const early = incompleteTaskAges(TASKS, midway);
    const ahead = early.tasks.filter(
      (task) => Date.parse(task.lastSessionEndedAt) > Date.parse(midway),
    );

    expect(ahead.length).toBeGreaterThan(100);
    for (const task of ahead) expect(task).toMatchObject({ ageDays: 0, bucket: "0-7" });
  });

  it("puts each Task in exactly the bucket its own age declares, day 90 included", () => {
    for (const task of AGES.tasks) {
      const declared = INCOMPLETE_AGE_BUCKETS.filter(
        (bucket) =>
          task.ageDays >= bucket.fromDays &&
          (bucket.toDaysExclusive === null || task.ageDays < bucket.toDaysExclusive),
      );

      expect(declared).toHaveLength(1);
      expect(task.bucket).toBe(declared[0].key);
    }
    // The fixture reaches the boundary this test exists to guard: a Task aged exactly 90 days.
    const onDay90 = AGES.tasks.filter((task) => task.ageDays === 90);

    expect(onDay90.length).toBeGreaterThan(0);
    expect(onDay90.every((task) => task.bucket === "31-90")).toBe(true);
    // …and it holds Tasks on both sides of it, so the boundary is between two populated days
    // rather than at the edge of the data. The exact neighbouring days move with the mix; that
    // there are neighbours does not.
    expect(AGES.tasks.some((task) => task.ageDays < 90 && task.bucket === "31-90")).toBe(true);
    expect(AGES.tasks.some((task) => task.ageDays > 90 && task.bucket === "91+")).toBe(true);
  });

  it("moves the whole distribution older as `now` moves, and reads no clock to do it (P5)", () => {
    // Ninety days past the end of the window: nothing can be younger than 91 days except the
    // Tasks whose last session ran into the final weeks, so the two young buckets empty and the
    // population lands entirely in the two old ones. The population itself never moves — the
    // report ages Tasks, it does not select them.
    const ninetyDaysOn = incompleteTaskAges(TASKS, "2026-12-07T23:59:59+01:00");
    const counts = ninetyDaysOn.buckets.map((bucket) => bucket.count);

    expect(ninetyDaysOn.total).toBe(AGES.total);
    expect(counts.slice(0, 2)).toEqual([0, 0]);
    expect(counts.reduce((running, count) => running + count, 0)).toBe(AGES.total);
    expect(ninetyDaysOn.tasks.every((task) => task.ageDays >= 73)).toBe(true);
  });
});

describe("the fixture's Tasks are the fixture's own (R-T10, T-F7 adjacent)", () => {
  it("keys every Task as `owner/repo#number`, so no grouping here is on a synthetic key", () => {
    const keys = TASKS.map((task) => task.task_key);
    const shaped = keys.filter((key: string) => /^[^/]+\/[^#]+#\d+$/.test(key));

    expect(shaped).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("labels a WorkType on every session, so the acceptance denominators are exhaustive", () => {
    const declared: readonly WorkTypeKey[] = WORK_TYPE_KEYS;

    expect(sessions.every((session) => declared.includes(session.work_type))).toBe(true);
  });
});
