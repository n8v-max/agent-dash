// R-D22 — **every implementation, refactor and bug fix is reviewed, on its own Task, by somebody
// else** (ticket 67, `CONTEXT.md` § Work, spec § 8).
//
// A review is not a session that happened to be launched with the `review` template. It is
// generated **from** the session it reviews and it carries that session's Repository and Task
// key, so `/demo/history` shows the review sitting under the Job it reviewed rather than under a
// Job of its own. Three properties hold that in place, and each of them is the answer to a
// cheaper design that was rejected:
//
//   * **A review takes a slot off the schedule; it is not appended to it.** `schedule.mts` draws
//     one to nine root sessions per human Member per workday (R-D4) and the whole of R-D4, the
//     volume ramp and `WEEKLY_SPEND_SHAPE` are properties of exactly those slots. Appending ~3,000
//     reviews on top would have doubled a Member's day and broken the range the requirement is
//     written as. So the slot population is untouched: `splitSlots` decides which of the slots
//     already drawn are reviews, and a review keeps that slot's Member and that slot's instant.
//
//   * **The reviewer is somebody else, and preferably a team mate.** The cheaper alternative —
//     the same Member reviewing their own work — was rejected because it is visibly unrealistic
//     on a history page that names people. Because the reviewer *is* the slot's Member, "somebody
//     else" is a matching constraint rather than a draw, which is why this module is a matcher.
//
//   * **The timing band is the ticket's: ten minutes to three days after the reviewed session
//     ends.** That is why the head and the tail of the window are shaped (`REVIEW_HEAD_HOURS`,
//     `REVIEW_TAIL_HOURS`): nothing has been built in the first half-day, so there is nothing to
//     review, and the last day is reviews only, so the latest Job built still has slots after it
//     to be reviewed from.
//
// **Why the matching is feasible rather than lucky.** Review slots are interleaved by rank in
// time, so their supply follows the same curve the reviewed sessions do — and it runs 1.22× as
// fast, since 22% of Jobs are reviewed twice. Demand additionally lags supply by a session's own
// duration, because a review is matched against the reviewed session's *end*. The greedy below
// therefore matches each review to a slot within hours of the Job it reviews, and the three-day
// ceiling is slack rather than a constraint that binds. `assertReviews` in `invariants.mts`
// re-checks all of it over the rows that were actually written.

import { REPO_NAMES, REVIEWED_WORK_TYPE_KEYS, type CellPlan } from "./allocation.mts";
import { repositories } from "./catalog.mts";
import { shuffled, type Rng } from "./rng.mts";
import type { Slot } from "./schedule.mts";
import {
  MADRID_OFFSET_LABEL,
  REVIEW_DELAY_SECONDS,
  REVIEW_HEAD_HOURS,
  REVIEW_TAIL_HOURS,
  WINDOW_END_DAY,
  WINDOW_START_DAY,
} from "./targets.mts";
import type { AgentSession, Member } from "./types.mts";

const HOUR_MS = 3_600_000;
const WINDOW_START_MS = Date.parse(`${WINDOW_START_DAY}T00:00:00${MADRID_OFFSET_LABEL}`);
const WINDOW_END_MS = Date.parse(`${WINDOW_END_DAY}T23:59:59${MADRID_OFFSET_LABEL}`);

/**
 * How far ahead of the earliest eligible slot the matcher will look for a **team mate** before
 * settling for any other human. Bounded on purpose: an unbounded search for the right Team would
 * hand a later demand a slot it needed, and the greedy's whole guarantee is that it never takes
 * a slot it did not have to.
 */
const TEAM_SEARCH_WIDTH = 16;

export type SlotSplit = { work: Slot[]; review: Slot[] };

/**
 * **Which of the drawn slots are reviews.** Exactly `reviewCount` of them, spread evenly through
 * the window by rank so that supply tracks the volume ramp rather than sitting in a block.
 *
 * Three rules shape the ends, and the assertion that the result is feasible is the matcher's:
 *
 *   * a **service account never reviews** — R-D22 says a *human* Member of the same Team, and a
 *     nightly runner is not one. Its slots stay work slots;
 *   * the **first `REVIEW_HEAD_HOURS`** hold no review, because no Job has been built yet;
 *   * the **last `REVIEW_TAIL_HOURS`** hold nothing else, which is what gives the last Jobs built
 *     somewhere to be reviewed from.
 *
 * It draws no random numbers. The split is a function of the slots and the plan, so it cannot
 * move anything downstream of it in the PRNG stream.
 */
