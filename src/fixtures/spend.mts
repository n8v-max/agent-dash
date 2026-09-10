// Money and Model mix. R-D16's headline is *derived here from ADR-0007's card and the tokens
// the generator actually emitted* — never hardcoded.
//
// **`roots` means visible root sessions carrying their children's cost and tokens** (R-M19): the
// tier shares are token-grain and a child's tokens are its root's to answer for, and the median
// session cost is the median of an *attempt*, not of an agent. Ticket 16's "~56% of token spend" was
// computed against a card ADR-0007 replaced, which is exactly the failure mode this avoids.

import { SEAT_FEE_MONTHLY_USD } from "./catalog.mts";
import { check, near, percent } from "./check.mts";
import { weeklySpendTarget, weeklySpendTolerance } from "./curve.mts";
import { humanMembers } from "./people.mts";
import { tierTotals } from "./pricing.mts";
import { median, quantile, sum } from "./rng.mts";
import { weekOfRow } from "./rows.mts";
import { WEEK_COUNT } from "./schedule.mts";
import {
  FRONTIER_SHARE_BY_MONTH,
  SEAT_SHARE_CEILING,
  TIER_TOKEN_SHARE,
} from "./targets.mts";
import type { AgentSession, ModelTier } from "./types.mts";

const TIERS: readonly ModelTier[] = ["frontier", "balanced", "fast"];
const WINDOW_MONTHS = Object.keys(FRONTIER_SHARE_BY_MONTH);

const usagesOf = (rows: readonly AgentSession[]) => rows.flatMap((row) => row.token_usage);

const shareOf = (totals: Record<ModelTier, { tokens: number; spend: number }>, field: "tokens" | "spend") => {
  const total = TIERS.reduce((acc, tier) => acc + totals[tier][field], 0);
  return Object.fromEntries(TIERS.map((tier) => [tier, totals[tier][field] / total])) as Record<
    ModelTier,
    number
  >;
};

export const modelMixLines = (roots: readonly AgentSession[]): string[] => {
  const totals = tierTotals(usagesOf(roots));
  const tokens = shareOf(totals, "tokens");
  const spend = shareOf(totals, "spend");
  // The invariant, stated as ADR-0007 states it: the frontier tier carries more token spend
  // than any other tier while holding the smallest token share.
  for (const tier of TIERS.filter((candidate) => candidate !== "frontier")) {
    check(
      spend.frontier > spend[tier],
      `R-D16: frontier token spend ${percent(spend.frontier)} does not exceed ${tier} ${percent(spend[tier])}`,
    );
    check(
      tokens.frontier < tokens[tier],
      `R-D16: frontier token share ${percent(tokens.frontier)} is not below ${tier} ${percent(tokens[tier])}`,
    );
  }
  return [
    ...TIERS.map((tier) => near(`R-D16 token share ${tier}`, tokens[tier], TIER_TOKEN_SHARE[tier], 0.02)),
    `R-D16 DERIVED token spend share: frontier ${percent(spend.frontier)} · balanced ${percent(
      spend.balanced,
    )} · fast ${percent(spend.fast)} — on ${percent(tokens.frontier)} of tokens`,
  ];
};

// R-D17 — the frontier share falls from 25% in April to 10% in August. Spend per session
// drops while session count rises: the one thing on the dashboard a reader can act on.
export const trendLines = (roots: readonly AgentSession[]): string[] => {
  const monthly = WINDOW_MONTHS.map((month) => {
    const rows = roots.filter((row) => row.started_at.startsWith(month));
    const totals = tierTotals(usagesOf(rows));
    const tokens = TIERS.reduce((acc, tier) => acc + totals[tier].tokens, 0);
    return { month, rows: rows.length, share: totals.frontier.tokens / tokens };
  });
  const lines = monthly.map(({ month, share }) =>
    near(`R-D17 frontier tokens ${month}`, share, FRONTIER_SHARE_BY_MONTH[month], 0.03),
  );
  const april = monthly[0];
  const august = monthly[monthly.length - 2];
  check(april.share - august.share >= 0.1, "R-D17: the frontier share did not fall across the window");
  check(august.rows > april.rows, "R-D17: session volume did not rise across the window");
  return lines;
};

// R-D4 — **the seat fee is a minor share of Total spend** (rewritten, ticket 66). It used to be
// the sharpest finding in the product, at ~46% of Total spend against a fixture kept deliberately
// low-volume so that it would be. At one to nine sessions per human Member per workday it is a
// minor line and the spec says so, so what is asserted here is a **ceiling** and nothing below
// it: a fixture that let seats back over a quarter of Total spend would have lost the volume.
// R-M5: seats attach to `human` Members only, at monthly grain and coarser.
export const totalSpendLines = (roots: readonly AgentSession[]): string[] => {
  const sessionCost = sum(roots.map((row) => row.cost));
  const seatCost = humanMembers.length * SEAT_FEE_MONTHLY_USD * WINDOW_MONTHS.length;
  const share = seatCost / (seatCost + sessionCost);
  check(
    share <= SEAT_SHARE_CEILING,
    `R-D4: seat cost is ${percent(share)} of Total spend, above the authored ceiling of ${percent(
      SEAT_SHARE_CEILING,
    )}`,
  );
  // The session-cost distribution is **not** asserted here. Ticket 66 deleted the authored
  // median band with the low-volume fixture that produced it; ticket 68 sets the token and cost
  // distribution, and until it does, printing the two percentiles is the honest amount to say.
  const costs = roots.map((row) => row.cost);
  return [
    `R-D4 session Cost $${sessionCost.toFixed(2)} · seat cost $${seatCost.toFixed(2)} · seats are ${percent(
      share,
    )} of Total spend`,
    `session cost median $${median(costs).toFixed(2)} · p95 $${quantile(costs, 0.95).toFixed(2)}`,
  ];
};

// R-D4 — weekly session spend follows `WEEKLY_SPEND_SHAPE` inside its band (ticket 66).
//
// Asserted here rather than inside `curve.mts` for the reason every check in this directory is
// re-asserted over the finished rows: the repair is a *proposal*, and a repair that silently did
// nothing — or that ran against a different population than the product reads — would still leave
// this failing. The population is roots carrying their children (R-M19), which is the population
// `/demo/spend`'s weekly buckets actually sum.
export const weeklySpendLines = (roots: readonly AgentSession[]): string[] => {
  const spend = new Array<number>(WEEK_COUNT).fill(0);
  for (const row of roots) spend[weekOfRow(row)] += row.cost;
  let worst = { week: 0, gap: 0 };
  for (let week = 0; week < WEEK_COUNT; week += 1) {
    const target = weeklySpendTarget(week);
    const tolerance = weeklySpendTolerance(week);
    const gap = Math.abs(spend[week] - target) / target;
    check(
      gap <= tolerance,
      `R-D4: week ${week} spent $${spend[week].toFixed(0)} against a curve of $${target.toFixed(
        0,
      )} — ${percent(gap)} off, outside its ${percent(tolerance)} band`,
    );
    if (gap > worst.gap) worst = { week, gap };
  }
  return [
    `R-D4 weekly session spend $${Math.min(...spend).toFixed(0)}–$${Math.max(...spend).toFixed(
      0,
    )} across ${WEEK_COUNT} weeks · worst departure from the curve ${percent(
      worst.gap,
    )} in week ${worst.week}`,
  ];
};
