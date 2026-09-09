// Serialising the committed dataset (technical-spec § 2 and R-T19). Two shapes live here:
// one file per (Repository × WorkType) for sessions, because that is how platform events
// would arrive, and one file per collection for everything else.

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_NAMES, WORK_TYPE_KEYS } from "./allocation.mts";
import { models, organization, rateCards, repositories, workTypes } from "./catalog.mts";
import { githubUsers, members, memberships, teams } from "./people.mts";
import type { AgentSession, Task } from "./types.mts";

export type Fixture = { sessions: AgentSession[]; tasks: Task[] };

export const sessionFileName = (repository: string, workType: string): string =>
  `${repository}__${workType}.json`;

const writeJson = (path: string, value: unknown): void => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

// R-D19 — all 25 files exist and empty pairs hold []. The file set declares the full matrix,
// so a missing file is unambiguously a fault rather than a valid state.
const writeSessions = (directory: string, sessions: readonly AgentSession[]): number => {
  const byRepository = new Map(repositories.map((repository) => [repository.id, repository.name]));
  let written = 0;
  for (const repository of REPO_NAMES) {
    for (const workType of WORK_TYPE_KEYS) {
      const rows = sessions.filter(
        (row) => byRepository.get(row.repository_id) === repository && row.work_type === workType,
      );
      writeJson(join(directory, sessionFileName(repository, workType)), rows);
      written += 1;
    }
  }
  return written;
};

export const writeFixture = (directory: string, fixture: Fixture): number => {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(join(directory, "sessions"), { recursive: true });
  const files = writeSessions(join(directory, "sessions"), fixture.sessions);
  writeJson(join(directory, "organization.json"), organization);
  writeJson(join(directory, "members.json"), { github_users: githubUsers, members });
  writeJson(join(directory, "memberships.json"), memberships);
  writeJson(join(directory, "teams.json"), teams);
  writeJson(join(directory, "repositories.json"), repositories);
  writeJson(join(directory, "work_types.json"), workTypes);
  writeJson(join(directory, "models.json"), models);
  writeJson(join(directory, "rate_cards.json"), rateCards);
  writeJson(
    join(directory, "tasks.json"),
    [...fixture.tasks].sort(
      (a, b) => a.repository_id.localeCompare(b.repository_id) || a.number - b.number,
    ),
  );
  return files + 8;
};
