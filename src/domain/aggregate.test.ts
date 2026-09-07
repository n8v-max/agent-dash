// T-U6 and T-U7 — the two ADR-0005 replacement targets ticket 23 owns (`testing-spec.md` § 3.2).
//
// These are pure unit tests: `src/domain/**` may not reach the data layer (R-T5), so every row
// and every Member here is built inline. The claims are then re-asserted against the *committed*
// fixture in `src/data/aggregate.fixture.test.ts`, because P6 says a test that would pass against
// an empty fixture is not a test.
//
// The population below deliberately mirrors R-D3 and R-D14 — **20 Members (18 `human`, 2
// `service_account`) across 4 Teams, with 4 Members on two Teams each** — so the two failures
// this ticket exists to prevent have the same size here that they have in the product:
//
//   * a per-capita denominator that counted service accounts would divide by 20 instead of 18:
//     110 becomes 99, off by exactly 10% (R-M14, A6). Large enough to catch in a test, small
//     enough that an eyeballed chart would not.
//   * a Team roll-up that split an overlapping Member's figure between their Teams would make
//     the Team totals sum to the Organization total. They must exceed it (R-V3, A5).
//
// Figures are authored so every expectation is a whole number and none is a restatement of the
// implementation's own arithmetic.

import { describe, expect, it } from "vitest";
import {
  MODEL_LEVELS,
  ORGANIZATION_KEY,
  modelMix,
  perCapita,
  rollUp,
  sumGroups,
  type AggregationInput,
  type MemberFacts,
  type ModelFacts,
  type Rollup,
  type TeamFacts,
} from "./aggregate";

// --- The population (R-D3, R-D14) ---------------------------------------------------------

/** `h01` … `h18`. Every one of them holds an active seat, so every one is in a denominator. */
const HUMAN_IDS = Array.from({ length: 18 }, (_unused, index) => `h${String(index + 1).padStart(2, "0")}`);
/** Two service accounts, exactly as R-D3 has them. They hold no seat and run real work. */
const SERVICE_IDS = ["s01", "s02"];

const human = (id: string): MemberFacts => ({ id, kind: "human", seat_active: true });
const service = (id: string): MemberFacts => ({ id, kind: "service_account", seat_active: false });

const MEMBERS: readonly MemberFacts[] = [...HUMAN_IDS.map(human), ...SERVICE_IDS.map(service)];

/**
 * Four Teams of six. `h03`, `h05`, `h10` and `h15` each belong to two of them — R-D14's "at
 * least 3 Members belong to more than one Team", made real. `team_d` holds both service
 * accounts, so its headcount (6) and its per-capita denominator (4) differ by a third.
 */
const TEAMS: readonly TeamFacts[] = [
  { id: "team_a", member_ids: ["h01", "h02", "h03", "h04", "h05", "h06"] },
  { id: "team_b", member_ids: ["h03", "h07", "h08", "h09", "h10", "h11"] },
  { id: "team_c", member_ids: ["h10", "h12", "h13", "h14", "h15", "h16"] },
  { id: "team_d", member_ids: ["h05", "h15", "h17", "h18", "s01", "s02"] },
];

const OVERLAPPING = ["h03", "h05", "h10", "h15"];

// --- The rows -----------------------------------------------------------------------------

type Row = { readonly id: string; readonly member_id: string; readonly cost: number };

const cost = (row: Row): number => row.cost;
const sessions = (): number => 1;

const rowsFor = (memberId: string, costs: readonly number[]): Row[] =>
  costs.map((amount, index) => ({ id: `${memberId}-${index}`, member_id: memberId, cost: amount }));

/**
 * `h01` … `h18` carry 10, 20, … 180 — two sessions each, split 3:7 so the figure is not the row.
 * The humans therefore total 1,710. The service accounts carry 90 and 180 over three sessions
 * each, totalling 270. The Organization figure is 1,980, which is 110 per active human Member
 * and 99 per Member-including-service-accounts: the 10% R-D3 seeds.
 */
const ROWS: readonly Row[] = [
  ...HUMAN_IDS.flatMap((id, index) => rowsFor(id, [3 * (index + 1), 7 * (index + 1)])),
  ...rowsFor("s01", [30, 30, 30]),
  ...rowsFor("s02", [60, 60, 60]),
];

