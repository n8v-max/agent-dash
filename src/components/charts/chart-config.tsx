// **R-T30 — `ChartConfig` is built from the ViewModel's series**, so the config and the rendered
// series cannot drift. There is exactly one expression in the product that produces a
// `ChartConfig`, and it reads `chart.series`; a series that is drawn therefore has a config
// entry, and a config entry exists only because a series does.
//
// **R-V7 — nothing here can request a sixth colour.** The colour is `series.colorVar`, which
// `src/domain/series.ts` types as a closed union of the five variables `globals.css` defines and
// assigns by walking the *palette* rather than the series. This module never names a colour of
// its own, so the transparent-sixth-series failure has no expression to be written in.
//
// **R-V6 — "Other" is inert, and its tooltip lists what it holds.** The holds arrive on the
// ViewModel (`other.holds`); this module hangs them on the inert series' label as a `title`,
// which is a real hover tooltip in a browser and the same node in both the legend and the chart
// tooltip, because shadcn's `ChartLegendContent` and `ChartTooltipContent` both render
// `itemConfig.label`. Nothing here is clickable and no entry carries a handler, so "not
// clickable, does not expand" is a property of what is written rather than of what is disabled.
//
// This module computes nothing (R-T6): it re-labels and re-colours what the domain layer
// resolved, and every number it touches is one it passes through untouched.

import type { ChartViewModel, SeriesViewModel } from "@/domain/viewmodel";
import type { ChartConfig } from "@/components/ui/chart";

/**
 * **R-V13 — every line and every area in the product is interpolated `linear`**, and this is the
 * only place the interpolation is named (T-C19).
 *
 * A spline draws a curve through the points it was given, and the curve leaves the range those
 * points span: on `/demo/work`'s acceptance multiples it rises past 100% and dips below 0%
 * between two real readings, and on `/demo/spend` it dips below $0 between two real costs. Every
 * one of those is a value the domain layer never computed and the product could not defend —
 * the same fault R-V10 forbids `connectNulls` from committing across a gap, with a smooth edge
 * on it. `monotone` overshoots less and still invents the shape between two measurements;
 * `linear` invents the least a mark joining two points can, and it is the reading a viewer
 * already assumes a chart is making.
 *
 * **It lives here, in the shared config, rather than on the shapes**, because a panel that could
 * name its own curve could name a different one from the panel beside it, and two charts of the
 * same measure would then be smoothed differently on one page. No panel can reach it:
 * `ChartFrameProps` carries no curve prop, so this is applied once in `chart-shapes.tsx` and
 * nowhere else.
 */
export const CHART_INTERPOLATION = "linear";

/** The swatch's accessible name. `testing-spec.md` T-C3 names `/legend icon/` as its handle. */
export const legendIconLabel = (label: string): string => `${label} legend icon`;

/** R-V6's sentence. Presentation — the domain layer carries the labels, not the copy. */
export const holdsSentence = (holds: readonly string[]): string =>
  `Other holds ${holds.join(", ")}`;

/**
 * One series' colour, as an accessible SVG rather than a bare `<div>`.
 *
 * shadcn's default legend paints an unlabelled square, which reads to a screen reader as
 * nothing at all. `ChartConfig` already permits an `icon`, so the swatch becomes a labelled
 * `role="img"` and the legend's colour/label pairing is announced rather than merely seen.
 *
 * The geometry is integer-only on purpose: `e2e/payload.spec.ts` scans the response payload for
 * ungranted cost literals, and a decimal in an SVG attribute is a decimal in that payload.
 */
const swatchFor = (series: SeriesViewModel) => {
  const Swatch = () => (
    <svg
      viewBox="0 0 10 10"
      role="img"
      aria-label={legendIconLabel(series.label)}
      className="h-3 w-3 shrink-0"
    >
      <rect
        width="10"
        height="10"
        rx="3"
        fill={`var(${series.colorVar})`}
        stroke="var(--border)"
      />
    </svg>
  );
  return Swatch;
};

/**
 * The label a legend and a tooltip both render. For the inert "Other" series it carries the
 * R-V6 tooltip; for every other series it is the domain layer's resolved label, unchanged.
 */
const labelFor = (
  series: SeriesViewModel,
  other: ChartViewModel["other"],
): ChartConfig[string]["label"] =>
  series.inert && other ? (
    <span title={holdsSentence(other.holds)} className="cursor-help">
      {series.label}
    </span>
  ) : (
    series.label
  );

/**
 * **The one `ChartConfig` expression in the product** (R-T30). Keyed by the domain-supplied
 * stable series key (R-T8), so `--color-<key>` in a mark, the legend entry and the tooltip row
 * all resolve to the same series or to none.
 */
export function chartConfigOf(chart: ChartViewModel): ChartConfig {
  return Object.fromEntries(
    chart.series.map((series) => [
      series.key,
      {
        label: labelFor(series, chart.other),
        color: `var(${series.colorVar})`,
        icon: swatchFor(series),
      },
    ]),
  );
}
