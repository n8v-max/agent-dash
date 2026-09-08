// The Adoption section of `/demo/spend` (R-N9 panels 6 and 7, R-N11, R-M7, R-M9).
//
// It sits under its own heading and opens with a one-line statement that these measure **use and
// not money** (R-M9): tokens processed is an adoption measure, never a cost proxy, and the whole
// point of the section break is that the two are not read together.
//
// **Model is a breakdown, not an axis** (R-M7). Nothing here groups or filters a per-session
// metric by Model: the mix is a distribution over TokenUsage-grain entries, at the roll-up level
// the viewer chose, and the three levels carry one total because exact → family → tier is a true
// partition (T-U17).

import {
  sessionTokensProcessed,
  tokenModelMixLevels,
  tokenVolume,
  tokensProcessed,
  type TokenVolume,
} from "@/domain/metrics/adoption";
import type { Distribution, ModelLevel } from "@/domain/aggregate";
import type { PeriodBucket } from "@/domain/periods";
import type { AgentSession, TokenClass } from "@/domain/types";
import {
  chartViewModel,
  tableViewModel,
  type Cell,
  type ChartViewModel,
  type TableViewModel,
} from "@/domain/viewmodel";
import { ratio, type Ratio } from "@/domain/ratio";
import type { PageContext } from "./context";
import { aggregationCells, bucketAxis, subjectGrouping, sumOf } from "./panels";

/** One roll-up level's mix, with each slice's share resolved. */
export type DistributionViewModel = {
  readonly level: ModelLevel;
  readonly slices: readonly {
    readonly key: string;
    readonly label: string;
    readonly value: number;
    /** R-M18 — `null` over a mix holding no token at all. A share of nothing is not zero. */
    readonly share: Ratio;
  }[];
  readonly total: number;
  /** Always true: exact → family → tier partitions the tokens exactly (R-V1, T-U17). */
  readonly stackable: boolean;
};

export type ModelMixPanel = {
  readonly level: ModelLevel;
  readonly chart: ChartViewModel;
  /** All three levels, whole-range — the contrast case to Team, and what T-U17 asserts on. */
  readonly levels: Readonly<Record<ModelLevel, DistributionViewModel>>;
  /** The one figure every level carries. Equal across all three, by construction. */
  readonly total: number;
};

/** R-N11 — the illustrative token rate card. The compute card is rendered nowhere. */
export type RateCardViewModel = {
  /** The card's own label, from the fixture. The "illustrative" wording is R-V8's, in copy. */
  readonly label: string;
  readonly unit: string;
  readonly currency: string;
  readonly table: TableViewModel;
  /** The ratios the three derived classes come from (ADR-0007), so the card can show its working. */
  readonly derivation: readonly { readonly key: string; readonly factor: number }[];
};

export type AdoptionSection = {
  readonly heading: string;
  /** R-N9 — the one line that says these measure use and not money. */
  readonly statement: string;
  readonly tokensOverTime: ChartViewModel;
  readonly volume: TokenVolume;
  readonly modelMix: ModelMixPanel;
  readonly rateCard: RateCardViewModel;
};

const TOKEN_COLUMNS: readonly { readonly key: TokenClass; readonly label: string }[] = [
  { key: "uncached_input", label: "Uncached input" },
  { key: "cache_read", label: "Cache read" },
  { key: "cache_write", label: "Cache write" },
  { key: "output", label: "Output" },
];

const distributionOf = (distribution: Distribution): DistributionViewModel => ({
  level: distribution.level,
  slices: distribution.slices.map((slice) => ({
    key: slice.key,
    label: slice.key,
    value: slice.total,
    share: ratio(slice.total, distribution.total),
  })),
  total: distribution.total,
  stackable: distribution.partition,
});

/**
 * Tokens by Model label, per bucket. Entries naming a Model outside the roster are counted
 * nowhere — the same rule `modelMix` applies, restated here because this pass is per bucket.
 */
/**
 * The series key for a Model grouping — an identifier, never a display label.
 *
 * `family` is the one Model level whose value is authored for a reader ("Claude Sonnet"), and a
 * series key travels further than the other keys do: R-T30 turns it into a CSS custom property,
 * and `--color-Claude Sonnet` is not a valid property name, so the declaration is dropped and the
 * mark renders unpainted. The legend swatch reads `--chart-N` directly and stays coloured, which
 * makes it the silent wrong-colour class R-T30 and T-C3 exist to close rather than a visible
 * error. Every other grouping in the product is already keyed on an id (`team_platform`,
 * `api-gateway`, `balanced`), so this is the only level that needed one.
 *
 * The label is carried separately, by `labelOf` on the chart input.
 */
