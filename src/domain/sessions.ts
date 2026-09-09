// The session tree — `CONTEXT.md` § Work (**Root session**, **Child session**), `spec.md` R-M19
// and R-D21, `technical-spec.md` R-T37, ADR-0008. Tested by T-U24 and T-U25, and re-asserted over
// the committed fixture by `src/data/sessions.fixture.test.ts` (P6).
//
// **A sub-agent fan-out is not a second attempt.** The model had one agent per AgentSession, so
// three sub-agents on one Task looked exactly like three retries of it: Rework counted a
// non-accepted session followed by another, and every child is non-accepted by construction. On a
// multi-agent platform the differentiator metric was therefore wrong in the direction that
// flatters nobody — the more a team fanned out, the worse its rework rate read.
//
// The fix is a parent link and one collapse, and this module is that collapse. Three properties
// hold it in place:
//
//   * **A child is never a row in an aggregate.** `rollUpSessions` returns *roots*, with the
//     children's cost, tokens and duration spans folded into them. It is applied once, at parse
//     (`src/data/load.ts`), on the same line as R-M2's hidden strip and for the same reason: a
//     per-query fold is a fold somebody eventually forgets. Nothing above the data layer is
//     offered a population that still holds children.
//   * **The wall clock stays the root's.** A child starts after its root and ends before it, so
//     the root's `started_at`/`ended_at` already span the whole attempt. Session duration is read
//     off those two instants and is unchanged by the fan-out; *machine allocation* is summed,
//     because two agents holding two machines really did hold two machines. This is the one place
//     in the product where `ended_at - started_at` and `machine_allocation_duration_s` legitimately
//     differ, and it is why they were always two claims rather than one.
//   * **Acceptance is the root's.** The WorkType's criterion is met once for the attempt, not once
//     per agent, so a child never carries `accepted` — `childFaults` makes a child that does a
//     fixture fault rather than a quietly-wrong denominator.
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

import { durationSummary } from "./metrics/duration";
import { TOKEN_CLASSES, type AgentSession, type TokenUsage } from "./types";

/** A root is its own attempt: `parent_session_id` is `null` and nothing rolls into it from above. */
export const isRootSession = (session: Readonly<Pick<AgentSession, "parent_session_id">>): boolean =>
  session.parent_session_id === null;

/**
 * **The five labels a child inherits from its root** (`CONTEXT.md` § Work). Declared as data
 * because two layers check them — this module over the loaded rows, the generator over the rows it
 * is about to write — and a list written twice is a list that can disagree with itself.
 *
 * `machine_spec` is inherited too and is deliberately *not* here: it is not one of the labels the
 * ticket makes a child agree on, and the fixture inherits it as a shaping choice rather than as a
 * rule the loader enforces.
 */
export const INHERITED_LABELS = [
  "member_id",
  "repository_id",
  "work_type",
  "task_key",
  "execution_mode",
] as const;

/** The ways a child row can be malformed. Closed, so a new way to be wrong has to be named. */
export const CHILD_FAULTS = [
  "parent-missing",
  "parent-is-not-a-root",
  "labels-disagree",
  "child-is-accepted",
  "parent-hidden",
] as const;
export type ChildFault = (typeof CHILD_FAULTS)[number];

/**
 * Every rule a `(child, parent)` pair has to satisfy, in one expression. A well-formed pair
 * returns `[]`; a child whose parent is absent from the population returns `parent-missing`.
 *
 * **`parent-hidden` is R-M2 reaching the tree.** A hidden session is absorbed by the platform and
 * appears in no metric and no view — so a *visible* child of one would be a row whose cost has
 * nowhere to roll up to. The committed fixture spawns children from visible roots only, and this
 * is what keeps that a checked property rather than a habit of the generator.
 */
export function childFaults(
  child: AgentSession,
  parent: AgentSession | undefined,
): readonly ChildFault[] {
  if (parent === undefined) return ["parent-missing"];
  const faults: ChildFault[] = [];
  if (!isRootSession(parent)) faults.push("parent-is-not-a-root");
  if (INHERITED_LABELS.some((label) => child[label] !== parent[label])) faults.push("labels-disagree");
  if (child.accepted) faults.push("child-is-accepted");
  if (parent.hidden && !child.hidden) faults.push("parent-hidden");
  return faults;
}

/** TokenUsage is keyed by (session × Model), so two rows on one Model fold into one (R-D15). */
const foldUsage = (sessions: readonly AgentSession[]): TokenUsage[] => {
  const held = new Map<string, TokenUsage>();
  for (const session of sessions) {
    for (const usage of session.token_usage) {
      const row = held.get(usage.model_id);
      if (row === undefined) held.set(usage.model_id, { ...usage });
      else for (const tokenClass of TOKEN_CLASSES) row[tokenClass] += usage[tokenClass];
    }
  }
  return [...held.values()];
};