const figureOf = (memberId: string): number =>
  ROWS.filter((row) => row.member_id === memberId).reduce((running, row) => running + row.cost, 0);

const inputOf = <Measured extends Row>(
  rows: readonly Measured[],
  measure: (row: Measured) => number,
  members: readonly MemberFacts[] = MEMBERS,
  teams: readonly TeamFacts[] = TEAMS,
): AggregationInput<Measured> => ({ rows, measure, members, teams });

const COST_INPUT = inputOf(ROWS, cost);
const groupOf = (rollup: Rollup, key: string) => rollup.groups.find((group) => group.key === key);

// --- T-U6 ---------------------------------------------------------------------------------

describe("T-U6 — Team is a containment hierarchy, not a partition (R-V3, A5)", () => {
  const byTeam = rollUp(COST_INPUT, "team");

  it("the population it was handed really does overlap, and by R-D14's margin", () => {
    expect(MEMBERS).toHaveLength(20);
    expect(MEMBERS.filter((member) => member.kind === "human")).toHaveLength(18);
    expect(byTeam.overlap.memberIds).toEqual(OVERLAPPING);
    expect(byTeam.overlap.count).toBeGreaterThanOrEqual(3);
  });

  it("sums every Team's figure to *more* than the Organization figure", () => {
    expect(byTeam.groups.map((group) => group.total)).toEqual([210, 480, 800, 820]);
    expect(sumGroups(byTeam)).toBe(2310);
    expect(byTeam.total).toBe(1980);
    expect(sumGroups(byTeam)).toBeGreaterThan(byTeam.total);
  });

  it("gives a Member on two Teams their *full* figure in both, never half of it", () => {
    // h05 carries 50 and sits on team_a and team_d. Halving would put 25 in each and would make
    // the Team totals sum to the Organization total — the exact bug R-V3 exists to prevent.
    expect(figureOf("h05")).toBe(50);
    const withoutH05 = rollUp(inputOf(ROWS.filter((row) => row.member_id !== "h05"), cost), "team");
    for (const key of ["team_a", "team_d"]) {
      const held = groupOf(byTeam, key)?.total ?? 0;
      expect(held - (groupOf(withoutH05, key)?.total ?? 0)).toBe(50);
    }
    expect(byTeam.placement.get("h05")).toEqual(["team_a", "team_d"]);
  });

  it("counts an overlapping Member in each Team's member list, with no primary Team", () => {
    const holding = byTeam.groups.filter((group) => group.memberIds.includes("h05"));
    expect(holding.map((group) => group.key)).toEqual(["team_a", "team_d"]);
  });

  it("declares itself non-partitioning, so no surface can stack it (R-V1)", () => {
    expect(byTeam.partition).toBe(false);
  });
});

