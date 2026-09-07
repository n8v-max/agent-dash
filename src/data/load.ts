// Boundary 1 — the only place in the application that reads JSON (technical-spec § 3.1).
//
// It reads the committed fixture, validates every file against `schema.ts`, removes hidden
// sessions **once**, and caches the result for the life of the process. Everything above this
// line receives typed rows; nothing above it opens a file, and nothing above it can opt back
// into a hidden row, because no function here takes an option that would let it.
//
// Three invariants live here rather than downstream:
//
//   * **R-M2 — hidden sessions are stripped at parse.** An AgentSession that terminated through
//     platform or infrastructure failure is absorbed by the platform, is billed to nobody and
//     appears in no metric and no view. That is a property of the dataset, not a query option:
//     a per-query filter is a filter somebody eventually forgets.
//   * **R-D19 — a missing session file is a fault.** The file set declares the full
//     (repository × work_type) matrix, so an empty pair holds `[]` and an absent file is
//     unambiguously drift between code and data. The expected names are *derived* from
//     `repositories.json` × `work_types.json`, so the matrix is stated by the data.
//   * **R-T11 / R-M4 — `cost` is read.** It is validated here and aggregated upstream of here.
//     There is no pricing function in this application; the rate cards are generator inputs and,
//     for the token card only, display data.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AgentSession,
  GithubUser,
  Member,
  Model,
  Organization,
  RateCards,
  Repository,
  Task,
  Team,
  WorkType,
} from "@/domain/types";
import {
  arrayOf,
  FixtureFault,
  membersFileSchema,
  modelSchema,
  organizationSchema,
  rateCardsSchema,
  repositorySchema,
  sessionSchema,
  taskSchema,
  teamSchema,
  workTypeSchema,
  type Validator,
} from "./schema";

/**
 * The committed fixture, parsed and validated. `sessions` is a single time-ordered list with
 * hidden rows already gone — there is no second list holding them, here or anywhere.
 */
export type Dataset = {
  readonly organization: Organization;
  readonly repositories: readonly Repository[];
  readonly teams: readonly Team[];
  readonly members: readonly Member[];
  readonly githubUsers: readonly GithubUser[];
  readonly tasks: readonly Task[];
  readonly workTypes: readonly WorkType[];
  readonly models: readonly Model[];
  readonly rateCards: RateCards;
  readonly sessions: readonly AgentSession[];
};

/** Returns the UTF-8 contents of a fixture file, or throws. Injectable so faults are testable. */
export type FixtureReader = (relativePath: string) => string;

/** Resolved from `process.cwd()`, which is the pattern the Next docs prescribe for reading files. */
const FIXTURE_DIRECTORY = join("src", "fixtures", "data");

export const readFixtureFile: FixtureReader = (relativePath) => {
  const absolute = join(process.cwd(), FIXTURE_DIRECTORY, relativePath);
  try {
    return readFileSync(absolute, "utf8");
  } catch (cause) {
    throw new FixtureFault(
      `${relativePath}: fixture file is missing or unreadable at ${absolute}. ` +
        "Every (repository × work_type) session file must exist; an empty pair holds [] (R-D19).",
      { cause },
    );
  }
};

const parseJson = (raw: string, path: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new FixtureFault(`${path}: not valid JSON`, { cause });
  }
};

const readFile = <T>(reader: FixtureReader, path: string, schema: Validator<T>): T =>
  schema(parseJson(reader(path), path), path);

const sessionFile = (repository: Repository, workType: WorkType): string =>
  join("sessions", `${repository.name}__${workType.key}.json`);

/**
 * A row filed under the wrong pair would be counted under the wrong repository by every
 * surface that groups by one, and the file name is the only place the pair is declared.
 */
const assertPair = (rows: readonly AgentSession[], repository: Repository, workType: WorkType, path: string): void => {
  const stray = rows.find(
    (row) => row.repository_id !== repository.id || row.work_type !== workType.key,
  );
  if (stray) {
    throw new FixtureFault(
      `${path}: session ${stray.id} is filed under the wrong pair — it carries ` +
        `${stray.repository_id} × ${stray.work_type}, the file declares ${repository.id} × ${workType.key}.`,
    );
  }
};

const assertUniqueIds = (rows: readonly AgentSession[]): void => {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) {
      throw new FixtureFault(`sessions: duplicate session id ${row.id} — every row would be counted twice.`);
    }
    seen.add(row.id);
  }
};

const byStartedAt = (left: AgentSession, right: AgentSession): number =>
  Date.parse(left.started_at) - Date.parse(right.started_at) || left.id.localeCompare(right.id);

/**
 * Reads every `(repository × work_type)` file the manifest implies, drops hidden rows, and
 * returns one time-ordered list. The strip happens here, at parse, and only here.
 */
const readSessions = (
  reader: FixtureReader,
  repositories: readonly Repository[],
  workTypes: readonly WorkType[],
): AgentSession[] => {
  const pairs = repositories.flatMap((repository) =>
    workTypes.map((workType) => ({ repository, workType })),
  );

  const visible: AgentSession[] = [];
  for (const { repository, workType } of pairs) {
    const path = sessionFile(repository, workType);
    const rows = readFile(reader, path, arrayOf(sessionSchema));
    assertPair(rows, repository, workType, path);
    // R-M2, once and for all. Nothing downstream is offered the alternative.
    visible.push(...rows.filter((row) => !row.hidden));
  }

  assertUniqueIds(visible);
  return visible.sort(byStartedAt);
};

/**
 * Parses and validates the whole fixture. Uncached: `loadDataset` is what the application
 * calls. The reader is a parameter so a test can hand it a malformed or incomplete dataset
 * and watch this throw, which is the only way to prove R-D19 is a fault rather than a comment.
 */
export const readDataset = (reader: FixtureReader = readFixtureFile): Dataset => {
  const repositories = readFile(reader, "repositories.json", arrayOf(repositorySchema));
  const workTypes = readFile(reader, "work_types.json", arrayOf(workTypeSchema));
  const directory = readFile(reader, "members.json", membersFileSchema);

  return {
    organization: readFile(reader, "organization.json", organizationSchema),
    repositories,
    teams: readFile(reader, "teams.json", arrayOf(teamSchema)),
    members: directory.members,
    githubUsers: directory.github_users,
    tasks: readFile(reader, "tasks.json", arrayOf(taskSchema)),
    workTypes,
    models: readFile(reader, "models.json", arrayOf(modelSchema)),
    rateCards: readFile(reader, "rate_cards.json", rateCardsSchema),
    sessions: readSessions(reader, repositories, workTypes),
  };
};

let cached: Dataset | undefined;

/**
 * The application's single entry point to the data. Static, committed and immutable, so it is
 * parsed once per process and shared — R-T36 puts the whole dataset at ~750 rows, which is
 * comfortably held in memory and needs no pagination, streaming or revalidation.
 */
export const loadDataset = (): Dataset => (cached ??= readDataset());
