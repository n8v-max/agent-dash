// The five chart shapes the panels need, built from a `ChartViewModel` and nothing else.
//
// **This module is `ChartFrame`'s shape factory, not a panel-facing API.** A panel names a shape
// and hands over a ViewModel; it never builds a Recharts element itself, which is what keeps
// R-T28's four responsibilities in one place and out of twenty panels.
//
// **R-V1 — a chart stacks if and only if its ViewModel carries `stackable: true`** (T-C11).
// `stackIdOf` is the *only* expression in the product that produces a `stackId`, and it reads
// `chart.stackable` — a domain fact (`viewmodel.ts`'s R-V1 table), never a panel's choice. Two
// shapes refuse to stack whatever the ViewModel permits: `line`, because a stacked line claims a
// part-to-whole reading its geometry cannot carry, and `grouped-bar`, whose entire point is the
// side-by-side comparison. `stackable` is a permission, not an instruction — the direction that
// would be a false claim is stacking a non-partition, and that one is unreachable here.
//
// **No pie chart is imported, anywhere** (R-V2). Asserted statically over the chart modules by
// T-C11, because a rendering test cannot prove an absence.
//
// **R-V11 — a chart inside a tile is furniture-free.** `bare` on the shape input drops the grid,
// both axes and the legend, and keeps the tooltip, the accessibility layer and the mirror. See
// `ShapeInput.bare` for why, and `chart-frame.tsx` for the prop a panel sets.
//
// **It computes nothing** (R-T6). `chartRows` transposes the ViewModel's series into the
// row-major shape Recharts reads; it sums nothing, sorts nothing and drops nothing. Every number
// that reaches a mark is the one `src/domain/` put on the series.
//
// **R-M18 — `connectNulls={false}`, stated rather than inherited.** A series point is `null`
// where the domain layer had no reading for that bucket: a week with no Completed Job has no
// Cost per completed Job, and the rule is that such a figure is absent, never zero. A connected
// line would draw straight through the gap and invent the readings it spans, which is the same
// false claim as drawing the gap at zero with one more step of interpolation in it. Recharts'
// own default is `false`, and that is exactly why it is written out: a default is not a decision,
// and this one is load-bearing enough that a future version flipping it must fail a test rather
// than change what the product claims.
//
// **Animation is off.** Ticket 18's one unresolved residual was whether Recharts interpolates a
// series' geometry from the previous series' across a roll-up switch when animating — jsdom
// produces no mid-transition geometry, so the spike could not see it. With animation off the
// question does not arise, and a dashboard that redraws on every control change reads better for
// it. `isAnimationActive` is set once here rather than per panel.

"use client";

import type { ReactElement } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartLegend, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartViewModel, SeriesViewModel } from "@/domain/viewmodel";
import { SeriesLegend } from "./series-legend";

/** The five shapes the panels in `spec.md` § 3 need. There is no sixth, and no pie (R-V2). */
export const CHART_SHAPES = ["line", "area", "bar", "grouped-bar", "horizontal-bar"] as const;
export type ChartShape = (typeof CHART_SHAPES)[number];

/** The shapes whose geometry *can* assert a part-to-whole reading. `line` never can. */
export const STACKING_SHAPES: readonly ChartShape[] = ["area", "bar", "horizontal-bar"];

/** One stack per chart: every series in it is a part of the same whole. */
export const STACK_ID = "series";

/** The row-major key the bucket axis reads. Not a series key — no grouping is called this. */
const BUCKET_KEY = "bucket";

/**
 * **R-V1, in one expression** (T-C11). The only producer of a `stackId` in the product.
 */
export function stackIdOf(input: {
  readonly shape: ChartShape;
  readonly stackable: boolean;
}): string | undefined {
  return input.stackable && STACKING_SHAPES.includes(input.shape) ? STACK_ID : undefined;
}

/** A series' reading in one bucket. `null` where there is none — a gap, never a drawn zero. */
const valueAt = (series: SeriesViewModel, bucket: string): number | null =>
  series.points.find((point) => point.bucket === bucket)?.value ?? null;

type ChartRow = Record<string, string | number | null>;

/** The ViewModel's series, transposed into the row-major shape Recharts reads. */
export const chartRows = (chart: ChartViewModel): readonly ChartRow[] =>
  chart.buckets.map((bucket) => ({
    [BUCKET_KEY]: bucket.label,
    ...Object.fromEntries(chart.series.map((series) => [series.key, valueAt(series, bucket.key)])),
  }));

/**
 * A series' colour, through the CSS variable `ChartStyle` writes from the `ChartConfig`
 * (R-T30). The indirection is the point: the mark and the legend swatch read the same variable,
 * so a mark cannot be painted a colour the config did not give it.
 */
const colorOf = (series: SeriesViewModel): string => `var(--color-${series.key})`;

/**
 * A translucent fill without a decimal in it. `fillOpacity={0.2}` would serialise `0.2` into the
 * response payload, and `e2e/payload.spec.ts` scans that payload for ungranted cost literals —
 * a percentage inside `color-mix` says the same thing and cannot collide with a figure.
 */
const softFill = (series: SeriesViewModel): string =>
  `color-mix(in oklab, ${colorOf(series)} 24%, transparent)`;

const AXIS = { tickLine: false, axisLine: false, tickMargin: 8 } as const;

/** Decimal-free by default, for the same reason `softFill` is. Panels may pass their own. */
const compact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 0 });

export const defaultTickFormat = (value: number): string => compact.format(value);

