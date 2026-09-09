// AgentSession generators — ticket 51, testing-spec T-U28, T-U30, T-U32 and T-U33. Feeds the
// three properties about the session tree ADR-0008 introduced: Rework and Decomposition count
// **roots**, a root's folded cost is its own plus its children's, and the Organization's total is
// invariant to how the children are grouped under the roots.
//
// **What this module has to make reachable**, and how it does it:
//
//   * **A Task worked by several roots.** The Task pool is three keys against up to eight roots,
//     so a Task carrying two attempts — the population Rework and Decomposition are defined over —
//     is the common case rather than the tail. T-U32 counts it.
//   * **A root with children.** Every root draws 0–3 of them, so a fan-out and a lone attempt both
//     occur in almost every generated population. A generator that produced no child would leave
//     T-U32 and T-U33 asserting nothing at all — the fold would have nothing to fold.
//   * **A child that is well-formed.** It inherits the five labels of `INHERITED_LABELS`, carries
//     no `accepted`, receives no user messages, and runs strictly inside its root's window. A
//     malformed child is `childFaults`' subject and is tested there (T-U24), not here.
//
// **Costs are generated in whole cents and divided.** A stored cost is a whole number of cents,
// `rollUpSession` rounds the fold back to one, and a generator producing arbitrary binary
// fractions would test floating-point addition rather than the roll-up. The three presence spans
// sum to `machine_allocation_duration_s` on every generated row (R-T12), so the property can
// assert the identity survives the fold.
//
// Determinism (P5, R-T5): pure functions of what fast-check's seeded generator chose.

import fc from "fast-check";
import {
  EXECUTION_MODES,
  MACHINE_SPECS,
  WORK_TYPE_KEYS,
  type AgentSession,
  type ExecutionMode,
  type MachineSpec,
  type TokenUsage,
  type WorkTypeKey,
} from "../types";
import { MS_PER_DAY, instantAt } from "./periods";

/** Small on purpose: several roots landing on one Task is the whole subject of Rework. */
const TASK_KEYS = ["equilibrio/api-gateway#412", "equilibrio/web-console#88", "equilibrio/ml-scoring#7"];
const REPOSITORY_IDS = ["repo_api_gateway", "repo_web_console", "repo_ml_scoring"];
const MODEL_IDS = ["claude-sonnet-5", "gpt-5-mini", "gemini-3.1-pro-preview"];

const MS_PER_MINUTE = 60_000;
const CENTS = 100;

/** What a row measures. The only part of a session a child contributes to its root. */
type MeasureSpec = {
  readonly cents: number;
  readonly interactive: number;
  readonly idle: number;
  readonly afk: number;
  readonly usage: readonly TokenUsage[];
};

type RootSpec = MeasureSpec & {
  readonly memberPick: number;
  readonly taskPick: number;
  readonly repositoryPick: number;
  readonly workType: WorkTypeKey;
  readonly executionMode: ExecutionMode;
  readonly machineSpec: MachineSpec;
  readonly accepted: boolean;
  readonly promptCount: number;
  readonly startDay: number;
  readonly startMinute: number;
  readonly offset: number;
  /** Added to a floor of one hour, so a root's window always has room for its children. */
  readonly extraMinutes: number;
  readonly children: readonly MeasureSpec[];
};

const usageArb: fc.Arbitrary<TokenUsage> = fc.record({
  model_id: fc.constantFrom(...MODEL_IDS),
  uncached_input: fc.nat({ max: 200_000 }),
  cache_read: fc.nat({ max: 200_000 }),
  cache_write: fc.nat({ max: 200_000 }),
  output: fc.nat({ max: 200_000 }),
});

// Two entries may name the same Model, which is what `foldUsage` has to merge (R-D15).
const measureSpecArb: fc.Arbitrary<MeasureSpec> = fc.record({
  cents: fc.nat({ max: 500_000 }),
  interactive: fc.nat({ max: 7200 }),
  idle: fc.nat({ max: 7200 }),
  afk: fc.nat({ max: 7200 }),
  usage: fc.array(usageArb, { maxLength: 2 }),
});

const rootSpecArb: fc.Arbitrary<RootSpec> = fc.record({
  cents: fc.nat({ max: 500_000 }),
  interactive: fc.nat({ max: 7200 }),
  idle: fc.nat({ max: 7200 }),
  afk: fc.nat({ max: 7200 }),
  usage: fc.array(usageArb, { maxLength: 2 }),
  memberPick: fc.nat({ max: 99 }),
  taskPick: fc.nat({ max: 99 }),
  repositoryPick: fc.nat({ max: 99 }),
  workType: fc.constantFrom(...WORK_TYPE_KEYS),
  executionMode: fc.constantFrom(...EXECUTION_MODES),
  machineSpec: fc.constantFrom(...MACHINE_SPECS),
  accepted: fc.boolean(),
  promptCount: fc.nat({ max: 60 }),
  startDay: fc.integer({ min: Date.UTC(2026, 3, 12) / MS_PER_DAY, max: Date.UTC(2026, 8, 8) / MS_PER_DAY }),
  startMinute: fc.integer({ min: 0, max: 1439 }),
  offset: fc.constantFrom(-480, 0, 120, 330),
  extraMinutes: fc.nat({ max: 600 }),
  children: fc.array(measureSpecArb, { maxLength: 3 }),
});

