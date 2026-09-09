// R-D21 — the multi-agent fan-out: child sessions, spawned from a root and nested inside it
// (`CONTEXT.md` § Work, ADR-0008, ticket 48).
//
// **Children are spawned last, from finished rows, and they change no root.** Everything above
// this module — the schedule, the Task shapes, the cell assignment, the model draw, the hidden
// rows — runs exactly as it did before children existed, and the roots it produces are
// byte-identical apart from the `parent_session_id: null` the schema now carries. That is
// deliberate and it is what makes the ticket's own claim checkable: the headline figures move by
// the roll-up and by nothing else, because the roots did not move at all. Rework and
// Decomposition are *arrangements of roots* (`tasks.mts`), so R-D8's two rates are untouched by
// construction rather than re-hit by tuning.
//
// **A child is small, and it is small in both dimensions at once.** Its machine allocation is a
// fraction of its root's, and its tokens are the *same* fraction of its root's own draw, taken per
// Model. Scaling the token parcels rather than re-drawing them is what keeps R-D16's tier shares
// and R-D17's monthly frontier trend where the repair in `tokens.mts` put them: a fan-out uses the
// models its root was already using.
//
// **Nesting is by construction, not by rejection.** A child starts at least a minute after its
// root and ends at least a minute before it, so the root's wall clock spans the whole attempt and
// `sessionDurationSeconds` needs no fan-out arithmetic to stay true.

import { priceSession } from "./pricing.mts";
import { intBetween, pickWeighted, type Rng } from "./rng.mts";
import { isoInMadrid } from "./schedule.mts";
import {
  CHILD_COUNT_WEIGHTS,
  CHILD_EDGE_SECONDS,
  CHILD_MINIMUM_SECONDS,
  CHILD_ROOT_SHARE,
  CHILD_SCALE,
  CHILD_WEIGHT_HEADLESS,
  CHILD_WEIGHT_IMPLEMENTATION,
} from "./targets.mts";
import type { AgentSession, TokenUsage } from "./types.mts";

const CLASSES = ["uncached_input", "cache_read", "cache_write", "output"] as const;

/** A root long enough to hold one child with a minute of its own at each end. */
const canFanOut = (row: AgentSession): boolean =>
  !row.hidden &&
  row.parent_session_id === null &&
  row.machine_allocation_duration_s >= CHILD_MINIMUM_SECONDS + 2 * CHILD_EDGE_SECONDS;

/**
 * The fan-out leans where the ticket says it does: toward `implementation` and toward `headless`.
 * Both are the shape of work a sub-agent is actually spawned for — a long unattended run split
 * across parallel agents — and neither is a hard filter, so a `review` still occasionally fans out.
 */
const fanOutWeight = (row: AgentSession): number =>
  (row.work_type === "implementation" ? CHILD_WEIGHT_IMPLEMENTATION : 1) *
  (row.execution_mode === "headless" ? CHILD_WEIGHT_HEADLESS : 1);

/**
 * Efraimidis–Spirakis: one draw per candidate, keyed `u ** (1 / weight)`, take the largest keys.
 * Weighted sampling **without replacement** in one pass — a per-row coin would land the realised
 * share wherever the weights pushed it, and R-D21 is a share of roots, not a probability.
 */
const rootsThatFanOut = (rng: Rng, rows: readonly AgentSession[]): AgentSession[] => {
  const eligible = rows.filter(canFanOut);
  const keyed = eligible.map((row) => ({ row, key: rng() ** (1 / fanOutWeight(row)) }));
  const wanted = Math.round(rows.filter((row) => row.parent_session_id === null && !row.hidden).length * CHILD_ROOT_SHARE);
  return keyed
    .sort((a, b) => b.key - a.key || a.row.id.localeCompare(b.row.id))
    .slice(0, wanted)
    .map((entry) => entry.row)
    .sort((a, b) => a.id.localeCompare(b.id));
};

/** The root's own token draw, scaled. An all-zero Model row is dropped rather than written. */
const scaledUsage = (usages: readonly TokenUsage[], scale: number): TokenUsage[] =>
  usages
    .map((usage) => ({
      model_id: usage.model_id,
      ...Object.fromEntries(CLASSES.map((name) => [name, Math.round(usage[name] * scale)])),
    }))
    .filter((usage) => CLASSES.some((name) => (usage as TokenUsage)[name] > 0)) as TokenUsage[];

/**
 * The three spans, scaled by the same fraction the allocation was, with the rounding residue
 * landing on AFK so that R-T12's identity is exact rather than nearly exact. A `headless` root
 * has no human time at all, so neither has its child.
 */
const scaledSpans = (root: AgentSession, allocation: number) => {
  const scale = allocation / root.machine_allocation_duration_s;
  const interactive = Math.round(root.interactive_duration_s * scale);
  const idle = Math.round(root.idle_duration_s * scale);
  return { interactive, idle, afk: allocation - interactive - idle };
};

const childOf = (rng: Rng, root: AgentSession, id: string): AgentSession => {
  const scale = CHILD_SCALE.min + rng() * (CHILD_SCALE.max - CHILD_SCALE.min);
  const room = root.machine_allocation_duration_s - 2 * CHILD_EDGE_SECONDS;
  const allocation = Math.max(
    CHILD_MINIMUM_SECONDS,
    Math.min(room, Math.round(root.machine_allocation_duration_s * scale)),
  );
  const startedAtMs =
    Date.parse(root.started_at) +
    (CHILD_EDGE_SECONDS + intBetween(rng, 0, room - allocation)) * 1000;
  const spans = scaledSpans(root, allocation);
  const usages = scaledUsage(root.token_usage, allocation / root.machine_allocation_duration_s);
  return {
    id,
    parent_session_id: root.id,
    started_at: isoInMadrid(startedAtMs),
    ended_at: isoInMadrid(startedAtMs + allocation * 1000),
    // The five inherited labels, taken from the root and never re-drawn. `machine_spec` comes
    // with them: a fan-out runs on the machine class its root was launched under.
    member_id: root.member_id,
    repository_id: root.repository_id,
    work_type: root.work_type,
    task_key: root.task_key,
    execution_mode: root.execution_mode,
    machine_spec: root.machine_spec,
    // A child never carries the outcome: the WorkType's criterion is met once, by the attempt.
    accepted: false,
    hidden: false,
    // Nobody types at a sub-agent. `prompt_count` counts *user* messages, and a child receives
    // none — its instructions came from its root, which is not a user.
    prompt_count: 0,
    cost: priceSession(usages, root.machine_spec, allocation),
    interactive_duration_s: spans.interactive,
    idle_duration_s: spans.idle,
    afk_duration_s: spans.afk,
    machine_allocation_duration_s: allocation,
    // The artefact is the root's: a child publishes nothing its root does not.
    artefacts: {},
    token_usage: usages,
  };
};

/**
 * **The fan-out.** ~20% of visible roots spawn one to four children (R-D21), numbered on from the
 * last root so that every root keeps the id it had before children existed.
 */
export const spawnChildren = (rng: Rng, rows: readonly AgentSession[]): AgentSession[] => {
  const children: AgentSession[] = [];
  let next = rows.length;
  for (const root of rootsThatFanOut(rng, rows)) {
    const count = pickWeighted(rng, CHILD_COUNT_WEIGHTS);
    for (let at = 0; at < count; at += 1) {
      next += 1;
      children.push(childOf(rng, root, `ses_${String(next).padStart(4, "0")}`));
    }
  }
  return children;
};
