// The measures an AgentSession accumulates as it runs: the three human-presence spans, the
// launch labels that are not dimensions (`execution_mode`, `machine_spec`), the interaction
// count, and the output artefacts.
//
// R-T12 — the three spans sum *exactly* to `machine_allocation_duration_s`. They are drawn
// in whole seconds and the total is their sum, so the identity is structural rather than
// rounded into place; the generator re-asserts it on every row anyway.

import { intBetween, logNormal, pickWeighted, type Rng } from "./rng.mts";
import { DURATION, HEADLESS_SHARE, MACHINE_SPEC_BIAS, MACHINE_SPEC_SHARE } from "./targets.mts";
import type { ArtefactKind, ExecutionMode, MachineSpec, Member, WorkTypeKey } from "./types.mts";

export type SessionShape = {
  execution_mode: ExecutionMode;
  machine_spec: MachineSpec;
  prompt_count: number;
  interactive_duration_s: number;
  idle_duration_s: number;
  afk_duration_s: number;
  machine_allocation_duration_s: number;
};

export type ShapeInput = {
  member: Member;
  repository: string;
  work_type: WorkTypeKey;
  cpu_heavy: boolean;
};

// R-D13 — the deploy account runs mostly *interactive* sessions and the nightly runner is
// headless throughout. Conflating `execution_mode` with `Member.kind` would lose exactly
// this cell.
const HEADLESS_PROBABILITY: Record<string, number> = {
  mem_deploybot: 0.2,
  mem_nightlybot: 1,
};

const SPEC_KEYS = Object.keys(MACHINE_SPEC_SHARE) as MachineSpec[];

const executionMode = (rng: Rng, input: ShapeInput): ExecutionMode => {
  if (input.cpu_heavy) return "headless";
  const probability = HEADLESS_PROBABILITY[input.member.id] ?? HEADLESS_SHARE;
  return rng() < probability ? "headless" : "interactive";
};

const machineSpec = (rng: Rng, input: ShapeInput): MachineSpec => {
  if (input.cpu_heavy) return "compute";
  const bias = MACHINE_SPEC_BIAS[input.repository] ?? {};
  return pickWeighted(
    rng,
    SPEC_KEYS.map((key) => [key, MACHINE_SPEC_SHARE[key] * (bias[key] ?? 1)] as const),
  );
};

const spanSeconds = (rng: Rng, medianS: number, factor: number): number =>
  Math.max(60, Math.round(logNormal(rng, medianS * factor, DURATION.sigma)));

// A headless session is AFK for its whole lifetime by construction and has no interactive or
// idle time at all (CONTEXT.md § Duration spans). R-D11's CPU-heavy rows are the long tail
// of that: hours of machine allocation against almost no tokens.
const spans = (rng: Rng, input: ShapeInput, mode: ExecutionMode) => {
  if (input.cpu_heavy) {
    return { interactive: 0, idle: 0, afk: intBetween(rng, 4 * 3600, 10 * 3600) };
  }
  if (mode === "headless") {
    return { interactive: 0, idle: 0, afk: spanSeconds(rng, DURATION.headlessMedianS, 1) };
  }
  const factor = input.work_type === "implementation" ? DURATION.implementationFactor : 1;
  return {
    interactive: spanSeconds(rng, DURATION.interactiveMedianS, factor),
    idle: spanSeconds(rng, DURATION.idleMedianS, factor),
    afk: spanSeconds(rng, DURATION.afkMedianS, factor),
  };
};

const promptCount = (rng: Rng, mode: ExecutionMode): number =>
  mode === "headless" ? intBetween(rng, 1, 2) : Math.max(1, Math.round(logNormal(rng, 12, 0.6)));

export const shapeSession = (rng: Rng, input: ShapeInput): SessionShape => {
  const mode = executionMode(rng, input);
  const spec = machineSpec(rng, input);
  const { interactive, idle, afk } = spans(rng, input, mode);
  return {
    execution_mode: mode,
    machine_spec: spec,
    prompt_count: promptCount(rng, mode),
    interactive_duration_s: interactive,
    idle_duration_s: idle,
    afk_duration_s: afk,
    machine_allocation_duration_s: interactive + idle + afk,
  };
};

// Only the kinds the WorkType declares (ticket 10 § Artefacts and acceptance). Output volume
// is comparable only across WorkTypes that share a kind, and that map is data — which is why
// a `review` session carries pr_comments and nothing else.
export const artefactsFor = (
  rng: Rng,
  workType: WorkTypeKey,
  accepted: boolean,
): Partial<Record<ArtefactKind, number>> => {
  if (workType === "review") {
    return { pr_comment: accepted ? intBetween(rng, 1, 14) : intBetween(rng, 0, 2) };
  }
  if (workType === "deploy") {
    return {
      commit: accepted ? intBetween(rng, 1, 3) : 0,
      pr_comment: intBetween(rng, 0, 2),
    };
  }
  const commits = accepted ? intBetween(rng, 1, 9) : intBetween(rng, 0, 3);
  const files = accepted ? intBetween(rng, 2, 24) : intBetween(rng, 0, 8);
  return {
    pull_request: accepted ? 1 : 0,
    commit: commits,
    file_changed: files,
    line_changed: files * intBetween(rng, 6, 48),
  };
};