const totalOf = (
  sessions: readonly AgentSession[],
  field: "cost" | "interactive_duration_s" | "idle_duration_s" | "afk_duration_s" | "machine_allocation_duration_s",
): number => sessions.reduce((running, session) => running + session[field], 0);

/** Cents. A stored cost is a whole number of them, and so is the sum of two of them. */
const CENTS = 100;

/**
 * One root, carrying its children's figures.
 *
 * **The folded cost is a whole number of cents, because a stored one is.** This is not the
 * application pricing anything (R-M4 / ADR-0005) — it prices nothing, and adding two attributed
 * figures is aggregation. It is that `4.23 + 0.09` is `4.32` in the units money is denominated in
 * and `4.319999999999999` in binary, and the row this returns stands in for a stored row on every
 * surface that reads one. Carrying the representation noise instead would put a figure into the
 * product that no attribution ever produced, and make two summation orders over the same rows
 * disagree in the last place.
 *
 * The three spans still sum to `machine_allocation_duration_s` exactly (R-T12), because all four
 * are summed together and all four are whole seconds.
 *
 * `accepted`, `prompt_count`, `artefacts` and both instants stay the **root's own**: a child
 * carries no outcome, receives no user messages, and publishes nothing its root does not.
 */
export const rollUpSession = (
  root: AgentSession,
  children: readonly AgentSession[],
): AgentSession => {
  if (children.length === 0) return root;
  const tree = [root, ...children];
  return {
    ...root,
    cost: Math.round(totalOf(tree, "cost") * CENTS) / CENTS,
    interactive_duration_s: totalOf(tree, "interactive_duration_s"),
    idle_duration_s: totalOf(tree, "idle_duration_s"),
    afk_duration_s: totalOf(tree, "afk_duration_s"),
    machine_allocation_duration_s: totalOf(tree, "machine_allocation_duration_s"),
    token_usage: foldUsage(tree),
  };
};

/** Children by the id of the root that spawned them, in the order they were handed in. */
export function childrenByRoot(
  sessions: readonly AgentSession[],
): ReadonlyMap<string, readonly AgentSession[]> {
  const held = new Map<string, AgentSession[]>();
  for (const session of sessions) {
    const parent = session.parent_session_id;
    if (parent === null) continue;
    const existing = held.get(parent);
    if (existing) existing.push(session);
    else held.set(parent, [session]);
  }
  return held;
}

/**
 * **Sessions → roots, with every child folded into the root it belongs to** (R-M19).
 *
 * A child whose root is not in the population is counted **nowhere** — the same rule
 * `aggregate.ts` applies to a row whose Member is not in the population. It is a guarded
 * impossibility rather than a silent correction: `load.ts` faults on an orphan before anything
 * reaches here, and every filter this product applies is on labels a child *inherits*, so a filter
 * that keeps a root keeps its children.
 */
export function rollUpSessions(sessions: readonly AgentSession[]): readonly AgentSession[] {
  const children = childrenByRoot(sessions);
  if (children.size === 0) return sessions;
  return sessions
    .filter(isRootSession)
    .map((root) => rollUpSession(root, children.get(root.id) ?? []));
}

/**
 * **Agents per session** — how many agents worked one attempt, as median and p95 (R-M19).
 *
 * A root that spawned nothing counts 1: it is one agent, not none. The percentile rule is
 * `duration.ts`'s nearest rank, imported rather than restated — A37 puts one interpolation in one
 * place, and a second order-statistic implementation is exactly how two panels come to disagree
 * about a median. `null` over an empty population, never `0` (R-M18).
 */
export type AgentsPerSession = {
  /** Roots in the population — attempts, not agents. */
  readonly sessions: number;
  /** Agents across all of them: the roots plus everything they spawned. */
  readonly agents: number;
  /** `null` over an empty population, never `0` (R-M18). */
  readonly median: number | null;
  readonly p95: number | null;
};

export function agentsPerSession(
  roots: readonly AgentSession[],
  children: ReadonlyMap<string, readonly AgentSession[]>,
): AgentsPerSession {
  const counts = roots.map((root) => 1 + (children.get(root.id)?.length ?? 0));
  const spread = durationSummary(counts);
  return {
    sessions: spread.count,
    agents: counts.reduce((running, count) => running + count, 0),
    median: spread.median,
    p95: spread.p95,
  };
}
