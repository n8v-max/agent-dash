// **A money chart: `ChartFrame` with a currency tick format.**
//
// It exists for one reason, and the reason is the server/client boundary rather than taste.
// `ChartFrame` is a Client Component and `tickFormat` is a **function**; a Server Component
// cannot hand a function across that boundary — React refuses it at render time, not at build
// time, so the page compiles, typechecks and passes every jsdom test while failing in the
// browser. The fix is to create the function on the client side of the line: this module is
// `"use client"`, so `usdTick` is closed over here and the page passes only serialisable props.
//
// **It computes nothing** (R-T6) and decides nothing about the chart: the ViewModel goes
// through untouched, and the only thing added is how a measure-axis tick reads.

"use client";

import { ChartFrame } from "@/components/charts/chart-frame";
import type { ChartViewModel } from "@/domain/viewmodel";
import { usdTick } from "./figures";

export function MoneyChart(props: {
  readonly chart: ChartViewModel;
  readonly shape: "line" | "bar";
  /** R-T29 / T-C0 — set by tests only; a page leaves it off and gets the responsive path. */
  readonly dimension?: { readonly width: number; readonly height: number };
}) {
  return (
    <ChartFrame
      chart={props.chart}
      shape={props.shape}
      tickFormat={usdTick}
      dimension={props.dimension}
    />
  );
}
