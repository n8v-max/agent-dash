// T-U18 — tokens processed, and T-U17 — Model mix at three roll-up levels (`testing-spec.md`
// § 3.2, `spec.md` R-M9, R-M7, A22, ADR-0007), ticket 26.
//
// These are pure unit tests: `src/domain/**` may not reach the data layer (R-T5), so every
// count below is authored inline and every expectation is exact — token counts are integers, so
// nothing here needs a floating-point tolerance. The same claims are re-asserted against the
// committed fixture in `src/data/adoption.fixture.test.ts` (P6), where 40% of sessions really do
// span two or more Models (R-D15).
//
// **Two absences are asserted here rather than hoped for.**
//
//   1. *No query function accepts a Model* (R-M7, A22). Asserted at **compile time**: the
//      `NamesAModel` helper below resolves to `true` for any parameter list carrying a
//      Model-shaped field, and every exported function of this module is pinned to `false`
//      through a `satisfies` clause that `pnpm typecheck` evaluates — so growing a `model_id`
//      parameter breaks the build rather than a test's wording. The helper is controlled
//      against a type that *does* name one, so the pins cannot pass vacuously.
//   2. *No function turns tokens into money* (R-M9). There is no rate, no rate-card parameter
//      and no price in the module's surface, and the last describe walks it to say so.

import { describe, expect, it } from "vitest";
import type { ModelFacts } from "../aggregate";
import type { TokenClass } from "../types";
import * as adoptionModule from "./adoption";
import {
  disjointness,
  sessionTokensProcessed,
  tokenModelMix,
  tokenModelMixLevels,
  tokenVolume,
  tokensProcessed,
  type AdoptionMix,
  type ModelTokens,
  type TokenCounts,
} from "./adoption";

// --- The compile-time absence (R-M7, A22) --------------------------------------------------

/**
 * The names a Model would arrive under. `models` is deliberately **not** here: a roster to look
 * labels up in is what `aggregate.ts` already takes and is not a Model to filter or group by.
 * The singular forms are, and so are the two roll-up labels, because filtering on `tier` would
 * attribute a multi-Model session's usage just as unsoundly as filtering on an id.
 */
type ModelNaming = "model" | "model_id" | "modelId" | "modelIds" | "family" | "tier";

/** True when a type carries a field a caller could pass a Model in. */
type NamesModelField<T> = [Extract<keyof T, ModelNaming>] extends [never] ? false : true;

/** True when any parameter in the list does. */
type NamesAModel<Args extends readonly unknown[]> = Args extends readonly [infer Head, ...infer Tail]
  ? NamesModelField<Head> extends true
    ? true
    : NamesAModel<Tail>
  : false;

type QueryNamesAModel<Query extends (...args: never[]) => unknown> = NamesAModel<Parameters<Query>>;

/**
 * The pins. Each value is a **type**, evaluated by `tsc`: growing a Model-shaped parameter on
 * any of these functions makes the annotation unsatisfiable and breaks the build. They are
 * gathered into a record so the test below asserts over the *set* rather than comparing a
 * literal with itself.
 */
const NAMES_A_MODEL_BY_QUERY: Readonly<Record<string, boolean>> = {
  tokensProcessed: false satisfies QueryNamesAModel<typeof tokensProcessed>,
  sessionTokensProcessed: false satisfies QueryNamesAModel<typeof sessionTokensProcessed>,
  tokenVolume: false satisfies QueryNamesAModel<typeof tokenVolume>,
  disjointness: false satisfies QueryNamesAModel<typeof disjointness>,
  // Including the distribution builder: its only Model-shaped parameter is the roster.
  tokenModelMix: false satisfies QueryNamesAModel<typeof tokenModelMix>,
  tokenModelMixLevels: false satisfies QueryNamesAModel<typeof tokenModelMixLevels>,
};

/**
 * The control, on the same helper. Without it the pins above could pass by the helper never
 * detecting anything — and the roster's exemption is stated here rather than assumed: it is a
 * plural lookup table, never one Model.
 */
const HELPER_DETECTS: Readonly<Record<string, boolean>> = {
  "a model_id parameter": true satisfies NamesAModel<[{ readonly model_id: string }]>,
  "a tier parameter": true satisfies NamesAModel<
    [{ readonly rows: readonly number[] }, { readonly tier: string }]
  >,
  "the roster is a list": true satisfies (AdoptionMix["models"] extends readonly unknown[]
    ? true
    : false),
};

// --- Fixtures authored inline --------------------------------------------------------------

const counts = (
  uncachedInput: number,
  cacheRead: number,
  cacheWrite: number,
  output: number,
): TokenCounts => ({
  uncached_input: uncachedInput,
  cache_read: cacheRead,
  cache_write: cacheWrite,
  output,
});

const entry = (modelId: string, of: TokenCounts): ModelTokens => ({ model_id: modelId, ...of });

