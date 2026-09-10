// TokenUsage per (AgentSession × Model), as four raw disjoint counts (CONTEXT.md
// § TokenUsage). Disjointness is the property that makes the display sum safe, so the four
// classes are split from one integer total and never overlap.
//
// **R-D17 fixes the roster's presence month by month, and R-D16 falls out of it** (rewritten,
// ticket 70). `FAMILY_SHARE_BY_MONTH` is the authored thing — Haiku fading, Sonnet handing over
// to itself, Fable and Astra arriving — and the tier shares are *derived* from it and the
// roster. R-D16's invariant, that the frontier tier carries more token spend than any other
// while holding the smallest token share, only holds if the family shares land where they are
// authored. Models are therefore drawn at random against the month's targets and then
// *repaired* by moving whole parcels between Models until the realised shares match.
// Drawing alone drifts by a percentage point or two, and the invariant lives inside that
// drift. Assigning by size would hit the target exactly but would correlate Model with
// session size — a finding the fixture would be inventing.
//
// **R-D23 fixes the level, the floor and the spread** (ticket 68). The session total is drawn
// log-normal at `TOKEN_SESSION_MEDIAN` and σ = `TOKEN_SIGMA`, multiplied by the drawing
// Member's *appetite* — its R-D4 activity multiplier, times a heavy-tail factor if it is one of
// the four leaders — and then held to `TOKEN_FLOOR` after the class split. None of that touches
// which Model a parcel lands on, so R-D16 and R-D17 are the same claims over a bigger spread.

import { models } from "./catalog.mts";
import { chance, largestRemainder, logNormal, pickWeighted, shuffled, sum, type Rng } from "./rng.mts";
import {
  FAMILY_SHARE_BY_MONTH,
  GPT_5_NANO_WITHIN_FAMILY,
  MULTI_MODEL_SHARE,
  SONNET_4_6_WITHIN_FAMILY,
  TOKEN_FLOOR,
  TOKEN_MEDIAN,
  TOKEN_SIGMA,
  WINDOW_MONTHS,
  type ModelFamily,
} from "./targets.mts";
import type { ModelTier, TokenUsage } from "./types.mts";

const CLASSES = ["uncached_input", "cache_read", "cache_write", "output"] as const;
const PARCEL_WEIGHTS = [[1], [0.65, 0.35], [0.5, 0.3, 0.2]];
const REPAIR_PASSES = 600;

// R-D11 — CPU-heavy, token-light sessions burn machine time and almost no tokens.
const CPU_HEAVY_TOKEN_SCALE = 0.004;

/**
 * What a session brings to its own token draw. `appetite` is R-D23's per-Member multiplier —
 * the same activity multiplier R-D4's schedule drew, times the heavy-tail factor a leader
 * carries — so a busy Member's sessions are bigger as well as more numerous.
 */
export type SessionTokenInput = { month_key: string; cpu_heavy: boolean; appetite: number };

type Parcel = {
  session: number;
  month: string;
  size: number;
  counts: Record<string, number>;
  model_id: string;
};

const monthIndex = (monthKey: string): number => {
  const at = WINDOW_MONTHS.indexOf(monthKey as (typeof WINDOW_MONTHS)[number]);
  if (at === -1) throw new Error(`no family share target for ${monthKey}`);
  return at;
};

/**
 * **A model's share of its own family, in one month** (R-D17, ticket 70).
 *
 * Six of the eight families hold one model and take all of it. The two that hold two are the
 * whole reason the family level and the exact level say different things: `Claude Sonnet` is
 * flat while 4.6 hands over to 5, and `OpenAI GPT-5` divides evenly between a `fast` model and
 * a `balanced` one, which is what puts one family across two tiers.
 */
const withinFamily = (modelId: string, month: number): number => {
  if (modelId === "claude-sonnet-4-6") return SONNET_4_6_WITHIN_FAMILY[month];
  if (modelId === "claude-sonnet-5") return 1 - SONNET_4_6_WITHIN_FAMILY[month];
  if (modelId === "gpt-5-nano") return GPT_5_NANO_WITHIN_FAMILY;
  if (modelId === "gpt-5.2") return 1 - GPT_5_NANO_WITHIN_FAMILY;
  return 1;
};

/**
 * A month's target share for every Model on the roster — the family table, split within each
 * family. Repairing at Model grain rather than family or tier grain is what fixes the frontier's
 * average price, and R-D16's derived spend invariant is a function of exactly that.
 */