describe("T-U6 — the overlap note cannot disagree with the total", () => {
  /**
   * The structural claim. The note is not a second opinion about the data: it counts the
   * multiplicity of the same placement that did the double counting, so the excess a Team
   * grouping carries is *exactly* the figures of the Members the note names. Asserted over
   * several measures and several team shapes, because one arithmetic coincidence is not a
   * property.
   */
  const excessIsExactlyTheNamedMembers = (rollup: Rollup, figure: (memberId: string) => number) => {
    const predicted = rollup.overlap.memberIds.reduce(
      (running, memberId) =>
        running + figure(memberId) * ((rollup.placement.get(memberId)?.length ?? 1) - 1),
      0,
    );
    expect(sumGroups(rollup) - rollup.total).toBe(predicted);
  };

  it("accounts for every unit of the cost excess by the Members the note names", () => {
    const byTeam = rollUp(COST_INPUT, "team");
    expect(sumGroups(byTeam) - byTeam.total).toBe(330);
    excessIsExactlyTheNamedMembers(byTeam, figureOf);
  });

  it("accounts for the session-count excess the same way", () => {
    const byTeam = rollUp(inputOf(ROWS, sessions), "team");
    const count = (memberId: string) => ROWS.filter((row) => row.member_id === memberId).length;
    expect(sumGroups(byTeam) - byTeam.total).toBe(OVERLAPPING.length * 2);
    excessIsExactlyTheNamedMembers(byTeam, count);
  });

  it("states the true count in words, and the count is the length of the named list", () => {
    const byTeam = rollUp(COST_INPUT, "team");
    expect(byTeam.overlap.count).toBe(byTeam.overlap.memberIds.length);
    expect(byTeam.overlap.note).toBe("4 Members belong to more than one Team; totals overlap.");
  });

  it("holds when a Team is added that overlaps three ways", () => {
    const teams = [...TEAMS, { id: "team_e", member_ids: ["h01", "h03", "h05"] }];
    const byTeam = rollUp(inputOf(ROWS, cost, MEMBERS, teams), "team");
    expect(byTeam.overlap.memberIds).toEqual(["h01", "h03", "h05", "h10", "h15"]);
    expect(byTeam.placement.get("h03")).toEqual(["team_a", "team_b", "team_e"]);
    excessIsExactlyTheNamedMembers(byTeam, figureOf);
  });

  it("names a Member who overlaps but ran nothing, and still balances", () => {
    // Their headcount overlaps two denominators even though their figure is zero, which is why
    // R-V3's sentence is keyed on *belonging* rather than on activity.
    const rows = ROWS.filter((row) => row.member_id !== "h03");
    const byTeam = rollUp(inputOf(rows, cost), "team");
    expect(byTeam.overlap.memberIds).toContain("h03");
    expect(byTeam.overlap.note).toContain("4 Members");
    excessIsExactlyTheNamedMembers(byTeam, (memberId) =>
      memberId === "h03" ? 0 : figureOf(memberId),
    );
  });

  it("says so in words when nothing overlaps, rather than falling silent", () => {
    const teams: TeamFacts[] = [
      { id: "team_a", member_ids: ["h01", "h02"] },
      { id: "team_b", member_ids: ["h03"] },
    ];
    const byTeam = rollUp(inputOf(ROWS, cost, MEMBERS, teams), "team");
    expect(byTeam.overlap.count).toBe(0);
    expect(byTeam.overlap.note).toBe("No Member belongs to more than one Team; totals do not overlap.");
    expect(byTeam.partition).toBe(false);
  });

  it("uses the singular for one overlapping Member", () => {
    const teams: TeamFacts[] = [
      { id: "team_a", member_ids: ["h01", "h02"] },
      { id: "team_b", member_ids: ["h02", "h03"] },
    ];
    const byTeam = rollUp(inputOf(ROWS, cost, MEMBERS, teams), "team");
    expect(byTeam.overlap.note).toBe("1 Member belongs to more than one Team; totals overlap.");
  });
});

