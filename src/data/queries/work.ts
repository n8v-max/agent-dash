// `/demo/work` — whether the agents are working (R-N12, R-N13, R-N14).
//
// **Acceptance rate is small multiples, never a selector** (R-N13). Acceptance rate is defined
// only *within* a WorkType (R-M6), and one chart per WorkType on a shared axis makes that
// visible with no caption; a selector would hide four of five values and make a viewer click to
// discover that the comparison is not offered. So this query returns **five** acceptance
// ViewModels, and there is no shape here for a sixth, org-level one to be returned in.
//
// **Completed Tasks per period is the velocity measure** (`CONTEXT.md`): session counts are not
// velocity, because they rise when work goes badly. Per-capita divides by active human Members
// (R-M14) and is a toggle, never the default.

import type { Viewer } from "@/domain/access";
import { rollUp } from "@/domain/aggregate";
import {
  acceptanceRateWithin,
  decompositionRate,
  reworkRate,
  taskFacts,
  type AcceptanceRate,
} from "@/domain/metrics/efficacy";
import { completedTaskKeys } from "@/domain/metrics/spend";
import { WORK_TYPE_KEYS, type AgentSession, type WorkTypeKey } from "@/domain/types";
import { chartViewModel, type ChartViewModel } from "@/domain/viewmodel";
import type { ControlSet } from "../params";
import { pageContext, type PageContext } from "./context";
import { aggregationCells, bucketAxis, subjectGrouping } from "./panels";
import {
  durationPanel,
  incompleteAgesPanel,
  presenceSpansPanel,
  type DurationPanel,
  type IncompleteAgesPanel,
  type PresenceSpansPanel,
} from "./work-panels";

/** R-N12 panel 1 — velocity, raw or per-capita (R-M14). */
export type VelocityPanel = {
  readonly chart: ChartViewModel;
  /** R-M14 — offered only where more than one Member is aggregated, and never the default. */
  readonly perCapita: boolean;
  /** Active human Members: the denominator per-capita divides by, and zero otherwise. */
  readonly denominator: number;
  readonly perCapitaAvailable: boolean;
};

/** R-N13 — one of the five small multiples. `workType` is on the type, so it cannot be shown without it. */
export type AcceptancePanel = {
  readonly workType: WorkTypeKey;
  readonly title: string;
  readonly chart: ChartViewModel;
  /** The whole-range figure and the counts behind it, within this WorkType and no other. */
  readonly rate: AcceptanceRate;
};

/** R-N12 panel 3 — Rework and Decomposition, two Task-grain rates on one chart. */
export type TaskRatesPanel = {
  readonly chart: ChartViewModel;
  readonly rework: ReturnType<typeof reworkRate>;
  readonly decomposition: ReturnType<typeof decompositionRate>;
};

export type WorkPageViewModel = {
  readonly orgSlug: string;
  readonly velocity: VelocityPanel;
  /** Five, one per WorkType, on a shared 0–1 axis (R-N13). */
  readonly acceptance: readonly AcceptancePanel[];
  /** The shared axis the small multiples are read against. */
  readonly acceptanceAxis: { readonly min: number; readonly max: number };
  readonly taskRates: TaskRatesPanel;
  readonly incompleteAges: IncompleteAgesPanel;
  readonly duration: DurationPanel;
  readonly presenceSpans: PresenceSpansPanel;
};

const TASK_RATE_SERIES = ["rework", "decomposition"] as const;
const TASK_RATE_LABELS: Readonly<Record<string, string>> = {
  rework: "Rework rate",
  decomposition: "Decomposition rate",
};

const completedTasks = (rows: readonly AgentSession[]): number => completedTaskKeys(rows).length;

