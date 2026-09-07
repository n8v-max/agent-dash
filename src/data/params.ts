// The validated control set — `spec.md` § 5 (R-C1…R-C5), `technical-spec.md` R-T25, R-T26,
// ticket 28, handing over to ticket 30.
//
// **Why the type is here and not in `components/controls/`.** R-T26 puts the parse/serialise
// module in `components/controls/`, and `queries.ts` consumes what that module produces — but
// `src/data` may not import `src/components`. So the **type** lives at the data layer and
// ticket 30 builds the **parser** that produces it: a `ControlSet` is what a query takes, and
// the only way to obtain one is to have parsed a URL through the rules below.
//
// Two rules are already unrepresentable rather than checked, and this module is where the
// third is coerced:
//
//   * **R-M11 — day grain over a long range.** `periods.availableGrains` is the offer and
//     `planPeriods` is the gate; `coerceGrain` here is what a parser calls so that an
//     out-of-range grain in a shared URL is *corrected* rather than rendered (R-T26, T-C5).
//   * **R-M5 — Total spend below monthly grain.** `spend.seatBearingPeriod` refuses it, and no
//     control can express it because the panel reads month buckets whatever the page grain is.
//   * **R-C1 — a page renders only its declared controls.** `DECLARED_CONTROLS` is that table as
//     data, so a page cannot render a control its panels do not use (T-C6).
//
// `now` rides along on the params because P5 makes it an argument everywhere: no query and no
// module below reads a clock. It is **not a control** and never serialises to the query string.

import { MODEL_LEVELS, ROLLUP_LEVELS, type ModelLevel, type RollupLevel } from "@/domain/aggregate";
import { OUTCOME_FILTERS, type OutcomeFilter } from "@/domain/metrics/spend";
import {
  availableGrains,
  PERIOD_GRAINS,
  type PeriodGrain,
  type PeriodRange,
} from "@/domain/periods";
import {
  EXECUTION_MODES,
  MEMBER_KINDS,
  WORK_TYPE_KEYS,
  type ExecutionMode,
  type MemberKind,
  type WorkTypeKey,
} from "@/domain/types";
import { SORT_DIRECTIONS, type TableSort } from "@/domain/viewmodel";

/** The six routes of R-N1 that carry a query. `/` and `/sign-in` carry none. */
export const PAGES = ["summary", "spend", "work", "people", "history", "projection"] as const;
export type PageKey = (typeof PAGES)[number];

/** Every control the product has. A control absent from this list has no URL representation. */
export const CONTROLS = [
  "period",
  "dateRange",
  "grain",
  "subject",
  "repository",
  "workType",
  "accepted",
  "perCapita",
  "modelLevel",
  "executionMode",
  "team",
  "memberKind",
  "sort",
  "member",
] as const;
export type ControlKey = (typeof CONTROLS)[number];

/**
 * **R-C1 — controls are declared per page, not per chart**, as data.
 *
 * `member` appears only under `/demo/history`, where R-C1 names it a filter. On `/demo/people`
 * the same parameter switches the *surface* to a Member profile (R-N16) rather than filtering
 * a panel, so it is deliberately not a declared control there: the toolbar must not offer it.
 */
export const DECLARED_CONTROLS: Readonly<Record<PageKey, readonly ControlKey[]>> = {
  summary: ["period"],
  spend: [
    "period",
    "grain",
    "subject",
    "repository",
    "workType",
    "accepted",
    "perCapita",
    "modelLevel",
  ],
  work: ["period", "grain", "subject", "repository", "workType", "executionMode", "perCapita"],
  people: ["period", "team", "memberKind", "sort"],
  history: ["dateRange", "member", "workType", "repository"],
  projection: [],
};

/**
 * The closed vocabularies a URL parser validates against, in one place.
 *
 * They are re-exported through the data layer rather than read from `src/domain` by the parser
 * because **`src/components/**` may import `src/domain` for types only** (R-T6), and R-T26 puts
 * the parser in `components/controls/`. A value outside these lists therefore has no URL
 * representation at all: the parser cannot spell it, so no page can render it.
 *
 * The open vocabularies — Repository, Team and Member ids — are deliberately absent. They are
 * fixture rows, not a closed set, and an id that resolves to nothing narrows the population to
 * nothing, which is a legitimate empty selection rather than an invalid URL (R-V9).
 */
export const CONTROL_VOCABULARIES = {
  grain: PERIOD_GRAINS,
  subject: ROLLUP_LEVELS,
  workType: WORK_TYPE_KEYS,
  accepted: OUTCOME_FILTERS,
  modelLevel: MODEL_LEVELS,
  executionMode: EXECUTION_MODES,
  memberKind: MEMBER_KINDS,
  sortDirection: SORT_DIRECTIONS,
} as const;

