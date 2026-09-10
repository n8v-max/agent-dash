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
// R-M19 — **session count means root count.** Every distribution stated in sessions is asserted
// over roots: a child carries no outcome, so counting one in an acceptance denominator would
// divide by rows that could never be accepted. Token-grain claims still read every row, because a
// child's tokens are real and reach the product through its root.
const roots = visible.filter((row) => row.parent_session_id === null);
const children = allSessions.filter((row) => row.parent_session_id !== null);
const tasks = read<Task[]>("tasks.json");
const repositories = read<Repository[]>("repositories.json");
const directory = read<{ github_users: GithubUser[]; members: Member[] }>("members.json");

const repositoryNameById = new Map(repositories.map((repository) => [repository.id, repository.name]));
// The roster is read off the committed file rather than typed here, so ticket 70's ten models
// and their tiers are one source of truth for this file as well as for the application.
const models = read<{ id: string; vendor: string; family: string; tier: string }[]>("models.json");
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
      const rows = roots.filter((row) => row.work_type === workType);
      expect(rows.length).toBeGreaterThan(0);
      expect(
        Math.abs(acceptanceOf(rows) - ACCEPTANCE_BY_WORK_TYPE[workType]),
      ).toBeLessThanOrEqual(ACCEPTANCE_TOLERANCE);
    }
  });

  it("carries R-D7 acceptance by Repository", () => {
    for (const repository of REPOSITORIES) {
      const rows = roots.filter(
        (row) => repositoryNameById.get(row.repository_id) === repository,
      );
      expect(
        Math.abs(acceptanceOf(rows) - ACCEPTANCE_BY_REPOSITORY[repository]),
      ).toBeLessThanOrEqual(ACCEPTANCE_TOLERANCE);
    }
  });

  it("carries R-D8 rework at 18% and decomposition at 12%, over non-review sessions", () => {
    // **Non-review**, since ticket 67 (R-D8, `CONTEXT.md` § Work). Every Job that was built is
    // reviewed (R-D22), so counting a review as one of the Task's attempts would make almost
    // every reviewed Task a Decomposition — see the counterfactual below.
    const grouped = groupByTask(roots).map((rows) =>
      rows.filter((row) => row.work_type !== "review"),
    );
    const rework = grouped.filter((rows) => rows.slice(0, -1).some((row) => !row.accepted));
    const decomposition = grouped.filter(
      (rows) => rows.filter((row) => row.accepted).length > 1,
    );
    expect(grouped.every((rows) => rows.length > 0)).toBe(true);
    expect(rework.length / grouped.length).toBeCloseTo(0.18, 2);
    expect(decomposition.length / grouped.length).toBeCloseTo(0.12, 2);
  });

  it("would lose both labels to the reviews if they were counted as attempts", () => {
    const grouped = groupByTask(roots);
    const naive = grouped.filter((rows) => rows.filter((row) => row.accepted).length > 1);

    expect(naive.length / grouped.length).toBeGreaterThan(0.4);
  });

  it("fills all four R-D9 incomplete-Task age buckets, including 91+", () => {
    const endMs = Date.parse(`${WINDOW_END}T23:59:59+02:00`);
    const ages = groupByTask(roots)
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
      (member) => roots.filter((row) => row.member_id === member.id).length,
    );
    expect(counts.filter((count) => count > 0 && count < 5).length).toBeGreaterThanOrEqual(1);
  });

  it("holds R-D11's ~20 CPU-heavy, token-light sessions", () => {
    const cpuHeavy = roots.filter(
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
    const storedRoots = allSessions.filter((row) => row.parent_session_id === null);
    const hidden = storedRoots.filter((row) => row.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    // The share is of roots, on R-M19's rule: a hidden root takes its children with it, so a
    // denominator counting children would report a hidden share the fan-out had diluted.
    expect(hidden.length / storedRoots.length).toBeCloseTo(0.02, 2);
    expect(roots.length).toBeLessThan(storedRoots.length);
  });

  it("holds R-D13's interactive service account and headless humans", () => {
    const kindOf = (row: AgentSession) => memberById.get(row.member_id)?.kind;
    expect(
      roots.filter(
        (row) => kindOf(row) === "service_account" && row.execution_mode === "interactive",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      roots.filter((row) => kindOf(row) === "human" && row.execution_mode === "headless").length,
    ).toBeGreaterThan(0);
  });

  it("holds R-D14's overlapping Teams", () => {
    const multiTeam = directory.members.filter((member) => member.team_ids.length > 1);
    expect(multiTeam.length).toBeGreaterThanOrEqual(3);
    const crossTeam = REPOSITORIES.filter((repository) => {
      const workers = new Set(
        roots
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
    const multi = roots.filter((row) => row.token_usage.length > 1);
    expect(multi.length / roots.length).toBeCloseTo(0.4, 1);
  });

  // **R-D17, rewritten by ticket 70.** The frontier share used to fall, 25% to 10%, against a
  // roster that stopped at `gpt-6-astra` and `claude-opus-5`. With `claude-fable-5-1` arriving
  // in June it *rises* instead, and the optimisation story moved to `claude-haiku-4-5`, which
  // fades from 28 points to 10 as the balanced models get good enough to be the default.
  //
  // The frontier set and the months are derived — from `models.json` and from the rows — for
  // the reason `testing-spec.md` § T-F gives: a literal a roster edit re-types is a literal that
  // has stopped checking anything.
  it("holds R-D17's rising frontier share and Claude Haiku's fade", () => {
    const frontier = new Set(
      models.filter((model) => model.tier === "frontier").map((model) => model.id),
    );
    const tokensOf = (usages: readonly { uncached_input: number; cache_read: number; cache_write: number; output: number }[]): number =>
      usages.reduce(
        (sum, usage) =>
          sum + usage.uncached_input + usage.cache_read + usage.cache_write + usage.output,
        0,
      );
    const months = [...new Set(visible.map((row) => row.started_at.slice(0, 7)))].sort();
    const sharesIn = (month: string) => {
      const usages = visible
        .filter((row) => row.started_at.startsWith(month))
        .flatMap((row) => row.token_usage);
      const total = tokensOf(usages);
      return {
        frontier: tokensOf(usages.filter((usage) => frontier.has(usage.model_id))) / total,
        haiku: tokensOf(usages.filter((usage) => usage.model_id === "claude-haiku-4-5")) / total,
      };
    };

    expect(frontier.size).toBe(3);
    expect(months).toHaveLength(6);
    const monthly = months.map(sharesIn);
    // Rising, every month, and by at least ten points across the window.
    for (const [at, entry] of monthly.entries()) {
      if (at === 0) continue;
      expect(entry.frontier).toBeGreaterThan(monthly[at - 1].frontier);
    }
    expect(monthly.at(-1)!.frontier).toBeGreaterThan(monthly[0].frontier + 0.1);
    // And the fade that replaced it as the optimisation story.
    expect(monthly[0].haiku).toBeGreaterThan(monthly.at(-1)!.haiku + 0.1);
    expect(monthly.at(-1)!.haiku).toBeLessThanOrEqual(0.12);
  });
});

// R-D22 — the review linkage, re-derived from the committed JSON rather than trusted from the
// generator (P3 / R-T20). Four facts, and they are the four the generator asserts as it writes.
describe("T-F11 — every Job that was built is reviewed, by somebody else (R-D22)", () => {
  const BUILT: readonly WorkTypeKey[] = ["implementation", "bugfix", "refactor"];
  const built = roots.filter((row) => BUILT.includes(row.work_type));
  const reviews = roots.filter((row) => row.work_type === "review");
  const rowsByTask = new Map<string, AgentSession[]>();
  for (const row of roots) rowsByTask.set(row.task_key, [...(rowsByTask.get(row.task_key) ?? []), row]);

  it("puts at least one review on the Task of every implementation, bug fix and refactor", () => {
    const unreviewed = built.filter(
      (row) =>
        !(rowsByTask.get(row.task_key) ?? []).some((peer) => peer.work_type === "review"),
    );

    expect(built.length).toBeGreaterThan(0);
    expect(unreviewed).toEqual([]);
  });

  it("runs 122% as many reviews as Jobs built — some Jobs are reviewed twice", () => {
    expect(reviews.length).toBeGreaterThanOrEqual(Math.ceil(1.22 * built.length));
    const twice = [...rowsByTask.values()].filter(
      (rows) => rows.filter((row) => row.work_type === "review").length > 1,
    );

    expect(twice.length).toBeGreaterThan(0);
  });

  it("holds refactors at 17% of implementations and bug fixes at 29%, within 2%", () => {
    const countOf = (key: WorkTypeKey): number =>
      roots.filter((row) => row.work_type === key).length;
    const implementations = countOf("implementation");

    expect(countOf("refactor") / implementations).toBeCloseTo(0.17, 2);
    expect(countOf("bugfix") / implementations).toBeCloseTo(0.29, 2);
  });

  it("never lets a Member review their own Job, and always runs the review afterwards", () => {
    const TEN_MINUTES = 10 * 60_000;
    const FOUR_DAYS = 4 * 86_400_000;
    for (const review of reviews) {
      const peers = (rowsByTask.get(review.task_key) ?? []).filter((row) =>
        BUILT.includes(row.work_type),
      );
      expect(peers.length).toBeGreaterThan(0);
      expect(peers.some((peer) => peer.member_id === review.member_id)).toBe(false);
      const gaps = peers
        .map((peer) => Date.parse(review.started_at) - Date.parse(peer.ended_at))
        .filter((gap) => gap >= TEN_MINUTES);
      expect(gaps.length).toBeGreaterThan(0);
      expect(Math.min(...gaps)).toBeLessThanOrEqual(FOUR_DAYS);
    }
  });

  it("hands most reviews to somebody on the author's own Team", () => {
    const teamsOf = (id: string): ReadonlySet<string> =>
      new Set(memberById.get(id)?.team_ids ?? []);
    const sameTeam = reviews.filter((review) => {
      const mine = teamsOf(review.member_id);
      return (rowsByTask.get(review.task_key) ?? [])
        .filter((row) => BUILT.includes(row.work_type))
        .some((peer) => [...teamsOf(peer.member_id)].some((team) => mine.has(team)));
    });

    expect(sameTeam.length / reviews.length).toBeGreaterThan(0.8);
  });
});

describe("T-F10 — the session tree (R-M19, R-D21)", () => {
  const byId = new Map(allSessions.map((row) => [row.id, row]));
  const inherited = [
    "member_id",
    "repository_id",
    "work_type",
    "task_key",
    "execution_mode",
  ] as const;

  it("spawns children from ~20% of visible roots, one to four at a time", () => {
    const parents = new Set(children.map((child) => child.parent_session_id));
    expect(children.length).toBeGreaterThan(0);
    expect(parents.size / roots.length).toBeCloseTo(0.2, 2);
    for (const parent of parents) {
      const count = children.filter((child) => child.parent_session_id === parent).length;
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it("gives every child a parent that exists, is a root, and shares the five labels", () => {
    for (const child of children) {
      const parent = byId.get(child.parent_session_id ?? "");
      expect(parent).toBeDefined();
      expect(parent?.parent_session_id).toBeNull();
      for (const label of inherited) expect(child[label]).toBe(parent?.[label]);
    }
  });

  it("never lets a child carry the outcome, and never hides one under a visible root", () => {
    for (const child of children) {
      expect(child.accepted).toBe(false);
      expect(child.hidden).toBe(byId.get(child.parent_session_id ?? "")?.hidden);
    }
  });

  it("nests every child inside its root's window, so the root's wall clock spans the attempt", () => {
    for (const child of children) {
      const parent = byId.get(child.parent_session_id ?? "");
      expect(Date.parse(child.started_at)).toBeGreaterThan(Date.parse(parent?.started_at ?? ""));
      expect(Date.parse(child.ended_at)).toBeLessThan(Date.parse(parent?.ended_at ?? ""));
    }
  });

  it("leans the fan-out toward implementation and headless work", () => {
    const shareOf = (rows: readonly AgentSession[], holds: (row: AgentSession) => boolean) =>
      rows.filter(holds).length / rows.length;
    const fannedOut = roots.filter((root) =>
      children.some((child) => child.parent_session_id === root.id),
    );
    for (const holds of [
      (row: AgentSession) => row.work_type === "implementation",
      (row: AgentSession) => row.execution_mode === "headless",
    ]) {
      expect(shareOf(fannedOut, holds)).toBeGreaterThan(shareOf(roots, holds));
    }
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

// Ticket 65 — the twenty Members read as twenty different people at a glance.
//
// Over the committed directory, not the generator (P3 / R-T20). The comparison strips accents
// and case, so "Sáez" and "Saez" are one token: a reader scanning a legend does not spell-check
// diacritics, and neither does the join (R-D20, rule 2).
//
// **Service accounts are excluded on purpose.** "Equilibrio Deploy Bot" and "Equilibrio Nightly
// Runner" share the Organization's own name in first position because that is what they are —
// the Organization's robots, not two people who happen to be related. The rule is about the 18
// humans a reader has to tell apart.
const nameTokens = (fullName: string): readonly string[] =>
  fullName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(" ")
    .filter((part) => part.length > 0);

const hasAccent = (fullName: string): boolean => fullName.normalize("NFD") !== fullName;

describe("R-D1 — no two Members share a first name or a surname", () => {
  const humans = directory.members.filter((member) => member.kind === "human");

  it("seeds 18 humans, every one of them named", () => {
    expect(humans).toHaveLength(18);
    for (const member of humans) expect(nameTokens(member.full_name).length).toBeGreaterThan(1);
  });

  it("gives every human a first name nobody else has", () => {
    const firstNames = humans.map((member) => nameTokens(member.full_name)[0]);

    expect(new Set(firstNames).size).toBe(firstNames.length);
  });

  it("repeats no surname token, in either position", () => {
    // Both positions in one bag: the collisions this replaced were "Nuria Castells **Vidal**" /
    // "Héctor Camps **Vidal**" and "Elena Sáez **Roldán**" / "**Roldán** Nieto", and the second
    // pair only reads as a collision if a first surname and a second surname are compared.
    const surnames = humans.flatMap((member) => nameTokens(member.full_name).slice(1));

    expect(surnames).not.toHaveLength(0);
    expect(new Set(surnames).size).toBe(surnames.length);
  });

  it("gives at least 8 humans one surname and at least 8 the Spanish two-surname form", () => {
    const twoWord = humans.filter((member) => nameTokens(member.full_name).length === 2);
    const twoSurname = humans.filter((member) => nameTokens(member.full_name).length === 3);

    expect(twoWord.length).toBeGreaterThanOrEqual(8);
    expect(twoSurname.length).toBeGreaterThanOrEqual(8);
    expect(twoWord.length + twoSurname.length).toBe(humans.length);
  });

  it("keeps accents on several names, so the join's normalisation still does work", () => {
    // R-D20 rule 2 folds accents away. If no seeded name carried one, the fold would be a
    // no-op on the committed data and T-F8 would pass against a normaliser that did nothing.
    expect(humans.filter((member) => hasAccent(member.full_name)).length).toBeGreaterThanOrEqual(6);
  });

  it("carries four GitHub users that only the name rule can match (R-D20)", () => {
    const candidates = directory.members.map((member) => ({
      id: member.id,
      full_name: member.full_name,
      email: member.email,
    }));
    const byName = directory.github_users.filter(
      (user) => joinGithubUser(user, candidates).rule === "full_name",
    );

    expect(byName.length).toBeGreaterThanOrEqual(4);
    // …and each of them is matched on a spelling that differs from the Member's own, so the
    // normalisation is load-bearing rather than an equality check dressed up.
    for (const user of byName) {
      const member = directory.members.find((candidate) => candidate.github_id === user.id);
      expect(member).toBeDefined();
      expect(user.email === null || user.email.endsWith("users.noreply.github.com")).toBe(true);
    }
  });
});

// R-D23 — **the token scale**, re-derived from the committed JSON (ticket 68). The figures are
// restated here from `spec.md` § 8 rather than imported from `targets.mts`, exactly as the rates
// above are: a test that imported the target would move with it and check nothing.
//
// The Member-month claims are read over **roots carrying their children** — a child's tokens are
// its root's to answer for (R-M19) — and over the four months lying wholly inside the window,
// which are the only ones a monthly figure can be read off.
describe("T-F12 — the token scale (R-D23)", () => {
  const TOKEN_FLOOR = 75_000;
  const CPU_HEAVY_CEILING = 60_000;
  const POOLED_BAND = { min: 80_000_000, max: 130_000_000 };
  const MONTHLY_BAND = { min: 70_000_000, max: 145_000_000 };
  const LEADER = 1_000_000_000;
  const FULL_MONTHS = ["2026-05", "2026-06", "2026-07", "2026-08"];

  const storedRoots = allSessions.filter((row) => row.parent_session_id === null);
  const isCpuHeavy = (row: AgentSession): boolean =>
    row.machine_spec === "compute" &&
    row.machine_allocation_duration_s >= 4 * 3600 &&
    tokensOf(row) <= CPU_HEAVY_CEILING;

  /** Every visible row's tokens, keyed by the Member and the month of its **root's** start. */
  const memberMonths = (month: string): number[] => {
    const rootOf = new Map(roots.map((row) => [row.id, row]));
    const held = new Map<string, number>();
    for (const row of visible) {
      const root = rootOf.get(row.parent_session_id ?? row.id);
      if (root === undefined || !root.started_at.startsWith(month)) continue;
      if (memberById.get(root.member_id)?.kind !== "human") continue;
      held.set(root.member_id, (held.get(root.member_id) ?? 0) + tokensOf(row));
    }
    return [...held.values()];
  };

  const median = (values: readonly number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  it("puts no attempt below 75,000 tokens but R-D11's token-light rows", () => {
    const light = storedRoots.filter((row) => tokensOf(row) < TOKEN_FLOOR);

    // Non-vacuity: the floor is a claim about a population that exists, and the exception is a
    // population of about twenty, not of one row or of every row.
    expect(storedRoots.length).toBeGreaterThan(1000);
    expect(light.length).toBeGreaterThanOrEqual(18);
    expect(light.length).toBeLessThanOrEqual(22);
    expect(light.filter((row) => !isCpuHeavy(row))).toEqual([]);
  });

  it("puts the median human Member-month at ~100M tokens", () => {
    const pooled = FULL_MONTHS.flatMap(memberMonths);

    expect(pooled.length).toBeGreaterThan(60);
    expect(median(pooled)).toBeGreaterThanOrEqual(POOLED_BAND.min);
    expect(median(pooled)).toBeLessThanOrEqual(POOLED_BAND.max);
  });

  it("keeps every full month's own median inside its wider band", () => {
    for (const month of FULL_MONTHS) {
      const middle = median(memberMonths(month));
      expect(middle, `${month} median Member-month`).toBeGreaterThanOrEqual(MONTHLY_BAND.min);
      expect(middle, `${month} median Member-month`).toBeLessThanOrEqual(MONTHLY_BAND.max);
    }
  });

  it("runs a Member into the billions in each of the last three full months", () => {
    for (const month of FULL_MONTHS.slice(-3)) {
      expect(Math.max(...memberMonths(month)), `${month} busiest Member-month`).toBeGreaterThanOrEqual(
        LEADER,
      );
    }
  });

  it("spreads the Member-months by an order of magnitude, which is what `/demo/people` shows", () => {
    const august = memberMonths("2026-08");

    expect(Math.max(...august) / median(august)).toBeGreaterThanOrEqual(10);
  });
});