/** ADR-0007's roster, at the three labels this module reads it at. */
const MODELS: readonly ModelFacts[] = [
  { id: "gpt-6-astra", family: "OpenAI GPT-6 Astra", tier: "frontier" },
  { id: "claude-opus-5", family: "Claude Opus", tier: "frontier" },
  { id: "claude-sonnet-5", family: "Claude Sonnet", tier: "balanced" },
  { id: "gemini-3.1-pro-preview", family: "Gemini Pro", tier: "balanced" },
  { id: "claude-haiku-4-5", family: "Claude Haiku", tier: "fast" },
  { id: "gemini-3.5-flash-lite", family: "Gemini Flash-Lite", tier: "fast" },
  { id: "gpt-5-nano", family: "OpenAI GPT-5 nano", tier: "fast" },
];

/**
 * A session spanning two Models — the R-D15 case. 1 + 20 + 300 + 4000 = 4321 on one Model and
 * 10 + 200 + 3000 + 40000 = 43210 on the other; 47531 for the session.
 */
const MULTI_MODEL_SESSION = {
  token_usage: [
    entry("claude-sonnet-5", counts(1, 20, 300, 4000)),
    entry("gpt-5-nano", counts(10, 200, 3000, 40_000)),
  ],
};

describe("T-U18 — tokens processed is the four disjoint classes summed (R-M9)", () => {
  it("sums all four, and weights a cache read exactly as it weights an output token", () => {
    expect(tokensProcessed(counts(1, 20, 300, 4000))).toBe(4321);
    // The accepted consequence, stated as a test: 1000 cache reads and 1000 output tokens are
    // the same adoption figure. `CONTEXT.md` accepts this because volume is not spend.
    expect(tokensProcessed(counts(0, 1000, 0, 0))).toBe(tokensProcessed(counts(0, 0, 0, 1000)));
  });

  it("drops no class — removing any one of the four changes the figure", () => {
    const full = counts(1, 20, 300, 4000);
    const classes: readonly TokenClass[] = ["uncached_input", "cache_read", "cache_write", "output"];
    for (const tokenClass of classes) {
      expect(tokensProcessed({ ...full, [tokenClass]: 0 })).toBeLessThan(tokensProcessed(full));
    }
  });

  it("sums a session across every Model it spanned, never one of them (R-D15, R-M7)", () => {
    expect(sessionTokensProcessed(MULTI_MODEL_SESSION)).toBe(47_531);
    // Neither Model's own figure is the session's: attributing the session to one would
    // understate it by the other, which is exactly what R-M7 forbids.
    expect(sessionTokensProcessed(MULTI_MODEL_SESSION)).not.toBe(4321);
    expect(sessionTokensProcessed(MULTI_MODEL_SESSION)).not.toBe(43_210);
    expect(sessionTokensProcessed({ token_usage: [] })).toBe(0);
  });

  it("reports the volume and the four class totals behind it as one arithmetic", () => {
    const volume = tokenVolume([counts(1, 20, 300, 4000), counts(10, 200, 3000, 40_000)]);
    expect(volume).toEqual({
      processed: 47_531,
      byClass: { uncached_input: 11, cache_read: 220, cache_write: 3300, output: 44_000 },
      entries: 2,
    });
    const summed = Object.values(volume.byClass).reduce((running, value) => running + value, 0);
    expect(summed).toBe(volume.processed);
    expect(tokenVolume([])).toEqual({
      processed: 0,
      byClass: { uncached_input: 0, cache_read: 0, cache_write: 0, output: 0 },
      entries: 0,
    });
  });
});

describe("T-U18 — disjointness is what makes the sum safe (ticket 02, T-F3)", () => {
  it("finds a witness in a reading where uncached input is smaller than the cached classes", () => {
    // The Anthropic/Bedrock shape: uncached input is its own class, so it may be smaller than
    // the cache traffic. A superset reading could never be.
    const result = disjointness([counts(100, 5000, 400, 900)]);
    expect(result).toEqual({ entries: 1, negative: 0, witnesses: 1, disjoint: true });
  });

  it("declines to call a body of readings disjoint when nothing rules the superset shape out", () => {
    // OpenAI's `input_tokens` is a superset that already contains the cached and cache-write
    // tokens; every row of such a reading has uncached_input >= cache_read + cache_write.
    // Summing it with its own parts double-counts, and nothing but the inequality says so.
    const supersetShaped = disjointness([counts(6000, 5000, 400, 900), counts(700, 100, 200, 50)]);
    expect(supersetShaped.witnesses).toBe(0);
    expect(supersetShaped.disjoint).toBe(false);
    expect(disjointness([]).disjoint).toBe(false);
  });

  it("refuses a negative count outright, however many witnesses stand beside it", () => {
    const result = disjointness([counts(100, 5000, 400, 900), counts(-1, 5000, 400, 900)]);
    expect(result.witnesses).toBe(2);
    expect(result.negative).toBe(1);
    expect(result.disjoint).toBe(false);
  });
});

