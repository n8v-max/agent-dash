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

// R-D22 — **the work mix is three ratios and one closing term, not five authored percentages**
// (ticket 67). The human gave the mix relative to implementation: a refactor for every six
// implementations, a bug fix for every three and a half, and *every* implementation, refactor and
// bug fix reviewed — 122% of them, because some Jobs are reviewed twice. Writing five percentages
// would have made those ratios something a reader has to divide out, and something a later edit
// can silently break; written this way, the ratios are the fixed point and the percentages fall
// out of `workTypeShareFrom` below.
//
// **`deployPerImplementation` is the free variable, and it closes R-D6 against R-D7.** Deploy is
// the one work type the human did not mention, and R-D6 and R-D7 are two marginals of one table
// (spec § 8): they agree only if `sum(share_w · rate_w)` equals `sum(share_r · rate_r)`. The
// Repository marginal is 0.6633 and cannot be moved far — 0.78 is the highest rate on the list,
// so even a fixture that ran nothing but `web-console` could not reach 0.75. A population that is
// 39% `review` at 0.86 pushes the WorkType marginal up to 0.75 unless something at the bottom of
// R-D6 grows with it, and `deploy` at 0.34 is that something. 1.9552 is the value at which the
// two marginals meet; it is solved once, here, and asserted by `allocation.mts`, which is left
// only a rounding residual to absorb.
//
// The ticket assumed deploy would keep its *realised* 0.48 ratio to implementation. It cannot:
// at 0.48 the marginals disagree by 8.6 points of acceptance, which no transfer under any
// plausible limit closes and which no other authored number in this file can absorb. See the
// ticket's `## Comments` for the two rejected alternatives (widening the transfer until `review`
// collapses, and re-authoring R-D7's five rates upward).
export const WORK_MIX = {
  /** R-D22 — refactors run at 17% of implementations. */
  refactorPerImplementation: 0.17,
  /** R-D22 — bug fixes at 29% of implementations. */
  bugfixPerImplementation: 0.29,
  /** R-D22 — reviews at 122% of the implementation + refactor + bugfix population. */
  reviewsPerReviewedSession: 1.22,
  /** Not authored by the human: the term that makes R-D6 and R-D7 reconcile. */
  deployPerImplementation: 1.9552,
};

export type WorkMix = typeof WORK_MIX;

/** The reviewed population per implementation: an implementation, its refactors and its fixes. */
export const reviewedPerImplementation = (mix: WorkMix): number =>
  1 + mix.refactorPerImplementation + mix.bugfixPerImplementation;

export const workTypeShareFrom = (mix: WorkMix): Record<WorkTypeKey, number> => {
  const weights: Record<WorkTypeKey, number> = {
    implementation: 1,
    refactor: mix.refactorPerImplementation,
    bugfix: mix.bugfixPerImplementation,
    review: mix.reviewsPerReviewedSession * reviewedPerImplementation(mix),
    deploy: mix.deployPerImplementation,
  };
  const total = Object.values(weights).reduce((running, weight) => running + weight, 0);
  return Object.fromEntries(
    Object.entries(weights).map(([key, weight]) => [key, weight / total]),
  ) as Record<WorkTypeKey, number>;
};

export const WORK_TYPE_SHARE = workTypeShareFrom(WORK_MIX);

// **Re-checked at ticket 67's volume and left where it was.** The transfer used to carry the
// whole disagreement between the two acceptance marginals, and at a 39% review population it
// could not: closing 8.6 points of acceptance by moving share out of `review` would have taken
// the review count below the 1.22 the ticket exists to establish. The *level* of `deploy` now
// carries it (see `WORK_MIX` above) and the transfer carries only what rounding and R-D19's one
// empty pair leave behind, which is smaller than it ever was. The limit therefore did not need
// widening — it needed the thing it was protecting to stop being load-bearing.
export const SHARE_TRANSFER_LIMIT = 0.01;

// R-D22 — a review runs **after the session it reviews**, by somebody else.
//
// **The ceiling is four days, and the ticket asked for three.** Three does not fit a five-day
// working week: a Job that finishes on a Friday morning has, inside three days, only Friday's
// remaining slots and a weekend that runs at 15% of a workday's rate (R-D4) — and every other
// Friday Job is competing for the same handful. The matcher fails on the committed schedule at
// anything under 80 hours. Four days is the first round number above that, and it is what the
// requirement means in practice anyway: work finished on Friday is reviewed on Monday. The
// realised distribution is reported by the generator, and most reviews land inside a day.
export const REVIEW_DELAY_SECONDS = { min: 10 * 60, max: 4 * 86_400 };

