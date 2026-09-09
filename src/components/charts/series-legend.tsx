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
//
// **R-V15 — the legend wraps** (ticket 46). shadcn ships its legend row as `flex` with no
// `flex-wrap`, so five entries at 390px ran off both edges of the card and Recharts' own
// `overflow: hidden` cut the first and last labels in half — a legend that silently deletes two
// of the five names it exists to give. `flex-wrap` is passed as a class rather than patched into
// the vendored file, which keeps `chart.tsx` a verbatim copy of upstream and keeps this the only
// place the product has an opinion about how a legend lays out. This is patch 5 in the R-T32
// sense: applied on encounter, and the encounter was a phone.

"use client";

import type { ComponentProps } from "react";
import { ChartLegendContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/** The container's accessible name. T-C3 scopes its queries with it. */
export const LEGEND_LABEL = "Chart legend";

/** R-V15. `gap-y` is tighter than `gap-x` so a second row reads as one legend, not two. */
export const LEGEND_LAYOUT = "flex-wrap gap-x-4 gap-y-1";

export function SeriesLegend(props: ComponentProps<typeof ChartLegendContent>) {
  return (
    <div role="group" aria-label={LEGEND_LABEL}>
      <ChartLegendContent {...props} className={cn(LEGEND_LAYOUT, props.className)} />
    </div>
  );
}
