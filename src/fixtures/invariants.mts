// R-T23 — the generator asserts its own invariants as it writes. Row-level identities live
// here; the distribution and money checks live in distributions.mts and spend.mts. Every
// one of them is re-asserted over the committed JSON by the fixture invariant tests
// (testing-spec § 6), because a generator's own assertions cannot prove what was written.

import { REPO_NAMES, WORK_TYPE_KEYS } from "./allocation.mts";
import { models, organization, repositories, workTypes } from "./catalog.mts";
import { check } from "./check.mts";
import {
  acceptanceLines,
  edgeCaseLines,
  populationLines,
  rampLines,
  taskLines,
} from "./distributions.mts";
import { joinGithubUser } from "./join.mts";
import { githubUsers, members } from "./people.mts";
import { crossesUtcDay, startsLateEvening } from "./predicates.mts";
import { madridOffsetMinutes } from "./schedule.mts";
import { modelMixLines, totalSpendLines, trendLines } from "./spend.mts";
import { EMPTY_PAIRS, MADRID_OFFSET_MINUTES, WINDOW_END_DAY, WINDOW_START_DAY } from "./targets.mts";
import type { AgentSession, Task } from "./types.mts";

const TASK_KEY = /^[a-z0-9-]+\/[a-z0-9-]+#\d+$/u;

const assertRow = (row: AgentSession, taskOf: ReadonlyMap<string, Task>): void => {
  const spans = row.interactive_duration_s + row.idle_duration_s + row.afk_duration_s;
  check(spans === row.machine_allocation_duration_s, `R-T12: spans do not sum on ${row.id}`);
  check(row.machine_allocation_duration_s > 0, `zero machine allocation on ${row.id}`);
  check(
    row.execution_mode !== "headless" ||
      (row.interactive_duration_s === 0 && row.idle_duration_s === 0),
    `headless session ${row.id} carries interactive or idle time`,
  );
  for (const usage of row.token_usage) {
    const counts = [usage.uncached_input, usage.cache_read, usage.cache_write, usage.output];
    check(
      counts.every((count) => Number.isInteger(count) && count >= 0),
      `T-F3: token classes on ${row.id} are not whole and non-negative`,
    );
  }
  const task = taskOf.get(row.task_key);
  check(task !== undefined, `T-F7: ${row.id} references an unknown Task ${row.task_key}`);
  check(TASK_KEY.test(row.task_key), `T-F7: ${row.task_key} is not owner/repo#number`);
  check(task?.repository_id === row.repository_id, `T-F7: ${row.task_key} is in another repo`);
  check(row.cost > 0, `attributed cost is not positive on ${row.id}`);
};

const assertClock = (rows: readonly AgentSession[]): string[] => {
  const startMs = Date.parse(`${WINDOW_START_DAY}T00:00:00+02:00`);
  const endMs = Date.parse(`${WINDOW_END_DAY}T23:59:59+02:00`);
  let late = 0;
  let crossing = 0;
  for (const row of rows) {
    const started = Date.parse(row.started_at);
    check(started >= startMs && started <= endMs, `R-D2: ${row.id} starts outside the window`);
    check(
      madridOffsetMinutes(started) === MADRID_OFFSET_MINUTES,
      `R-D5: ${row.id} does not sit at Madrid's +02:00 — a DST transition is inside the window`,
    );
    check(
      Date.parse(row.ended_at) - started === row.machine_allocation_duration_s * 1000,
      `${row.id} does not end where its machine allocation says`,
    );
    if (startsLateEvening(row)) late += 1;
    if (crossesUtcDay(row)) crossing += 1;
  }
  check(late >= 10, `R-D5: only ${late} sessions fall between 22:00 and 24:00 Europe/Madrid`);
  check(crossing >= 5, `R-D5: only ${crossing} sessions sit on a different UTC day`);
  return [
    `R-D5 sessions starting 22:00–24:00 Europe/Madrid ${late}; sessions whose UTC date differs from their Madrid date ${crossing}`,
  ];
};

// R-D19 — all 25 (Repository × WorkType) pairs, and only the authored ones empty.
const assertMatrix = (rows: readonly AgentSession[]): string[] => {
  const name = new Map(repositories.map((repository) => [repository.id, repository.name]));
  let empty = 0;
  for (const repository of REPO_NAMES) {
    for (const workType of WORK_TYPE_KEYS) {
      const count = rows.filter(
        (row) => name.get(row.repository_id) === repository && row.work_type === workType,
      ).length;
      const authoredEmpty = EMPTY_PAIRS.some(([r, w]) => r === repository && w === workType);
      check(
        count > 0 || authoredEmpty,
        `R-D19: ${repository} × ${workType} is empty but was not authored empty`,
      );
      check(count === 0 || !authoredEmpty, `R-D19: ${repository} × ${workType} should be empty`);
      if (count === 0) empty += 1;
    }
  }
  return [`R-D19 25 (Repository × WorkType) files, ${empty} of them empty by authorship`];
};

// R-D20 / T-F8 — every GitHub user matches a Member. An unmatched user is an unreachable
// state that none of the six surfaces would show, so it must not appear.
const assertJoin = (): string[] => {
  const candidates = members.map((member) => ({
    id: member.id,
    full_name: member.full_name,
    email: member.email,
  }));
  for (const user of githubUsers) {
    const outcome = joinGithubUser(user, candidates);
    check(outcome.matched, `R-D20: GitHub user ${user.login} matched no Member`);
  }
  return [`R-D20 ${githubUsers.length} GitHub users, all joined to a Member`];
};

const assertScale = (): string[] => {
  const humans = members.filter((member) => member.kind === "human");
  check(members.length === 20 && humans.length === 18, "R-D3: 20 Members, 18 of them human");
  check(repositories.length === 5 && workTypes.length === 5, "R-D3: 5 Repositories, 5 WorkTypes");
  check(models.length === 7, "R-D3: 7 Models");
  check(new Set(models.map((model) => model.vendor)).size === 3, "R-D3: 3 vendors");
  check(organization.slug === "demo", "R-A1: the seeded Organization is `demo`");
  return [`R-D3 ${members.length} Members (${humans.length} human) · 5 Repositories · 7 Models`];
};

export const assertFixture = (fixture: {
  sessions: readonly AgentSession[];
  tasks: readonly Task[];
}): string => {
  const taskOf = new Map(fixture.tasks.map((task) => [task.key, task]));
  for (const row of fixture.sessions) assertRow(row, taskOf);
  const visible = fixture.sessions.filter((row) => !row.hidden);
  return [
    ...assertScale(),
    `R-D3 ${fixture.sessions.length} AgentSessions (${visible.length} visible)`,
    ...assertClock(fixture.sessions),
    ...assertMatrix(fixture.sessions),
    ...assertJoin(),
    ...rampLines(visible),
    ...acceptanceLines(visible),
    ...taskLines(visible),
    ...edgeCaseLines(fixture.sessions, visible),
    ...populationLines(visible),
    ...modelMixLines(visible),
    ...trendLines(visible),
    ...totalSpendLines(visible),
  ].join("\n");
};