export const splitSlots = (
  slots: readonly Slot[],
  members: readonly Member[],
  reviewCount: number,
): SlotSplit => {
  const human = new Set(members.filter((member) => member.kind === "human").map((m) => m.id));
  const headMs = WINDOW_START_MS + REVIEW_HEAD_HOURS * HOUR_MS;
  const tailMs = WINDOW_END_MS - REVIEW_TAIL_HOURS * HOUR_MS;
  const reviewable = (slot: Slot): boolean =>
    human.has(slot.member_id) && slot.started_at_ms >= headMs;
  const forced = slots.filter((slot) => reviewable(slot) && slot.started_at_ms > tailMs);
  const open = slots.filter((slot) => reviewable(slot) && slot.started_at_ms <= tailMs);
  const wanted = reviewCount - forced.length;
  if (wanted < 0 || wanted > open.length) {
    throw new Error(`R-D22: ${reviewCount} reviews do not fit ${open.length + forced.length} slots`);
  }
  // Bresenham over the rank: slot `i` is a review when the running quota crosses a whole unit.
  // Even in time, exact in total, and free of a draw.
  const chosen = new Set<Slot>(forced);
  for (let at = 0; at < open.length; at += 1) {
    const before = Math.floor((at * wanted) / open.length);
    const after = Math.floor(((at + 1) * wanted) / open.length);
    if (after > before) chosen.add(open[at]);
  }
  return {
    work: slots.filter((slot) => !chosen.has(slot)),
    review: slots.filter((slot) => chosen.has(slot)),
  };
};

/** One session that has something to review: a visible `implementation`, `bugfix` or `refactor`. */
export type ReviewedSession = {
  repository_id: string;
  task_key: string;
  member_id: string;
  endedAtMs: number;
};

/** A review, once it knows both ends: the slot it runs in and the session it reviews. */
export type ReviewLink = {
  slot: Slot;
  reviewed: ReviewedSession;
  accepted: boolean;
};

const teamsOf = (members: readonly Member[]): ReadonlyMap<string, readonly string[]> =>
  new Map(members.map((member) => [member.id, member.team_ids]));

/** What is known about a Job while it is being matched: who has reviewed it, and how often. */
type Held = { reviewers: string[] };

const canReview = (
  slot: Slot,
  reviewed: ReviewedSession,
  held: Held | undefined,
): boolean =>
  slot.member_id !== reviewed.member_id && !(held?.reviewers ?? []).includes(slot.member_id);

const isTeamMate = (
  teams: ReadonlyMap<string, readonly string[]>,
  left: string,
  right: string,
): boolean => {
  const mine = new Set(teams.get(left) ?? []);
  return (teams.get(right) ?? []).some((team) => mine.has(team));
};

/** The first slot starting at or after `from`, by binary search over the time-ordered slots. */
const lowerBound = (values: readonly number[], from: number): number => {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (values[middle] < from) low = middle + 1;
    else high = middle;
  }
  return low;
};

/**
 * **The state a matching pass carries**, in one value rather than in five arguments: the slots in
 * time order with their instants beside them, who is on whose Team, which slots are spoken for,
 * and who has already reviewed each Job. Both passes read and write the same board, which is
 * what makes "pass two takes what pass one left" a fact about the data rather than a convention.
 */
type Board = {
  readonly slots: readonly Slot[];
  readonly starts: readonly number[];
  readonly teams: ReadonlyMap<string, readonly string[]>;
  readonly taken: boolean[];
  readonly held: Map<ReviewedSession, Held>;
};

const boardFor = (slots: readonly Slot[], members: readonly Member[]): Board => {
  const ordered = [...slots].sort(
    (a, b) => a.started_at_ms - b.started_at_ms || a.member_id.localeCompare(b.member_id),
  );
  return {
    slots: ordered,
    starts: ordered.map((slot) => slot.started_at_ms),
    teams: teamsOf(members),
    taken: new Array<boolean>(ordered.length).fill(false),
    held: new Map<ReviewedSession, Held>(),
  };
};

const claim = (board: Board, at: number, session: ReviewedSession): ReviewLink => {
  const reviewers = board.held.get(session)?.reviewers ?? [];
  reviewers.push(board.slots[at].member_id);
  board.taken[at] = true;
  board.held.set(session, { reviewers });
  return { slot: board.slots[at], reviewed: session, accepted: false };
};

/**
 * **The earliest slot a Job could legally be reviewed from, preferring a team mate.** The search
 * stops at the first team mate, or after `TEAM_SEARCH_WIDTH` legal slots — an unbounded hunt for
 * the right Team would hand a later Job a slot it needed, and the greedy's whole guarantee is
 * that it never takes a slot it did not have to. `-1` where the band holds nothing legal.
 */
