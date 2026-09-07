// T-U18 and T-U17 against the **committed** fixture (`spec.md` R-M9, R-M7, A22, R-D15, R-D16,
// ADR-0007, P6), ticket 26.
//
// The pure unit tests live in `src/domain/metrics/adoption.test.ts` and author every count
// inline, because `src/domain/**` may not reach the data layer (R-T5). This file sits outside
// that boundary, so it may import `load.ts` — and it exists because P6 says a test that would
// pass against an empty fixture is not a test.
//
// **The committed fixture is the dataset T-U17 and T-U18 ask for.** R-D15 puts 40% of sessions
// across two or more Models, so "no per-session metric may be grouped by Model" is a rule about
// 295 real rows rather than a hypothetical; R-D16 spreads token volume across all three tiers,
// so the roll-up has something to roll up.
//
// It reads committed output and never runs the generator (P3, R-T20). It follows the precedent
// `aggregate.fixture.test.ts` set for the same reason.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  disjointness,
  sessionTokensProcessed,
  tokenModelMix,
  tokenModelMixLevels,
  tokenVolume,
  tokensProcessed,
  type AdoptionMix,
} from "@/domain/metrics/adoption";
import { TOKEN_CLASSES } from "@/domain/types";
import { loadDataset } from "./load";

const { models, sessions } = loadDataset();

const ENTRIES = sessions.flatMap((session) => session.token_usage);
const MIX: AdoptionMix = { entries: ENTRIES, models };

const shareOf = (slices: readonly { key: string; total: number }[], key: string, total: number): number =>
  (slices.find((slice) => slice.key === key)?.total ?? 0) / total;

describe("T-U18 — tokens processed over the committed rows (R-M9)", () => {
  it("sums the four disjoint classes into one figure the class totals reproduce", () => {
    const volume = tokenVolume(ENTRIES);
    expect(volume.entries).toBe(ENTRIES.length);
    expect(volume.processed).toBeGreaterThan(0);
    const summed = TOKEN_CLASSES.reduce((running, tokenClass) => running + volume.byClass[tokenClass], 0);
    expect(summed).toBe(volume.processed);
    // Every class carries real volume: a fixture where one were empty would let the sum drop
    // a class without any test noticing.
    for (const tokenClass of TOKEN_CLASSES) expect(volume.byClass[tokenClass]).toBeGreaterThan(0);
  });

  it("agrees with the session-grain figure, summed the other way round", () => {
    const bySession = sessions.reduce(
      (running, session) => running + sessionTokensProcessed(session),
      0,
    );
    expect(bySession).toBe(tokenVolume(ENTRIES).processed);
  });

  it("asserts the four classes do not overlap in the fixture — what makes the sum safe", () => {
    const evidence = disjointness(ENTRIES);
    expect(evidence.entries).toBe(ENTRIES.length);
    expect(evidence.negative).toBe(0);
    // Every committed row carries uncached input smaller than its cached classes, which an
    // OpenAI-shaped superset reading could never do. The readings are normalised into this
    // project's four disjoint classes (`CONTEXT.md` § Token class), and this is the check.
    expect(evidence.witnesses).toBe(ENTRIES.length);
    expect(evidence.disjoint).toBe(true);
  });

  it("holds no empty TokenUsage row, so no entry is disjoint only vacuously", () => {
    expect(ENTRIES.every((entry) => tokensProcessed(entry) > 0)).toBe(true);
  });
});

describe("T-U17 — Model mix at three roll-up levels on committed rows (R-M7, R-D16)", () => {
  const mix = tokenModelMixLevels(MIX);

  it("is a true partition: one total, at exact, family and tier", () => {
    expect(mix.partitions).toBe(true);
    expect(mix.total).toBe(tokenVolume(ENTRIES).processed);
    for (const level of ["exact", "family", "tier"] as const) {
      const distribution = mix.levels[level];
      expect(distribution.total).toBe(mix.total);
      expect(distribution.slices.reduce((running, slice) => running + slice.total, 0)).toBe(mix.total);
      expect(distribution.partition).toBe(true);
    }
  });

  it("rolls exact into family into tier, model by model, on ADR-0007's roster", () => {
    expect(mix.levels.exact.slices).toHaveLength(models.length);
    expect(mix.levels.family.slices).toHaveLength(7);
    expect(mix.levels.tier.slices.map((slice) => slice.key)).toEqual(["frontier", "balanced", "fast"]);

    for (const family of mix.levels.family.slices) {
      const members = models.filter((model) => model.family === family.key);
      const fromExact = members.reduce(
        (running, model) =>
          running + (mix.levels.exact.slices.find((slice) => slice.key === model.id)?.total ?? 0),
        0,
      );
      expect(family.total).toBe(fromExact);
    }

    for (const tier of mix.levels.tier.slices) {
      const families = new Set(models.filter((model) => model.tier === tier.key).map((model) => model.family));
      const fromFamily = mix.levels.family.slices
        .filter((slice) => families.has(slice.key))
        .reduce((running, slice) => running + slice.total, 0);
      expect(tier.total).toBe(fromFamily);
    }
  });

  it("carries R-D16's tier shares — balanced 55%, fast 30%, frontier 15%", () => {
    const tier = tokenModelMix(MIX, "tier");
    expect(shareOf(tier.slices, "balanced", tier.total)).toBeCloseTo(0.55, 2);
    expect(shareOf(tier.slices, "fast", tier.total)).toBeCloseTo(0.3, 2);
    expect(shareOf(tier.slices, "frontier", tier.total)).toBeCloseTo(0.15, 2);
  });

  it("gives `frontier` the smallest token share, which is ADR-0007's invariant", () => {
    // The other half of the invariant — that `frontier` nonetheless carries the most token
    // *spend* — is the generator's to assert (R-T23), not this application's: it prices
    // nothing (R-M4, R-T11), and there is deliberately no function here that could compute it.
    const tier = tokenModelMix(MIX, "tier");
    const frontier = shareOf(tier.slices, "frontier", tier.total);
    expect(frontier).toBeLessThan(shareOf(tier.slices, "balanced", tier.total));
    expect(frontier).toBeLessThan(shareOf(tier.slices, "fast", tier.total));
  });
});

