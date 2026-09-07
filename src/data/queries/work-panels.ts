// `/demo/work` panels 4, 5 and 6 (R-N12), split out of `work.ts` for the file-size budget.
//
//   4. Incomplete Tasks by age bucket (R-M16) — the one chart whose columns are ages, not periods.
//   5. Session duration, median and p95 (R-M1) — two readings on one chart, and no mean (T-U19).
//   6. Human-presence spans, `interactive` sessions only (R-N14, A27) — the composition R-V1
//      stacks, because the three spans sum to `machine_allocation_duration_s` exactly (R-T12).

import {
  incompleteTaskAges,
  taskFacts,
  type IncompleteTaskAges,
} from "@/domain/metrics/efficacy";
import {
  PRESENCE_SPANS,
  sessionDurationSummary,
  spanComposition,
  spansOf,
  type DurationSummary,
  type PresenceSpan,
  type SpanComposition,
} from "@/domain/metrics/duration";
import type { AgentSession } from "@/domain/types";
import { chartViewModel, type ChartViewModel } from "@/domain/viewmodel";
import type { PageContext } from "./context";
import { aggregationCells, bucketAxis } from "./panels";

export type IncompleteAgesPanel = {
  readonly chart: ChartViewModel;
  /** The buckets, the aged Tasks and the count — R-M16's half-open edges, carried as computed. */
  readonly ages: IncompleteTaskAges;
};

export type DurationPanel = {
  readonly chart: ChartViewModel;
  /** Median and p95 over the whole range. **There is no mean** (T-U19). */
  readonly summary: DurationSummary;
};

export type PresenceSpansPanel = {
  readonly chart: ChartViewModel;
  /** Carries `executionMode: "interactive"`, the excluded count, and A27's note in words. */
  readonly composition: SpanComposition;
};

const DURATION_SERIES = ["median", "p95"] as const;
type DurationSeries = (typeof DURATION_SERIES)[number];

const DURATION_LABELS: Readonly<Record<DurationSeries, string>> = {
  median: "Median",
  p95: "p95",
};

const isSpan = (key: string): key is PresenceSpan =>
  PRESENCE_SPANS.some((span) => span === key);

const SPAN_LABELS: Readonly<Record<PresenceSpan, string>> = {
  interactive: "Interactive",
  idle: "Idle",
  afk: "AFK",
};

/** R-N12 panel 4 — Incomplete Tasks as a horizontal bar by age bucket (R-M16). */
export function incompleteAgesPanel(context: PageContext): IncompleteAgesPanel {
  const view = context.view("jobs");
  const ages = incompleteTaskAges(taskFacts(view.rows), context.params.now);

  return {
    chart: chartViewModel({
      title: "Incomplete Jobs by age",
      rollUpLevel: "Age since last session",
      // The four buckets are one measure cut by age; nothing is grouped, so nothing is stacked.
      grouping: "measure",
      measure: "additive",
      buckets: ages.buckets.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        // R-M16's buckets are ages, not periods: none of them is clipped or unfinished.
        partial: false,
      })),
      cells:
        ages.total === 0
          ? []
          : ages.buckets.map((bucket) => ({
              bucket: bucket.key,
              group: "incomplete",
              value: bucket.count,
            })),
      labelOf: () => "Incomplete Jobs",
      bucketColumn: "Age since last session",
    }),
    ages,
  };
}

/** R-N12 panel 5 — Session duration, median and p95 (R-M1). Wall clock, per `duration.ts`. */
export function durationPanel(context: PageContext): DurationPanel {
  const view = context.view("jobs");

  return {
    chart: chartViewModel({
      title: "Session duration",
      rollUpLevel: "Session",
      // Two unlike readings of one population: a median and a p95 partition nothing (R-V1).
      grouping: "measure",
      measure: "ratio",
      buckets: bucketAxis(context, view.buckets),
      cells: aggregationCells({
        buckets: view.buckets,
        keysOf: () => DURATION_SERIES,
        valueOf: (rows, group) =>
          group === "p95" ? sessionDurationSummary(rows).p95 : sessionDurationSummary(rows).median,
        groups: DURATION_SERIES,
      }),
      labelOf: (key) => DURATION_LABELS[key as DurationSeries] ?? key,
    }),
    summary: sessionDurationSummary(view.rows),
  };
}

/**
 * R-N12 panel 6 — human-presence spans and machine time, **`interactive` sessions only**
 * (R-N14, A27). The three spans are disjoint and sum to machine allocation exactly (R-T12), so
 * they are a true partition and stack legitimately (R-V1).
 */
export function presenceSpansPanel(context: PageContext): PresenceSpansPanel {
  const view = context.view("jobs");
  const interactive = (row: AgentSession): boolean => row.execution_mode === "interactive";

  return {
    chart: chartViewModel({
      title: "Human presence and machine time",
      rollUpLevel: "Presence span (interactive sessions only)",
      grouping: "presence_span",
      measure: "additive",
      buckets: bucketAxis(context, view.buckets),
      cells: aggregationCells({
        buckets: view.buckets,
        // R-N14 — the restriction is applied where the rows are keyed, so a headless session is
        // in no series at all rather than in one that is filtered later.
        keysOf: (row) => (interactive(row) ? PRESENCE_SPANS : []),
        valueOf: (rows, group) =>
          isSpan(group) ? rows.reduce((running, row) => running + spansOf(row)[group], 0) : null,
        groups: PRESENCE_SPANS,
      }),
      labelOf: (key) => (isSpan(key) ? SPAN_LABELS[key] : key),
      partition: true,
    }),
    composition: spanComposition(view.rows),
  };
}