describe("T-U6 — the contrast cases: the levels that really are partitions", () => {
  it("sums Organization → Member exactly, with no excess and nothing to note", () => {
    const byMember = rollUp(COST_INPUT, "member");
    expect(byMember.groups).toHaveLength(20);
    expect(sumGroups(byMember)).toBe(byMember.total);
    expect(byMember.total).toBe(1980);
    expect(byMember.partition).toBe(true);
    expect(byMember.overlap).toEqual({ memberIds: [], count: 0, note: null });
  });

  it("puts every Member in exactly one Member group", () => {
    const byMember = rollUp(COST_INPUT, "member");
    for (const member of MEMBERS) expect(byMember.placement.get(member.id)).toEqual([member.id]);
  });

  it("gives the Organization one group holding the whole figure", () => {
    const byOrg = rollUp(COST_INPUT, "organization");
    expect(byOrg.groups).toHaveLength(1);
    expect(byOrg.groups[0]?.key).toBe(ORGANIZATION_KEY);
    expect(byOrg.groups[0]?.total).toBe(1980);
    expect(byOrg.partition).toBe(true);
    expect(byOrg.overlap.note).toBeNull();
  });

  it("agrees on the Organization figure at every level, however it grouped", () => {
    const totals = ["member", "team", "organization"] as const;
    for (const level of totals) expect(rollUp(COST_INPUT, level).total).toBe(1980);
  });

  it("sums Model exact → family → tier to the same total at all three levels", () => {
    const models: readonly ModelFacts[] = [
      { id: "gpt-6-astra", family: "OpenAI GPT-6 Astra", tier: "frontier" },
      { id: "claude-opus-5", family: "Claude Opus", tier: "frontier" },
      { id: "claude-sonnet-5", family: "Claude Sonnet", tier: "balanced" },
      { id: "claude-haiku-4-5", family: "Claude Haiku", tier: "fast" },
    ];
    const entries = [
      { model_id: "gpt-6-astra", tokens: 100 },
      { model_id: "claude-opus-5", tokens: 200 },
      { model_id: "claude-sonnet-5", tokens: 400 },
      { model_id: "claude-haiku-4-5", tokens: 300 },
      // R-D15 — one session spanning two Models is two entries, never half a session each.
      { model_id: "claude-sonnet-5", tokens: 50 },
    ];
    const input = { entries, measure: (entry: { tokens: number }) => entry.tokens, models };

    const levels = MODEL_LEVELS.map((level) => modelMix(input, level));
    for (const distribution of levels) {
      expect(distribution.total).toBe(1050);
      expect(distribution.slices.reduce((running, slice) => running + slice.total, 0)).toBe(1050);
      expect(distribution.partition).toBe(true);
    }
    expect(levels[0]?.slices.map((slice) => slice.total)).toEqual([100, 200, 450, 300]);
    expect(levels[2]?.slices).toEqual([
      { key: "frontier", total: 300 },
      { key: "balanced", total: 450 },
      { key: "fast", total: 300 },
    ]);
  });

  it("counts an entry naming a Model outside the roster nowhere, and keeps an unused one at zero", () => {
    const models: readonly ModelFacts[] = [
      { id: "known", family: "Known", tier: "fast" },
      // In the roster, absent from the range: it holds a slice of zero rather than vanishing,
      // so the series set stays the roster's rather than the period's (R-V5).
      { id: "unused", family: "Unused", tier: "frontier" },
    ];
    const distribution = modelMix(
      {
        entries: [{ model_id: "known" }, { model_id: "retired-model" }],
        measure: () => 1,
        models,
      },
      "exact",
    );
    expect(distribution.total).toBe(1);
    expect(distribution.slices).toEqual([
      { key: "known", total: 1 },
      { key: "unused", total: 0 },
    ]);
  });
});

// --- T-U7 ---------------------------------------------------------------------------------

describe("T-U7 — per-capita divides by active human Members only (R-M14, A6)", () => {
  const byOrg = rollUp(COST_INPUT, "organization");

  it("divides the Organization figure by 18, not by 20", () => {
    expect(byOrg.perCapita.members).toBe(20);
    expect(byOrg.perCapita.denominator).toBe(18);
    expect(byOrg.perCapita.value).toBe(110);
    // The 10% R-D3 seeds: counting the two service accounts would say 99.
    expect(byOrg.perCapita.value).not.toBe(1980 / 20);
  });

  it("keeps service-account work in the numerator — only the denominator excludes them", () => {
    expect(byOrg.total).toBe(1980);
    expect(figureOf("s01") + figureOf("s02")).toBe(270);
    const withoutServices = rollUp(
      inputOf(ROWS.filter((row) => !row.member_id.startsWith("s")), cost),
      "organization",
    );
    expect(byOrg.total - withoutServices.total).toBe(270);
    // Same denominator either way: the seats did not move when the robots' work did.
    expect(withoutServices.perCapita.denominator).toBe(18);
  });

  it("uses each Team's own human headcount, not its member count (T-U6 × T-U7)", () => {
    const byTeam = rollUp(COST_INPUT, "team");
    const teamD = groupOf(byTeam, "team_d");
    expect(teamD?.memberIds).toHaveLength(6);
    expect(teamD?.perCapita.members).toBe(6);
    expect(teamD?.perCapita.denominator).toBe(4);
    expect(teamD?.perCapita.value).toBe(205);
    // Dividing 820 by the 6 Members rather than the 4 seats would say ~137 — a third out, on the
    // one Team where the two service accounts sit.
    expect(teamD?.perCapita.value).not.toBeCloseTo(136.7, 1);
  });

  it("counts an overlapping Member in each Team's denominator as well as its numerator", () => {
    const byTeam = rollUp(COST_INPUT, "team");
    for (const key of ["team_a", "team_d"]) {
      expect(groupOf(byTeam, key)?.memberIds).toContain("h05");
    }
    expect(groupOf(byTeam, "team_a")?.perCapita.denominator).toBe(6);
    expect(groupOf(byTeam, "team_d")?.perCapita.denominator).toBe(4);
    // Summing the Team denominators overshoots the Organization's 18 by the overlap, exactly as
    // the totals do. The per-capita figures are not comparable by addition either.
    const denominators = byTeam.groups.reduce(
      (running, group) => running + group.perCapita.denominator,
      0,
    );
    expect(denominators).toBe(18 + OVERLAPPING.length);
  });

  it("keeps a dormant seat-holder in the denominator (R-D10)", () => {
    // A seat held against near-zero usage is the sharpest finding in the product; a denominator
    // that only counted people with rows would delete it.
    const rows = ROWS.filter((row) => row.member_id !== "h07");
    const quiet = rollUp(inputOf(rows, cost), "organization");
    expect(quiet.perCapita.denominator).toBe(18);
    expect(quiet.groups[0]?.memberIds).toContain("h07");
  });

  it("offers no per-capita where only one Member is aggregated — raw is the default", () => {
    const byMember = rollUp(COST_INPUT, "member");
    for (const group of byMember.groups) {
      expect(group.perCapita.available).toBe(false);
      expect(group.perCapita.value).toBeNull();
    }
    expect(groupOf(byMember, "h05")?.total).toBe(50);
  });

  it("offers none over a population that holds no seat at all, rather than dividing by zero", () => {
    const robots = perCapita(500, [service("s01"), service("s02")]);
    expect(robots).toEqual({ available: false, members: 2, denominator: 0, value: null });
  });

  it("excludes a human whose seat has lapsed", () => {
    const population = [human("h01"), human("h02"), { ...human("h03"), seat_active: false }];
    expect(perCapita(90, population)).toEqual({
      available: true,
      members: 3,
      denominator: 2,
      value: 45,
    });
  });
});

