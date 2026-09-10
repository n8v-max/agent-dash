// R-D4 — **weekly session spend as a smooth function of time** (ticket 66).
//
// The requirement is that weekly session cost reads as a trend rather than as noise: modest and
// unsettled from April, rising, and from July fluctuating inside ±20% of its own curve. Before
// this ticket adjacent weeks ran 54 → 373 → 135, which is not a trend anybody could draw a line
// through, and the Projection page's method (`domain/metrics/projection.ts`) rests on there
// being one.
//
// **The curve is the volume curve, priced.** `WEEKLY_SPEND_SHAPE` shares `DAILY_VOLUME`'s
// midpoint and steepness on purpose, and there is no separate price ramp anywhere in this
// directory. It is *shallower* than the volume curve — 1.39 against λ's 2.03 — and the whole of
// the difference is R-D17: the frontier tier's token share falls from 25% to 10% across the
// window against a 200× price spread (ADR-0007), so the average priced token gets cheaper as
// the sessions get more numerous. That is R-D17's own sentence, priced.
//
// **What the repair may move, and what it may not.** It scales a week's **token draws** and
// re-prices from them. It never moves a session between weeks: the schedule is R-D4's other
// half and the acceptance marginals, the Task shapes and the fan-out are all arrangements of
// exactly those slots. And it cannot reach below the week's **machine** bill, which is priced
// from the compute card against allocations this module does not own — roughly $1.95 of machine
// time per attempt, which is a hard floor under every week's target.
//
// **The repair is a trim, not a fit.** A week inside three quarters of its band is left exactly
// as it was drawn, so the fluctuation the requirement asks for is the fixture's own — late weeks
// still sit up to 14% off the trend on the committed data. Only a week beyond that is pulled
// onto the curve, and `spend.mts` then asserts the **full** band over the population the product
// reads, independently of this module having run. See `WEEKLY_SPEND_BAND.repairAt` for why the
// two thresholds are not the same number.

import { check, percent } from "./check.mts";
import { isCpuHeavy } from "./predicates.mts";
import { priceMachineAllocation, priceSession, priceTokenUsage } from "./pricing.mts";
import { sum } from "./rng.mts";
import { dayOfRow } from "./rows.mts";
import {
  dayIso,
  dayVolumeWeight,
  daysOfWeek,
  FULL_WEEK_WEIGHT,
  WEEK_COUNT,
  weekOfDay,
} from "./schedule.mts";
import { WEEKLY_SPEND_BAND, WEEKLY_SPEND_SHAPE, WINDOW_DAYS } from "./targets.mts";
import { usagesRaisedToFloor } from "./tokens.mts";
import { isRoot } from "./tree.mts";
import type { AgentSession, TokenClass } from "./types.mts";

const CLASSES: readonly TokenClass[] = ["uncached_input", "cache_read", "cache_write", "output"];

/**
 * The trend, in dollars, at one day. `startUsd` and `plateauUsd` are quoted per **full** week and
 * spread over the week's days by `dayVolumeWeight`, so a weekend day carries 15% of a workday and
 * the closing six-day bucket — which still holds five workdays — is targeted at 97% of a full
 * week rather than at six sevenths of one.
 */
const dailyTargetUsd = (dayIndex: number): number => {
  const t = dayIndex / (WINDOW_DAYS - 1);
  const { startUsd, plateauUsd, midpoint, steepness } = WEEKLY_SPEND_SHAPE;
  const perFullWeek =
    startUsd + (plateauUsd - startUsd) / (1 + Math.exp(-steepness * (t - midpoint)));
  return (perFullWeek * dayVolumeWeight(dayIndex)) / FULL_WEEK_WEIGHT;
};

/** The curve's value for a whole bucket — the sum of its own days, never a seven-day assumption. */
export const weeklySpendTarget = (week: number): number =>
  sum(daysOfWeek(week).map(dailyTargetUsd));

/** ±40% while adoption is noisy, ±20% from 1 July. A week is dated by its **first** day. */
export const weeklySpendTolerance = (week: number): number =>
  dayIso(week * 7) < WEEKLY_SPEND_BAND.tightensOn
    ? WEEKLY_SPEND_BAND.early
    : WEEKLY_SPEND_BAND.late;

/**
 * Every row's week, keyed by its **root's** day. A child may start after midnight and a child is
 * not an attempt: the week a fan-out's cost belongs to is the week the attempt was launched in,
 * which is the same rule ADR-0009 § 4 gives for the day grain.
 */
