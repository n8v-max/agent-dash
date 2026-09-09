// A `WorkPageViewModel`, authored by hand, for the `/[org]/work` panel tests.
//
// **Literals, not a query.** `src/components/**` may import `src/domain` for types only (R-T6),
// so a component test cannot call `workPage()` to build its input and should not want to: what a
// panel owes is "render the ViewModel you were handed, faithfully", and what the *ViewModel* owes
// — that acceptance was computed within a WorkType (R-M6), that the spans sum to machine
// allocation (R-T12, T-U20), that `stackable` follows the partition (R-V1) — is asserted in
// `src/domain/**` and `src/data/**`, over the real functions and the committed fixture.
//
// The five acceptance rates are the committed fixture's own spread (R-D6): `review` 0.86 ·
// `bugfix` 0.79 · `implementation` 0.71 · `refactor` 0.58 · `deploy` 0.34. They are five
// *distinct* values with five distinct denominators, which is what lets `work-acceptance.test.tsx`
// assert A21 as an absence: any cross-WorkType figure a component could have synthesised — a
// mean, a total, a pooled rate — is a value none of the five holds, so its absence from the
// rendered output is evidence rather than coincidence.

import type {
  AcceptancePanel,
  DurationPanel,
  IncompleteAgesPanel,
  PresenceSpansPanel,
  TaskRatesPanel,
  VelocityPanel,
  WorkPageViewModel,
} from "@/data/queries";
import { chartFixture, type SeriesSpec } from "../charts/chart-viewmodels.fixture";

type WorkTypeKey = AcceptancePanel["workType"];

/** One acceptance multiple's facts, in `WORK_TYPE_KEYS` order — the order the query returns. */
const ACCEPTANCE: readonly {
  readonly key: WorkTypeKey;
  readonly name: string;
  readonly rate: number;
  readonly accepted: number;
  readonly sessions: number;
  readonly values: readonly number[];
}[] = [
  { key: "implementation", name: "Implementation", rate: 0.71, accepted: 71, sessions: 100, values: [0.69, 0.7, 0.71] },
  { key: "refactor", name: "Refactor", rate: 0.58, accepted: 58, sessions: 100, values: [0.6, 0.59, 0.58] },
  { key: "bugfix", name: "Bug fix", rate: 0.79, accepted: 79, sessions: 100, values: [0.77, 0.78, 0.79] },
  { key: "review", name: "Review", rate: 0.86, accepted: 86, sessions: 100, values: [0.84, 0.85, 0.86] },
  { key: "deploy", name: "Deploy", rate: 0.34, accepted: 34, sessions: 100, values: [0.36, 0.35, 0.34] },
];

/** The five multiples. `rate.work_type` names the criterion each figure was measured against. */
export const ACCEPTANCE_PANELS: readonly AcceptancePanel[] = ACCEPTANCE.map((held) => ({
  workType: held.key,
  title: held.name,
  chart: chartFixture({
    title: `Acceptance rate — ${held.name}`,
    rollUpLevel: `WorkType: ${held.name}`,
    series: [{ key: held.key, label: held.name, values: held.values }],
  }),
  rate: {
    work_type: held.key,
    sessions: held.sessions,
    accepted: held.accepted,
    rate: held.rate,
  },
}));

/** The shared axis the five are read against. An acceptance rate is a share of one. */
export const ACCEPTANCE_AXIS = { min: 0, max: 1 } as const;

export const VELOCITY: VelocityPanel = {
  chart: chartFixture({
    title: "Completed Jobs per period",
    rollUpLevel: "Organization",
    series: [{ key: "organization", label: "Acme", values: [120, 138, 151] }],
  }),
  perCapita: false,
  denominator: 17,
  perCapitaAvailable: true,
};

export const TASK_RATES: TaskRatesPanel = {
  chart: chartFixture({
    title: "Rework and Decomposition",
    rollUpLevel: "Job",
    series: [
      { key: "rework", label: "Rework rate", values: [0.22, 0.24, 0.19] },
      { key: "decomposition", label: "Decomposition rate", values: [0.31, 0.33, 0.36] },
    ],
  }),
  rework: { tasks: 210, count: 44, rate: 0.21 },
  decomposition: { tasks: 210, count: 69, rate: 0.33 },
};

