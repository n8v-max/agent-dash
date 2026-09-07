// T-F1 … T-F8 — the fixture invariant tests (testing-spec § 6).
//
// These read the *committed* JSON and never run the generator (P3 / R-T20): a test that
// regenerates its own input tests the generator, not the data the application will load.
// The target figures are restated here from spec.md § 8 rather than imported from
// `targets.mts`, so that editing a target cannot quietly move the test with it.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { joinGithubUser } from "./join.mts";
import type { AgentSession, GithubUser, Member, Repository, Task, WorkTypeKey } from "./types.mts";

const REPOSITORIES = [
  "web-console",
  "mobile-app",
  "api-gateway",
  "ml-scoring",
  "terraform-infra",
] as const;

const WORK_TYPES: readonly WorkTypeKey[] = [
  "implementation",
  "bugfix",
  "refactor",
  "review",
  "deploy",
] as const;

// R-D19 — the one authored empty pair. Every other pair carries rows.
const AUTHORED_EMPTY = new Set(["mobile-app__deploy"]);

// R-D6 / R-D7 — the acceptance rates the product's efficacy claims rest on.
const ACCEPTANCE_BY_WORK_TYPE: Record<string, number> = {
  review: 0.86,
  bugfix: 0.79,
  implementation: 0.71,
  refactor: 0.58,
  deploy: 0.34,
};
const ACCEPTANCE_BY_REPOSITORY: Record<string, number> = {
  "web-console": 0.78,
  "mobile-app": 0.7,
  "api-gateway": 0.62,
  "ml-scoring": 0.55,
  "terraform-infra": 0.44,
};

const WINDOW_END = "2026-09-08";
const DAY_MS = 86_400_000;
const OPEN_ACCOUNT = "mem_dnavarro";
const RESTRICTED_ACCOUNT = "mem_hcamps";

// Paths are built from `import.meta.url` by hand: under jsdom the global URL resolves a
// relative reference against the document origin, not against the module's file URL.
const DATA_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "data");

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(join(DATA_DIRECTORY, name), "utf8")) as T;

const pairName = (repository: string, workType: string): string => `${repository}__${workType}`;

const pairs = REPOSITORIES.flatMap((repository) =>
  WORK_TYPES.map((workType) => pairName(repository, workType)),
);

const sessionsByPair = new Map(
  pairs.map((pair) => [pair, read<AgentSession[]>(`sessions/${pair}.json`)]),
);

const allSessions = [...sessionsByPair.values()].flat();
const visible = allSessions.filter((row) => !row.hidden);
const tasks = read<Task[]>("tasks.json");
const repositories = read<Repository[]>("repositories.json");
const directory = read<{ github_users: GithubUser[]; members: Member[] }>("members.json");

const repositoryNameById = new Map(repositories.map((repository) => [repository.id, repository.name]));
const memberById = new Map(directory.members.map((member) => [member.id, member]));

const acceptanceOf = (rows: readonly AgentSession[]): number =>
  rows.filter((row) => row.accepted).length / rows.length;

// The authored rates carry two decimals and the smallest Repository holds ~75 sessions, so
// one session moves its rate by 0.013. A tolerance below that would be asserting a precision
// the population size cannot express.
const ACCEPTANCE_TOLERANCE = 0.01;

const tokensOf = (row: AgentSession): number =>
  row.token_usage.reduce(
    (total, usage) =>
      total + usage.uncached_input + usage.cache_read + usage.cache_write + usage.output,
    0,
  );

const groupByTask = (rows: readonly AgentSession[]): AgentSession[][] => {
  const grouped = new Map<string, AgentSession[]>();
  for (const row of rows) grouped.set(row.task_key, [...(grouped.get(row.task_key) ?? []), row]);
  return [...grouped.values()].map((group) =>
    [...group].sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at)),
  );
};

