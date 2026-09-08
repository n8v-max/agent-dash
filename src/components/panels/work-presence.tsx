// **R-N12 panel 6 — human presence and machine time, `interactive` sessions only** (R-N14, A27).
//
// **The restriction is rendered twice, and neither rendering is written here.** The pill reads
// the composition's `executionMode`, a field whose type is the literal `"interactive"` and which
// can therefore hold nothing else; the sentence under it is the ViewModel's own `note`, computed
// in the same pass as the figures so it cannot disagree with them. A `headless` session is AFK
// for its entire lifetime by construction, so a view spanning both modes would only rediscover
// which sessions were headless — the note says that, with the counts.
//
// **It stacks because the ViewModel says it may** (R-V1, T-C11). The three spans are disjoint and
// sum to `machine_allocation_duration_s` exactly (R-T12), so they are a true partition and
// `viewmodel.ts` sets `stackable: true`; `chart-shapes.tsx` is the only producer of a `stackId`
// in the product and it reads that flag. **Nothing in this file decides it** — there is no prop
// here that could, which is why the panel passes only a shape and a tick format.
//
// The three spans and the total they sum to are shown together above the chart, **as durations
// with their share underneath**. The durations are the figures that add up — three whole
// percentages rounded independently sum to 101% about as often as they sum to 100%, and a panel
// whose whole justification for stacking is that its parts sum exactly (R-T12, R-V1) should not
// print a total that appears not to.
//
// **It computes nothing** (R-T6). The shares, the seconds, the counts and the sentence all
// arrived resolved.

"use client";

import { ChartFrame } from "@/components/charts/chart-frame";
import type { PresenceSpansPanel } from "@/data/queries";
import { countText, durationText, hoursTick, percentText } from "./work-format";
import { PANEL_CHART, WorkPanel, type PanelFigure } from "./work-section";

type SpanKey = PresenceSpansPanel["composition"]["slices"][number]["key"];

/**
 * Copy, and only copy. The keys are a closed vocabulary in `src/domain/metrics/duration.ts`, so
 * a fourth span would fail to compile here rather than render as a bare key.
 */
const SPAN_LABELS: Readonly<Record<SpanKey, string>> = {
  interactive: "Interactive",
  idle: "Idle",
  afk: "AFK",
};

/** The whole the three spans partition, named as what it is: time a machine was held. */
const MACHINE_ALLOCATION = "machine-allocation";

const figuresFor = (composition: PresenceSpansPanel["composition"]): readonly PanelFigure[] => [
  ...composition.slices.map((slice) => ({
    key: slice.key,
    label: SPAN_LABELS[slice.key],
    value: durationText(slice.total),
    detail: `${percentText(slice.share)} of machine time`,
  })),
  {
    key: MACHINE_ALLOCATION,
    label: "Machine allocation",
    value: durationText(composition.total),
    detail: `${countText(composition.sessions)} interactive sessions`,
  },
];

/** R-N14's restriction, in the one word the ViewModel's type permits it to be. */
function InteractiveOnly(props: { readonly mode: "interactive" }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground first-letter:uppercase">
      {props.mode} sessions only
    </span>
  );
}

export function PresenceSpans(props: { readonly panel: PresenceSpansPanel }) {
  const { chart, composition } = props.panel;

  return (
    <WorkPanel
      title={chart.title}
      badge={<InteractiveOnly mode={composition.executionMode} />}
      note={composition.note}
      figures={figuresFor(composition)}
    >
      <ChartFrame chart={chart} shape="area" tickFormat={hoursTick} className={PANEL_CHART} />
    </WorkPanel>
  );
}
