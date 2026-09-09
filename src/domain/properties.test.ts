// T-U28…T-U34 — the seven aggregation invariants, as properties. Ticket 51, `testing-spec.md`
// § 3.5.
//
// **Why these seven and not others.** ADR-0005 moved cost attribution upstream and said what
// replaces the pricing function as this product's test target: *"the interesting failures in this
// product are aggregation failures — non-additive Team totals … per-capita denominators that
// include service accounts. Pricing a session is multiplication."* Each property below is a
// sentence `CONTEXT.md` already asserts, restated as something a generator can try to break:
// Team is non-additive (1), period boundaries fall in the Organization's timezone (2), a service
// account holds no seat (3), a ratio over nothing is nothing (4), Rework and Decomposition count
// attempts (5, 6), and the capped chart still adds up (7).
//
// **A property that never reaches its case is worse than no test, because it reads as coverage.**
// Every one of the seven therefore counts the case it is about — an overlapping Member, a row the
// timezone moved into another day, a service account holding a seat, a zero denominator, a Task
// that fanned out, a root with two children, a sixth series — and **fails if the count is too
// low**. Each threshold is set well under the rate measured while the generators were written —
// a quarter of it, or lower where the case is rarer — so what fails is a generator that stopped
// producing the case, never an unlucky seed. The measured rates are recorded in the ticket.
//
// **The seed is not fixed.** fast-check draws a new one each run and prints it, with the shrunk
// counterexample, on failure. A pinned seed would turn 200 searches into 200 replays of the same
// one; the determinism the domain layer owes (P5, R-T5) is that the *generators* read no clock
// and no `Math.random()`, which is what `src/domain/testing/` is written to.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ROLLUP_LEVELS,
  perCapita,
  rollUp,
  sumGroups,
  type MemberFacts,
} from "./aggregate";
import { sessionTokensProcessed } from "./metrics/adoption";
import { taskFacts } from "./metrics/efficacy";
import {
  bucketRows,
  civilDayIn,
  civilDaysBetween,
  planPeriods,
  type PeriodBucket,
  type PeriodRange,
  type PeriodRow,
} from "./periods";
import { ratio } from "./ratio";
import {
  NAMED_SERIES_CAP,
  OTHER_SERIES_KEY,
  SERIES_LIMIT,
  capSeries,
} from "./series";
import { childFaults, childrenByRoot, rollUpSessions } from "./sessions";
import { periodCaseArb } from "./testing/periods";
import { populationArb, teamCountOf } from "./testing/population";
import { seriesCaseArb, type KeyedRow, type SeriesCase } from "./testing/series";
import { regroupChildren, sessionTreeArb } from "./testing/sessions";
import type { AgentSession } from "./types";

/** Ticket 51's Done-when: 200 runs each, and the number the reach thresholds are sized against. */
const RUNS = { numRuns: 200 } as const;

/**
 * The reach ledger. `hit` records that a run met the case the property is about; `reached`
 * asserts, after the search, that it met it often enough for the property to have meant anything.
 */
const tally = () => {
  const seen = new Map<string, number>();
  return {
    hit: (label: string): void => {
      seen.set(label, (seen.get(label) ?? 0) + 1);
    },
    reached: (label: string, atLeast: number): void => {
      const times = seen.get(label) ?? 0;
      expect(
        times,
        `the generator reached "${label}" ${times} times in ${RUNS.numRuns} runs, wanted ${atLeast}`,
      ).toBeGreaterThanOrEqual(atLeast);
    },
  };
};

/** Cents. Every money assertion here is an integer one: a stored cost is a whole number of them. */
const cents = (usd: number): number => Math.round(usd * 100);

const sum = (values: readonly number[]): number => values.reduce((running, value) => running + value, 0);

/**
 * A roster and a population of sessions drawn over it — the pair every roll-up needs, generated
 * together so that no row names a Member who does not exist.
 */
