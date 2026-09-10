// Money and Model mix. **Nothing about the mix is hardcoded here**: the family table is the
// authored thing (`targets.mts`), the tier shares are derived from it and the roster, and
// R-D16's spend headline is priced from ADR-0011's card against the tokens the generator
// actually emitted.
//
// **`roots` means visible root sessions carrying their children's cost and tokens** (R-M19): the
// tier shares are token-grain and a child's tokens are its root's to answer for, and the median
// session cost is the median of an *attempt*, not of an agent. Ticket 16's "~56% of token spend" was
// computed against a card ADR-0007 replaced, which is exactly the failure mode this avoids.

import { modelById, SEAT_FEE_MONTHLY_USD } from "./catalog.mts";
import { check, near, percent } from "./check.mts";
import { weeklySpendTarget, weeklySpendTolerance } from "./curve.mts";
import { humanMembers } from "./people.mts";
import { tierTotals, tokenTotal } from "./pricing.mts";
import { median, quantile, sum } from "./rng.mts";
import { weekOfRow } from "./rows.mts";
import { WEEK_COUNT } from "./schedule.mts";
import {
  FAMILY_SHARE_POINTS,
  FAMILY_SHARE_TOLERANCE,
  FRONTIER_TOKEN_SHARE_BAND,
  MODEL_FAMILIES,
  SEAT_SHARE_CEILING,
  VENDOR_SHARE_TOLERANCE,
  VENDOR_TOKEN_SHARE,
  WINDOW_MONTHS,
} from "./targets.mts";
import { tierTargets } from "./tokens.mts";
import type { AgentSession, ModelTier, TokenUsage } from "./types.mts";

const TIERS: readonly ModelTier[] = ["frontier", "balanced", "fast"];

const usagesOf = (rows: readonly AgentSession[]) => rows.flatMap((row) => row.token_usage);

const monthRows = (rows: readonly AgentSession[], month: string): AgentSession[] =>
  rows.filter((row) => row.started_at.startsWith(month));

const shareOf = (totals: Record<ModelTier, { tokens: number; spend: number }>, field: "tokens" | "spend") => {
  const total = TIERS.reduce((acc, tier) => acc + totals[tier][field], 0);
  return Object.fromEntries(TIERS.map((tier) => [tier, totals[tier][field] / total])) as Record<
    ModelTier,
    number
  >;
};

const tokensOf = (usages: readonly TokenUsage[]): number =>
  sum(usages.map((usage) => tokenTotal(usage)));

/** A month's token totals, keyed however the caller groups a Model. */
const shareByKey = (
  usages: readonly TokenUsage[],
  keyOf: (modelId: string) => string,
): Record<string, number> => {
  const held: Record<string, number> = {};
  for (const usage of usages) {
    const key = keyOf(usage.model_id);
    held[key] = (held[key] ?? 0) + tokenTotal(usage);
  }
  const total = Math.max(1, sum(Object.values(held)));
  return Object.fromEntries(Object.entries(held).map(([key, value]) => [key, value / total]));
};

const familyOf = (modelId: string): string => modelById(modelId).family;
const vendorOf = (modelId: string): string => modelById(modelId).vendor;

/**
 * **R-D17 — the family table, asserted month by month against the figures the human authored**
 * (ticket 70), and R-D16's vendor split over the whole window.
 *
 * The monthly assertion is against `FAMILY_SHARE_POINTS` — the authored numbers — rather than
 * against the normalised table the generator draws from, so the ±2 points absorbs the
 * normalisation as well as the draw. Three of the six authored rows sum to 99 and normalising
 * them moves no family by more than 0.3 of a point.
 */
export const familyMixLines = (roots: readonly AgentSession[]): string[] => {
  const lines: string[] = [];
  for (const month of WINDOW_MONTHS) {
    const shares = shareByKey(usagesOf(monthRows(roots, month)), familyOf);
    for (const family of MODEL_FAMILIES) {
      const authored = FAMILY_SHARE_POINTS[family][WINDOW_MONTHS.indexOf(month)] / 100;
      check(
        Math.abs((shares[family] ?? 0) - authored) <= FAMILY_SHARE_TOLERANCE,
        `R-D17: ${family} holds ${percent(shares[family] ?? 0)} of ${month}'s tokens ` +
          `against an authored ${percent(authored)}`,
      );
    }
    lines.push(
      `R-D17 ${month} ${MODEL_FAMILIES.map(
        (family) => `${family} ${percent(shares[family] ?? 0)}`,
      ).join(" · ")}`,
    );
  }

  const vendors = shareByKey(usagesOf(roots), vendorOf);
  for (const [vendor, target] of Object.entries(VENDOR_TOKEN_SHARE)) {
    check(
      Math.abs((vendors[vendor] ?? 0) - target) <= VENDOR_SHARE_TOLERANCE,
      `R-D16: ${vendor} holds ${percent(vendors[vendor] ?? 0)} of the window's tokens against a target of ${percent(target)}`,
    );
  }
  lines.push(
    `R-D16 vendor token share ${Object.keys(VENDOR_TOKEN_SHARE)
      .map((vendor) => `${vendor} ${percent(vendors[vendor] ?? 0)}`)
      .join(" · ")}`,
  );
  return lines;
};

