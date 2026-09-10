// The once-per-page work every panel on that page shares — ticket 28's central decision.
//
// **One query per page, not one per panel.** Twenty per-panel entry points would each load the
// fixture, resolve the viewer's grants and bucket the range for themselves, so seven panels on
// one page could disagree about the population or the bucket edges. Here the load, the
// permission filter (R-T17, **before** aggregation) and the bucketing happen once, and every
// panel on the page is a projection of the same rows.
//
// **The permission filter runs per datapoint class, because grants are per class.** The
// restricted account holds `team` over `jobs` and `tokens` and nothing over `cost` (R-A3), so
// on `/demo/spend` its token panels see its Team's rows and its money panels see only its own.
// Filtering once "for the page" would have to pick one class and would either leak cost or hide
// tokens. Three filtered views, each computed once, each `filterRows` before any aggregation.
//
// Nothing here reads a clock: `now` arrives on the params (P5) — and it decides the population
// as well as the buckets. `datasetAsOf(params.now)` is the rows the platform has actually
// observed by then (ticket 62); this module never calls `loadDataset`, and neither does anything
// else under `queries/`, which `src/data/as-of.test.ts` asserts as an absence over the source.

import {
  filterRows,
  membershipFromTeams,
  type AccessRequest,
  type DatapointClass,
  type TeamMembership,
  type Viewer,
} from "@/domain/access";
import type { ModelLevel } from "@/domain/aggregate";
import {
  bucketRows,
  planPeriods,
  priorMonthStart,
  type PeriodBucket,
  type PeriodGrain,
  type PeriodPlan,
  type PeriodRange,
} from "@/domain/periods";
import type { AgentSession, Member } from "@/domain/types";
import type { BucketViewModel } from "@/domain/viewmodel";
import { instantIn } from "../instant";
import { datasetAsOf } from "../as-of";
import type { Dataset } from "../load";
import type { ControlSet } from "../params";

/** The three classes a panel reads. `access` gates the matrix and reads no rows (R-A10). */
export const ROW_CLASSES = ["jobs", "tokens", "cost"] as const;
export type RowClass = (typeof ROW_CLASSES)[number];

/**
 * One datapoint class's view of the page: the rows this viewer may see, already narrowed by the
 * page's filters, bucketed at the page grain and at month grain.
 *
 * `months` exists because R-M5 puts Total spend at monthly grain and coarser **only**, so that
 * panel reads months whatever the page grain is — the alternative is a control that can express
 * a figure the domain layer refuses to compute.
 */
export type ClassView = {
  readonly datapoint: RowClass;
  /**
   * The population every figure on the page is read off: permission-filtered (R-T17), narrowed
   * by the page's own filters, **and inside the selected period**.
   *
   * It is the buckets' own rows flattened rather than a second filter over the dataset, so a
   * whole-range figure and the chart beside it cannot disagree about which sessions are in the
   * period — the range is applied once, by `bucketRows`, and read twice.
   */
  readonly rows: readonly AgentSession[];
  /** Subjects a granted `identified` scope resolves. Everyone else contributes to totals only. */
  readonly identified: ReadonlySet<string>;
  readonly buckets: readonly PeriodBucket<AgentSession>[];
  readonly months: readonly PeriodBucket<AgentSession>[];
  /**
   * The same months, over a range widened back by one month (C12) and clamped to the
   * Organization's own window. `months` answers "what is in the selection"; this answers
   * "compared with what", and the two are different questions.
   *
   * It is a second bucketing rather than a lookup on `months`, because the month before the
   * selection is by definition not in `months` — that is the whole defect C12 fixes. The clamp
   * is what keeps C13 honest: widening past `window_start` would make April, which the fixture
   * only half covers, bucket as a *complete* month and become exactly the fake baseline C13
   * suppresses.
   */
  readonly comparisonMonths: readonly PeriodBucket<AgentSession>[];
};

