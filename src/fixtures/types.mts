// Fixture payload types. They mirror `CONTEXT.md` and technical-spec § 4 (R-T9…R-T12).
// Payload keys are snake_case by domain convention; the shapes are data, not identifiers.

export type WorkTypeKey = "implementation" | "refactor" | "bugfix" | "review" | "deploy";

export type ArtefactKind =
  | "pull_request"
  | "commit"
  | "file_changed"
  | "line_changed"
  | "pr_comment";

export type MachineSpec = "general" | "compute" | "memory" | "storage";

export type ExecutionMode = "interactive" | "headless";

export type ModelTier = "frontier" | "balanced" | "fast";

export type MemberKind = "human" | "service_account";

export type TokenClass = "uncached_input" | "cache_read" | "cache_write" | "output";

export type TokenUsage = {
  model_id: string;
  uncached_input: number;
  cache_read: number;
  cache_write: number;
  output: number;
};

export type AgentSession = {
  id: string;
  /** The root session this one was spawned by; `null` on a root. One level only (ADR-0008). */
  parent_session_id: string | null;
  started_at: string;
  ended_at: string;
  member_id: string;
  repository_id: string;
  work_type: WorkTypeKey;
  task_key: string;
  execution_mode: ExecutionMode;
  machine_spec: MachineSpec;
  accepted: boolean;
  hidden: boolean;
  prompt_count: number;
  cost: number;
  interactive_duration_s: number;
  idle_duration_s: number;
  afk_duration_s: number;
  machine_allocation_duration_s: number;
  artefacts: Partial<Record<ArtefactKind, number>>;
  token_usage: TokenUsage[];
};

export type Organization = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  github_org: string;
  window_start: string;
  window_end: string;
  window_days: number;
};

export type Repository = {
  id: string;
  github_id: number;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
};

export type GithubUser = {
  id: number;
  login: string;
  full_name: string;
  email: string | null;
};

export type Member = {
  id: string;
  github_id: number;
  github_login: string;
  full_name: string;
  email: string;
  kind: MemberKind;
  role: string;
  team_ids: string[];
  seat_active: boolean;
};

export type MembersFile = {
  github_users: GithubUser[];
  members: Member[];
};

export type Team = {
  id: string;
  github_id: number;
  slug: string;
  name: string;
  member_ids: string[];
};

export type Task = {
  key: string;
  number: number;
  title: string;
  repository_id: string;
  html_url: string;
  created_at: string;
};

export type WorkType = {
  key: WorkTypeKey;
  name: string;
  source: "vendored" | "user_tuned" | "api_provided";
  acceptance_criterion: string;
  artefact_kinds: ArtefactKind[];
};

export type Model = {
  id: string;
  vendor: string;
  family: string;
  tier: ModelTier;
};

export type TokenRate = {
  model_id: string;
  uncached_input: number;
  cache_read: number;
  cache_write: number;
  output: number;
};

export type ComputeRate = { machine_spec: MachineSpec; usd_per_hour: number };

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