describe("T-F1 — the (Repository × WorkType) matrix", () => {
  it("holds all 25 session files", () => {
    expect(sessionsByPair.size).toBe(25);
    for (const pair of pairs) expect(Array.isArray(sessionsByPair.get(pair))).toBe(true);
  });

  it("leaves only the authored pairs empty", () => {
    for (const [pair, rows] of sessionsByPair) {
      expect(rows.length === 0).toBe(AUTHORED_EMPTY.has(pair));
    }
  });

  it("files every row under its own pair", () => {
    for (const [pair, rows] of sessionsByPair) {
      for (const row of rows) {
        expect(pairName(repositoryNameById.get(row.repository_id) ?? "", row.work_type)).toBe(pair);
      }
    }
  });

  it("orders every file by timestamp", () => {
    for (const rows of sessionsByPair.values()) {
      const stamps = rows.map((row) => Date.parse(row.started_at));
      expect([...stamps].sort((a, b) => a - b)).toEqual(stamps);
    }
  });
});

describe("T-F2 — duration spans", () => {
  it("sums the three spans exactly to the machine allocation", () => {
    for (const row of allSessions) {
      expect(
        row.interactive_duration_s + row.idle_duration_s + row.afk_duration_s,
      ).toBe(row.machine_allocation_duration_s);
    }
  });

  it("keeps every span a non-negative whole number of seconds", () => {
    for (const row of allSessions) {
      for (const span of [
        row.interactive_duration_s,
        row.idle_duration_s,
        row.afk_duration_s,
      ]) {
        expect(Number.isInteger(span)).toBe(true);
        expect(span).toBeGreaterThanOrEqual(0);
      }
      expect(row.machine_allocation_duration_s).toBeGreaterThan(0);
    }
  });

  it("gives a headless session no interactive and no idle time", () => {
    for (const row of allSessions.filter((candidate) => candidate.execution_mode === "headless")) {
      expect(row.interactive_duration_s).toBe(0);
      expect(row.idle_duration_s).toBe(0);
    }
  });
});