type ShapeInput = {
  readonly chart: ChartViewModel;
  readonly shape: ChartShape;
  readonly tickFormat: (value: number) => string;
  /**
   * The measure axis's fixed extent, when a panel draws an axis it does not own the scale of.
   * Left to itself Recharts scales each chart to its own maximum, so two charts read side by side
   * can draw two different values at the same height — a falsehood no caption undoes.
   *
   * When set it arrives from the domain layer, like `stackable`: a component supplies no default
   * and decides nothing.
   *
   * **No panel sets it today, and that is a decision rather than an oversight.** It was added for
   * R-N13's acceptance multiples; ticket 41 made those `bare`, and a chart that draws no axis has
   * no scale to disagree about — their comparison is carried by `acceptanceAxis` through the rail
   * instead. It is kept because the *next* pair of side-by-side charts with a drawn axis will
   * need it, and because removing it would delete the only expression that can pin one.
   */
  readonly measureDomain?: readonly [number, number];
  /**
   * **R-V11 — a chart inside a tile carries no axes, no ticks, no grid and no legend.**
   *
   * At tile size the furniture is larger than the mark: R-N13's acceptance multiples are 144px
   * tall, and a tick strip, a grid and a one-entry legend take most of it to restate a figure the
   * tile already prints in 24pt above the chart. What is left is a sparkline — a shape, read for
   * its direction, beside the number it is the shape of — which is the same reasoning R-N8 gives
   * for the summary tile's bars carrying no axis labels.
   *
   * **The tooltip and the accessibility layer stay** (R-X3), and so does the R-X1 mirror: the
   * values are not withdrawn, only the chrome. A reader who wants the numbers has them in the
   * mirror and in the tile's own headline, which is where a tile's figures belong.
   */
  readonly bare?: boolean;
};

/**
 * The bucket axis is categorical and the measure axis is numeric; `horizontal-bar` swaps which
 * is which, and nothing else about the chart changes.
 */
const axesFor = (input: ShapeInput): readonly ReactElement[] => {
  const domain = input.measureDomain ? { domain: input.measureDomain } : {};
  return input.shape === "horizontal-bar"
    ? [
        <XAxis key="measure" type="number" tickFormatter={input.tickFormat} {...domain} {...AXIS} />,
        <YAxis key="bucket" type="category" dataKey={BUCKET_KEY} width={120} {...AXIS} />,
      ]
    : [
        <XAxis key="bucket" dataKey={BUCKET_KEY} {...AXIS} />,
        <YAxis key="measure" tickFormatter={input.tickFormat} width={56} {...domain} {...AXIS} />,
      ];
};

/**
 * Grid, axes, tooltip and legend — identical for every shape, so no panel can vary them.
 *
 * **`bare` drops everything but the tooltip** (R-V11). It is one branch here rather than a prop
 * on each piece so that "a tile chart is a bare line" is a single decision, and so that the
 * tooltip and the accessibility layer cannot be dropped with the chrome by accident.
 *
 * Exported for the same reason `stackIdOf` is: it is the *only* expression in the product that
 * decides whether a chart has axes, so R-V11 is assertable over the decision rather than over
 * Recharts' class names in jsdom.
 */
export const furnitureFor = (input: ShapeInput): readonly ReactElement[] => {
  const tooltip = <ChartTooltip key="tooltip" content={<ChartTooltipContent />} />;
  if (input.bare) return [tooltip];

  return [
    <CartesianGrid
      key="grid"
      horizontal={input.shape !== "horizontal-bar"}
      vertical={input.shape === "horizontal-bar"}
      strokeDasharray="3 3"
    />,
    ...axesFor(input),
    tooltip,
    <ChartLegend key="legend" content={<SeriesLegend />} />,
  ];
};

const linesFor = (chart: ChartViewModel): readonly ReactElement[] =>
  chart.series.map((series) => (
    <Line
      key={series.key}
      dataKey={series.key}
      name={series.label}
      type="monotone"
      stroke={colorOf(series)}
      strokeWidth={2}
      dot={false}
      connectNulls={false}
      isAnimationActive={false}
    />
  ));

const areasFor = (
  chart: ChartViewModel,
  stackId: string | undefined,
): readonly ReactElement[] =>
  chart.series.map((series) => (
    <Area
      key={series.key}
      dataKey={series.key}
      name={series.label}
      type="monotone"
      stackId={stackId}
      stroke={colorOf(series)}
      strokeWidth={2}
      fill={stackId === undefined ? softFill(series) : colorOf(series)}
      connectNulls={false}
      isAnimationActive={false}
    />
  ));

const barsFor = (chart: ChartViewModel, stackId: string | undefined): readonly ReactElement[] =>
  chart.series.map((series) => (
    <Bar
      key={series.key}
      dataKey={series.key}
      name={series.label}
      stackId={stackId}
      fill={colorOf(series)}
      radius={2}
      isAnimationActive={false}
    />
  ));

/**
 * **The chart element.** One switch, five shapes, and the series marks are the only thing that
 * differs between them — the furniture, the accessibility layer (R-X3) and the stack decision
 * (R-V1) are decided once, above the switch.
 */
export function chartElementFor(input: ShapeInput): ReactElement {
  const data = chartRows(input.chart);
  const stackId = stackIdOf({ shape: input.shape, stackable: input.chart.stackable });
  const furniture = furnitureFor(input);

  if (input.shape === "line") {
    return (
      <LineChart accessibilityLayer data={data}>
        {furniture}
        {linesFor(input.chart)}
      </LineChart>
    );
  }

  if (input.shape === "area") {
    return (
      <AreaChart accessibilityLayer data={data}>
        {furniture}
        {areasFor(input.chart, stackId)}
      </AreaChart>
    );
  }

  return (
    <BarChart
      accessibilityLayer
      data={data}
      layout={input.shape === "horizontal-bar" ? "vertical" : "horizontal"}
    >
      {furniture}
      {barsFor(input.chart, stackId)}
    </BarChart>
  );
}