const earliestReviewerFor = (board: Board, session: ReviewedSession): number => {
  const from = session.endedAtMs + REVIEW_DELAY_SECONDS.min * 1000;
  const to = session.endedAtMs + REVIEW_DELAY_SECONDS.max * 1000;
  let first = -1;
  let seen = 0;
  for (let at = lowerBound(board.starts, from); at < board.slots.length; at += 1) {
    if (board.starts[at] > to) break;
    if (board.taken[at] || !canReview(board.slots[at], session, board.held.get(session))) continue;
    if (first === -1) first = at;
    if (isTeamMate(board.teams, session.member_id, board.slots[at].member_id)) return at;
    seen += 1;
    if (seen >= TEAM_SEARCH_WIDTH) break;
  }
  return first;
};

/**
 * **Pass one — every Job gets a reviewer.** Jobs in the order they finished; each takes the
 * earliest slot inside its band that a legal reviewer holds.
 *
 * Taking the *earliest* legal slot is what makes the pass safe rather than lucky: it never holds
 * a slot a later Job needed, so if any complete matching exists this one finds it. It runs with
 * 22% more slots than Jobs — the second reviews are pass two's business — so the ceiling on the
 * band is slack rather than a constraint that binds.
 */
const matchFirstReviews = (board: Board, reviewed: readonly ReviewedSession[]): ReviewLink[] =>
  [...reviewed]
    .sort((a, b) => a.endedAtMs - b.endedAtMs)
    .map((session) => {
      const at = earliestReviewerFor(board, session);
      if (at === -1) {
        throw new Error(
          `R-D22: no reviewer free for ${session.task_key} inside the band behind ` +
            new Date(session.endedAtMs).toISOString(),
        );
      }
      return claim(board, at, session);
    });

/** The Jobs a slot could give a *second* review to, in the three days behind it. */
type Backlog = { readonly byEnd: readonly ReviewedSession[]; readonly ends: readonly number[] };

const backlogOf = (reviewed: readonly ReviewedSession[]): Backlog => {
  const byEnd = [...reviewed].sort((a, b) => a.endedAtMs - b.endedAtMs);
  return { byEnd, ends: byEnd.map((session) => session.endedAtMs) };
};

/**
 * **The Job a leftover slot second-reviews.** Two constraints pick it, and they are the two the
 * plan is expressed in. Its Repository must still owe second reviews — `allocation.mts`
 * reconciled R-D6 and R-D7 against a review count *per Repository*, and a second review filed
 * against the wrong one moves both marginals. And its first reviewer must not be this one: a
 * second opinion from the same person is not a second opinion. Among those, the Repository with
 * the largest debt wins, so the quotas drain together rather than one at a time.
 */
const owesASecondReview = (
  board: Board,
  slot: Slot,
  session: ReviewedSession,
  debt: number,
): boolean =>
  debt > 0 &&
  board.held.get(session)?.reviewers.length === 1 &&
  canReview(slot, session, board.held.get(session));

/** Largest Repository debt first, a team mate breaking a tie. Nothing else orders candidates. */
type Candidate = { session: ReviewedSession; debt: number; mate: boolean };

const outranks = (candidate: Candidate, best: Candidate | undefined): boolean =>
  best === undefined ||
  candidate.debt > best.debt ||
  (candidate.debt === best.debt && candidate.mate && !best.mate);

const secondOpinionFor = (
  board: Board,
  backlog: Backlog,
  at: number,
  owed: ReadonlyMap<string, number>,
): ReviewedSession | undefined => {
  const slot = board.slots[at];
  const from = board.starts[at] - REVIEW_DELAY_SECONDS.max * 1000;
  const to = board.starts[at] - REVIEW_DELAY_SECONDS.min * 1000;
  let best: Candidate | undefined;
  for (let index = lowerBound(backlog.ends, from); index < backlog.byEnd.length; index += 1) {
    if (backlog.ends[index] > to) break;
    const session = backlog.byEnd[index];
    const debt = owed.get(session.repository_id) ?? 0;
    if (!owesASecondReview(board, slot, session, debt)) continue;
    const mate = isTeamMate(board.teams, session.member_id, slot.member_id);
    if (outranks({ session, debt, mate }, best)) best = { session, debt, mate };
  }
  return best?.session;
};

/**
 * **Pass two — the extra 22%, read backwards.** Every slot pass one did not take is a *second*
 * review, and it looks back over the band behind it for a Job to review. Backwards, because the
 * slot is the fixed end now: forwards it would be a Job hunting a slot already spoken for.
 */