export const modelTargets = (monthKey: string): Record<string, number> => {
  const month = monthIndex(monthKey);
  const shares = FAMILY_SHARE_BY_MONTH[monthKey];
  return Object.fromEntries(
    models.map((model) => [
      model.id,
      shares[model.family as ModelFamily] * withinFamily(model.id, month),
    ]),
  );
};

/**
 * **R-D16's tier shares, derived rather than authored** (ticket 70). `TIER_TOKEN_SHARE` was a
 * target until this ticket; it is now a consequence of which *families* a month reached for,
 * which is the direction the causation actually runs in. `spend.mts` asserts the realised shares
 * against these and asserts the invariant over the emitted tokens.
 */
export const tierTargets = (monthKey: string): Record<ModelTier, number> => {
  const targets = modelTargets(monthKey);
  const totals: Record<ModelTier, number> = { frontier: 0, balanced: 0, fast: 0 };
  for (const model of models) totals[model.tier] += targets[model.id];
  return totals;
};

/**
 * **R-D23's floor, applied after the class split.** A session that drew fewer than
 * `TOKEN_FLOOR` tokens across its four classes is raised to exactly the floor, keeping the
 * proportions it drew: the requirement is about the *session*, so a per-class floor would both
 * miss it (four small classes still sum below 75K) and distort the mix (R-D16 reads class and
 * tier shares off these counts).
 *
 * Largest-remainder rather than a multiply-and-round, so the raised counts sum to the floor
 * exactly and the four classes stay whole and disjoint (T-F3).
 */
export const raisedToFloor = (counts: Record<string, number>): Record<string, number> => {
  const drawn = CLASSES.map((name) => counts[name]);
  const total = sum(drawn);
  if (total >= TOKEN_FLOOR) return counts;
  const weights = total > 0 ? drawn : CLASSES.map((name) => TOKEN_MEDIAN[name]);
  const raised = largestRemainder(weights, TOKEN_FLOOR);
  return Object.fromEntries(CLASSES.map((name, at) => [name, raised[at]]));
};

/** Every token a session drew, across its Models — the quantity R-D23's floor is stated over. */
export const sessionTokens = (usages: readonly TokenUsage[]): number =>
  sum(usages.flatMap((usage) => CLASSES.map((name) => usage[name])));

/**
 * The same floor, applied to a session's **written** rows rather than to its draw.
 *
 * `curve.mts` scales a week's token draws to pull its spend onto R-D4's curve, and a scale below
 * one could take a session that drew 80K under the floor. Raising it back keeps R-D23 a property
 * of the fixture rather than of the order two repairs happen to run in; the proportions across
 * Models and classes are the ones the row already had, so no share this directory asserts moves.
 */
export const usagesRaisedToFloor = (usages: readonly TokenUsage[]): TokenUsage[] => {
  const cells = usages.flatMap((usage) => CLASSES.map((name) => usage[name]));
  const total = sum(cells);
  if (total >= TOKEN_FLOOR || total === 0) return usages.map((usage) => ({ ...usage }));
  const raised = largestRemainder(cells, TOKEN_FLOOR);
  return usages.map((usage, index) => ({
    model_id: usage.model_id,
    ...(Object.fromEntries(
      CLASSES.map((name, at) => [name, raised[index * CLASSES.length + at]]),
    ) as Record<(typeof CLASSES)[number], number>),
  }));
};

// A CPU-heavy row's token count is drawn tightly rather than from the session-wide spread:
// the requirement is "almost no tokens", and a long right tail on that draw would put some
// of these rows back among ordinary sessions, where nothing could tell them apart again.
//
// **Neither R-D23's appetite nor its floor reaches these rows** (R-D11). They are the named
// exception: multiplying a leader's appetite into one would push it over
// `CPU_HEAVY_TOKEN_CEILING` and out of the population that requirement counts, and flooring it
// at 75K would delete "token-light" outright.
const sessionClassTotals = (
  rng: Rng,
  cpuHeavy: boolean,
  appetite: number,
): Record<string, number> => {
  const spread = cpuHeavy ? 0.3 : TOKEN_SIGMA;
  const scale =
    logNormal(rng, 1, spread) * (cpuHeavy ? CPU_HEAVY_TOKEN_SCALE : appetite);
  const drawn = Object.fromEntries(
    CLASSES.map((name) => [name, Math.round(TOKEN_MEDIAN[name] * scale * logNormal(rng, 1, 0.3))]),
  );
  return cpuHeavy ? drawn : raisedToFloor(drawn);
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
    const totals = sessionClassTotals(rng, session.cpu_heavy, session.appetite);
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
