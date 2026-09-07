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
// **It computes nothing** (R-T6). `chartRows` transposes the ViewModel's series into the
// row-major shape Recharts reads; it sums nothing, sorts nothing and drops nothing. Every number
// that reaches a mark is the one `src/domain/` put on the series.
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
};

/**
 * The bucket axis is categorical and the measure axis is numeric; `horizontal-bar` swaps which
 * is which, and nothing else about the chart changes.
 */
const axesFor = (input: ShapeInput): readonly ReactElement[] =>
  input.shape === "horizontal-bar"
    ? [
        <XAxis key="measure" type="number" tickFormatter={input.tickFormat} {...AXIS} />,
        <YAxis key="bucket" type="category" dataKey={BUCKET_KEY} width={120} {...AXIS} />,
      ]
    : [
        <XAxis key="bucket" dataKey={BUCKET_KEY} {...AXIS} />,
        <YAxis key="measure" tickFormatter={input.tickFormat} width={56} {...AXIS} />,
      ];

/** Grid, axes, tooltip and legend — identical for every shape, so no panel can vary them. */
const furnitureFor = (input: ShapeInput): readonly ReactElement[] => [
  <CartesianGrid
    key="grid"
    horizontal={input.shape !== "horizontal-bar"}
    vertical={input.shape === "horizontal-bar"}
    strokeDasharray="3 3"
  />,
  ...axesFor(input),
  <ChartTooltip key="tooltip" content={<ChartTooltipContent />} />,
  <ChartLegend key="legend" content={<SeriesLegend />} />,
];

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
