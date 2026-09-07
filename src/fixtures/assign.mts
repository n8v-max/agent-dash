// Placing every session in a (Repository × WorkType) cell, and settling the outcomes the
// Task shape left free. The cell table (allocation.mts) fixes how many sessions each pair
// holds and how many of them were accepted; this drains it exactly, so R-D6 and R-D7 hold
// by construction rather than by sampling and hoping.

import { REPO_NAMES, WORK_TYPE_KEYS, type CellPlan } from "./allocation.mts";
import { repositoryWeight, workTypeWeight } from "./affinity.mts";
import { pickWeighted, type Rng } from "./rng.mts";
import type { Slot } from "./schedule.mts";
import type { PlannedTask, TaskShape } from "./tasks.mts";
import type { Member, WorkTypeKey } from "./types.mts";

type Cell = { accepted: number; failed: number };
type Pool = Record<string, Record<WorkTypeKey, Cell>>;

export type AssignedSession = {
  slot: Slot;
  accepted: boolean;
  work_type: WorkTypeKey;
};

export type AssignedTask = {
  member_id: string;
  shape: TaskShape;
  repository: string;
  sessions: AssignedSession[];
};

const poolFrom = (plan: CellPlan): Pool =>
  Object.fromEntries(
    REPO_NAMES.map((repo) => [
      repo,
      Object.fromEntries(
        WORK_TYPE_KEYS.map((key) => [
          key,
          { accepted: plan.accepted[repo][key], failed: plan.counts[repo][key] - plan.accepted[repo][key] },
        ]),
      ) as Record<WorkTypeKey, Cell>,
    ]),
  );

const roomIn = (row: Record<WorkTypeKey, Cell>): Cell =>
  WORK_TYPE_KEYS.reduce(
    (total, key) => ({
      accepted: total.accepted + row[key].accepted,
      failed: total.failed + row[key].failed,
    }),
    { accepted: 0, failed: 0 },
  );

const demandOf = (task: PlannedTask): Cell => ({
  accepted: task.sessions.filter((session) => session.accepted === true).length,
  failed: task.sessions.filter((session) => session.accepted === false).length,
});

const chooseRepository = (rng: Rng, member: Member, pool: Pool, task: PlannedTask): string => {
  const need = demandOf(task);
  const free = task.sessions.length - need.accepted - need.failed;
  const feasible = REPO_NAMES.filter((repo) => {
    const room = roomIn(pool[repo]);
    return (
      room.accepted >= need.accepted &&
      room.failed >= need.failed &&
      room.accepted + room.failed >= need.accepted + need.failed + free
    );
  });
  if (feasible.length === 0) throw new Error(`no Repository can hold a ${task.shape} Task`);
  const weights = feasible.map((repo) => {
    const room = roomIn(pool[repo]);
    return [repo, repositoryWeight(member, repo) * (room.accepted + room.failed)] as const;
  });
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  return total > 0 ? pickWeighted(rng, weights) : pickWeighted(rng, feasible.map((r) => [r, 1] as const));
};

const chooseWorkType = (
  rng: Rng,
  member: Member,
  row: Record<WorkTypeKey, Cell>,
  accepted: boolean | null,
): WorkTypeKey => {
  const room = (key: WorkTypeKey) => {
    if (accepted === null) return row[key].accepted + row[key].failed;
    return accepted ? row[key].accepted : row[key].failed;
  };
  const candidates = WORK_TYPE_KEYS.filter((key) => room(key) > 0);
  if (candidates.length === 0) throw new Error("no WorkType left with the required outcome");
  return pickWeighted(
    rng,
    candidates.map((key) => [key, workTypeWeight(member, key) * room(key)] as const),
  );
};

// A free outcome adopts the cell's own remaining mix, which is how the acceptance rates end
// up correct at both margins without ever being sampled against a target.
const chooseOutcome = (rng: Rng, cell: Cell, accepted: boolean | null): boolean => {
  if (accepted !== null) return accepted;
  return pickWeighted(rng, [
    [true, cell.accepted],
    [false, cell.failed],
  ]);
};

// Bots first — their affinity is the rigid one, so they choose while every cell is still
// open — then the most constrained Task shapes, so a three-session Task never arrives at a
// Repository that has already been drained to a single outcome.
const assignmentOrder = (tasks: readonly PlannedTask[], members: readonly Member[]): PlannedTask[] => {
  const isBot = new Set(
    members.filter((member) => member.kind === "service_account").map((member) => member.id),
  );
  return [...tasks].sort((a, b) => {
    const botGap = Number(isBot.has(b.member_id)) - Number(isBot.has(a.member_id));
    if (botGap !== 0) return botGap;
    const sizeGap = b.sessions.length - a.sessions.length;
    if (sizeGap !== 0) return sizeGap;
    return a.sessions[0].slot.started_at_ms - b.sessions[0].slot.started_at_ms;
  });
};

export const assignCells = (
  rng: Rng,
  members: readonly Member[],
  tasks: readonly PlannedTask[],
  plan: CellPlan,
): AssignedTask[] => {
  const pool = poolFrom(plan);
  const memberOf = new Map(members.map((member) => [member.id, member]));
  return assignmentOrder(tasks, members).map((task) => {
    const member = memberOf.get(task.member_id);
    if (member === undefined) throw new Error(`unknown member ${task.member_id}`);
    const repository = chooseRepository(rng, member, pool, task);
    const row = pool[repository];
    const sessions = task.sessions.map(({ slot, accepted }) => {
      const workType = chooseWorkType(rng, member, row, accepted);
      const outcome = chooseOutcome(rng, row[workType], accepted);
      row[workType][outcome ? "accepted" : "failed"] -= 1;
      return { slot, accepted: outcome, work_type: workType };
    });
    return { member_id: task.member_id, shape: task.shape, repository, sessions };
  });
};
