// `/demo/work` panels 4, 5 and 6 (R-N12), split out of `work.ts` for the file-size budget.
//
//   4. Incomplete Tasks by age bucket (R-M16) — the one chart whose columns are ages, not periods.
//   5. Session duration, median and p95 (R-M1) — two readings, **one chart each**, and no mean
//      (T-U19). See `DurationPanel` for why they no longer share an axis.
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

/**
 * **R-N12 panel 5 — two small multiples, not one chart** (ticket 41).
 *
 * Median and p95 are the same measure at two very different magnitudes: over the committed
 * fixture the p95 is roughly 4.4× the median, so on one shared linear axis the median line sits
 * on the floor of the panel and its *shape* — the only thing a trend line is read for — is
 * unreadable. The two alternatives were a log axis and two panels; two panels won, and the
 * reasoning is in ticket 41's closing note.
 *
 * `title` is the panel's heading and belongs to neither chart, because with two charts under it
 * there is no single `chart.title` for `WorkPanel` to take (`work-section.tsx`'s rule that the
 * heading is the ViewModel's, not the component's, still holds — it just needs its own field).
 */
export type DurationPanel = {
  readonly title: string;
  readonly median: ChartViewModel;
  readonly p95: ChartViewModel;
  /** Median and p95 over the whole range. **There is no mean** (T-U19). */
  readonly summary: DurationSummary;
};

export type PresenceSpansPanel = {
  readonly chart: ChartViewModel;
  /** Carries `executionMode: "interactive"`, the excluded count, and A27's note in words. */
  readonly composition: SpanComposition;
};

/** The two order statistics R-M1 names. **There is no third, and no mean** (T-U19). */
type DurationStatistic = "median" | "p95";

/** The series label inside each chart — what its legend and its mirror column read. */
const DURATION_LABELS: Readonly<Record<DurationStatistic, string>> = {
  median: "Median",
  p95: "p95",
};

/** Each multiple's own title, so `aria-label` and the mirror caption name which one it is. */
const DURATION_TITLES: Readonly<Record<DurationStatistic, string>> = {
  median: "Median session duration",
  p95: "p95 session duration",
};

/** The panel's heading. Two charts sit under it, so it is neither chart's title. */
const DURATION_TITLE = "Session duration";

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

/** One statistic, on its own axis. The two charts are built identically and read separately. */
const durationChart = (
  context: PageContext,
  view: ReturnType<PageContext["view"]>,
  statistic: DurationStatistic,
): ChartViewModel =>
  chartViewModel({
    title: DURATION_TITLES[statistic],
    rollUpLevel: "Session",
    // One unlike reading of one population: an order statistic partitions nothing (R-V1).
    grouping: "measure",
    measure: "ratio",
    buckets: bucketAxis(context, view.buckets),
    cells: aggregationCells({
      buckets: view.buckets,
      keysOf: () => [statistic],
      valueOf: (rows) => sessionDurationSummary(rows)[statistic],
      groups: [statistic],
    }),
    labelOf: () => DURATION_LABELS[statistic],
  });

/** R-N12 panel 5 — Session duration, median and p95 (R-M1). Wall clock, per `duration.ts`. */
export function durationPanel(context: PageContext): DurationPanel {
  const view = context.view("jobs");

  return {
    title: DURATION_TITLE,
    median: durationChart(context, view, "median"),
    p95: durationChart(context, view, "p95"),
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