/**
 * A parsed, validated control set. Every field is resolved: a query reads it and never re-parses,
 * re-defaults or re-validates, so there is one place a control value can be wrong.
 */
export type ControlSet = {
  readonly page: PageKey;
  /** R-A2 — the Organization slug lives in the path, so it arrives with the params. */
  readonly orgSlug: string;
  /** The selected period, as an inclusive civil-date range in the Organization's timezone. */
  readonly range: PeriodRange;
  readonly grain: PeriodGrain;
  /** The Member-dimension roll-up a subject control selects (R-C1's "subject"). */
  readonly subject: RollupLevel;
  readonly repository: string | null;
  readonly workType: WorkTypeKey | null;
  /** R-M1's `accepted` filter on Cost per session. `any` unless a viewer narrowed it. */
  readonly accepted: OutcomeFilter;
  /** R-M14 — raw is the default; per-capita is a toggle, never the default. */
  readonly perCapita: boolean;
  readonly modelLevel: ModelLevel;
  readonly executionMode: ExecutionMode | null;
  readonly team: string | null;
  readonly memberKind: MemberKind | null;
  readonly sort: TableSort;
  /** `?member=` — a filter on `/demo/history`, the surface switch on `/demo/people` (R-N16). */
  readonly member: string | null;
  /** `?session=` — R-N20.1's expanded row, addressable so it survives a share. */
  readonly session: string | null;
  /** P5 — an ISO 8601 instant, injected. Not a control; it never serialises. */
  readonly now: string;
};

/** R-N15 — the People table's default sort: **Completed Tasks, descending**. */
export const DEFAULT_PEOPLE_SORT: TableSort = { column: "completedTasks", direction: "desc" };

/** R-N20 — `/demo/history` is newest first. */
export const DEFAULT_HISTORY_SORT: TableSort = { column: "startedAt", direction: "desc" };

/**
 * Each page's default grain (R-C4), so a bare route is the canonical short form.
 *
 * `/demo` and `/demo/projection` are month-locked (R-N6, R-N23) and `/demo/people` reports a
 * period rather than a series, so month is not a default there but the only value. `/demo/spend`
 * and `/demo/work` open at **week**: the committed window is 150 days, over which R-M11 does not
 * offer day at all, and a month grain over five buckets is too coarse to read a trend in.
 */
export const DEFAULT_GRAINS: Readonly<Record<PageKey, PeriodGrain>> = {
  summary: "month",
  spend: "week",
  work: "week",
  people: "month",
  history: "day",
  projection: "month",
};

const DEFAULT_SORTS: Readonly<Record<PageKey, TableSort>> = {
  summary: DEFAULT_PEOPLE_SORT,
  spend: DEFAULT_PEOPLE_SORT,
  work: DEFAULT_PEOPLE_SORT,
  people: DEFAULT_PEOPLE_SORT,
  history: DEFAULT_HISTORY_SORT,
  projection: DEFAULT_PEOPLE_SORT,
};

/**
 * **R-M11, coerced rather than rendered** (R-T26, T-C5). A grain the range cannot carry is
 * replaced by the coarsest one it can — never rejected into an error page, because the URL
 * being shared is a viewer's, and the honest response to "day over five months" is to show the
 * same data at a grain that reads.
 */
export function coerceGrain(grain: PeriodGrain, range: PeriodRange): PeriodGrain {
  const available = availableGrains(range);
  return available.includes(grain) ? grain : (available.at(-1) ?? "month");
}

/**
 * The page defaults (R-C4). A parser starts here and overwrites only what the query string
 * actually carried, so an omitted parameter and a parameter equal to the default are the same
 * state — which is what makes a bare route canonical.
 */
export function defaultControls(input: {
  readonly page: PageKey;
  readonly orgSlug: string;
  readonly range: PeriodRange;
  readonly now: string;
}): ControlSet {
  return {
    page: input.page,
    orgSlug: input.orgSlug,
    range: input.range,
    grain: coerceGrain(DEFAULT_GRAINS[input.page], input.range),
    subject: "organization",
    repository: null,
    workType: null,
    accepted: "any",
    perCapita: false,
    modelLevel: "family",
    executionMode: null,
    team: null,
    memberKind: null,
    sort: DEFAULT_SORTS[input.page],
    member: null,
    session: null,
    now: input.now,
  };
}

/**
 * Applies a partial control set over the page defaults and re-coerces the grain, so a caller
 * cannot assemble a `ControlSet` that R-M11 forbids by overriding one field.
 */
export function controlsWith(
  base: ControlSet,
  overrides: Partial<Omit<ControlSet, "page" | "orgSlug">>,
): ControlSet {
  const merged = { ...base, ...overrides };
  return { ...merged, grain: coerceGrain(merged.grain, merged.range) };
}
