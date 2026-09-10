// Assembling the AgentSession rows: the atomic unit of platform activity, and the grain
// everything is stored at. Cost is priced here and stored on the row (ADR-0005, R-T22).

import type { AssignedTask } from "./assign.mts";
import { repositories } from "./catalog.mts";
import { priceSession } from "./pricing.mts";
import type { ReviewLink } from "./reviews.mts";
import { intBetween, shuffled, type Rng } from "./rng.mts";
import { isoInMadrid, monthKeyOfDay, weekOfDay } from "./schedule.mts";
import { artefactsFor, shapeSession } from "./spans.mts";
import {
  CPU_HEAVY_COUNT,
  CPU_HEAVY_REPOSITORIES,
  HIDDEN_SHARE,
  MADRID_OFFSET_LABEL,
  TOKEN_APPETITE_HEAVY,
  WINDOW_END_DAY,
  WINDOW_START_DAY,
} from "./targets.mts";
import { planTokens } from "./tokens.mts";
import type { AgentSession, Member, Task, TokenUsage, WorkTypeKey } from "./types.mts";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WINDOW_START_MS = Date.parse(`${WINDOW_START_DAY}T00:00:00${MADRID_OFFSET_LABEL}`);
const WINDOW_END_MS = Date.parse(`${WINDOW_END_DAY}T23:59:59${MADRID_OFFSET_LABEL}`);

// R-D12 — how long after the attempt it shadows a hidden retry starts. Bounded by the window:
// a retry that fell off the end would be a row R-D2 forbids, which at the old volume happened
// to be unreachable because the last day held too few accepted single-session Tasks to draw.
const HIDDEN_OFFSET_HOURS = { min: 2, max: 20 };

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
const hiddenDraftsFrom = (rng: Rng, drafts: readonly Draft[], visibleRoots: number): Draft[] => {
  const perTask = new Map<string, number>();
  for (const draft of drafts) perTask.set(draft.task_key, (perTask.get(draft.task_key) ?? 0) + 1);
  // **The share is of every visible root, reviews included** (R-D12). Reviews are drawn after
  // this runs, so the denominator is handed in rather than read off `drafts`; a hidden row is a
  // shadow of a session that had already succeeded, and a review has nothing to shadow.
  const target = Math.round((visibleRoots * HIDDEN_SHARE) / (1 - HIDDEN_SHARE));
  const roomHours = (draft: Draft): number =>
    Math.floor((WINDOW_END_MS - draft.started_at_ms) / HOUR_MS);
  const eligible = drafts.filter(
    (draft) =>
      draft.accepted &&
      perTask.get(draft.task_key) === 1 &&
      !draft.cpu_heavy &&
      roomHours(draft) >= HIDDEN_OFFSET_HOURS.min,
  );
  return shuffled(rng, eligible)
    .slice(0, target)
    .map((draft) => {
      const offsetHours = intBetween(
        rng,
        HIDDEN_OFFSET_HOURS.min,
        Math.min(HIDDEN_OFFSET_HOURS.max, roomHours(draft)),
      );
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

/**
 * **R-D23 — a Member's token appetite.** The activity multiplier R-D4's schedule drew for this
 * Member, times the heavy-tail factor if it is one of the named leaders. It is a multiplier on
 * the *median* of the session's draw, so it widens the Member-month distribution without
 * touching the shape of any one session's.
 */
export const appetiteOf = (
  activity: ReadonlyMap<string, number>,
  memberId: string,
): number => (activity.get(memberId) ?? 1) * (TOKEN_APPETITE_HEAVY[memberId] ?? 1);

const rowsFor = (
  rng: Rng,
  drafts: readonly Draft[],
  activity: ReadonlyMap<string, number>,
): Omit<AgentSession, "id">[] => {
  const usages = planTokens(
    rng,
    drafts.map((draft) => ({
      month_key: monthKeyOfDay(draft.day_index),
      cpu_heavy: draft.cpu_heavy,
      appetite: appetiteOf(activity, draft.member.id),
    })),
  );
  return drafts.map((draft, index) => rowFrom(rng, draft, usages[index]));
};

export type Unidentified = Omit<AgentSession, "id">;

/**
 * **The non-review sessions**: the Jobs that were built, plus R-D12's hidden shadows of them.
 * Ids are not assigned here — `identify` does that once, over these rows and the reviews
 * `reviews.mts` links to them, so a review takes its place in one sequence ordered by time.
 */
export const buildWorkSessions = (
  rng: Rng,
  plan: {
    members: readonly Member[];
    assigned: readonly AssignedTask[];
    tasks: readonly Task[];
    /** Every visible root the fixture will hold, reviews included — R-D12's denominator. */
    visibleRoots: number;
    /** R-D4's per-Member activity multipliers, which R-D23 reads as token appetite. */
    activity: ReadonlyMap<string, number>;
  },
): { visible: Unidentified[]; hidden: Unidentified[] } => {
  const { members, assigned, tasks, visibleRoots, activity } = plan;
  const drafts = draftsFrom(assigned, tasks, members);
  markCpuHeavy(rng, drafts);
  // Visible rows carry the tier ledger on their own, so R-D16's shares are exact over the
  // rows the product can actually see. The hidden rows are planned separately.
  const visible = rowsFor(rng, drafts, activity);
  const hidden = rowsFor(rng, hiddenDraftsFrom(rng, drafts, visibleRoots), activity);
  return { visible, hidden };
};

/**
 * **The reviews** (R-D22). Each one takes its slot's Member and instant, and the Repository and
 * Task of the session it reviews — which is the whole of the linkage, expressed as a row.
 */
export const buildReviewSessions = (
  rng: Rng,
  members: readonly Member[],
  links: readonly ReviewLink[],
  activity: ReadonlyMap<string, number>,
): Unidentified[] => {
  const memberOf = new Map(members.map((member) => [member.id, member]));
  const nameOf = new Map(repositories.map((repository) => [repository.id, repository.name]));
  const drafts: Draft[] = links
    .map((link) => {
      const member = memberOf.get(link.slot.member_id);
      const repository = nameOf.get(link.reviewed.repository_id);
      if (member === undefined) throw new Error(`unknown reviewer ${link.slot.member_id}`);
      if (repository === undefined) throw new Error(`unknown repository ${link.reviewed.repository_id}`);
      return {
        member,
        repository,
        work_type: "review" as const,
        task_key: link.reviewed.task_key,
        accepted: link.accepted,
        hidden: false,
        cpu_heavy: false,
        started_at_ms: link.slot.started_at_ms,
        day_index: link.slot.day_index,
      };
    })
    .sort(byTime);
  return rowsFor(rng, drafts, activity);
};

/**
 * **One id sequence over every row, in time order.** Sequential ids are what let `children.mts`
 * number a fan-out on from the last root, and what makes a diff of the committed files readable.
 */
export const identify = (rows: readonly Unidentified[]): AgentSession[] =>
  [...rows]
    .sort(
      (a, b) =>
        Date.parse(a.started_at) - Date.parse(b.started_at) ||
        a.task_key.localeCompare(b.task_key) ||
        a.member_id.localeCompare(b.member_id),
    )
    .map((row, index) => ({ id: `ses_${String(index + 1).padStart(4, "0")}`, ...row }));

export const dayOfRow = (row: AgentSession): number =>
  Math.floor((Date.parse(row.started_at) - WINDOW_START_MS) / DAY_MS);

export const weekOfRow = (row: AgentSession): number => weekOfDay(dayOfRow(row));
