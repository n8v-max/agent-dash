// **R-N12 panel 2 — acceptance rate as small multiples** (R-N13, A21).
//
// **The layout is the argument.** Acceptance rate is defined only *within* a WorkType (R-M6): the
// criterion is the WorkType's own — a published pull request for `implementation`, a submitted
// review for `review`, a commit on the default branch for `deploy` — so a figure spanning two of
// them would average two different questions. Five equal tiles, all five present at once, each
// headed by its template and each carrying its own figure, say that with **no caption**. A single
// chart behind a WorkType selector would say the opposite: four of the five values hidden, and a
// viewer having to click to discover that the comparison is not offered.
//
// **A21 — there is no cross-WorkType acceptance figure here, and no expression that could make
// one.** The absence is structural rather than remembered: `AcceptancePanel` carries `workType`
// and `rate: AcceptanceRate`, whose own `work_type` field names the criterion it was measured
// against, and the query layer returns five of them with no shape for a sixth (`work.ts`). This
// module renders one tile per panel it is handed and holds no arithmetic — no mean of the five,
// no total, no "all templates" tile. `work-page-panels.test.tsx` asserts that as an absence over
// this module's source, and `work-acceptance.test.tsx` asserts it over the rendered output.
//
// **The shared axis** (`acceptanceAxis`) is the ViewModel's, and the comparison rail under each
// figure is drawn against it: one track per tile, all five the same width, each filled to its own
// share of the same 0–100%, and each carrying that axis as `aria-valuemin` / `aria-valuemax` so
// the scale is data rather than a visual convention. That is what makes the five figures
// comparable *at a glance* — the panel's whole reason for existing — without a caption saying so.
// **The tiles' time series do not yet share that axis, and cannot from here.** `ChartFrame` takes
// a chart, a shape, a tick format and a class name; there is no prop for a measure-axis domain,
// and `chart-shapes.tsx` renders `<YAxis>` with no `domain`, so Recharts falls back to
// `[0, 'auto']` and every multiple scales to its own maximum. At week grain the fixture hides it
// — every WorkType reaches 1.0 in some week, so all five land on 0–100% — but at month grain the
// axes are 0–100%, 0–80%, 0–100%, 0–100% and 0–60%, and `deploy` at 33% draws as tall as
// `implementation` at 67%. Closing it is a three-line additive change to a file this ticket may
// not touch (`ChartFrame` takes `measureDomain?: readonly [number, number]`, `axesFor` passes it
// to the numeric axis), fed from `acceptanceAxis` so the domain still supplies the scale. It is
// reported rather than made here, and the rail above carries the comparison in the meantime.
//
// **It computes nothing** (R-T6). The rates, counts and labels all arrived resolved; the one
// expression below is a scale mapping — a value's position on the axis the ViewModel declared,
// which is the same thing a chart's own scale does with a domain.

"use client";

import { ChartFrame } from "@/components/charts/chart-frame";
import type { AcceptancePanel, WorkPageViewModel } from "@/data/queries";
import { countText, percentText, percentTick } from "./work-format";
import { TILE_CHART, WorkPanel } from "./work-section";

/** R-N12's own words for panel 2. "Template" is the UI alias of WorkType (`CONTEXT.md`). */
export const ACCEPTANCE_TITLE = "Acceptance rate by template";

type AcceptanceAxis = WorkPageViewModel["acceptanceAxis"];

/** A figure's position on the shared axis, as a CSS width. `null` where there is no figure. */
const railWidth = (rate: number | null, axis: AcceptanceAxis): string | null =>
  rate === null ? null : percentText((rate - axis.min) / (axis.max - axis.min));

/**
 * The shared-axis rail — one WorkType's rate, on the axis all five are read against.
 *
 * `role="meter"` rather than a decorative `<div>`: the axis endpoints are the ViewModel's own
 * `acceptanceAxis`, and a meter is the one role that carries a value *and* the scale it sits on,
 * so the shared axis reaches a screen reader as the same fact a sighted reader sees.
 */
function AcceptanceRail(props: {
  readonly panel: AcceptancePanel;
  readonly axis: AcceptanceAxis;
}) {
  const rate = props.panel.rate.rate;
  const width = railWidth(rate, props.axis);

  return (
    <div
      role="meter"
      aria-label={`${props.panel.title} acceptance rate`}
      aria-valuemin={props.axis.min}
      aria-valuemax={props.axis.max}
      aria-valuenow={rate ?? undefined}
      aria-valuetext={percentText(rate)}
      className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      {width === null ? null : (
        <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width }} />
      )}
    </div>
  );
}

/** One multiple. Its name, its figure, its rail and its trend — and one WorkType throughout. */
function AcceptanceTile(props: {
  readonly panel: AcceptancePanel;
  readonly axis: AcceptanceAxis;
}) {
  const { panel } = props;

  return (
    <section
      aria-label={panel.chart.title}
      className="rounded-lg border border-border/70 bg-background p-4"
    >
      <h3 className="text-sm font-medium tracking-tight text-foreground">{panel.title}</h3>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {percentText(panel.rate.rate)}
      </p>
      <AcceptanceRail panel={panel} axis={props.axis} />
      <p className="mt-2 text-xs text-muted-foreground">
        {countText(panel.rate.accepted)} of {countText(panel.rate.sessions)} sessions accepted
      </p>
      <ChartFrame
        chart={panel.chart}
        shape="line"
        tickFormat={percentTick}
        className={`mt-3 ${TILE_CHART}`}
      />
    </section>
  );
}

/**
 * **Panel 2.** One tile per WorkType the query returned, in the order it returned them, and
 * nothing else in the panel — no aggregate tile, no selector, no "all templates" arm.
 */
export function AcceptanceMultiples(props: {
  readonly panels: readonly AcceptancePanel[];
  readonly axis: AcceptanceAxis;
}) {
  return (
    <WorkPanel title={ACCEPTANCE_TITLE}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {props.panels.map((panel) => (
          <AcceptanceTile key={panel.workType} panel={panel} axis={props.axis} />
        ))}
      </div>
    </WorkPanel>
  );
}
