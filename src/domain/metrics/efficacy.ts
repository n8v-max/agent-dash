// Efficacy — `CONTEXT.md` § Work (Rework, Completed / Incomplete Task, Decomposition) and
// § Metric Concepts, `spec.md` R-M1 / R-M3 / R-M6 / R-M16, R-D6 / R-D8 / R-D9, A21,
// `technical-spec.md` § 3.2, ticket 25. Tested by T-U14, T-U15 and T-U16, and re-asserted
// against the committed fixture in `src/data/efficacy.fixture.test.ts` (P6).
//
// Four figures, and every one of them is a place this product could confidently assert a wrong
// number. The module is arranged so that each of the four ways of being wrong is unavailable
// rather than discouraged:
//
//   * **R-M6 / A21 — acceptance rate is computed *within* a WorkType, and this module cannot
//     produce a cross-WorkType figure.** Each WorkType defines its own acceptance criterion —
//     a published pull request, a submitted review, a commit on the default branch — so an
//     Organization-level average is an average of incommensurable things. Four properties make
//     that figure unwritable here rather than merely unasked-for:
//
//       1. `acceptanceRateWithin` **requires** a `WorkTypeKey`. That union is the closed
//          five-value vocabulary of `types.ts`; it has no `"all"` member, no `undefined` member
//          and no array form, so there is no argument that names "every WorkType".
//       2. It **filters to that WorkType itself**. Handing it a mixed population cannot produce
//          a mixed figure: rows of other types are gone before anything is counted, so the
//          denominator is always one criterion's sessions.
//       3. Every result **names its own WorkType**, in a field holding one key and not a list.
//          A figure that spanned two types has no shape to be returned in, and no renderer can
//          print a rate without the criterion it was measured against beside it.
//       4. There is **no aggregate entry point**. `acceptanceRateByWorkType` returns a
//          `Record<WorkTypeKey, …>` — the key set *is* the vocabulary, so there is no key an
//          org-level figure could be filed under — and this module exports nothing that
//          combines, sums or averages two `AcceptanceRate`s. T-U14 asserts that absence.
//
//   * **Rework is WorkType-blind, because its input carries no WorkType at all.** R-M1 and
//     `CONTEXT.md` define it as a **non-accepted session followed by another session on the same
//     Task, of any WorkType**; the same-WorkType clause was dropped by ticket 05, since a failed
//     `review` followed by an `implementation` is still a second attempt at the same Task. That
//     is not enforced by a comment here: `TaskSession` has no `work_type` field, so the dropped
//     clause has nothing to read and cannot be reintroduced without changing the type every
//     caller passes. The consequence — the rate runs higher than the strict reading gives — is
//     the accepted reading, not a bug.
//
//   * **Rework and Decomposition are independent labels, not a partition.** They are two
//     booleans on `TaskFacts`, never one enum: a long Task can be repeated *and* split, and the
//     committed fixture holds Tasks in all four combinations. A discriminated `kind` field would
//     have made the both-case unrepresentable and quietly halved one of the two rates.
//     Decomposition counts a second **accepted** session — work deliberately split — where
//     Rework counts a *failed* session with anything after it. That is the whole distinction,
//     and it is why the raw multi-session count is not a metric.
//
//   * **R-M16 — Incomplete Task age buckets are half-open and do not double-cover day 90.** The
//     boundaries are declared once, as data (`INCOMPLETE_AGE_BUCKETS`), with an **exclusive**
//     upper edge, and the lookup takes the first bucket whose edge is above the age. A day
//     cannot land in two buckets because the search stops at the first, and it cannot land in
//     none because the oldest bucket has no edge. The published wording is `0–7 · 8–30 · 31–90 ·
//     **91+**`: day 90 is the last day of the third bucket and day 91 the first of the fourth.
//     (The ticket's own Scope line still says "90+", which double-covered day 90; R-M16 and
//     T-U16 say `91+` and are the fixed point.)
//
// **Incomplete is an umbrella, on purpose.** An Incomplete Task is a Task with no accepted
// session — nothing more. It covers work still in flight and work someone gave up on, and the
// platform cannot tell them apart because it does not own the external Task's lifecycle. So
// there is **no status field, no threshold and no "abandoned" label** anywhere below: a Task
// either has an accepted session or it does not (`completed`, and its complement), and the only
// further thing this module says about an Incomplete one is how old its last session is. The
// reader draws the conclusion the data cannot support.
//
// **"Now" is an argument** (P5). Age is the one figure here that needs a clock, and it never
// reads one: `incompleteTaskAges` takes `now` as an ISO 8601 instant. The fixture window ends
// 2026-09-08, so a function reading the wall clock passes today and fails tomorrow.
//
// **Age is an elapsed duration, not a calendar boundary**, so it carries no timezone. R-M10
// governs *period* bucketing — where a day starts — and this is not that: "31 days since the
// last session" is the same 31 days in every zone.
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

