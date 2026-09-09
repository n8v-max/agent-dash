// **R-N12 panels 1, 3, 4 and 5** — the four single-chart panels of `/[org]/work`.
//
//   1. **Completed Jobs per period**, raw or per-capita. Velocity is Completed Jobs and not
//      session counts, because session counts *rise* when work goes badly. Per-capita divides by
//      active human Members (R-M14) — service accounts hold no seat and would give the
//      denominator the wrong size — and the denominator is shown whenever the toggle is on, so
//      the figure is never a ratio whose divisor a reader has to guess at.
//   3. **Rework and Decomposition**, two lines on one chart. Both are Job-grain shares of the
//      same population, which is what makes them readable together; they are independent labels
//      rather than a partition, so the chart is a line chart and nothing about it stacks.
//   4. **Incomplete Jobs by age bucket** (R-M16), horizontally, because the four categories are
//      long words and the axis they belong on is the one with room for them.
//   5. **Session duration — median and p95** (R-M1), as **two small multiples side by side**.
//      Two unlike readings of one population, so `measure` is the grouping and the geometry
//      claims no part of a whole — and, since the p95 is several times the median, they get an
//      axis each rather than one axis that flattens the median onto the floor (ticket 41). There
//      is no mean: the distribution is right-skewed and a mean would report a session nobody ran.
//
// **The overlap statement is not rendered here** (R-V3, T-C8). Where the subject control groups
// by Team the ViewModel carries `overlapNote` and `ChartFrame` renders it, once, for every chart
// in the product. A panel repeating it would be the same sentence twice.
//
// **They compute nothing** (R-T6). Every figure below arrived resolved on a ViewModel; this file
// formats and lays out, and holds no arithmetic over a figure at all.

"use client";

import type { ReactNode } from "react";
import { ChartFrame } from "@/components/charts/chart-frame";
import type {
  DurationPanel,
  IncompleteAgesPanel,
  TaskRatesPanel,
  VelocityPanel,
} from "@/data/queries";
import {
  countOrAbsence,
  countText,
  durationText,
  hoursTick,
  percentText,
  percentTick,
} from "./work-format";
import { HALF_CHART, PANEL_CHART, WorkPanel, type PanelFigure } from "./work-section";

/** R-M14's denominator, said in words where the toggle is on. Copy — the number is the ViewModel's. */
const perCapitaNote = (panel: VelocityPanel): string | null =>
  panel.perCapita
    ? `Per Member: divided by ${countText(panel.denominator)} active human Members. Service accounts hold no seat and are excluded from the denominator.`
    : null;

/** **Panel 1.** Completed Jobs per period, raw or per-capita. */
export function VelocityChart(props: {
  readonly panel: VelocityPanel;
  /** R-C6 — the per-capita toggle, in the header of the one panel on this page it divides. */
  readonly controls?: ReactNode;
}) {
  return (
    <WorkPanel
      title={props.panel.chart.title}
      note={perCapitaNote(props.panel)}
      controls={props.controls}
    >
      <ChartFrame chart={props.panel.chart} shape="bar" className={PANEL_CHART} />
    </WorkPanel>
  );
}

const TASK_RATE_NOTE =
  "Both are Job-grain shares of the Jobs in the selection, not of sessions. Rework and Decomposition are independent labels on a Job rather than a partition of it, so a Job can exhibit both.";

const taskRateFigures = (panel: TaskRatesPanel): readonly PanelFigure[] => [
  {
    key: "rework",
    label: "Rework rate",
    value: percentText(panel.rework.rate),
    detail: `${countText(panel.rework.count)} of ${countText(panel.rework.tasks)} Jobs`,
  },
  {
    key: "decomposition",
    label: "Decomposition rate",
    value: percentText(panel.decomposition.rate),
    detail: `${countText(panel.decomposition.count)} of ${countText(panel.decomposition.tasks)} Jobs`,
  },
];