/** Display labels, resolved once. A panel asks; it never looks anything up itself. */
export type Labels = {
  readonly bucket: (bucket: { readonly key: string; readonly partial: boolean }) => BucketViewModel;
  /** An instant, in the Organization's declared timezone (R-M10, R-N19). */
  readonly instant: (iso: string) => string;
  readonly repository: (id: string) => string;
  readonly workType: (key: string) => string;
  readonly team: (id: string) => string;
  readonly member: (id: string) => string;
  /** `Member.kind`, in words. The raw enum is a URL value and never reaches a page (ticket 41). */
  readonly memberKind: (kind: Member["kind"]) => string;
  readonly model: (id: string, level: ModelLevel) => string;
};

export type PageContext = {
  readonly params: ControlSet;
  readonly viewer: Viewer;
  readonly data: Dataset;
  readonly membership: TeamMembership;
  /** The Members the page aggregates over — the roster, narrowed by the Team and kind controls. */
  readonly population: readonly Member[];
  readonly grain: PeriodGrain;
  readonly view: (datapoint: RowClass) => ClassView;
  readonly access: (datapoint: DatapointClass) => AccessRequest;
  readonly label: Labels;
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const monthName = (month: string): string => MONTH_NAMES[Number(month) - 1] ?? month;

/**
 * A bucket key, in words. Deterministic and locale-free — `Intl` would make a mirror's row
 * headers depend on the server's locale, and the mirror is an assertion target (T-C1).
 */
const bucketLabel = (key: string): string => {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (day) return `${Number(day[3])} ${monthName(day[2])} ${day[1]}`;
  const week = /^(\d{4})-W(\d{2})$/.exec(key);
  if (week) return `Week ${Number(week[2])}, ${week[1]}`;
  const month = /^(\d{4})-(\d{2})$/.exec(key);
  if (month) return `${monthName(month[2])} ${month[1]}`;
  return key;
};

const planFor = (
  params: ControlSet,
  timezone: string,
  grain: PeriodGrain,
  range: PeriodRange = params.range,
): PeriodPlan | null => {
  const result = planPeriods({ timezone, grain, range, now: params.now });
  return result.ok ? result.plan : null;
};

/**
 * C12 — the selected range, widened back to the start of the month before it, and no further
 * back than the Organization's own window. ISO civil dates compare lexicographically, so `max`
 * is a string comparison.
 */
const comparisonRangeOf = (range: PeriodRange, windowStart: string): PeriodRange => {
  const widened = priorMonthStart(range.start);
  if (widened === undefined) return range;
  return { start: widened > windowStart ? widened : windowStart, end: range.end };
};

const bucketsFor = (
  plan: PeriodPlan | null,
  rows: readonly AgentSession[],
): readonly PeriodBucket<AgentSession>[] => (plan ? bucketRows(plan, rows) : []);

/**
 * The page's own filters (R-C1). Assembled as a list of active predicates rather than one long
 * conjunction, so adding a control does not push a branch count past its budget — and so an
 * inactive control is *absent* rather than a predicate that always returns true.
 */
const selectorFor = (
  params: ControlSet,
  membership: TeamMembership,
  kindOf: ReadonlyMap<string, Member["kind"]>,
): ((row: AgentSession) => boolean) => {
  const active: ((row: AgentSession) => boolean)[] = [];
  const { repository, workType, executionMode, team, memberKind, member } = params;
  if (repository) active.push((row) => row.repository_id === repository);
  if (workType) active.push((row) => row.work_type === workType);
  if (executionMode) active.push((row) => row.execution_mode === executionMode);
  if (team) active.push((row) => (membership.get(row.member_id) ?? []).includes(team));
  if (memberKind) active.push((row) => kindOf.get(row.member_id) === memberKind);
  // `?member=` filters the rows on /demo/history (R-N20); on /demo/people it switches the
  // surface (R-N16) and the profile query narrows the population itself.
  if (member && params.page === "history") active.push((row) => row.member_id === member);
  return (row) => active.every((holds) => holds(row));
};

const populationFor = (data: Dataset, params: ControlSet, membership: TeamMembership) =>
  data.members.filter(
    (candidate) =>
      (!params.team || (membership.get(candidate.id) ?? []).includes(params.team)) &&
      (!params.memberKind || candidate.kind === params.memberKind),
  );

/**
 * **`Member.kind`, in the words a reader reads** (ticket 41).
 *
 * `human` and `service_account` are a closed domain vocabulary and a URL value; neither is
 * English, and `service_account` on a page reads as a leaked column name rather than as a fact
 * about a person. It sits with the other display labels because that is what it is, and it is
 * resolved once so the People table and a Member's profile cannot disagree.
 */
const MEMBER_KIND_LABELS: Readonly<Record<Member["kind"], string>> = {
  human: "Human",
  service_account: "Service account",
};

const labelsFor = (data: Dataset, identifiedNames: ReadonlySet<string>): Labels => {
  const repositories = new Map<string, string>(data.repositories.map((row) => [row.id, row.name]));
  const workTypes = new Map<string, string>(data.workTypes.map((row) => [row.key, row.name]));
  const teams = new Map<string, string>(data.teams.map((row) => [row.id, row.name]));
  const members = new Map<string, string>(data.members.map((row) => [row.id, row.full_name]));
  const models = new Map(data.models.map((row) => [row.id, row]));
  return {
    bucket: (bucket) => ({
      key: bucket.key,
      label: bucketLabel(bucket.key),
      partial: bucket.partial,
    }),
    instant: instantIn(data.organization.timezone),
    repository: (id) => repositories.get(id) ?? id,
    workType: (key) => workTypes.get(key) ?? key,
    team: (id) => teams.get(id) ?? id,
    memberKind: (kind) => MEMBER_KIND_LABELS[kind],
    // R-A6/R-A9 — a subject the viewer cannot resolve by name never carries one, at any grain.
    member: (id) => (identifiedNames.has(id) ? (members.get(id) ?? id) : "Unnamed Member"),
    model: (id, level) => {
      const model = models.get(id);
      if (!model) return id;
      if (level === "tier") return model.tier;
      return level === "family" ? model.family : model.id;
    },
  };
};

/**
 * **The page context.** Everything below this line is a projection of what it computed: load,
 * permission filter, bucket — once, for the whole page.
 */
export function pageContext(viewer: Viewer, params: ControlSet): PageContext {
  // The slice, taken once for the page: every panel below is a projection of these rows, so no
  // two of them can disagree about whether a session has happened yet.
  const data = datasetAsOf(params.now);
  const membership = membershipFromTeams(data.teams);
  const kindOf = new Map(data.members.map((member) => [member.id, member.kind]));
  const selected = selectorFor(params, membership, kindOf);
  const pagePlan = planFor(params, data.organization.timezone, params.grain);
  const monthPlan = planFor(params, data.organization.timezone, "month");
  const comparisonPlan = planFor(
    params,
    data.organization.timezone,
    "month",
    comparisonRangeOf(params.range, data.organization.window_start),
  );

  const request = (datapoint: DatapointClass): AccessRequest => ({ viewer, datapoint, membership });
  const viewFor = (datapoint: RowClass): ClassView => {
    // R-T17 — the permission filter, on rows, before anything is summed.
    const granted = filterRows(request(datapoint), data.sessions);
    const selectedRows = granted.rows.filter(selected);
    const buckets = bucketsFor(pagePlan, selectedRows);
    return {
      datapoint,
      // The period is applied by the bucketing and nowhere else: a row outside the range is in
      // no bucket, so flattening the buckets is what "in the selected period" means here.
      rows: buckets.flatMap((bucket) => bucket.rows),
      identified: granted.identifiedSubjects,
      buckets,
      months: bucketsFor(monthPlan, selectedRows),
      comparisonMonths: bucketsFor(comparisonPlan, selectedRows),
    };
  };

  // Written out rather than mapped over `ROW_CLASSES`, because `Record<RowClass, ClassView>`
  // makes the lookup total: `view("tokens")` cannot miss, so no panel has a fallback branch.
  const views: Readonly<Record<RowClass, ClassView>> = {
    jobs: viewFor("jobs"),
    tokens: viewFor("tokens"),
    cost: viewFor("cost"),
  };

  return {
    params,
    viewer,
    data,
    membership,
    population: populationFor(data, params, membership),
    grain: params.grain,
    view: (datapoint) => views[datapoint],
    access: request,
    // Names are resolved on `jobs`: it is the class every surface that shows a name reads, and
    // R-A3.1 puts the viewer's own row in it for every Role.
    label: labelsFor(data, views.jobs.identified),
  };
}
