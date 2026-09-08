// The chrome every panel on `/[org]/work` is hung in, decided once.
//
// **A panel is a `<section>` with an accessible name, an `<h2>` a reader sees, an optional note,
// an optional figure strip and a chart.** Six panels in one column, in R-N12's order, each one
// visibly the same object — which is what lets the acceptance panel's *five* tiles read as one
// panel of small multiples rather than as five panels (R-N13).
//
// **The heading is the ViewModel's `chart.title`.** It is not re-spelled here: the velocity
// panel's title changes with the per-capita toggle, and a second copy of the words in the
// rendering layer is a second copy that can disagree with the axis it sits over.
//
// **The chart's height is a panel decision and is made here.** shadcn's `ChartContainer` is
// `aspect-video`, which over a 1400px page is an 800px-tall chart; the two classes below
// override the aspect from outside the chart layer, so `ChartFrame` keeps its four
// responsibilities (R-T28) and no panel reaches into it.
//
// **No class name here carries a decimal**, and none in any panel does either. `h-1.5`,
// `py-0.5` and their kind put a bare `1.5` into the served HTML, and `e2e/payload.spec.ts`
// scans that HTML for two-decimal cost literals — three of the fixture's ungranted session
// costs are `1.5`, so a spacing utility can fail a tenancy assertion. The integer step is
// indistinguishable at this scale and cannot be read as a figure.
//
// **It computes nothing** (R-T6). Every string it renders arrived on a ViewModel or is copy.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A full-width panel's chart. Tall enough to read a trend, short enough to scroll past. */
export const PANEL_CHART = "[&_[data-slot=chart]]:aspect-auto [&_[data-slot=chart]]:h-72";

/** One small multiple. Short on purpose: five of them are read together, not one at a time. */
export const TILE_CHART = "[&_[data-slot=chart]]:aspect-auto [&_[data-slot=chart]]:h-36";

/** One resolved figure and the evidence under it. Both arrive as strings, already formatted. */
export type PanelFigure = {
  /** R-T8 — a domain-supplied identity. A series key, a span key, a bucket key. */
  readonly key: string;
  readonly label: string;
  readonly value: string;
  /** The counts the figure came out of — a denominator, a population, a bucket's edges. */
  readonly detail?: string;
};

/** The figure strip a panel carries above its chart. A `<dl>`, because it is label/value pairs. */
export function PanelFigures(props: { readonly figures: readonly PanelFigure[] }) {
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3">
      {props.figures.map((figure) => (
        <div key={figure.key} className="min-w-24">
          <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {figure.label}
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
            {figure.value}
          </dd>
          {figure.detail ? (
            <dd className="text-xs text-muted-foreground">{figure.detail}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export function WorkPanel(props: {
  /** The ViewModel's `chart.title`, used as both the visible heading and the section's name. */
  readonly title: string;
  /** A restriction on the population, stated beside the heading rather than under the chart. */
  readonly badge?: ReactNode;
  /** A restriction, a denominator or a definition the ViewModel carries in words. */
  readonly note?: string | null;
  readonly figures?: readonly PanelFigure[];
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      aria-label={props.title}
      className={cn("rounded-xl border border-border bg-card p-5 sm:p-6", props.className)}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{props.title}</h2>
        {props.badge}
      </div>
      {props.note ? (
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {props.note}
        </p>
      ) : null}
      {props.figures ? (
        <div className="mt-4">
          <PanelFigures figures={props.figures} />
        </div>
      ) : null}
      <div className="mt-5">{props.children}</div>
    </section>
  );
}
