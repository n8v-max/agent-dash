// Boundary 1 — runtime validation of the committed fixture shape (technical-spec § 3.1).
//
// Hand-written on purpose. The payload is a fixed, committed dataset of ten shapes; a schema
// library would add a dependency, a bundle and a DSL to learn in exchange for validating
// something that never changes. The combinators below are ~40 lines and read as the types do.
//
// Two rules this file exists to hold:
//   * a malformed fixture is a FAULT, not a degraded mode — every failure throws, nothing is
//     coerced, defaulted or dropped;
//   * the closed vocabularies come from `src/domain/types.ts`, so the validator and the union
//     type it produces cannot drift apart.
//
// Unknown keys are ignored: R-T19 gives the GitHub-shaped files a simplified envelope, and a
// validator that rejected extra fields would reject the real API's shape.

import {
  ARTEFACT_KINDS,
  EXECUTION_MODES,
  MACHINE_SPECS,
  MEMBER_KINDS,
  MODEL_TIERS,
  WORK_TYPE_KEYS,
  WORK_TYPE_SOURCES,
  type AgentSession,
  type ArtefactKind,
  type GithubUser,
  type Member,
  type Model,
  type Organization,
  type RateCards,
  type Repository,
  type Task,
  type Team,
  type TokenRate,
  type TokenUsage,
  type WorkType,
} from "@/domain/types";

/**
 * A fixture that does not match its schema, or a fixture file that is absent. Both are
 * faults: the dataset is committed alongside the code, so either one means the two have
 * drifted and no reading of the data can be trusted.
 */
export class FixtureFault extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FixtureFault";
  }
}

/** Parses `value` found at `path`, or throws. `path` is what makes a failure diagnosable. */
export type Validator<T> = (value: unknown, path: string) => T;

const kindOf = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

const fail = (path: string, expected: string, value: unknown): never => {
  throw new FixtureFault(`${path}: expected ${expected}, received ${kindOf(value)}`);
};

const string: Validator<string> = (value, path) =>
  typeof value === "string" ? value : fail(path, "string", value);

const boolean: Validator<boolean> = (value, path) =>
  typeof value === "boolean" ? value : fail(path, "boolean", value);

const number: Validator<number> = (value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fail(path, "a finite number", value);
  return value;
};

/** Counts, durations and money are all non-negative; a negative one is corrupt, not small. */
const nonNegative: Validator<number> = (value, path) => {
  const parsed = number(value, path);
  if (parsed < 0) throw new FixtureFault(`${path}: expected a non-negative number, received ${parsed}`);
  return parsed;
};

const nullableString: Validator<string | null> = (value, path) =>
  value === null ? null : string(value, path);

const asRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(path, "an object", value);
  }
  return value as Record<string, unknown>;
};

const oneOf =
  <T extends string>(allowed: readonly T[]): Validator<T> =>
  (value, path) => {
    const parsed = string(value, path);
    if (!(allowed as readonly string[]).includes(parsed)) {
      throw new FixtureFault(`${path}: expected one of ${allowed.join(" | ")}, received ${JSON.stringify(parsed)}`);
    }
    return parsed as T;
  };

export const arrayOf =
  <T>(item: Validator<T>): Validator<T[]> =>
  (value, path) => {
    if (!Array.isArray(value)) return fail(path, "an array", value);
    return value.map((entry, index) => item(entry, `${path}[${index}]`));
  };

type FieldValidators<T> = { readonly [K in keyof T]-?: Validator<T[K]> };

/** Every declared field is required and validated; undeclared fields are ignored. */
const object =
  <T extends object>(fields: FieldValidators<T>): Validator<T> =>
  (value, path) => {
    const raw = asRecord(value, path);
    const parsed: Record<string, unknown> = {};
    for (const key of Object.keys(fields)) {
      const validator = fields[key as keyof T] as Validator<unknown>;
      parsed[key] = validator(raw[key], `${path}.${key}`);
    }
    return parsed as T;
  };

/** A map whose keys are free-form and whose values are all numbers (the card's derivation). */
const numberMap: Validator<Record<string, number>> = (value, path) => {
  const raw = asRecord(value, path);
  const parsed: Record<string, number> = {};
  for (const key of Object.keys(raw)) parsed[key] = number(raw[key], `${path}.${key}`);
  return parsed;
};

