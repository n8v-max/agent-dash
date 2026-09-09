// Boundary 1 — the only place in the application that reads JSON (technical-spec § 3.1).
//
// It reads the committed fixture, validates every file against `schema.ts`, removes hidden
// sessions **once**, folds every child session into its root **once**, and caches the result for
// the life of the process. Everything above this
// line receives typed rows; nothing above it opens a file, and nothing above it can opt back
// into a hidden row, because no function here takes an option that would let it.
//
// Five invariants live here rather than downstream:
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
//   * **R-M19 — child sessions are rolled into their root at parse**, on the same line as the
//     hidden strip and for the same reason (ADR-0008). A sub-agent fan-out is one attempt worked
//     by several agents, not several attempts, so `sessions` holds **roots**, carrying their
//     children's cost, tokens and duration. The child rows survive on `childSessions`, keyed by
//     the root that spawned them, because `/demo/history` shows the raw rows under every
//     aggregate and a fan-out is exactly what a reader goes there to see.
//   * **Every fault names the file, the row index and the field** (ticket 53, T-U26). The schema
//     validators are handed a path and already do; the cross-row checks below are handed a flat
//     list, so they carry a `RowSource` to say the same thing. A fault that names only a session
//     id is a fault whose fix starts with a grep, and a loader is the one place in this
//     application where the diagnosis has to be free — it runs before anything is rendered.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { childFaults, childrenByRoot, rollUpSessions } from "@/domain/sessions";
import type {
  AgentSession,
  GithubUser,
  Member,
  Membership,
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
  membershipSchema,
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
 * The committed fixture, parsed and validated. `sessions` is a single time-ordered list of
 * **root** sessions with hidden rows already gone — there is no second list holding them, here or
 * anywhere.
 */
export type Dataset = {
  readonly organization: Organization;
  readonly repositories: readonly Repository[];
  readonly teams: readonly Team[];
  readonly members: readonly Member[];
  /**
   * Member↔Organization, with the Role held per pairing. **Tenancy is stated here and nowhere
   * else** — `resolveViewer` resolves the acting Member *through* this list, so a Member of
   * another Organization is not findable rather than merely not permitted (ticket 58).
   */
  readonly memberships: readonly Membership[];
  readonly githubUsers: readonly GithubUser[];
  readonly tasks: readonly Task[];
  readonly workTypes: readonly WorkType[];
  readonly models: readonly Model[];
  readonly rateCards: RateCards;
  /** Roots, each carrying its children's cost, tokens and duration spans (R-M19). */
  readonly sessions: readonly AgentSession[];
  /**
   * The child rows as stored, by the id of the root that spawned them. Read by `/demo/history`
   * alone (R-N20.2): every other surface reads a figure that already has them in it.
   */
  readonly childSessions: ReadonlyMap<string, readonly AgentSession[]>;
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
 * **Where a row was read from — `<file>[<row index>]`.** The schema validators already name that
 * much on a bad field, because they are handed the path; the cross-row checks below are handed a
 * flat list and would otherwise be able to name only the row's id. A fault that names the file,
 * the index and the field is a fault a reader can open the file at (ticket 53).
 *
 * Keyed by row identity rather than by session id, because the duplicate-id check is itself one
 * of the callers: two rows sharing an id must still resolve to two different places.
 */
type RowSource = ReadonlyMap<AgentSession, string>;

/** `<file>[<row index>].<field>` — the three parts every fault message below is built from. */
const fieldAt = (source: RowSource, row: AgentSession, field: string): string =>
  `${source.get(row) ?? "sessions"}.${field}`;

/** Which of the two labels the file declares this row disagrees with, or `null` if neither. */
const strayField = (
  row: AgentSession,
  repository: Repository,
  workType: WorkType,
): "repository_id" | "work_type" | null => {
  if (row.repository_id !== repository.id) return "repository_id";
  if (row.work_type !== workType.key) return "work_type";
  return null;
};

/**
 * A row filed under the wrong pair would be counted under the wrong repository by every
 * surface that groups by one, and the file name is the only place the pair is declared.
 */
const assertPair = (
  rows: readonly AgentSession[],
  pair: { readonly repository: Repository; readonly workType: WorkType },
  source: RowSource,
): void => {
  const { repository, workType } = pair;
  for (const row of rows) {
    const wrong = strayField(row, repository, workType);
    if (wrong === null) continue;
    throw new FixtureFault(
      `${fieldAt(source, row, wrong)}: session ${row.id} is filed under the wrong pair — it ` +
        `carries ${row.repository_id} × ${row.work_type}, the file declares ` +
        `${repository.id} × ${workType.key}.`,
    );
  }
};

const assertUniqueIds = (rows: readonly AgentSession[], source: RowSource): void => {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) {
      throw new FixtureFault(
        `${fieldAt(source, row, "id")}: duplicate session id ${row.id} — ` +
          "every row would be counted twice.",
      );
    }
    seen.add(row.id);
  }
};