describe("T-F3 — token classes", () => {
  it("carries exactly the four disjoint classes, whole and non-negative", () => {
    for (const row of allSessions) {
      for (const usage of row.token_usage) {
        expect(Object.keys(usage).sort()).toEqual([
          "cache_read",
          "cache_write",
          "model_id",
          "output",
          "uncached_input",
        ]);
        for (const count of [
          usage.uncached_input,
          usage.cache_read,
          usage.cache_write,
          usage.output,
        ]) {
          expect(Number.isInteger(count)).toBe(true);
          expect(count).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("keys usage by Model once per session, so the display sum cannot double-count", () => {
    for (const row of allSessions) {
      const ids = row.token_usage.map((usage) => usage.model_id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("T-F4 — the required distributions", () => {
  it("carries R-D6 acceptance by WorkType", () => {
    for (const workType of WORK_TYPES) {
      const rows = visible.filter((row) => row.work_type === workType);
      expect(rows.length).toBeGreaterThan(0);
      expect(
        Math.abs(acceptanceOf(rows) - ACCEPTANCE_BY_WORK_TYPE[workType]),
      ).toBeLessThanOrEqual(ACCEPTANCE_TOLERANCE);
    }
  });

  it("carries R-D7 acceptance by Repository", () => {
    for (const repository of REPOSITORIES) {
      const rows = visible.filter(
        (row) => repositoryNameById.get(row.repository_id) === repository,
      );
      expect(
        Math.abs(acceptanceOf(rows) - ACCEPTANCE_BY_REPOSITORY[repository]),
      ).toBeLessThanOrEqual(ACCEPTANCE_TOLERANCE);
    }
  });

  it("carries R-D8 rework at 18% and decomposition at 12% of Tasks", () => {
    const grouped = groupByTask(visible);
    const rework = grouped.filter((rows) => rows.slice(0, -1).some((row) => !row.accepted));
    const decomposition = grouped.filter(
      (rows) => rows.filter((row) => row.accepted).length > 1,
    );
    expect(rework.length / grouped.length).toBeCloseTo(0.18, 2);
    expect(decomposition.length / grouped.length).toBeCloseTo(0.12, 2);
  });

  it("fills all four R-D9 incomplete-Task age buckets, including 91+", () => {
    const endMs = Date.parse(`${WINDOW_END}T23:59:59+02:00`);
    const ages = groupByTask(visible)
      .filter((rows) => rows.every((row) => !row.accepted))
      .map((rows) => Math.floor((endMs - Date.parse(rows[rows.length - 1].started_at)) / DAY_MS));
    const buckets = [
      ages.filter((age) => age < 8),
      ages.filter((age) => age >= 8 && age < 31),
      ages.filter((age) => age >= 31 && age < 91),
      ages.filter((age) => age >= 91),
    ];
    for (const bucket of buckets) expect(bucket.length).toBeGreaterThan(0);
    expect(buckets.reduce((total, bucket) => total + bucket.length, 0)).toBe(ages.length);
  });

  it("holds R-D10's seat with fewer than five sessions", () => {
    const humans = directory.members.filter((member) => member.kind === "human");
    const counts = humans.map(
      (member) => visible.filter((row) => row.member_id === member.id).length,
    );
    expect(counts.filter((count) => count > 0 && count < 5).length).toBeGreaterThanOrEqual(1);
  });

  it("holds R-D11's ~20 CPU-heavy, token-light sessions", () => {
    const cpuHeavy = visible.filter(
      (row) =>
        row.machine_spec === "compute" &&
        row.machine_allocation_duration_s >= 4 * 3600 &&
        tokensOf(row) <= 60_000,
    );
    expect(cpuHeavy.length).toBeGreaterThanOrEqual(18);
    expect(cpuHeavy.length).toBeLessThanOrEqual(22);
    for (const row of cpuHeavy) {
      expect(["terraform-infra", "api-gateway"]).toContain(
        repositoryNameById.get(row.repository_id),
      );
    }
  });

  it("holds R-D12's ~2% hidden sessions in the committed data", () => {
    const hidden = allSessions.filter((row) => row.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.length / allSessions.length).toBeCloseTo(0.02, 2);
    expect(visible.length).toBeLessThan(allSessions.length);
  });

  it("holds R-D13's interactive service account and headless humans", () => {
    const kindOf = (row: AgentSession) => memberById.get(row.member_id)?.kind;
    expect(
      visible.filter(
        (row) => kindOf(row) === "service_account" && row.execution_mode === "interactive",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      visible.filter((row) => kindOf(row) === "human" && row.execution_mode === "headless").length,
    ).toBeGreaterThan(0);
  });

  it("holds R-D14's overlapping Teams", () => {
    const multiTeam = directory.members.filter((member) => member.team_ids.length > 1);
    expect(multiTeam.length).toBeGreaterThanOrEqual(3);
    const crossTeam = REPOSITORIES.filter((repository) => {
      const workers = new Set(
        visible
          .filter((row) => repositoryNameById.get(row.repository_id) === repository)
          .map((row) => row.member_id),
      );
      const teams = new Set(
        [...workers].flatMap((id) => memberById.get(id)?.team_ids ?? []),
      );
      return teams.size >= 2;
    });
    expect(crossTeam.length).toBeGreaterThanOrEqual(1);
  });

  it("holds R-D15's 40% multi-Model sessions", () => {
    const multi = visible.filter((row) => row.token_usage.length > 1);
    expect(multi.length / visible.length).toBeCloseTo(0.4, 1);
  });

  it("holds R-D17's falling frontier share", () => {
    const frontier = new Set(["gpt-6-astra", "claude-opus-5"]);
    const shareIn = (month: string): number => {
      const usages = visible
        .filter((row) => row.started_at.startsWith(month))
        .flatMap((row) => row.token_usage);
      const total = usages.reduce(
        (sum, usage) =>
          sum + usage.uncached_input + usage.cache_read + usage.cache_write + usage.output,
        0,
      );
      const top = usages
        .filter((usage) => frontier.has(usage.model_id))
        .reduce(
          (sum, usage) =>
            sum + usage.uncached_input + usage.cache_read + usage.cache_write + usage.output,
          0,
        );
      return top / total;
    };
    expect(shareIn("2026-04")).toBeCloseTo(0.25, 1);
    expect(shareIn("2026-08")).toBeCloseTo(0.1, 1);
    expect(shareIn("2026-04")).toBeGreaterThan(shareIn("2026-08") + 0.1);
  });
});

describe("T-F5 — the two shipped accounts", () => {
  it("gives both accounts real sessions", () => {
    for (const id of [OPEN_ACCOUNT, RESTRICTED_ACCOUNT]) {
      expect(memberById.get(id)).toBeDefined();
      expect(visible.filter((row) => row.member_id === id).length).toBeGreaterThan(5);
    }
  });

  it("makes the restricted account's population a strict subset of the Organization", () => {
    const restricted = memberById.get(RESTRICTED_ACCOUNT);
    const teamMates = directory.members.filter((member) =>
      member.team_ids.some((id) => restricted?.team_ids.includes(id)),
    );
    expect(teamMates.length).toBeGreaterThan(1);
    expect(teamMates.length).toBeLessThan(directory.members.length);
    const open = memberById.get(OPEN_ACCOUNT);
    expect(open?.team_ids).not.toEqual(restricted?.team_ids);
    const teamCost = visible
      .filter((row) => teamMates.some((member) => member.id === row.member_id))
      .reduce((total, row) => total + row.cost, 0);
    const orgCost = visible.reduce((total, row) => total + row.cost, 0);
    expect(teamCost).toBeLessThan(orgCost);
  });
});

describe("T-F6 — timezone edge rows", () => {
  it("seeds sessions between 22:00 and 24:00 Europe/Madrid", () => {
    const late = allSessions.filter((row) => Number(row.started_at.slice(11, 13)) >= 22);
    expect(late.length).toBeGreaterThanOrEqual(10);
    for (const row of late) expect(row.started_at.endsWith("+02:00")).toBe(true);
  });

  // R-D5 names the 22:00–24:00 window and says those rows "land on the previous UTC day".
  // At UTC+2 they do not — 23:00 Madrid is 21:00 UTC, the same date. The rows that really do
  // sit on a different UTC date are the ones just after local midnight, and they are seeded
  // too, because they are what a UTC-bucketed query would place in the wrong period.
  it("seeds rows whose UTC date differs from their Madrid date", () => {
    const crossing = allSessions.filter(
      (row) => new Date(row.started_at).toISOString().slice(0, 10) !== row.started_at.slice(0, 10),
    );
    expect(crossing.length).toBeGreaterThanOrEqual(5);
    for (const row of crossing) expect(Number(row.started_at.slice(11, 13))).toBeLessThan(2);
  });

  it("keeps every row at Madrid's +02:00, so no DST transition sits in the window", () => {
    for (const row of allSessions) {
      expect(row.started_at.endsWith("+02:00")).toBe(true);
      expect(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Madrid",
          timeZoneName: "longOffset",
        }).format(new Date(row.started_at)),
      ).toContain("GMT+02:00");
    }
  });
});

describe("T-F7 — Task keys", () => {
  it("keys every Task as owner/repo#number", () => {
    for (const task of tasks) {
      expect(task.key).toMatch(/^equilibrio\/[a-z-]+#\d+$/u);
      expect(task.key).toBe(
        `equilibrio/${repositoryNameById.get(task.repository_id)}#${task.number}`,
      );
    }
  });

  it("resolves every session's Task key to a Task in the same Repository", () => {
    const taskByKey = new Map(tasks.map((task) => [task.key, task]));
    for (const row of allSessions) {
      const task = taskByKey.get(row.task_key);
      expect(task).toBeDefined();
      expect(task?.repository_id).toBe(row.repository_id);
    }
  });

  it("leaves no Task without a session", () => {
    const keys = new Set(allSessions.map((row) => row.task_key));
    for (const task of tasks) expect(keys.has(task.key)).toBe(true);
  });
});

describe("T-F8 — the GitHub join", () => {
  it("matches every GitHub user to a Member under the documented rule", () => {
    const candidates = directory.members.map((member) => ({
      id: member.id,
      full_name: member.full_name,
      email: member.email,
    }));
    for (const user of directory.github_users) {
      const outcome = joinGithubUser(user, candidates);
      expect(outcome.matched).toBe(true);
      expect(outcome.member_id).toBe(
        directory.members.find((member) => member.github_id === user.id)?.id,
      );
    }
  });

  it("resolves every session's Member", () => {
    for (const row of allSessions) expect(memberById.has(row.member_id)).toBe(true);
  });
});