const velocityPanel = (context: PageContext): VelocityPanel => {
  const view = context.view("jobs");
  const subject = subjectGrouping(context, view, () => 0);
  const perCapita = context.params.perCapita;
  // R-M14 — the denominator is the *population's* active human Members, never the rows' authors.
  const population = rollUp(
    { rows: [], measure: () => 0, members: context.population, teams: context.data.teams },
    "organization",
  ).perCapita;
  const divisor = population.denominator === 0 ? 1 : population.denominator;

  return {
    chart: chartViewModel({
      title: perCapita ? "Completed Jobs per period, per Member" : "Completed Jobs per period",
      rollUpLevel: subject.rollUpLevel,
      grouping: subject.grouping,
      // A per-capita figure is a ratio; the raw count is a sum of the population's Tasks.
      measure: perCapita ? "ratio" : "additive",
      buckets: bucketAxis(context, view.buckets),
      cells: aggregationCells({
        buckets: view.buckets,
        keysOf: subject.keysOf,
        valueOf: (rows) => (perCapita ? completedTasks(rows) / divisor : completedTasks(rows)),
      }),
      labelOf: subject.labelOf,
      partition: subject.partition,
      overlapNote: subject.overlapNote,
    }),
    perCapita,
    denominator: population.denominator,
    perCapitaAvailable: population.available,
  };
};

/**
 * One WorkType's acceptance rate over time. The population is filtered to that WorkType by
 * `acceptanceRateWithin`, which is the only way to compute the figure at all (R-M6).
 */
const acceptancePanel = (context: PageContext, workType: WorkTypeKey): AcceptancePanel => {
  const view = context.view("jobs");
  const name = context.label.workType(workType);

  return {
    workType,
    title: name,
    chart: chartViewModel({
      title: `Acceptance rate — ${name}`,
      rollUpLevel: `WorkType: ${name}`,
      grouping: "measure",
      // A rate is not a part of a whole; and R-M6 means there is no whole to be part of.
      measure: "ratio",
      buckets: bucketAxis(context, view.buckets),
      cells: aggregationCells({
        buckets: view.buckets,
        keysOf: (row) => (row.work_type === workType ? [workType] : []),
        valueOf: (rows) => acceptanceRateWithin(workType, rows).rate,
        groups: [workType],
      }),
      labelOf: () => name,
    }),
    rate: acceptanceRateWithin(workType, view.rows),
  };
};

const taskRatesPanel = (context: PageContext): TaskRatesPanel => {
  const view = context.view("jobs");
  const tasks = taskFacts(view.rows);

  return {
    chart: chartViewModel({
      title: "Rework and Decomposition",
      rollUpLevel: "Job",
      grouping: "measure",
      measure: "ratio",
      buckets: bucketAxis(context, view.buckets),
      cells: aggregationCells({
        buckets: view.buckets,
        keysOf: () => TASK_RATE_SERIES,
        valueOf: (rows, group) => {
          const within = taskFacts(rows);
          return group === "rework"
            ? reworkRate(within).rate
            : decompositionRate(within).rate;
        },
        groups: TASK_RATE_SERIES,
      }),
      labelOf: (key) => TASK_RATE_LABELS[key] ?? key,
    }),
    rework: reworkRate(tasks),
    decomposition: decompositionRate(tasks),
  };
};

/** **`/demo/work`.** One call, six panels, one load and one permission filter (R-T16, R-T17). */
export function workPage(viewer: Viewer, params: ControlSet): WorkPageViewModel {
  const context = pageContext(viewer, params);

  return {
    orgSlug: params.orgSlug,
    velocity: velocityPanel(context),
    acceptance: WORK_TYPE_KEYS.map((workType) => acceptancePanel(context, workType)),
    // R-N13 — the multiples share one axis, and an acceptance rate is a share of 1.
    acceptanceAxis: { min: 0, max: 1 },
    taskRates: taskRatesPanel(context),
    incompleteAges: incompleteAgesPanel(context),
    duration: durationPanel(context),
    presenceSpans: presenceSpansPanel(context),
  };
}
