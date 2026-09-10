// The (Repository × WorkType) table: how many sessions each pair holds, and how many of them
// were accepted. R-D6 and R-D7 are two marginals of one table, so they have to agree on the
// grand total — this module is where that agreement is solved rather than hoped for.

import { largestRemainder } from "./rng.mts";
import {
  ACCEPTANCE_BY_REPOSITORY,
  ACCEPTANCE_BY_WORK_TYPE,
  EMPTY_PAIRS,
  REPOSITORY_SHARE,
  SHARE_TRANSFER_LIMIT,
  WORK_MIX,
  WORK_TYPE_SHARE,
} from "./targets.mts";
import type { WorkTypeKey } from "./types.mts";

export const REPO_NAMES = Object.keys(REPOSITORY_SHARE);
export const WORK_TYPE_KEYS = Object.keys(WORK_TYPE_SHARE) as WorkTypeKey[];

/**
 * **The three WorkTypes a review is generated from** (R-D22). `implementation`, `bugfix` and
 * `refactor` share an acceptance criterion — a published pull request — so they are the three
 * that produce something to review; a `deploy` has landed on the default branch and a `review`
 * reviews nothing.
 */
export const REVIEWED_WORK_TYPE_KEYS: readonly WorkTypeKey[] = [
  "implementation",
  "bugfix",
  "refactor",
];

/**
 * The four WorkTypes a *slot* can be assigned (R-D22). A `review` is not chosen for a session:
 * it is generated from the session it reviews, takes that session's Repository and Task, and is
 * matched to a slot of its own in `reviews.mts`. `assign.mts` therefore draws from these four
 * and drains the review column nowhere.
 */
export type NonReviewWorkTypeKey = Exclude<WorkTypeKey, "review">;

export const NON_REVIEW_WORK_TYPE_KEYS = WORK_TYPE_KEYS.filter(
  (key): key is NonReviewWorkTypeKey => key !== "review",
);

export type Matrix = Record<string, Record<WorkTypeKey, number>>;

export type CellPlan = {
  counts: Matrix;
  accepted: Matrix;
  totalAccepted: number;
  workTypeShare: Record<WorkTypeKey, number>;
  transfer: number;
};

const isEmptyPair = (repo: string, workType: WorkTypeKey): boolean =>
  EMPTY_PAIRS.some(([pairRepo, pairWorkType]) => pairRepo === repo && pairWorkType === workType);

const emptyMatrix = (): Matrix =>
  Object.fromEntries(
    REPO_NAMES.map((repo) => [
      repo,
      Object.fromEntries(WORK_TYPE_KEYS.map((key) => [key, 0])) as Record<WorkTypeKey, number>,
    ]),
  );

const rowTotal = (matrix: Matrix, repo: string): number =>
  WORK_TYPE_KEYS.reduce((total, key) => total + matrix[repo][key], 0);

const columnTotal = (matrix: Matrix, workType: WorkTypeKey): number =>
  REPO_NAMES.reduce((total, repo) => total + matrix[repo][workType], 0);

/**
 * **The transfer moves share into `deploy` — R-D6's floor — out of the other four in proportion**
 * (rewritten, ticket 67). It used to move share between `review` and `deploy`, the two ends of
 * R-D6, which was safe while `review` was 12% of the population and no ratio was stated over it.
 * R-D22 states three, and `review` is now the largest column: a transfer that took share out of
 * `review` alone would move `reviews / (implementation + refactor + bugfix)` off 1.22 by
 * whatever the residual happened to be.
 *
 * Scaling the other four together leaves **every ratio among them exactly where R-D22 authored
 * it**, at any transfer. What the transfer buys is the same thing it always bought: the last
 * fraction of a point between the two acceptance marginals, once rounding and R-D19's empty pair
 * have had their say. The bulk of the disagreement is closed by `WORK_MIX.deployPerImplementation`
 * before this function is ever called.
 */
const shareWithTransfer = (transfer: number): Record<WorkTypeKey, number> => {
  const deploy = WORK_TYPE_SHARE.deploy + transfer;
  const scale = (1 - deploy) / (1 - WORK_TYPE_SHARE.deploy);
  return Object.fromEntries(
    WORK_TYPE_KEYS.map((key) => [key, key === "deploy" ? deploy : WORK_TYPE_SHARE[key] * scale]),
  ) as Record<WorkTypeKey, number>;
};

const reviewedIn = (counts: Matrix, repo: string): number =>
  REVIEWED_WORK_TYPE_KEYS.reduce((total, key) => total + counts[repo][key], 0);

