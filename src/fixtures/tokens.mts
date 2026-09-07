// TokenUsage per (AgentSession × Model), as four raw disjoint counts (CONTEXT.md
// § TokenUsage). Disjointness is the property that makes the display sum safe, so the four
// classes are split from one integer total and never overlap.
//
// R-D16 fixes the tier token shares and R-D17 the monthly frontier trend, and R-D16's
// derived invariant — the frontier tier carries more token spend than any other tier while
// holding the smallest token share — only holds if those shares land where they are
// authored. Models are therefore drawn at random against the month's targets and then
// *repaired* by moving whole parcels between Models until the realised shares match.
// Drawing alone drifts by a percentage point or two, and the invariant lives inside that
// drift. Assigning by size would hit the target exactly but would correlate Model with
// session size — a finding the fixture would be inventing.

import { models } from "./catalog.mts";
import { chance, largestRemainder, logNormal, pickWeighted, shuffled, sum, type Rng } from "./rng.mts";
import {
  FRONTIER_SHARE_BY_MONTH,
  MODEL_WEIGHT_WITHIN_TIER,
  MULTI_MODEL_SHARE,
  TIER_TOKEN_SHARE,
  TOKEN_MEDIAN,
  TOKEN_SIGMA,
} from "./targets.mts";
import type { ModelTier, TokenUsage } from "./types.mts";

const CLASSES = ["uncached_input", "cache_read", "cache_write", "output"] as const;
const PARCEL_WEIGHTS = [[1], [0.65, 0.35], [0.5, 0.3, 0.2]];
const REPAIR_PASSES = 600;

// R-D11 — CPU-heavy, token-light sessions burn machine time and almost no tokens.
const CPU_HEAVY_TOKEN_SCALE = 0.004;

export type SessionTokenInput = { month_key: string; cpu_heavy: boolean };

type Parcel = {
  session: number;
  month: string;
  size: number;
  counts: Record<string, number>;
  model_id: string;
};

const tierTargets = (monthKey: string): Record<ModelTier, number> => {
  const frontier = FRONTIER_SHARE_BY_MONTH[monthKey];
  if (frontier === undefined) throw new Error(`no frontier target for ${monthKey}`);
  const rest = 1 - frontier;
  const denominator = TIER_TOKEN_SHARE.balanced + TIER_TOKEN_SHARE.fast;
  return {
    frontier,
    balanced: (rest * TIER_TOKEN_SHARE.balanced) / denominator,
    fast: (rest * TIER_TOKEN_SHARE.fast) / denominator,
  };
};

// A tier's target, split across its Models by the authored within-tier weights. Repairing at
// Model grain rather than tier grain is what fixes the frontier's average price, and the
// derived spend invariant is a function of exactly that.
const modelTargets = (monthKey: string): Record<string, number> => {
  const tiers = tierTargets(monthKey);
  const entries = models.map((model) => {
    const inTier = models.filter((candidate) => candidate.tier === model.tier);
    const weight = MODEL_WEIGHT_WITHIN_TIER[model.id];
    const tierWeight = sum(inTier.map((candidate) => MODEL_WEIGHT_WITHIN_TIER[candidate.id]));
    return [model.id, (tiers[model.tier] * weight) / tierWeight] as const;
  });
  return Object.fromEntries(entries);
};

// A CPU-heavy row's token count is drawn tightly rather than from the session-wide spread:
// the requirement is "almost no tokens", and a long right tail on that draw would put some
// of these rows back among ordinary sessions, where nothing could tell them apart again.
const sessionClassTotals = (rng: Rng, cpuHeavy: boolean): Record<string, number> => {
  const spread = cpuHeavy ? 0.3 : TOKEN_SIGMA;
  const scale = logNormal(rng, 1, spread) * (cpuHeavy ? CPU_HEAVY_TOKEN_SCALE : 1);
  return Object.fromEntries(
    CLASSES.map((name) => [name, Math.round(TOKEN_MEDIAN[name] * scale * logNormal(rng, 1, 0.3))]),
  );
};

