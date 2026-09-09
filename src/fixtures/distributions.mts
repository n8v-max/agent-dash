// The distributions R-D4 … R-D18 require, checked over the rows the product can actually
// see. Hidden sessions are excluded here for the same reason the data layer excludes them
// (R-M2): a metric that counted them would not be measuring agent efficacy.
//
// **`roots` throughout means visible root sessions, each already carrying its children's cost,
// tokens and duration** (R-M19, `tree.mts`). Session count means root count, so every rate below
// has a denominator of attempts rather than of agents — an acceptance rate over stored rows would
// divide by sessions that carry no outcome and could never be accepted.

import { REPO_NAMES, WORK_TYPE_KEYS } from "./allocation.mts";
import { atLeast, check, near } from "./check.mts";
import { repositories } from "./catalog.mts";
import { members, OPEN_ACCOUNT_MEMBER_ID, RESTRICTED_ACCOUNT_MEMBER_ID } from "./people.mts";
import { isCpuHeavy } from "./predicates.mts";
import { median } from "./rng.mts";
import { dayOfRow, weekOfRow } from "./rows.mts";
import { weekMonthKey } from "./schedule.mts";
import {
  ACCEPTANCE_BY_REPOSITORY,
  ACCEPTANCE_BY_WORK_TYPE,
  CPU_HEAVY_COUNT,
  DECOMPOSITION_RATE,
  HIDDEN_SHARE,
  LOW_USAGE_MEMBER_ID,
  LOW_USAGE_SESSIONS,
  MULTI_MODEL_SHARE,
  REWORK_RATE,
  WINDOW_DAYS,
} from "./targets.mts";
import type { AgentSession } from "./types.mts";

const AGE_BUCKET_EDGES = [8, 31, 91];
const repositoryName = new Map(repositories.map((repository) => [repository.id, repository.name]));

const rateOf = (rows: readonly AgentSession[]): number =>
  rows.filter((row) => row.accepted).length / rows.length;

export const acceptanceLines = (roots: readonly AgentSession[]): string[] => [
  ...WORK_TYPE_KEYS.map((key) =>
    near(
      `R-D6 acceptance ${key}`,
      rateOf(roots.filter((row) => row.work_type === key)),
      ACCEPTANCE_BY_WORK_TYPE[key],
      0.01,
    ),
  ),
  ...REPO_NAMES.map((name) =>
    near(
      `R-D7 acceptance ${name}`,
      rateOf(roots.filter((row) => repositoryName.get(row.repository_id) === name)),
      ACCEPTANCE_BY_REPOSITORY[name],
      0.01,
    ),
  ),
];

const byTask = (rows: readonly AgentSession[]): Map<string, AgentSession[]> => {
  const grouped = new Map<string, AgentSession[]>();
  for (const row of rows) {
    grouped.set(row.task_key, [...(grouped.get(row.task_key) ?? []), row]);
  }
  for (const rows of grouped.values()) rows.sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
  return grouped;
};

// Rework — a non-accepted session followed by another session, of any WorkType.
// Decomposition — more than one accepted session. Independent labels, not a partition.
export const taskLines = (roots: readonly AgentSession[]): string[] => {
  const tasks = [...byTask(roots).values()];
  const rework = tasks.filter((rows) => rows.slice(0, -1).some((row) => !row.accepted));
  const decomposition = tasks.filter((rows) => rows.filter((row) => row.accepted).length > 1);
  const incomplete = tasks.filter((rows) => rows.every((row) => !row.accepted));
  const ages = incomplete.map((rows) => WINDOW_DAYS - 1 - dayOfRow(rows[rows.length - 1]));
  const buckets = [0, ...AGE_BUCKET_EDGES].map(
    (from, index) =>
      ages.filter((age) => age >= from && (index === AGE_BUCKET_EDGES.length || age < AGE_BUCKET_EDGES[index]))
        .length,
  );
  check(
    buckets.every((count) => count > 0),
    `R-D9: an incomplete-Task age bucket is empty (${buckets.join("/")})`,
  );
  return [
    near("R-D8 rework rate", rework.length / tasks.length, REWORK_RATE, 0.005),
    near("R-D8 decomposition rate", decomposition.length / tasks.length, DECOMPOSITION_RATE, 0.005),
    `R-D9 incomplete Tasks by age bucket 0-7/8-30/31-90/91+ ${buckets.join(" / ")}`,
    `R-D3 Tasks ${tasks.length}`,
  ];
};