import type { WorkTypeKey } from "../types";

// --- Acceptance rate: within a WorkType, always (R-M6, A21) --------------------------------

/**
 * The minimum an acceptance figure needs from a session. `AgentSession` satisfies it
 * structurally. `accepted` is the session's **only** outcome field (R-M3): there is no terminal
 * status to consult and no completion rate to compute.
 */
export type SessionOutcome = {
  readonly work_type: WorkTypeKey;
  readonly accepted: boolean;
};

/**
 * One WorkType's acceptance rate, and the counts behind it. `work_type` is a single key, never
 * a list: a figure spanning two criteria has no shape here to be returned in.
 */
export type AcceptanceRate = {
  /** The criterion this rate was measured against. Present so it cannot be shown without it. */
  readonly work_type: WorkTypeKey;
  /** Sessions of this WorkType. The denominator, and never another WorkType's. */
  readonly sessions: number;
  readonly accepted: number;
  /** `accepted / sessions`, or `null` where the WorkType ran nothing. Never a divide by zero. */
  readonly rate: number | null;
};

/**
 * **The only way to compute an acceptance rate.** It requires a WorkType, and it filters to that
 * WorkType itself — so the population it divides is always one acceptance criterion's sessions,
 * whatever population the caller handed in.
 *
 * There is deliberately no companion taking a set of WorkTypes, and no option widening it to
 * all of them. R-M6 is not a rule about what to render; it is a rule about which numbers exist.
 */
export function acceptanceRateWithin(
  workType: WorkTypeKey,
  sessions: readonly SessionOutcome[],
): AcceptanceRate {
  const within = sessions.filter((session) => session.work_type === workType);
  const accepted = within.filter((session) => session.accepted).length;
  return {
    work_type: workType,
    sessions: within.length,
    accepted,
    rate: within.length === 0 ? null : accepted / within.length,
  };
}

/**
 * Every WorkType's rate, side by side — the shape every acceptance surface renders (R-D6).
 *
 * The return type's key set **is** the WorkType vocabulary, so there is no `total`, `overall` or
 * `organization` key for a cross-criterion figure to be filed under, and nothing here sums two
 * of them. The five keys are written out rather than mapped so that the compiler, not a test,
 * is what fails if the vocabulary ever gains a sixth member.
 */
export function acceptanceRateByWorkType(
  sessions: readonly SessionOutcome[],
): Readonly<Record<WorkTypeKey, AcceptanceRate>> {
  const within = (key: WorkTypeKey): AcceptanceRate => acceptanceRateWithin(key, sessions);
  return {
    implementation: within("implementation"),
    refactor: within("refactor"),
    bugfix: within("bugfix"),
    review: within("review"),
    deploy: within("deploy"),
  };
}

// --- Task grain: Rework, Decomposition, Completed / Incomplete ------------------------------

/**
 * The minimum a Task-grain label needs from a session. `AgentSession` satisfies it structurally.
 *
 * **There is no `work_type` here, and that is the point** — Rework is a non-accepted session
 * followed by another session *of any WorkType*, so the computation below is given nothing to
 * narrow on. Restoring the dropped same-type clause would mean changing this type first.
 */
export type TaskSession = {
  /** `owner/repo#number` — externally keyed, never absent and never synthetic. */
  readonly task_key: string;
  readonly accepted: boolean;
  readonly started_at: string;
  readonly ended_at: string;
};

/**
 * What one Task's sessions add up to. **`rework` and `decomposition` are two independent
 * booleans, not one enum**: a Task can exhibit both, either or neither, and all four
 * combinations occur in the committed fixture.
 */
export type TaskFacts = {
  readonly task_key: string;
  readonly sessions: number;
  readonly accepted: number;
  /** A non-accepted session with another session after it — of any WorkType. */
  readonly rework: boolean;
  /** More than one **accepted** session: work deliberately split, not work repeated. */
  readonly decomposition: boolean;
  /** At least one accepted session — a Completed Task. An Incomplete Task is its complement. */
  readonly completed: boolean;
  /** The end of the Task's most recent session. What age is measured from (R-M16). */
  readonly lastSessionEndedAt: string;
};

/** An ISO 8601 instant in milliseconds, or `undefined`. `Date.parse` is arithmetic, not a clock. */
const instantOf = (text: string): number | undefined => {
  const at = Date.parse(text);
  return Number.isNaN(at) ? undefined : at;
};

