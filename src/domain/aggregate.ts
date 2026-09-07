// Roll-ups across every aggregation dimension — `CONTEXT.md` § Organisation & People and
// § Aggregation Dimensions, `spec.md` R-V3 / R-M14 / R-M7, `technical-spec.md` § 3.2, ADR-0005,
// ticket 23. Tested by T-U6 and T-U7.
//
// ADR-0005 moved cost attribution upstream and named the tests that replace the pricing
// function: *"the interesting failures in this product are aggregation failures — non-additive
// Team totals … per-capita denominators that include service accounts. Pricing a session is
// multiplication."* Two of those four live here, and the module is arranged so that both are
// properties of the construction rather than rules someone has to remember:
//
//   * **R-V3 — Team is a containment hierarchy, not a partition.** Members are many-to-many with
//     Teams, there is no primary Team, and an overlapping Member contributes their **full**
//     figure to each Team they belong to. The sum of every Team's figure therefore *exceeds* the
//     Organization's, on purpose. Organization → Member and Model → family → tier are true
//     partitions and do sum; they are computed by the same code here so the Team result reads as
//     a property of the dimension rather than as a bug nobody fixed.
//
//   * **R-M14 — a per-capita denominator counts active *human* Members only.** Service accounts
//     hold no seat. Their sessions are real work and real cost and stay in the **numerator**;
//     only the seat-holding denominator excludes them. Raw is the default, and per-capita is
//     offered only where more than one Member is aggregated.
//
// **One placement, three uses — which is why the overlap note cannot disagree with the total.**
// Every roll-up begins by placing each Member into the group keys that Member belongs to
// (`Placement`). That single map is then read three times and never rebuilt: it decides which
// groups a row's figure lands in, which Members size each group's per-capita denominator, and
// which Members are counted more than once. The note is not a second opinion about the data —
// it is the multiplicity of the very map that did the double counting, so `sumGroups(rollup) -
// rollup.total` is exactly the figures of the Members the note names. T-U6 asserts that identity
// rather than trusting it.
//
// The note is keyed on *belonging*, matching R-V3's own words ("3 Members belong to more than one
// Team"). A multi-Team Member who ran nothing still overlaps: they sit in two per-capita
// denominators. They add nothing to the excess, and the identity above still holds, because their
// figure is zero.
//
// **R-M7 — Model is a breakdown, not a comparison axis.** `AggregationInput` carries no model
// field, so no session-grain measure here can reach one. `modelMix` exists only to produce a
// *distribution*, it takes token-grain entries rather than sessions, and its parameters are a
// roster to look labels up in and a roll-up level to read them at — never a Model to filter or
// group a per-session metric by (T-U17, A22).
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

import { membershipFromTeams } from "./access";
import type { Member, Model, Team } from "./types";

/**
 * How a figure is read off one row. Deliberately the caller's: this module defines no metric,
 * because a metric that lived here would be one the aggregation could not be tested apart from.
 */
export type Measure<Row> = (row: Row) => number;

/** The minimum a row needs to be attributed to a Member. `AgentSession` satisfies it. */
export type MemberKeyed = { readonly member_id: string };

/**
 * The minimum a roll-up needs from a Member. `Member` satisfies it structurally.
 *
 * `team_ids` is deliberately absent: membership is read from `TeamFacts.member_ids` through
 * `membershipFromTeams`, the same inversion the permission filter runs on, so the two layers
 * cannot come to different conclusions about who is on a Team.
 */
export type MemberFacts = Readonly<Pick<Member, "id" | "kind" | "seat_active">>;

/** The minimum a roll-up needs from a Team. `Team` satisfies it structurally. */
export type TeamFacts = Readonly<Pick<Team, "id" | "member_ids">>;

/** The Member-dimension roll-up levels (`CONTEXT.md` § Aggregation Dimensions). */
export const ROLLUP_LEVELS = ["member", "team", "organization"] as const;
export type RollupLevel = (typeof ROLLUP_LEVELS)[number];

/** The single group key of the Organization level. Stable identity, never an index (R-T8). */
export const ORGANIZATION_KEY = "organization";

/**
 * R-M14. **`denominator` is active human Members**; `members` is everyone whose rows are in the
 * numerator, service accounts included.
 */
export type PerCapita = {
  /** Offered only where more than one Member is aggregated, and never over an empty denominator. */
  readonly available: boolean;
  /** Every Member in the population. Service accounts are here: their work is real. */
  readonly members: number;
  /** Active human Members — the seat-holding denominator, and the only one. */
  readonly denominator: number;
  /** `total / denominator`, or `null` where per-capita is not offered. Never a divide by zero. */
  readonly value: number | null;
};

/** R-V3, computed from the placement that produced the totals. */
export type Overlap = {
  /** Members counted into more than one group, sorted. Their figures are in each of them. */
  readonly memberIds: readonly string[];
  readonly count: number;
  /** The statement in words. `null` where the level partitions and nothing overlaps by design. */
  readonly note: string | null;
};