const rosterArb = populationArb.chain((population) =>
  sessionTreeArb(population.members.map((member) => member.id)).map((tree) => ({ population, tree })),
);

/**
 * The additive measures. Money is read in **cents** and tokens and seconds are already whole, so
 * every sum below is an integer one and the identities are equalities rather than tolerances —
 * floating-point addition is not associative, and two summation orders over one population would
 * otherwise disagree in the last place for reasons that have nothing to do with the rule.
 */
const ADDITIVE_MEASURES: readonly { readonly name: string; readonly of: (row: AgentSession) => number }[] = [
  { name: "session Cost, in cents", of: (row) => cents(row.cost) },
  { name: "prompt_count", of: (row) => row.prompt_count },
  { name: "tokens processed", of: (row) => sessionTokensProcessed(row) },
  { name: "machine allocation, in seconds", of: (row) => row.machine_allocation_duration_s },
];

const seatHoldersIn = (members: readonly MemberFacts[]): number =>
  members.filter((member) => member.kind === "human" && member.seat_active).length;

const tokensIn = (sessions: readonly AgentSession[]): number =>
  sum(sessions.map((session) => sessionTokensProcessed(session)));

/**
 * `antecedent ⇒ consequent`, as a value rather than as an `if`. Most of these properties *are*
 * implications, and `vitest/no-conditional-expect` is right to refuse the other shape: an
 * assertion inside a branch is one a reader cannot tell from an assertion that never ran.
 */
const implies = (antecedent: boolean, consequent: boolean): boolean => !antecedent || consequent;

/** Civil dates are `YYYY-MM-DD`, so they compare lexicographically and chronologically at once. */
const within = (day: string, from: string, to: string): boolean => day >= from && day <= to;

/**
 * Contiguity, coverage and identity, as one comparable shape: a partition that fails prints which
 * conjunct failed rather than the first index that happened to be walked.
 */
const shapeOf = (buckets: readonly PeriodBucket<PeriodRow>[], range: PeriodRange) => ({
  ordered: buckets.every((bucket) => bucket.startsOn <= bucket.endsOn),
  contiguous: buckets
    .slice(1)
    .every((bucket, index) => civilDaysBetween(buckets[index].endsOn, bucket.startsOn) === 1),
  coversTheStart: buckets[0].startsOn <= range.start,
  coversTheEnd: buckets[buckets.length - 1].endsOn >= range.end,
  keysAreDistinct: new Set(buckets.map((bucket) => bucket.key)).size === buckets.length,
});

/** Every row a chart holds, in bucket order. The population both sides of T-U34 are read over. */
const rowsOf = (chart: SeriesCase): readonly KeyedRow[] =>
  chart.buckets.flatMap((bucket) => bucket.rows);

/**
 * The cases one generated chart reached. Bookkeeping, lifted out of the property so that what the
 * property asserts and what the generator managed to produce stay legible apart from each other.
 */
const chartCases = (chart: SeriesCase, engaged: boolean): readonly string[] => {
  const rows = rowsOf(chart);
  const cases = [engaged ? "the cap engaging" : "a chart the cap leaves alone"];
  if (chart.keys.length === SERIES_LIMIT) {
    cases.push("exactly five series, where the cap does not engage");
  }
  if (chart.keys.length === SERIES_LIMIT + 1) cases.push("exactly six series, where it does");
  if (rows.some((row) => row.keys.length > 1)) cases.push("a row belonging to more than one series");
  if (rows.some((row) => row.keys.length === 0)) cases.push("a row belonging to no series");
  if (chart.absent === null) cases.push("a chart reading an absent bucket as a gap");
  return cases;
};

/** What `shapeOf` reads on a set of buckets that partitions its range: every conjunct true. */
const A_PARTITION = {
  ordered: true,
  contiguous: true,
  coversTheStart: true,
  coversTheEnd: true,
  keysAreDistinct: true,
};