/** For ordering only: a timestamp that is not an instant sorts oldest rather than throwing. */
const orderableInstant = (text: string): number => instantOf(text) ?? Number.NEGATIVE_INFINITY;

/**
 * Session order on a Task: by start, ties broken by end so the order is total for a fixed input.
 * "Followed by" is read off this order and nothing else.
 */
const inSessionOrder = (left: TaskSession, right: TaskSession): number =>
  orderableInstant(left.started_at) - orderableInstant(right.started_at) ||
  orderableInstant(left.ended_at) - orderableInstant(right.ended_at);

/** The latest end among a Task's sessions. A group is never empty: a row is what creates it. */
const lastEndOf = (sessions: readonly TaskSession[]): string => {
  let latest = "";
  let latestAt = Number.NEGATIVE_INFINITY;
  for (const session of sessions) {
    const at = orderableInstant(session.ended_at);
    if (at >= latestAt) {
      latest = session.ended_at;
      latestAt = at;
    }
  }
  return latest;
};

/**
 * One Task's labels, from its own sessions.
 *
 * **Rework** is "any session but the last one failed" — which is exactly *a non-accepted session
 * followed by another session*, with no WorkType consulted on either side. **Decomposition** is
 * a second *accepted* session. The two are computed from the same ordered list and neither
 * excludes the other.
 */
const factsFor = (taskKey: string, sessions: readonly TaskSession[]): TaskFacts => {
  const ordered = [...sessions].sort(inSessionOrder);
  const accepted = ordered.filter((session) => session.accepted).length;
  return {
    task_key: taskKey,
    sessions: ordered.length,
    accepted,
    rework: ordered.slice(0, -1).some((session) => !session.accepted),
    decomposition: accepted > 1,
    completed: accepted > 0,
    lastSessionEndedAt: lastEndOf(ordered),
  };
};

/**
 * Sessions → one row per Task, in `task_key` order. The single grouping pass behind every
 * Task-grain figure in this module: the Rework rate, the Decomposition rate and the Incomplete
 * age buckets all read the same labels, so no two of them can disagree about a Task.
 *
 * The **Tasks are the rows' own** — the population is whatever sessions were handed in, already
 * filtered by period, permission and hidden-session removal upstream (R-M2, R-T17).
 */
export function taskFacts(sessions: readonly TaskSession[]): readonly TaskFacts[] {
  const held = new Map<string, TaskSession[]>();
  for (const session of sessions) {
    const existing = held.get(session.task_key);
    if (existing) existing.push(session);
    else held.set(session.task_key, [session]);
  }
  return [...held]
    .map(([taskKey, rows]) => factsFor(taskKey, rows))
    .sort((left, right) => left.task_key.localeCompare(right.task_key));
}

/** A share of Tasks: the count, the population it came out of, and the ratio between them. */
export type TaskShare = {
  /** Every Task in the population — the denominator, Completed and Incomplete alike. */
  readonly tasks: number;
  readonly count: number;
  /** `count / tasks`, or `null` over an empty population. Never a divide by zero. */
  readonly rate: number | null;
};

const shareOf = (
  tasks: readonly TaskFacts[],
  holds: (task: TaskFacts) => boolean,
): TaskShare => {
  const count = tasks.filter(holds).length;
  return { tasks: tasks.length, count, rate: tasks.length === 0 ? null : count / tasks.length };
};

/** **Rework rate** — the share of Tasks exhibiting Rework. Task grain, never session grain. */
export const reworkRate = (tasks: readonly TaskFacts[]): TaskShare =>
  shareOf(tasks, (task) => task.rework);

/** **Decomposition rate** — the share of Tasks exhibiting Decomposition. Independent of Rework. */
export const decompositionRate = (tasks: readonly TaskFacts[]): TaskShare =>
  shareOf(tasks, (task) => task.decomposition);

// --- Incomplete Task age buckets (R-M16, R-D9) ---------------------------------------------

/**
 * **The four buckets, half-open, declared once.** `toDaysExclusive` is the *exclusive* upper
 * edge and the oldest bucket has none, so the four ranges are contiguous and disjoint by
 * construction: `[0,8) [8,31) [31,91) [91,∞)`. Day 90 is the last day of `31-90` and day 91 the
 * first of `91+` — the off-by-one T-U16 exists to prevent.
 */
export const INCOMPLETE_AGE_BUCKETS = [
  { key: "0-7", label: "0–7 days", fromDays: 0, toDaysExclusive: 8 },
  { key: "8-30", label: "8–30 days", fromDays: 8, toDaysExclusive: 31 },
  { key: "31-90", label: "31–90 days", fromDays: 31, toDaysExclusive: 91 },
  { key: "91+", label: "91+ days", fromDays: 91, toDaysExclusive: null },
] as const;