const matchSecondReviews = (
  board: Board,
  reviewed: readonly ReviewedSession[],
  owed: Map<string, number>,
): ReviewLink[] => {
  const backlog = backlogOf(reviewed);
  const links: ReviewLink[] = [];
  for (let at = 0; at < board.slots.length; at += 1) {
    if (board.taken[at]) continue;
    const best = secondOpinionFor(board, backlog, at, owed);
    if (best === undefined) {
      throw new Error(
        `R-D22: no Job left for a second review at ${new Date(board.starts[at]).toISOString()}`,
      );
    }
    owed.set(best.repository_id, (owed.get(best.repository_id) ?? 0) - 1);
    links.push(claim(board, at, best));
  }
  return links;
};

/**
 * **How many second reviews each Repository owes.** `allocation.mts` planned a review count per
 * Repository and `enforceReviewRatio` made it at least `ceil(1.22 · reviewed)`, so the debt is
 * never negative and never more than one extra review per Job.
 */
const secondReviewDebt = (
  plan: CellPlan,
  reviewed: readonly ReviewedSession[],
): Map<string, number> => {
  const idOf = new Map(repositories.map((repository) => [repository.name, repository.id]));
  const owed = new Map<string, number>();
  for (const repo of REPO_NAMES) {
    const id = idOf.get(repo) ?? repo;
    const mine = reviewed.filter((session) => session.repository_id === id).length;
    const debt = plan.counts[repo].review - mine;
    if (debt < 0 || debt > mine) {
      throw new Error(`R-D22: ${repo} plans ${plan.counts[repo].review} reviews for ${mine} Jobs`);
    }
    owed.set(id, debt);
  }
  return owed;
};

/**
 * **R-D6 reaches the reviews through the same cell plan every other session went through.** The
 * review column's acceptance is 0.86 and each Repository's row was reconciled against it, so the
 * accepted reviews are drawn to the planned count per Repository rather than to a probability —
 * the same reason `assign.mts` drains a pool instead of tossing a coin.
 */
const settleOutcomes = (rng: Rng, plan: CellPlan, links: readonly ReviewLink[]): ReviewLink[] => {
  const idOf = new Map(repositories.map((repository) => [repository.name, repository.id]));
  const accepted = new Set<ReviewLink>();
  for (const repo of REPO_NAMES) {
    const id = idOf.get(repo);
    const mine = links.filter((link) => link.reviewed.repository_id === id);
    for (const link of shuffled(rng, mine).slice(0, plan.accepted[repo].review)) accepted.add(link);
  }
  return links.map((link) => ({ ...link, accepted: accepted.has(link) }));
};

/**
 * **Reviewed sessions → linked reviews.** Handed the visible non-review roots, the review slots
 * and the cell plan, it returns one link per review slot: which Job it reviews, who runs it and
 * whether it was accepted. `rows.mts` turns those into rows.
 *
 * Hidden rows are not reviewed. A hidden session is a platform failure the Organization is never
 * billed for and that appears in no metric (R-M2), and every one of them is a shadow of a visible
 * session on the same Task — which already carries the review.
 */
export const linkReviews = (
  rng: Rng,
  work: {
    members: readonly Member[];
    /** The visible Jobs that were built — one review each, and 22% of them a second. */
    reviewed: readonly ReviewedSession[];
    slots: readonly Slot[];
    plan: CellPlan;
  },
): ReviewLink[] => {
  const { members, reviewed, slots, plan } = work;
  const board = boardFor(slots, members);
  const owed = secondReviewDebt(plan, reviewed);
  const links = [
    ...matchFirstReviews(board, reviewed),
    ...matchSecondReviews(board, reviewed, owed),
  ];
  if (links.length !== board.slots.length) {
    throw new Error(`R-D22: ${links.length} reviews were matched to ${board.slots.length} slots`);
  }
  return settleOutcomes(rng, plan, links);
};

const REVIEWED = new Set<string>(REVIEWED_WORK_TYPE_KEYS);

/** The visible non-review roots a review can be generated from (R-D22). */
export const reviewableRows = (
  rows: readonly Omit<AgentSession, "id">[],
): ReviewedSession[] =>
  rows
    .filter((row) => !row.hidden && REVIEWED.has(row.work_type))
    .map((row) => ({
      repository_id: row.repository_id,
      task_key: row.task_key,
      member_id: row.member_id,
      endedAtMs: Date.parse(row.ended_at),
    }));