describe("the seven aggregation invariants, as properties", () => {
  it("T-U28 — the sum of every Team's figure is at least the Organization's, for every additive measure", () => {
    const reach = tally();

    fc.assert(
      fc.property(rosterArb, fc.constantFrom(...ADDITIVE_MEASURES), (roster, measure) => {
        const rows = rollUpSessions(roster.tree.sessions);
        const input = {
          rows,
          measure: measure.of,
          members: roster.population.members,
          teams: roster.population.teams,
        };
        const teams = rollUp(input, "team");
        const organization = rollUp(input, "organization");

        // The glossary's precondition, restated where the property is: a Member belongs to one or
        // more Teams (`CONTEXT.md` § Organisation & People). A Member on *no* Team would be in the
        // Organization figure and in no Team's, and the sum would fall below rather than above.
        for (const member of roster.population.members) {
          expect(teamCountOf(roster.population, member.id)).toBeGreaterThanOrEqual(1);
        }

        // Both levels count the same rows: only the grouping differs.
        expect(teams.total).toBe(organization.total);
        expect(
          sumGroups(teams),
          `${measure.name}: the Teams must not sum below the Organization`,
        ).toBeGreaterThanOrEqual(organization.total);

        // The contrast case. Organization is a true partition and does sum exactly, so the Team
        // result reads as a property of the dimension rather than as a bug nobody fixed.
        expect(organization.partition).toBe(true);
        expect(sumGroups(organization)).toBe(organization.total);
        expect(teams.partition).toBe(false);

        // The excess is the multiplicity of the placement that produced it — a Member on three
        // Teams contributes their figure twice over, not once.
        const figures = new Map<string, number>();
        for (const row of rows) {
          figures.set(row.member_id, (figures.get(row.member_id) ?? 0) + measure.of(row));
        }
        const excess = sum(
          [...figures].map(([memberId, figure]) => (teamCountOf(roster.population, memberId) - 1) * figure),
        );
        expect(
          sumGroups(teams) - organization.total,
          `${measure.name}: the excess is the multiplicity of the placement`,
        ).toBe(excess);

        // The note is the same map read again, so it cannot disagree with the total.
        const overlapping = roster.population.members.filter(
          (member) => teamCountOf(roster.population, member.id) > 1,
        );
        expect(teams.overlap.count).toBe(overlapping.length);
        expect(teams.overlap.note).not.toBeNull();
        expect(organization.overlap.note).toBeNull();

        if (overlapping.length > 0) reach.hit("a Member belonging to more than one Team");
        if (sumGroups(teams) > organization.total) reach.hit("Team figures summing past the Organization");
        if (overlapping.length === 0) reach.hit("a roster that happens not to overlap");
      }),
      RUNS,
    );

    reach.reached("a Member belonging to more than one Team", 40);
    reach.reached("Team figures summing past the Organization", 30);
    reach.reached("a roster that happens not to overlap", 5);
  });

  it("T-U29 — period buckets partition the range, in the Organization's timezone", () => {
    const reach = tally();

    fc.assert(
      fc.property(periodCaseArb, (period) => {
        const planned = planPeriods(period.request);
        // The only way a generated request can be refused: R-M11's two-month limit on day grain.
        expect(planned.ok || planned.reason === "day-grain-needs-a-shorter-range").toBe(true);
        if (!planned.ok) {
          reach.hit("a request R-M11 refuses");
          return;
        }

        const range = period.request.range;
        const buckets = bucketRows(planned.plan, period.rows);
        // One conversion per row, reused: the civil day this row fell on in the Organization's
        // zone. `""` cannot arise — every generated timestamp is an instant — and would fail the
        // count below rather than pass quietly if it did.
        const dayOf = new Map<PeriodRow, string>(
          period.rows.map((row) => [row, civilDayIn(period.request.timezone, row.started_at) ?? ""]),
        );
        const dayFor = (row: PeriodRow): string => dayOf.get(row) ?? "";

        // No gap, no overlap, and nothing of the range left uncovered.
        expect(buckets.length).toBeGreaterThan(0);
        expect(shapeOf(buckets, range)).toEqual(A_PARTITION);
        expect(buckets.every((bucket) => bucket.grain === period.request.grain)).toBe(true);

        // Every in-range row is in exactly one bucket; every out-of-range row is in none.
        const inRange = period.rows.filter((row) => within(dayFor(row), range.start, range.end));
        const placed = buckets.flatMap((bucket) => bucket.rows);
        expect(placed).toHaveLength(inRange.length);
        expect(new Set(placed).size).toBe(placed.length);
        expect(
          buckets.every((bucket) =>
            bucket.rows.every((row) => within(dayFor(row), bucket.startsOn, bucket.endsOn)),
          ),
        ).toBe(true);

        reach.hit(`${planned.plan.grain} grain`);
        if (period.rows.some((row) => civilDayIn("UTC", row.started_at) !== dayFor(row))) {
          reach.hit("a row the Organization's timezone moved to another civil day");
        }
        if (inRange.length < period.rows.length) reach.hit("a row outside the range");
        if (buckets.some((bucket) => bucket.partial)) reach.hit("a partial period");
        if (buckets.some((bucket) => bucket.rows.length === 0)) reach.hit("a period holding nothing");
      }),
      RUNS,
    );

    reach.reached("day grain", 15);
    reach.reached("week grain", 15);
    reach.reached("month grain", 15);
    reach.reached("a request R-M11 refuses", 2);
    reach.reached("a row the Organization's timezone moved to another civil day", 30);
    reach.reached("a row outside the range", 20);
    reach.reached("a partial period", 50);
    reach.reached("a period holding nothing", 40);
  });

  it("T-U30 — a per-capita denominator never counts a service account", () => {
    const reach = tally();

    fc.assert(
      fc.property(rosterArb, (roster) => {
        const members = roster.population.members;
        const rows = rollUpSessions(roster.tree.sessions);
        const measure = (row: AgentSession): number => cents(row.cost);
        const total = sum(rows.map(measure));

        for (const level of ROLLUP_LEVELS) {
          const rollup = rollUp({ rows, measure, members, teams: roster.population.teams }, level);
          // The whole population, and each group in it: the denominator is the seat-holding
          // headcount and nothing else, at every roll-up level.
          expect(rollup.perCapita.denominator).toBe(seatHoldersIn(members));
          expect(rollup.perCapita.members).toBe(members.length);
          for (const group of rollup.groups) {
            const population = members.filter((member) => group.memberIds.includes(member.id));
            expect(group.perCapita.denominator).toBe(seatHoldersIn(population));
            expect(group.perCapita.members).toBe(population.length);
            const available = population.length > 1 && group.perCapita.denominator > 0;
            expect(group.perCapita.available).toBe(available);
            expect(group.perCapita.value).toBe(
              available ? group.total / group.perCapita.denominator : null,
            );
            if (!available) reach.hit("a group with no per-capita reading");
          }
        }

        // The sharp one. A service account carrying an active seat is a contradiction the roster
        // never writes — and the denominator has to exclude it anyway, because the exclusion is
        // keyed on *kind*. Flipping every service account's seat on must change nothing.
        const flipped = members.map((member) =>
          member.kind === "service_account" ? { ...member, seat_active: true } : member,
        );
        expect(perCapita(total, flipped).denominator).toBe(perCapita(total, members).denominator);
        // And dropping them from the population entirely changes the numerator's population size
        // but never the denominator.
        const humans = members.filter((member) => member.kind === "human");
        expect(perCapita(total, humans).denominator).toBe(perCapita(total, members).denominator);
        expect(perCapita(total, members).members).toBe(members.length);

        // Their work stays in the numerator: the Organization total is over every row.
        const serviceIds = new Set(
          members.filter((member) => member.kind === "service_account").map((member) => member.id),
        );
        const organization = rollUp({ rows, measure, members, teams: roster.population.teams }, "organization");
        expect(organization.total).toBe(total);
        const serviceFigure = sum(rows.filter((row) => serviceIds.has(row.member_id)).map(measure));

        if (serviceIds.size > 0) reach.hit("a population holding a service account");
        if (serviceFigure > 0) reach.hit("a service account whose work is in the numerator");
        if (members.some((member) => member.kind === "service_account" && member.seat_active)) {
          reach.hit("a service account carrying an active seat");
        }
        if (seatHoldersIn(members) === 0) reach.hit("a population holding no seat at all");
      }),
      RUNS,
    );

    reach.reached("a population holding a service account", 40);
    reach.reached("a service account whose work is in the numerator", 20);
    reach.reached("a service account carrying an active seat", 20);
    reach.reached("a population holding no seat at all", 5);
    reach.reached("a group with no per-capita reading", 100);
  });

  it("T-U31 — a ratio is null if and only if its denominator is zero", () => {
    const reach = tally();
    // Unrestricted doubles on both sides: `ratio` deliberately carries no guard for a NaN or
    // infinite denominator, and the biconditional is why — neither is zero, so neither is null.
    const numeratorArb = fc.oneof(
      { weight: 4, arbitrary: fc.double() },
      { weight: 2, arbitrary: fc.integer({ min: -1_000_000, max: 1_000_000 }) },
      { weight: 1, arbitrary: fc.constantFrom(0, -0, Number.NaN, Infinity, -Infinity) },
    );
    const denominatorArb = fc.oneof(
      { weight: 2, arbitrary: fc.constantFrom(0, -0) },
      { weight: 3, arbitrary: fc.double() },
      { weight: 3, arbitrary: fc.integer({ min: -5, max: 5 }) },
      // `fc.double()` reaches these only in the far tail, and they are the two readings the
      // biconditional is stated *against*: neither is zero, so neither may be null. They get a
      // weight of their own rather than a share of one, so both are reached on every search.
      { weight: 1, arbitrary: fc.constant(Number.NaN) },
      { weight: 1, arbitrary: fc.constantFrom(Infinity, -Infinity) },
    );

    fc.assert(
      fc.property(numeratorArb, denominatorArb, (numerator, denominator) => {
        const reading = ratio(numerator, denominator);

        // The biconditional itself, in one expression and both directions at once.
        expect(reading === null).toBe(denominator === 0);
        // Where there is a reading it is the division itself — unrounded, unclamped, uncoerced.
        // Written with the fallback rather than with a guard because the line above has already
        // pinned exactly when `reading` is null, and a conditional `expect` is an assertion a
        // reader cannot tell from one that never ran.
        expect(reading ?? numerator / denominator).toBe(numerator / denominator);

        if (denominator === 0) reach.hit("a zero denominator");
        if (Object.is(denominator, -0)) reach.hit("a negative zero denominator");
        if (Number.isNaN(denominator)) reach.hit("a NaN denominator");
        if (!Number.isFinite(denominator) && !Number.isNaN(denominator)) {
          reach.hit("an infinite denominator");
        }
        if (reading === 0) reach.hit("a measured zero, which survives");
        if (reading !== null && reading !== 0) reach.hit("an ordinary reading");
      }),
      RUNS,
    );

    reach.reached("a zero denominator", 15);
    reach.reached("a negative zero denominator", 5);
    reach.reached("a NaN denominator", 4);
    reach.reached("an infinite denominator", 4);
    reach.reached("a measured zero, which survives", 5);
    reach.reached("an ordinary reading", 30);
  });

  it("T-U32 — Rework needs two root sessions, and Decomposition two accepted ones", () => {
    const reach = tally();

    fc.assert(
      fc.property(rosterArb, (roster) => {
        const tree = roster.tree;
        const facts = taskFacts(tree.sessions);

        // The Tasks are the roots' own: a child is one agent working an attempt, never an attempt.
        expect(facts.map((fact) => fact.task_key)).toEqual(
          [...new Set(tree.roots.map((root) => root.task_key))].sort((left, right) =>
            left.localeCompare(right),
          ),
        );

        for (const fact of facts) {
          const roots = tree.roots.filter((root) => root.task_key === fact.task_key);
          const accepted = roots.filter((root) => root.accepted).length;
          expect(fact.sessions).toBe(roots.length);
          expect(fact.accepted).toBe(accepted);
          expect(fact.completed).toBe(accepted > 0);

          // The two implications the ticket names, and the one ADR-0008 exists for: a Task
          // worked by one root exhibits neither label, however wide that root fanned out.
          expect(implies(fact.rework, roots.length >= 2), `${fact.task_key} — Rework`).toBe(true);
          expect(
            implies(fact.decomposition, accepted >= 2),
            `${fact.task_key} — Decomposition`,
          ).toBe(true);
          expect(
            implies(roots.length === 1, !fact.rework && !fact.decomposition),
            `${fact.task_key} — one attempt, whatever it spawned`,
          ).toBe(true);

          const fanned = tree.children.filter((child) => child.task_key === fact.task_key).length;
          if (fact.rework) reach.hit("a Task exhibiting Rework");
          if (fact.decomposition) reach.hit("a Task exhibiting Decomposition");
          if (fact.rework && fact.decomposition) reach.hit("a Task exhibiting both");
          if (roots.length === 1 && fanned > 0) reach.hit("a single-attempt Task that fanned out");
        }

        // Handing in the children changes nothing at all: they are dropped in the grouping pass.
        expect(facts).toEqual(taskFacts(tree.roots));
        if (tree.children.length > 0) reach.hit("a population holding children");
      }),
      RUNS,
    );

    reach.reached("a population holding children", 60);
    reach.reached("a Task exhibiting Rework", 40);
    reach.reached("a Task exhibiting Decomposition", 20);
    reach.reached("a Task exhibiting both", 6);
    reach.reached("a single-attempt Task that fanned out", 30);
  });

  it("T-U33 — a root's cost is its own plus its children's, and the total survives regrouping", () => {
    const reach = tally();

    fc.assert(
      fc.property(rosterArb, (roster) => {
        const tree = roster.tree;
        const rolled = rollUpSessions(tree.sessions);
        const children = childrenByRoot(tree.sessions);

        // The generator's own guarantee, asserted rather than trusted: every child it writes is
        // well-formed by `childFaults`' five rules, so properties 5 and 6 are stated over a
        // population `load.ts` would have accepted. The *regrouped* tree below deliberately is
        // not — re-parenting asks a question about grouping, not about labels.
        const rootsById = new Map(tree.roots.map((root) => [root.id, root]));
        expect(
          tree.children.flatMap((child) =>
            childFaults(child, rootsById.get(child.parent_session_id ?? "")),
          ),
        ).toEqual([]);

        expect(rolled).toHaveLength(tree.roots.length);
        for (const root of rolled) {
          const own = tree.roots.filter((candidate) => candidate.id === root.id)[0];
          const brood = children.get(root.id) ?? [];
          const whole = [own, ...brood];

          expect(cents(root.cost)).toBe(sum(whole.map((session) => cents(session.cost))));
          expect(root.machine_allocation_duration_s).toBe(
            sum(whole.map((session) => session.machine_allocation_duration_s)),
          );
          // R-T12 survives the fold: the three presence spans still sum to the allocation.
          expect(
            root.interactive_duration_s + root.idle_duration_s + root.afk_duration_s,
          ).toBe(root.machine_allocation_duration_s);
          expect(tokensIn([root])).toBe(tokensIn(whole));
          // The wall clock does not roll up, and neither does the outcome.
          expect(root.started_at).toBe(own.started_at);
          expect(root.ended_at).toBe(own.ended_at);
          expect(root.accepted).toBe(own.accepted);
          expect(root.prompt_count).toBe(own.prompt_count);

          if (brood.length >= 2) reach.hit("a root that spawned more than one agent");
          if (brood.length === 0) reach.hit("a root that spawned nothing");
        }

        // Invariance to the grouping: the same rows, the children re-parented, the same total.
        const reparented = regroupChildren(tree);
        const regrouped = rollUpSessions(reparented);
        const totalOf = (sessions: readonly AgentSession[]): number =>
          sum(sessions.map((session) => cents(session.cost)));
        expect(totalOf(regrouped)).toBe(totalOf(rolled));
        expect(totalOf(rolled)).toBe(totalOf(tree.sessions));
        expect(tokensIn(regrouped)).toBe(tokensIn(tree.sessions));
        expect(tokensIn(rolled)).toBe(tokensIn(tree.sessions));

        const moved = tree.children.filter(
          (child, index) =>
            reparented[tree.roots.length + index].parent_session_id !== child.parent_session_id,
        ).length;
        if (moved > 0) reach.hit("a regrouping that actually moved a child");
        if (tree.children.length > 0) reach.hit("a population holding children");
      }),
      RUNS,
    );

    reach.reached("a population holding children", 60);
    reach.reached("a root that spawned more than one agent", 60);
    reach.reached("a root that spawned nothing", 50);
    reach.reached("a regrouping that actually moved a child", 40);
  });

  it("T-U34 — the top four plus Other sum to the ungrouped total", () => {
    const reach = tally();

    fc.assert(
      fc.property(seriesCaseArb, (chart) => {
        const set = capSeries({
          buckets: chart.buckets,
          seriesKeysOf: (row) => row.keys,
          measure: (row) => row.value,
          absent: chart.absent,
        });

        // The ungrouped total is over (row × key) pairs, not over rows: a Member on two Teams
        // contributes their full figure to each, and a row carrying no key is in neither.
        const ungrouped = sum(rowsOf(chart).map((row) => row.value * row.keys.length));
        const drawn = sum(
          set.series.flatMap((series) => series.points.map((point) => point.value ?? 0)),
        );
        expect(drawn).toBe(ungrouped);

        // Every series carries every bucket, in bucket order (R-V5, A14).
        for (const series of set.series) {
          expect(series.points.map((point) => point.bucket)).toEqual(
            chart.buckets.map((bucket) => bucket.key),
          );
        }
        expect(new Set(set.series.map((series) => series.key)).size).toBe(set.series.length);

        // **The cap engages above five and not at five** (R-V4, A13). Asserted as one equality
        // rather than as two branches, so the five-series case is a stated expectation instead of
        // an `else` a reader has to notice is there.
        const engaged = chart.keys.length > SERIES_LIMIT;
        expect({
          series: set.series.length,
          swept: set.other === null ? null : set.other.keys.length,
          inert: set.series.filter((series) => series.inert).map((series) => series.key),
        }).toEqual({
          series: engaged ? SERIES_LIMIT : chart.keys.length,
          swept: engaged ? chart.keys.length - NAMED_SERIES_CAP : null,
          inert: engaged ? [OTHER_SERIES_KEY] : [],
        });

        for (const label of chartCases(chart, engaged)) reach.hit(label);
      }),
      RUNS,
    );

    reach.reached("the cap engaging", 40);
    reach.reached("a chart the cap leaves alone", 20);
    reach.reached("exactly five series, where the cap does not engage", 2);
    reach.reached("exactly six series, where it does", 5);
    reach.reached("a row belonging to more than one series", 40);
    reach.reached("a row belonging to no series", 30);
    reach.reached("a chart reading an absent bucket as a gap", 30);
  });
});
