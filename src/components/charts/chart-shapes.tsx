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
// **R-V13 — one interpolation, and it arrives from `chart-config.tsx`.** `linesFor` and
// `areasFor` read `CHART_INTERPOLATION` and neither spells a curve of its own; `ShapeInput`
// carries no curve field, so a panel has nothing to override it with. Why `linear` rather than a
// spline is argued where the constant is declared: a curve leaves the range of the points it was
// drawn through, which puts an acceptance rate above 100% and a cost below $0 between two real
// readings.
//
// **R-V15 — the period axis's tick interval arrives from `chart-config.tsx` too.** Same shape of
// decision as the interpolation and for the same reason: twenty-two weekly labels do not fit
// 358px of card, and which of them survive is a claim about the axis rather than a panel's
// styling. `axesFor` applies `BUCKET_TICK_INTERVAL` on the period axis and deliberately not on a
// `horizontal-bar`'s category axis, where a thinned tick would delete a bar's own name.
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
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartLegend, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartViewModel, SeriesViewModel } from "@/domain/viewmodel";
import { BUCKET_TICK_INTERVAL, CHART_INTERPOLATION } from "./chart-config";
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
 * **R-V12, in one expression** (T-C18). The only place a panel's named shape is overruled.
 *
 * A **ranked** ViewModel has no time axis: it holds one bucket covering the whole selected
 * period and its groups are the bars, in R-V5's whole-range order. That is a horizontal bar
 * chart whatever the panel asked for — Cost per completed Job names `line`, and at
 * `subject=member` a line has nothing to run along.
 *
 * It is here rather than in the panels for the reason `stackIdOf` is: the *form* is a domain
 * fact the query decided (`viewmodel.ts`'s `ChartForm`), and a panel that could choose its own
 * shape from it could choose a different one on the page beside it. A panel still names the
 * shape its **series** form takes; it never names the ranked one.
 */
export const shapeFor = (chart: ChartViewModel, shape: ChartShape): ChartShape =>
  chart.form === "ranked" ? "horizontal-bar" : shape;

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
   *
   * **`bare` is the whole of R-V11; `axes` below is the weaker half of it**, for a tile that
   * still wants its legend. R-N8's summary tile is that case: it drops the scale but keeps the
   * one-entry-per-WorkType legend, because the legend is where the five names are.
   */
  readonly bare?: boolean;
  /**
   * Put each bar's own figure on the bar.
   *
   * For panels read **without a measure axis** — R-N8's tile is the one, at 128px high inside a
   * card, where a tick scale is four numbers along an edge nobody measures against. The label is
   * the axis in that case, not an ornament on top of one, which is why it is off by default:
   * a chart that has an axis and labels states every figure twice.
   *
   * It is a rendering choice and it is spelled as one — a `boolean` a panel passes, not a fact
   * on the ViewModel. `stackable` is domain-supplied because stacking makes a *claim* about the
   * data; a label on a bar makes none.
   */
  readonly valueLabels?: boolean;
  /**
   * Draw the axes and the grid they index. **On by default**; off for a panel small enough that
   * a scale is noise rather than information — R-N8's `/demo` tile, 128px of card with five bars
   * in it, where the ticks would be four numbers along an edge nobody measures against.
   *
   * It is `hide` on the axis elements rather than their absence, because the axes *are* the
   * scales: dropping them would drop the category mapping with them. Recharts reclaims their
   * reserved space when they are hidden, which is the difference between five bars across the
   * card and five bars in the right two thirds of it.
   */
  readonly axes?: boolean;
};

/**
 * The bucket axis is categorical and the measure axis is numeric; `horizontal-bar` swaps which
 * is which, and nothing else about the chart changes.
 */
const axesFor = (input: ShapeInput): readonly ReactElement[] => {
  const domain = input.measureDomain ? { domain: input.measureDomain } : {};
  const hide = input.axes === false;
  // **R-V12 — a ranked chart's category axis holds one tick and says nothing.** Its single
  // bucket is the whole selected period, which the mirror's column header already names and the
  // page's own filter sentence already states, so drawing it would spend the 120px category
  // gutter restating one of them. The *measure* axis stays: unlike R-N8's tile this is a
  // full-width panel, and five bars of money want a scale to be read against.
  //
  // It is applied on the horizontal-bar arm alone because that is the only arm a ranked chart
  // reaches — `shapeFor` has already overruled every other shape by the time this runs.
  const bucketHidden = hide || input.chart.form === "ranked";
  return input.shape === "horizontal-bar"
    ? [
        <XAxis
          key="measure"
          type="number"
          tickFormatter={input.tickFormat}
          hide={hide}
          {...domain}
          {...AXIS}
        />,
        <YAxis
          key="bucket"
          type="category"
          dataKey={BUCKET_KEY}
          width={120}
          hide={bucketHidden}
          {...AXIS}
        />,
      ]
    : [
        // R-V15 — the period axis is the one that runs out of room, so it is the one that thins.
        <XAxis
          key="bucket"
          dataKey={BUCKET_KEY}
          hide={hide}
          interval={BUCKET_TICK_INTERVAL}
          {...AXIS}
        />,
        <YAxis
          key="measure"
          tickFormatter={input.tickFormat}
          width={56}
          hide={hide}
          {...domain}
          {...AXIS}
        />,
      ];
};