/**
 * **A TokenUsage names a Model, and the Model roster is a different file.** `schema.ts` can only
 * see that `model_id` is a string; whether that string resolves is a claim across two files, so
 * it is checked here, where both are in scope.
 *
 * An unresolved id is a fault rather than a dropped row because the mix panel rolls Model up to
 * family and tier (R-M7): an id nothing declares has no family and no tier, so it would either
 * disappear from a partition that is asserted to sum, or print a raw id where a family belongs.
 */
const assertKnownModels = (
  rows: readonly AgentSession[],
  source: RowSource,
  modelIds: ReadonlySet<string>,
): void => {
  for (const row of rows) {
    const index = row.token_usage.findIndex((usage) => !modelIds.has(usage.model_id));
    if (index === -1) continue;
    const usage = row.token_usage[index];
    const field = `token_usage[${index}].model_id`;
    throw new FixtureFault(
      `${fieldAt(source, row, field)}: unknown model ` +
        `${JSON.stringify(usage?.model_id)} — models.json declares the roster, and a Model it ` +
        "does not name has no family and no tier to roll up into (R-M7).",
    );
  }
};

/**
 * **A Membership names an Organization and a Member, and both live in other files.** `schema.ts`
 * sees two strings; whether either resolves is a claim across three files, so it is checked here.
 *
 * Both are faults rather than dropped rows, and for the same reason the model check gives: a
 * membership naming an Organization nothing declares grants standing in a tenant that does not
 * exist, and one naming an absent Member is a grant to nobody. Ticket 58 exists because the
 * absence of this check is what made "a second Organization is a fixture change and no code
 * change" *look* true — there was no way to express the bad state, so nothing caught it.
 *
 * The duplicate check is here too: two rows for one pairing are two Roles for one Member in one
 * Organization, and which one wins would be file order.
 */
const assertMemberships = (
  memberships: readonly Membership[],
  organization: Organization,
  members: readonly Member[],
): void => {
  const memberIds = new Set(members.map((member) => member.id));
  const seen = new Set<string>();
  memberships.forEach((membership, index) => {
    const at = `memberships.json[${String(index)}]`;
    if (membership.organization_id !== organization.id) {
      throw new FixtureFault(
        `${at}.organization_id: unknown Organization ${JSON.stringify(membership.organization_id)} — ` +
          `organization.json declares ${organization.id}, and a Membership in an Organization ` +
          "nothing declares is standing in a tenant that does not exist.",
      );
    }
    if (!memberIds.has(membership.member_id)) {
      throw new FixtureFault(
        `${at}.member_id: unknown Member ${JSON.stringify(membership.member_id)} — ` +
          "members.json declares the directory, and a Membership naming a Member it does not " +
          "hold is a grant to nobody.",
      );
    }
    const pair = `${membership.organization_id}\u0000${membership.member_id}`;
    if (seen.has(pair)) {
      throw new FixtureFault(
        `${at}.member_id: duplicate Membership for ${membership.member_id} in ` +
          `${membership.organization_id} — one Member holds one Role per Organization, and which ` +
          "of two rows won would be file order.",
      );
    }
    seen.add(pair);
  });
};

const byStartedAt = (left: AgentSession, right: AgentSession): number =>
  Date.parse(left.started_at) - Date.parse(right.started_at) || left.id.localeCompare(right.id);

