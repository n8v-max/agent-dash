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
import { dayOfRow } from "./rows.mts";
import { isWorkday, monthKeyOfDay } from "./schedule.mts";
import {
  ACCEPTANCE_BY_REPOSITORY,
  ACCEPTANCE_BY_WORK_TYPE,
  CPU_HEAVY_COUNT,
  DAILY_VOLUME,
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

// R-D4 — volume, measured the way the requirement states it (ticket 66): **per human Member,
// per workday**. Three claims, and each one fails differently.
//
//   * the *range* — one to nine root sessions on a workday a Member worked at all. The floor and
//     the ceiling are both in `dailyCount`, so this holds by construction; ≥95% is the tolerance
//     the requirement is written with, and anything that ever put a tenth session on a Member's
//     day would surface here rather than in a chart nobody re-reads.
//   * the *ramp* — September's rate is materially above April's. Volume that did not rise would
//     leave R-D17's "session count rises while spend per session falls" with half a story, and
//     would flatten `WEEKLY_SPEND_SHAPE` into a horizontal line the repair would then enforce.
//   * the *weekend* — a Saturday is quiet but not empty. Both halves matter: a fixture with no
//     weekend rows makes every week-grain bucket a five-day bucket in disguise.
//
// Service accounts are excluded from all three: they run a pipeline's week, not a person's day.
export const rampLines = (roots: readonly AgentSession[]): string[] => {
  const humans = new Set(members.filter((member) => member.kind === "human").map((m) => m.id));
  const perDay = new Map<number, Map<string, number>>();
  for (const row of roots) {
    if (!humans.has(row.member_id)) continue;
    const day = dayOfRow(row);
    const held = perDay.get(day) ?? new Map<string, number>();
    held.set(row.member_id, (held.get(row.member_id) ?? 0) + 1);
    perDay.set(day, held);
  }
  const countsOn = (holds: (day: number) => boolean): number[] =>
    [...perDay.entries()].filter(([day]) => holds(day)).flatMap(([, held]) => [...held.values()]);
  const workdayCounts = countsOn(isWorkday);
  const inRange = workdayCounts.filter((count) => count >= 1 && count <= DAILY_VOLUME.cap);
  check(
    inRange.length / workdayCounts.length >= 0.95,
    `R-D4: only ${inRange.length} of ${workdayCounts.length} (Member, workday) pairs run 1–${DAILY_VOLUME.cap} sessions`,
  );
  const perWorkdayIn = (month: string): number => {
    const days = Array.from({ length: WINDOW_DAYS }, (_, day) => day).filter(
      (day) => isWorkday(day) && monthKeyOfDay(day) === month,
    );
    const total = days.reduce(
      (running, day) => running + [...(perDay.get(day)?.values() ?? [])].reduce((a, b) => a + b, 0),
      0,
    );
    return total / (days.length * humans.size);
  };
  const april = perWorkdayIn("2026-04");
  const september = perWorkdayIn("2026-09");
  check(
    september >= april + 1,
    `R-D4: the ramp did not rise — April runs ${april.toFixed(2)} sessions per human workday, September ${september.toFixed(2)}`,
  );
  const weekend = countsOn((day) => !isWorkday(day));
  check(weekend.length > 0, "R-D4: no human ran a session at a weekend, so week buckets are five-day buckets");
  return [
    `R-D4 ${workdayCounts.length} (human Member × workday) pairs, ${inRange.length} of them 1–${DAILY_VOLUME.cap} sessions · max ${Math.max(...workdayCounts)}`,
    `R-D4 sessions per human workday: April ${april.toFixed(2)} → September ${september.toFixed(2)} · ${weekend.length} weekend Member-days`,
  ];
};
