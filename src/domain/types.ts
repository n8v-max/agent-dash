// Domain value types — technical-spec § 4 (R-T9…R-T12), mirroring `CONTEXT.md`.
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock. It is types
// plus the closed vocabularies those types are built from. The vocabularies are exported as
// `as const` arrays and the unions are derived from them, so a runtime validator
// (`src/data/schema.ts`) and the compile-time type cannot drift apart.
//
// Payload keys are snake_case because they are the shape of the data, not identifiers.

/** The five WorkType keys. Global and flat — no repo scoping, no roll-up levels. */
export const WORK_TYPE_KEYS = [
  "implementation",
  "refactor",
  "bugfix",
  "review",
  "deploy",
] as const;
export type WorkTypeKey = (typeof WORK_TYPE_KEYS)[number];

/** Where a WorkType's configuration came from. Provenance, never an aggregation level. */
export const WORK_TYPE_SOURCES = ["vendored", "user_tuned", "api_provided"] as const;
export type WorkTypeSource = (typeof WORK_TYPE_SOURCES)[number];

/** Permanent objects a session produces. Every one of them lives on GitHub. */
export const ARTEFACT_KINDS = [
  "pull_request",
  "commit",
  "file_changed",
  "line_changed",
  "pr_comment",
] as const;
export type ArtefactKind = (typeof ARTEFACT_KINDS)[number];

/** The class of machine a session held. Key of the compute rate card; not a group-by. */
export const MACHINE_SPECS = ["general", "compute", "memory", "storage"] as const;
export type MachineSpec = (typeof MACHINE_SPECS)[number];

/** Whether a human was at the keyboard. A property of the session, never of the Member. */
export const EXECUTION_MODES = ["interactive", "headless"] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

