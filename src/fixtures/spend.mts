// Money and Model mix. R-D16's headline is *derived here from ADR-0007's card and the tokens
// the generator actually emitted* — never hardcoded. Ticket 16's "~56% of token spend" was
// computed against a card ADR-0007 replaced, which is exactly the failure mode this avoids.

import { SEAT_FEE_MONTHLY_USD } from "./catalog.mts";
import { check, near, percent } from "./check.mts";
import { humanMembers } from "./people.mts";
import { tierTotals } from "./pricing.mts";
import { median, quantile, sum } from "./rng.mts";
import {
  FRONTIER_SHARE_BY_MONTH,
  MEDIAN_SESSION_COST_RANGE,
  SEAT_SHARE_RANGE,
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

export const modelMixLines = (visible: readonly AgentSession[]): string[] => {
  const totals = tierTotals(usagesOf(visible));
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
export const trendLines = (visible: readonly AgentSession[]): string[] => {
  const monthly = WINDOW_MONTHS.map((month) => {
    const rows = visible.filter((row) => row.started_at.startsWith(month));
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

// R-D4 — seat cost is ~48% of Total spend, which is the sharpest finding in the product and
// the reason the fixture is deliberately low-volume. R-M5: seats attach to `human` Members
// only, at monthly grain and coarser.
export const totalSpendLines = (visible: readonly AgentSession[]): string[] => {
  const sessionCost = sum(visible.map((row) => row.cost));
  const seatCost = humanMembers.length * SEAT_FEE_MONTHLY_USD * WINDOW_MONTHS.length;
  const share = seatCost / (seatCost + sessionCost);
  check(
    share >= SEAT_SHARE_RANGE.min && share <= SEAT_SHARE_RANGE.max,
    `R-D4: seat cost is ${percent(share)} of Total spend, outside the authored band`,
  );
  const costs = visible.map((row) => row.cost);
  const middle = median(costs);
  check(
    middle >= MEDIAN_SESSION_COST_RANGE.min && middle <= MEDIAN_SESSION_COST_RANGE.max,
    `median session cost ${middle} is outside the authored band`,
  );
  return [
    `R-D4 session Cost $${sessionCost.toFixed(2)} · seat cost $${seatCost.toFixed(2)} · seats are ${percent(
      share,
    )} of Total spend`,
    `session cost median $${middle.toFixed(2)} · p95 $${quantile(costs, 0.95).toFixed(2)}`,
  ];
};