/** A keyed figure. The shape both a Member/Team group and a Model slice reduce to. */
export type Slice = { readonly key: string; readonly total: number };

/** One group of a roll-up: its figure, the Members behind it, and its per-capita reading. */
export type Group = Slice & {
  readonly memberIds: readonly string[];
  readonly perCapita: PerCapita;
};

export type Rollup = {
  readonly level: RollupLevel;
  /** One per key in the population, in population order — including groups holding nothing. */
  readonly groups: readonly Group[];
  /** The Organization figure over the same rows. Only Team's groups sum past it. */
  readonly total: number;
  /** Per-capita over the whole population, dormant seat-holders included (R-D10). */
  readonly perCapita: PerCapita;
  /** Whether the groups partition the measure. Feeds `stackable` (R-V1) — false for Team, only. */
  readonly partition: boolean;
  readonly overlap: Overlap;
  /** The ledger: Member → the group keys their rows and their seat were counted into. */
  readonly placement: ReadonlyMap<string, readonly string[]>;
};

/**
 * Everything a roll-up reads. There is **no model field** and no model parameter anywhere on
 * this type: a per-session metric cannot be grouped by or filtered on Model (R-M7, A22).
 */
export type AggregationInput<Row extends MemberKeyed> = {
  readonly rows: readonly Row[];
  readonly measure: Measure<Row>;
  /** The population. It, not the rows, decides which groups exist and how large they are. */
  readonly members: readonly MemberFacts[];
  readonly teams: readonly TeamFacts[];
};

const NO_KEYS: readonly string[] = [];
const NO_MEMBERS: readonly MemberFacts[] = [];

/**
 * Who the Organization pays a seat for. A service account holds no seat; nor does a lapsed one.
 *
 * Exported because it answers one question for two callers who must not disagree: R-M14's
 * per-capita denominator here, and R-M5's seat charge in `metrics/spend.ts`. Two copies of this
 * predicate would let the number of people the Organization pays for differ between the figure
 * that divides by it and the figure that bills it.
 */
export const isSeatHolder = (member: MemberFacts): boolean =>
  member.kind === "human" && member.seat_active;

/**
 * R-M14 — divide a population figure by its **active human Members**.
 *
 * "Active" is read as *holding an active seat*, which is the reason `CONTEXT.md` itself gives
 * for the exclusion ("service accounts … hold no seat"). The rejected reading is *active in the
 * period*: it would make the denominator depend on the measure, so two metrics over one
 * population would disagree about its size, and it would delete exactly the Member R-D10 seeds —
 * a seat held against near-zero usage, which is the sharpest finding in the product.
 */
export function perCapita(total: number, population: readonly MemberFacts[]): PerCapita {
  const denominator = population.filter(isSeatHolder).length;
  const available = population.length > 1 && denominator > 0;
  return {
    available,
    members: population.length,
    denominator,
    value: available ? total / denominator : null,
  };
}

/** The placement, plus the populations it implies. Built once per roll-up, read three times. */
type Dimension = {
  readonly keys: readonly string[];
  readonly placement: ReadonlyMap<string, readonly string[]>;
  readonly populations: ReadonlyMap<string, readonly MemberFacts[]>;
  readonly partition: boolean;
};

type Placed = Pick<Dimension, "placement" | "populations">;

/**
 * Places every Member into the keys they belong to. A Member may land in none (on no Team), one
 * (the partition levels) or several — the last is the whole of R-V3, and it is expressed here
 * once so that no downstream figure can opt out of it.
 */
const place = (
  members: readonly MemberFacts[],
  keysOf: (member: MemberFacts) => readonly string[],
): Placed => {
  const placement = new Map<string, readonly string[]>();
  const populations = new Map<string, MemberFacts[]>();
  for (const member of members) {
    const keys = keysOf(member);
    placement.set(member.id, keys);
    for (const key of keys) {
      const held = populations.get(key);
      if (held) held.push(member);
      else populations.set(key, [member]);
    }
  }
  return { placement, populations };
};

const dimensionOf = (
  level: RollupLevel,
  members: readonly MemberFacts[],
  teams: readonly TeamFacts[],
): Dimension => {
  if (level === "member") {
    return { keys: members.map((member) => member.id), ...place(members, (m) => [m.id]), partition: true };
  }
  if (level === "team") {
    const membership = membershipFromTeams(teams);
    return {
      keys: teams.map((team) => team.id),
      ...place(members, (member) => membership.get(member.id) ?? NO_KEYS),
      // R-V1 — a property of the *dimension*, not of today's rows. A Team grouping that happens
      // not to overlap in one filtered view is still a grouping whose geometry may not assert a
      // partition, so this is declared rather than derived from `overlap.count`.
      partition: false,
    };
  }
  return { keys: [ORGANIZATION_KEY], ...place(members, () => [ORGANIZATION_KEY]), partition: true };
};