const AGE_BUCKETS = ["0–7 days", "8–30 days", "31–90 days", "91+ days"];

export const INCOMPLETE_AGES: IncompleteAgesPanel = {
  chart: chartFixture({
    title: "Incomplete Jobs by age",
    rollUpLevel: "Age since last session",
    buckets: AGE_BUCKETS,
    bucketColumn: "Age since last session",
    series: [{ key: "incomplete", label: "Incomplete Jobs", values: [18, 24, 11, 6] }],
  }),
  ages: {
    buckets: [
      { key: "0-7", label: "0–7 days", fromDays: 0, toDaysExclusive: 8, count: 18, taskKeys: [] },
      { key: "8-30", label: "8–30 days", fromDays: 8, toDaysExclusive: 31, count: 24, taskKeys: [] },
      { key: "31-90", label: "31–90 days", fromDays: 31, toDaysExclusive: 91, count: 11, taskKeys: [] },
      { key: "91+", label: "91+ days", fromDays: 91, toDaysExclusive: null, count: 6, taskKeys: [] },
    ],
    tasks: [],
    unaged: [],
    total: 59,
  },
};

/**
 * R-N12 panel 5, as two multiples (ticket 41). The values are the fixture's real magnitudes: the
 * p95 is ~4.4× the median, which is exactly the ratio that made one shared linear axis draw the
 * median as a flat rule along the floor of the panel.
 */
export const DURATION: DurationPanel = {
  title: "Session duration",
  median: chartFixture({
    title: "Median session duration",
    rollUpLevel: "Session",
    series: [{ key: "median", label: "Median", values: [2520, 2700, 2640] }],
  }),
  p95: chartFixture({
    title: "p95 session duration",
    rollUpLevel: "Session",
    series: [{ key: "p95", label: "p95", values: [11400, 12000, 11700] }],
  }),
  summary: { count: 486, median: 2640, p95: 11700 },
  // R-M19 — the fan-out reading. Most attempts are one agent; the tail is four or five.
  agents: { sessions: 486, agents: 671, median: 1, p95: 4 },
};

/** The three spans, per bucket. Disjoint, and a partition of machine allocation (R-T12). */
const SPAN_SERIES: readonly SeriesSpec[] = [
  { key: "interactive", label: "Interactive", values: [40000, 43000, 43000] },
  { key: "idle", label: "Idle", values: [18000, 18000, 18000] },
  { key: "afk", label: "AFK", values: [40000, 40000, 40000] },
];

/** A27's sentence, exactly as `spanComposition` writes it — computed with the figures it sits by. */
export const PRESENCE_NOTE =
  "Interactive sessions only: 30 of 42. 12 headless sessions are excluded — a headless session " +
  "is AFK for its entire lifetime by construction, so including it would only rediscover which " +
  "sessions were headless.";

export const PRESENCE_SPANS: PresenceSpansPanel = {
  chart: chartFixture({
    title: "Human presence and machine time",
    rollUpLevel: "Presence span (interactive sessions only)",
    series: SPAN_SERIES,
    stackable: true,
  }),
  composition: {
    executionMode: "interactive",
    sessions: 30,
    excluded: 12,
    slices: [
      { key: "interactive", total: 126000, share: 0.42 },
      { key: "idle", total: 54000, share: 0.18 },
      { key: "afk", total: 120000, share: 0.4 },
    ],
    total: 300000,
    stackable: true,
    note: PRESENCE_NOTE,
  },
};

export const WORK_VIEW: WorkPageViewModel = {
  orgSlug: "demo",
  velocity: VELOCITY,
  acceptance: ACCEPTANCE_PANELS,
  acceptanceAxis: ACCEPTANCE_AXIS,
  taskRates: TASK_RATES,
  incompleteAges: INCOMPLETE_AGES,
  duration: DURATION,
  presenceSpans: PRESENCE_SPANS,
};

/** The six panel headings, in R-N12's order. The order is the requirement, so it is a constant. */
export const PANEL_TITLES: readonly string[] = [
  VELOCITY.chart.title,
  "Acceptance rate by template",
  TASK_RATES.chart.title,
  INCOMPLETE_AGES.chart.title,
  DURATION.title,
  PRESENCE_SPANS.chart.title,
];