export const edgeCaseLines = (
  allRoots: readonly AgentSession[],
  roots: readonly AgentSession[],
): string[] => {
  const cpuHeavy = roots.filter(isCpuHeavy);
  const lowUsage = roots.filter((row) => row.member_id === LOW_USAGE_MEMBER_ID);
  const humans = new Set(members.filter((m) => m.kind === "human").map((m) => m.id));
  const serviceInteractive = roots.filter(
    (row) => !humans.has(row.member_id) && row.execution_mode === "interactive",
  );
  const humanHeadless = roots.filter(
    (row) => humans.has(row.member_id) && row.execution_mode === "headless",
  );
  return [
    near("R-D11 CPU-heavy sessions", cpuHeavy.length, CPU_HEAVY_COUNT, 2),
    near("R-D12 hidden share", 1 - roots.length / allRoots.length, HIDDEN_SHARE, 0.005),
    `R-D10 low-usage seat holder ${lowUsage.length} sessions${
      lowUsage.length < LOW_USAGE_SESSIONS + 2 ? "" : " (too many)"
    }`,
    atLeast("R-D13 interactive service-account sessions", serviceInteractive.length, 5),
    atLeast("R-D13 headless human sessions", humanHeadless.length, 20),
    near(
      "R-D15 multi-Model sessions",
      roots.filter((row) => row.token_usage.length > 1).length / roots.length,
      MULTI_MODEL_SHARE,
      0.04,
    ),
  ];
};

export const populationLines = (roots: readonly AgentSession[]): string[] => {
  const multiTeam = members.filter((member) => member.team_ids.length > 1);
  const teamsPerRepository = REPO_NAMES.map((name) => {
    const workers = new Set(
      roots
        .filter((row) => repositoryName.get(row.repository_id) === name)
        .map((row) => row.member_id),
    );
    return new Set(
      members.filter((member) => workers.has(member.id)).flatMap((member) => member.team_ids),
    ).size;
  });
  // R-D18 — both accounts need real sessions, and the restricted one must not double as the
  // low-usage seat holder, or the two findings would sit on the same person.
  const openRows = roots.filter((row) => row.member_id === OPEN_ACCOUNT_MEMBER_ID);
  const restrictedRows = roots.filter((row) => row.member_id === RESTRICTED_ACCOUNT_MEMBER_ID);
  return [
    atLeast("R-D14 Members on more than one Team", multiTeam.length, 3),
    atLeast("R-D14 Teams working the busiest Repository", Math.max(...teamsPerRepository), 2),
    atLeast("R-D18 open-account sessions", openRows.length, 10),
    atLeast("R-D18 restricted-account sessions", restrictedRows.length, 10),
  ];
};

// R-D4 — the adoption ramp, measured the way the requirement states it: per Member, per week.
export const rampLines = (roots: readonly AgentSession[]): string[] => {
  const counts = new Map<string, number>();
  for (const row of roots) {
    const key = `${row.member_id}|${weekOfRow(row)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const forMonth = (month: string): number[] => {
    const weeks = Array.from({ length: Math.ceil(WINDOW_DAYS / 7) }, (_, week) => week).filter(
      (week) => weekMonthKey(week) === month,
    );
    return members.flatMap((member) => weeks.map((week) => counts.get(`${member.id}|${week}`) ?? 0));
  };
  const april = forMonth("2026-04");
  const august = forMonth("2026-08");
  check(median(april) === 0, `R-D4: April median is ${median(april)}, not 0`);
  check(median(august) === 2, `R-D4: August median is ${median(august)}, not 2`);
  check(Math.max(...april) === 3, `R-D4: April max is ${Math.max(...april)}, not 3`);
  check(Math.max(...august) === 8, `R-D4: August max is ${Math.max(...august)}, not 8`);
  return ["R-D4 sessions per Member per week: April median 0 / max 3, August median 2 / max 8"];
};