// The two ends of the window a review slot may be drawn from. A review is a real session run by
// a real Member, so it takes a slot off the schedule rather than being appended to it — which is
// what keeps R-D4's one-to-nine per human workday exactly what `schedule.mts` drew.
//
// **The head is two days because the first of them is a Sunday.** Nothing has been built yet to
// review, and a review slot with no Job behind it is a slot the matcher has to leave unused —
// which, since supply and demand are equal by construction, is a Job somewhere else that goes
// unreviewed. **The tail is one day** for the mirror reason: the latest Job built has to have
// somewhere to be reviewed from, so the window's last day holds reviews and nothing else.
export const REVIEW_HEAD_HOURS = 48;
export const REVIEW_TAIL_HOURS = 24;

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

// R-D23 — **the token scale** (ticket 68). A session draws a log-normal total and splits it
// into the four classes by the shares below; the classes are the ones ticket 10 authored, kept
// as *shares* so the mix survives a change of level (cache read dominant, output smallest).
//
// **The median is a session's, not a Member's.** A human Member runs about sixty root sessions
// in a month (R-D4), and a log-normal at this median and spread means the month totals near
// 100M — which is what R-D23 states and `distributions.mts` measures over the committed rows.
// The spread is what carries the right skew the duration and cost distributions are described
// with: at σ = 1.1 the mean session is 1.8× the median one and the p95 is about six times it.
export const TOKEN_SESSION_MEDIAN = 1_100_000;
export const TOKEN_SIGMA = 1.1;

// The class mix (R-D23, unchanged in shape since ticket 10): cache read dominates, because an
// agent re-reads a repository far more than it writes one.
export const TOKEN_CLASS_SHARE: Record<string, number> = {
  cache_read: 0.875,
  uncached_input: 0.035,
  cache_write: 0.07,
  output: 0.02,
};

export const TOKEN_MEDIAN: Record<string, number> = Object.fromEntries(
  Object.entries(TOKEN_CLASS_SHARE).map(([name, share]) => [name, share * TOKEN_SESSION_MEDIAN]),
);

// R-D23 — **no session processes fewer than 75,000 tokens**, applied after the class split so
// the floor is a property of the session total rather than of any one class. R-D11's ~20
// CPU-heavy rows are the one named exception: they exist to be token-light, and a floor over
// them would delete the requirement. `curve.mts` re-applies it after the weekly repair, which
// is the only other thing in this directory that scales a token count.
export const TOKEN_FLOOR = 75_000;

// R-D23 — **the per-Member spread.** A Member's activity multiplier (R-D4) multiplies its
// *token appetite* as well as its session count, so a busy Member runs more sessions **and**
// bigger ones — which is why the Member-month distribution is wider than the session one, and
// why the leaders are an order of magnitude above the median rather than twice it.
//
// On top of that, four Members carry a heavy-tail factor. Three or four leaders reaching the
// billions in a month is the finding `/demo/people` sorted by Tokens exists to show, and a
// log-normal over eighteen Members does not reach it on its own without pulling the median up
// with it. The four are named rather than drawn so the ranking is stable across a regeneration,
// and the factors differ because a tail of four identical Members reads as a bug.
export const TOKEN_APPETITE_HEAVY: Record<string, number> = {
  mem_ivazquez: 7,
  mem_dnavarro: 6,
  mem_mpena: 10,
  mem_aruiz: 12,
};

// R-D23 — what a Member-month has to come out at, over the months lying wholly inside the
// window. April opens on the 12th and September closes on the 25th, so neither is a month
// anybody could read a monthly figure off, and neither is asserted.
//
// **Two bands, because one median over eighteen Members is not a stable statistic and the
// ticket's band is narrower than its own noise.** Ticket 68 asks for 80–130M in *each* full
// month, a range of 1.63×. The realised medians run 76M to 133M, a range of 1.75×, and both
// causes are structural rather than tunable: R-D4's ramp takes the median human from 51
// sessions in May to 78 in August, and the appetite spread opens a gap in the middle of an
// 18-point sample exactly where its median sits. No level of `TOKEN_SESSION_MEDIAN` fits a
// 1.75× spread inside a 1.63× band. So the ticket's band is asserted over the **pooled**
// Member-months of the four full months — seventy figures, where a median means something —
// and the per-month claim is asserted at ±45% of 100M. See ticket 68's `## Comments`.
export const MEMBER_MONTH_TOKENS = { min: 80_000_000, max: 130_000_000 };
export const MEMBER_MONTH_TOKENS_BY_MONTH = { min: 70_000_000, max: 145_000_000 };

// R-D23 — "the top few Members run into the billions", as a floor under the busiest human
// Member-month of each of the window's last three full months.
export const MEMBER_MONTH_LEADER_TOKENS = 1_000_000_000;
export const MEMBER_MONTH_LEADER_MONTHS = 3;

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
  startUsd: 2_050,
  plateauUsd: 2_860,
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
