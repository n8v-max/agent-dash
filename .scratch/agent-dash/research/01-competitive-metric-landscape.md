Type: research brief
Ticket: `.scratch/agent-dash/issues/01-competitive-metric-landscape.md`
Researched: 2026-09-05

# Competitive metric landscape and the productivity-metrics critique

**Findings only.** This brief does not propose a metric set for this product — that is ticket 05
and it is a human decision. Where the evidence bears on positions this project has already taken
(notably `docs/adr/0001-peer-visibility-excludes-cost.md`), the brief reports what the evidence
says in *both* directions and stops there.

**Vocabulary.** Where a finding maps onto this project's glossary (`CONTEXT.md`), the glossary
term is used: Task, AgentSession, Rework, Model, TokenUsage, Cost, subject scope, datapoint class,
*aggregated vs identified*. Vendor metric names are quoted in the vendor's own words and not
translated.

**Boundary with ticket 02.** Ticket 02 covers how LLM *platforms* (Anthropic, OpenAI, Bedrock,
OpenRouter…) bill and report usage, plus rate-card structure. This brief covers what *dashboards*
put in front of engineering organisations. Where they touch — Copilot/Cursor/Claude Code admin
reporting — this brief records the dashboard surface, not the billing mechanics.

**Freshness warning.** This category moves fast and much of the most relevant evidence is from
the last six months. Every time-sensitive claim below carries a date. Anything without a date
should be treated as unverified as-of.

---

## 0. Executive summary of findings

1. The established engineering-analytics vendors converge on a stable metric vocabulary —
   DORA four keys, cycle-time decomposition, an "investment/allocation" family, and a quality
   family — and they diverge sharply on **grain**: whether a named individual's numbers are a
   product surface. Swarmia and DX say loudly that they should not be; LinearB and Waydev ship
   named-individual views as advertised features. DX's own product contradicts DX's own
   publishing on this point (§1.4).
2. Cost has become a first-class metric family in this category only recently, and it arrives in
   two different shapes: **effort-cost** (R&D capitalisation, salary-derived allocation — the old
   shape) and **token/model spend** (the new shape). Almost every vendor gates the effort-cost
   surface behind a named privileged role (§1.5).
3. AI-coding-platform dashboards (Copilot, Cursor, Claude Code) are overwhelmingly **adoption and
   volume** instruments. Efficacy — did the agent's attempt succeed, and did it have to be redone —
   is barely represented (§2).
4. The 2026 "tokenmaxxing" episode is the single most direct piece of evidence in the whole
   landscape about what happens when per-named-individual token/cost numbers are made visible and
   comparable. Meta, Amazon and Microsoft all ran into it inside six months, and all three
   retreated (§6).
5. The counter-pressure is equally real and equally documented: Gartner's June 2026 position is
   that consumption pricing has made per-developer spend a genuine budget problem and that
   "token discipline will not emerge through developer choice alone" (§7). The evidence
   therefore does **not** resolve cleanly in favour of either hiding or showing per-person cost;
   it resolves in favour of separating *cost visibility* from *cost comparison*.
6. Evidence quality is uneven. The critique literature has real primary sources (SPACE, DORA,
   METR, GitClear). The "how to measure AI agent efficacy" literature is dominated by
   content-marketing and is close to worthless as a source (§8.2).

---

## 1. What exists — engineering-analytics platforms

### 1.1 The shared metric vocabulary

Across LinearB, Waydev, Swarmia, DX, Jellyfish, Sleuth and Faros the same four families recur.
The names below are the vendors' own.