/**
 * **R-D22 as an integer property, not a rounded one.** Every implementation, refactor and bug fix
 * is reviewed and 22% of them twice, so a Repository's review count has to be at least
 * `ceil(1.22 · reviewed)` — otherwise the second reviews run out before the quota does and one
 * Job in the repository goes unreviewed. Largest-remainder rounding leaves the column a session
 * short about as often as it leaves it a session long, so the shortfall is repaired here rather
 * than discovered three stages downstream.
 *
 * The session comes out of the largest column that is not itself reviewed — `deploy` everywhere
 * but `mobile-app`, whose deploys ship through the app stores (R-D19). There the donor is
 * `implementation`, which closes the gap from both ends at once.
 */
const enforceReviewRatio = (counts: Matrix, repo: string): void => {
  const donor: WorkTypeKey = isEmptyPair(repo, "deploy") ? "implementation" : "deploy";
  for (let guard = 0; guard < 20; guard += 1) {
    const wanted = Math.ceil(WORK_MIX.reviewsPerReviewedSession * reviewedIn(counts, repo));
    if (counts[repo].review >= wanted) return;
    if (counts[repo][donor] <= 0) throw new Error(`R-D22: no room to review ${repo}`);
    counts[repo][donor] -= 1;
    counts[repo].review += 1;
  }
  throw new Error(`R-D22: the review quota for ${repo} did not settle`);
};

const cellCounts = (total: number, workTypeShare: Record<WorkTypeKey, number>): Matrix => {
  const counts = emptyMatrix();
  const rowTotals = largestRemainder(
    REPO_NAMES.map((repo) => REPOSITORY_SHARE[repo]),
    total,
  );
  REPO_NAMES.forEach((repo, index) => {
    const allowed = WORK_TYPE_KEYS.filter((key) => !isEmptyPair(repo, key));
    const split = largestRemainder(
      allowed.map((key) => workTypeShare[key]),
      rowTotals[index],
    );
    allowed.forEach((key, position) => {
      counts[repo][key] = split[position];
    });
    enforceReviewRatio(counts, repo);
  });
  return counts;
};

const rowTargets = (counts: Matrix): Record<string, number> =>
  Object.fromEntries(
    REPO_NAMES.map((repo) => [
      repo,
      Math.round(rowTotal(counts, repo) * ACCEPTANCE_BY_REPOSITORY[repo]),
    ]),
  );

const columnTargets = (counts: Matrix): Record<WorkTypeKey, number> =>
  Object.fromEntries(
    WORK_TYPE_KEYS.map((key) => [
      key,
      Math.round(columnTotal(counts, key) * ACCEPTANCE_BY_WORK_TYPE[key]),
    ]),
  ) as Record<WorkTypeKey, number>;

const totalOf = (targets: Record<string, number>): number =>
  Object.values(targets).reduce((total, value) => total + value, 0);

// Search the transfer that makes the two marginals agree exactly. The analytic solution
// ignores rounding and the authored empty pair; the grid picks the nearest value that
// survives both. Stepping by 0.0002 keeps the chosen transfer inside SHARE_TRANSFER_LIMIT.
const solveTransfer = (total: number): { transfer: number; gap: number } => {
  let best = { transfer: 0, gap: Number.POSITIVE_INFINITY };
  for (let step = -200; step <= 200; step += 1) {
    const transfer = step * 0.0002;
    const counts = cellCounts(total, shareWithTransfer(transfer));
    const gap = Math.abs(totalOf(rowTargets(counts)) - totalOf(columnTargets(counts)));
    if (gap < best.gap || (gap === best.gap && Math.abs(transfer) < Math.abs(best.transfer))) {
      best = { transfer, gap };
    }
  }
  return best;
};

/**
 * **No cell is unanimous.** A (Repository × WorkType) pair whose every session was accepted is a
 * number the product would print as `100%`, and nothing in the world it imitates accepts
 * everything. R-D7's spread makes that reachable: `web-console` has to average 0.78 while
 * carrying a `deploy` column at 0.34, which pushes every other cell in the row against its own
 * count. The ceiling is the count less one, which costs the fit nothing — a row's targets sit
 * hundreds of sessions below the sum of its ceilings — and takes the flat `100%` off the surface.
 */
const ceilings = (counts: Matrix): Matrix => {
  const room = emptyMatrix();
  for (const repo of REPO_NAMES) {
    for (const key of WORK_TYPE_KEYS) room[repo][key] = Math.max(0, counts[repo][key] - 1);
  }
  return room;
};

