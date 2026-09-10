// Every authored number the fixture is shaped to. Each carries the requirement it serves;
// nothing here is a taste call. The generator asserts against these (R-T23), so a drift
// between a target and the emitted data fails the run rather than the reader.

import type { MachineSpec, ModelTier, WorkTypeKey } from "./types.mts";

// One seed for the whole fixture. Changing it rewrites every file, which is why the
// committed output is diffed in CI (R-T21 / T-F9).
export const SEED = 20260412;

// R-D2 — 12 Apr – 25 Sep 2026 inclusive, 167 days (ticket 66). Europe/Madrid is UTC+2 across
// all of it: EU DST moved on 29 Mar 2026 and moves again on 25 Oct 2026, so no transition falls
// inside the window. `schedule.mts` verifies that against Intl rather than trusting this comment.
//
// **The window now runs past today**, which is the point of it: ticket 62 put `datasetAsOf(now)`
// at the query facade, so what is on disk is the declared window and what any surface shows is
// the part of it that has happened. 12 Apr 2026 is a Sunday, so every full week here is Sunday
// through Saturday with five workdays in it, and the last bucket (20–25 Sep) is six days long.
export const WINDOW_START_DAY = "2026-04-12";
export const WINDOW_END_DAY = "2026-09-25";
export const WINDOW_DAYS = 167;
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

// R-D4 — volume, **as a daily model per human Member** (ticket 66, replacing the weekly ramp).
//
// On a workday a Member runs `1 + Poisson(λ(t)·activity)` root sessions, capped at `cap`; on a
// weekend day `Poisson(λ(t)·activity·weekendRate)`, which is usually none. λ is a logistic in
// window fraction, so the curve is flat at both ends and steep in the middle: ~1.5 in April,
// ~3.5 by the start of August, ~4.0 at the close. That is the whole of the adoption story and
// the whole of the spend story — see `WEEKLY_SPEND_SHAPE`, which is the same logistic in dollars.
//
// `1 +` is deliberate and it is what the requirement says: a Member who is working at all runs
// **at least one** session on a workday. The floor is what makes "one to nine" a range rather
// than a ceiling over a mostly-empty calendar, and R-D10's near-idle seat is carved out of the
// result afterwards rather than modelled as a low λ, so that seat stays a person and not a
// tail of the distribution.
export const DAILY_VOLUME = {
  lambdaStart: 1.5,
  lambdaEnd: 4,
  /** Where the logistic crosses its own midpoint, as a fraction of the window. */
  midpoint: 0.5,
  /** In units of window fractions: 9 puts the flat ends inside April and inside August. */
  steepness: 9,
  weekendRate: 0.15,
  cap: 9,
  /** Spread between Members. Normalised to mean 1 over humans, so λ alone fixes the org rate. */
  memberActivitySigma: 0.5,
};

// The two service accounts **keep the weekly schedule they had before ticket 66**, scaled ×3.
// They run on a pipeline's clock rather than on a person's day: a nightly runner has no
// workday, so `1 + Poisson` per weekday would be a claim about it that is simply false. The
// ×3 is applied to the weekly mean and to the cap together, so the shape is the one they had
// and only the height moves with the rest of the fixture.
export const SERVICE_RAMP = {
  meanStart: 0.7,
  meanEnd: 2.62,
  zeroInflationStart: 0.62,
  zeroInflationEnd: 0.08,
  capStart: 3,
  capEnd: 8,
};
export const SERVICE_ACCOUNT_SCALE = 3;

// R-D8 — Rework 18% of Tasks, Decomposition 12%. Independent labels, so the overlap is the
// product; a Task carrying both runs [failed, accepted, accepted].
export const REWORK_RATE = 0.18;
export const DECOMPOSITION_RATE = 0.12;