/**
 * Artefact counts are optional per kind — a WorkType declares which kinds it may produce —
 * but an *unknown* kind is a fault: it would silently vanish from every comparability check.
 */
const artefactCounts: Validator<Partial<Record<ArtefactKind, number>>> = (value, path) => {
  const raw = asRecord(value, path);
  const parsed: Partial<Record<ArtefactKind, number>> = {};
  for (const key of Object.keys(raw)) {
    const kind = oneOf(ARTEFACT_KINDS)(key, `${path} key`);
    parsed[kind] = nonNegative(raw[key], `${path}.${key}`);
  }
  return parsed;
};

const tokenClassCounts = {
  uncached_input: nonNegative,
  cache_read: nonNegative,
  cache_write: nonNegative,
  output: nonNegative,
} as const;

export const tokenUsageSchema: Validator<TokenUsage> = object({
  model_id: string,
  ...tokenClassCounts,
});

export const sessionSchema: Validator<AgentSession> = object({
  id: string,
  // The tree link. `null` is a root; a string names one. Whether that string names a row that
  // *exists*, is itself a root, and agrees with this row's five inherited labels is a claim
  // about the whole file set and is checked in `load.ts`, where every row is in scope.
  parent_session_id: nullableString,
  started_at: string,
  ended_at: string,
  member_id: string,
  repository_id: string,
  work_type: oneOf(WORK_TYPE_KEYS),
  task_key: string,
  execution_mode: oneOf(EXECUTION_MODES),
  machine_spec: oneOf(MACHINE_SPECS),
  accepted: boolean,
  hidden: boolean,
  prompt_count: nonNegative,
  // Read, never computed (R-T11). This file validates it; nothing in the app derives it.
  cost: nonNegative,
  interactive_duration_s: nonNegative,
  idle_duration_s: nonNegative,
  afk_duration_s: nonNegative,
  machine_allocation_duration_s: nonNegative,
  artefacts: artefactCounts,
  token_usage: arrayOf(tokenUsageSchema),
});

export const organizationSchema: Validator<Organization> = object({
  id: string,
  slug: string,
  name: string,
  timezone: string,
  github_org: string,
  window_start: string,
  window_end: string,
  window_days: nonNegative,
});

export const repositorySchema: Validator<Repository> = object({
  id: string,
  github_id: nonNegative,
  name: string,
  full_name: string,
  default_branch: string,
  private: boolean,
});

export const githubUserSchema: Validator<GithubUser> = object({
  id: nonNegative,
  login: string,
  full_name: string,
  email: nullableString,
});

export const memberSchema: Validator<Member> = object({
  id: string,
  github_id: nonNegative,
  github_login: string,
  full_name: string,
  email: string,
  kind: oneOf(MEMBER_KINDS),
  role: string,
  team_ids: arrayOf(string),
  seat_active: boolean,
});

export const membersFileSchema = object<{ github_users: GithubUser[]; members: Member[] }>({
  github_users: arrayOf(githubUserSchema),
  members: arrayOf(memberSchema),
});

export const teamSchema: Validator<Team> = object({
  id: string,
  github_id: nonNegative,
  slug: string,
  name: string,
  member_ids: arrayOf(string),
});

export const taskSchema: Validator<Task> = object({
  key: string,
  number: nonNegative,
  title: string,
  repository_id: string,
  html_url: string,
  created_at: string,
});

export const workTypeSchema: Validator<WorkType> = object({
  key: oneOf(WORK_TYPE_KEYS),
  name: string,
  source: oneOf(WORK_TYPE_SOURCES),
  acceptance_criterion: string,
  artefact_kinds: arrayOf(oneOf(ARTEFACT_KINDS)),
});

export const modelSchema: Validator<Model> = object({
  id: string,
  vendor: string,
  family: string,
  tier: oneOf(MODEL_TIERS),
});

const tokenRateSchema: Validator<TokenRate> = object({
  model_id: string,
  ...tokenClassCounts,
});

export const rateCardsSchema: Validator<RateCards> = object({
  currency: string,
  token: object({
    label: string,
    unit: string,
    derivation: numberMap,
    rates: arrayOf(tokenRateSchema),
  }),
  compute: object({
    label: string,
    unit: string,
    rates: arrayOf(object({ machine_spec: oneOf(MACHINE_SPECS), usd_per_hour: nonNegative })),
  }),
  seat: object({ label: string, unit: string, usd: nonNegative }),
});
