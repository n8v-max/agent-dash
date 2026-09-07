// Every authored number the fixture is shaped to. Each carries the requirement it serves;
// nothing here is a taste call. The generator asserts against these (R-T23), so a drift
// between a target and the emitted data fails the run rather than the reader.

import type { MachineSpec, ModelTier, WorkTypeKey } from "./types.mts";

// One seed for the whole fixture. Changing it rewrites every file, which is why the
// committed output is diffed in CI (R-T21 / T-F9).
export const SEED = 20260412;

// R-D2 — 12 Apr – 8 Sep 2026 inclusive, 150 days. Europe/Madrid is UTC+2 across all of it:
// EU DST moved on 29 Mar 2026 and moves again on 25 Oct 2026, so no transition falls inside
// the window. `schedule.mts` verifies that against Intl rather than trusting this comment.
export const WINDOW_START_DAY = "2026-04-12";
export const WINDOW_END_DAY = "2026-09-08";
export const WINDOW_DAYS = 150;
export const MADRID_OFFSET_MINUTES = 120;
export const MADRID_OFFSET_LABEL = "+02:00";

// R-D6 — acceptance rate by WorkType.
export const ACCEPTANCE_BY_WORK_TYPE: Record<WorkTypeKey, number> = {
  review: 0.86,
  bugfix: 0.79,
  implementation: 0.71,
  refactor: 0.58,
  deploy: 0.34,
};

// R-D7 — acceptance rate by Repository.
export const ACCEPTANCE_BY_REPOSITORY: Record<string, number> = {
  "web-console": 0.78,
  "mobile-app": 0.7,
  "api-gateway": 0.62,
  "ml-scoring": 0.55,
  "terraform-infra": 0.44,
};

// Session volume shares. The two acceptance marginals above are marginals of one table, so
// they have to agree on the grand total: sum(share_r · rate_r) must equal sum(share_w · rate_w).
// The repository shares and four of the five WorkType shares are authored; `allocation.mts`
// transfers a small slice of share between `review` (0.86) and `deploy` (0.34) to close the
// residual, and asserts the transfer stays under TRANSFER_LIMIT so the authored mix survives.
export const REPOSITORY_SHARE: Record<string, number> = {
  "web-console": 0.32,
  "mobile-app": 0.24,
  "api-gateway": 0.21,
  "ml-scoring": 0.13,
  "terraform-infra": 0.1,
};

export const WORK_TYPE_SHARE: Record<WorkTypeKey, number> = {
  implementation: 0.3,
  bugfix: 0.2,
  refactor: 0.18,
  review: 0.12,
  deploy: 0.2,
};

export const SHARE_TRANSFER_LIMIT = 0.01;

// R-D19 — the one authored empty pair. Mobile releases ship through the app stores, not
// through the platform's deploy template, so `mobile-app__deploy.json` holds []. Its
// existence is what makes "a missing file is a fault" a testable claim (T-F1).
export const EMPTY_PAIRS: readonly (readonly [string, WorkTypeKey])[] = [["mobile-app", "deploy"]];

// R-D4 — the adoption ramp, per Member per week: median 0 sessions in April rising to 2 in
// August, max 3 rising to 8. Zero-inflation is what holds the April median at 0 while the
// mean is already above it.
export const RAMP = {
  meanStart: 0.7,
  meanEnd: 2.62,
  zeroInflationStart: 0.62,
  zeroInflationEnd: 0.08,
  capStart: 3,
  capEnd: 8,
  memberActivitySigma: 0.5,
};

// R-D8 — Rework 18% of Tasks, Decomposition 12%. Independent labels, so the overlap is the
// product; a Task carrying both runs [failed, accepted, accepted].
export const REWORK_RATE = 0.18;
export const DECOMPOSITION_RATE = 0.12;

// R-D12 — ~2% hidden sessions. Generated here, excluded in the data layer.
export const HIDDEN_SHARE = 0.02;

// R-D11 — ~20 CPU-heavy, token-light sessions on `compute`.
export const CPU_HEAVY_COUNT = 20;
export const CPU_HEAVY_REPOSITORIES = ["terraform-infra", "api-gateway"] as const;

// R-D10 — one human Member holds a seat against almost no usage.
export const LOW_USAGE_MEMBER_ID = "mem_ngallego";
export const LOW_USAGE_SESSIONS = 3;

// R-D16 — token share by tier. R-D17 — the frontier share falls month by month. The monthly
// targets are volume-weighted to land the whole-window frontier share on 15%.
export const TIER_TOKEN_SHARE: Record<ModelTier, number> = {
  balanced: 0.55,
  fast: 0.3,
  frontier: 0.15,
};

export const FRONTIER_SHARE_BY_MONTH: Record<string, number> = {
  "2026-04": 0.25,
  "2026-05": 0.22,
  "2026-06": 0.18,
  "2026-07": 0.14,
  "2026-08": 0.1,
  "2026-09": 0.1,
};

// Within-tier model weights. Frontier leans on `gpt-6-astra` because it is the model a team
// reaches for when it reaches past `balanced` at all — and that lean is what makes the
// derived invariant (frontier carries the most spend on the smallest token share) true of
// this card rather than of a hoped-for one. The generator derives the share and asserts it.
export const MODEL_WEIGHT_WITHIN_TIER: Record<string, number> = {
  "gpt-6-astra": 0.7,
  "claude-opus-5": 0.3,
  "claude-sonnet-5": 0.58,
  "gemini-3.1-pro-preview": 0.42,
  "claude-haiku-4-5": 0.35,
  "gemini-3.5-flash-lite": 0.4,
  "gpt-5-nano": 0.25,
};

// R-D15 — 40% of sessions span two or more Models.
export const MULTI_MODEL_SHARE = 0.4;

// Session token medians (ticket 10 § Session shape), and the spread that carries the
// right-skew the duration and cost distributions are described with.
export const TOKEN_MEDIAN: Record<string, number> = {
  cache_read: 2_500_000,
  uncached_input: 100_000,
  cache_write: 200_000,
  output: 60_000,
};
export const TOKEN_SIGMA = 1.2;

// ticket 10 § Session shape. Interactive: 40 / 30 / 38 minutes at the median. Headless is
// AFK for its whole lifetime by construction (CONTEXT.md § Duration spans).
export const DURATION = {
  interactiveMedianS: 40 * 60,
  idleMedianS: 30 * 60,
  afkMedianS: 38 * 60,
  headlessMedianS: 150 * 60,
  sigma: 0.55,
  implementationFactor: 1.7,
};

export const HEADLESS_SHARE = 0.3;

export const MACHINE_SPEC_SHARE: Record<MachineSpec, number> = {
  general: 0.6,
  compute: 0.15,
  memory: 0.15,
  storage: 0.1,
};

// `machine_spec` correlates with the repository rather than being noise (ticket 10).
export const MACHINE_SPEC_BIAS: Record<string, Partial<Record<MachineSpec, number>>> = {
  "ml-scoring": { memory: 4 },
  "terraform-infra": { compute: 4 },
  "api-gateway": { compute: 2.5 },
  "web-console": { general: 1.4 },
  "mobile-app": { storage: 1.6 },
};

// R-D4 — seat cost is ~48% of Total spend. That is the sharpest finding in the product, so
// the generator asserts the realised share rather than hoping for it.
export const SEAT_SHARE_RANGE = { min: 0.44, max: 0.52 };
export const MEDIAN_SESSION_COST_RANGE = { min: 2.4, max: 4.2 };
