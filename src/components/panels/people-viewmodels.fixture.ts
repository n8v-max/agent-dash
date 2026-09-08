// The `/demo/people` ViewModels, authored by hand, for the component tests in this directory.
//
// **They are literals, not queries** — the same reasoning `chart-viewmodels.fixture.ts` records.
// `src/components/**` may import `src/domain` for types only (R-T6), so a component test cannot
// call `peoplePage()` to build its input and should not want to: what a component owes is
// "render the ViewModel you were handed, faithfully". Whether the table sorted correctly, whether
// the comparison group is the right population, and whether `self` is granted over every class
// are claims about `src/domain` and `src/data`, asserted there (T-U10, `queries.test.ts`).
//
// The permission-matrix fixtures that once lived here went with the matrix itself (C9). The
// restricted table below is now a single row with no note: C10 took the aggregate off this page.

import type { MemberProfileViewModel } from "@/data/queries";
import type { TableRow, TableViewModelOf } from "@/domain/viewmodel";
import { chartFixture } from "../charts/chart-viewmodels.fixture";

/** R-N15's seven columns, with the four numeric ones sortable. */
export const PEOPLE_COLUMNS = [
  { key: "member", label: "Member", numeric: false, sortable: false },
  { key: "team", label: "Team", numeric: false, sortable: false },
  { key: "kind", label: "Kind", numeric: false, sortable: false },
  { key: "completedTasks", label: "Completed Jobs", numeric: true, sortable: true },
  { key: "sessions", label: "Sessions", numeric: true, sortable: true },
  { key: "tokens", label: "Tokens", numeric: true, sortable: true },
  { key: "cost", label: "Cost", numeric: true, sortable: true },
] as const;

/**
 * The table as the open account receives it: three named Members, already ordered by Completed
 * Jobs descending (A24). The rows arrive sorted — nothing in the component may reorder them, and
 * a test that hands them in the wrong order proves it.
 */
export const PEOPLE_TABLE: TableViewModelOf<TableRow> = {
  columns: [...PEOPLE_COLUMNS],
  rows: [
    { key: "mem_0001", cells: ["Ada Lovelace", "Platform", "human", 42, 90, 1_240_000, 310.5] },
    { key: "mem_0002", cells: ["Grace Hopper", "Platform", "human", 31, 70, 980_000, 220.25] },
    { key: "mem_0003", cells: ["Alan Turing", "Data", "human", 12, 20, 310_000, null] },
  ],
  sort: { column: "completedTasks", direction: "desc" },
  empty: false,
  note: null,
};

/** The restricted account's table (C10): its own row, and nothing else. */
export const RESTRICTED_TABLE: TableViewModelOf<TableRow> = {
  columns: [...PEOPLE_COLUMNS],
  rows: [{ key: "mem_0009", cells: ["Hal Camps", "Platform", "human", 7, 15, 90_000, 41.2] }],
  sort: { column: "completedTasks", direction: "desc" },
  empty: false,
  note: null,
};

export const COMPARATOR_NOTE =
  "Compared with the median of the Members who worked the same Repository and template in this " +
  "period. Acceptance rate is not compared: a comparison group spans several templates, and one " +
  "acceptance figure would average incommensurable criteria.";

/**
 * R-N16's profile. Four tiles, the WorkType mix, and R-N17's three paired bars — with no fourth
 * bar for acceptance rate (R-N18) and no rank, percentile or spread anywhere (R-M15).
 */
export const MEMBER_PROFILE: MemberProfileViewModel = {
  memberId: "mem_0001",
  name: "Ada Lovelace",
  kind: "human",
  teams: ["Platform"],
  tiles: [
    {
      key: "session-cost",
      title: "Session cost",
      unit: "usd",
      value: 310.5,
      caption: null,
      period: { key: "2026-08", label: "Aug 2026", partial: false },
      change: {
        shown: true,
        current: { key: "2026-08", value: 310.5, partial: false },
        prior: { key: "2026-07", value: 265, partial: false },
        absolute: 45.5,
        ratio: 0.1717,
        direction: "up",
        incomplete: false,
      },
    },
    {
      key: "completed-tasks",
      title: "Completed Jobs",
      unit: "count",
      value: 42,
      caption: null,
      period: { key: "2026-08", label: "Aug 2026", partial: false },
      change: {
        shown: false,
        reason: "no-prior-period",
        message: "No prior period to compare against.",
        current: { key: "2026-08", value: 42, partial: false },
        prior: null,
        incomplete: false,
      },
    },
    {
      key: "cost-per-completed-task",
      title: "Cost per completed Job",
      unit: "usd_per_task",
      value: 7.39,
      caption: null,
      period: { key: "2026-09", label: "Sep 2026", partial: true },
      change: {
        shown: true,
        current: { key: "2026-09", value: 7.39, partial: true },
        prior: { key: "2026-08", value: 8.2, partial: false },
        absolute: -0.81,
        ratio: -0.098,
        direction: "down",
        incomplete: true,
      },
    },
    {
      key: "tokens-processed",
      title: "Tokens processed",
      unit: "tokens",
      value: 1_240_000,
      caption: null,
      period: { key: "2026-08", label: "Aug 2026", partial: false },
      change: {
        shown: true,
        current: { key: "2026-08", value: 1_240_000, partial: false },
        prior: { key: "2026-07", value: 1_000_000, partial: false },
        absolute: 240_000,
        ratio: 0.24,
        direction: "up",
        incomplete: false,
      },
    },
  ],
  workTypeMix: chartFixture({
    title: "Template mix",
    rollUpLevel: "WorkType",
    stackable: true,
    series: [
      { key: "implementation", label: "Implementation", values: [10, 12, 14] },
      { key: "refactor", label: "Refactor", values: [4, 5, 6] },
    ],
  }),
  comparator: {
    group: {
      repositoryId: "repo_api_gateway",
      workType: "implementation",
      label: "api-gateway · implementation, 6 members",
      members: 6,
    },
    bars: [
      {
        key: "completed-tasks-per-period",
        label: "Completed Jobs per period",
        unit: "count",
        member: 8,
        groupMedian: 5,
      },
      {
        key: "cost-per-completed-task",
        label: "Cost per completed Job",
        unit: "usd_per_task",
        member: 7.39,
        groupMedian: 9.5,
      },
      {
        key: "tokens-processed",
        label: "Tokens processed",
        unit: "tokens",
        member: 1_240_000,
        groupMedian: 900_000,
      },
    ],
    note: COMPARATOR_NOTE,
  },
};
