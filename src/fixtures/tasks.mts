// Grouping session slots into Tasks (R-D8). Rework and Decomposition are *observed labels*
// on a Task, not fields, so they are produced here as arrangements of sessions:
//
//   rework         [failed, …]        a non-accepted session followed by another session
//   decomposition  [accepted, accepted]  work deliberately split, not repeated
//   both           [failed, accepted, accepted]
//
// They are independent labels rather than a partition (CONTEXT.md § Decomposition), so the
// overlap is the product of the two rates. `accepted: null` means the outcome is still free —
// `assign.mts` decides it from what the (Repository × WorkType) cell still owes.

import { largestRemainder, shuffled, type Rng } from "./rng.mts";
import type { Slot } from "./schedule.mts";
import { DECOMPOSITION_RATE, REWORK_RATE } from "./targets.mts";
import type { Member } from "./types.mts";

export type TaskShape = "single" | "rework" | "decomposition" | "both";

export type PlannedSession = { slot: Slot; accepted: boolean | null };

export type PlannedTask = {
  member_id: string;
  shape: TaskShape;
  sessions: PlannedSession[];
};

export type TaskQuota = {
  tasks: number;
  singles: number;
  reworkOnly: number;
  decompositionOnly: number;
  both: number;
};

const PATTERN: Record<TaskShape, readonly (boolean | null)[]> = {
  single: [null],
  rework: [false, null],
  decomposition: [true, true],
  both: [false, true, true],
};

// A Task holds 1.3 sessions on average under these two rates, which is what fixes the Task
// count once the session count is known: T = N / (1 + rework + decomposition).
export const quotaFor = (sessionCount: number): TaskQuota => {
  const tasks = Math.round(sessionCount / (1 + REWORK_RATE + DECOMPOSITION_RATE));
  const both = Math.round(REWORK_RATE * DECOMPOSITION_RATE * tasks);
  const reworkOnly = Math.round(REWORK_RATE * tasks) - both;
  const decompositionOnly = Math.round(DECOMPOSITION_RATE * tasks) - both;
  const singles = sessionCount - (2 * (reworkOnly + decompositionOnly) + 3 * both);
  if (singles < 0) throw new Error("R-D8: multi-session Tasks over-subscribe the session count");
  return { tasks: singles + reworkOnly + decompositionOnly + both, singles, reworkOnly, decompositionOnly, both };
};

// Multi-session Tasks are spread over Members in proportion to how much each Member ran,
// then repaired against capacity: a Member cannot hold more multi-session slots than they
// have sessions. The low-usage seat holder (R-D10) is the one this bites on.
//
// Round-robin in volume order, **skipping a Member with no room left**. A plain `i % length` was
// correct while the whole fixture held sixteen three-session Tasks and every Member could absorb
// one; at ticket 66's volume it is over a hundred, and it would hand R-D10's three-session seat
// holder seven of them — a negative remainder that `cut` below would silently turn into Tasks
// with no sessions at all.
const spreadThrees = (counts: readonly number[], wanted: number): number[] => {
  const threes = counts.map(() => 0);
  const byVolume = counts
    .map((count, index) => ({ count, index }))
    .sort((a, b) => b.count - a.count || a.index - b.index);
  for (let placed = 0; placed < wanted; ) {
    const before = placed;
    for (const { index } of byVolume) {
      if (placed >= wanted) break;
      if (counts[index] - 3 * (threes[index] + 1) < 0) continue;
      threes[index] += 1;
      placed += 1;
    }
    if (placed === before) throw new Error("R-D8: no Member has room for a three-session Task");
  }
  return threes;
};

const distribute = (
  counts: readonly number[],
  quota: TaskQuota,
): { threes: number[]; twos: number[] } => {
  const threes = spreadThrees(counts, quota.both);
  const twos = largestRemainder(
    counts.map((count) => Math.max(count, 0.001)),
    quota.reworkOnly + quota.decompositionOnly,
  );
  const spare = (index: number) => counts[index] - 3 * threes[index] - 2 * twos[index];
  for (let guard = 0; guard < 500; guard += 1) {
    const over = twos.findIndex((_, index) => spare(index) < 0 && twos[index] > 0);
    if (over === -1) return { threes, twos };
    const under = twos.findIndex((_, index) => spare(index) >= 2);
    if (under === -1) throw new Error("R-D8: no Member has room for a multi-session Task");
    twos[over] -= 1;
    twos[under] += 1;
  }
  throw new Error("R-D8: multi-session Task distribution did not settle");
};

const cut = (rng: Rng, slots: readonly Slot[], threes: number, twos: number): Slot[][] => {
  const singles = slots.length - 3 * threes - 2 * twos;
  if (singles < 0) throw new Error("R-D8: a Member's multi-session Tasks exceed their sessions");
  const sizes = shuffled(rng, [
    ...Array.from({ length: threes }, () => 3),
    ...Array.from({ length: twos }, () => 2),
    ...Array.from({ length: singles }, () => 1),
  ]);
  const groups: Slot[][] = [];
  let cursor = 0;
  for (const size of sizes) {
    groups.push(slots.slice(cursor, cursor + size));
    cursor += size;
  }
  return groups;
};

const shapeOf = (group: readonly Slot[], reworkLeft: number): TaskShape => {
  if (group.length === 3) return "both";
  if (group.length === 1) return "single";
  return reworkLeft > 0 ? "rework" : "decomposition";
};

export const planTasks = (
  rng: Rng,
  members: readonly Member[],
  slots: readonly Slot[],
): { tasks: PlannedTask[]; quota: TaskQuota } => {
  const quota = quotaFor(slots.length);
  const perMember = members.map((member) => slots.filter((slot) => slot.member_id === member.id));
  const { threes, twos } = distribute(
    perMember.map((list) => list.length),
    quota,
  );
  const groups = perMember.flatMap((list, index) =>
    cut(rng, list, threes[index], twos[index]).map((group) => ({
      member_id: members[index].id,
      group,
    })),
  );
  // Which of the two-session Tasks are Rework and which are Decomposition is drawn globally,
  // so the two rates hold over the Organization rather than per Member.
  //
  // Chosen by **group identity**, not by the first slot's timestamp. At nine sessions per Member
  // per workday two groups can open on the same second, and a timestamp key would then label
  // both of them Rework — moving R-D8's two rates apart by however many collisions the draw
  // happened to produce. The old volume had none and the new one has a handful.
  const twoSession = shuffled(
    rng,
    groups.filter((entry) => entry.group.length === 2),
  );
  const rework = new Set(twoSession.slice(0, quota.reworkOnly));
  const tasks = groups.map((entry) => {
    const { member_id: memberId, group } = entry;
    const shape = shapeOf(group, rework.has(entry) ? 1 : 0);
    return {
      member_id: memberId,
      shape,
      sessions: group.map((slot, index) => ({ slot, accepted: PATTERN[shape][index] })),
    };
  });
  return { tasks, quota };
};