const modelGroupKey = (context: PageContext, id: string, level: ModelLevel): string =>
  context.label.model(id, level).replace(/[^\w-]+/g, "-");

const modelCells = (
  context: PageContext,
  level: ModelLevel,
  buckets: readonly PeriodBucket<AgentSession>[],
): readonly Cell[] => {
  const roster = new Set(context.data.models.map((model) => model.id));
  return buckets.flatMap((bucket) => {
    const totals = new Map<string, number>();
    for (const row of bucket.rows) {
      for (const entry of row.token_usage) {
        if (!roster.has(entry.model_id)) continue;
        const group = modelGroupKey(context, entry.model_id, level);
        totals.set(group, (totals.get(group) ?? 0) + tokensProcessed(entry));
      }
    }
    return [...totals].map(([group, value]) => ({ bucket: bucket.key, group, value }));
  });
};

const modelMixPanel = (context: PageContext): ModelMixPanel => {
  const view = context.view("tokens");
  const level = context.params.modelLevel;
  const mix = tokenModelMixLevels({
    entries: view.rows.flatMap((row) => row.token_usage),
    models: context.data.models,
  });
  const modelLabels = new Map(
    context.data.models.map((model) => [
      modelGroupKey(context, model.id, level),
      context.label.model(model.id, level),
    ]),
  );

  return {
    level,
    chart: chartViewModel({
      title: "Model mix",
      rollUpLevel: `Model (${level})`,
      grouping: "model",
      // Every Model level partitions the tokens exactly, so the geometry may assert one (R-V1).
      measure: "additive",
      buckets: bucketAxis(context, view.buckets),
      cells: modelCells(context, level, view.buckets),
      labelOf: (key) => modelLabels.get(key) ?? key,
      partition: true,
    }),
    levels: {
      exact: distributionOf(mix.levels.exact),
      family: distributionOf(mix.levels.family),
      tier: distributionOf(mix.levels.tier),
    },
    total: mix.total,
  };
};

const rateCard = (context: PageContext): RateCardViewModel => {
  const { token, currency } = context.data.rateCards;
  const rates = new Map(token.rates.map((rate) => [rate.model_id, rate]));
  return {
    label: token.label,
    unit: token.unit,
    currency,
    table: tableViewModel({
      columns: [
        { key: "model", label: "Model", numeric: false, sortable: false },
        ...TOKEN_COLUMNS.map((column) => ({
          key: column.key,
          label: column.label,
          numeric: true,
          sortable: false,
        })),
      ],
      rows: context.data.models.map((model) => ({
        key: model.id,
        cells: [
          model.id,
          ...TOKEN_COLUMNS.map((column) => rates.get(model.id)?.[column.key] ?? null),
        ],
      })),
      sort: { column: "model", direction: "asc" },
    }),
    derivation: Object.entries(token.derivation).map(([key, factor]) => ({ key, factor })),
  };
};

/** R-N9 panels 6 and 7, plus R-N11's card — the whole Adoption section, resolved. */
export function adoptionSection(context: PageContext): AdoptionSection {
  const view = context.view("tokens");
  const subject = subjectGrouping(context, view, sessionTokensProcessed);

  return {
    heading: "Adoption",
    statement:
      "These measure use, not money: tokens processed is an adoption measure and never a cost proxy.",
    tokensOverTime: chartViewModel({
      title: "Tokens processed over time",
      rollUpLevel: subject.rollUpLevel,
      grouping: subject.grouping,
      measure: "additive",
      buckets: bucketAxis(context, view.buckets),
      cells: aggregationCells({
        buckets: view.buckets,
        keysOf: subject.keysOf,
        valueOf: sumOf(sessionTokensProcessed),
      }),
      labelOf: subject.labelOf,
      partition: subject.partition,
      overlapNote: subject.overlapNote,
    }),
    volume: tokenVolume(view.rows.flatMap((row) => row.token_usage)),
    modelMix: modelMixPanel(context),
    rateCard: rateCard(context),
  };
}