// R-D15 — 40% of sessions span two or more Models. Drawn as a set rather than a coin per
// session: R-D11's token-light rows are single-Model by construction, and a per-session coin
// would land the share below 40% without ever saying so.
const multiModelSessions = (rng: Rng, sessions: readonly SessionTokenInput[]): Set<number> => {
  const eligible = sessions
    .map((session, index) => ({ session, index }))
    .filter(({ session }) => !session.cpu_heavy)
    .map(({ index }) => index);
  const wanted = Math.round(sessions.length * MULTI_MODEL_SHARE);
  if (wanted > eligible.length) throw new Error("R-D15: too few sessions can span two Models");
  return new Set(shuffled(rng, eligible).slice(0, wanted));
};

const parcelWeights = (rng: Rng, multiModel: boolean): number[] => {
  if (!multiModel) return PARCEL_WEIGHTS[0];
  return chance(rng, 0.8) ? PARCEL_WEIGHTS[1] : PARCEL_WEIGHTS[2];
};

const drawModel = (rng: Rng, monthKey: string, used: ReadonlySet<string>): string => {
  const targets = modelTargets(monthKey);
  const candidates = models.filter((model) => !used.has(model.id));
  return pickWeighted(
    rng,
    (candidates.length > 0 ? candidates : models).map(
      (model) => [model.id, targets[model.id]] as const,
    ),
  );
};

const parcelsFor = (rng: Rng, sessions: readonly SessionTokenInput[]): Parcel[] => {
  const multi = multiModelSessions(rng, sessions);
  return sessions.flatMap((session, index) => {
    const totals = sessionClassTotals(rng, session.cpu_heavy);
    const weights = parcelWeights(rng, multi.has(index));
    const split = Object.fromEntries(
      CLASSES.map((name) => [name, largestRemainder(weights, totals[name])]),
    );
    const used = new Set<string>();
    return weights.map((_, position) => {
      const counts = Object.fromEntries(CLASSES.map((name) => [name, split[name][position]]));
      const modelId = drawModel(rng, session.month_key, used);
      used.add(modelId);
      return {
        session: index,
        month: session.month_key,
        size: sum(Object.values(counts)),
        counts,
        model_id: modelId,
      };
    });
  });
};

// One parcel moves per pass, and only if it strictly reduces the total distance from the
// month's Model shares. The residual is bounded by the smallest parcel available to move.
const repairMonth = (parcels: Parcel[], targets: Record<string, number>): void => {
  const total = Math.max(1, sum(parcels.map((parcel) => parcel.size)));
  const held: Record<string, number> = Object.fromEntries(models.map((model) => [model.id, 0]));
  for (const parcel of parcels) held[parcel.model_id] += parcel.size;
  const gap = (id: string) => held[id] / total - targets[id];
  for (let pass = 0; pass < REPAIR_PASSES; pass += 1) {
    let best: { parcel: Parcel; to: string; delta: number } | null = null;
    for (const parcel of parcels) {
      const share = parcel.size / total;
      const from = parcel.model_id;
      for (const model of models.filter((candidate) => candidate.id !== from)) {
        const delta =
          Math.abs(gap(from) - share) -
          Math.abs(gap(from)) +
          Math.abs(gap(model.id) + share) -
          Math.abs(gap(model.id));
        if (best === null || delta < best.delta) best = { parcel, to: model.id, delta };
      }
    }
    if (best === null || best.delta >= -1e-12) return;
    held[best.parcel.model_id] -= best.parcel.size;
    held[best.to] += best.parcel.size;
    best.parcel.model_id = best.to;
  }
};

// TokenUsage is keyed by (AgentSession × Model), so two parcels landing on one Model are one
// row, not two.
const usageRows = (parcels: readonly Parcel[]): TokenUsage[] => {
  const rows = new Map<string, TokenUsage>();
  for (const parcel of parcels) {
    const row = rows.get(parcel.model_id) ?? {
      model_id: parcel.model_id,
      uncached_input: 0,
      cache_read: 0,
      cache_write: 0,
      output: 0,
    };
    for (const name of CLASSES) row[name] += parcel.counts[name];
    rows.set(parcel.model_id, row);
  }
  return [...rows.values()];
};

export const planTokens = (rng: Rng, sessions: readonly SessionTokenInput[]): TokenUsage[][] => {
  const parcels = parcelsFor(rng, sessions);
  for (const month of new Set(parcels.map((parcel) => parcel.month))) {
    repairMonth(
      parcels.filter((parcel) => parcel.month === month),
      modelTargets(month),
    );
  }
  return sessions.map((_, index) =>
    usageRows(parcels.filter((parcel) => parcel.session === index)),
  );
};
