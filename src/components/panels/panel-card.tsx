// The shell a panel sits in: a heading, the one line saying what the panel answers, the figures
// that read off it, the chart, and a footnote where the ViewModel carries one.
//
// It exists so that a panel's *chrome* is decided once. Seven panels each spelling their own
// heading level, spacing and note placement is seven chances for two of them to disagree, and
// the R-N9 order is easier to read on the page when every entry has the same silhouette.
//
// **It renders no overlap note.** R-V3's sentence travels on the ChartViewModel and `ChartFrame`
// renders it (R-T28); a panel that rendered `footnote={chart.overlapNote}` would print it twice.
//
// **R-C6 — the header carries the panel's own control, where it has one.** `accepted` narrows
// Cost per session and no other panel; per-capita divides Total spend and Cost by Repository and
// leaves the three ratios beside them alone. A toggle standing in the header of the figure it
// moves says that without a caption, which a page-wide bar could not. The slot takes a node and
// builds nothing: what a control *is* belongs to `components/controls/`, and a panel that could
// construct one would be a panel that could construct the wrong one.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PanelCard(props: {
  readonly title: string;
  /** One line saying what this panel answers. The panel's own copy, never a metric. */
  readonly question: string;
  /** `h2` for a top-level panel, `h3` for one inside a section with its own heading. */
  readonly level?: "h2" | "h3";
  /** R-C6 — the panel-local control this panel reads, already rendered. Right of the heading. */
  readonly controls?: ReactNode;
  /** The readings that sit beside the chart — a `FigureList`, or nothing. */
  readonly figures?: ReactNode;
  /** A qualification the ViewModel carried, such as R-M5's monthly-grain note. */
  readonly footnote?: string | null;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const Heading = props.level ?? "h2";

  return (
    <section
      aria-label={props.title}
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6",
        props.className,
      )}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="max-w-3xl">
          <Heading
            className={cn(
              "font-semibold tracking-tight text-foreground",
              Heading === "h2" ? "text-lg" : "text-base",
            )}
          >
            {props.title}
          </Heading>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{props.question}</p>
        </div>
        {props.controls}
      </div>
      {props.figures ? <div className="mt-5">{props.figures}</div> : null}
      {/*
        **The chart's height is decided here, once.** shadcn's `ChartContainer` is `aspect-video`,
        which on a full-width panel is a ~760px-tall chart: the panel below it falls off the fold,
        and a viewer scrolls past one series to reach the next panel. A fixed height reads the
        same at every width and keeps R-N9's order legible as an order. It is set on the slot
        rather than passed to `ChartFrame`, whose `dimension` prop is the test escape hatch
        (R-T29) and not a layout control.
      */}
      <div className="mt-5 [&_[data-slot=chart]]:aspect-auto [&_[data-slot=chart]]:h-72">
        {props.children}
      </div>
      {props.footnote ? (
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {props.footnote}
        </p>
      ) : null}
    </section>
  );
}