const weekOfRows = (rows: readonly AgentSession[]): Map<string, number> => {
  const byRoot = new Map<string, number>();
  for (const row of rows) if (isRoot(row)) byRoot.set(row.id, weekOfDay(dayOfRow(row)));
  return new Map(
    rows.map((row) => [row.id, byRoot.get(row.parent_session_id ?? row.id) as number]),
  );
};

/** The unrounded money a set of rows carries, split into what a token draw can move and what it cannot. */
const moneyOf = (rows: readonly AgentSession[]) => ({
  machine: sum(
    rows.map((row) => priceMachineAllocation(row.machine_spec, row.machine_allocation_duration_s)),
  ),
  tokens: sum(rows.map((row) => sum(row.token_usage.map(priceTokenUsage)))),
});

/**
 * One row's token draw, scaled and re-priced — and then held to R-D23's floor.
 *
 * The floor is re-applied here because a scale below one can take a session that drew 80K under
 * 75K, and R-D23 is a claim about the fixture rather than about the order two repairs ran in.
 * It reaches exactly the rows the draw floored: an **attempt** that is not one of R-D11's
 * token-light rows. A child is not an attempt — it holds a fraction of its root's draw by
 * construction (R-D21) — and a CPU-heavy row is the named exception.
 */
const rescale = (row: AgentSession, scale: number): void => {
  const floored = isRoot(row) && !isCpuHeavy(row);
  const scaled = row.token_usage.map((usage) => ({
    model_id: usage.model_id,
    ...(Object.fromEntries(
      CLASSES.map((name) => [name, Math.max(0, Math.round(usage[name] * scale))]),
    ) as Record<TokenClass, number>),
  }));
  row.token_usage = floored ? usagesRaisedToFloor(scaled) : scaled;
  row.cost = priceSession(row.token_usage, row.machine_spec, row.machine_allocation_duration_s);
};

/**
 * **The repair.** Mutates the rows of any week that drifted past `repairAt` of its band, scaling
 * that week's token draws until the week lands on the curve, and re-pricing from them.
 *
 * Scaling is uniform inside the week, so it moves no Model's share of that week's tokens and
 * therefore neither R-D16's tier shares nor R-D17's monthly frontier trend — both of which are
 * shares of a month's own tokens, and a month is a set of weeks each scaled as a whole.
 * Hidden rows are scaled with the visible ones they sit among, so a hidden row stays
 * indistinguishable from the row it is meant to look like (R-D12).
 */
export const repairWeeklySpend = (rows: readonly AgentSession[]): string[] => {
  const week = weekOfRows(rows);
  const scales: number[] = [];
  let repaired = 0;
  for (let bucket = 0; bucket < WEEK_COUNT; bucket += 1) {
    const mine = rows.filter((row) => week.get(row.id) === bucket);
    const { machine, tokens } = moneyOf(mine.filter((row) => !row.hidden));
    const target = weeklySpendTarget(bucket);
    const tolerance = weeklySpendTolerance(bucket) * WEEKLY_SPEND_BAND.repairAt;
    if (Math.abs(machine + tokens - target) <= tolerance * target) continue;
    check(
      tokens > 0,
      `R-D4: week ${bucket} drew no tokens, so its spend cannot be repaired toward the curve`,
    );
    const scale = (target - machine) / tokens;
    // A scale outside this range is not a repair, it is a differently shaped fixture. The floor
    // is the one that bites: below it the week's machine bill alone has overrun the curve, and
    // the answer is a different `WEEKLY_SPEND_SHAPE`, not smaller token draws.
    check(
      scale >= 0.2 && scale <= 5,
      `R-D4: week ${bucket} needs a token scale of ${scale.toFixed(3)} to reach $${target.toFixed(
        0,
      )}; its machine bill alone is $${machine.toFixed(0)}`,
    );
    for (const row of mine) rescale(row, scale);
    scales.push(scale);
    repaired += 1;
  }
  return [
    `R-D4 weekly spend repaired in ${repaired} of ${WEEK_COUNT} weeks` +
      (repaired === 0
        ? ""
        : ` · token scale ${Math.min(...scales).toFixed(2)}–${Math.max(...scales).toFixed(2)}`),
    `R-D4 curve $${weeklySpendTarget(0).toFixed(0)}/week at the open → $${weeklySpendTarget(
      WEEK_COUNT - 1,
    ).toFixed(0)} at the close · band ${percent(WEEKLY_SPEND_BAND.early)} to ${dayIso(0)
      .slice(0, 7)}, ${percent(WEEKLY_SPEND_BAND.late)} from ${WEEKLY_SPEND_BAND.tightensOn}`,
  ];
};