/** A closed union of exactly the four buckets. There is no fifth to name. */
export type IncompleteAgeBucketKey = (typeof INCOMPLETE_AGE_BUCKETS)[number]["key"];

/** The bucket with no upper edge, so every age lands somewhere. */
const OLDEST_BUCKET = INCOMPLETE_AGE_BUCKETS[INCOMPLETE_AGE_BUCKETS.length - 1];

const MS_PER_DAY = 86_400_000;

/**
 * Whole elapsed days between two instants, floored: a Task 7 days and 23 hours old is 7 days
 * old and sits in the first bucket, exactly as a reader counting days would say.
 *
 * A `now` earlier than the Task's last session is not a fault and does not reject the report —
 * a caller may compare a fixture against an instant inside its own window. The Task's last
 * activity is then as recent as the clock allows, so it ages 0 and lands in the freshest bucket.
 */
const ageInDays = (lastSessionAt: number, now: number): number =>
  Math.max(0, Math.floor((now - lastSessionAt) / MS_PER_DAY));

/**
 * The first bucket whose exclusive edge is above the age. The search stops at the first match,
 * so no age can be counted twice; the oldest bucket has no edge, so no age can be counted
 * nowhere. Both halves of "half-open" are properties of this expression.
 */
const bucketFor = (ageDays: number): IncompleteAgeBucketKey =>
  INCOMPLETE_AGE_BUCKETS.find(
    (bucket) => bucket.toDaysExclusive !== null && ageDays < bucket.toDaysExclusive,
  )?.key ?? OLDEST_BUCKET.key;

/** One Incomplete Task, aged. No status and no threshold: an age, and the bucket it falls in. */
export type IncompleteTask = {
  readonly task_key: string;
  readonly lastSessionEndedAt: string;
  readonly ageDays: number;
  readonly bucket: IncompleteAgeBucketKey;
};

/** One bucket's count, carrying the boundaries it was counted against. */
export type IncompleteAgeBucket = {
  readonly key: IncompleteAgeBucketKey;
  readonly label: string;
  readonly fromDays: number;
  /** Exclusive; `null` on the oldest bucket, which is open-ended. */
  readonly toDaysExclusive: number | null;
  readonly count: number;
  readonly taskKeys: readonly string[];
};

/**
 * **Incomplete Task count, bucketed by age since the last session** (R-M16). All four buckets
 * are always present, including empty ones: a missing bucket reads as a rendering fault, and
 * R-D9 seeds the fixture so that none of them is empty in the product's own data.
 */
export type IncompleteTaskAges = {
  /** All four, in age order. `count` sums to `total`. */
  readonly buckets: readonly IncompleteAgeBucket[];
  readonly tasks: readonly IncompleteTask[];
  /**
   * Tasks carrying no readable instant to age from — the same rule `periods.ts` applies to a
   * row it cannot place: it lands nowhere rather than in a default bucket. The committed
   * fixture holds none, and `schema.ts` is what keeps it that way.
   */
  readonly unaged: readonly string[];
  /** Incomplete Tasks that were aged. Equal to the bucket counts summed, by construction. */
  readonly total: number;
};

/**
 * Incomplete Tasks — those with **no** accepted session — by age since their last session.
 *
 * `now` is an ISO 8601 instant, supplied by the caller (P5). Nothing here reads a clock, and an
 * unreadable `now` ages nothing rather than silently dating every Task from the epoch.
 */
export function incompleteTaskAges(
  tasks: readonly TaskFacts[],
  now: string,
): IncompleteTaskAges {
  const nowAt = instantOf(now);
  const aged: IncompleteTask[] = [];
  const unaged: string[] = [];

  for (const task of tasks) {
    if (task.completed) continue;
    const lastAt = instantOf(task.lastSessionEndedAt);
    if (nowAt === undefined || lastAt === undefined) {
      unaged.push(task.task_key);
      continue;
    }
    const ageDays = ageInDays(lastAt, nowAt);
    aged.push({
      task_key: task.task_key,
      lastSessionEndedAt: task.lastSessionEndedAt,
      ageDays,
      bucket: bucketFor(ageDays),
    });
  }

  return {
    buckets: INCOMPLETE_AGE_BUCKETS.map((bucket) => {
      const taskKeys = aged.filter((task) => task.bucket === bucket.key).map((task) => task.task_key);
      return { ...bucket, count: taskKeys.length, taskKeys };
    }),
    tasks: aged,
    unaged,
    total: aged.length,
  };
}
