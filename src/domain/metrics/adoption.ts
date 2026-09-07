// Adoption — tokens processed and Model mix. `CONTEXT.md` § Models & Money (TokenUsage, Token
// class, Model mix) and § Metric Concepts, `spec.md` R-M9 / R-M7 / R-M1 / A22, ADR-0007,
// ticket 26. Tested by T-U18 and T-U17.
//
// **Adoption, never cost.** R-M9: tokens processed is *"an adoption measure, never a cost
// proxy"*. There is therefore **no function in this module that turns tokens into money** — no
// rate, no rate-card parameter, no multiplication by anything priced. That is not an omission
// to be filled in later: ADR-0005 attributes Cost upstream and stores it on the session row
// (R-M4, R-T11), and ADR-0007 puts a **200×** input-price spread across the roster, so a token
// count multiplied by anything uniform would be wrong by up to two orders of magnitude. The
// divergence between volume and spend is the product's point, and it only survives if the two
// figures are computed from different things.
//
// **The four classes are disjoint, and that is what makes the sum safe.** Uncached input, cache
// read, cache write and output are summed into one figure because four numbers per model is
// more than a viewer needs; that the sum weights a cache read the same as an output token is
// accepted for the same reason. `tokensProcessed` iterates `TOKEN_CLASSES` rather than naming
// four fields, so a fifth class could not be added to the vocabulary and silently left out of
// the total. Disjointness itself is *evidenced* rather than assumed — see `disjointness`.
//
// **R-M7 / A22 — Model is a breakdown, not a comparison axis.** No function here accepts a
// Model. A session may span several Models (R-D15 puts 40% of the fixture's sessions in that
// state), so grouping or filtering a per-session metric by one would attribute the whole
// session's usage to whichever Model was named. The absence is structural and is asserted as an
// absence by the tests:
//
//   * the session-grain functions take a session and nothing else, and `SessionTokens` carries
//     no field a caller could filter on;
//   * the only Model-shaped parameter anywhere in the module is `AdoptionMix.models`, and it is
//     a **roster** — plural, a lookup table for labels, exactly as `aggregate.ts` describes its
//     own. There is no singular `model`, `model_id`, `family` or `tier` parameter to pass;
//   * and the distribution builder returns a `Distribution`, which is a breakdown of a
//     population, never a filtered figure for one Model.
//
// **Model mix is `aggregate.ts`'s, not a second copy.** `modelMix` already computes a
// distribution at exact / family / tier over token-grain entries, and this module supplies the
// one thing it deliberately leaves to its caller: the measure. Re-implementing the roll-up here
// would give the product two answers to the same question.
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

import {
  MODEL_LEVELS,
  modelMix,
  type Distribution,
  type ModelFacts,
  type ModelLevel,
} from "../aggregate";
import { TOKEN_CLASSES, type TokenClass } from "../types";

/**
 * The four raw counts. `TokenUsage` satisfies it structurally — and note what is *not* here:
 * this type is the counts alone, so every function taking it is blind to which Model produced
 * them.
 */
export type TokenCounts = Readonly<Record<TokenClass, number>>;

/** A TokenUsage row: the four counts, keyed by the Model they were consumed against. */
export type ModelTokens = TokenCounts & { readonly model_id: string };

/** The minimum a session-grain figure needs. `AgentSession` satisfies it structurally. */
export type SessionTokens = { readonly token_usage: readonly ModelTokens[] };

/**
 * **R-M9 — tokens processed: the four disjoint classes summed.**
 *
 * Driven by the vocabulary rather than by four named additions, so the sum cannot fall behind
 * `TOKEN_CLASSES`. Adoption, not cost: nothing here is priced, and see the module note.
 */
export function tokensProcessed(counts: TokenCounts): number {
  let total = 0;
  for (const tokenClass of TOKEN_CLASSES) total += counts[tokenClass];
  return total;
}

/**
 * One session's tokens, across **every** Model it spanned (R-D15). The session is the unit; the
 * Models it used are summed over rather than chosen between, which is R-M7 at the session grain.
 */
export const sessionTokensProcessed = (session: SessionTokens): number =>
  session.token_usage.reduce((running, entry) => running + tokensProcessed(entry), 0);

/**
 * A population's volume: the one figure a surface shows, plus the four behind it. The class
 * breakdown exists for R-N20.1 — the expanded history row is the only surface in the product
 * carrying class volumes, and elsewhere the four classes appear as rate-card *columns* only.
 */
export type TokenVolume = {
  /** The R-M9 figure. Equal to the four class totals summed, by construction. */
  readonly processed: number;
  readonly byClass: Readonly<Record<TokenClass, number>>;
  /** TokenUsage rows behind the figure — **not** a session count: a session may span Models. */
  readonly entries: number;
};