/** **Panel 3.** Rework rate and Decomposition rate, two Job-grain rates on one chart. */
export function TaskRatesChart(props: { readonly panel: TaskRatesPanel }) {
  return (
    <WorkPanel
      title={props.panel.chart.title}
      note={TASK_RATE_NOTE}
      figures={taskRateFigures(props.panel)}
    >
      <ChartFrame
        chart={props.panel.chart}
        shape="line"
        tickFormat={percentTick}
        className={PANEL_CHART}
      />
    </WorkPanel>
  );
}

const INCOMPLETE_NOTE =
  "Age since the last session, in half-open buckets. The platform does not own the Job's lifecycle and cannot tell in-flight from abandoned, so the age carries what a status label could not claim.";

const incompleteFigures = (panel: IncompleteAgesPanel): readonly PanelFigure[] => [
  {
    key: "incomplete",
    label: "Incomplete Jobs",
    value: countText(panel.ages.total),
    detail:
      panel.ages.unaged.length === 0
        ? undefined
        : `${countText(panel.ages.unaged.length)} carry no readable last session and are not aged`,
  },
];

/** **Panel 4.** Incomplete Jobs as a horizontal bar by age bucket (R-M16). */
export function IncompleteAgesChart(props: { readonly panel: IncompleteAgesPanel }) {
  return (
    <WorkPanel
      title={props.panel.chart.title}
      note={INCOMPLETE_NOTE}
      figures={incompleteFigures(props.panel)}
    >
      <ChartFrame chart={props.panel.chart} shape="horizontal-bar" className={PANEL_CHART} />
    </WorkPanel>
  );
}

const DURATION_NOTE =
  "Wall clock, start to end. Median and p95 are nearest-rank order statistics, so each is a duration some session actually had. The distribution is right-skewed, so there is no mean. A session is one attempt however many agents worked it: a sub-agent runs inside its root's window, so the wall clock is the root's, and its machine time is the whole tree's.";

const durationFigures = (panel: DurationPanel): readonly PanelFigure[] => [
  {
    key: "median",
    label: "Median",
    value: durationText(panel.summary.median),
    detail: `${countText(panel.summary.count)} sessions`,
  },
  { key: "p95", label: "p95", value: durationText(panel.summary.p95) },
  // R-M19 — the fan-out, at the same two order statistics. A session that spawned nothing
  // counts one agent, so the median is 1 wherever most attempts are worked by one agent.
  {
    key: "agents-median",
    label: "Agents per session",
    value: countOrAbsence(panel.agents.median),
    detail: `${countText(panel.agents.agents)} agents across ${countText(panel.agents.sessions)} sessions`,
  },
  { key: "agents-p95", label: "Agents p95", value: countOrAbsence(panel.agents.p95) },
];

/**
 * **Panel 5.** Session duration — median and p95, and no third figure.
 *
 * **Two small multiples, each on its own axis** (ticket 41). Drawn together on one linear axis the
 * median sat on the floor: the p95 is ~4.4× it over the committed fixture, so the axis was the
 * p95's and the median line was a flat rule along the bottom of the panel with no readable shape.
 * Side by side, each line is read for its own trend and the two are compared through the figure
 * strip above them, which is where the *magnitudes* belong. The alternative — a log axis — is
 * rejected in the ticket's closing note.
 *
 * Both charts keep their axes and their legends: a tick strip is what makes a duration line a
 * duration, and the one-entry legend is how a reader tells the left chart from the right one.
 */
export function DurationChart(props: {
  readonly panel: DurationPanel;
  /** R-C6 / R-C2 — the `execution_mode` filter, in the header of one of the two panels it is for. */
  readonly controls?: ReactNode;
}) {
  const { panel } = props;

  return (
    <WorkPanel
      title={panel.title}
      note={DURATION_NOTE}
      figures={durationFigures(panel)}
      controls={props.controls}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {[panel.median, panel.p95].map((chart) => (
          <ChartFrame
            key={chart.title}
            chart={chart}
            shape="line"
            tickFormat={hoursTick}
            className={HALF_CHART}
          />
        ))}
      </div>
    </WorkPanel>
  );
}