describe("T-U17 — Model mix is a distribution at exact / family / tier (R-M7)", () => {
  const entries: readonly ModelTokens[] = [
    entry("gpt-6-astra", counts(10, 20, 30, 40)), // 100, frontier
    entry("claude-opus-5", counts(50, 50, 50, 50)), // 200, frontier
    entry("claude-sonnet-5", counts(100, 100, 100, 100)), // 400, balanced
    entry("claude-haiku-4-5", counts(75, 75, 75, 75)), // 300, fast
    // R-D15 — a session spanning two Models is two entries, never half a session each.
    entry("claude-sonnet-5", counts(10, 15, 15, 10)), // 50, balanced
  ];
  const input: AdoptionMix = { entries, models: MODELS };

  it("carries one total at every level: exact → family → tier is a true partition", () => {
    const mix = tokenModelMixLevels(input);
    expect(mix.total).toBe(1050);
    expect(mix.partitions).toBe(true);
    for (const level of ["exact", "family", "tier"] as const) {
      const distribution = mix.levels[level];
      expect(distribution.total).toBe(1050);
      expect(distribution.slices.reduce((running, slice) => running + slice.total, 0)).toBe(1050);
      expect(distribution.partition).toBe(true);
    }
  });

  it("rolls each level up into the next, rather than re-summing the rows differently", () => {
    const mix = tokenModelMixLevels(input);
    const totalOf = (distribution: { slices: readonly { key: string; total: number }[] }, key: string): number =>
      distribution.slices.find((slice) => slice.key === key)?.total ?? 0;

    // Claude Sonnet's family slice is its exact slice; the balanced tier is that family plus
    // Gemini Pro's nothing. A level that re-read the rows could agree on the grand total and
    // still disagree here.
    expect(totalOf(mix.levels.family, "Claude Sonnet")).toBe(450);
    expect(totalOf(mix.levels.tier, "balanced")).toBe(
      totalOf(mix.levels.family, "Claude Sonnet") + totalOf(mix.levels.family, "Gemini Pro"),
    );
    expect(totalOf(mix.levels.tier, "frontier")).toBe(
      totalOf(mix.levels.exact, "gpt-6-astra") + totalOf(mix.levels.exact, "claude-opus-5"),
    );
  });

  it("keeps the roster's own order and holds an unused Model at zero, not absent", () => {
    const tier = tokenModelMix(input, "tier");
    expect(tier.slices).toEqual([
      { key: "frontier", total: 300 },
      { key: "balanced", total: 450 },
      { key: "fast", total: 300 },
    ]);
    const exact = tokenModelMix(input, "exact");
    expect(exact.slices).toHaveLength(MODELS.length);
    expect(exact.slices.find((slice) => slice.key === "gpt-5-nano")).toEqual({
      key: "gpt-5-nano",
      total: 0,
    });
  });

  it("measures the mix in tokens processed — the same figure the adoption total is", () => {
    // One arithmetic, read twice: if the mix used a different measure, the distribution under
    // the headline figure would not add up to it.
    expect(tokenModelMixLevels(input).total).toBe(tokenVolume(entries).processed);
  });
});

describe("T-U17 / A22 — no query function accepts a Model, asserted as an absence", () => {
  it("detects a Model-shaped parameter when there is one — the control", () => {
    const missed = Object.entries(HELPER_DETECTS)
      .filter(([, detected]) => !detected)
      .map(([what]) => what);
    expect(missed).toEqual([]);
  });

  it("finds none on any exported query of this module", () => {
    const offenders = Object.entries(NAMES_A_MODEL_BY_QUERY)
      .filter(([, namesAModel]) => namesAModel)
      .map(([query]) => query);
    expect(offenders).toEqual([]);
    expect(Object.keys(NAMES_A_MODEL_BY_QUERY)).toHaveLength(6);
  });

  it("offers no arity a Model could be smuggled in through", () => {
    // Every exported function takes one or two arguments — the data, and at most a roll-up
    // level. There is no third parameter, so there is no filter to widen into one.
    const arities = Object.values(adoptionModule)
      .filter((value) => typeof value === "function")
      .map((query) => query.length);
    expect(arities).toHaveLength(6);
    expect(arities.filter((arity) => arity > 2)).toEqual([]);
  });
});

describe("R-M9 — an adoption measure, never a cost proxy", () => {
  it("exports nothing that prices anything", () => {
    const priced = Object.keys(adoptionModule).filter((name) =>
      /price|cost|spend|rate|usd|money/i.test(name),
    );
    expect(priced).toEqual([]);
  });

  it("returns a count of tokens, not a currency figure, for identical volume on any Model", () => {
    // ADR-0007 puts a 200× input-price spread across the roster. These two entries are the
    // same adoption figure and could not be the same money — which is why nothing here is
    // allowed to look like money.
    const frontier = entry("gpt-6-astra", counts(1000, 0, 0, 0));
    const nano = entry("gpt-5-nano", counts(1000, 0, 0, 0));
    expect(tokensProcessed(frontier)).toBe(tokensProcessed(nano));
    expect(tokenModelMix({ entries: [frontier, nano], models: MODELS }, "tier").total).toBe(2000);
  });
});