export function tokenVolume(entries: readonly TokenCounts[]): TokenVolume {
  // Written out rather than derived from `TOKEN_CLASSES`, because `Record<TokenClass, number>`
  // makes the compiler check the four are all here — a fifth class would fail to compile
  // instead of arriving initialised to `undefined`.
  const byClass: Record<TokenClass, number> = {
    uncached_input: 0,
    cache_read: 0,
    cache_write: 0,
    output: 0,
  };
  let processed = 0;
  for (const entry of entries) {
    for (const tokenClass of TOKEN_CLASSES) byClass[tokenClass] += entry[tokenClass];
    processed += tokensProcessed(entry);
  }
  return { processed, byClass, entries: entries.length };
}

/**
 * Evidence that the four classes really are disjoint in a body of readings (T-U18, T-F3).
 *
 * The hazard is specific and comes from ticket 02: Anthropic and Bedrock report uncached input
 * as a disjoint class, **OpenAI's `input_tokens` is a superset** that already contains the
 * cached and cache-write tokens. Summing a superset reading with its own parts double-counts,
 * and nothing about the shape of the row says which kind it is.
 *
 * What separates them is an inequality. If uncached input contained the cached classes it could
 * never be *smaller* than they are, so a row where `uncached_input < cache_read + cache_write`
 * is a **witness** that the reading is disjoint. Disjointness is reported as evidenced — no
 * negative count, and at least one witness — rather than assumed from the field names.
 */
export type Disjointness = {
  readonly entries: number;
  /** Rows carrying a negative count in any class. A count that can go below zero is not one. */
  readonly negative: number;
  /** Rows whose uncached input is smaller than the classes a superset reading would contain. */
  readonly witnesses: number;
  /** Evidenced, not assumed: nothing negative, and the superset shape ruled out at least once. */
  readonly disjoint: boolean;
};

export function disjointness(entries: readonly TokenCounts[]): Disjointness {
  let negative = 0;
  let witnesses = 0;
  for (const entry of entries) {
    if (TOKEN_CLASSES.some((tokenClass) => entry[tokenClass] < 0)) negative += 1;
    if (entry.uncached_input < entry.cache_read + entry.cache_write) witnesses += 1;
  }
  return {
    entries: entries.length,
    negative,
    witnesses,
    disjoint: negative === 0 && witnesses > 0,
  };
}

/**
 * Everything Model mix reads. **`models` is a roster, not a filter** — the table the labels are
 * looked up in, and the same parameter `aggregate.ts` documents as *"never a Model to filter or
 * group a per-session metric by"*. There is no singular Model field on this type, at any level
 * (R-M7, A22).
 */
export type AdoptionMix = {
  /** **TokenUsage-grain entries, not sessions**: a session spanning two Models is two rows. */
  readonly entries: readonly ModelTokens[];
  readonly models: readonly ModelFacts[];
};

/**
 * Model mix at one roll-up level, over tokens processed. A thin, deliberate composition: the
 * roll-up is `aggregate.ts`'s and the measure is R-M9's, so the distribution a viewer reads and
 * the "tokens processed" figure beside it are the same arithmetic.
 *
 * The measure is fixed rather than a parameter. A caller who could pass their own could pass a
 * cost measure, and a per-Model cost breakdown is precisely what R-M7 forbids.
 */
export const tokenModelMix = (input: AdoptionMix, level: ModelLevel): Distribution =>
  modelMix({ entries: input.entries, measure: tokensProcessed, models: input.models }, level);

/**
 * All three levels at once, with the partition property **derived from the results** rather
 * than declared beside them (T-U17).
 *
 * Exact → family → tier is a true partition — every Model has exactly one family and every
 * family exactly one tier — so the three levels are three groupings of one measure and carry
 * one total. `partitions` recomputes that from the slices actually returned, which is what
 * makes it an assertion about this distribution rather than a restatement of the type.
 */
export type ModelMixLevels = {
  readonly levels: Readonly<Record<ModelLevel, Distribution>>;
  /** The one figure every level carries, and the population's tokens processed. */
  readonly total: number;
  /** Every level's slices sum to `total`, and every level agrees on it. Derived, not declared. */
  readonly partitions: boolean;
};

const sumSlices = (distribution: Distribution): number =>
  distribution.slices.reduce((running, slice) => running + slice.total, 0);

export function tokenModelMixLevels(input: AdoptionMix): ModelMixLevels {
  const levels = {
    exact: tokenModelMix(input, "exact"),
    family: tokenModelMix(input, "family"),
    tier: tokenModelMix(input, "tier"),
  };
  const total = levels.exact.total;
  return {
    levels,
    total,
    partitions: MODEL_LEVELS.every(
      (level) => levels[level].total === total && sumSlices(levels[level]) === total,
    ),
  };
}