| Family | Representative metric names, as the vendors name them |
|---|---|
| Velocity / throughput | Cycle Time, and its decomposition into **Coding Time → Pickup Time → Review Time → Deploy Time**; Deployment Frequency; Lead Time for Changes ([LinearB features](https://linearb.io/platform/engineering-metrics/features)). Waydev adds Velocity Report, Sprint Progress/Burndown, Sprints Commitment ([Waydev features](https://waydev.co/features/)). DX names **Diffs per Engineer** (or PRs per Engineer) ([DX Core 4](https://newsletter.getdx.com/p/introducing-the-dx-core-4)). |
| Quality / stability | Change Failure Rate, MTTR, **Rework Rate**, PRs Merged Without Review, Review Depth, PR Size, **Refactor Rate** ([LinearB](https://linearb.io/platform/engineering-metrics/features)); Merge Quality, Pull Request Insights ([Waydev](https://waydev.co/features/)). |
| Investment / allocation | LinearB's **Investment Profile** — work bucketed into New Value, Enhancements, Developer Experience, **KTLO** ("keep the lights on") and an "Inefficiency Pool", explicitly analogised to "a stock portfolio" ([LinearB docs](https://linearb.helpdocs.io/article/oaf32occ9w-investment-profile)). Swarmia's **Investment Balance** ([Swarmia](https://www.swarmia.com/product/developer-productivity/)). DX's **% of Time Spent on New Capabilities** ([DX Core 4](https://newsletter.getdx.com/p/introducing-the-dx-core-4)) and its Allocation Reporting ([DX](https://getdx.com/blog/gain-top-down-visibility-dx-allocation-reporting/)). |
| Developer experience / sentiment | DX's **Developer Experience Index (DXI)** ([DX Core 4](https://newsletter.getdx.com/p/introducing-the-dx-core-4)); LinearB's DevEx / Coaching wait-time metrics ([LinearB docs](https://linearb.helpdocs.io/article/y1fn773xjx-development-experience)); Waydev's DX metrics ([Waydev](https://waydev.co/dx-metrics/)). |

**Relevance to this project's vocabulary.** LinearB's **Rework Rate** and Waydev's **Merge
Quality** are the closest existing analogues to this project's `Rework` (`CONTEXT.md` § Work),
but they are *code* rework — lines rewritten shortly after being written — not *attempt* rework.
No engineering-analytics vendor found in this pass measures "how many attempts did one unit of
work take", which is the distinction this project's Task → AgentSession one-to-many relationship
is built to expose. That gap is a finding, not a recommendation.

### 1.2 DORA is the common denominator, and it has been re-cut

DORA is now published at [dora.dev](https://dora.dev) and the "four keys" have become **five**:
Change Lead Time, Deployment Frequency, Failed Deployment Recovery Time, Change Fail Rate, and
a newly split-out **Deployment Rework Rate** ([CD Foundation, Oct 2025](https://cd.foundation/blog/2025/10/16/dora-5-metrics/)).
Vendor marketing that still says "the four DORA metrics" is, as of late 2025, behind the research
programme it cites. Worth noting when reading any vendor page that has not been updated.

### 1.3 Grain — the axis the vendors actually disagree on

This is where the category splits, and the split is public and explicit.

**The "never at the individual level" pole.**

- **DX** states it plainly, about its own Speed metric: *"It is critical that this metric is
  never used at the individual level or tied to performance evaluations"*, and that it *"must be
  counterbalanced with other oppositional metrics like the Developer Experience Index (DXI)"*
  ([Noda, DX Core 4, 10 Dec 2024](https://newsletter.getdx.com/p/introducing-the-dx-core-4)).
- **Swarmia** publishes a post titled *"So, you'd like to stack rank your developers?"* arguing
  *"stack ranking doesn't deliver what it promises. Instead of objectivity, you get gaming.
  Instead of performance improvement, you get knowledge hoarding. And instead of keeping your
  best developers, you watch them leave"*, and that *"there is no single metric, and there is no
  simple solution"* ([Swarmia](https://www.swarmia.com/blog/dont-stack-rank-your-developers/)).
- **Sleuth** models DORA at team grain only and frames benchmarking as team-to-team, never
  developer-to-developer ([Sleuth docs](https://help.sleuth.io/modeling-your-deployments/teams),
  [Sleuth blog](https://www.sleuth.io/post/dora-metrics-for-teams/)).
- **Faros AI** slices every metric by team (from the org chart) and by application
  ([Faros docs](https://docs.faros.ai/docs/devops-management-module)).

**The named-individual pole.**

- **LinearB** ships a per-developer **Coaching** view (Pickup Wait Time, Merge Wait Time, Deploy
  Wait Time) at named-individual grain ([LinearB docs](https://linearb.helpdocs.io/article/y1fn773xjx-development-experience)),
  and its Cost Capitalization reporting is viewable "as monthly aggregates or filtered by
  individual developer" ([LinearB](https://linearb.io/platform/cost-capitalization)).
- **Waydev** is the most individual-centric of the set: Developer Summary (a 1:1-prep view keyed
  to a person), Work Log, Time Card, Daily Update, **Compare**, and a metric explicitly named
  **"Ghost Engineering"** for flagging inactive contributors
  ([Waydev features](https://waydev.co/features/), [role management](https://waydev.co/features/role-management/)).
  No public anti-ranking position statement was found on Waydev's own site in this pass — that is
  an absence of evidence, not evidence of absence.

**LinearB's own three-level audience model** is a useful artefact regardless: Org level → "CTOs
and VPs of Software Engineering"; Team level → "Dev Leads and Dev Managers"; Repo level →
"Individual contributors and specialized teams"
([LinearB](https://linearb.io/blog/engineering-metrics-3-levels-of-visibility)). Note that
LinearB's third level is scoped by *repository*, not by person — an aggregation dimension used as
a privacy-preserving proxy for an audience.

### 1.4 Where the loudest vendors contradict themselves

Two findings here are worth stating sharply, because a naive reading of the vendors' blogs would
miss them.

- **DX says "never at the individual level" and ships individual metrics on by default.** DX's
  product has a **Personal Dashboard** at individual-contributor grain (PR/issue management, time
  allocation, code review activity, PR throughput) alongside Group and Organization dashboards.
  The docs state: *"By default, Dashboard shows individual metrics alongside team metrics. This
  can be disabled without affecting other reporting features across DX"* — an **opt-out** switch
  under Settings → General → "Individual metrics visibility"
  ([DX docs](https://docs.getdx.com/dashboard/overview/)).
- **Swarmia says no leaderboards, and computes individual effort percentages internally.** Its
  software-capitalization feature derives, per person, "how much of their total accumulated effort
  is directed towards capitalizable issues", even though the finance-facing export is aggregate
  ([Swarmia help](https://help.swarmia.com/features/capitalize-software-development-costs)).

The pattern: the *stated* position is about **use** ("do not evaluate people with this"), while
the *product* position is about **default visibility**. Those are different levers, and the
category has not settled which one carries the commitment. In this project's terms
(`CONTEXT.md` § Access) both vendors grant identified data and rely on policy to restrain its
use; neither withholds the (subject scope × datapoint class) cell itself.

### 1.5 Cost, and how it is gated

Cost in the established analytics category has historically meant **effort cost**, not token cost:
salary- and roster-derived allocation, feeding R&D capitalisation for finance.

- **Jellyfish** brands this **"DevFinOps"** — Git/Jira/CI data joined with "roster, payroll, and
  cost data" to compute "engineering effort, cost allocations, and capitalizable work" via a
  "patented Allocations data model" ([Jellyfish](https://jellyfish.co/platform/devfinops/),
  [PR Newswire](https://www.prnewswire.com/news-releases/jellyfish-makes-rd-cost-capitalization-reporting-seamless-and-accurate-with-new-devfinops-solution-301651749.html)).
- **LinearB** ships Cost Capitalization / R&D Cost Capitalization
  ([LinearB](https://linearb.io/platform/cost-capitalization)).
- **Swarmia** ships automatic software capitalization producing CapEx/OpEx reports for finance
  ([Swarmia help](https://help.swarmia.com/features/capitalize-software-development-costs)).
- **Waydev** ships Project Costs, Resource Allocation and Cost Capitalization
  ([Waydev](https://waydev.co/features/)).

**Every one of these is role-gated, and the gate is explicit.** This is the strongest
cross-vendor pattern found in the whole competitive pass:

- Swarmia's **Viewer** role is denied capitalization outright: *"Viewer... [doesn't] have access
  to software capitalization or the ability to create developer experience surveys or
  initiatives"* ([Swarmia help](https://help.swarmia.com/settings/organization/managing-users-and-roles)).
- DX defines a **Privileged User** role that "can access reports containing potentially sensitive
  information — namely, Attrition Risk, CapEx, and new hire ramp-up metrics", and a separate
  **Finance Manager** role that can "view and upload salary data for the CapEx report"
  ([DX docs](https://docs.getdx.com/roles/)).
- Waydev's default **Member** role is limited to a named subset of views
  ([Waydev](https://waydev.co/features/role-management/)).

**Bearing on `docs/adr/0001`.** The ADR asserts that "most competitor dashboards in the
engineering-analytics space have" a cost-per-member leaderboard. The evidence found here is
*partially* supportive and should be stated precisely: named-individual **cost** views do exist
(LinearB's capitalization filtered by individual developer; Swarmia's internal per-person effort
share), but in every case examined they are **role-gated behind a finance/admin grant, not
available to a peer**. No vendor in this pass was found shipping a peer-visible cost-per-member
leaderboard as a default. So the ADR's *direction* matches the category; its characterisation of
the category as leaderboard-happy is not well supported by the primary evidence, and the more
accurate reading is that the category already separates "aggregated" from "identified" for cost —
which is the distinction `CONTEXT.md` § Access encodes structurally rather than by role policy.

### 1.6 Evidence quality in this section

Weakest: **Pluralsight Flow** — its "Coding Days" metric ("the total number of days where a
developer commits code divided by the number of total weeks... minus any weeks where no code was
committed", [Pluralsight help](https://help.pluralsight.com/help/what-is-a-coding-day)) is
individual-grain by construction, and competitor pages claim Flow ships individual leaderboards
([Swarmia comparison](https://www.swarmia.com/alternative/pluralsight-flow-gitprime/)) — but
those are *competitor* claims and Flow's own pages returned 403/429 on fetch. Do not rely on the
leaderboard claim. **Jellyfish** and **Faros** individual-vs-team policy statements were not
directly verified. **Haystack** and **Code Climate Velocity** were not researched.

---

## 2. What exists — AI coding assistant and agent platform dashboards

This is the closer analogue to what this project is. Findings are as of **2026-09-05**, and this
surface churns hard — see §2.6.

### 2.1 GitHub Copilot

Copilot's admin reporting has been rewritten **twice**, and the field vocabulary changed
completely between generations. Anyone reasoning from an older article is reasoning from a dead
schema.

| Generation | Date | Shape |
|---|---|---|
| Beta `/usage` endpoints | deprecated **21 Feb 2025**; 28-day retention, "no new data will be inserted" ([changelog](https://github.blog/changelog/2025-02-21-deprecation-of-beta-github-copilot-usage-api-endpoint/)) | superseded |
| Metrics API v1 GA | **30 Oct 2024** ([changelog](https://github.blog/changelog/2024-10-30-github-copilot-metrics-api-ga-release-now-available/)) | `total_active_users`, `total_engaged_users`, `copilot_ide_code_completions`, `copilot_ide_chat`, `copilot_dotcom_chat`, `copilot_dotcom_pull_requests`, nested by language/editor/model |
| Copilot metrics GA rewrite | **27 Feb 2026** ([changelog](https://github.blog/changelog/2026-02-27-copilot-metrics-is-now-generally-available/), [REST ref](https://docs.github.com/en/rest/copilot/copilot-usage-metrics)) | `GET /orgs/{org}/copilot/metrics/reports/{organization\|repos\|users\|user-teams}-1-day` (and `-28-day/latest`), returning **`download_links` only** — the data is fetched as CSV/parquet, not returned inline |

Current-generation field names, from GitHub's own example schema
([docs](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/example-schema)):

- **User grain**: `user_id`, `user_login`, `day`, `ai_adoption_phase`, `ai_credits_used`,
  `code_acceptance_activity_count`, `code_generation_activity_count`, `loc_added_sum`,
  `loc_deleted_sum`, `totals_by_cli`, `totals_by_copilot_app`, `totals_by_3rd_party_agent`,
  `totals_by_feature`, `totals_by_ide`, `totals_by_language_feature`.
- **Org/enterprise grain**: `daily_active_users`, `weekly_active_users`, `monthly_active_users`,
  `pull_requests`, `totals_by_ai_adoption_phase`.

**Adoption phases** (added **29 May 2026**, [changelog](https://github.blog/changelog/2026-05-29-copilot-usage-metrics-api-adds-cohorts-for-ai-adoption/)):
users are bucketed as *"Passive users"*, *"Phase 1: Code first"*, *"Phase 2: Agent first"*,
*"Phase 3: Multi-agent"*, advancing on "at least two active days out of the trailing 28-day
window" ([concept doc](https://docs.github.com/en/copilot/concepts/copilot-usage-metrics/copilot-metrics)).
This is a **maturity dimension**, not a volume metric, and it is the only one of its kind found
in the whole survey.

**The k-anonymity floor — the single most transferable finding in this section.** GitHub's
org- and team-level reports *"will only return results for a given day if the
organization/team contained five or more members with active Copilot licenses on that day, as
evaluated at the end of that day"*
([REST reference](https://docs.github.com/en/rest/copilot/copilot-metrics?apiVersion=2026-03-10)).
A hard numeric privacy floor of **5**, enforced by the API rather than by policy. No other vendor
in this survey documents a comparable numeric floor — though absence of documentation is not
proof there is no floor.

**Cost is a separate system.** Premium Request Analytics (GA **30 Sept 2025**) lives at
`github.com/settings/billing`, is filterable by group-by/timeframe, downloadable, and has its own
API endpoint ([changelog](https://github.blog/changelog/2025-09-30-premium-requests-analytics-page-is-now-generally-available/)).
Engagement metrics and spend metrics are two different products with two different permission
sets. Access to metrics requires org ownership or the fine-grained "View Organization Copilot
Metrics" permission ([REST ref](https://docs.github.com/en/rest/copilot/copilot-usage-metrics)).

**Efficacy: absent.** Nothing in Copilot's reporting expresses whether an attempt succeeded, or
whether work had to be redone.

### 2.2 Cursor

The most permissive grain found. Two documented APIs:

- **Team Analytics API** ([docs](https://cursor.com/docs/account/teams/analytics-api)) — daily
  per-team endpoints: `agent-edits` (`total_suggested_diffs`, `total_accepted_diffs`,
  `total_rejected_diffs`, `total_green_lines_accepted`, `total_red_lines_accepted`,
  `total_lines_suggested`, `total_lines_accepted`), `tabs`, `dau` (`dau`, `cli_dau`,
  `cloud_agent_dau`, `bugbot_dau`), `models` (per-model `messages`/`users`), `bugbot` /
  `bugbot-reviews` (`issues.total`, `issues.by_severity`, `issues_resolved`, `cost_cents`), **and
  an explicit `leaderboard` endpoint** returning `total_accepts`, `total_lines_accepted`,
  `line_acceptance_ratio`, `rank`. A parallel `/analytics/by-user/{metric}` family returns the
  same shapes keyed by **user email**.
- **Admin API** ([docs](https://cursor.com/docs/account/teams/admin-api)) —
  `POST /teams/daily-usage-data` (per-user, hourly-aggregated), `POST /teams/spend`
  (billing-cycle spend, per user), `POST /teams/filtered-usage-events` (per-event: `timestamp`,
  `userEmail`, `model`, `isTokenBasedCall`, `tokenUsage` input/output/cache, `chargedCents`,
  `cursorTokenFee`), plus `user-spend-limit(s)`.

So Cursor ships, as documented product surface, both a **named-per-user ranked leaderboard** and
**per-named-user dollar spend**, with no documented minimum-cohort suppression. It is the clearest
counter-example to `docs/adr/0001` in the survey — and note that the leaderboard ranks on
*acceptance*, not on spend. The spend data is admin-API-scoped.

Cursor's own dashboard documentation is notably thinner than its API documentation: the dashboard
page describes sections generically ("AI requests, model usage, and resource consumption", "across
team members and projects") without naming metrics, and documents no visibility rule for whether
ordinary members can see each other's numbers — only that the Audit Log is Enterprise and
admin-only ([Cursor dashboard docs](https://cursor.com/docs/account/teams/dashboard), fetched
2026-09-05).

### 2.3 Anthropic Claude Code

Closest existing schema to this project's `TokenUsage`. The **Claude Code Analytics API**
(`/v1/organizations/usage_report/claude_code`,
[docs](https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api)) returns daily
**per-user** records where `actor` is a `user_actor{email_address}` or `api_actor{api_key_name}`,
dimensioned by `date`, `organization_id`, `customer_type` (`api` / `subscription`) and
`terminal_type` (`vscode`, `iTerm.app`, `tmux`…). Metrics:

- `num_sessions`, `lines_of_code.added` / `.removed`, `commits_by_claude_code`,
  `pull_requests_by_claude_code`
- tool accept/reject counts for `edit_tool`, `multi_edit_tool`, `write_tool`,
  `notebook_edit_tool` — acceptance rate = accepted / (accepted + rejected)
- a **per-model breakdown array**: `model`, `tokens.input` / `.output` / `.cache_read` /
  `.cache_creation`, and `estimated_cost.amount` in cents

That per-model, four-way token split with derived cost is essentially the shape `CONTEXT.md`
§ Models & Money specifies, arrived at independently. No minimum-cohort suppression is documented;
individual email addresses appear directly in org data.

The general **Usage & Cost Admin API**
([docs](https://platform.claude.com/docs/en/manage-claude/usage-cost-api)) is a *different* grain:
`/usage_report/messages` groups by `model`, `workspace_id`, `api_key_id`, `service_tier`,
`context_window`, `inference_geo`, `speed`; `/cost_report` is daily-only, grouped by
`workspace_id` / `description`. It is **workspace/key-grained, not person-grained**, and the docs
route anyone wanting per-user Claude Code cost to the separate analytics API. A third surface
exists for Claude Enterprise (claude.ai) using an "Analytics API key" rather than an Admin API key.

**Efficacy: absent.** `num_sessions` counts attempts; nothing records whether an attempt
succeeded, and there is no retry or rework field.

### 2.4 The rest of the field

| Platform | Metric families surfaced | Grain | Cost / tokens | Source |
|---|---|---|---|---|
| **Devin** (Cognition) | Per-session Session Insights: `ACU usage` (Agent Compute Unit), user-message count, composite `Session Size` (XS–XL), task `Category` (Feature Development, Bug Fixing, Code Review…), Issue Timeline with `impact` high/medium/low, Knowledge Usage tagged `useful` vs `misleading` | session | ACU as compute proxy; no dollar field found | [docs.devin.ai](https://docs.devin.ai/product-guides/session-insights) |
| **Windsurf** (Codeium) | adoption (DAU, seat utilization, feature adoption); quality (completion acceptance rate — "the key metric for measuring suggestion quality and workflow fit"; "Percent of Code Written (PCW) by AI"); consumption (credits per user, LoC, tool calls); efficiency (tasks per session, time-saved estimate) | team-admin aggregate, per-user beneath | credits, not currency | [docs.windsurf.com](https://docs.windsurf.com/windsurf/accounts/analytics) — **note: this URL now 307-redirects into `docs.devin.ai`, i.e. Windsurf docs have moved under Cognition's domain post-acquisition (observed 2026-09-05)** |
| **Amp** (Sourcegraph) | Threads with visibility levels (Public / Unlisted / Workspace-shared / Private); team Activity view; a **Leaderboard** "tracking activity and contributions"; CLI `amp usage` balance | undocumented | balance only | [ampcode.com/docs](https://ampcode.com/docs), [leaderboard](https://ampcode.com/leaderboard) — no published metrics schema or admin API found; genuine documentation gap |
| **Gemini Code Assist** | Cloud Monitoring metric types: `code_assist/hourly_active_user_count`, `daily_active_users`, `weekly_active_user_count`, `twenty_eight_day_active_users`, `code_suggestions_count`, `code_suggestions_accepted_count`, `code_lines_accepted_count`, `chat_conversation_count`, `chat_responses_count`, `chat_responses_accepted_count`, `used_tokens_count`, `api_calls_count` | **per-GCP-project aggregate**, not per user | token counts but **no dollar cost** — the one exception in the survey | [cloud.google.com](https://docs.cloud.google.com/gemini/docs/codeassist/monitor-gemini-code-assist) |
| **Google Workspace Gemini reports** | org-level *and* user-level usage | both | — | [Workspace Updates, Feb 2026](https://workspaceupdates.googleblog.com/2026/02/view-gemini-feature-usage-and-threshold.html) |
| **JetBrains AI** | adoption (unique users with AI enabled, unique users with ≥1 request, total AI Credits consumed, users hitting monthly credit limits); activity & impact (overall code-suggestion acceptance rate, AI-generated-code contribution %); providers & models (token consumption by provider/model) | org, with named roles | credits + per-provider/model tokens | [jetbrains.com](https://www.jetbrains.com/help/jetbrains-console/analytics.html), [AI Analytics API](https://www.jetbrains.com/help/ide-services/ai-analytics-api.html) |
| **Tabnine** | registered users, active users (defined as "any user who participated in at least one chat OR accepted one code completion that day"), total usage, "productivity factor", "chat consumption rate", "automation factor" | org or team; **"the rest of the Tabnine team has no access to the usage data"** beyond the admin | not surfaced | [docs.tabnine.com](https://docs.tabnine.com/main/administering-tabnine/managing-your-team/reporting) |
| **Augment Code** | unique monthly users, total LoC generated, total user messages, total tool calls, completion acceptance rate; API: `/analytics/v0/dau-count`, `/dau`, `/daily-usage`, `/user-activity`, `/daily-user-activity-by-editor-language`, `/credit-usage-by-user`, plus `get`/`set-user-budget-overrides` | **per named user** | per-user credits, optional model breakdown | [docs.augmentcode.com](https://docs.augmentcode.com/analytics/analytics-api) |
| **OpenAI Codex / ChatGPT Enterprise** | Global Admin Console merging ChatGPT + Codex: active users by surface (CLI, IDE extension, cloud, desktop, Code Review), credit/token consumption by surface and model, thread/turn activity, and a **per-user ranking table** sortable by credits, threads, turns, text tokens, engagement streaks; unified Cost API | **per named user, ranked** | yes, per user and per model | [openai.com](https://openai.com/index/introducing-admin-plugin/), [help centre](https://help.openai.com/en/articles/20001478-reviewing-work-and-codex-usage-and-using-personal-analytics-in-chatgpt-desktop) |
| **Replit** | Enterprise Analytics Dashboard: engagement, spend breakdowns, published-app performance (public/private split, publishing frequency, views, remix activity, days online, unique viewers, per-app resource usage) | org | yes | [docs.replit.com](https://docs.replit.com/billing/teams-billing/analytics-dashboard) — app/publishing-centric rather than session-centric |

### 2.5 LLM-observability platforms

Included because they are where per-session cost analysis actually lives today, and they touch
ticket 02's territory at the edges.

- **LangSmith** — automatic per-run token/cost capture; three grains (per-trace with
  cache/text/image token subtypes, project aggregate, custom dashboards for token usage,
  P50/P99 latency, error rates, cost, feedback scores). Documented gotcha: thread/session cost
  rollup requires child runs to carry `session_id`/`thread_id` metadata or costs silently drop out
  ([docs](https://docs.langchain.com/langsmith/cost-tracking)).
- **Langfuse** — cost/tokens broken down by `user`, `session`, `model` and prompt version;
  input/output/cached counts per generation, either vendor-reported ("ingested") or Langfuse-computed
  ("inferred"); Cost Dashboard plus a queryable Metrics API. Notably, the docs recommend the
  per-trace view for finding *"runaway agent loops and retry storms"* showing up as single
  anomalously expensive traces
  ([docs](https://langfuse.com/docs/observability/features/token-and-cost-tracking),
  [dashboards](https://langfuse.com/docs/metrics/features/custom-dashboards)). This is the closest
  thing to a Rework signal found anywhere in the survey — and it is a **diagnostic pattern a human
  spots**, not a labelled metric.
- **Helicone** — per-model and per-user cost, alerts/budgets, and "Sessions" grouping related
  requests to expose "the true cost of user interactions"
  ([docs](https://docs.helicone.ai/guides/cookbooks/cost-tracking) — reached via search summary,
  not directly fetched; treat field detail as unverified).
- **OpenRouter** — Activity dashboard + Analytics API answering cost "per agent, per model, per
  request"; total spend, requests, token volume, **cache-hit rate**, blended cost-per-million-tokens
  with period-over-period sparklines, drill-down to individual requests
  ([OpenRouter](https://openrouter.ai/blog/announcements/activity-dashboard/)).

### 2.6 Three cross-cutting findings

**(a) Efficacy is a category-wide blank.** Across every platform above, agent
success/failure/retry as a *first-class metric* is essentially absent. The nearest approximations
are Devin's per-session `impact` ratings and `useful`/`misleading` knowledge tags
([Devin docs](https://docs.devin.ai/product-guides/session-insights)), Cursor's Bugbot
`issues_resolved` ([Cursor](https://cursor.com/docs/account/teams/analytics-api)), and Langfuse's
retry-storm-as-cost-anomaly pattern ([Langfuse](https://langfuse.com/docs/observability/features/token-and-cost-tracking)).
Nobody surveyed exposes a labelled "task succeeded / failed" field or a retry count. Given how
consistently it is absent across otherwise-detailed documentation, this reads as a real gap rather
than a search miss — but it is stated here as an observation about the market, not as an argument
for any particular metric.

**(b) The dominant proxy is acceptance, and acceptance is contested.** Copilot
(`code_acceptance_activity_count`), Cursor (`total_accepted_diffs`, `line_acceptance_ratio`),
Claude Code (tool accept/reject), Windsurf ("the key metric for measuring suggestion quality"),
JetBrains, Augment and Gemini Code Assist all lean on accept-vs-suggest ratios. §4.4 covers why
the critique literature considers this a weak efficacy proxy.

**(c) Named-individual grain is the norm, not the exception.** Cursor, Claude Code Analytics,
Augment, Tabnine, JetBrains and OpenAI's admin console all key on the individual. **GitHub Copilot
is the outlier**, with the documented five-member floor. On the current evidence, an AI-platform
dashboard that *withholds* per-named-individual data is doing something the category does not
currently do.

---

## 3. What is wrong with it — the canonical frameworks, in their authors' own words

The important finding here is that the strongest warnings against misuse come from **inside** the
frameworks, not from their critics. Anyone building in this category is arguing with the framework
authors' own caveats, not with an external opposition.

### 3.1 DORA

DORA's own guide names Goodhart explicitly:

> *"Setting metrics as a goal. Ignoring Goodhart's law and making broad statements like, 'Every
> application must deploy multiple times per day by year's end,' increases the likelihood that
> teams will try to game the metrics."*
> — [dora.dev/guides/dora-metrics-four-keys](https://dora.dev/guides/dora-metrics-four-keys/)

and scopes the metrics deliberately: they *"are meant to be applied at the application or service
level"*, and the goal is *"to improve your team's performance over time, not to compete against
other teams or organizations"* (same source).

**Caveat on a widely-repeated line.** The sentence "DORA metrics should not be used to evaluate
individual engineers" is quoted everywhere, including by vendors. It could **not** be located as
verbatim text on dora.dev in this pass. It is consistent with the Goodhart warning and the
service-level scoping above, and DX states a version of it in its own words
([getdx.com/blog/dora-metrics](https://getdx.com/blog/dora-metrics/)), but it should be attributed
to DORA-adjacent commentary rather than to DORA. Flagged because it is exactly the kind of claim
that gets used as an appeal to authority.

### 3.2 SPACE

Forsgren, Storey, Maddila, Zimmermann, Houck and Butler, *"The SPACE of Developer Productivity"*,
**ACM Queue 19(1), Feb 2021** ([ACM](https://dl.acm.org/doi/10.1145/3453928),
[Microsoft Research mirror](https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/)).
Central claim: productivity *"is about more than individual activity levels or engineering system
efficiency — it cannot be measured by a single metric [or dimension]"*. Five dimensions:
**S**atisfaction and well-being, **P**erformance (outcomes, not output), **A**ctivity (counts of
actions — the dimension the authors single out as the one most over-relied-on and most misleading
in isolation), **C**ommunication and collaboration, **E**fficiency and flow.

*Evidence note:* the ACM Queue page returned HTTP 403 on direct fetch; the above rests on
Microsoft Research's official mirror. Verify dimension definitions against the ACM text before
quoting them verbatim anywhere user-facing.

### 3.3 DX Core 4

Abi Noda, *"Introducing the DX Core 4"*, **10 Dec 2024**
([newsletter.getdx.com](https://newsletter.getdx.com/p/introducing-the-dx-core-4)). Positions
itself as a synthesis and is unusually blunt about its predecessors: DORA *"offers prescriptive
metrics but has limited scope and usefulness due to focus on system performance"*; SPACE
*"provides a framework for defining your own metrics, which is difficult to actually do."*
Four dimensions: Speed, Effectiveness, Quality, Business Impact. The individual-level warning
quoted in §1.3 is attached specifically to the Speed metric.

Brian Houck (a SPACE co-author, now at DX) revisits Core 4 for AI in
*"Revisiting the DX Core 4 in the Age of AI"* ([DX](https://newsletter.getdx.com/p/revisiting-the-dx-core-4)).

### 3.4 The DX AI Measurement Framework — the closest published thing to this problem

DX publishes an **AI Measurement Framework** with three dimensions
([getdx.com/blog/ai-measurement-framework-guide](https://getdx.com/blog/ai-measurement-framework-guide/),
dated **20 May 2026**; research page at
[getdx.com/research/measuring-ai-code-assistants-and-agents](https://getdx.com/research/measuring-ai-code-assistants-and-agents/),
by Abi Noda and Laura Tacho):

| Dimension | Named metrics |
|---|---|
| **Utilization** | AI tool usage (DAUs/WAUs); % of PRs that are AI-assisted; % of committed code that is AI-generated; **tasks assigned to agents** |
| **Impact** (direct) | AI-driven time savings (developer hours/week); developer satisfaction; **human-equivalent hours (HEH) of work completed by agents** |
| **Impact** (indirect) | PR throughput; perceived rate of delivery; Developer Experience Index (DXI); code maintainability; change confidence; change fail percentage |
| **Cost** | **AI spend (total and per developer)**; net time gain per developer; **agent hourly rate** |

Its stated cautions:

> *"We strongly caution against top-down mandates or using metrics for individual performance
> evaluation. Metrics like code generation volume are particularly susceptible to gaming."*
> *"Encouraging behavior that optimizes for the metric, rather than the outcome, risks malicious
> compliance — undermining team trust and rendering the data meaningless."*

and it recommends telling teams outright: *"These metrics will not be used in individual
performance evaluations."* On agents specifically: *"The most effective approach is to treat
agents as extensions of the developers and teams that oversee their work."*

**An ambiguity worth naming rather than resolving.** DX lists "AI spend (total and **per
developer**)" as a cost metric while cautioning against individual performance evaluation. The
published material does not disambiguate whether "per developer" means *cost per capita*
(total ÷ headcount, an aggregate) or *cost of a named developer* (identified). In `CONTEXT.md`
§ Access terms these are opposite cells of the matrix, and the framework as published does not
choose between them. Anyone citing DX as validating either position on `docs/adr/0001` is
over-reading the source.

---

## 4. What is wrong with it — documented failure modes of individual metrics

### 4.1 Goodhart

Charles Goodhart, 1975, on UK monetary policy: *"Any observed statistical regularity will tend to
collapse once pressure is placed upon it for control purposes."* The compact form everyone quotes
is Marilyn Strathern's 1997 reformulation (citing Keith Hoskin), from a paper on audit culture in
UK higher education: **"When a measure becomes a target, it ceases to be a good measure."**
([overview with primary citations](https://en.wikipedia.org/wiki/Goodhart's_law);
[PMC discussion](https://pmc.ncbi.nlm.nih.gov/articles/PMC7901608/)). Worth noting that Strathern's
original context was *institutional performance auditing of people*, which is closer to the
dashboard case than Goodhart's monetary one.

### 4.2 Volume proxies

- **Martin Fowler, "CannotMeasureProductivity", 29 Aug 2003**
  ([martinfowler.com](https://martinfowler.com/bliki/CannotMeasureProductivity.html)): *"code
  that's well designed and factored will be shorter because it eliminates duplication"* — so LOC
  actively rewards bad design. Fowler further argues that time lags make contemporaneous
  measurement impossible, that individual contribution in supporting roles is especially
  unquantifiable, and explicitly rejects "if you can't measure it, you can't manage it", noting
  that organisations manage lawyers, marketing and education without clean output metrics. He
  reaffirmed the position ten years on:
  *"10 years ago today I wrote that we cannot measure productivity. Still true and still needs to
  be said."* ([2013](https://x.com/martinfowler/status/373056866240053248)).
- **The Gates aphorism** — *"Measuring programming progress by lines of code is like measuring
  aircraft building progress by weight."* Attributed to Bill Gates and ubiquitous, but the original
  source is not confirmed ([provenance discussion](https://news.ycombinator.com/item?id=13202275)).
  Durable, loosely sourced; do not cite as a primary.
- **Will Larson, "My skepticism towards current developer meta-productivity tools", 18 Nov 2020**
  ([lethain.com](https://lethain.com/developer-meta-productivity-tools/)): *"Using productivity
  metrics to measure individuals this way is akin to incident retrospectives that identify human
  error as the root cause"* — the metric locates the problem in the person rather than the system.
  Larson's argument is that the legitimate need is organisational learning, and that
  manager-driven individual ranking is likely to harm the companies that adopt it. This is the
  most directly relevant piece of practitioner writing found for a product in this category.

### 4.3 The McKinsey episode, 2023 — the category's set-piece argument

McKinsey published *"Yes, you can measure software developer productivity"* (Aug 2023). The
rebuttal by **Kent Beck and Gergely Orosz**, *The Pragmatic Engineer*, **29 Aug 2023**
([part 1](https://newsletter.pragmaticengineer.com/p/measuring-developer-productivity),
[part 2](https://newsletter.pragmaticengineer.com/p/measuring-developer-productivity-part-2),
[Beck's cross-post](https://newsletter.kentbeck.com/p/measuring-developer-productivity)) is the
most-cited piece of writing in this whole area. Its load-bearing claims:

- *"4 out of the 5 new metrics suggested by McKinsey measure effort or output"* rather than
  outcomes or impact.
- *"The only folks who care about these metrics are the people collecting them. Customers don't
  care. Executives don't care."*
- The act of measurement *"changes how developers work, as they try to 'game' the system"*.
- Beck's own account of Facebook: survey-score metrics escalated into performance-review criteria
  and *"managers started negotiating with individual contributors for better survey scores."*

Dan North published a widely-read reaction in the same window
([aggregated](https://mozaicworks.com/blog/reactions-to-mckinseys-dev-productivity-metrics-kent-beck-gergely-orosz-and-dan-north);
[LeadDev](https://leaddev.com/career-development/what-mckinsey-got-wrong-about-developer-productivity)).

**Funder-interest flag.** McKinsey's methodology and the client list behind its "~20 companies"
claim were never published. Treat it as consultancy-asserted, not as evidence.

### 4.4 Acceptance rate as an efficacy proxy — contested, and thinly sourced

Since acceptance ratios are the dominant efficacy proxy in the AI-platform dashboards (§2.6b),
the critique of them matters. The critique is widely repeated: acceptance measures whether a
developer *took* a suggestion, not whether it *worked*, and accepted code is frequently rewritten
shortly afterwards.

**However, the evidence here is weak and should be treated as folklore, not fact.** Commonly
circulated figures — a team at 89% acceptance with negative productivity versus 71% acceptance
with a 38% velocity gain; only 12% of accepted code surviving unchanged after a week at a 30%
acceptance rate — could not be traced to any single verifiable primary study in this pass, and
appear to originate in engineering-metrics vendor content. The *direction* is corroborated
independently by GitClear's churn findings (§5.1) and by the METR perception gap (§5.2); the
*numbers* are not sourced.

### 4.5 Surveillance and stack-ranking harms — real concern, weak primary evidence

The strongest specific case is Microsoft's stack ranking, described in Kurt Eichenwald's
*Vanity Fair* "Microsoft's Lost Decade" as the company's most destructive process, with engineers
reportedly avoiding strong teams and strong colleagues because being ranked against excellent
peers was personally risky (via secondary summaries at
[Perdoo](https://www.perdoo.com/resources/blog/stack-ranking),
[Fast Company](https://www.fastcompany.com/90850190/stack-ranking-workers-hurt-morale-productivity-tech-companies)).
GE abandoned stack ranking on similar grounds.

Adjacent monitoring literature — "productivity paranoia", ~60% of companies with remote workers
using monitoring software, trust drops associated with monitoring introduced without clear
communication — was found only via secondary aggregation and **is not verified against primary
studies here**. Report the direction; do not report the numbers.

**A jurisdictional constraint worth knowing about, separate from the ethics.** In Germany, works
councils hold co-determination rights under § 87(1) No. 6 BetrVG over *"the introduction and use
of technical equipment designed to monitor the behaviour or performance of employees"*, and the
test is **objective suitability for monitoring** — neither monitoring intent nor actual evaluation
of the data is required for the right to attach ([overview](https://compound.law/en-DE/compliance/ai-employee-monitoring/),
[Kiteworks](https://www.kiteworks.com/regulatory-compliance/german-works-councils-data-sovereignty-cloud/)).
GDPR compliance and works-council consultation are separate, independent obligations. A dashboard
capable of resolving activity or spend to a named employee is in scope for this regardless of how
the vendor says it should be used. Sourced from legal-practice explainers, not from case law —
treat as directionally reliable, not as legal advice.

---

## 5. What is wrong with it — how AI-assist metrics specifically go wrong

### 5.1 GitClear: code churn and duplication

Three editions, from a code-analytics vendor:

- **2025 edition** — *"AI Copilot Code Quality: 2025 Data Suggests 4x Growth in Code Clones"*
  ([GitClear](https://www.gitclear.com/ai_assistant_code_quality_2025_research)), 211M changed
  lines, Jan 2020–Dec 2024. Copy/pasted lines rose from 8.3% (2020) to 12.3% (2024) of changed
  lines; refactoring-attributed lines fell from ~25% (2021) to <10% (2024); 2024 was the first
  year on record where within-commit copy/paste exceeded moved (refactored) code; code churn —
  code revised within two weeks of being written — rose from 5.5% (2020) to 7.9% (2024).
- **2026 edition** — *"The Maintainability Gap"*
  ([GitClear](https://www.gitclear.com/the_ai_code_quality_maintainability_gap)), 623M changed
  lines, 2023–2026: refactoring down 70% vs 2022; duplication up 81%; copy/paste up 41%;
  error-masking catch blocks up 47%; cross-file reuse down 35%; long-term legacy maintenance down
  74%.

**The finding that complicates the simple story**, and which is usually omitted when GitClear is
cited: heavy AI users out-produce non-users by 4–10x, but **most of that gap predates AI
adoption**. Measured against their own past selves, heavy AI users show a far more modest ~25%
velocity gain. Selection effect, largely.

**Funder flag.** GitClear sells code-analytics tooling and has a commercial interest in
code-quality concern. Its method for attributing code to AI vs human authorship is not
independently verified and is the standard point of methodological criticism of this series.

### 5.2 METR: the randomised trial

*"Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity"*,
METR, **10 July 2025**
([metr.org](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)).
16 experienced OSS developers, 246 real issues in their own mature repositories (avg 22k+ stars,
1M+ LOC), each issue randomly assigned AI-allowed or AI-disallowed. Tools were primarily Cursor
Pro with Claude 3.5/3.7 Sonnet.

> *"When developers are allowed to use AI tools, they take 19% longer to complete issues — a
> significant slowdown."*

The perception gap is the part that matters for a dashboard: developers predicted AI would make
them **24% faster** beforehand, and **after** experiencing the slowdown still estimated they had
been **~20% faster**. Self-report and measurement diverged by roughly 40 percentage points in the
same population.

METR's own caveats, which are unusually complete and should be carried whenever the 19% is quoted:
*"We do not claim that our developers or repositories represent a majority or plurality of
software development work"*; developers had only ~50 hours of tool experience, with learning-curve
effects plausible after several hundred; results may not apply where many parallel model
trajectories can be sampled; AI performance *"may be comparatively lower in settings with very
high quality standards"*; possible sampling bias if developers who experienced strong speedups
declined to participate.

METR has since published *"We are Changing our Developer Productivity Experiment Design"*
(**24 Feb 2026**, [metr.org](https://metr.org/blog/2026-02-24-uplift-update/)) — i.e. METR itself
treats the 19% as one data point under active methodological revision, not a settled result.

### 5.3 DORA on AI: the 2024 anomaly and the 2025 reframe

- **State of DevOps 2024** ([dora.dev](https://dora.dev/research/2024/dora-report/)): a 25%
  increase in AI adoption was associated with an estimated **7.2% decrease in delivery
  stability**, and a small throughput decrease — *while* individual productivity, flow and job
  satisfaction rose. DORA labelled this the **"2024 anomaly"** because it broke the programme's
  decade-long finding that throughput and stability move together
  ([RedMonk, Nov 2024](https://redmonk.com/rstephens/2024/11/26/dora2024/),
  [IT Revolution](https://itrevolution.com/articles/genai-metrics-of-value-for-developers-option-value-dora/)).
- **State of AI-assisted Software Development 2025** ([dora.dev](https://dora.dev/dora-report-2025/),
  [PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf)):
  reframes AI as an **amplifier** — *"AI's primary role is as an amplifier, magnifying an
  organization's existing strengths and weaknesses. The greatest returns on AI investment come not
  from the tools themselves, but from a strategic focus on the underlying organizational system."*
  ([RedMonk, Dec 2025](https://redmonk.com/rstephens/2025/12/18/dora2025/),
  [DevOps.com](https://devops.com/dora-2025-faster-but-are-we-any-better/)).

**No 2026 DORA report was found as of 2026-09-05**; the 2025 edition is the most recent.

**Flag the reframe, don't over-read it.** The 2025 "amplifier" framing does not retract the 2024
stability finding, but it does convert an uncomfortable negative result into a
context-dependent one. The report is Google-sponsored and self-report-based. Both editions'
individual-vs-system split — AI raises *perceived individual* productivity while *system*
stability falls — independently reproduces METR's perception gap from a completely different
method, and that convergence is the strongest thing in this section.

### 5.4 Workslop: cost shifted downstream

Niederhoffer, Rosen Kellerman, Lee, Liebscher, Rapuano and Hancock,
*"AI-Generated 'Workslop' Is Destroying Productivity"*, **Harvard Business Review, 22 Sept 2025**
(BetterUp Labs + Stanford Social Media Lab; via
[Axios, 24 Sept 2025](https://www.axios.com/2025/09/24/ai-workslop-workplace-efficiency-study),
[TNW](https://thenextweb.com/news/ai-workslop-knowledge-decay-harvard-business-review-productivity)).
Defines workslop as AI output that *"masquerades as good work but lacks the substance to advance a
task."* Reported: 40% of respondents received workslop, costing recipients ~1h56m per instance;
62% feel pressured to produce AI-enhanced content but only 28% believe it improves decision
quality; among recipients, 53% felt annoyed, 42% viewed the sender as less trustworthy.

The structural point for a metrics dashboard: **the producer's metric improves while the cost lands
on someone else**, and that someone else is not in the producer's numbers.

**Contrarian flag**: [Pivot to AI, 23 Sept 2025](https://pivot-to-ai.com/2025/09/23/workslop-bad-study-but-an-excellent-word/)
argues the underlying study is methodologically weak — "bad study, but an excellent word". The
term spread far faster than its evidence base.

### 5.5 Stanford / Denisov-Blanch — widely cited, weakly sourced

Presented at AI Engineer World's Fair 2025: a three-year study of commit-level data from ~100,000
developers across 600+ companies, reporting average productivity gains of **15–20%** with very
large variance — **30–40% on simple/greenfield tasks**, and **decreased** productivity on complex
tasks in mature brownfield codebases in less-popular languages. **No peer-reviewed paper or
preprint was located.** This is conference-talk-level evidence circulating under a "Stanford study"
headline. Treat with more caution than METR or DORA — while noting that its task-type/codebase-maturity
split is precisely what would reconcile METR and the optimistic surveys.

---

## 6. The 2026 "tokenmaxxing" episode

This is the most directly relevant body of evidence in the entire brief, because it is not about
productivity metrics in general — it is specifically about **making per-named-individual token and
cost numbers visible and comparable inside an engineering organisation**. Three large companies
tried it within six months of each other in 2026. All three retreated.

**Meta — "Claudeonomics", April 2026.** An employee-built dashboard ranked the top 250 AI token
users across Meta's 85,000+ employees, with gamified titles including *"Token Legend"*,
*"Session Immortal"*, *"Cache Wizard"* and *"Model Connoisseur"*, tiered bronze through emerald.
Reported usage exceeded **60 trillion tokens in 30 days**; the top individual averaged ~281 billion
tokens. Meta shut it down after roughly two days once the data leaked externally, stating
*"due to data from this dashboard being shared externally, we've made the decision to shutter
Claudeonomics for now"* — the employee took it down voluntarily; Meta did not request removal.
Neither Zuckerberg nor CTO Andrew Bosworth ranked in the top 250.
([Fortune, 9 Apr 2026](https://fortune.com/2026/04/09/meta-killed-employee-ai-token-dashboard/))

*Evidence caution:* dollar figures attached to this story are third-party extrapolations at public
list prices and **they disagree with each other** — Fortune puts the top user at "over $1.4
million" at Claude Opus 4.6 pricing, while other outlets circulated ~$4.2m for the same user and
~$9bn for the org total
([KuCoin](https://www.kucoin.com/news/flash/meta-s-internal-claudeonomics-token-usage-ranking-reveals-60-trillion-tokens-burned-in-30-days)).
Enterprise customers do not pay list. Do not reuse any of these dollar numbers.

**Amazon — "KiroRank", shut down 29 May 2026.** An internal leaderboard scoring staff on activity
on Kiro, Amazon's internal AI developer platform, with token consumption as the primary metric.
Employees engaged in *tokenmaxxing* — deploying autonomous agents on unnecessary tasks to inflate
rankings — which **drove up compute cost without proportional value**. Amazon senior vice-president
Dave Treadwell told staff the tool had been created with *"good intentions"* and instructed:
*"Please don't use AI just for the sake of using AI."* Amazon stated the beta dashboard was
*"not a formal or approved tool"* and deprecated it. It moved instead to a metric called
**"normalised deployments"** — how often developers use AI to produce useful, functional code —
with a target of over 80% of developers using AI weekly.
([HR Director, 1 June 2026](https://www.hcamag.com/us/specialization/hr-technology/amazon-shuts-down-ai-leaderboard-after-tokenmaxxing/577189), citing the Financial Times)

**Microsoft — Jay Parikh memo, ~4–5 Aug 2026.** Microsoft introduced **division-level** AI token
budget targets from July 2026 and switched its default internal model to a cheaper option.
Parikh, an EVP, wrote: *"Tokenmaxxing is not what we are optimizing for. I want all of us focused
on maximizing outcomes that move the needle for our customers and our business."*
([The Register, 5 Aug 2026](https://www.theregister.com/ai-and-ml/2026/08/05/microsoft-tells-engineers-to-curb-their-token-burning-enthusiasm/5283482)).
Note the grain deliberately chosen: **division-level budgets**, not individual leaderboards.

**Documented gaming behaviours**, across the episode
([RTÉ, 13 June 2026](https://www.rte.ie/news/business/2026/0613/1578184-token-maxxing-ai/)):
writing deliberately over-complex prompts requiring more back-and-forth; running multiple agents
on continuous automated tasks; building assistants that *"just churned out reams and reams of
code"*; launching *"entire side-projects that had no real purpose"* except consuming tokens. RTÉ
also reports weekly AI-usage targets at some firms, token usage entering bonus discussions, and
staff fearing job loss for insufficient token usage. It names Goodhart's Law explicitly. Uber is
reported to have burned its annual token budget in four months.

**The critique that emerged.** Drew Thompson, DevOps.com, **24 Aug 2026**
([link](https://devops.com/why-tokenmaxxing-was-always-the-wrong-way-for-developers-to-measure-ai-productivity/)),
makes the structural argument: token consumption *"suffers from the same flaw as lines-of-code
measurements"* — a developer with poorly-scoped prompts and longer conversations accumulates more
tokens than one achieving the same outcome efficiently, so the **less** effective developer scores
higher. *"Using 'a lot of AI' is not the same as using AI well."*

**What this episode is and is not evidence for.** It is strong, multi-company, same-year evidence
that a *ranked, comparative, per-named-individual* token/cost surface gets gamed within weeks and
raises cost. It is **not** evidence about non-comparative per-person cost visibility (an engineer
seeing only their own numbers), which none of these three cases isolates — Microsoft's response in
fact *kept* individual usage visibility while moving the *target* to the division. The distinction
between **visibility** and **comparison** is the one the episode actually turns on, and no source
found examines them separately.

---

## 7. The counter-pressure: cost visibility as a genuine budget problem

The critique literature is not the only force acting on this category, and a brief that reported
only the critique would be misleading.

**Gartner, 24 June 2026** — press release *"Gartner Predicts AI Coding Costs Will Surpass Average
Developer Salary by 2028 as Token Consumption Surges"*
([Gartner newsroom](https://www.gartner.com/en/newsroom/press-releases/2026-06-24-gartner-predicts-ai-coding-costs-will-surpass-average-developer-salary-by-2028-as-token-consumption-surges);
direct fetch returned 403, reported via
[InfoWorld](https://www.infoworld.com/article/4189176/ai-coding-token-costs-are-on-track-to-rival-human-payroll-2.html),
[Coté, 25 June 2026](https://cote.io/2026/06/25/the-actual-cost-of-ai-coding-is-going-up-and-will-likely-increase.html)):

- Gartner Peer Insights: **23% of technology leaders spend $200–$500 per developer per month** on
  tokens for AI coding agents; **~6% spend more than $2,000** per developer per month.
- The 2028 prediction is benchmarked against a **global average** monthly developer salary of
  ~$2,000, which materially weakens the headline for US-market readers. Say so if citing it.
- Gartner's stated position: the shift from seat-based to consumption-based licensing introduces
  highly variable cost structures, and *"many providers of AI coding agents lack transparency into
  how token consumption is calculated and billed"*, limiting forecasting and control.
- The line that cuts directly against a privacy-maximalist reading: **"token discipline will not
  emerge through developer choice alone, as developers tend to optimize for speed and convenience
  over cost efficiency."**
- Recommended governance: token usage thresholds with automated monitoring; classifying tasks into
  developer-led / developer-with-agent / fully agent-led; context-engineering practices; embedding
  token usage review into development cycles.
- Gartner senior principal analyst **Nitish Tyagi**, on the other side of the same argument:
  there is *"no direct relationship"* between token consumption volume and productivity gains, and
  he cautions explicitly against *"tokenmaxxing"* — *optimising* token spend, not maximising it,
  is what creates value. Anecdotes cited: *"I have heard scary numbers like 'My developer consumed
  $20K last month,' or 'A business user consumed $32K'."*

Microsoft's own internal guidance, in the same period, acknowledged engineers spending *"in the
range of hundreds of dollars a month to a few thousand dollars in tokens"*
([The Register, 5 Aug 2026](https://www.theregister.com/ai-and-ml/2026/08/05/microsoft-tells-engineers-to-curb-their-token-burning-enthusiasm/5283482)).

**The unresolved tension, stated plainly.** Gartner says per-developer spend is now large enough
and variable enough to require governance, and that developers will not self-govern. The
tokenmaxxing episode says ranked per-developer cost surfaces get gamed and raise cost. Both are
2026, both are about the same numbers. Nothing found reconciles them. The nearest thing to a
resolution in practice is what Microsoft and Amazon actually did: **move the target up an
aggregation level** (division budgets; "normalised deployments") **while leaving individual
visibility in place**. That is an observed industry response, not a validated one.

---

## 8. Evidence quality

### 8.1 Ranking of the sources used, weakest to strongest

1. **Acceptance-rate critique figures** and **surveillance/stack-ranking statistics** — no primary
   study located for the specific numbers. Direction credible, numbers unusable.
2. **Denisov-Blanch / Stanford** — large N, but conference-talk level, no located paper.
3. **McKinsey (2023)** — methodology and sample never published.
4. **Meta/Amazon "cost" figures** — third-party extrapolations at list prices, mutually
   inconsistent by 3x.
5. **GitClear** — very large N, transparent about its data, but a self-interested vendor with an
   unverified AI-attribution method.
6. **Gartner** — proprietary Peer Insights survey; sample size and methodology not disclosed in
   the public release; press release itself unfetchable (403), so all figures here are second-hand
   through trade press.
7. **DORA reports** — very large N, established methodology, but self-report-based and
   Google-sponsored.
8. **METR** — smallest N (16 developers) but the only randomised, causal design, from a
   non-commercial funder, and the only source that published its own limitations in detail.

### 8.2 A warning about the "AI agent metrics" literature

Searches for how to measure agent efficacy — cost per successful task, agent evaluation metrics,
retry rates — return an internet almost entirely composed of SEO content marketing. Multiple such
pages quote confident per-task dollar figures for named models that do not appear to exist. **This
material was deliberately excluded from the brief and should not be relied on.** The consequence
worth recording: the phrase "cost per successful task" is widely circulated as the right unit for
agent economics, but **no high-trust primary source establishing or validating it for coding
agents was found in this pass.** The idea is in the air; the evidence is not.

### 8.3 The four live disagreements

1. **METR (−19%) vs Denisov-Blanch (+15–20%) vs GitClear (output up, quality down).** These are
   reconcilable once task type and codebase maturity are held constant: METR studied experienced
   developers on complex tasks in large mature repositories, which is exactly the regime where
   Denisov-Blanch's own data shows AI underperforming. But that reconciliation is a hypothesis, not
   a finding — nobody has tested it directly.
2. **DORA 2024 vs DORA 2025.** A measured negative effect on stability became a
   context-dependent "amplifier" story without being retracted. Sponsored research; note the
   softening.
3. **McKinsey vs Beck/Orosz/North.** Whether output and effort metrics are usable at all if
   properly contextualised. Unresolved, no neutral adjudication found.
4. **Gartner vs the tokenmaxxing episode.** Cost governance requires visibility; comparative
   visibility corrupts the metric. Unresolved (§7).

### 8.4 Known gaps in this pass

- **Haystack** and **Code Climate Velocity** not researched. **Pluralsight Flow**'s current metric
  set not verified (site returned 403/429). **Jellyfish** and **Faros** individual-vs-team policy
  statements not directly verified.
- Cursor's, Augment's and OpenAI's exact field names come from documentation prose rather than
  verified live API responses.
- **Amp** publishes no metrics schema at all; the leaderboard's contents are unknown.
- No 2026 DORA report exists as of 2026-09-05.
- Whether vendors other than GitHub enforce an undocumented minimum-cohort floor is unknowable
  from documentation.

---

## 9. What this bears on, without deciding it

The ticket asks what the critique literature does to `docs/adr/0001-peer-visibility-excludes-cost.md`.
Reported as findings, both directions, no recommendation.

**Evidence consistent with the ADR's position:**

- Three large organisations built comparative per-person token/cost surfaces in 2026 and all three
  withdrew them within weeks-to-months, with documented gaming and documented cost increases
  (§6). The ADR's predicted failure mode is the one that actually occurred, at scale, in public.
- The ADR's mechanism — "an engineer who knows their spend is on a leaderboard will avoid the
  frontier model on the hard task" — is the mirror image of the observed behaviour (engineers
  inflating rather than suppressing usage). Both are Goodhart responses to the same surface; the
  sign flips with the direction of the incentive. Nothing found tests the suppression direction
  directly, so this half of the ADR's reasoning remains **unvalidated by evidence, though
  structurally symmetric to something that was observed**.
- The framework authors — DORA, SPACE, DX — all warn against person-grain metrics feeding
  evaluation (§3), and DX names gaming and "malicious compliance" specifically.
- Every established analytics vendor examined gates cost data behind a named privileged role
  (§1.5). Peer-visible cost is not, in fact, a category norm.
- The ADR's redirection of cost analysis to non-person dimensions (Model, AgentTemplate,
  Repository work domain, Team) matches what Amazon actually moved to ("normalised deployments")
  and what Microsoft actually did (division budgets) after their leaderboards failed (§6).

**Evidence that complicates or undermines it:**

- The ADR asserts that "most competitor dashboards in the engineering-analytics space" have a
  cost-per-member leaderboard. That is **not supported** by the primary evidence gathered here
  for the engineering-analytics vendors (§1.5) — though it *is* supported for the AI-platform
  vendors: Cursor ships a literal `leaderboard` endpoint with `rank`, and OpenAI's admin console
  ships a per-user ranking table sortable by credits (§2.2, §2.4). The claim is true of the newer
  category and false of the older one, and the ADR does not currently distinguish them.
- Named-individual grain is the **norm** across AI coding platforms (§2.6c). GitHub, with its
  five-member floor, is the sole documented exception. A product withholding peer-level cost is
  taking a position against the current market default, not with it.
- Gartner's June 2026 position is that per-developer spend variance is now a real budget problem
  and that *"token discipline will not emerge through developer choice alone"* (§7). If that is
  right, withholding cost resolution has a cost of its own that the ADR's Consequences section
  does not currently price.
- DX's own AI Measurement Framework lists "AI spend (total and per developer)" as a cost metric
  **and** cautions against individual performance evaluation, without disambiguating per-capita
  from per-person (§3.4). The most credible voice in the space has not resolved the question the
  ADR resolves.

**The distinction no source examined, and which the whole argument may turn on:** every documented
failure is a failure of *comparative, ranked* per-person cost. Nothing found isolates
non-comparative visibility — a person seeing their own spend, or a manager seeing a report they
cannot rank. `CONTEXT.md` § Access already has the vocabulary to express that difference
(`self` vs `peer` vs `org-member`), and the literature does not tell you where to put the line.
That remains a human decision, on ticket 05 and ticket 06.

---

## Source index

Grouped by section; all also cited inline.

**Engineering-analytics vendors** — [LinearB features](https://linearb.io/platform/engineering-metrics/features) ·
[LinearB Investment Profile](https://linearb.helpdocs.io/article/oaf32occ9w-investment-profile) ·
[LinearB Cost Capitalization](https://linearb.io/platform/cost-capitalization) ·
[LinearB DevEx/Coaching](https://linearb.helpdocs.io/article/y1fn773xjx-development-experience) ·
[LinearB 3 levels of visibility](https://linearb.io/blog/engineering-metrics-3-levels-of-visibility) ·
[Waydev features](https://waydev.co/features/) · [Waydev roles](https://waydev.co/features/role-management/) ·
[Swarmia product](https://www.swarmia.com/product/developer-productivity/) ·
[Swarmia on stack ranking](https://www.swarmia.com/blog/dont-stack-rank-your-developers/) ·
[Swarmia capitalization](https://help.swarmia.com/features/capitalize-software-development-costs) ·
[Swarmia roles](https://help.swarmia.com/settings/organization/managing-users-and-roles) ·
[DX Core 4](https://newsletter.getdx.com/p/introducing-the-dx-core-4) ·
[DX dashboards](https://docs.getdx.com/dashboard/overview/) · [DX roles](https://docs.getdx.com/roles/) ·
[DX allocation](https://getdx.com/blog/gain-top-down-visibility-dx-allocation-reporting/) ·
[Jellyfish DevFinOps](https://jellyfish.co/platform/devfinops/) ·
[Jellyfish cost per developer, 4 Aug 2026](https://jellyfish.co/library/ai-coding-tool-cost-per-developer/) ·
[Sleuth teams](https://help.sleuth.io/modeling-your-deployments/teams) ·
[Faros DevOps module](https://docs.faros.ai/docs/devops-management-module) ·
[Pluralsight Coding Days](https://help.pluralsight.com/help/what-is-a-coding-day) ·
[CD Foundation on DORA's five metrics](https://cd.foundation/blog/2025/10/16/dora-5-metrics/)

**AI platform dashboards** — [GitHub Copilot metrics REST](https://docs.github.com/en/rest/copilot/copilot-usage-metrics) ·
[example schema](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/example-schema) ·
[metrics concepts / adoption phases](https://docs.github.com/en/copilot/concepts/copilot-usage-metrics/copilot-metrics) ·
[GA 2026](https://github.blog/changelog/2026-02-27-copilot-metrics-is-now-generally-available/) ·
[cohorts, May 2026](https://github.blog/changelog/2026-05-29-copilot-usage-metrics-api-adds-cohorts-for-ai-adoption/) ·
[usage API deprecation, Feb 2025](https://github.blog/changelog/2025-02-21-deprecation-of-beta-github-copilot-usage-api-endpoint/) ·
[premium request analytics, Sept 2025](https://github.blog/changelog/2025-09-30-premium-requests-analytics-page-is-now-generally-available/) ·
[Cursor analytics API](https://cursor.com/docs/account/teams/analytics-api) ·
[Cursor admin API](https://cursor.com/docs/account/teams/admin-api) ·
[Cursor dashboard](https://cursor.com/docs/account/teams/dashboard) ·
[Claude Code Analytics API](https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api) ·
[Anthropic usage & cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api) ·
[Devin session insights](https://docs.devin.ai/product-guides/session-insights) ·
[Windsurf analytics](https://docs.windsurf.com/windsurf/accounts/analytics) ·
[Amp docs](https://ampcode.com/docs) ·
[Gemini Code Assist monitoring](https://docs.cloud.google.com/gemini/docs/codeassist/monitor-gemini-code-assist) ·
[JetBrains analytics](https://www.jetbrains.com/help/jetbrains-console/analytics.html) ·
[Tabnine reporting](https://docs.tabnine.com/main/administering-tabnine/managing-your-team/reporting) ·
[Augment analytics API](https://docs.augmentcode.com/analytics/analytics-api) ·
[OpenAI admin console](https://openai.com/index/introducing-admin-plugin/) ·
[Replit analytics](https://docs.replit.com/billing/teams-billing/analytics-dashboard) ·
[LangSmith cost tracking](https://docs.langchain.com/langsmith/cost-tracking) ·
[Langfuse cost tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking) ·
[OpenRouter activity dashboard](https://openrouter.ai/blog/announcements/activity-dashboard/)

**Critique** — [dora.dev four keys guide](https://dora.dev/guides/dora-metrics-four-keys/) ·
[DORA 2024](https://dora.dev/research/2024/dora-report/) · [DORA 2025](https://dora.dev/dora-report-2025/) ·
[SPACE, ACM Queue 2021](https://dl.acm.org/doi/10.1145/3453928) ·
[DX AI Measurement Framework, 20 May 2026](https://getdx.com/blog/ai-measurement-framework-guide/) ·
[DX research page](https://getdx.com/research/measuring-ai-code-assistants-and-agents/) ·
[Goodhart / Strathern](https://en.wikipedia.org/wiki/Goodhart's_law) ·
[Fowler, CannotMeasureProductivity, 2003](https://martinfowler.com/bliki/CannotMeasureProductivity.html) ·
[Larson, 2020](https://lethain.com/developer-meta-productivity-tools/) ·
[Beck & Orosz vs McKinsey, 2023](https://newsletter.pragmaticengineer.com/p/measuring-developer-productivity) ·
[GitClear 2025](https://www.gitclear.com/ai_assistant_code_quality_2025_research) ·
[GitClear 2026](https://www.gitclear.com/the_ai_code_quality_maintainability_gap) ·
[METR, July 2025](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) ·
[METR design update, Feb 2026](https://metr.org/blog/2026-02-24-uplift-update/) ·
[HBR workslop via Axios, Sept 2025](https://www.axios.com/2025/09/24/ai-workslop-workplace-efficiency-study) ·
[Pivot to AI critique](https://pivot-to-ai.com/2025/09/23/workslop-bad-study-but-an-excellent-word/)

**Tokenmaxxing & cost pressure** — [Fortune on Meta, 9 Apr 2026](https://fortune.com/2026/04/09/meta-killed-employee-ai-token-dashboard/) ·
[HRD on Amazon KiroRank, 1 June 2026](https://www.hcamag.com/us/specialization/hr-technology/amazon-shuts-down-ai-leaderboard-after-tokenmaxxing/577189) ·
[RTÉ, 13 June 2026](https://www.rte.ie/news/business/2026/0613/1578184-token-maxxing-ai/) ·
[The Register on Microsoft, 5 Aug 2026](https://www.theregister.com/ai-and-ml/2026/08/05/microsoft-tells-engineers-to-curb-their-token-burning-enthusiasm/5283482) ·
[DevOps.com, 24 Aug 2026](https://devops.com/why-tokenmaxxing-was-always-the-wrong-way-for-developers-to-measure-ai-productivity/) ·
[Gartner, 24 June 2026](https://www.gartner.com/en/newsroom/press-releases/2026-06-24-gartner-predicts-ai-coding-costs-will-surpass-average-developer-salary-by-2028-as-token-consumption-surges) ·
[InfoWorld coverage](https://www.infoworld.com/article/4189176/ai-coding-token-costs-are-on-track-to-rival-human-payroll-2.html)