/**
 * **R-D16 — the tier shares are derived from the family table, and the invariant is asserted
 * over what was emitted** (rewritten, ticket 70).
 *
 * There is no authored tier target any more: `tierTargets` reads `FAMILY_SHARE_BY_MONTH` and the
 * roster, so a tier share is a consequence of which families a month reached for. What survives
 * as a *claim* is ADR-0007's invariant — the frontier tier carries more token spend than any
 * other tier while holding the smallest token share — and it is checked against the tokens the
 * generator actually wrote, priced from the card, never hardcoded.
 */
export const modelMixLines = (roots: readonly AgentSession[]): string[] => {
  const usages = usagesOf(roots);
  const totals = tierTotals(usages);
  const tokens = shareOf(totals, "tokens");
  const spend = shareOf(totals, "spend");
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
  for (const month of ["window", ...WINDOW_MONTHS]) {
    const share =
      month === "window"
        ? tokens.frontier
        : (() => {
            const totals = tierTotals(usagesOf(monthRows(roots, month)));
            return (
              totals.frontier.tokens /
              TIERS.reduce((acc, tier) => acc + totals[tier].tokens, 0)
            );
          })();
    check(
      share >= FRONTIER_TOKEN_SHARE_BAND.min && share <= FRONTIER_TOKEN_SHARE_BAND.max,
      `R-D16: frontier holds ${percent(share)} of ${month}'s tokens, outside the ${percent(
        FRONTIER_TOKEN_SHARE_BAND.min,
      )}–${percent(FRONTIER_TOKEN_SHARE_BAND.max)} band the family table implies`,
    );
  }
  // The derived target, month by month, so a drift between the table and the draw fails here.
  const derived = TIERS.map((tier) => {
    const weighted = WINDOW_MONTHS.map((month) => {
      const rows = monthRows(roots, month);
      return { share: tierTargets(month)[tier], tokens: tokensOf(usagesOf(rows)) };
    });
    const total = sum(weighted.map((entry) => entry.tokens));
    return [tier, sum(weighted.map((entry) => entry.share * entry.tokens)) / total] as const;
  });
  return [
    ...derived.map(([tier, target]) =>
      near(`R-D16 DERIVED token share ${tier}`, tokens[tier], target, 0.02),
    ),
    `R-D16 DERIVED token spend share: frontier ${percent(spend.frontier)} · balanced ${percent(
      spend.balanced,
    )} · fast ${percent(spend.fast)} — on ${percent(tokens.frontier)} of tokens`,
  ];
};

// **R-D17 — the frontier tier *rises* late in the window** (rewritten, ticket 70). It fell, from
// 25% to 10%, while the roster stopped at `gpt-6-astra` and `claude-opus-5`. With `claude-fable-
// 5-1` arriving in June and Astra growing through the summer it rises instead, and the
// optimisation story moves to `Claude Haiku`, whose share falls from 28 points to 10 as the
// balanced models get good enough to be the default. Both halves are asserted.
export const trendLines = (roots: readonly AgentSession[]): string[] => {
  const monthly = WINDOW_MONTHS.map((month) => {
    const rows = monthRows(roots, month);
    const usages = usagesOf(rows);
    const totals = tierTotals(usages);
    const tokens = TIERS.reduce((acc, tier) => acc + totals[tier].tokens, 0);
    const haiku = sum(
      usages.filter((usage) => usage.model_id === "claude-haiku-4-5").map(tokenTotal),
    );
    return {
      month,
      rows: rows.length,
      frontier: totals.frontier.tokens / tokens,
      haiku: haiku / tokens,
    };
  });
  const april = monthly[0];
  const september = monthly[monthly.length - 1];
  for (const [at, entry] of monthly.entries()) {
    if (at === 0) continue;
    check(
      entry.frontier > monthly[at - 1].frontier,
      `R-D17: the frontier share did not rise from ${monthly[at - 1].month} to ${entry.month}`,
    );
  }
  check(
    september.frontier - april.frontier >= 0.1,
    `R-D17: the frontier share did not rise across the window (${percent(april.frontier)} → ${percent(
      september.frontier,
    )})`,
  );
  check(
    april.haiku - september.haiku >= 0.1,
    `R-D17: Claude Haiku did not fade across the window (${percent(april.haiku)} → ${percent(
      september.haiku,
    )})`,
  );
  check(september.rows > april.rows, "R-D17: session volume did not rise across the window");
  return monthly.map(
    ({ month, frontier, haiku }) =>
      `R-D17 ${month} frontier ${percent(frontier)} · Claude Haiku ${percent(haiku)}`,
  );
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
