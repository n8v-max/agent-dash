// Assembling the AgentSession rows: the atomic unit of platform activity, and the grain
// everything is stored at. Cost is priced here and stored on the row (ADR-0005, R-T22).

import type { AssignedTask } from "./assign.mts";
import { priceSession } from "./pricing.mts";
import { intBetween, shuffled, type Rng } from "./rng.mts";
import { isoInMadrid, monthKeyOfDay, weekOfDay } from "./schedule.mts";
import { artefactsFor, shapeSession } from "./spans.mts";
import {
  CPU_HEAVY_COUNT,
  CPU_HEAVY_REPOSITORIES,
  HIDDEN_SHARE,
  MADRID_OFFSET_LABEL,
  WINDOW_START_DAY,
} from "./targets.mts";
import { planTokens } from "./tokens.mts";
import type { AgentSession, Member, Task, TokenUsage, WorkTypeKey } from "./types.mts";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WINDOW_START_MS = Date.parse(`${WINDOW_START_DAY}T00:00:00${MADRID_OFFSET_LABEL}`);

type Draft = {
  member: Member;
  repository: string;
  work_type: WorkTypeKey;
  task_key: string;
  accepted: boolean;
  hidden: boolean;
  cpu_heavy: boolean;
  started_at_ms: number;
  day_index: number;
};

const byTime = (a: Draft, b: Draft): number =>
  a.started_at_ms - b.started_at_ms ||
  a.task_key.localeCompare(b.task_key) ||
  a.member.id.localeCompare(b.member.id);

const draftsFrom = (
  assigned: readonly AssignedTask[],
  tasks: readonly Task[],
  members: readonly Member[],
): Draft[] => {
  const memberOf = new Map(members.map((member) => [member.id, member]));
  return assigned
    .flatMap((task, index) =>
      task.sessions.map((session) => {
        const member = memberOf.get(task.member_id);
        if (member === undefined) throw new Error(`unknown member ${task.member_id}`);
        return {
          member,
          repository: task.repository,
          work_type: session.work_type,
          task_key: tasks[index].key,
          accepted: session.accepted,
          hidden: false,
          cpu_heavy: false,
          started_at_ms: session.slot.started_at_ms,
          day_index: session.slot.day_index,
        };
      }),
    )
    .sort(byTime);
};

// R-D11 — ~20 CPU-heavy, token-light sessions on `compute` in `terraform-infra` and
// `api-gateway`. Marked here so both the duration shape and the token draw can see it.
const markCpuHeavy = (rng: Rng, drafts: readonly Draft[]): void => {
  const eligible = drafts.filter((draft) =>
    CPU_HEAVY_REPOSITORIES.includes(draft.repository as (typeof CPU_HEAVY_REPOSITORIES)[number]),
  );
  if (eligible.length < CPU_HEAVY_COUNT) throw new Error("R-D11: too few eligible sessions");
  for (const draft of shuffled(rng, eligible).slice(0, CPU_HEAVY_COUNT)) draft.cpu_heavy = true;
};

// R-D12 — ~2% hidden sessions, generated here and excluded in the data layer. Each one is a
// platform failure appended to a Task that had already succeeded, so the visible history of
// that Task is unchanged and only the row count moves when the filter is applied.
const hiddenDraftsFrom = (rng: Rng, drafts: readonly Draft[]): Draft[] => {
  const perTask = new Map<string, number>();
  for (const draft of drafts) perTask.set(draft.task_key, (perTask.get(draft.task_key) ?? 0) + 1);
  const target = Math.round((drafts.length * HIDDEN_SHARE) / (1 - HIDDEN_SHARE));
  const eligible = drafts.filter(
    (draft) => draft.accepted && perTask.get(draft.task_key) === 1 && !draft.cpu_heavy,
  );
  return shuffled(rng, eligible)
    .slice(0, target)
    .map((draft) => {
      const offsetHours = intBetween(rng, 2, 20);
      const startedAtMs = draft.started_at_ms + offsetHours * HOUR_MS;
      return {
        ...draft,
        accepted: false,
        hidden: true,
        started_at_ms: startedAtMs,
        day_index: Math.floor((startedAtMs - WINDOW_START_MS) / DAY_MS),
      };
    })
    .sort(byTime);
};

const rowFrom = (rng: Rng, draft: Draft, usages: TokenUsage[]): Omit<AgentSession, "id"> => {
  const shape = shapeSession(rng, {
    member: draft.member,
    repository: draft.repository,
    work_type: draft.work_type,
    cpu_heavy: draft.cpu_heavy,
  });
  const { machine_allocation_duration_s: allocation, machine_spec: spec } = shape;
  if (shape.interactive_duration_s + shape.idle_duration_s + shape.afk_duration_s !== allocation) {
    throw new Error("R-T12: duration spans do not sum to the machine allocation");
  }
  return {
    // A root. `children.mts` is the only thing that writes a parent, and it writes one only
    // onto rows it has just spawned from a root in this list (R-D21, ADR-0008).
    parent_session_id: null,
    started_at: isoInMadrid(draft.started_at_ms),
    ended_at: isoInMadrid(draft.started_at_ms + allocation * 1000),
    member_id: draft.member.id,
    repository_id: `repo_${draft.repository.replace(/-/gu, "_")}`,
    work_type: draft.work_type,
    task_key: draft.task_key,
    execution_mode: shape.execution_mode,
    machine_spec: spec,
    accepted: draft.accepted,
    hidden: draft.hidden,
    prompt_count: shape.prompt_count,
    cost: priceSession(usages, spec, allocation),
    interactive_duration_s: shape.interactive_duration_s,
    idle_duration_s: shape.idle_duration_s,
    afk_duration_s: shape.afk_duration_s,
    machine_allocation_duration_s: allocation,
    artefacts: artefactsFor(rng, draft.work_type, draft.accepted),
    token_usage: usages,
  };
};

const rowsFor = (rng: Rng, drafts: readonly Draft[]): Omit<AgentSession, "id">[] => {
  const usages = planTokens(
    rng,
    drafts.map((draft) => ({
      month_key: monthKeyOfDay(draft.day_index),
      cpu_heavy: draft.cpu_heavy,
    })),
  );
  return drafts.map((draft, index) => rowFrom(rng, draft, usages[index]));
};

export const buildSessions = (
  rng: Rng,
  members: readonly Member[],
  assigned: readonly AssignedTask[],
  tasks: readonly Task[],
): AgentSession[] => {
  const drafts = draftsFrom(assigned, tasks, members);
  markCpuHeavy(rng, drafts);
  // Visible rows carry the tier ledger on their own, so R-D16's shares are exact over the
  // rows the product can actually see. The hidden rows are planned separately.
  const visible = rowsFor(rng, drafts);
  const hidden = rowsFor(rng, hiddenDraftsFrom(rng, drafts));
  return [...visible, ...hidden]
    .sort(
      (a, b) =>
        Date.parse(a.started_at) - Date.parse(b.started_at) ||
        a.task_key.localeCompare(b.task_key) ||
        a.member_id.localeCompare(b.member_id),
    )
    .map((row, index) => ({ id: `ses_${String(index + 1).padStart(4, "0")}`, ...row }));
};

export const dayOfRow = (row: AgentSession): number =>
  Math.floor((Date.parse(row.started_at) - WINDOW_START_MS) / DAY_MS);

export const weekOfRow = (row: AgentSession): number => weekOfDay(dayOfRow(row));