// --- Degenerate shapes --------------------------------------------------------------------

describe("degenerate populations and rows", () => {
  it("counts a row whose Member is not in the population nowhere, at any level", () => {
    const rows = [...ROWS, { id: "ghost-0", member_id: "not-a-member", cost: 5_000 }];
    for (const level of ["member", "team", "organization"] as const) {
      const rollup = rollUp(inputOf(rows, cost), level);
      expect(rollup.total).toBe(1980);
      expect(sumGroups(rollup)).toBe(level === "team" ? 2310 : 1980);
    }
  });

  it("counts a Member on no Team in the Organization and in no Team", () => {
    const members = [...MEMBERS, human("h99")];
    const rows = [...ROWS, ...rowsFor("h99", [7])];
    const byTeam = rollUp(inputOf(rows, cost, members), "team");
    expect(byTeam.total).toBe(1987);
    expect(byTeam.placement.get("h99")).toEqual([]);
    expect(byTeam.groups.some((group) => group.memberIds.includes("h99"))).toBe(false);
    // The Team totals still overshoot, but they no longer *contain* everything the Org total does.
    expect(sumGroups(byTeam)).toBe(2310);
  });

  it("renders an empty Team as a group holding nothing, not as a missing series", () => {
    const teams = [...TEAMS, { id: "team_empty", member_ids: [] }];
    const byTeam = rollUp(inputOf(ROWS, cost, MEMBERS, teams), "team");
    const empty = groupOf(byTeam, "team_empty");
    expect(empty).toEqual({
      key: "team_empty",
      total: 0,
      memberIds: [],
      perCapita: { available: false, members: 0, denominator: 0, value: null },
    });
  });

  it("returns zeroed groups for a population with no rows at all", () => {
    const byTeam = rollUp(inputOf([], cost), "team");
    expect(byTeam.total).toBe(0);
    expect(byTeam.groups.map((group) => group.total)).toEqual([0, 0, 0, 0]);
    expect(byTeam.overlap.count).toBe(4);
    expect(byTeam.perCapita.value).toBe(0);
  });

  it("returns no groups at all for an empty population", () => {
    const byMember = rollUp(inputOf(ROWS, cost, [], []), "member");
    expect(byMember.groups).toEqual([]);
    expect(byMember.total).toBe(0);
    expect(byMember.perCapita).toEqual({
      available: false,
      members: 0,
      denominator: 0,
      value: null,
    });
  });
});