describe("A22 — no per-session metric is grouped by or filtered on Model (R-M7, R-D15)", () => {
  const multiModel = sessions.filter(
    (session) => new Set(session.token_usage.map((entry) => entry.model_id)).size > 1,
  );

  it("has 40% of committed sessions spanning two or more Models, as R-D15 requires", () => {
    expect(multiModel.length / sessions.length).toBeCloseTo(0.4, 2);
    expect(multiModel.length).toBeGreaterThan(200);
  });

  it("gives every one of them a figure no single Model's volume equals", () => {
    // This is what the rule is protecting: attributing such a session to one of its Models
    // would understate it by the others, every time, on 295 real rows.
    for (const session of multiModel) {
      const total = sessionTokensProcessed(session);
      for (const entry of session.token_usage) {
        expect(tokensProcessed(entry)).toBeLessThan(total);
      }
    }
  });

  it("keeps the distribution a breakdown of the same total the sessions add up to", () => {
    // A Model axis and a Model breakdown are told apart by exactly this: the breakdown
    // re-partitions the population's own figure and invents no second population.
    const bySession = sessions.reduce((running, session) => running + sessionTokensProcessed(session), 0);
    expect(tokenModelMixLevels(MIX).total).toBe(bySession);
  });
});

// --- The absence, over the source (boundary.test.ts's precedent) ----------------------------
//
// T-U17 asks for A22 to be asserted "as an absence: no query function accepts a Model
// argument". The pure test pins it at compile time over the *types*; this pins it over the
// *signatures*, because reading source is permitted here and nowhere above it (R-T5). The two
// together cover both ways a Model could arrive: named directly in a parameter list, or hidden
// inside an options type.

const TICKET_MODULES = [
  join("src", "domain", "metrics", "adoption.ts"),
  join("src", "domain", "metrics", "duration.ts"),
  join("src", "domain", "comparability.ts"),
];

/** Comments state what the code does *not* do, so the guard must read the code only. */
const codeOf = (path: string): string =>
  readFileSync(join(process.cwd(), path), "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join("\n");

/** The parameter list of every exported function in a module. */
const exportedParameters = (code: string): readonly string[] =>
  [...code.matchAll(/export (?:function |const )\w+\s*(?:=\s*)?\(([^)]*)\)/g)].map(
    (match) => match[1],
  );

/**
 * A Model arriving as an argument. `models` — the plural roster `aggregate.ts` looks labels up
 * in — is caught too: this guard is about signature text, and the roster's exemption is stated
 * on `AdoptionMix` rather than smuggled through a parameter list.
 */
const NAMES_A_MODEL = /\b(model|models|model_id|modelId|tier|family)\b/;

describe("A22 asserted as an absence over the ticket's own source", () => {
  it("detects a Model argument when there is one — the control", () => {
    expect(NAMES_A_MODEL.test("session: AgentSession, model_id: string")).toBe(true);
    expect(NAMES_A_MODEL.test("rows: readonly Row[], tier: ModelTier")).toBe(true);
    // And does not fire on the type *names* the modules legitimately mention.
    expect(NAMES_A_MODEL.test("input: AdoptionMix, level: ModelLevel")).toBe(false);
  });

  it("finds every exported signature, so the scan is not vacuous", () => {
    for (const path of TICKET_MODULES) {
      expect(exportedParameters(codeOf(path)).length).toBeGreaterThan(2);
    }
  });

  it("finds no Model argument on any exported function of the three modules", () => {
    const offenders = TICKET_MODULES.flatMap((path) =>
      exportedParameters(codeOf(path))
        .filter((parameters) => NAMES_A_MODEL.test(parameters))
        .map((parameters) => `${path}: (${parameters})`),
    );
    expect(offenders).toEqual([]);
  });
});