/**
 * **R-M19 — the tree is checked before it is collapsed.** A child that names a root which does
 * not exist, is not a root, disagrees with one of the five labels it inherits, carries `accepted`
 * or is visible under a hidden root is a fault, not a row to drop: its cost has nowhere to roll
 * up to, so keeping it would put a figure in no total, and dropping it would remove one silently.
 * The rules themselves are `childFaults`, in the domain layer, so the loader and the fixture
 * invariant test cannot come to different conclusions about what a valid child is.
 */
const assertSessionTree = (rows: readonly AgentSession[], source: RowSource): void => {
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const row of rows) {
    const parentId = row.parent_session_id;
    if (parentId === null) continue;
    const faults = childFaults(row, byId.get(parentId));
    if (faults.length > 0) {
      throw new FixtureFault(
        `${fieldAt(source, row, "parent_session_id")}: child session ${row.id} names root ` +
          `${parentId} — ${faults.join(", ")}. A child inherits its root's Task, Member, ` +
          "Repository, WorkType and execution_mode, never carries `accepted`, and rolls up " +
          "into a root that is itself visible (R-M19).",
      );
    }
  }
};

/** The two lists the fixture's session files resolve to: the roots, and the children under them. */
type SessionSet = {
  readonly sessions: readonly AgentSession[];
  readonly childSessions: ReadonlyMap<string, readonly AgentSession[]>;
};

/**
 * Reads every `(repository × work_type)` file the manifest implies, drops hidden rows, folds each
 * child into its root, and returns one time-ordered list of roots. Both the strip (R-M2) and the
 * roll-up (R-M19) happen here, at parse, and only here.
 *
 * A child is filed under the same `(repository × work_type)` pair as its root, because it inherits
 * both labels — so the tree never spans two files and `assertPair` still describes every row.
 */
const readSessions = (
  reader: FixtureReader,
  repositories: readonly Repository[],
  workTypes: readonly WorkType[],
  modelIds: ReadonlySet<string>,
): SessionSet => {
  const pairs = repositories.flatMap((repository) =>
    workTypes.map((workType) => ({ repository, workType })),
  );

  const stored: AgentSession[] = [];
  const source = new Map<AgentSession, string>();
  for (const pair of pairs) {
    const path = sessionFile(pair.repository, pair.workType);
    const rows = readFile(reader, path, arrayOf(sessionSchema));
    rows.forEach((row, index) => source.set(row, `${path}[${index}]`));
    assertPair(rows, pair, source);
    stored.push(...rows);
  }

  assertUniqueIds(stored, source);
  assertKnownModels(stored, source, modelIds);
  assertSessionTree(stored, source);
  // R-M2, once and for all. Nothing downstream is offered the alternative — and a hidden root
  // takes its children with it, which `assertSessionTree` is what makes true.
  const visible = stored.filter((row) => !row.hidden);
  return {
    sessions: [...rollUpSessions(visible)].sort(byStartedAt),
    childSessions: childrenByRoot(visible),
  };
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
  // Read before the sessions, because a session's TokenUsage names a Model and this file is
  // where the roster is declared: the check spans the two, so both have to be in scope.
  const models = readFile(reader, "models.json", arrayOf(modelSchema));
  const organization = readFile(reader, "organization.json", organizationSchema);
  const memberships = readFile(reader, "memberships.json", arrayOf(membershipSchema));
  assertMemberships(memberships, organization, directory.members);

  return {
    organization,
    repositories,
    teams: readFile(reader, "teams.json", arrayOf(teamSchema)),
    members: directory.members,
    memberships,
    githubUsers: directory.github_users,
    tasks: readFile(reader, "tasks.json", arrayOf(taskSchema)),
    workTypes,
    models,
    rateCards: readFile(reader, "rate_cards.json", rateCardsSchema),
    ...readSessions(reader, repositories, workTypes, new Set(models.map((model) => model.id))),
  };
};

let cached: Dataset | undefined;

/**
 * The application's single entry point to the data. Static, committed and immutable, so it is
 * parsed once per process and shared — R-T36 puts the whole dataset at ~750 rows, which is
 * comfortably held in memory and needs no pagination, streaming or revalidation.
 */
export const loadDataset = (): Dataset => (cached ??= readDataset());