/**
 * Grid, axes, tooltip and legend — identical for every shape, so no panel can vary them.
 *
 * **`bare` drops everything but the tooltip** (R-V11). It is one branch here rather than a prop
 * on each piece so that "a tile chart is a bare line" is a single decision, and so that the
 * tooltip and the accessibility layer cannot be dropped with the chrome by accident.
 *
 * **`axes: false` is the weaker form** (R-N8): the scale goes and the legend stays, for a tile
 * whose series names are only stated in the legend. The grid goes with the ticks it indexes,
 * because a dashed grid against no scale is a texture rather than a reading aid.
 *
 * Exported for the same reason `stackIdOf` is: it is the *only* expression in the product that
 * decides whether a chart has axes, so R-V11 is assertable over the decision rather than over
 * Recharts' class names in jsdom.
 */
export const furnitureFor = (input: ShapeInput): readonly ReactElement[] => {
  const tooltip = <ChartTooltip key="tooltip" content={<ChartTooltipContent />} />;
  if (input.bare) return [tooltip];

  // R-V12 — resolved here as well as in `chartElementFor`, so that whichever entry point a test
  // or a panel reaches, the furniture and the marks agree about which shape is being drawn.
  const resolved = { ...input, shape: shapeFor(input.chart, input.shape) };

  return [
    ...(input.axes === false
      ? []
      : [
          <CartesianGrid
            key="grid"
            horizontal={resolved.shape !== "horizontal-bar"}
            vertical={resolved.shape === "horizontal-bar"}
            strokeDasharray="3 3"
          />,
        ]),
    ...axesFor(resolved),
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
      type={CHART_INTERPOLATION}
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
      type={CHART_INTERPOLATION}
      stackId={stackId}
      stroke={colorOf(series)}
      strokeWidth={2}
      fill={stackId === undefined ? softFill(series) : colorOf(series)}
      connectNulls={false}
      isAnimationActive={false}
    />
  ));

/**
 * The label on a bar. Decimal-free through the chart's own tick formatter, so a labelled bar and
 * a labelled axis cannot read differently — and so no bare decimal reaches the payload T-E4
 * scans (`figures.ts` argues this at length).
 *
 * Recharts types a label formatter over its whole renderable-text union, where `tickFormat`
 * takes a number: a `null` point (a bucket a series has no reading in) is passed through as the
 * gap it is, rather than formatted into a `0` the ViewModel never claimed.
 */
const barLabel = (input: ShapeInput, series: SeriesViewModel): ReactElement => (
  <LabelList
    dataKey={series.key}
    position={input.shape === "horizontal-bar" ? "right" : "top"}
    className="fill-muted-foreground"
    fontSize={11}
    formatter={(value) => (typeof value === "number" ? input.tickFormat(value) : value)}
  />
);

const barsFor = (input: ShapeInput, stackId: string | undefined): readonly ReactElement[] =>
  input.chart.series.map((series) => (
    <Bar
      key={series.key}
      dataKey={series.key}
      name={series.label}
      stackId={stackId}
      fill={colorOf(series)}
      radius={2}
      isAnimationActive={false}
    >
      {input.valueLabels ? barLabel(input, series) : null}
    </Bar>
  ));

/**
 * Room for the labels, and only when there are labels. Recharts lays a bar out to the plot's
 * edge, so a label sitting past the end of the longest bar is drawn into the margin: without
 * one it is clipped, and the longest bar — the one the tile is about — is the one that loses
 * its figure. Both edges the two positions use, so one margin serves either layout.
 */
const MARGIN_WITH_LABELS = { top: 12, right: 40, bottom: 4, left: 4 } as const;

/**
 * **The chart element.** One switch, five shapes, and the series marks are the only thing that
 * differs between them — the furniture, the accessibility layer (R-X3) and the stack decision
 * (R-V1) are decided once, above the switch.
 */
export function chartElementFor(input: ShapeInput): ReactElement {
  // R-V12 — the form is resolved **once**, above the switch, exactly as the stack decision is.
  // Everything below reads `resolved.shape`, so a ranked ViewModel cannot reach a line mark by
  // one path while its furniture is laid out for bars by another.
  const resolved: ShapeInput = { ...input, shape: shapeFor(input.chart, input.shape) };
  const data = chartRows(resolved.chart);
  const stackId = stackIdOf({ shape: resolved.shape, stackable: resolved.chart.stackable });
  const furniture = furnitureFor(resolved);

  if (resolved.shape === "line") {
    return (
      <LineChart accessibilityLayer data={data}>
        {furniture}
        {linesFor(resolved.chart)}
      </LineChart>
    );
  }

  if (resolved.shape === "area") {
    return (
      <AreaChart accessibilityLayer data={data}>
        {furniture}
        {areasFor(resolved.chart, stackId)}
      </AreaChart>
    );
  }

  return (
    <BarChart
      accessibilityLayer
      data={data}
      layout={resolved.shape === "horizontal-bar" ? "vertical" : "horizontal"}
      margin={resolved.valueLabels ? MARGIN_WITH_LABELS : undefined}
    >
      {furniture}
      {barsFor(resolved, stackId)}
    </BarChart>
  );
}
