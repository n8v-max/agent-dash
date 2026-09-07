// T-U6 / T-U7 against the **committed** fixture (R-D3, R-D14, A5, A6, P3, P6).
//
// The pure unit tests live in `src/domain/aggregate.test.ts` and build every row inline, because
// `src/domain/**` may not reach the data layer (R-T5). This file sits outside that boundary, so
// it may import `load.ts` — and it exists because P6 says a test that would pass against an empty
// fixture is not a test. R-D14 seeds the multi-Team Members and R-D3 the two service accounts;
// this asserts the roll-ups behave non-additively and per-capita divides by 18 **on the rows the
// product actually ships**, which is the claim those properties were seeded for.
//
// It reads committed output and never runs the generator (P3, R-T20). It follows the precedent
// `periods.fixture.test.ts` set for the same reason.

import { describe, expect, it } from "vitest";
import {
  MODEL_LEVELS,
  modelMix,
  rollUp,
  sumGroups,
  type AggregationInput,
  type Rollup,
} from "@/domain/aggregate";
import type { AgentSession, TokenUsage } from "@/domain/types";
import { loadDataset } from "./load";

const { members, teams, models, sessions } = loadDataset();

const cost = (session: AgentSession): number => session.cost;
const one = (): number => 1;

const inputOf = (measure: (session: AgentSession) => number): AggregationInput<AgentSession> => ({
  rows: sessions,
  measure,
  members,
  teams,
});

const COST = inputOf(cost);
const SESSIONS = inputOf(one);

const figuresBy = (rollup: Rollup): ReadonlyMap<string, number> =>
  new Map(rollup.groups.map((group) => [group.key, group.total]));

const serviceIds = new Set(
  members.filter((member) => member.kind === "service_account").map((member) => member.id),
);

describe("the committed fixture is not empty of what these claims need (P6, R-D3, R-D14)", () => {
  it("carries 20 Members — 18 human, 2 service accounts — across 4 Teams (R-D3)", () => {
    expect(members).toHaveLength(20);
    expect(members.filter((member) => member.kind === "human")).toHaveLength(18);
    expect(serviceIds.size).toBe(2);
    expect(teams).toHaveLength(4);
    // R-M14 reads "active human Members" as the seat-holders, and in the committed roster the
    // two readings coincide exactly: every human holds a seat and neither robot does.
    expect(members.filter((member) => member.seat_active).map((member) => member.kind)).toEqual(
      Array.from({ length: 18 }, () => "human"),
    );
  });

  it("puts at least 3 Members on more than one Team (R-D14)", () => {
    const multiTeam = members.filter((member) => member.team_ids.length > 1);
    expect(multiTeam.length).toBeGreaterThanOrEqual(3);
    expect(multiTeam.every((member) => member.kind === "human")).toBe(true);
  });

  it("agrees with itself about who is on a Team, from either side of the relation", () => {
    // The roll-up inverts `Team.member_ids` through `membershipFromTeams`, the same function the
    // permission filter uses. `Member.team_ids` is the other side of the same relation, and a
    // disagreement between them would make the choice of side silently load-bearing.
    for (const member of members) {
      const fromTeams = teams
        .filter((team) => team.member_ids.includes(member.id))
        .map((team) => team.id);
      expect([...fromTeams].sort()).toEqual([...member.team_ids].sort());
    }
  });

  it("attributes every visible session to a Member in the roster", () => {
    const known = new Set(members.map((member) => member.id));
    expect(sessions.filter((session) => !known.has(session.member_id))).toEqual([]);
    expect(sessions.length).toBeGreaterThan(700);
  });

  it("runs real work under the service accounts, so excluding them from a total would show", () => {
    const robotic = sessions.filter((session) => serviceIds.has(session.member_id));
    expect(robotic.length).toBeGreaterThan(50);
    expect(robotic.reduce((running, session) => running + session.cost, 0)).toBeGreaterThan(100);
  });
});