/** The six fields a child rolls into its root, and the only ones the fold touches. */
const measuresOf = (spec: MeasureSpec) => ({
  cost: spec.cents / CENTS,
  interactive_duration_s: spec.interactive,
  idle_duration_s: spec.idle,
  afk_duration_s: spec.afk,
  // R-T12 — the three spans sum to the allocation exactly, on every generated row.
  machine_allocation_duration_s: spec.interactive + spec.idle + spec.afk,
  token_usage: [...spec.usage],
});

/** The root's own window, in milliseconds, plus the offset its timestamps are spelled with. */
type Window = { readonly startMs: number; readonly endMs: number; readonly offset: number };

const windowOf = (spec: RootSpec): Window => {
  const startMs = spec.startDay * MS_PER_DAY + spec.startMinute * MS_PER_MINUTE;
  return { startMs, endMs: startMs + (60 + spec.extraMinutes) * MS_PER_MINUTE, offset: spec.offset };
};

const rootRowOf = (spec: RootSpec, memberIds: readonly string[], index: number): AgentSession => {
  const window = windowOf(spec);
  return {
    id: `ses_root_${index}`,
    parent_session_id: null,
    started_at: instantAt(window.startMs, window.offset),
    ended_at: instantAt(window.endMs, window.offset),
    member_id: memberIds[spec.memberPick % memberIds.length],
    repository_id: REPOSITORY_IDS[spec.repositoryPick % REPOSITORY_IDS.length],
    work_type: spec.workType,
    task_key: TASK_KEYS[spec.taskPick % TASK_KEYS.length],
    execution_mode: spec.executionMode,
    machine_spec: spec.machineSpec,
    accepted: spec.accepted,
    hidden: false,
    prompt_count: spec.promptCount,
    artefacts: {},
    ...measuresOf(spec),
  };
};

/**
 * A root's children: the five inherited labels, no outcome, no user messages, and a window
 * strictly inside their root's. The root's floor of one hour is what leaves room for the nesting.
 */
const childRowsOf = (
  root: AgentSession,
  window: Window,
  specs: readonly MeasureSpec[],
): readonly AgentSession[] =>
  specs.map((spec, at) => ({
    ...root,
    id: `${root.id}_child_${at}`,
    parent_session_id: root.id,
    started_at: instantAt(window.startMs + (at + 1) * MS_PER_MINUTE, window.offset),
    ended_at: instantAt(window.endMs - MS_PER_MINUTE, window.offset),
    accepted: false,
    prompt_count: 0,
    artefacts: {},
    ...measuresOf(spec),
  }));

/**
 * A population of sessions, and the tree behind it. `sessions` is what a query is handed — roots
 * and children interleaved, exactly as `load.ts` orders them — while `roots` and `children` are
 * the answer the properties check the fold against.
 */
export type SessionTree = {
  readonly sessions: readonly AgentSession[];
  readonly roots: readonly AgentSession[];
  readonly children: readonly AgentSession[];
  /** One pick per child: the root it is re-parented to when the grouping is shuffled (T-U33). */
  readonly regroup: readonly number[];
};

const treeOf = (
  specs: readonly RootSpec[],
  memberIds: readonly string[],
  regroup: readonly number[],
): SessionTree => {
  const roots = specs.map((spec, index) => rootRowOf(spec, memberIds, index));
  const broods = specs.map((spec, index) => childRowsOf(roots[index], windowOf(spec), spec.children));
  return {
    sessions: roots.flatMap((root, index) => [root, ...broods[index]]),
    roots,
    children: broods.flat(),
    regroup,
  };
};

/** 1–8 attempts across the Member ids handed in, each fanning out to 0–3 sub-agents. */
export const sessionTreeArb = (memberIds: readonly string[]): fc.Arbitrary<SessionTree> =>
  fc.array(rootSpecArb, { minLength: 1, maxLength: 8 }).chain((specs) => {
    const childCount = specs.reduce((running, spec) => running + spec.children.length, 0);
    return fc
      .array(fc.nat({ max: 7 }), { minLength: childCount, maxLength: childCount })
      .map((regroup) => treeOf(specs, memberIds, regroup));
  });

/**
 * The same rows, with every child re-parented to whichever root its pick names. The tree is a
 * different tree; the population, and therefore the Organization's total, is the same one.
 *
 * The order is **the roots, then `tree.children` in their own order**, so a caller can line the
 * re-parented rows up against the originals by index.
 */
export const regroupChildren = (tree: SessionTree): readonly AgentSession[] => [
  ...tree.roots,
  ...tree.children.map((child, index) => ({
    ...child,
    parent_session_id: tree.roots[tree.regroup[index] % tree.roots.length].id,
  })),
];
