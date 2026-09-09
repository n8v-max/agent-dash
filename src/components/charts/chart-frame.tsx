// **R-T28 — one `ChartFrame` wraps every chart in the product**, and it is responsible for
// exactly four things, none of which a panel does for itself:
//
//   1. **An `aria-label` naming the current roll-up level** (R-X2). The container is a plain
//      `<div>`; the roll-up level is the one piece of state a screen-reader user cannot recover
//      from anything else on the page. It carries `role="group"` because an `aria-label` on a
//      role-less `<div>` is not exposed by assistive technology at all — the label would satisfy
//      the markup and not the requirement. `group` keeps the chart and its mirror in the tree,
//      which `role="img"` would not.
//   2. **Recharts' `accessibilityLayer`** (R-X3) — `role="application"`, arrow-key navigation and
//      a `role="status"` tooltip. Set in `chart-shapes.tsx`, once, for all five shapes.
//   3. **The `mirror`, as a visually-hidden `<table>`** (R-X1).
//   4. **The R-V9 empty fallback** — plain "no data for this selection" text. The shell,
//      navigation and controls are outside this component and stay exactly where they were.
//
// **`bare` is R-V11, and it is a fifth thing this component decides for the panels.** A chart
// rendered inside a tile drops its axes, its grid and its legend, and keeps everything in the list
// above. It is a prop here rather than a class name because it changes what is *drawn*, not how it
// looks — and because a panel that could reach into the shape factory to remove an axis could also
// reach in to remove the mirror.
//
// It also renders **R-V3's overlap note** where the ViewModel carries one. That is a fifth thing,
// and it is here deliberately: the note is computed with the totals it sits under
// (`aggregate.ts`), it travels on the ChartViewModel, and putting it in the frame makes "any Team
// grouping states the overlap in words" a property of every chart rather than something twenty
// panels each have to remember. **Panels must not render it a second time.**
//
// **R-T29 / T-C0 — fixed numeric dimensions under test, never `initialDimension`.** shadcn's
// `ChartContainer` hard-codes `<ResponsiveContainer initialDimension={{width: 320, height: 200}}>`,
// which is exactly the construct T-C0 rules out: it works until a `ResizeObserver` polyfill lands
// in `vitest.setup.ts` and then fails confusingly rather than loudly. The escape hatch is the
// `dimension` prop. Recharts' own `ResponsiveContainer` short-circuits twice for us — given two
// fixed numbers it provides them straight to context with no size-detector div and no
// `ResizeObserver`, and the inner one inside `ChartContainer` detects that context and renders its
// children unchanged. So a chart with a `dimension` never reaches `initialDimension`, and **no
// `ResizeObserver` polyfill is added anywhere**; T-C0 makes its absence the alarm.
//
// **It computes nothing** (R-T6). Every number, label, colour, ordering, cap and stack decision
// arrived resolved on the ViewModel.

"use client";

import { ResponsiveContainer } from "recharts";
import type { ReactNode } from "react";
import { ChartContainer } from "@/components/ui/chart";
import type { ChartViewModel } from "@/domain/viewmodel";
import { cn } from "@/lib/utils";
import { chartConfigOf } from "./chart-config";
import { chartElementFor, defaultTickFormat, type ChartShape } from "./chart-shapes";
import { TableMirror } from "./table-mirror";

/** R-V9's words. The same sentence `DataTable` uses, because it is the same claim. */
export const EMPTY_TEXT = "No data for this selection.";

/** R-X2 — the label, and the roll-up level is in it. T-C2 asserts it changes with the level. */
export const chartAriaLabel = (chart: ChartViewModel): string =>
  `${chart.title}, grouped by ${chart.rollUpLevel}`;

/** What the R-X1 mirror is a table of. */
export const mirrorCaption = (chart: ChartViewModel): string =>
  `${chartAriaLabel(chart)} — data table`;

type Dimension = { readonly width: number; readonly height: number };

/**
 * The R-T29 escape hatch, and the only place a dimension is decided. With one, the chart renders
 * at exactly those numbers and `initialDimension` is never consulted; without one, shadcn's own
 * responsive path runs, which is what a real page wants.
 */
function ChartBox(props: { readonly dimension?: Dimension; readonly children: ReactNode }) {
  if (!props.dimension) return <>{props.children}</>;
  return (
    <ResponsiveContainer width={props.dimension.width} height={props.dimension.height}>
      {props.children}
    </ResponsiveContainer>
  );
}

export type ChartFrameProps = {
  readonly chart: ChartViewModel;
  readonly shape: ChartShape;
  /** R-T29 / T-C0. Set by tests; a page leaves it off and gets the responsive path. */
  readonly dimension?: Dimension;
  /** How a measure-axis tick reads. Decimal-free by default — see `chart-shapes.tsx`. */
  readonly tickFormat?: (value: number) => string;
  /**
   * Pin the measure axis to a fixed extent, for a panel that draws an axis whose scale it does
   * not own. The value comes from the ViewModel, so the scale stays a domain fact rather than a
   * panel's choice. **No panel sets it today** — see `chart-shapes.tsx`'s `ShapeInput` for why it
   * is kept.
   */
  readonly measureDomain?: readonly [number, number];
  /**
   * **R-V11 — no axes, no ticks, no grid and no legend.** Set by a panel rendering a chart *inside
   * a tile*, where the furniture is larger than the mark and restates a figure the tile already
   * prints. The tooltip, `accessibilityLayer` (R-X3) and the R-X1 mirror are unaffected, so the
   * values stay reachable; what goes is the chrome. See `chart-shapes.tsx`'s `ShapeInput.bare`.
   */
  readonly bare?: boolean;
  readonly className?: string;
};

export function ChartFrame(props: ChartFrameProps) {
  const { chart } = props;
  const label = chartAriaLabel(chart);

  // R-V9. The label stays, so a chart that a filter emptied is still the chart it was.
  if (chart.empty) {
    return (
      <div role="group" aria-label={label} data-slot="chart-frame" className={props.className}>
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {EMPTY_TEXT}
        </p>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={label}
      data-slot="chart-frame"
      className={cn("space-y-2", props.className)}
    >
      <ChartBox dimension={props.dimension}>
        <ChartContainer config={chartConfigOf(chart)} className="w-full">
          {chartElementFor({
            chart,
            shape: props.shape,
            tickFormat: props.tickFormat ?? defaultTickFormat,
            measureDomain: props.measureDomain,
            bare: props.bare,
          })}
        </ChartContainer>
      </ChartBox>
      {chart.overlapNote ? (
        <p className="text-xs text-muted-foreground">{chart.overlapNote}</p>
      ) : null}
      <TableMirror mirror={chart.mirror} caption={mirrorCaption(chart)} />
    </div>
  );
}
