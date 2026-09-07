// R-T22 / ADR-0005 — the generator holds both rate cards and prices every session. This is
// the only pricing code in the repository: the application reads the attributed `cost` and
// prices nothing (R-M4 / R-T11).

import { computeRates, modelById, tokenRates } from "./catalog.mts";
import type { MachineSpec, ModelTier, TokenUsage } from "./types.mts";

const PER_MILLION = 1_000_000;

const tokenRateFor = (modelId: string) => {
  const rate = tokenRates.find((entry) => entry.model_id === modelId);
  if (rate === undefined) throw new Error(`no token rate for model ${modelId}`);
  return rate;
};

const computeRateFor = (spec: MachineSpec): number => {
  const rate = computeRates.find((entry) => entry.machine_spec === spec);
  if (rate === undefined) throw new Error(`no compute rate for ${spec}`);
  return rate.usd_per_hour;
};

export const priceTokenUsage = (usage: TokenUsage): number => {
  const rate = tokenRateFor(usage.model_id);
  const dollars =
    usage.uncached_input * rate.uncached_input +
    usage.cache_read * rate.cache_read +
    usage.cache_write * rate.cache_write +
    usage.output * rate.output;
  return dollars / PER_MILLION;
};

export const priceMachineAllocation = (spec: MachineSpec, durationS: number): number =>
  (computeRateFor(spec) * durationS) / 3600;

// Token cost plus machine cost, blended into the one figure a session presents (CONTEXT.md
// § Cost). Rounded to cents because it is a billed amount, not a measurement.
export const priceSession = (
  usages: readonly TokenUsage[],
  spec: MachineSpec,
  durationS: number,
): number => {
  const tokens = usages.reduce((total, usage) => total + priceTokenUsage(usage), 0);
  return Math.round((tokens + priceMachineAllocation(spec, durationS)) * 100) / 100;
};

export const tokenTotal = (usage: TokenUsage): number =>
  usage.uncached_input + usage.cache_read + usage.cache_write + usage.output;

// R-D16 — the frontier share of token *spend* is derived from the card and the realised
// tokens, never hardcoded. Ticket 16's "~56%" was computed against a card ADR-0007 replaced.
export const tierTotals = (
  usages: readonly TokenUsage[],
): Record<ModelTier, { tokens: number; spend: number }> => {
  const totals: Record<ModelTier, { tokens: number; spend: number }> = {
    frontier: { tokens: 0, spend: 0 },
    balanced: { tokens: 0, spend: 0 },
    fast: { tokens: 0, spend: 0 },
  };
  for (const usage of usages) {
    const bucket = totals[modelById(usage.model_id).tier];
    bucket.tokens += tokenTotal(usage);
    bucket.spend += priceTokenUsage(usage);
  }
  return totals;
};