// R-D21 — the multi-agent fan-out (ADR-0008). A share of *visible roots* spawn one to four
// children, weighted toward `implementation` and `headless`. The share is a share and not a
// probability, so `children.mts` samples without replacement and hits it exactly.
//
// **The scale band is sized for realism, not for the seat share** (rewritten, ticket 66). Until
// this ticket these numbers were argued from R-D4's ~48% seat share: a fan-out that cost what a
// root costs would have diluted that finding out of its authored band, so the child was made
// small to protect it. R-D4 no longer says that — the seat fee is now a *minor* share of Total
// spend and `SEAT_SHARE_CEILING` is a ceiling, which no plausible fan-out can breach from below.
// What is left is the honest reason, and it was always the better one: a sub-agent is handed one
// slice of its root's work, so it is small in both dimensions at once. The scale band is the
// fraction of its root's machine allocation a child holds *and* the fraction of its root's
// tokens it draws.
export const CHILD_ROOT_SHARE = 0.2;
export const CHILD_COUNT_WEIGHTS = [
  [1, 0.45],
  [2, 0.3],
  [3, 0.15],
  [4, 0.1],
] as const;
export const CHILD_WEIGHT_IMPLEMENTATION = 2.5;
export const CHILD_WEIGHT_HEADLESS = 2;
export const CHILD_SCALE = { min: 0.12, max: 0.3 };
// A child is at least two minutes long and leaves a minute clear at each end of its root, so
// "starts after the root and ends before it" is structural rather than sampled and retried.
export const CHILD_MINIMUM_SECONDS = 120;
export const CHILD_EDGE_SECONDS = 60;

// R-D12 — ~2% hidden sessions. Generated here, excluded in the data layer.
export const HIDDEN_SHARE = 0.02;

// R-D11 — ~20 CPU-heavy, token-light sessions on `compute`.
export const CPU_HEAVY_COUNT = 20;
export const CPU_HEAVY_REPOSITORIES = ["terraform-infra", "api-gateway"] as const;

// R-D10 — one human Member holds a seat against almost no usage. **Held at 3 through ticket
// 66**, which permitted it to rise to 12: at ~450 attempts for a busy peer, three is 0.7% of
// one, so the finding is sharper at 3 than at 12 and R-D10's own wording ("fewer than 5
// sessions") stays true of the data without a spec amendment nobody asked for.
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

// R-D4 — **a ceiling, not a band** (ticket 66). Until this ticket the seat fee was the sharpest
// finding in the product and the fixture was kept deliberately low-volume to protect it: seat
// cost sat at ~46% of Total spend inside an authored 44–52% band. At one to nine sessions per
// human Member per workday it is a minor line, and the spec now says so instead of pretending
// otherwise. What survives is the *direction*: a fixture that let seats back over a quarter of
// Total spend would have lost the volume this ticket exists to add, so the generator asserts a
// ceiling and nothing below it.
export const SEAT_SHARE_CEILING = 0.25;

// R-D4 — **weekly session spend as a smooth function of time.** A logistic in dollars per full
// week, sharing `DAILY_VOLUME`'s midpoint and steepness because it *is* `DAILY_VOLUME`, priced:
// spend per attempt is flat and the ramp is the volume ramp, so there is no separate price ramp
// anywhere in this directory. `startUsd` and `plateauUsd` are per **full** week; `curve.mts`
// spreads them over a week's own days, which is what keeps the six-day closing bucket honest.
//
// **The level is the fixture's own and not an arbitrary one.** Machine allocation is priced from
// the compute card and cannot be moved by a token draw, so it is a floor under every week:
// ~$1.95 of machine time per attempt, which is ~$460 in an April week before a single token is
// counted. The two figures below sit above that floor with room for a real token bill, and their
// *ratio* — 2.03 — is λ's own, which is what "more modest initially by construction of the ramp"
// means arithmetically. See the ticket 66 comments for the derivation.
export const WEEKLY_SPEND_SHAPE = {
  startUsd: 1_900,
  plateauUsd: 2_650,
  midpoint: DAILY_VOLUME.midpoint,
  steepness: DAILY_VOLUME.steepness,
};

// The tolerance around that curve. Wide while adoption is noisy and the weekly population is
// small, tight from 1 July, when "fluctuates within ±20% of its trend" is the claim the
// Projection page's method rests on. A week is early or late by the month of its **first** day.
export const WEEKLY_SPEND_BAND = {
  early: 0.4,
  late: 0.2,
  tightensOn: "2026-07-01",
  /**
   * The fraction of a week's own band at which `curve.mts` pulls it back onto the trend. Below
   * the band on purpose: the repair works on unrounded money over every row, and the assertion
   * works on whole-cent costs over roots carrying their children, so a repair aimed at the band
   * edge could land a cent outside the thing it was trying to satisfy. Three quarters also
   * leaves the fluctuation the requirement asks for — a late week may still sit 15% off its
   * trend — while making the repair something the committed data actually exercises.
   */
  repairAt: 0.75,
};
