// The session tree, as the *generator* reads it (R-M19, R-D21, ADR-0008).
//
// It is deliberately a second implementation of `src/domain/sessions.ts` rather than an import of
// it: these modules run directly on Node 24 with no build step, and the same duplication already
// exists for Rework and Decomposition in `distributions.mts`. It earns its keep — the generator's
// assertions are only worth running if they can disagree with the application, and code that
// cannot disagree cannot catch anything.

import type { AgentSession } from "./types.mts";

export const isRoot = (row: AgentSession): boolean => row.parent_session_id === null;

/** The five labels a child inherits from its root, and may not restate differently. */
export const INHERITED_LABELS = [
  "member_id",
  "repository_id",
  "work_type",
  "task_key",
  "execution_mode",
] as const;

const CLASSES = ["uncached_input", "cache_read", "cache_write", "output"] as const;

const foldUsage = (tree: readonly AgentSession[]) => {
  const held = new Map<string, AgentSession["token_usage"][number]>();
  for (const row of tree) {
    for (const usage of row.token_usage) {
      const row = held.get(usage.model_id);
      if (row === undefined) held.set(usage.model_id, { ...usage });
      else for (const name of CLASSES) row[name] += usage[name];
    }
  }
  return [...held.values()];
};

const total = (tree: readonly AgentSession[], field: keyof AgentSession): number =>
  tree.reduce((running, row) => running + (row[field] as number), 0);

/**
 * **Rows → roots, each carrying its children's cost, tokens and duration.** This is the population
 * every distribution in `distributions.mts` and every money figure in `spend.mts` is asserted
 * over, because it is the population the product actually reads: session count means root count,
 * and a child's figures reach a total through its root.
 */
export const rootsOf = (rows: readonly AgentSession[]): AgentSession[] => {
  const children = new Map<string, AgentSession[]>();
  for (const row of rows) {
    if (isRoot(row)) continue;
    const parent = row.parent_session_id as string;
    children.set(parent, [...(children.get(parent) ?? []), row]);
  }
  return rows.filter(isRoot).map((root) => {
    const tree = [root, ...(children.get(root.id) ?? [])];
    if (tree.length === 1) return root;
    return {
      ...root,
      // Whole cents, exactly as `src/domain/sessions.ts` folds it: a stored cost is a whole
      // number of cents and so is the sum of two, and the assertions here have to be made
      // against the figure the application will actually read.
      cost: Math.round(total(tree, "cost") * 100) / 100,
      interactive_duration_s: total(tree, "interactive_duration_s"),
      idle_duration_s: total(tree, "idle_duration_s"),
      afk_duration_s: total(tree, "afk_duration_s"),
      machine_allocation_duration_s: total(tree, "machine_allocation_duration_s"),
      token_usage: foldUsage(tree),
    };
  });
};

/** How many agents worked each root: one, plus everything spawned under it. */
export const agentCounts = (rows: readonly AgentSession[]): number[] => {
  const counts = new Map<string, number>();
  for (const row of rows) if (isRoot(row)) counts.set(row.id, 1);
  for (const row of rows) {
    if (isRoot(row)) continue;
    const parent = row.parent_session_id as string;
    counts.set(parent, (counts.get(parent) ?? 0) + 1);
  }
  return [...counts.values()];
};