describe("T-U6 — Team totals exceed the Organization total on the committed rows (A5, R-V3)", () => {
  const byTeam = rollUp(COST, "team");
  const bySessions = rollUp(SESSIONS, "team");

  it("overshoots on cost and on session count alike", () => {
    expect(sumGroups(byTeam)).toBeGreaterThan(byTeam.total);
    expect(sumGroups(bySessions)).toBeGreaterThan(bySessions.total);
    expect(bySessions.total).toBe(sessions.length);
    expect(byTeam.partition).toBe(false);
  });

  it("states the overlap in words, and names exactly the multi-Team Members (R-V3)", () => {
    const multiTeam = members
      .filter((member) => member.team_ids.length > 1)
      .map((member) => member.id)
      .sort();
    expect(byTeam.overlap.memberIds).toEqual(multiTeam);
    expect(byTeam.overlap.note).toBe(
      `${multiTeam.length} Members belong to more than one Team; totals overlap.`,
    );
  });

  it("accounts for the whole session-count excess by the Members the note names", () => {
    const perMember = figuresBy(rollUp(SESSIONS, "member"));
    const predicted = bySessions.overlap.memberIds.reduce(
      (running, memberId) =>
        running + (perMember.get(memberId) ?? 0) * ((bySessions.placement.get(memberId)?.length ?? 1) - 1),
      0,
    );
    expect(predicted).toBeGreaterThan(0);
    expect(sumGroups(bySessions) - bySessions.total).toBe(predicted);
  });

  it("accounts for the whole cost excess the same way", () => {
    const perMember = figuresBy(rollUp(COST, "member"));
    const predicted = byTeam.overlap.memberIds.reduce(
      (running, memberId) =>
        running + (perMember.get(memberId) ?? 0) * ((byTeam.placement.get(memberId)?.length ?? 1) - 1),
      0,
    );
    expect(predicted).toBeGreaterThan(0);
    expect(sumGroups(byTeam) - byTeam.total).toBeCloseTo(predicted, 8);
  });

  it("gives each overlapping Member's full figure to every Team they belong to", () => {
    const perTeam = figuresBy(bySessions);
    for (const memberId of bySessions.overlap.memberIds) {
      const held = sessions.filter((session) => session.member_id === memberId).length;
      expect(held).toBeGreaterThan(0);
      const without = rollUp(
        { ...SESSIONS, rows: sessions.filter((session) => session.member_id !== memberId) },
        "team",
      );
      const withoutPerTeam = figuresBy(without);
      for (const teamId of bySessions.placement.get(memberId) ?? []) {
        expect((perTeam.get(teamId) ?? 0) - (withoutPerTeam.get(teamId) ?? 0)).toBe(held);
      }
    }
  });
});

describe("T-U6 — the partitions that do sum, on the same committed rows", () => {
  it("sums Organization → Member exactly", () => {
    const byMember = rollUp(SESSIONS, "member");
    expect(sumGroups(byMember)).toBe(sessions.length);
    expect(byMember.total).toBe(sessions.length);
    expect(byMember.overlap.count).toBe(0);
    expect(byMember.partition).toBe(true);
    expect(sumGroups(rollUp(COST, "member"))).toBeCloseTo(rollUp(COST, "organization").total, 8);
  });

  it("sums Model exact → family → tier to one total at every level", () => {
    const entries: TokenUsage[] = sessions.flatMap((session) => session.token_usage);
    const tokens = (entry: TokenUsage): number =>
      entry.uncached_input + entry.cache_read + entry.cache_write + entry.output;
    const input = { entries, measure: tokens, models };

    const exact = modelMix(input, "exact");
    expect(exact.total).toBeGreaterThan(0);
    expect(exact.slices).toHaveLength(models.length);

    for (const level of MODEL_LEVELS) {
      const distribution = modelMix(input, level);
      expect(distribution.total).toBe(exact.total);
      expect(distribution.slices.reduce((running, slice) => running + slice.total, 0)).toBe(
        exact.total,
      );
      expect(distribution.partition).toBe(true);
    }
    expect(modelMix(input, "tier").slices.map((slice) => slice.key)).toEqual([
      "frontier",
      "balanced",
      "fast",
    ]);
  });
});

describe("T-U7 — per-capita on the committed roster excludes the service accounts (A6)", () => {
  const byOrg = rollUp(COST, "organization");

  it("divides the Organization figure by 18, not by 20 — the 10% R-D3 seeds", () => {
    expect(byOrg.perCapita.members).toBe(20);
    expect(byOrg.perCapita.denominator).toBe(18);
    expect(byOrg.perCapita.value).toBeCloseTo(byOrg.total / 18, 8);
    expect(byOrg.perCapita.value).not.toBeCloseTo(byOrg.total / 20, 2);
  });

  it("keeps the service accounts' cost in the numerator", () => {
    const robotic = sessions
      .filter((session) => serviceIds.has(session.member_id))
      .reduce((running, session) => running + session.cost, 0);
    const humansOnly = rollUp(
      { ...COST, rows: sessions.filter((session) => !serviceIds.has(session.member_id)) },
      "organization",
    );
    expect(byOrg.total - humansOnly.total).toBeCloseTo(robotic, 8);
    expect(humansOnly.perCapita.denominator).toBe(18);
  });

  it("uses each Team's own human headcount — the robots' Team divides by 4, not by 6", () => {
    const byTeam = rollUp(COST, "team");
    for (const group of byTeam.groups) {
      const roster = teams.find((team) => team.id === group.key)?.member_ids ?? [];
      const humans = roster.filter((id) => !serviceIds.has(id));
      expect(group.perCapita.members).toBe(roster.length);
      expect(group.perCapita.denominator).toBe(humans.length);
    }
    const infrastructure = byTeam.groups.find((group) => group.key === "team_infrastructure");
    expect(infrastructure?.perCapita.members).toBe(6);
    expect(infrastructure?.perCapita.denominator).toBe(4);
  });

  it("counts overlapping Members in every Team denominator they belong to", () => {
    const byTeam = rollUp(COST, "team");
    const denominators = byTeam.groups.reduce(
      (running, group) => running + group.perCapita.denominator,
      0,
    );
    const humanOverlaps = byTeam.overlap.memberIds.filter((id) => !serviceIds.has(id));
    expect(denominators).toBe(18 + humanOverlaps.length);
    expect(denominators).toBeGreaterThan(byTeam.perCapita.denominator);
  });
});