/** Cross-vendor capability class — the coarsest Model roll-up. */
export const MODEL_TIERS = ["frontier", "balanced", "fast"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

/** A roll-up level on the Member dimension: a service account holds no seat. */
export const MEMBER_KINDS = ["human", "service_account"] as const;
export type MemberKind = (typeof MEMBER_KINDS)[number];

/**
 * The four priced categories, canonical and **disjoint** — the only shape that sums safely.
 * Cache-write TTL is collapsed into one class; the precision lost is stated, not discovered.
 */
export const TOKEN_CLASSES = ["uncached_input", "cache_read", "cache_write", "output"] as const;
export type TokenClass = (typeof TOKEN_CLASSES)[number];

/** Tokens an AgentSession consumed against one Model. A session may span several Models. */
export type TokenUsage = { model_id: string } & Record<TokenClass, number>;

/**
 * A single attempt at a Task: the atomic unit of platform activity, and the grain everything
 * is stored at.
 */
export type AgentSession = {
  id: string;
  /**
   * The **root** AgentSession this one was spawned by, or `null` where this row *is* a root
   * (`CONTEXT.md` § Work — Root session, Child session).
   *
   * A child is a sub-agent fan-out on the *same* attempt, not a second attempt: it inherits its
   * root's Task, Member, Repository, WorkType and `execution_mode`, never carries `accepted`, and
   * rolls its cost, tokens and duration into its root (R-M19, ADR-0008). **One level only** — a
   * child's parent is always a root, which `src/data/load.ts` enforces over the committed data.
   */
  parent_session_id: string | null;
  /** ISO 8601 with offset — the Organization's timezone is what fixes day boundaries. */
  started_at: string;
  ended_at: string;
  member_id: string;
  repository_id: string;
  work_type: WorkTypeKey;
  /** `owner/repo#number` — externally keyed, never absent and never synthetic. */
  task_key: string;
  execution_mode: ExecutionMode;
  machine_spec: MachineSpec;
  /**
   * The session's ONLY outcome field (R-M3). There is no terminal status.
   *
   * **A child never carries it.** Acceptance is the root's, because the WorkType's criterion is
   * met once for the attempt, not once per agent that worked on it — so `accepted` is `false` on
   * every child row and the roll-up never reads it (ADR-0008).
   */
  accepted: boolean;
  /**
   * Terminated through platform or infrastructure failure. Stripped once at load (R-M2);
   * the field survives on the type because the fixture carries it, and every row the
   * application ever sees has it `false`.
   */
  hidden: boolean;
  /** User messages sent. The single interaction-volume measure; there is no interruption counter. */
  prompt_count: number;
  /** ATTRIBUTED upstream and stored (R-M4 / R-T11 / ADR-0005). This application prices nothing. */
  cost: number;
  interactive_duration_s: number;
  idle_duration_s: number;
  afk_duration_s: number;
  /** The sum of the three spans, exactly (R-T12). */
  machine_allocation_duration_s: number;
  /** Typed counts, restricted to the kinds the session's WorkType permits. */
  artefacts: Partial<Record<ArtefactKind, number>>;
  token_usage: TokenUsage[];
};

/** The top-level billing and access-control unit. Its timezone fixes every period boundary. */
export type Organization = {
  id: string;
  slug: string;
  name: string;
  /** IANA zone. "Last month" is the month its people worked, not a UTC artefact. */
  timezone: string;
  github_org: string;
  window_start: string;
  window_end: string;
  window_days: number;
};

/** A GitHub repo in the linked GitHubOrg. A flat dimension carrying no work-domain label. */
export type Repository = {
  id: string;
  github_id: number;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
};

/** The mocked GitHub user record a Member is joined from (R-D20). */
export type GithubUser = {
  id: number;
  login: string;
  full_name: string;
  email: string | null;
};

/**
 * A person or service account that runs Tasks.
 *
 * **A Member carries no Organization and no Role.** Both live on `Membership`, because a Member
 * is many-to-many with Organization and the Role is held *per Organization* — the same person can
 * be an org owner in one and a contractor in another. A `role` field here would have to pick one
 * of those to be true, and would silently be the wrong one everywhere else.
 */
export type Member = {
  id: string;
  github_id: number;
  github_login: string;
  full_name: string;
  email: string;
  kind: MemberKind;
  /** Many-to-many with Team, which is why Team is the one non-additive level. */
  team_ids: string[];
  seat_active: boolean;
};

/**
 * **One Member's standing in one Organization** — the join row, and the only place tenancy is
 * stated.
 *
 * A join file rather than an array on either side, for the reason `Team` already demonstrates:
 * the relation needs one authoritative direction, and this one has a field of its own. `role` is
 * a property of the *pairing*, not of the person and not of the Organization.
 *
 * **This is what `resolveViewer` checks.** Before it existed, the acting Member was looked up
 * across the whole dataset with no Organization predicate, so a token minted for one Organization
 * naming a Member of another resolved signed-in (ticket 58).
 */
export type Membership = {
  organization_id: string;
  member_id: string;
  /** Resolved to a `Role` by `roleFor`. Unrecognised values fall closed, never open. */
  role: string;
};

/** A group of Members, imported from a GitHubTeam. Overlapping, so figures do not sum. */
export type Team = {
  id: string;
  github_id: number;
  slug: string;
  name: string;
  member_ids: string[];
};

/**
 * The unit of work a Member asks an agent to do. **UI alias: "Job"** — see `TERM_DISPLAY`;
 * the alias never appears in a type name (R-T9). Externally keyed to a GitHub Issue, and the
 * platform does not own its lifecycle.
 */
export type Task = {
  key: string;
  number: number;
  title: string;
  repository_id: string;
  html_url: string;
  created_at: string;
};

/**
 * The class of work a session is launched to do — declared at launch, not classified after.
 * **UI alias: "template"** — see `TERM_DISPLAY`.
 */
export type WorkType = {
  key: WorkTypeKey;
  name: string;
  source: WorkTypeSource;
  /** Names the artefact that actually matters, never the presence of a branch. */
  acceptance_criterion: string;
  /** Permitted artefact kinds. Comparability is the intersection of these sets (R-M8). */
  artefact_kinds: ArtefactKind[];
};

/** An addressable model version, carrying its two roll-up labels. */
export type Model = {
  id: string;
  vendor: string;
  /** The vendor's model line, carrying the vendor. */
  family: string;
  tier: ModelTier;
};

/** One row of the token rate card: (model × token class), in USD per million tokens. */
export type TokenRate = { model_id: string } & Record<TokenClass, number>;

/** One row of the compute rate card. Generator input; rendered on no surface (R-N11). */
export type ComputeRate = { machine_spec: MachineSpec; usd_per_hour: number };

/**
 * The two cards plus the seat fee. Inputs to the upstream system that attributed the stored
 * `cost`; only the token card is ever surfaced, as a reference table carrying its own
 * "illustrative" label.
 */
export type RateCards = {
  currency: string;
  token: {
    label: string;
    unit: string;
    derivation: Record<string, number>;
    rates: TokenRate[];
  };
  compute: { label: string; unit: string; rates: ComputeRate[] };
  seat: { label: string; unit: string; usd: number };
};

/**
 * R-T9 — the display map. There are exactly two UI aliases and they live *here*, as data,
 * never inside a type name: `Task` is "Job" in copy, `WorkType` is "template".
 *
 * `Repository` is present and deliberately unchanged: ADR-0004 makes repository *names*
 * load-bearing precisely because a reader reads them as repositories, so renaming it would
 * add a translation layer for no gain. Listing it here records that the absence of an alias
 * is a decision rather than an omission.
 */
export const TERM_DISPLAY = {
  task: "Job",
  work_type: "template",
  repository: "Repository",
  // Not "Session": the glossary declares exactly two aliases, and shortening a third term
  // here would be inventing one.
  agent_session: "AgentSession",
  member: "Member",
  team: "Team",
  model: "Model",
} as const satisfies Record<string, string>;

/** A domain term that has a display label. */
export type DomainTerm = keyof typeof TERM_DISPLAY;