/** R-V3's sentence. Built from the count the placement produced, so it can state nothing else. */
const noteFor = (count: number): string => {
  if (count === 0) return "No Member belongs to more than one Team; totals do not overlap.";
  const subject = count === 1 ? "1 Member belongs" : `${count} Members belong`;
  return `${subject} to more than one Team; totals overlap.`;
};

const overlapOf = (dimension: Dimension): Overlap => {
  const memberIds = [...dimension.placement]
    .filter(([, keys]) => keys.length > 1)
    .map(([memberId]) => memberId)
    .sort((left, right) => left.localeCompare(right));
  return {
    memberIds,
    count: memberIds.length,
    note: dimension.partition ? null : noteFor(memberIds.length),
  };
};

/**
 * The roll-up. One pass over the rows, one placement behind every number it returns.
 *
 * A row whose Member is not in the population is counted **nowhere**, at every level, so the
 * partition levels stay partitions of the population rather than of the input. The committed
 * fixture holds no such row and `aggregate.fixture.test.ts` asserts it, so the drop is a
 * guarded impossibility rather than a silent correction.
 */
export function rollUp<Row extends MemberKeyed>(
  input: AggregationInput<Row>,
  level: RollupLevel,
): Rollup {
  const dimension = dimensionOf(level, input.members, input.teams);
  const totals = new Map<string, number>();
  let total = 0;

  for (const row of input.rows) {
    const keys = dimension.placement.get(row.member_id);
    if (!keys) continue;
    const value = input.measure(row);
    total += value;
    // The full figure into every key the Member belongs to — never a share of it (R-V3).
    for (const key of keys) totals.set(key, (totals.get(key) ?? 0) + value);
  }

  const groups = dimension.keys.map((key) => {
    const population = dimension.populations.get(key) ?? NO_MEMBERS;
    const groupTotal = totals.get(key) ?? 0;
    return {
      key,
      total: groupTotal,
      memberIds: population.map((member) => member.id),
      // R-M14 × R-V3: an overlapping Member sizes each of their Teams' denominators, exactly
      // as their figure sits in each of their Teams' numerators.
      perCapita: perCapita(groupTotal, population),
    };
  });

  return {
    level,
    groups,
    total,
    perCapita: perCapita(total, input.members),
    partition: dimension.partition,
    overlap: overlapOf(dimension),
    placement: dimension.placement,
  };
}

/** What the groups add up to. Equal to `total` on a partition; greater than it on Team. */
export const sumGroups = (rollup: Rollup): number =>
  rollup.groups.reduce((running, group) => running + group.total, 0);

// --- Model: a distribution, never an axis (R-M7) -------------------------------------------

/** The Model roll-up levels. Exact is the storage grain; family carries the vendor. */
export const MODEL_LEVELS = ["exact", "family", "tier"] as const;
export type ModelLevel = (typeof MODEL_LEVELS)[number];

/** The minimum a distribution needs from a row. `TokenUsage` satisfies it. */
export type ModelKeyed = { readonly model_id: string };

/** The minimum it needs from a Model. `Model` satisfies it structurally. */
export type ModelFacts = Readonly<Pick<Model, "id" | "family" | "tier">>;

export type ModelMixInput<Entry extends ModelKeyed> = {
  /** **TokenUsage-grain entries, not sessions.** A session may span several Models (R-D15). */
  readonly entries: readonly Entry[];
  readonly measure: Measure<Entry>;
  /** The roster the labels are looked up in — a lookup table, not a filter. */
  readonly models: readonly ModelFacts[];
};

export type Distribution = {
  readonly level: ModelLevel;
  readonly slices: readonly Slice[];
  readonly total: number;
  /** Always true: exact → family → tier is a true partition, and the contrast case to Team. */
  readonly partition: boolean;
};

const LABEL_OF: Readonly<Record<ModelLevel, (model: ModelFacts) => string>> = {
  exact: (model) => model.id,
  family: (model) => model.family,
  tier: (model) => model.tier,
};

/**
 * Model mix at one roll-up level — a **distribution** (R-M7). Every level is a true partition of
 * the same token-grain measure, so all three carry the same total; T-U6 asserts that as the
 * contrast to Team.
 *
 * An entry naming a Model outside the roster is counted nowhere, on the same rule as an
 * unattributable row.
 */
export function modelMix<Entry extends ModelKeyed>(
  input: ModelMixInput<Entry>,
  level: ModelLevel,
): Distribution {
  const labelOf = LABEL_OF[level];
  const labelByModel = new Map(input.models.map((model) => [model.id, labelOf(model)]));
  const totals = new Map<string, number>();
  let total = 0;

  for (const entry of input.entries) {
    const label = labelByModel.get(entry.model_id);
    if (label === undefined) continue;
    const value = input.measure(entry);
    total += value;
    totals.set(label, (totals.get(label) ?? 0) + value);
  }

  const keys = [...new Set(input.models.map(labelOf))];
  return {
    level,
    slices: keys.map((key) => ({ key, total: totals.get(key) ?? 0 })),
    total,
    partition: true,
  };
}
