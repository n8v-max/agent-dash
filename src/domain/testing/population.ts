// Member and Team generators — ticket 51, testing-spec T-U28 and T-U30. Feeds the two properties
// ADR-0005 named as the replacement targets for the pricing function it deleted: **Team is
// non-additive** (`CONTEXT.md` § Aggregation Dimensions, R-V3) and **a per-capita denominator
// counts no service account** (R-M14).
//
// Two shaping choices, both load-bearing:
//
//   * **Every Member belongs to at least one Team.** `CONTEXT.md` § Organisation & People says a
//     Member belongs to "one or more" Teams, and the ≥ in property 1 is only true because of it:
//     a Member on *no* Team contributes to the Organization figure and to no Team's, so the sum
//     of the Teams would fall *below* the Organization. `aggregate.ts` handles that row (it is
//     placed nowhere), and this generator does not produce it, because the property under test is
//     the glossary's claim rather than the wider one. T-U28 re-states the precondition as an
//     assertion so the reason is visible where the property is.
//   * **A `service_account` may carry `seat_active: true`.** The roster never does, and the
//     denominator must exclude it anyway: `isSeatHolder` is `kind === "human" && seat_active`, so
//     generating the contradictory row is what proves the *kind* clause is doing the work rather
//     than riding on a seat flag that happens to agree with it.
//
// The Team count is small (1–4) against up to 12 Members, so multi-Team Members — R-V3's whole
// subject — are reached on most runs rather than in the tail. T-U28 counts them and fails if not.
//
// Determinism (P5, R-T5): pure functions of what fast-check's seeded generator chose.

import fc from "fast-check";
import type { MemberFacts, TeamFacts } from "../aggregate";
import type { MemberKind } from "../types";

/** The population a roll-up is computed over: who exists, and which Teams they are on. */
export type Population = {
  readonly members: readonly MemberFacts[];
  readonly teams: readonly TeamFacts[];
};

/** What one Member is, before ids are handed out. */
type MemberShape = {
  readonly kind: MemberKind;
  readonly seat_active: boolean;
  /** Non-empty: a Member belongs to one or more Teams. */
  readonly teams: readonly string[];
};

// Four humans to one service account, against R-D3's 2-in-20 — a denominator that wrongly counted
// service accounts is then wrong by enough to be caught on nearly every run.
const kindArb = fc.oneof(
  { weight: 4, arbitrary: fc.constant<MemberKind>("human") },
  { weight: 1, arbitrary: fc.constant<MemberKind>("service_account") },
);

const shapeArb = (teamIds: readonly string[]): fc.Arbitrary<MemberShape> =>
  fc.record({
    kind: kindArb,
    // Independent of `kind` on purpose: a service account holding an active seat is the row that
    // proves the exclusion is keyed on kind (R-M14).
    seat_active: fc.boolean(),
    teams: fc.uniqueArray(fc.constantFrom(...teamIds), {
      minLength: 1,
      maxLength: teamIds.length,
    }),
  });

const populationOf = (teamIds: readonly string[], shapes: readonly MemberShape[]): Population => {
  const members = shapes.map((shape, index) => ({
    id: `mem_${index + 1}`,
    kind: shape.kind,
    seat_active: shape.seat_active,
  }));
  const teams = teamIds.map((id) => ({
    id,
    member_ids: shapes.flatMap((shape, index) => (shape.teams.includes(id) ? [members[index].id] : [])),
  }));
  return { members, teams };
};

/** A whole Organization's roster: 1–12 Members across 1–4 overlapping Teams. */
export const populationArb: fc.Arbitrary<Population> = fc
  .record({
    memberCount: fc.integer({ min: 1, max: 12 }),
    teamCount: fc.integer({ min: 1, max: 4 }),
  })
  .chain((size) => {
    const teamIds = Array.from({ length: size.teamCount }, (_unused, index) => `team_${index + 1}`);
    return fc
      .array(shapeArb(teamIds), { minLength: size.memberCount, maxLength: size.memberCount })
      .map((shapes) => populationOf(teamIds, shapes));
  });

/** How many Teams a Member was placed on. The multiplicity behind R-V3's excess. */
export const teamCountOf = (population: Population, memberId: string): number =>
  population.teams.filter((team) => team.member_ids.includes(memberId)).length;
