// **A token chart: `ChartFrame` with a measure axis in K, M and B** (ticket 69).
//
// It exists for `money-chart.tsx`'s reason, and it is the same reason twice over. `ChartFrame` is
// a Client Component and `tickFormat` is a **function**; a Server Component cannot hand a
// function across that boundary — React refuses it at render time, not at build time, so the page
// compiles, typechecks and passes every jsdom test while failing in the browser. This module is
// `"use client"`, so `tokensTick` is closed over on the client side of the line and the Adoption
// section (a Server Component) passes only serialisable props.
//
// **The axis and the column agree because they read the same unit, not because they share a
// function.** A Tokens column renders through `formatFigure(cell, "tokens")` and carries one
// decimal where the mantissa has room for it; an axis tick carries none, because a tick is a
// position on a scale rather than a figure to be read off. Both spellings live in `figures.ts`,
// which is what keeps "a token figure reads in K, M and B" one decision.
//
// **It computes nothing** (R-T6) and decides nothing about the chart: the ViewModel goes through
// untouched, and the only thing added is how a measure-axis tick reads.

"use client";

import { ChartFrame } from "@/components/charts/chart-frame";
import type { ChartViewModel } from "@/domain/viewmodel";
import { tokensTick } from "./figures";

export function TokenChart(props: {
  readonly chart: ChartViewModel;
  readonly shape: "area" | "bar";
  /** R-T29 / T-C0 — set by tests only; a page leaves it off and gets the responsive path. */
  readonly dimension?: { readonly width: number; readonly height: number };
}) {
  return (
    <ChartFrame
      chart={props.chart}
      shape={props.shape}
      tickFormat={tokensTick}
      dimension={props.dimension}
    />
  );
}
