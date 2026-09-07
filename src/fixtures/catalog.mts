// The authored vocabularies: the Organization, the five Repositories, the five WorkTypes,
// ADR-0007's seven-model roster, and both rate cards. Serialised as-is — these imitate a
// mocked internal API (R-T19), except the repositories, which imitate the GitHub API.

import { WINDOW_DAYS, WINDOW_END_DAY, WINDOW_START_DAY } from "./targets.mts";
import type {
  ComputeRate,
  Model,
  Organization,
  RateCards,
  Repository,
  TokenRate,
  WorkType,
} from "./types.mts";

export const GITHUB_ORG = "equilibrio";

// R-D1 — Equilibrio, slug `demo`, timezone Europe/Madrid.
export const organization: Organization = {
  id: "org_equilibrio",
  slug: "demo",
  name: "Equilibrio",
  timezone: "Europe/Madrid",
  github_org: GITHUB_ORG,
  window_start: WINDOW_START_DAY,
  window_end: WINDOW_END_DAY,
  window_days: WINDOW_DAYS,
};

// ADR-0004 — a Repository carries no work-domain label and no roll-up level. The technology
// signal lives in the name and nowhere else.
const REPOSITORY_ROWS: readonly (readonly [string, number])[] = [
  ["web-console", 41207731],
  ["mobile-app", 41207804],
  ["api-gateway", 41207866],
  ["ml-scoring", 41207912],
  ["terraform-infra", 41207975],
];

export const repositories: Repository[] = REPOSITORY_ROWS.map(([name, githubId]) => ({
  id: `repo_${name.replace(/-/gu, "_")}`,
  github_id: githubId,
  name,
  full_name: `${GITHUB_ORG}/${name}`,
  default_branch: "main",
  private: true,
}));

export const repositoryByName = (name: string): Repository => {
  const found = repositories.find((repository) => repository.name === name);
  if (found === undefined) throw new Error(`unknown repository: ${name}`);
  return found;
};

// ticket 10 § Artefacts and acceptance. `deploy` cannot accept on "PR merged" — it produces
// no pull request — so the default-branch commit is its criterion.
export const workTypes: WorkType[] = [
  {
    key: "implementation",
    name: "Implementation",
    source: "vendored",
    acceptance_criterion: "A pull request was published",
    artefact_kinds: ["pull_request", "commit", "file_changed", "line_changed"],
  },
  {
    key: "bugfix",
    name: "Bug fix",
    source: "vendored",
    acceptance_criterion: "A pull request was published",
    artefact_kinds: ["pull_request", "commit", "file_changed", "line_changed"],
  },
  {
    key: "refactor",
    name: "Refactor",
    source: "user_tuned",
    acceptance_criterion: "A pull request was published",
    artefact_kinds: ["pull_request", "commit", "file_changed", "line_changed"],
  },
  {
    key: "review",
    name: "Review",
    source: "vendored",
    acceptance_criterion: "A review was submitted with an outcome",
    artefact_kinds: ["pr_comment"],
  },
  {
    key: "deploy",
    name: "Deploy",
    source: "api_provided",
    acceptance_criterion: "A commit landed on the default branch",
    artefact_kinds: ["commit", "pr_comment"],
  },
];

// ADR-0007 — seven models, three vendors, tiers 2/2/3, every tier cross-vendor, `family`
// carrying the vendor. Input prices are real as verified on 2026-09-07; the roster replaces
// ticket 16's, three of whose seven strings did not exist.
const ROSTER: readonly (readonly [string, string, string, Model["tier"], number])[] = [
  ["gpt-6-astra", "OpenAI", "OpenAI GPT-6 Astra", "frontier", 10.0],
  ["claude-opus-5", "Anthropic", "Claude Opus", "frontier", 5.0],
  ["claude-sonnet-5", "Anthropic", "Claude Sonnet", "balanced", 2.0],
  ["gemini-3.1-pro-preview", "Google", "Gemini Pro", "balanced", 2.0],
  ["claude-haiku-4-5", "Anthropic", "Claude Haiku", "fast", 1.0],
  ["gemini-3.5-flash-lite", "Google", "Gemini Flash-Lite", "fast", 0.3],
  ["gpt-5-nano", "OpenAI", "OpenAI GPT-5 nano", "fast", 0.05],
];

export const models: Model[] = ROSTER.map(([id, vendor, family, tier]) => ({
  id,
  vendor,
  family,
  tier,
}));

export const modelById = (id: string): Model => {
  const found = models.find((model) => model.id === id);
  if (found === undefined) throw new Error(`unknown model: ${id}`);
  return found;
};

// Input is the only authored number per model. The other three classes derive by uniform
// ratios — Anthropic's, applied across all three vendors, which is exactly why the card is
// labelled illustrative (CONTEXT.md § Models & Money).
export const TOKEN_RATIOS = { uncached_input: 1, cache_read: 0.1, cache_write: 1.25, output: 5 };

const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;

export const tokenRates: TokenRate[] = ROSTER.map(([id, , , , input]) => ({
  model_id: id,
  uncached_input: round4(input * TOKEN_RATIOS.uncached_input),
  cache_read: round4(input * TOKEN_RATIOS.cache_read),
  cache_write: round4(input * TOKEN_RATIOS.cache_write),
  output: round4(input * TOKEN_RATIOS.output),
}));

// ticket 16 § Compute rate card — survives ADR-0007, which replaced only the token card.
// `compute` at 4× `general` is what makes a CPU-heavy, token-light session read as a cost
// anomaly rather than a rounding difference. Never displayed (R-N11).
export const computeRates: ComputeRate[] = [
  { machine_spec: "general", usd_per_hour: 0.3 },
  { machine_spec: "compute", usd_per_hour: 1.2 },
  { machine_spec: "memory", usd_per_hour: 0.9 },
  { machine_spec: "storage", usd_per_hour: 0.45 },
];

// ticket 16 — $39 per `human` Member per month, flat, not varied by Role. Sits outside
// session Cost and appears only in Total spend at monthly grain and coarser (R-M5).
export const SEAT_FEE_MONTHLY_USD = 39;

export const rateCards: RateCards = {
  currency: "USD",
  token: {
    label: "Illustrative rates — real input prices, derived cache and output classes",
    unit: "usd_per_million_tokens",
    derivation: TOKEN_RATIOS,
    rates: tokenRates,
  },
  compute: {
    label: "Compute rate card — generator input, never displayed",
    unit: "usd_per_hour",
    rates: computeRates,
  },
  seat: {
    label: "Seat fee — human Members only, monthly grain and coarser",
    unit: "usd_per_human_member_per_month",
    usd: SEAT_FEE_MONTHLY_USD,
  },
};
