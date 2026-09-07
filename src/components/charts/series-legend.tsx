// shadcn's `ChartLegendContent`, given a container that says what it is.
//
// Two reasons, both structural rather than cosmetic:
//
//   * **The legend is announced.** `ChartLegendContent` renders an unlabelled row of `<div>`s;
//     inside a `role="group"` with a name, a screen-reader user reaches "Chart legend" and its
//     entries instead of five anonymous boxes. The swatches themselves get their names from
//     `chart-config.tsx`'s `icon`, which `ChartConfig` already permits.
//
//   * **It is scopable.** T-C3 has to compare *legend* entries either side of a roll-up switch,
//     and the series labels also appear in the R-X1 mirror's column headings. Without a named
//     container the query would have to reach for `.recharts-legend-wrapper`, which is Recharts'
//     internal class name and not something a test should depend on.
//
// The vendored component is rendered unchanged and is the thing under test in T-C3: this file
// wraps it, it does not replace it.

"use client";

import type { ComponentProps } from "react";
import { ChartLegendContent } from "@/components/ui/chart";

/** The container's accessible name. T-C3 scopes its queries with it. */
export const LEGEND_LABEL = "Chart legend";

export function SeriesLegend(props: ComponentProps<typeof ChartLegendContent>) {
  return (
    <div role="group" aria-label={LEGEND_LABEL}>
      <ChartLegendContent {...props} />
    </div>
  );
}