// Raking (iterative proportional fitting) with a per-cell ceiling. It lands on the matrix
// of the form a_r · b_w · N[r][w] that satisfies both marginals — the smooth interaction,
// rather than a greedy repair that would push one cell to 100% accepted and leave a
// visible artefact in the data.
const rake = (
  cells: { counts: Matrix; room: Matrix },
  rows: Record<string, number>,
  columns: Record<WorkTypeKey, number>,
  grandRate: number,
): Matrix => {
  const { counts, room } = cells;
  const fitted = emptyMatrix();
  for (const repo of REPO_NAMES) {
    for (const key of WORK_TYPE_KEYS) fitted[repo][key] = counts[repo][key] * grandRate;
  }
  for (let pass = 0; pass < 200; pass += 1) {
    for (const repo of REPO_NAMES) {
      const scale = rows[repo] / Math.max(1e-9, rowTotal(fitted, repo));
      for (const key of WORK_TYPE_KEYS) {
        fitted[repo][key] = Math.min(room[repo][key], fitted[repo][key] * scale);
      }
    }
    for (const key of WORK_TYPE_KEYS) {
      const scale = columns[key] / Math.max(1e-9, columnTotal(fitted, key));
      for (const repo of REPO_NAMES) {
        fitted[repo][key] = Math.min(room[repo][key], fitted[repo][key] * scale);
      }
    }
  }
  return fitted;
};

// Round each row to its exact target, never past the cell's own session count.
const roundRow = (room: Matrix, fitted: Matrix, repo: string, target: number): void => {
  const floors = WORK_TYPE_KEYS.map((key) => Math.floor(fitted[repo][key]));
  const order = [...WORK_TYPE_KEYS]
    .map((key, index) => ({ key, index, fraction: fitted[repo][key] - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  WORK_TYPE_KEYS.forEach((key, index) => {
    fitted[repo][key] = floors[index];
  });
  let remaining = target - floors.reduce((total, value) => total + value, 0);
  while (remaining > 0) {
    const next = order.find(({ key }) => fitted[repo][key] < room[repo][key]);
    if (next === undefined) throw new Error(`R-D7: no room left in ${repo}`);
    fitted[repo][next.key] += 1;
    order.splice(order.indexOf(next), 1);
    order.push(next);
    remaining -= 1;
  }
  while (remaining < 0) {
    const next = order.find(({ key }) => fitted[repo][key] > 0);
    if (next === undefined) throw new Error(`R-D7: nothing left to remove from ${repo}`);
    fitted[repo][next.key] -= 1;
    order.splice(order.indexOf(next), 1);
    order.push(next);
    remaining += 1;
  }
};

// Column repair moves an accepted session between two WorkTypes *inside one Repository*, so
// the Repository marginal fixed above is preserved while the WorkType marginal converges.
const fixColumns = (
  room: Matrix,
  accepted: Matrix,
  targets: Record<WorkTypeKey, number>,
): void => {
  for (let guard = 0; guard < 5000; guard += 1) {
    const gaps = WORK_TYPE_KEYS.map((key) => targets[key] - columnTotal(accepted, key));
    const shortIndex = gaps.findIndex((gap) => gap > 0);
    if (shortIndex === -1) return;
    const longIndex = gaps.findIndex((gap) => gap < 0);
    const short = WORK_TYPE_KEYS[shortIndex];
    const long = WORK_TYPE_KEYS[longIndex];
    const repo = REPO_NAMES.find(
      (name) => accepted[name][short] < room[name][short] && accepted[name][long] > 0,
    );
    if (repo === undefined) throw new Error(`R-D6: cannot move an accepted session to ${short}`);
    accepted[repo][short] += 1;
    accepted[repo][long] -= 1;
  }
  throw new Error("R-D6: column repair did not converge");
};

export const planCells = (total: number): CellPlan => {
  const { transfer, gap } = solveTransfer(total);
  if (Math.abs(transfer) > SHARE_TRANSFER_LIMIT) {
    throw new Error(`share transfer ${transfer} exceeds the authored limit`);
  }
  if (gap !== 0) throw new Error(`acceptance marginals disagree by ${gap} sessions`);
  const workTypeShare = shareWithTransfer(transfer);
  const counts = cellCounts(total, workTypeShare);
  const rows = rowTargets(counts);
  const columns = columnTargets(counts);
  const totalAccepted = totalOf(columns);
  const room = ceilings(counts);
  const accepted = rake({ counts, room }, rows, columns, totalAccepted / total);
  for (const repo of REPO_NAMES) roundRow(room, accepted, repo, rows[repo]);
  fixColumns(room, accepted, columns);
  return { counts, accepted, totalAccepted, workTypeShare, transfer };
};

/** How many sessions of one WorkType the plan holds, across every Repository. */
export const plannedCount = (plan: CellPlan, workType: WorkTypeKey): number =>
  columnTotal(plan.counts, workType);
