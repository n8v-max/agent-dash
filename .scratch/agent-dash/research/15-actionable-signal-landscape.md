# 15 — Actionable signals across LLM-first autonomous execution platforms

**Ticket:** `.scratch/agent-dash/issues/15-actionable-signal-landscape.md`
**Written:** 2026-09-05
**Method:** clean-slate. Written without reading briefs 01–04, `.scratch/_archive/`, `map.md`, or any
other issue file. Context permitted and used: `CONTEXT.md`, `docs/assignment.md`, ticket 15.
**Vocabulary:** `CONTEXT.md`. Where a vendor's term maps onto a glossary term the mapping is stated
explicitly rather than assumed.

---

## How to read this brief

**Every claim carries a tag.**

- `[E]` **evidenced** — traceable to a named source in the Source Index, with a date where the claim
  is time-sensitive. Direct quotes are verbatim from the cited page unless marked *(paraphrase)*.
- `[R]` **reasoned** — inference, synthesis, or first-principles argument by the author of this
  brief. Not sourced. Reasoning is welcome here; it is tagged so that after grooming it stays
  distinguishable from a sourced fact.
- `[E?]` — sourced but the source is weak, secondary, indirect, or contradicted elsewhere. Always
  accompanied by a statement of what is uncertain.

**Actionability is inferred, and the inference is always labelled.** No vendor publishes a ranked
list of "our most actionable signal". The brief infers actionability from two observable proxies:

1. **Prominence** — what sits on the default view with no configuration; what is sortable or
   rankable by default; what fires an alert, a digest or a block; what appears in an API's default
   response or default sort order.
2. **Marketed purpose** — how the vendor says in its own documentation the signal is meant to be
   used ("use this to see which users consume the most tokens", "identify power users", "reallocate
   seats").

**This is evidence of vendor belief, not evidence that the signal works.** A vendor putting a
leaderboard on the default view is evidence that the vendor believes ranking drives action. It is
not evidence that ranking improves anything. Section 8 gathers the published evidence on whether
these signals actually predict outcomes, and it is largely unflattering to the signals in
Section 5. The two sections should be read against each other.

**Observational scope.** This brief reports what the field does. It does not propose what this
product should show. Every gap in Section 9 is written as a *question addressed to* tickets 05
(metric set) and 08 (dimension taxonomies), which are human-answered and are not answered here.

**Sourcing rules applied.** First-party product documentation, admin and analytics API references,
changelogs, deprecation and sunset notices, vendor engineering retrospectives, peer-reviewed and
preprint research, and practitioner accounts that name specifics. Content-marketing listicles and
SEO comparison pages were discarded on sight and are not cited; several searches in this space
returned nothing else, and where that happened the brief says so rather than citing filler.

---

## Executive summary

Thirty findings, in rough order of how much they change the picture. Numbering is stable rather
than sequential — items added late carry suffixed numbers (F2b, F18b, F21c) so that cross-references
elsewhere in the brief stay valid.

**F1. The field converged on a near-identical per-engineer schema, and nobody designed it.** [E]
Four vendors with no shared lineage ship substantially the same per-user column set: accepted lines
of code, an acceptance rate, message/session counts, and spend. Cursor's `daily-usage-data` returns
`acceptedLinesAdded` / `totalAccepts` / `totalRejects` per user per day; Augment's Team Usage table
has an `Accept Rate` column plus five separate lines-of-code-by-source columns; Tabnine's "Usage Per
User" page carries Accepted Completions, Chat/Agent Lines of Code and an "Automation Factor";
JetBrains' Central Console defines AI code acceptance rate as "The percentage of accepted lines out
of the generated lines of code". Anthropic's Claude Code Analytics API returns
`lines_of_code.added` / `.removed` and per-tool `accepted`/`rejected` counts per named actor per
day. [R] The convergence is not evidence the schema is right; it is evidence that these are the
fields the client can cheaply emit. Acceptance is observable at the moment of the diff; value is
not.

**F2. Named-engineer ranking by spend and by output is normal, shipped, and often on the default
view.** [E] This is the single most consistent finding in the survey and Section 3.5 records it in
full. Anthropic's Claude Code Team/Enterprise dashboard ships a **Leaderboard** of "top contributors
ranked by Claude Code usage" toggleable between pull requests and lines of code. Anthropic's
Enterprise Analytics API ships `GET /v1/organizations/analytics/user_cost_report`, one row per named
user with email, **default sort `amount` descending** — i.e. engineers ranked by dollar spend as the
API's default behaviour — and `user_usage_report` whose documented purpose is "Use this to see which
users consume the most tokens." Cursor ships a **Usage Leaderboard** in the product and a dedicated
`/analytics/team/leaderboard` API endpoint. Cline's enterprise marketing screenshot shows a **"TOP
SPENDING USERS"** panel with full names, email addresses and 30-day dollar figures ranked
descending. Devin's Usage-policies Members page lists every member "ordered by utilization so
at-risk members surface first". Factory, Augment, Tabnine, JetBrains, Warp, Lovable and Replit all
expose per-named-user tables, most of them sortable by any column.

**F2b. The most explicit artefact in the entire survey is Google Workspace's, and it is default-on
with no configuration and no cohort minimum.** [E] Admin console → Generative AI → Gemini reports →
**User-level usage**, launched 2026-02-16 to all Workspace customers, past 28 days. Per named
employee it shows **Days at limit** (with a checkbox and an "Upgrade users" bulk action), **Active
days**, **Usage level by app**, and an **Overall usage level** bucketed verbatim as: "**High** —
Includes only the **top 10% of users** with non-zero overall Gemini usage that have used it 20 times
or more"; "**Medium** — Have used Gemini 5 times or more"; "**Low** — Have used Gemini 4 times or
less"; "**Zero** — No usage". Google states the purpose directly: "**Identify power users** who are
getting the most out of generative AI features" and "**Identify users with low adoption rates who
might benefit from training**". [R] A vendor-computed percentile bucket applied to named employees,
on by default, is a categorically stronger artefact than a top-10 list: the top-10 list ranks the
visible few, the percentile bucket labels everyone.

**F3. The counter-position exists but is rhetorical, not architectural.** [E] The engineering
analytics vendors publish the strongest prohibitions in the market — Swarmia: "If a platform
emphasizes individual developer rankings or comparisons, that's a red flag"; DX on its Diffs per
Engineer metric: "It is critical that this metric is never used at the individual level or tied to
performance evaluations"; DORA: "Software delivery performance is not an individual measure" — while
all of them still ship individual-grain views. [E] Exactly two products in the whole survey are
*structurally* incapable of per-engineer attribution: **Qodo**, whose docs state "No per-user or
per-engineer provisioning" and pool credits at workspace level, and **Zencoder's Engineering Manager
Dashboard**, which states "Every metric is team-level. The dashboard never reports on individuals."
[E] Exactly one vendor ships a documented identity-stripping switch: **Factory AI's**
`telemetry.granularity: aggregate`, which strips `user.id` and `user.email`, is most-restrictive-wins
across org and individual settings, and is justified in-docs for jurisdictions where "a works council
agreement or a jurisdictional rule forbids per-individual analytics". Its default is `user`.

**F4. Zencoder itself sits in the middle of that spread, and contradicts itself across two
surfaces.** [E] Zencoder's Analytics dashboard ships a **Member Activity table** keyed on user email
address with Agent Messages, IDEs, Languages and Last Active columns, searchable by member and
filterable by email domain, CSV-exportable — per-engineer identified. Its separately-marketed
**Zenflow Engineering Manager Dashboard** advertises the opposite: "Every metric is team-level. The
dashboard never reports on individuals." [R] Both are true simultaneously; they are different
products with different buyers. The observation worth carrying is that a single vendor found it
commercially necessary to ship both, which suggests the two audiences are genuinely distinct rather
than one being a strictly better version of the other.

**F5. Metering units have not converged, and the divergence is the single largest source of
cross-vendor incomparability.** [E] Concurrently in the market: **tokens** (Anthropic API, OpenAI
API, Augment since 2026, Cursor since June 2025), **dollars at provider cost** (Amp — "Amp does not
add a markup to providers' API prices"), **credits with a per-model multiplier** (Zencoder: 0.25×
to 5×; JetBrains: "Each AI Credit corresponds to $1 USD"; Factory; Warp; Lovable; Cline), **premium
requests with a per-model multiplier** (GitHub Copilot), **Agent Compute Units** (Devin, ≈15 minutes
of active agent work), **tasks** (Google Jules: 15/100/300 per rolling 24 hours), **checkpoints and
effort** (Replit), and **seats** (Tabnine, and every vendor's floor). [R] Four of these units —
credits, premium requests, ACUs, tasks — are *vendor-defined synthetic units* whose exchange rate
into tokens or dollars is set by the vendor and changed at will. Section 7 shows how often it is
changed.

**F6. Model choice is metered as a capability tier by the credit-based vendors, and as a flat
group-by by the token-based ones.** [E] Zencoder publishes a multiplier table spanning vendors —
Grok Code Fast 0.25×, Haiku 1×, GPT-5.4-mini 1.25×, GPT-5.3 Codex 2×, Sonnet 3×, Opus and GPT-5.5
5× — which is a cross-vendor capability ordering expressed as price. GitHub Copilot does the same
with premium-request multipliers. [E] Anthropic's own Team/Enterprise **spend report CSV** carries
both a `Model` and a `Model family` column. [R] So a family roll-up now has at least one first-party
precedent, and a cross-vendor capability ordering has at least two (as a *billing multiplier*, not
as an analytics group-by). Section 3.3 treats this carefully; it bears directly on a claim recorded
in `CONTEXT.md`.

**F7. Cost is reported at coarser grain than usage, everywhere, and every vendor labels cost
estimated.** [E] Anthropic's usage report buckets at 1m/1h/1d; its cost report is "Daily granularity
only (`1d`)" and can group only by workspace or description. Console per-user spend carries: "Spend
figures in the Console dashboard are estimates for analytics purposes. For actual costs, refer to
your billing page." OpenAI: "Usage reports and dollar estimates are planning or monitoring tools,
not issued invoices." Anthropic's Enterprise cost report notes costs are "finalized ~30 days after
usage". Cursor separates estimated analytics from `chargedCents` in its usage-events API.

**F8. Alerting in this field is almost entirely financial.** [E] Across every vendor surveyed, the
alerts, digests and blocks fire on **spend or quota**, never on output, quality or failure.
Anthropic: org spend-threshold alerts at 75% and 90%, per-user spend limits with in-app notification
at 75% and 95% (announced 2026-07-02). Devin: progressive banners from ~two-thirds of a member's ACU
allocation, hard block at the cap, immediate admin notification when a member is blocked, **daily
digest** for proactive increase requests. Cursor: email spend alerts at individual and team level
(2025-12-04), Slack or email from June 2026. Augment: "Alert notifications triggered at configurable
threshold percentages". JetBrains: a "Users almost out of AI Credits" view at ≥80% consumed, naming
people. Warp: alerts as usage approaches each configured cap. [E] Replit, despite the largest
runaway-agent exposure in the survey, documents budgets and hard suspension but no alert.

**F9. The reporting artefact the field actually builds its business process around is the CSV
export.** [E] Anthropic ("Click **Export all users** to download complete contribution data for all
users as a CSV"), Zencoder ("Download your analytics data as a CSV file… Compliance and audit
requirements"), Cursor (per-chart CSV plus bulk export), Augment, Tabnine (a `report.zip` plus
**email-scheduled reports**), JetBrains (CSV on every chart and table), Replit ("export usage reports
for internal accounting"), Bolt. [R] The dashboard is the demo; the CSV is the operational artefact,
because the business process it feeds — chargeback, seat reallocation, board reporting — lives in
finance and BI systems the vendor does not own.

**F10. A second artefact class emerged in 2026: the agent that explains your usage.** [E] Amp
shipped "Explain Usage" on 2026-08-21 — natural-language querying of token, credit and orb usage
("Which threads used the most tokens today?"). Devin ships **Session Insights**, an LLM-generated
per-session analysis with an ACU figure, a session-size classification, a task category, an issue
timeline with impact ratings, and prompt-improvement suggestions. Zencoder's Engineering Manager
Dashboard is itself "built by a Zenflow skill from the repos and trackers you already use". Augment
ships a "Cosmos ROI Analyst" agent. [R] The pattern: when the underlying data is high-cardinality
and the useful question is ad hoc, several vendors chose a conversational surface over adding
another chart.

**F11. The unit of analysis is drifting from the *user* to the *session*.** [E] Devin's Session
Insights makes the session the primary object: ACU cost, user message count, a composite XS–XL size
classification where **L and XL are "flagged as unhealthy"**, an eleven-value task category
taxonomy, and a list of issues detected with high/medium/low impact. Cursor's
`filtered-usage-events` returns per-event rows carrying `conversationId`, `cloudAgentId`,
`isHeadless`, four token classes and `chargedCents`. Amp prices per thread and shows a `$` figure on
each thread. Anthropic's OpenTelemetry export carries `session.id` on every metric and a `prompt.id`
that correlates every event from one prompt. [R] This is the closest thing in the field to
`CONTEXT.md`'s AgentSession, and Devin's "unhealthy session" flag is the closest shipped analogue to
a Rework signal — but it is inferred from size, not from retry.

**F12. Nobody in the coding-agent vendor set ships a Rework or retry metric. The engineering
analytics layer does.** [E] Not one of Anthropic, OpenAI, GitHub, Cursor, Zencoder, Devin, Amp,
Augment, Tabnine, JetBrains, Warp, Factory, Replit or Jules exposes "share of tasks that needed more
than one attempt" in its org analytics. [E] LinearB ships **PR Rework** ("the amount of change that
occurs after review feedback in AI assisted pull requests"). Faros ships **cost per task**, **cost
per verified outcome** and explicit **retry-loop token waste**. DORA's own June 2026 guidance
recommends pairing the four keys with "cost per accepted change and code rework rates". GitClear and
Stanford both operationalise rework as code re-changed within two to three weeks. [R] The signal
exists in the field; it lives one layer up from the agent platforms, in tools that read Git rather
than telemetry.

**F13. Repository is a shipped dimension at exactly two vendors, and a work-domain roll-up at
none.** [E] Cursor ships **Repository Insights** ("AI lines committed, total lines committed, and AI
percentage by repository") and Cloud Agent metrics including "top repositories". GitHub ships a
per-repository Copilot report (`/copilot/metrics/reports/repos-1-day`) with Copilot Coding Agent and
Copilot Code Review breakdowns. [E] Anthropic's OpenTelemetry metric set has no repository or
project attribute at all; team attribution has to be injected by the org through
`OTEL_RESOURCE_ATTRIBUTES`, which Anthropic's own example query does ("Cost anomaly detection by
team… [using OTEL_RESOURCE_ATTRIBUTES]"). [E] No vendor in the survey offers a categorical roll-up
*above* repository — no "backend / mobile / infra" grouping. The nearest thing is Devin's session
**task category** (Feature Development, Bug Fixing, Refactoring & Optimization, Test Generation,
Migrations & Upgrades, CI/CD & DevOps, Security, Data & Automation, Documentation & Content,
Research & Exploration, Code Review) and Cursor's Enterprise **Conversation Insights**, which
classifies work by "category, work type, complexity, and specificity" — both of which classify *the
work*, inferred from the session, not *the codebase*.

**F14. Agent configuration is a first-class telemetry attribute but not yet a first-class analytics
dimension.** [E] Anthropic's OTel cost and token counters carry `agent.name`, `skill.name`,
`plugin.name`, `marketplace.name`, `mcp_server.name` and `mcp_tool.name` — with an explicit
cardinality warning, and with user-defined and third-party names redacted to `custom` /
`third-party` unless `OTEL_LOG_TOOL_DETAILS=1`. The OpenTelemetry GenAI semantic conventions define
`gen_ai.agent.name` as an attribute on the agent metrics. Anthropic's Enterprise analytics ships a
`/analytics/skills` endpoint and the Team dashboard shows "Skills (cost per use, number of uses)".
Cursor ships `/analytics/team/skills`. [R] So the *ability* to group cost by agent configuration
exists; what does not exist anywhere in the survey is a roll-up distinguishing vendor-shipped
configurations from org-authored ones.

**F15. The status quo on "who sees whose data" is two-valued: admin sees everything, member sees
nothing — with three documented exceptions.** [E] The dominant pattern is a role gate: Anthropic
("Admins and Owners can view the dashboard"), Zencoder ("Owner or Manager role permissions"),
Tabnine ("Usage reports are available on the admin level, and the rest of the Tabnine team has no
access to the usage data"), Replit (Enterprise admins only), Augment (Enterprise admins). The
exceptions: **Devin's Personal Analytics** — an explicitly permissioned, off-by-default "My
analytics" page where "users only ever see their own consumption, not anyone else's"; **DX's
Personal dashboard** for ICs; and **Amp's workspace**, where the default runs the other way —
"Threads are visible to the whole workspace by default." [E] Cursor is the ambiguous case: its
members page says members "Can see their own usage and remaining included usage" while its analytics
page and practitioner write-ups describe the Usage Leaderboard as visible to non-admins. The two
first-party pages disagree.

**F16. Peer-aggregate benchmarking — seeing a population's totals without seeing who produced
them — is essentially absent as a product feature.** [E] What the field offers instead is
*cross-organisation* benchmarking sold by the analytics vendors: DX's Direct Benchmarking™, DX's Q4
Impact Report (435 companies, 135,000+ developers), LinearB's 2026 Engineering Benchmarks (8.1M PRs,
4,800 teams), Jellyfish Benchmarks. [R] The distinction matters: the field lets you compare your org
to other orgs, and lets an admin compare named people inside your org, but does not generally let a
member compare themselves to an anonymised distribution of their peers.

**F17. Token classes are not defined uniformly, and the standard body has not fixed it.** [E]
Anthropic reports `uncached_input_tokens`, `cache_read_input_tokens`, `cache_creation` and
`output_tokens` as disjoint classes. Cursor's usage-events API returns the same four
(`inputTokens`, `outputTokens`, `cacheWriteTokens`, `cacheReadTokens`). Augment bills on
input/output/cache-read/cache-write. [E] The OpenTelemetry GenAI semantic conventions —
still marked **Development**, not Stable — define `gen_ai.token.type` with only `input` and `output`,
carry **no cache token classes at all**, and define **no cost metric**. [R] Anything normalising
across vendors is doing so without a standard to normalise to, and the obvious standard candidate
does not model the classes that dominate agent cost.

**F18. FOCUS — the FinOps billing interchange standard — has no AI or token-specific column.** [E]
FOCUS is at publication version 1.4 with 1.5 in development. It defines `ConsumedQuantity` /
`ConsumedUnit` and `PricingQuantity` / `PricingUnit` as generic columns; there is no token-specific
column or AI-specific guidance in the spec itself. The AI framing lives in the FinOps *Framework* —
the definition of FinOps was updated March 2026, an **AI Value scope** is emerging, and the **Unit
Economics** capability names "Cost per token" as a resource-efficiency unit metric, then explicitly
recommends moving beyond it: "For generative AI adoption, unit economics often begins with cost per
token, then expands toward outcome-oriented measures like cost per assist, cost per agent action,
cost per case deflected." *(the second is a paraphrase of the page's progression; the metric names
are verbatim)* The Framework's 2026-03-19 update added **AI** as a Technology Category, and the
FinOps-for-AI page states outright that FOCUS handles AI "through existing columns rather than
AI-specific additions".

**F18b. But FOCUS 1.5 is drafting a `ModelFamily` column — and this bears directly on a claim
recorded in `CONTEXT.md`.** [E] The 1.5 working draft (target Dec 2026, not ratified) adds four
FOCUS-defined `SkuPriceDetails` properties: `ModelDeveloper`, **`ModelFamily`** — "Grouping of
related models as defined by the model developer" — `ModelId` and `ModelVersion`. It also settles
token classes *structurally* rather than as a property: input and output tokens become separate SKUs
distinguished by `SkuMeter` values "Input Tokens" and "Output Tokens", with `ConsumedUnit = "Tokens"`
and `PricingUnit = "1000000 Tokens"`. [R] So a **family** roll-up now has a draft standards
precedent, defined as the model developer's own grouping. A **cross-vendor capability tier** does
not, and the draft explains why in its own words: `ModelId` "is **not guaranteed to match across
service providers**." The field has a standardising answer for family and an acknowledged hard
problem above it.

**F18c. The published error rate for token-derived cost is large, and cache classes are where it
goes wrong.** [E] From the OpenTelemetry GenAI issue tracker (#484, 2026-08-31): "Backends that
recompute without per-class data get it wrong: langfuse/langfuse#13807 shows recomputed Anthropic
caching costs at roughly **40% of true spend**", with the underlying issue reporting a true cost of
`$0.52231845` against a materially under-counted derived value. The same issue notes "Three
incompatible breakdown shapes already ship" — LiteLLM's `gen_ai.cost.{class}_cost`, OpenInference's
eleven `llm.cost.*` attributes, and OpenRouter's `gen_ai.usage.{input,output,total}_cost` — and that
"A total cannot distinguish 'fully priced' from 'tokens only'." [E] The inclusive/exclusive
convention is itself inverted between two major schemas: OpenTelemetry's `gen_ai.usage.input_tokens`
"SHOULD include all types of input tokens, **including cached tokens**", while Langfuse requires that
"each token must be counted in exactly one key" and subtracts cache reads and writes from `input` on
ingest.

**F19. The FinOps buyer allocates to cost centres; the coding-agent vendors allocate to people. The
two layers are now wired together.** [E] The FinOps Foundation's Invoicing & Chargeback capability
describes maturity as cost-centre hierarchy widening from "cost centers only assigned to leadership"
to "more granular parts of the organization" — teams and business units, not individuals — and holds
that "Showback is always required in any FinOps practice, but chargeback is dependent on
organizational accounting policies." [E] Meanwhile CloudZero's Anthropic Enterprise connector
ingests "per-user cost and usage data, broken down by user, product, model, and context window",
Cursor ships **billing groups** with per-group spend, and Amp Enterprise offers "User groups for
cost attribution". [R] So the per-engineer cost record produced by the coding-agent layer is being
piped directly into the FinOps layer, whose own doctrine stops at the cost centre.

**F20. Pricing-model churn is the sector's defining operational fact, and it repeatedly invalidates
historical reporting.** [E] Cursor moved from request-based to token-based pricing on 2025-06-16 and
apologised on 2025-07-04: "We recognize that we didn't handle this pricing rollout well, and we're
sorry." Windsurf removed flow-action credits (April 2025), then removed credits entirely for
non-rolling daily/weekly quotas with a $15→$20 rise (2026-03-19). Augment went messages → credits
(2025-10-20) → tokens plus a 40% service fee. Devin went $500/month → $20 plus $2.25/ACU
(2025-04-03). Warp went requests → three-bucket credits (2025-10-30). Replit went flat-per-checkpoint
→ effort-based (2025-06-18). Lovable unified split balances into one pool (2026-06-13). [R] Every
one of these breaks period-over-period comparison of the vendor's own headline unit.

**F21. GitHub's aggregate-only, ≥5-user Copilot Metrics API is gone; the per-user report replaced
it.** [E] Four generations of Copilot metrics API in twenty months, with three sunsets: the beta
`/copilot/usage` route retired 2025-01-31; the legacy usage-report CSV retired 2025-11-05; and a
closing-down notice on 2026-01-29 sunset the User-level Feature Engagement Metrics API and Direct
Data Access API on 2026-03-02 and **the `/orgs/{org}/copilot/metrics` API itself on 2026-04-02**. The
replacement, GA 2026-02-27, is a set of twelve endpoints returning signed download links to NDJSON,
including `users-1-day` and `users-28-day/latest` at both org and enterprise scope, keyed on
`user_login`, carrying per-user `code_acceptance_activity_count`, `loc_added_sum`,
`loc_suggested_to_add_sum`, `user_initiated_interaction_count`, `ai_credits_used`, an
`ai_adoption_phase` cohort, and breakdowns by IDE, feature, language, model and — since 2026-08-07 —
**third-party agent** (`totals_by_3rd_party_agent`, covering Claude and Codex activity inside GitHub
workflows). [E] The ≥5-user minimum survives only on `user-teams-1-day`: "Teams with fewer than 5
seated Copilot users are excluded from the user-teams reports", while sub-threshold members' activity
"is still in the per-user usage metrics report". [R] The threshold is now a join-key suppression, not
a privacy floor. [E?] The extraction of these quotes was via a summarising fetch layer; anything
load-bearing should be re-verified against the cited GitHub URLs before republication.

**F21b. Every hyperscaler has closed the developer-side opt-out against the employer while keeping
it against themselves.** [E] This is the sharpest through-line in the hyperscaler evidence. Amazon
Q Developer: "When you enable user activity reports, Amazon Q collects telemetry regardless of how a
developer has set the **Enable Amazon Q to send usage data to AWS** setting in their IDE. That
setting controls whether telemetry can be used by the AWS corporation, not your organization." Kiro:
"This is controlled at the administrator level and can't be configured by users." Google, release
note 2025-08-27: "Gemini Code Assist telemetry log settings now override the VS Code telemetry
setting." GitHub: IDE telemetry off suppresses IDE-sourced metrics, but GitHub supplements with
server-side telemetry "to capture additional active users". Anthropic's OTel export is the
counter-example — it is opt-in at the org level and content is redacted by default — but its own
docs note the residual: "When authenticated via OAuth, `user.email` is included in telemetry
attributes. If this is a concern for your organization, work with your telemetry backend to filter
or redact this field."

**F21c. GitHub retired premium requests as a unit, thirteen months after introducing them.** [E] On
2026-06-01 premium requests were replaced by **AI Credits** (1 credit = $0.01, billed on input +
output + cached tokens at published per-model API rates). GitHub's stated rationale: under premium
requests "a quick chat question and a multi-hour autonomous coding session can cost the user the
same amount", and absorbing inference cost "is no longer sustainable." Annual subscribers who did
not migrate remain on the legacy multiplier table — and their **multipliers were increased** (Claude
Opus 4.7/4.8 at 27×, GPT-5.5 at 57×, code review at 13). [E] GitHub also ships the only per-named-
individual budget enforcement found anywhere in the survey: budgets scoped to enterprise, org, cost
center, repository **and user** — "User-scoped budgets are currently only supported for Copilot AI
credits" — with alerts at 75%, 90% and 100% by UI and email, and a $0 user budget that blocks a named
developer immediately.

**F22. The published evidence does not support most of what the field markets as actionable.** [E]
METR's 2025 RCT found experienced developers **19% slower** with AI while believing they were ~20%
faster; METR's follow-up (2026-02-24) then concluded of its own successor experiment: "we believe
that the data from our new experiment gives us an unreliable signal of the current productivity
effect of AI tools", because 30–50% of developers refused to submit tasks they wanted AI for.
LinearB's 2026 benchmark (8.1M PRs) found AI-assisted PRs merge at **32.7% vs 84.5%** — which
attacks "% of PRs that are AI-assisted" at the root, since the denominator counts work that never
ships. GitClear's June 2026 report (623M changes) found refactoring down **70%** and block
duplication up **81%**. Faros (10,000+ developers) found PR review time up **91%** and stated "any
correlation between AI adoption and key performance metrics evaporates at the company level". DORA
2024 measured a **−1.5%** throughput and **−7.2%** stability effect per 25% AI adoption increase;
DORA 2025 reversed the throughput sign while the stability penalty persisted. DX's own Q4 2025
report says the quiet part: "Developers report saving nearly 4 hours a week. But those savings
aren't showing up proportionally in throughput." [R] Section 5 lists what the field believes is
actionable. Section 8 lists what the evidence supports. They overlap on almost nothing.

---

**F23. The field's two largest vendors disagree, in writing, about whether the headline metrics are
valid.** [E] Anthropic's Claude Code dashboard leads with **lines of code accepted** and **suggestion
accept rate**. OpenAI's Codex governance documentation lists exactly those two under a heading
**"What it does not provide"**, with reasons: lines of code generated is "a bit of a noisy proxy for
productivity and can incentivize the wrong behavior", and acceptance rate of suggestions is "almost
100% since users usually accept the change first". *(This wording is from a 2026-07-03 Wayback
snapshot of `developers.openai.com/codex/enterprise/governance`; the live page now defers to an
auth-gated reference, so it should be re-verified before being relied on.)* [R] Two vendors with
comparable telemetry, comparable customers and comparable incentives reached opposite published
conclusions about the same two metrics. That is the strongest single piece of evidence in this brief
that the field has *not* settled what is actionable.

**F24. OpenAI keeps the ranking while rejecting the output metrics.** [E] The same Codex analytics
dashboard that refuses lines of code and acceptance rate ships a "User ranking table, with filters
for client and sort options: **credits, threads, turns, text tokens, and current streak**" — a
gamified streak column included. The Codex Analytics API `/usage` endpoint returns **per-user rows by
default**; `group=workspace` is the *opt-out*. [R] So OpenAI's objection is to *output-volume* proxies,
not to per-engineer ranking as such. Engagement-volume ranking survives the cull.

**F25. OpenAI's compliance surface carries an explicit prohibition that no analytics surface
carries.** [E] The Compliance API documentation states: "It's not a productivity dashboard. Don't use
it to infer code quality or individual performance." [R] The prohibition attaches to the raw-record
surface, not to the ranked analytics surface — which is the opposite of where a reader might expect
it.

---

## 1. The shape of the field

### 1.1 Four product classes, one telemetry stream

[R] Everything surveyed falls into one of four classes, and the classes differ less in *what they
measure* than in *where they stand relative to the agent run*.

| Class | Position | Representative products | What it can see natively |
|---|---|---|---|
| **A. Cloud / async agent execution** | owns the run | Claude Code (incl. on the web), OpenAI Codex cloud, GitHub Copilot coding agent, Google Jules, Devin, Zencoder Zenflow, Amp orbs, Factory, Replit Agent, Cursor Cloud Agents | session lifecycle, tokens, model, tool calls, cost, agent config, outcome |
| **B. IDE-resident assistant with org analytics** | owns the keystroke | Cursor, Copilot, Windsurf (now Devin Desktop), Augment, Tabnine, JetBrains AI, Warp, Amazon Q, Gemini Code Assist, Zencoder IDE Agent | suggestions shown/accepted, lines, messages, editor, language, model |
| **C. Engineering analytics** | owns the Git history | DX, LinearB, Jellyfish, Swarmia, Faros, Uplevel, GitClear, Code Climate | PRs, cycle time, review time, rework, churn, defects, survey responses |
| **D. FinOps / LLM gateway & observability** | owns the invoice or the wire | FinOps Foundation (FOCUS, Framework), CloudZero, Vantage, Datadog, Harness, Honeycomb, Grafana, LiteLLM, Helicone, Langfuse, Portkey | spend, allocation tags, budgets, per-request traces |

[E] The classes are wired together explicitly. Anthropic's own Usage & Cost API page lists
**CloudZero, Datadog, Grafana Cloud, Harness, Honeycomb and Vantage** as named partner integrations
— i.e. Anthropic outsources alerting and dashboarding to class D rather than building it. Augment's
Analytics API documentation states its purpose as letting you "build your own AI integration
dashboards with tools like **Jellyfish**" — class B feeding class C. Jellyfish's AI Impact ingests
Copilot, Cursor, Claude Code, Amazon Q, Gemini Code Assist, Windsurf, CodeRabbit, Devin, Copilot
Agent and Google Jules.

[R] The consequence for anyone reading this survey: a signal's absence from a class-A product does
not mean the field considers it worthless. It often means the field decided it belongs to class C or
D. Rework is the clearest case (F12).

### 1.2 The metering-unit landscape

[E] Concurrently in market as of 2026-09-05:

| Unit | Vendors | Definition given by the vendor |
|---|---|---|
| **Tokens** | Anthropic API, OpenAI API, Cursor (since 2025-06), Augment (current), Bolt | priced categories, 4–5 classes |
| **Dollars at provider cost** | Amp | "Amp does not add a markup to providers' API prices" |
| **Credits with per-model multiplier** | Zencoder, JetBrains, Factory, Warp, Lovable, Cline, Qodo, OpenAI (ChatGPT/Codex credit plans) | Zencoder: "The unit of consumption inside Zencoder. Every LLM call costs a number of credits based on the model and the work involved." JetBrains: "Each AI Credit corresponds to $1 USD." |
| **Premium requests with per-model multiplier** | GitHub Copilot | "A request is any interaction where you ask Copilot to do something for you" |
| **Agent Compute Units** | Devin (and, post-acquisition, Windsurf/Cascade) | "the work performed by Devin"; ≈15 min of active work; `acus_by_product` splits `devin`/`cascade`/`terminal`/`review` |
| **Tasks** | Google Jules | 15 / 100 / 300 "Daily Tasks (rolling 24 hours)" by plan; plus a concurrency cap |
| **Checkpoints → effort** | Replit | "A checkpoint occurs when Agent completes work on your request"; effort-based from 2025-06-18 |
| **Messages / local messages per 5h** | OpenAI Codex plan limits, Augment (until 2025-10-20) | "These estimates are not fixed message limits" |
| **Seats** | Tabnine, and every vendor as a floor | — |
| **Compute time** | Amp orbs (billed by the minute), Augment Cosmos ($0.19/hour, 5-minute increments), Warp platform credits ("billed by the agent hour") | — |

[R] Four observations follow.

1. **Synthetic units decouple the meter from the underlying cost**, which is exactly what makes them
   attractive to vendors (margin, bundling, price changes without renegotiating rate cards) and
   exactly what makes them useless for cross-vendor comparison.
2. **Compute time has re-entered the meter.** Amp, Augment Cosmos, Warp and Devin all bill for the
   sandbox the agent runs in, separately from inference. This is new relative to the IDE-assistant
   generation and is a direct consequence of async execution: the machine keeps running while nobody
   is typing. Anthropic is the outlier — for Claude Code on the web, "There is no separate compute
   charge for the cloud VM." [E]
3. **Idle is explicitly modelled** by the async platforms. Devin: "When a session is idle, Devin goes
   to sleep. While sleeping, Devin does not consume usage… Devin typically sleeps automatically after
   roughly 0.1 ACUs of inactivity." Amp "pauses inactive orbs automatically." [E]
4. **The unit and the reporting grain are the same object.** A product that meters in tasks (Jules)
   cannot report token classes; a product that meters in tokens (Anthropic) has to synthesise a
   session concept to report on one. [R]

### 1.3 Reporting-artefact taxonomy

[R] Across the survey, six artefact types recur. Ordered by how universally they appear:

1. **Per-user table** — near-universal in classes A and B. Usually email-keyed, usually
   CSV-exportable, usually sortable.
2. **CSV / scheduled export** — the operational artefact (F9). Tabnine is the only vendor found that
   ships **email-scheduled** reports rather than on-demand download. [E]
3. **Adoption time series** — DAU/WAU/MAU plus sessions. Present in literally every class-A and
   class-B product surveyed, including the shallowest (Zencoder, Bolt, Jules aside).
4. **Budget / quota console with enforcement** — Devin usage tiers, Zencoder quota caps as a
   percentage of the org pool, Cursor per-user spend limits, Anthropic org/group/member spend limits,
   Augment three-tier budgets, JetBrains credit limits, Replit org budgets in $500 increments,
   Lovable per-member limits.
5. **Per-session / per-thread cost record** — Devin Session Insights, Amp's per-thread `$`, Cursor's
   `filtered-usage-events`, Anthropic's `session.id`-attributed OTel metrics.
6. **Conversational / agent-generated report** — Amp "Explain Usage" (2026-08-21), Devin Session
   Insights analysis, Zencoder's skill-built Engineering Manager Dashboard, Augment's Cosmos ROI
   Analyst, DX's "DX AI" natural-language report generation. [E] Newest and least standardised.

---

## 2. Axis 1 — Core value propositions, in the vendor's own words

[E] All quotes verbatim from the cited first-party page unless marked.

### 2.1 Cloud / async agent execution

| Vendor | Value proposition (verbatim) |
|---|---|
| **Anthropic (Claude Code analytics)** | "Claude Code provides analytics dashboards to help organizations understand developer usage patterns, track contribution metrics, and measure how Claude Code impacts engineering velocity." Analytics API: "enabling organizations to analyze developer productivity and build custom dashboards." Enterprise controls: "These controls give admins the visibility to understand how Claude is being used and the tools to manage costs." (2026-07-02) |
| **OpenAI (Codex)** | "Codex gives enterprise teams visibility into adoption and impact, plus the auditability needed for security and compliance programs." *(2026-07-03 archive)* Analytics API: "provides aggregated Codex usage and activity metrics for a ChatGPT workspace." |
| **Zencoder** | "AI orchestration for code and work. One subscription. Every frontier model. The right one for every task. Better quality, lower cost, no vendor lock-in." Enterprise: "The complete AI orchestration platform for your enterprise." Analytics: "Track usage patterns and monitor team engagement with Zencoder across your organization." Manager dashboard: "Your DORA dashboard is already in Zenflow… **The $100K analytics stack you don't need.**" |
| **Devin / Cognition** | "Devin is the AI software engineer, built to help ambitious engineering teams crush their backlogs." Devin Coach: "helps your team get more out of every ACU by coaching users directly where they work." |
| **Amp** | "Amp is a coding agent and development environment built for the frontier." Workspace: "A workspace is your team on Amp. It holds your members, the threads they create, the projects they work in, and one shared bill." |
| **Factory AI** | "THE AUTONOMY STACK FOR ENTERPRISE TEAMS"; analytics: "This enables platform teams to identify power users…" |
| **Cline** | "The coding agent for enterprises that use any provider in any IDE" / "Secure by design." |
| **OpenHands** | "Every token is tied to a user, session, repo, and workflow. Set budgets by project." |
| **Google Jules** | No org analytics surface documented; the usage-limits page defines only Daily Tasks and Concurrent Tasks per plan. [E] |

### 2.2 IDE-resident with org analytics

| Vendor | Value proposition (verbatim) |
|---|---|
| **Cursor** | "Cursor is your coding agent for building ambitious software." Teams Standard includes "Usage analytics to understand team behavior." |
| **Augment Code** | "Run your software factory." Analytics API: "provides access to usage metrics for your organization, including how Augment Code is being used across your team." |
| **Tabnine** | "The Missing Layer in Enterprise AI: Context." Usage per User: "a user-level breakdown of Tabnine adoption and activity across the organization." |
| **Warp** | Analytics API: "Returns per-user aggregated usage, split into `local` … and `cloud` … sections." |
| **Windsurf → Devin Desktop** | Admin guide: "Analytics shows the percentage of code written by Windsurf, helping quantify impact." |
| **Qodo** | "Govern code at the speed AI writes it." |

### 2.3 Engineering analytics

| Vendor | Value proposition (verbatim) |
|---|---|
| **DX** | "The developer intelligence platform designed by researchers"; "combines quantitative and qualitative insights in a single platform, giving you a complete view into developer productivity." |
| **LinearB** | "Get a clear, data-driven view of AI adoption across your engineering org. Compare AI-generated vs. human code, track quality trends, and measure developer impact." |
| **Jellyfish** | "From early pilots to scaled programs, Jellyfish gives engineering leaders the data and guidance to measure AI progress, adapt quickly, and deliver lasting business impact." |
| **Swarmia** | "See exactly what your AI investment is buying you." |
| **Faros AI** | "**Stop token maxxing. Start outcome maxxing.**" / "Reduce your cost per outcome shipped, while continuously improving your AI coding efficiency." |

### 2.4 FinOps

| Body / vendor | Value proposition (verbatim) |
|---|---|
| **FinOps Foundation** | FinOps is "an operational framework and cultural practice which maximizes the business value of technology, enables timely data-driven decision making, and creates financial accountability through collaboration between engineering, finance, and business teams." *(definition updated March 2026)* |
| **FOCUS** | "FOCUS is an open specification for billing data. It defines a common schema for billing data, aligns terminology with the FinOps Framework and defines a minimum set of requirements for billing data." |
| **CloudZero** | "Connect your Anthropic account to CloudZero to bring your Anthropic cost and usage data into a unified view of all your cloud and AI spend." |

[R] The class boundary shows up cleanly in the language. Class A and B sell **visibility and
control**; class C sells **impact and ROI**; class D sells **allocation and accountability**. Only
Faros and Swarmia — both class C — put the *cost-per-outcome* framing in the headline, and both are
selling to a buyer who already has the class-A telemetry and is dissatisfied with it. [R]

---

## 3. Axis 2 — Metrics, dimensions, grain and audience

### 3.1 The de facto standard per-engineer schema

[E] Laid side by side, the per-user record across seven vendors:

| Vendor | Identity key | Volume | Acceptance | Cost / unit | Extra |
|---|---|---|---|---|---|
| **Anthropic** (Claude Code Analytics API) | `actor.email_address` (OAuth) or `api_key_name` | `num_sessions`, `lines_of_code.added/.removed`, `commits_by_claude_code`, `pull_requests_by_claude_code` | `edit_tool` / `multi_edit_tool` / `write_tool` / `notebook_edit_tool` × `{accepted, rejected}` | `model_breakdown[].tokens.{input,output,cache_read,cache_creation}` + `estimated_cost` in cents | `terminal_type`, `customer_type`, `subscription_type`, `is_remote` |
| **Anthropic** (Enterprise `analytics/users`) | `user.email_address` | commit_count, pull_request_count, distinct_session_count, lines_of_code | per-tool accepted/rejected | separate `user_cost_report` / `user_usage_report` | per-product blocks for chat, Cowork, Design, Office, Science; `rbac_group_id`; `last_activity_date` |
| **OpenAI** (Codex analytics) | user (email optional in export) | threads, turns | — *(deliberately absent)* | credits, text tokens | **current streak** |
| **GitHub** (`users-1-day`) | `user_login` | `code_generation_activity_count`, `loc_added_sum`, `loc_suggested_to_add_sum`, `user_initiated_interaction_count` | `code_acceptance_activity_count` | `ai_credits_used` | `ai_adoption_phase` cohort; `totals_by_{ide,feature,language_model,3rd_party_agent}`; boolean feature flags |
| **Cursor** (`daily-usage-data`) | `email` | `totalLinesAdded/Deleted`, `totalTabsShown`, `composerRequests`, `chatRequests`, `agentRequests` | `acceptedLinesAdded/Deleted`, `totalAccepts`, `totalRejects`, `totalTabsAccepted` | separate `/teams/spend`: `spendCents`, `overallSpendCents` | `mostUsedModel`, `clientVersion`, `bugbotUsages`, `isActive` |
| **Augment** (Team Usage) | email or service account | Completions, Chat/Agent/Remote-Agent/CLI Messages, Tool Uses, five LOC-by-source columns | Accepted Completions, **Accept Rate** | credits / tokens in the usage dashboard | First Seen, Last Seen, Active Days |
| **Tabnine** (Usage per User) | user + team, searchable by email | Chat Interactions, Agent Interactions, Chat/Agent Lines of Code, **keystrokes** (CSV) | Accepted Completions | seat | **Automation Factor** / **Productivity Factor** |
| **Zencoder** (Member Activity) | `Email` | `Agent Messages` | — | — *(credits live in Quota Management, separately)* | `IDEs`, `Languages`, `Last Active` |
| **Kiro** (user activity CSV) | `UserId` **and `User_Email`** | `Chat_Conversations`, `Total_Messages`, per-model message columns | — | `Credits_Used`, `Overage_Credits_Used`, `Overage_Cap`, `Overage_Enabled` | `Client_Type`, `Subscription_Tier`, `New_User` |
| **Amazon Q Developer** (user activity report) | IdC directory + user UUID (no email documented) | `Chat_AICodeLines`, `Inline_AICodeLines`, `Dev_GeneratedLines` | `Inline_AcceptanceCount` / `SuggestionsCount`, 10 `InlineChat_*` accept/reject/dismiss counters | seat | 44 metrics across doc-gen, test-gen, code review, code fix, transformation |
| **Warp** (`/analytics/users`) | `user_id`, `email` | `distinct_conversation_count`, `lines_of_code.{suggested,accepted,added_count,removed_count}` | `file_changes.{suggested, accepted}`, `was_edited_by_user` | `credits_spent`, `credit_charged` | `local` vs `cloud` split, `model_usage[]` |

[R] Read down the columns and the picture is consistent: **identity, volume, acceptance, unit
consumed**. Four vendors add one "insight" column of their own invention — Tabnine's Automation
Factor, OpenAI's streak, GitHub's adoption phase, Anthropic's `is_remote`. Nothing in the table
measures whether the work was correct, whether it survived, or whether it had to be redone.

### 3.2 Dimensions the field ships

[E] Grouping and filtering dimensions actually available:

| Dimension | Where it ships | Roll-up levels offered |
|---|---|---|
| **Member / user** | everywhere except Jules, Antigravity, Qodo | user → team/group → org. GitHub team roll-up is a documented *join recipe* (`user-teams-1-day` ⋈ `users-1-day`), not a native aggregate. Anthropic groups by `rbac_group_id`; Cursor by AD group and by **billing group**; Devin by usage tier and IdP group; Amp by user group (Enterprise, "on request") |
| **Model** | everywhere token- or credit-metered | **flat**, with two exceptions: Anthropic's spend-report CSV carries `Model family`; Zencoder, Copilot legacy and Kiro publish cross-vendor **multiplier** tables that impose a de facto capability ordering as a *price*, not as an analytics group-by |
| **Time** | everywhere | Anthropic and OpenAI share the identical `1m` / `1h` / `1d` bucket vocabulary and the identical limit ladder (7/31, 24/168, 60/1440). GitHub offers 1-day and 28-day rolling. Zencoder offers 7/30/90-day presets only |
| **Repository** | Cursor (Repository Insights, "top repositories"), GitHub (`repos-1-day` with `repo_visibility`), OpenHands ("Every token is tied to a user, session, repo, and workflow") | repo only. **No work-domain roll-up anywhere.** |
| **Product surface / client** | Anthropic (`terminal_type`, `is_remote`, per-product blocks), OpenAI (CLI / IDE / cloud / desktop / Code Review), GitHub (`totals_by_ide`, boolean feature flags), Kiro (`Client_Type`), Warp (`local` vs `cloud`), Devin (`acus_by_product`) | — |
| **Language** | GitHub, Zencoder, Google, Amazon, Cursor (file extension), Warp | — |
| **Agent / skill / plugin** | Anthropic OTel (`agent.name`, `skill.name`, `plugin.name`, `mcp_server.name`, `mcp_tool.name`) and `/analytics/skills`; Cursor `/analytics/team/skills`; OpenAI (skill invocations, agent identity usage); OTel GenAI (`gen_ai.agent.name`) | **no kind/provenance roll-up anywhere.** Anthropic redacts user-defined and third-party names to `custom` / `third-party` by default |
| **Service tier / speed / context window / region** | Anthropic usage API (`service_tier`, `speed`, `context_window`, `inference_geo`); OpenAI usage API (`service_tier`, `batch`) | — |
| **Work type** | Devin session `Category` (11 values); Cursor Enterprise **Conversation Insights** ("category, work type, complexity, and specificity"); LinearB / Jellyfish issue-type investment allocation | classifies the *work*, inferred per session, not the codebase |

### 3.3 Dimensions the field does not ship — and one correction

[R] Three notable absences, stated as observations rather than recommendations.

1. **A categorical roll-up above repository.** Nobody groups repositories into work domains. The
   closest analogues classify the session (Devin, Cursor) or the ticket (LinearB, Jellyfish), not the
   codebase.
2. **A provenance roll-up over agent configurations.** Agent, skill and plugin names exist as
   attributes; no product distinguishes vendor-shipped from user-authored from
   API-registered configurations as an analytics grouping.
3. **A cross-vendor capability tier as an analytics group-by.** Model is a flat dimension in every
   analytics API surveyed.

[E] **However, a correction is owed on the second half of point 3, and on family roll-ups
generally.** `CONTEXT.md` records, citing ticket 02, that "Every surveyed platform treats model as a
flat group-by; none offers a family or cross-vendor tier roll-up." As of 2026-09-05 the *family*
half of that claim has at least one first-party counter-example: Anthropic's Team/Enterprise **spend
report CSV** carries a `Model family` column alongside `Model`. And a cross-vendor capability
ordering is now published by at least three vendors — Zencoder's credit multipliers (0.25× Grok Code
Fast → 5× Opus/GPT-5.5), GitHub's legacy premium-request multipliers (0.25× MAI-Code-1.1-Flash → 57×
GPT-5.5), and Kiro's credit multipliers — but in every case it is expressed as a **billing
multiplier**, not as a selectable analytics roll-up. [R] The distinction is worth keeping sharp: the
field has invented a cross-vendor capability ordering because it needed one to *price*, and has not
yet exposed one because it needed one to *analyse*. Whether those are the same ordering is an open
question the field has not addressed.

[E] Since 2026-06 there is also a **standards-track** counter-example for family: the FOCUS 1.5
working draft adds `ModelFamily` — "Grouping of related models as defined by the model developer" —
alongside `ModelDeveloper`, `ModelId` and `ModelVersion`, as FOCUS-defined `SkuPriceDetails`
properties. It simultaneously declines the cross-vendor problem, noting that `ModelId` "is not
guaranteed to match across service providers." [R] The honest current state, then: **family is being
standardised; tier is not, and the body standardising family has explicitly flagged cross-provider
identity as unresolved.**

### 3.4 Who sees whose data

[E] Mapped onto `CONTEXT.md`'s subject-scope vocabulary purely as a descriptive convenience:

| Scope | Where it ships in the field |
|---|---|
| `self` | **Devin Personal Analytics** (permission-gated, off by default: "users only ever see their own consumption, not anyone else's"); **DX Personal dashboard**; **Anthropic individual member usage** (Enterprise usage-based plans, admin-toggled, default On since 2026-07-11); **Augment "My Usage"** for non-admins; **Windsurf/Devin Desktop** individual "completion stats… language breakdown, and unlock achievement badges"; Cursor members "Can see their own usage and remaining included usage"; Codex `chatgpt.com/codex/settings/usage`; Amp `amp usage` |
| `peer` (named individuals in own team) | **Amp** — "Threads are visible to the whole workspace by default"; **Cursor Usage Leaderboard** *if* non-admins can see it (the two first-party pages disagree) |
| `team` (own team, aggregated) | Windsurf/Devin Desktop custom roles with *analytics-view* let "team managers and leads see metrics for their own teams"; GitHub `user-teams-1-day` (≥5 seats); Anthropic `group_by[]=rbac_group_id` |
| `peer-team` (other teams, aggregated only) | **Not found as a distinct grant anywhere in the survey.** Admins see all teams named; non-admins generally see none |
| `org` (aggregated) | Google Cloud Monitoring for Code Assist (aggregate by default); OpenAI ChatGPT workspace analytics (aggregate-only, power users as a top-20% *cohort* rather than a list); Amazon Q dashboard; Kiro dashboard |
| `org-member` (named individuals org-wide) | the default admin grant nearly everywhere: Anthropic, GitHub, Cursor, Zencoder, Augment, Tabnine, JetBrains, Warp, Kiro, Amazon Q, Google (once logging is on), Factory, Devin, Amp, Replit, Lovable |

[R] Two structural observations.

- **The field has essentially two roles: admin and everyone else.** `peer-team` — other teams'
  totals without names — does not exist as a shipped grant in anything surveyed. The nearest thing
  is the cross-*organisation* benchmarking sold by class C (F16).
- **`self` is the fastest-growing grant, and it is uniformly opt-in.** Devin's is off by default and
  requires a named "View Personal Analytics" permission; Anthropic's is an admin toggle; Augment's
  and Cursor's are entitlements of the plan. [R] The pattern suggests vendors treat self-visibility
  as something an employer grants rather than something a developer possesses.

### 3.5 Where the field ranks named engineers — recorded in full

[E] This section records fact. It takes no position, and it does not bear on
`docs/adr/0001-peer-visibility-excludes-cost.md`, which is a settled decision in this repo and is
not reopened here.

**Ranked, by default, in the product UI:**

| Product | Surface | Ranked by | Identity shown |
|---|---|---|---|
| **Anthropic Claude Code** (Team/Enterprise) | Leaderboard on the analytics dashboard | contribution volume — toggle **Pull requests** (PRs with CC vs all) / **Lines of code** (lines with CC vs all); top 10 | named user; "Export all users" CSV covers everyone, "not just the top 10 displayed" |
| **Anthropic claude.ai** analytics | "Top members by chat volume"; artifacts top-10 users | message / artifact volume | named |
| **OpenAI Codex** analytics dashboard | User ranking table | **credits, threads, turns, text tokens, current streak** | named; email optional in export |
| **Cursor** | Usage Leaderboard | Chats, Tab Completions, Agent Lines of Code; "The top ten users and any filtered users are always shown" | email, user_id, profile picture |
| **Cline Enterprise** | "TOP SPENDING USERS" panel on the org overview | 30-day dollar spend, descending | full name + email address |
| **Devin** | Usage policies → Members | "ordered by **utilization** so at-risk members surface first"; blocked members highlighted | named; drill-in shows the member's **efficiency score** (Healthy / Satisfactory / Needs improvement / Unknown) |
| **GitHub** | Access management seat list | "you can use the Sort options to sort the list of users by when they last used GitHub Copilot" — on by default, no configuration | `login` |
| **JetBrains** Central Console | "Users almost out of AI Credits" (≥80% consumed); credit table "broken down by user", sortable by column click | credit consumption | name, email, date |
| **Google Workspace** | Admin console → Generative AI → Gemini reports → **User-level usage** (launched 2026-02-16, all customers, no configuration) | **Overall usage level** bucket — "High" is defined as "only the **top 10% of users** with non-zero overall Gemini usage that have used it 20 times or more"; plus Days at limit, Active days | named employee |
| **Google Gemini Code Assist** | License management page | "To sort the list, select the heading of the column that you want to sort by" — including "**Date and time the license was last used**" | Name, Email |
| **Google Gemini Enterprise** | App Analytics → **User Level** tab | "the user IDs (email address or unique identifier) of users in the organization and their interactions with…agents" | named — but **"You must be on an allowlist to see data on the User Level tab"**, and the allowlist is granted by "your account team or the sales team" |

**Ranked by API default, without any UI:**

| Endpoint | Default sort | Identity |
|---|---|---|
| Anthropic `GET /v1/organizations/analytics/user_cost_report` | `order_by=amount`, `order=desc` — **engineers ranked by dollar spend is the default response** | `AnalyticsUserActor { user_id, email, name }` |
| Anthropic `GET /v1/organizations/analytics/user_usage_report` | `order_by=total_tokens`, `order=desc`. Documented purpose: "Use this to see which users consume the most tokens." | same |
| Cursor `GET /analytics/team/leaderboard` | "User rankings by lines accepted/suggested" | email, user_id, profile_picture_url |
| Cursor `POST /teams/spend` | server-side `sortBy` ∈ `amount` \| `date` \| `user` | userId, name, email |
| OpenAI Codex Analytics `/workspaces/{id}/usage` | "Omit `group` to return **per-user rows**. Set `group=workspace` to return workspace-wide rows" — per-user is the default shape | user |

**Sortable per-user tables where a default sort is not published:** Factory ("Search by email, sort by
any column"), Augment ("Sorting by any column", ~20 columns including Accept Rate), Tabnine, Lovable
("search and sort members by build credit usage"), Warp (API only), Replit ("spending by member and
app"), Zencoder (searchable, sort not documented).

**Ranking shipped by the vendor as reference code:** [E] AWS publishes
`aws-samples/sample-kiro-user-analytics-dashboard` — S3 → Glue → Athena → Streamlit, Terraform-
deployed — containing a **"Top 10 Users — leaderboard by messages"** panel. Google publishes the SQL:
its Code Assist metrics page ships sample queries titled "Individual user requests per day" and
"User-level breakdown of daily usage", keyed on `labels.user_id`. AWS's own DevOps blog (2025-05-23)
names the third of its three framing questions as **"Who are our power users?"** and states "The User
Activity Reporting provides detailed metrics on user interactions, allowing administrators to
identify top users, patterns, and potential enablement sessions."

**Ranking as a public, cross-organisation, gamified artefact:** [E] `viberank.app` describes itself
as "a community leaderboard for AI coding usage": individual developers submit local usage logs via
`npx viberank-cli` reading `ccusage` data across Claude Code, Codex, Gemini CLI and Copilot, and are
ranked publicly by **API spend**, with named spend tiers — Spark ($0+), Ember ($100+), Flame ($1K+),
Blaze ($5K+), Inferno ($15K+), Supernova ($50K+). At time of reading: 1.2K developers, $12.5M total
tracked spend, 14.2T tokens, top individual at $281.0K. [R] Nobody built this because an employer
asked for it. It is evidence that spend-ranking has cultural traction among developers themselves,
independent of any vendor's dashboard — which complicates the assumption that per-engineer spend
visibility is purely a management imposition.

**The stated purposes vendors give for ranking:** [E] Anthropic — "The Leaderboard helps you find
team members with high Claude Code adoption who can: Share prompting techniques and workflows with
the team; Provide feedback on what's working well; Help onboard new users." Factory — "This enables
platform teams to identify power users…". AWS — "identify top users, patterns, and potential
enablement sessions." Zencoder analytics best practices — "Reallocate seats — move unused seats to
active teams based on actual usage." Devin — the Members ordering exists "before approving a request
or adjusting a limit." [R] Every published justification is *enablement, seat economics, or budget
adjudication*. None is performance evaluation. Whether the data is used that way is outside what
documentation can evidence.

**Where the counter-position is published:** [E] Swarmia — "If a platform emphasizes individual
developer rankings or comparisons, that's a red flag" (2025-07-17) and "Stack ranking doesn't deliver
what it promises. Instead of objectivity, you get gaming" (2025-09-26). DX — "It is critical that
this metric is never used at the individual level or tied to performance evaluations" (2024-12-10).
Jellyfish — "Using engineering metrics to evaluate an individual's 'performance' or 'productivity'
without qualitative context can be incredibly harmful." DORA — "Software delivery performance is not
an individual measure; it measures your ability to change and update an application, and this can
only be done by teams." OpenAI, on the Compliance API — "It's not a productivity dashboard. Don't
use it to infer code quality or individual performance." GitHub — its metric-interpretation guidance
warns the adoption multiplier is not a "standalone measure of productivity" and that cross-team
comparisons "may reflect differences in team composition rather than adoption depth", but contains
**no explicit prohibition on ranking individuals**. AWS's power-user blog contains no caution at all.

**Legal context, for completeness:** [E?] In Germany, §87(1)(6) BetrVG gives works councils
co-determination rights over technical systems "intended to monitor employee behaviour or
performance", and AI systems used for performance monitoring are classed high-risk under the EU AI
Act. Factory AI's `telemetry.granularity: aggregate` switch cites exactly this — jurisdictions or
works-council agreements that forbid per-individual analytics. *(Legal characterisation here is from
secondary practitioner sources, not primary statute; treat as directional.)*

---

## 4. Axis 3 — Operations, units and reports

### 4.1 What the operational unit actually is, per product

[R] "Operational unit" here means the thing the vendor's business process is denominated in — what
gets counted, capped, alerted on and invoiced. It is not always the thing analytics reports on, and
the mismatch is itself informative.

| Product | Metering unit | Analytics unit | Mismatch? |
|---|---|---|---|
| Anthropic Claude Code | tokens (4–5 classes) → USD | **user-day**; session count is a metric, not the row | yes — cost is per token, the report row is a user-day |
| OpenAI Codex | credits → tokens | **user** (default), thread, turn | partial |
| GitHub Copilot | AI Credits (1 = $0.01) since 2026-06-01 | **user-day**, plus repo-day | yes |
| Cursor | tokens + Cursor Token Rate | user-day (analytics) / **usage event** (`filtered-usage-events`) / user-cycle (spend) | three different grains in three APIs |
| Zencoder | credits, model-multiplied | **user over a 7/30/90-day window** | yes — credits live in Quota Management, activity in Analytics; no join documented |
| Devin | ACU | **session** (Session Insights), user-cycle (Consumption Analytics) | aligned at session level |
| Amp | USD at provider cost | **thread**, member | aligned |
| Google Code Assist | seat + request quotas | aggregate org (Monitoring) / **user** (Logging, opt-in) | yes — the two live in different products |
| Google Workspace Gemini | seat + feature caps | **user over 28 days** | aligned |
| Kiro | credits (fractional, 0.01 increments) | **user-day** | aligned |
| Amazon Q Developer | seat + agentic request allowance | aggregate (dashboard) / **user-day** (activity report) | yes |
| Jules | tasks per rolling 24h | **none** | n/a — no org analytics exists |
| Replit | effort per checkpoint | member, app | partial |
| Factory | Factory Standard Credits + Droid Computer hours | **user** | aligned |

[R] The recurring mismatch is worth naming: **most products meter continuously and report
discretely.** Cost accrues per token or per second; the report row is a person and a day. Everything
between — the session, the task, the attempt — is either synthesised (Anthropic's `num_sessions`),
made primary by an unusual design choice (Devin, Amp), or lost.

### 4.2 The reporting artefacts, and what business process each serves

[E] Mapped to the process the vendor's own documentation says it feeds:

| Artefact | Vendors | Business process the vendor names |
|---|---|---|
| Adoption time series | universal | rollout tracking; "Dips in usage that may indicate friction or issues" (Anthropic); "Track onboarding success by monitoring new user adoption rates after training sessions" (Zencoder) |
| Per-user table + CSV | near-universal | seat reallocation — "Reallocate seats — move unused seats to active teams based on actual usage" (Zencoder); "Compliance and audit requirements" (Zencoder); "export usage reports for internal accounting" (Replit); "query them with Amazon Athena, visualize trends in Amazon QuickSight" (Kiro) |
| Leaderboard / percentile bucket | Anthropic, OpenAI, Cursor, Cline, Google Workspace, JetBrains, AWS sample | enablement — "find team members with high Claude Code adoption who can… Help onboard new users" (Anthropic); "Identify users with low adoption rates who might benefit from training" (Google) |
| ROI / value calculator | Anthropic ("Value" tab: productivity lift, cost per commit / per PR / per session, formulas "shown inline and adjustable"), Google Gemini Enterprise ("Each query is estimated to save three minutes… you enter an Employee Hourly Rate"), DX (time saved → net time gain → agent hourly rate) | budget justification — "Contribution metrics help answer 'Is this tool worth the investment?'" (Anthropic) |
| Budget / quota console | Devin, Zencoder, Cursor, Anthropic, Augment, JetBrains, GitHub, Replit, Lovable, Kiro | spend control and adjudication |
| Per-session record | Devin Session Insights, Amp threads, Cursor usage events | efficiency coaching and debugging |
| Audit / compliance log | Anthropic OTel events ("OpenTelemetry events are the audit data source for Claude Code activity"), OpenAI Compliance API (30-day retention), Google prompt/response logs, Amazon and Kiro prompt logging, Cursor audit logs | security, legal, e-discovery — explicitly **not** productivity: "It's not a productivity dashboard. Don't use it to infer code quality or individual performance" (OpenAI) |
| Cross-org benchmark report | DX (435 companies / 135k devs), LinearB (8.1M PRs / 4,800 teams), Jellyfish, GitClear (623M changes), Faros (22k devs / 4k teams) | positioning your org against the market |

[E] **Scheduled delivery is rare.** Tabnine is the only product in the survey found to ship
**email-scheduled reports**. Devin ships a **daily digest** — but only of pending budget-increase
requests, not of metrics. [R] Everything else is pull, not push: the admin has to go and look.

### 4.3 Alerts, thresholds, digests and enforcement

[E] The complete inventory of what fires, across the whole survey:

| Vendor | Trigger | Channel | Enforcement |
|---|---|---|---|
| **Anthropic** | org spend at 75% / 90%; per-user spend at 75% / 95% (2026-07-02) | in-app | spend limits at org, group **and individual member** level; seat allowance with 5-hour and weekly windows |
| **GitHub** | budget at 75% / 90% / 100%; scopes include enterprise, org, cost center, repo **and user** | UI + email, "to account owners and billing managers, and you can add additional recipients" | stop-on-limit; **$0 user budget blocks a named developer immediately** |
| **Devin** | ~⅔ of allocation → notification; approaching → persistent banners; blocked → immediate admin notification; proactive requests → **daily digest** | in-app + email | per-user monthly ACU cap; hard block on all surfaces; org-level cap stops all activity |
| **Cursor** | configurable spend alerts at individual and team level (2025-12-04); Slack or email (June 2026) | email / Slack | team spend limit cuts off all on-demand AI; per-member limits (Enterprise); Dynamic Spend Limits scale with team size |
| **Augment** | "Alert notifications triggered at configurable threshold percentages" | — | org-wide, default per-user, and individual budget overrides; enforcement toggle pauses access |
| **JetBrains** | ≥80% → "Users almost out of AI Credits" view naming individuals; table of users who hit their limit | console view | credit quota |
| **Warp** | as usage approaches each configured cap | admin alert | per-user monthly spend cap |
| **OpenAI** | `spend_alerts` — integer cents threshold, **`interval` = `month` only**, currency USD only, email recipients + subject prefix; org and project scope | email | `spend_limit` at org and project |
| **Google (Gemini Enterprise dev tools)** | per-chart **"Create alert policy"** opening Cloud Monitoring pre-populated with the chart's query | Cloud Monitoring | rolling 7-day shared credit pool |
| **Google (Code Assist)** | generic Cloud Monitoring alerting on aggregate metrics | — | request quotas per user per day |
| **Google (Workspace licences)** | — | — | **automatic licence unassignment** after an admin-set inactivity period, "on day T+1" |
| **Amazon Q Developer** | CloudWatch alarms on aggregate `AWS/Q` metrics only | CloudWatch | seat |
| **Kiro** | **none** | — | hard overage cap per *profile* (account-wide, not per developer) |
| **Zencoder** | warning when per-user caps don't sum to 100% of the pool | in-app | per-user quota cap as a **percentage of the org's total credits** |
| **Replit** | **none documented** | — | individual usage limits; org budgets in $500 increments; suspension on overrun |
| **Anthropic (recommended, not shipped)** | Anthropic's OTel doc recommends alerting on "Cost spikes; Unusual token consumption; **High session volume from specific users**" | your own backend | — |

[R] Four things follow.

1. **Not one alert in the field fires on an outcome.** No vendor alerts on a rising failure rate, a
   collapsing success rate, a rework spike, or a quality regression. The trigger is always money or
   quota.
2. **Enforcement is increasingly individual.** GitHub's $0 user budget, Devin's per-user ACU cap,
   Anthropic's per-member spend limit, Zencoder's per-user quota percentage, Cursor's per-user limit,
   Augment's individual override, Google's automatic licence reclaim. [R] The per-engineer record is
   not decorative; it is wired to a control.
3. **Devin is the only vendor that gates the control on a computed judgement about the person.** Its
   "Approve based on efficiency" policy auto-approves budget increases "only while the member's
   efficiency score is **Healthy** or **Satisfactory**". Efficiency scores are Healthy / Satisfactory
   / Needs improvement / Unknown, visible to the member on their own My-analytics page and to the
   admin in the approval queue. [R] This is the closest thing in the field to an automated,
   vendor-computed performance judgement wired to a resource grant.
4. **Anthropic's suggested alert on "high session volume from specific users" and OpenAI's refusal
   to alert on anything but monthly spend are the two poles.** [R] Both are documented positions, not
   accidents.

### 4.4 Estimated versus billed

[E] Every product surveyed that reports money labels it estimated, and several are unusually blunt:

- Anthropic Console: "Spend figures in the Console dashboard are estimates for analytics purposes.
  For actual costs, refer to your billing page."
- Anthropic OTel: "Cost metrics are approximations. For official billing data, refer to your API
  provider."
- Anthropic Agent SDK: "The `total_cost_usd` and `costUSD` fields are client-side estimates, not
  authoritative billing data… **Do not bill end users or trigger financial decisions from these
  fields.**"
- Anthropic Enterprise cost report: values "can be revised for up to 30 days… For invoicing-grade
  totals, query dates at least 30 days in the past."
- OpenAI: "Usage reports and dollar estimates are planning or monitoring tools, not issued invoices."
- GitHub: `ai_credits_used` is "for consumption analysis, not invoicing."
- Cursor: analytics carries no spend at all; `chargedCents` lives in a separate billing-facing API.

[E] Anthropic also documents four historical **billing-accuracy defects** in its own client
telemetry: pre-v2.1.214 multi-frame streams inflated cost and token counters "by roughly one extra
full request per extra frame"; pre-v2.1.222 MCP attribution credited every subsequent request to the
last MCP server called; pre-v2.1.239 the 1.1× data-residency multiplier was not applied "so the
session cost figure was lower than the bill"; pre-v2.1.211 `/usage` session totals accumulated across
`/clear`. [R] This is the most concrete evidence available that client-side cost estimation is hard
enough to get wrong repeatedly, by the vendor that owns both ends of the pipe.

[E] Two vendors offer a reconciliation mechanism rather than just a disclaimer: Anthropic's
`modelPricing` managed setting lets an org inject its contracted multipliers and per-model overrides
so that client-reported figures "show at your organization's configured rates"; Cursor's usage-events
API returns both an estimated `tokenUsage.totalCents` and an actual `chargedCents` plus
`discountPercentOff` on the same row.

---

## 5. Axis 4 — The signals the field positions as actionable

### 5.1 The inference, restated

[R] Nothing below is a vendor saying "this is our most actionable metric." Each row is inferred from
prominence plus marketed purpose, per the method in the preamble, and each is tagged with the
strength of the inference. **This section is a map of vendor belief.** Section 8 is a map of the
evidence. They are different maps.

### 5.2 The actionability categories the field actually uses

[R] Six categories emerge from the marketed purposes, not from any taxonomy imposed on them:

| Category | What it means | How you recognise it |
|---|---|---|
| **CC — cost control** | reduce or cap spend | budgets, caps, spend alerts, spend leaderboards, model-routing nudges |
| **SE — seat economics** | right-size licences | active vs assigned seats, idle seats, last-activity, automatic reclaim |
| **AD — adoption / enablement** | get more people using it, better | DAU/WAU/MAU, adoption phases and cohorts, power-user identification, low-adopter identification |
| **EF — efficiency coaching** | same outcome, less consumption | Devin Coach, efficiency scores, session-size health, prompt-quality nudges, model-tier downgrades |
| **RJ — ROI justification** | defend or grow the budget upward | value calculators, cost per commit/PR/session, estimated time saved, contribution attribution |
| **PR — per-engineer ranking** | compare named people | leaderboards, percentile buckets, sortable per-user tables |

[R] Note what is missing from the list the field itself generates: there is no **quality**,
**reliability** or **risk** category, because almost nothing in class A or B is marketed as a signal
to act on for those reasons. That absence is a finding, not an oversight in this taxonomy.

### 5.3 Per-vendor: the signal each product puts in front of you

[E] evidence = the prominence and purpose facts already cited. [R] the actionability category and
strength are this brief's inference.

| Product | Signal placed most prominently | Marketed purpose (verbatim or near) | Inferred category | Inference strength |
|---|---|---|---|---|
| **Anthropic Claude Code** | Lines of code accepted; suggestion accept rate; PRs with CC (%) — the five summary cards, then the leaderboard | "demonstrate ROI, identify adoption patterns, and find team members who can help others get started"; "Is this tool worth the investment?" | **RJ**, then **AD**, then **PR** | strong — the ROI framing is explicit and repeated |
| **Anthropic Enterprise analytics** | `user_cost_report` ranked by spend descending by default; "spend concentration"; per-user spend limits with 75/95% notices | "Use this to see which users consume the most tokens"; "These controls give admins the visibility to understand how Claude is being used and the tools to manage costs" | **CC** + **PR** | strong — default sort order is the tell |
| **OpenAI Codex** | Active users by surface; credits and tokens by surface/model; user ranking table with **streak**; Code Review throughput and reaction sentiment | "visibility into adoption and impact"; "Adoption reporting for leadership updates; Usage governance and cost monitoring" | **AD** + **CC**, with **PR** retained and output-volume explicitly rejected | strong — the rejection list is documented |
| **GitHub Copilot** | Adoption phase cohorts and the "adoption multiplier"; PR throughput and time-to-merge; seat list sorted by last-used | "measure engagement, identify opportunities to increase value, and assess how AI-assisted workflows influence pull request throughput and time to merge"; "**You can't move a curve you can't see**" | **AD** (phase progression) + **SE** + **CC** (user budgets) | strong |
| **Google Workspace Gemini** | Overall usage level bucket (top-10% "High" → "Zero"); Days at limit with an Upgrade-users action | "Identify power users…"; "Identify users with low adoption rates who might benefit from training" | **AD** + **PR** + upsell | very strong — the action button is in the table |
| **Google Code Assist** | Aggregate DAU/28-day actives, suggestions and acceptance on a zero-config dashboard | aggregated usage visibility; per-user acceptance rate documented as an intended calculation once logging is on | **AD** | moderate — no explicit purpose statement |
| **Google Gemini Enterprise (dev tools)** | Active users, token consumption, API calls by `error_type`, with per-chart "Create alert policy" | "user adoption, token consumption, API calls, and tool execution" | **CC** + **AD** | moderate |
| **Amazon Q Developer** | Accepted lines of code by feature; acceptance rates per feature; active users | AWS blog: "Who are our power users?"; "identify top users, patterns, and potential enablement sessions" | **AD** + **PR** + **SE** (the companion "identify inactive users" playbook) | strong |
| **Kiro** | Credits consumed by tier and client type; subscriptions; per-user CSV with `User_Email` and overage columns | "Centralized billing, SSO, usage analytics" | **CC** + **SE** | strong |
| **Cursor** | AI Share of Committed Code; Agent Edits accepted; Usage Leaderboard; Repository Insights; Conversation Insights | "Usage analytics to understand team behavior" | **AD** + **PR**, with **CC** in the separate Admin API | moderate — the marketing line is thin, the surface is not |
| **Zencoder** | Active Users card + daily-active line chart, then the Member Activity table | "make informed decisions about resource allocation, identify adoption patterns, and optimize their team's development workflow"; best practices name **"Reallocate seats"** and **"Set baselines so anomalies are visible"** | **SE** + **AD** | strong — the best-practices list is unusually explicit |
| **Zencoder (manager dashboard)** | DORA four keys, PR cycle time by stage, investment allocation, deployment frequency — "Every metric is team-level" | "The $100K analytics stack you don't need" | **RJ** at team level, deliberately **not PR** | strong |
| **Devin** | ACU consumption ordered by utilization; efficiency score; session size health; Coach suggestion acceptance rate | "helps your team get more out of every ACU by coaching users directly where they work" | **EF** + **CC** | very strong — Coach exists solely for this |
| **Amp** | Per-thread `$`; workspace credit usage by member; shared threads | "One bill"; "Explain Usage" | **CC**, with radical **AD** via thread transparency | moderate |
| **Augment** | Accept Rate and LOC-by-source per user; org usage dashboard with budgets and threshold alerts | "how Augment Code is being used across your team"; build dashboards "with tools like Jellyfish" | **CC** + **AD** | moderate |
| **Tabnine** | Automation Factor / Productivity Factor per user; licence utilisation; scheduled email reports | "a user-level breakdown of Tabnine adoption and activity" | **SE** + **PR** | moderate |
| **JetBrains** | Credit consumption per user; "Users almost out of AI Credits" at ≥80%; AI code acceptance rate | — | **CC** + **SE** | moderate |
| **Factory** | Tokens, tools, activity, productivity, users — five views; sort by any column | "identify power users" | **AD** + **PR**, with an explicit aggregate opt-out | strong |
| **DX** | AI-assisted PR %, time saved, then Core 4 longitudinally; net time gain; **agent hourly rate** | detect "high time savings but flat throughput"; rising change-failure rate → "refocus from velocity to validation" | **RJ**, deliberately excluding acceptance rate and LOC | very strong — the exclusions are published |
| **LinearB** | AI adoption rate, suggestion acceptance, then PR Rework / PR Maturity / Checkup Time | "measure developer impact" | **RJ** + quality | strong |
| **Swarmia** | Enabled vs weekly-active gap (idle seats); AI-assisted PR cycle time and batch size; cost per initiative | "See exactly what your AI investment is buying you" | **SE** + **RJ** | strong |
| **Faros** | Cost per task; **cost per verified outcome**; retry-loop token waste; model-route efficiency | "**Stop token maxxing. Start outcome maxxing.**" | **CC** reframed as **EF** at the outcome level | very strong |
| **Jellyfish** | AI spend and token usage; adoption by tool and team; agent-generated PR volume | "measure AI progress, adapt quickly, and deliver lasting business impact" | **RJ** | strong |

### 5.4 What the field collectively believes is actionable

[R] Aggregating the table:

1. **Adoption is the most universally-shipped actionable signal.** Every class-A and class-B product
   leads with it. The implied theory of action is: adoption is low → run enablement → adoption rises.
2. **Seat economics is the most operationally concrete.** Idle seat → reclaim it. Google automates
   the reclaim. Zencoder, Swarmia and AWS all name it explicitly. [R] It is also the only signal in
   the field with an unambiguous, immediately verifiable action attached.
3. **Cost control is the fastest-growing and the only one with enforcement wired to it.**
4. **Efficiency coaching is the newest category and has exactly one mature implementation** (Devin
   Coach + efficiency scores + efficiency-gated approvals). [R] It is the only place in the field
   where a signal is fed back to the individual *before* the spend happens rather than reported after.
5. **ROI justification is what gets sold to the buyer, and it is the weakest-evidenced.** Anthropic's
   Value tab, Google's three-minutes-per-query estimate with an operator-supplied hourly rate, and
   DX's self-reported time saved are all calculators over assumptions the operator supplies.
6. **Per-engineer ranking is ubiquitous but almost never justified on performance grounds** — every
   published purpose is enablement, seat economics or budget adjudication (§3.5).

---

## 6. Vendor survey

[R] Compact rows. Facts already established in §2–§5 are not repeated; this section adds what is
distinctive about each product and closes the survey's coverage.

### 6.1 Cloud / async agent execution platforms

**Anthropic — Claude Code.** [E] Two separate analytics products with different data: the
claude.ai Team/Enterprise dashboard (leaderboard, GitHub-integrated contribution metrics, spend
report CSV with `Model family`) and the Console dashboard for API customers (usage + spend + team
insights, no contribution metrics). Contribution metrics are public beta, require the Claude GitHub
app, and are unavailable to Zero-Data-Retention orgs. PR attribution is unusually well documented: a
21-days-before to 2-days-after matching window, normalisation (trim, collapse spaces, standardise
quotes, lowercase), exclusion of lock files, generated code, build directories, test fixtures and
lines over 1,000 characters, and a rule that "Code substantially rewritten by developers, with more
than 20% difference, is not attributed to Claude Code". Merged PRs get a `claude-code-assisted`
GitHub label — making GitHub search an alternate query path. The self-assessment is explicit: "These
metrics are deliberately conservative and represent an underestimate." Anthropic's own published
benchmark: "around $13 per developer per active day and $150-250 per developer per month, with costs
remaining below $30 per active day for 90% of users." Claude Code on the web is separated in
reporting by an `is_remote` boolean and carries "no separate compute charge for the cloud VM." Rate
limits: weekly limits introduced 2025-08-28 (announced 2025-07-28, "less than 5% of subscribers"),
five-hour limits doubled 2026-05-06, a temporary +50% weekly promotion mid-2026, then a permanent
+25%-over-baseline setting from 2026-09-14 — a ~17% reduction from the elevated level. *(the
post-2025 rate-limit sequence is from secondary press, not Anthropic support pages)*

**OpenAI — Codex.** [E] Four deliberately separated surfaces with a published routing table:
ChatGPT workspace analytics (aggregate-only; power users as a top-20% *cohort*, not a list; "Task
Insights is designed for aggregate analysis only and does not expose individual prompts or
conversations"), the Codex analytics dashboard (per-user, ranked, streak column, up to 12h lag),
the Codex Analytics API (`api.chatgpt.com/v1/analytics/codex`, scope
`codex.enterprise.analytics.read`, day/week buckets, 90-day lookback, per-user rows by default), and
the Compliance API (raw records, 30-day retention, explicitly not a productivity tool). Code Review
is a first-class analytics object: PRs reviewed, comments by **P0/P1/P2**, replies, reactions split
positive/negative/other. [R] Making *reaction sentiment on review comments* the impact metric,
instead of authored volume, is the single most distinctive metric design in the survey.

**GitHub — Copilot coding agent (now "cloud agent").** [E] Dual-metered: "uses GitHub Actions
minutes and AI credits". From 2026-06-01 Copilot code review also consumes Actions minutes on
private repos. Under the legacy premium-request model a cloud-agent session cost one premium
request, with the design note that "only the prompts you send count as premium requests; actions
Copilot takes autonomously to complete your task, such as tool calls, do not". Analytics: enterprise
admins and org owners can "analyze pull request outcomes for pull requests created by Copilot cloud
agent" — PR counts, merge rates, time to merge. The org/enterprise reports carry a `pull_requests`
object with `total_created`, `total_merged`, `median_minutes_to_merge`, `total_created_by_copilot`
and `median_minutes_to_merge_copilot_authored`. [R] That last pair — median time-to-merge split by
whether Copilot authored the PR — is one of the very few shipped signals anywhere in class A that
compares agent output against a human baseline on an outcome rather than on volume.

**Google — Jules.** [E] Meters in tasks (15/100/300 daily, 3/15/60 concurrent). Beta allowed "60
tasks per day, 5 concurrent"; on exit from beta on 2025-08-06 the free tier dropped to 15/3, a 4×
cut. Paid plans are available "only for individual Google Accounts (ending in @gmail.com)". **There
is no admin, teams, enterprise, analytics or reporting page in the documentation.** [R] A major
vendor's cloud coding agent with zero org observability is a useful reference point for how optional
the whole analytics layer still is. Its one identity feature runs the other way: Commit Authoring
(2026-02-19) can attribute changes to Jules, to a co-author, or entirely to the user — the last of
which *reduces* downstream attributability.

**Google — Antigravity.** [E] Quota is deliberately opaque: "the rate limits are correlated with the
amount of work done by the agent, which can differ from prompt to prompt." Overage is dollar-
denominated AI credits with a binary Never/Always auto-spend setting. Org analytics route through
Gemini Enterprise "Developer tools metrics" (Preview): default view is "Last 1 day with automatic
live refreshing enabled", 5–15 minute latency, H/D/W/M active users, total tokens, daily token usage,
daily API calls broken out by `error_type`, daily tool calls and daily tool calls accepted — except
"The Daily Tool Calls and Daily Tool Calls Accepted metrics don't display data", so **there is
currently no working acceptance-rate metric for Antigravity**. Credits are "$10 credit per user per
month" (Standard) or $15 (Plus), "enforced on a rolling seven-day basis as a **shared pool**". [E?]
`antigravity.google/docs/plans` says "There is currently no support for: … Organizational tiers via
contract" while `antigravity.google/pricing` advertises "New! Organization plan via Google Cloud"; one
page is stale and the contradiction is unresolved. Prompt/response logs for Antigravity carry **no
user column**, unlike Code Assist's.

**Devin / Cognition.** [E] Covered extensively above. Additional distinctives: session size
thresholds (XS ≤2 ACU / ≤2 messages through XL >20 / >20, scaled 10× on enterprise), with L and XL
"flagged as unhealthy, meaning Devin likely encountered significant issues or the task scope was too
broad for a single session"; an **Issues Detected** list per session with label, impact rating and
description; a **blockers** view listing "issues Devin reported hitting at runtime in the last 30
days, such as missing permissions, blocked network access, or broken environments", grouped so "you
can see what a single fix would unblock", each linking back to the session. Usage tiers resolve
explicit assignment → highest-priority IdP group → default tier, with a guided setup that "analyzes
your last three billing cycles of per-member usage" and simulates who would be over their limit
before applying. Windows sessions consume ~9% more than Linux. Devin Review usage is excluded from
per-user limits. [E] Windsurf is now Devin Desktop — `docs.windsurf.com/*` 307-redirects into
`docs.devin.ai/desktop/*` and the ACU consumption API breaks out `acus_by_product` as `devin`,
`cascade`, `terminal`, `review`.

**Zencoder.** [E] Zenflow orchestrates third-party agents — Claude Code, Codex and Gemini each "runs
inside isolated Git worktrees and benefits from Zencoder's context engine, multi-repo search, and
skills" — under saved presets and default-agent settings. [R] That makes Zencoder's agent-selection
concept a close structural analogue to `CONTEXT.md`'s AgentTemplate, and its credit multiplier a
close analogue of the tier roll-up; neither, however, appears as an analytics dimension in the
Analytics dashboard, which stops at Agent Messages, IDEs and Languages. [E] Quota Management is the
cost surface: monthly plan credits with a refill date, extra credits balance, seats used, and a
per-user table of Status / **Quota cap (percentage of total credits, editable)** / Credits left, with
a warning and a "Distribute evenly" button when caps don't sum to 100%. Roles are Member / Manager /
Admin, where Manager can "Manage users and quotas" but not billing or SSO. [E?] Zencoder's own
pricing page and docs page disagree on the plan gate for Analytics (Pro Plus vs "Core or higher").

**Amp.** [E] Structurally the most transparent workspace model in the survey: threads shared with
the whole workspace by default, `@`-mention to pair on a live orb, agent-to-agent messaging, admins
able to "see members' private threads", pooled credits, and per-thread pricing at provider cost with
no markup for non-enterprise. Enterprise usage is 50% more expensive and adds per-user cost controls,
thread-visibility controls, and "User groups for cost attribution and per-group thread visibility
options (on request)". Amp Inc. separated from Sourcegraph on 2025-12-02; Cody Free/Pro/Enterprise
Starter were deprecated 2025-07-23 with signups closed 2025-06-25. [E?] `ampcode.com/leaderboard`
exists as a route but is auth-gated, and the word does not appear in current docs — whether Amp ships
a leaderboard, and on what metric, is unconfirmed.

**Factory, Cline, OpenHands, Replit, Roo/Roomote.** [E] Factory meters in Factory Standard Credits
"computed from raw input and raw output tokens with cache discounts" plus Droid Computer hours over
rolling 5h/7d/30d windows, ships five analytics views plus OTel export to Datadog/Grafana/New
Relic/Splunk, and is the survey's only vendor with a documented identity-stripping mode. Cline is
BYOK-or-credits with an enterprise dashboard whose marketing screenshot shows the "TOP SPENDING
USERS" panel. OpenHands bills dollars at cost with no markup and states "Every token is tied to a
user, session, repo, and workflow. Set budgets by project" — the only vendor in the survey to name
*repo* and *workflow* as first-class cost-attribution keys. Replit's effort-based pricing (2025-06-18)
ties cost to "the true scope of the Agent's work", with checkpoints as the visible unit and an
Enterprise-only analytics dashboard showing "spending breakdowns by member, team, or app". Roo's
Roomote exposes task volume, token consumption, inference cost and cloud duration with user as a
group-by, and no LOC or acceptance metric at all.

### 6.2 IDE-resident assistants with org analytics

[E] Cursor, Augment, Tabnine, JetBrains, Warp, Windsurf/Devin Desktop, Qodo, Amazon Q, Kiro and
Gemini Code Assist are covered in §3.1, §3.5, §4.3 and §5.3. Additions:

- **Cursor** — Conversation Insights is an Enterprise default that classifies conversations by
  "intents, complexity, categories, guidance levels, work types"; Bugbot review analytics is the one
  Cursor analytics endpoint that carries `cost_cents`; billing groups provide chargeback grouping
  with directory-sync attachment; a documented bug omits removed members from `daily-usage-data`
  while `filtered-usage-events` still returns them. Pricing history: request-based → token-based
  2025-06-16, Ultra launched 2025-06-17, apology and refunds 2025-07-04, per-user on-demand spend
  limits phased out 2025-12-05 in favour of alerts, Teams repriced 2026-06-01 with two separate
  usage pools (first-party vs third-party API) and Slack/email spend alerts.
- **Qodo** — the survey's cleanest non-attributing model: "No per-user or per-engineer provisioning",
  workspace-pooled credits at $0.012 each, usage-based rather than seat-based billing, and a
  workspace-aggregate analytics page showing plan, credits remaining, reviews this period and PRs
  reviewed.
- **Amazon Q Developer** — the clearest three-way split in the field, stated as such: "A dashboard
  shows you aggregate user activity metrics… User activity reports show you what individual users
  are up to… Prompt logs provide you with a record of all the prompts". User activity reports carry
  44 metrics per user per day, delivered as daily CSV to your S3 at 00:00 UTC. **The whole product is
  on a clock: new signups blocked 2026-05-15, end of support 2027-04-30**, with Kiro as the
  migration target.
- **Kiro** — reimplements the Q Developer stack almost line for line (the S3 bucket policy still
  grants `s3:PutObject` to `q.amazonaws.com` and the path segment is still `by_user_analytic`), adds
  `User_Email` as a documented standard CSV column, and on 2026-09-01 shipped **per-user OpenTelemetry
  export** — `kiro.daily.credits`, `.overage_credits`, `.messages`, `.conversations`,
  `.model_messages`, with `kiro.user.id` always present and `kiro.user.email` optional.

### 6.3 Engineering analytics platforms

[E] Covered in §5.3 and §8. Additions worth recording:

- **DX** publishes the field's most-cited measurement framework (AI Measurement Framework, 2025-07-09,
  Abi Noda and Laura Tacho, with contributors from GitHub, Sourcegraph and DORA) across Utilization /
  Impact / Cost, and **deliberately excludes acceptance rate and lines of code**. Tacho: "We did not
  include acceptance rate in our framework for good reason… acceptance rate is just such a tiny part
  of the story"; "Typing speed has never been the bottleneck in development." Distinctive metrics:
  **human-equivalent hours** completed by autonomous agents, **net time gain per developer** (savings
  minus spend), and **agent hourly rate** (HEH ÷ AI spend). Ships an org, group **and Personal**
  dashboard, and its AI code detection resolves "down to the commit, user, repo, and branch level" —
  individual metrics on by default, disableable.
- **LinearB** publishes the sharpest attack on the field's favourite adoption metric (§8) and ships
  **Checkup Time** — "the time from the first AI comment to the first human review comment" — a metric
  that only exists because review agents now comment before humans do.
- **Swarmia** separates "AI assistant enabled" from "Weekly active, avg." and markets the gap (idle
  seats), and traces AI coding tool spend to teams and initiatives (beta, 2026-08-05).
- **Faros** productionises **cost per verified outcome** and **retry-loop token waste**, and rebuts
  METR on the grounds that individual-task measurement is the wrong unit: "the critical question for
  organizations isn't whether AI helps developers complete isolated assignments faster."

### 6.4 FinOps and the LLM gateway / observability layer

#### 6.4.1 FinOps Foundation and FOCUS

[E] **The Framework.** FinOps was redefined in March 2026 as "an operational framework and cultural
practice which maximizes the business value of technology, enables timely data-driven decision
making, and creates financial accountability through collaboration between engineering, finance, and
business teams." The 2026 Framework update (published 2026-03-19) added **AI** as a Technology
Category alongside Public Cloud, SaaS, Data Center and Data Cloud Platforms. The FinOps-for-AI page
states: "FinOps for AI focuses on addressing the cost complexity, faster development cycle, spend
unpredictability, and the need for greater policy and governance", that "AI cost and usage is not
only new to many organizations, and very granular, but also tends to transcend technology category
boundaries", and that tokens are "one of the primary cost meters for AI usage" and "can be a
normalizing metric of usage". It explicitly notes that FOCUS addresses AI "through existing columns
rather than AI-specific additions, with ConsumedUnit and ConsumedQuantity tracking tokens and API
calls."

[E] **The KPIs the Foundation publishes** (FinOps for AI Overview WG asset, last updated
2026-02-17): `Cost Per Token = Total Cost / Number of Tokens Used`; `Cost Per Inference = Total
Inference Costs / Number of Inference Requests`; `Cost per API Call`; plus Resource Utilization
Efficiency and Training Cost Efficiency. Its recommended tagging dimensions are Project,
Environment, Workload, Team, CostCenter, UsageType, Purpose, Criticality. [R] **Individual
developers are not among them.**

[E] **Unit Economics** names "cost per token" among its resource-efficiency examples and describes a
progression toward "cost per assist, cost per agent action, or cost per case deflected". Maturity:
Crawl = resource-efficiency metrics only; Walk = business unit metrics emerging; Run = all Scopes
have defined unit metrics.

[E] **Showback vs chargeback**, quoted: "Chargeback sends expenses to a product or department P&L and
Showback shows the charges by product or department but keeps the expenses in a centralized
budget"; "**Showback reporting can be used at any granularity to show any group, large or small, the
costs of the scope it's responsible for**"; "Neither type of reporting should be considered more
mature than the other, and showback is always required in any FinOps practice, but chargeback is
dependent on organizational accounting policies." For AI specifically the guidance is to "Implement a
**showback model** to provide visibility into the costs incurred by different teams… enabling
stakeholders to see the financial impact of their AI usage without immediately charging them."

[E] **FOCUS versions.** 1.0 Jun 2024; 1.1 Nov 2024 (`SkuMeter`, `SkuPriceDetails`); 1.2 Jun 2025
(SaaS/PaaS, pricing-currency columns for credits and tokens as non-monetary units); 1.3 ratified
2025-12-05; **1.4 ratified 2026-06-04**, announced at FinOps X 2026-06-10, adding "2 datasets, 47
columns, 6 attributes, 17 glossary entries" with zero incompatible changes; **1.5 targeted Dec 2026**.

[E] **FOCUS 1.4 contains no AI or token columns.** The 1.4 changelog covers invoice reconciliation,
commitment-program eligibility and cost-column revisions. Token handling today is entirely via the
generic columns: `ConsumedQuantity` ("The volume of a metered SKU associated with a resource or
service used, based on the Consumed Unit"), `ConsumedUnit`, `PricingQuantity`, `PricingUnit`
("Service-provider-specified measurement unit for determining unit prices"), `SkuMeter` ("Describes
the functionality being metered or measured by a particular SKU in a charge") and `SkuPriceDetails`
(a JSON bag explicitly "supporting FinOps capabilities such as unit economics"). The unit-format
appendix already registers `Token | Tokens | Discrete data elements exchanged or processed`, with
the compound example `Request-Tokens`. Service taxonomy: `ServiceCategory = "AI and Machine
Learning"`, `ServiceSubcategory ∈ {AI Platforms, Bots, Generative AI, Machine Learning, Natural
Language Processing, Other}`. [E?] *(Several third-party posts claim FOCUS 1.4 shipped token
columns. The 1.4 changelog does not support that, and the official 1.4 announcement says the
opposite — "FOCUS 1.5 is scoped to surface AI model identity and token consumption".)*

[E] **FOCUS 1.5 working draft — and this is directly load-bearing for one of this repo's design
bets.** The draft adds four FOCUS-defined `SkuPriceDetails` properties:

| Key | Draft description | Example |
|---|---|---|
| `ModelDeveloper` | "Name of the entity that created the model" | "Solora AI" |
| **`ModelFamily`** | **"Grouping of related models as defined by the model developer"** | "Solora Reasoning" |
| `ModelId` | "Identifier for the model as it appears in billing, which may be namespaced by the service provider and is **not guaranteed to match across service providers**" | "solora-reasoning-pro" |
| `ModelVersion` | "Version of the model within a given model family" | "3.0" |

And the token-class handling is structural rather than a property: "the split between input (prompt)
and output (generated) tokens is carried **structurally** rather than through a dedicated property…
Each is a separate *SKU* with its own `SkuId` and `SkuPriceId`, distinguished by `SkuMeter` values of
'Input Tokens' and 'Output Tokens'. No separate token-type property is used." With
`ConsumedQuantity` holding raw token count, `ConsumedUnit = "Tokens"`, and `PricingUnit =
"1000000 Tokens"`. [R] Two observations. First, **a `ModelFamily` roll-up is being standardised**,
defined as the *developer's own* grouping — which is exactly one of the two roll-up levels
`CONTEXT.md` records as having no vendor precedent, and it now has a draft standards precedent.
Second, the draft explicitly declines to standardise a *cross-vendor* identifier: `ModelId` is "not
guaranteed to match across service providers." So a capability *tier* above family remains
unstandardised, and the spec's own note about cross-provider identifiers is the clearest published
statement of why that is hard. [E?] 1.5 is a working draft with a Dec 2026 target; none of this is
ratified.

[E] **FOCUS has no user, person, actor or employee column at any version, including the 1.5 draft.**
The finest identity grain is `BillingAccountId` → `SubAccountId` → `ResourceId` → `Tags`. The
Allocation capability defines allocation over "Accounts, Projects, Folders, Subscriptions,
Departments, Organizational Units" and tags; individuals are never named as an allocation target
anywhere in the Framework. [R] This is the structural reason every per-engineer AI cost view in the
market is built *above* the interchange standard rather than inside it.

[E] **FOCUS also has no "estimated cost" concept.** Its four cost columns are all invoice-derived:
`BilledCost` ("the cost of a charge as invoiced by the invoice issuer in a given billing period"),
`EffectiveCost` (accrual-based, "based on the resources used, services used, or contract commitments
recognized"), `ListCost` and `ContractedCost`. [R] Estimated-versus-billed is therefore purely a
vendor-layer invention, which explains why every vendor phrases the caveat differently (§4.4).

[E] **Virtual currency is modelled.** FOCUS glossary: "**Virtual Currency** — A proprietary currency
(e.g., credits, tokens) issued by service providers and independent of government regulation", with a
worked SaaS appendix in which credits are purchased as a `Purchase` charge and `EffectiveCost` stays
zero until consumed.

[E] **Tokenomics — the 2026 institutional turn.** J.R. Storment, 2026-05-10, "Token Economics: The
Atomic Unit of AI Value": tokenomics is "the study of how the production, distribution, and
consumption of tokens … generate business outcomes and AI value within an organization", and "is
best understood as FinOps applied to AI", extending cloud discipline "into a layer where the consumed
resource is probabilistic, non-deterministic, and priced per inferential act". A working-group paper,
"Tokenomics: Managing AI Value in SaaS Model Token Costs" (2026-06-03), is the most on-point
Foundation source for this survey:

> "The simplest form of attribution is a disciplined API key structure. Each key should map to a
> single team, application, or use case, and key provisioning should require a named owner, a
> designated cost center, and an approved use case."
> "Tools such as LiteLLM, Portkey, Helicone, and similar platforms sit in the API call path and allow
> organizations to inject arbitrary metadata (user ID, session ID, application name, feature flag,
> cost center) that is then available in the proxy's logging and reporting layer."
> "model providers do not natively support the tagging structures FinOps teams rely on"
> "**Cost per user per month: total AI spend divided by active users, useful for comparing against
> seat-based alternatives.**"

The Linux Foundation announced **Tokenomicon** and a **Tokenomics Foundation** on 2026-06-10, plus an
**AI Value certification**. [E] **State of FinOps 2026: 98% of respondents now manage AI spend**, up
from 63% in 2025 and 31% in 2024; AI cost management is the #1 skillset gap; a quoted practitioner:
"Is your AI providing value? No one can answer that question yet."

#### 6.4.2 The cost platforms — four of them resolve AI cost to a named engineer

[E] Out of the box, without customer instrumentation:

| Platform | Named-individual AI cost? | Evidence |
|---|---|---|
| **Vantage** | **Yes** | A doc section titled "View Anthropic Spend by User or Developer Email". Claude.ai rows use the user's email as the **Resource ID** and carry `anthropic:user_email` / `:user_name` / `:user_id`. Cursor: Resource = user email plus a `cursor:user` tag. OpenAI: `openai:owner_name` |
| **CloudZero** | **Yes** | "**Anthropic Enterprise:** Costs by **individual user**, product, model, and context window"; OpenAI Enterprise "Costs by user, product, and model, covering ChatGPT, Work, and Codex"; Cursor "costs broken down by **user**, billing group, model, and **repository** (Enterprise only)" |
| **Finout** | **Yes** | claude.ai surface exposes User + Product; Cursor by User, Model, Kind; OpenAI Codex exposes User Email |
| **Datadog CCM (AI Costs)** | **Yes** | OOTB allocation rules emit `user_email`, `user_id`, `user_name` for Anthropic and OpenAI; "User-level allocation is also supported for Cursor". Summary page: "**Top Cost Drivers**: The models, projects, services, and **users** generating the most spend" |
| Kubecost / OpenCost | No | allocation is cluster / namespace / controller / pod / container / label |
| IBM Apptio Cloudability | not found | markets "Track AI usage and break it down by model, token type, and direction"; per-user attribution not documented in reachable pages |
| Datadog **LLM Observability** | **No, deliberately** | see below |

[E] Value propositions, verbatim: CloudZero — "**Every AI dollar. Every outcome. Connected.**" /
"**The AI ROI Company**" / "the **financial control plane for AI economics**"; its Anthropic page —
"With **cost per customer, per AI feature, and per inference**, the ROI question stops being a
guess." Vantage — "**Understand every dollar from Agents to AWS**" / "the **system of record for
allocating and optimizing cloud, SaaS, and AI costs**". Finout — "Cloud AI costs get buried in your
infrastructure bill. Finout pulls them out, down to **cost per token by team or model**." Datadog —
AI Costs "gives FinOps and engineering teams a unified destination for analyzing AI spend across
providers… and **attribute usage to the specific users and API keys driving it**".

[E] **Both leading FinOps vendors publicly argue against the leaderboard they enable.** CloudZero's
SVP Engineering, Bill Buckley, 2026-05-07: "Per-engineer AI spend is the easy question. The harder
one: What business value are you getting for it?"; "**I'm skeptical of the leaderboard model. The
engineer with the highest token bill isn't the most productive.**"; and "**Meta stood up an internal
token leaderboard, then shut it down when it got weird.**" Vantage, 2026-04-24: "Per-developer AI
spend… is the first metric most teams look at once they start tracking agentic coding costs. **It's
also a numerator without a denominator**", proposing `Cost per PR = Monthly AI spend / PRs merged`,
and adding "That's a pattern to understand, not a problem to fix"; and 2026-03-27: "Per-developer
patterns aren't about creating a **leaderboard of who spends the most**. They're about spotting
outliers and understanding why." [R] Note the split: **provider-sourced identity is treated as
legitimate for chargeback; a bare per-person cost ranking is not.** Vantage's own custom-telemetry
spec tells customers to avoid "personally identifiable information (for example, email addresses or
conversation identifiers) unless operationally necessary", and Datadog's LLM Observability docs say
user IDs are "not fully supported and may be truncated or omitted" as cost-metric tags — while both
ship provider-sourced `user_email` in their billing product.

[E] **Vantage's Custom LLM Enrichment** is the cleanest published design in the survey for
attributing *billed* dollars to arbitrary dimensions: customer-emitted per-request usage logs are
joined to provider cost rows and split by token share, with the guarantees "**Splits are additive:
the sum of the enriched rows always equals the original cost row to the cent**" and a **leftover**
row carrying unattributed tokens "so totals always reconcile and no dollars are lost"; over-reported
telemetry still allocates only the billed cost. [R] That is a materially different architecture from
estimating cost from telemetry: it apportions an authoritative total rather than recomputing one.

[E] **The strongest caveat language in the survey belongs to Finout**, on Cursor: seat cost "is **an
estimate** based on the number of billable seats in your team and the monthly seat price you provide
during setup… does not sync with your actual Cursor contract"; "Cursor charges for usage whenever
your organization's cumulative spend hits an internal threshold, then resets the counter… The totals
will be close but **won't match to the cent**"; and, critically, "Cursor's API reports token usage
split by type… but returns a **single aggregated cost** across all types combined. As a result,
Finout reports token counts broken down by type under usage, but **cannot attribute cost to a
specific token type**." Also: for Anthropic seat-based Enterprise plans "the API only reflects spend
that **exceeds your included usage allotment**", historical data starts 2026-01-01, "**Codex
Enterprise seat fees aren't included**" and "**Token-level cost isn't available for Codex**."

[E] **Datadog draws the sharpest architectural boundary of anyone.** Its Cloud Cost Management AI
Costs product normalises `token_direction` ("Whether tokens are being consumed (input) or generated
(output)") and `token_category` (`cached input`, `cache write`, `standard input`, `output`) across
nine providers including GitHub Copilot and Cursor, and ships per-user allocation. Its LLM
Observability product computes an **estimated cost** "using providers' **public pricing models** and
token counts annotated on LLM/embedding spans", in **nanodollars**, and warns that partial cache
breakdowns "may result in inaccurate token counts or cost discrepancies" — while explicitly refusing
user IDs as metric tags. [R] Same vendor, two products: billed-and-per-person in the FinOps product,
estimated-and-aggregate in the observability product.

[E] Datadog also ships a third, separate product — **AI Impact** (Preview) — measuring "how AI coding
assistants affect your software delivery performance" across Cursor, Claude Code, Copilot and Codex,
with AI-assisted PRs, PR throughput "per user per day for AI-assisted authors compared to
non-assisted authors", cycle time, change failure rate and recovery time. **It carries no cost
metric at all**, and there is no documented join to the cost product. [R] Datadog ships
productivity-per-developer and spend-per-developer as two deliberately unjoined products.

#### 6.4.3 Gateways — the closest existing analogue to metering agent runs

[E] **LiteLLM** is the deepest per-user metering in open source and already models agents as
first-class. `LiteLLM_SpendLogs` carries `request_id`, `spend`, `prompt_tokens`, `completion_tokens`,
`model`, `user`, `end_user`, `team_id`, `organization_id`, `request_tags`, `session_id`, `status`,
**`agent_id`**, `mcp_namespaced_tool_name`, `cache_hit`, `request_duration_ms`. Rollup tables include
`LiteLLM_DailyUserSpend`, `DailyTeamSpend`, `DailyEndUserSpend`, `DailyOrganizationSpend` and
**`DailyAgentSpend`**, each carrying `prompt_tokens`, `completion_tokens`,
`cache_read_input_tokens`, `cache_creation_input_tokens`, `spend`, `api_requests`,
`successful_requests`, **`failed_requests`**, plus savings columns for prompt caching, compression
and auto-routing. Auto-created Postgres views include `Last30dKeysBySpend` and
`Last30dTopEndUsersSpend` (`ORDER BY total_spend DESC LIMIT 100`). Notable default: "By default,
LiteLLM will track `User-Agent` as a custom tag for cost tracking. This enables viewing usage for
tools like Claude Code, Gemini CLI, etc."

[E] Its admin UI ranks users by spend four different ways: a "**Spend Per User**" card subtitled
"Showing Top 5 by Spend"; a "Spend Per User Within Team" card whose CSV export includes a "User
Email" column; an Internal Users page sortable by Spend backed by
`GET /user/list?sort_by=spend&order=desc`; and a Customer Usage tab of the top 100 end-users by
spend. A UI code comment reads: "Resolve user_id to email/alias so the Spend Per User chart never
shows a raw UUID." `GET /global/spend/report` is Enterprise-gated with the purpose string "✨
(Enterprise) Generate Spend Reports — Use this to charge other teams, customers, users", and
`group_by ∈ {team, customer, api_key}` — **not user**.

[E] **LiteLLM is the only product in the entire survey with per-person anomaly detection.**
`user_spend_anomalies` fires when a user's spend today exceeds `3.0×` their trailing 7-day daily
average with a $10 floor, checked hourly, one alert per user per day, with the message "User Spend
Anomaly Detected: User: {user_id} / Spend Today: $X / Daily Average (last 7 days): $Y". It is **off
by default**, as are the daily and monthly per-user spend thresholds. Its weekly and monthly Slack
spend reports cover **team and tag only — there is no per-user Slack spend report**. Its budget
system reserves an estimated maximum cost before the call and replaces it with the actual cost
afterwards, and documents that disabling reservation "can allow concurrent requests to exceed a
configured budget".

[E] LiteLLM also documents the **self-declared-user spoofing hole**: "End users can provide the
`user` parameter in their request bodies… This means users could **'avoid' having their spend
tracked**", mitigated by `overwrite_user_with_key_hash` or by always stamping `user_id` at key
creation. [R] Any attribution scheme that trusts a client-supplied identifier inherits this.

[E] **Helicone** exposes per-user cost through `POST /v1/user/metrics/query` (`UserMetricsResult`
carries `user_id`, `total_requests`, `average_tokens_per_request`, `total_completion_tokens`,
`total_prompt_tokens`, **`cost`**) driven by the `Helicone-User-Id` header — but its *feature* docs
for user metrics never mention cost, steering instead toward custom properties. Its **cost-based rate
limit is the closest thing to per-person enforcement anywhere in the survey**: policy syntax
`[quota];w=[window];u=[unit];s=[segment]` with `u ∈ {request, cents}` and `s = user`, documented
example "Limit to $5.00 per hour per user" → `500;w=3600;u=cents;s=user`.

[E] **Langfuse** ships a Users page ("User-level LLM observability to track token usage, usage volume
and individual user feedback") and markets "top users and use cases by cost" — but with a hard
constraint: "**Certain dimensions like `id`, `traceId`, `userId`, and `sessionId` cannot be used for
grouping in the v2 Metrics API. Grouping by these high cardinality fields is extremely expensive and
rarely useful in practice. These dimensions remain available for filtering.**" Its cost model
distinguishes **ingested** cost ("you send the usage and cost from the LLM response") from
**inferred** cost, with ingested taking priority, and carries the survey's most precise warnings:
"If buckets overlap, usage and inferred cost will be counted double, and **cost shown in Langfuse
overstates what your provider actually charged**"; "Some provider counts are inclusive. For example,
OpenAI input counts include cached tokens. **Inclusive counts must be converted into exclusive
buckets before they are stored**"; and "**Because inferred costs are calculated at ingestion time,
updated defaults apply only to new generations.**"

[E] **Portkey** markets itself directly at this problem — "The governance layer for Claude Code,
Codex, and other AI coding agents"; "When developers use Claude Code or Codex individually, it works
fine. When 100 developers use it — raw API keys get scattered, **costs spike overnight without
attribution**"; "Set hard budget and rate limits **per developer**, team, or workspace"; "Log every
request — cost, tokens, latency, model, and **who made it**." But its docs also state the limitation
plainly: "Portkey currently **does not provide analytics on usage patterns for individual team
members in your Portkey organization**. The users tab is designed to track **end-user behavior in
your application**, not internal team usage." Its budget limits, once set, "**cannot be edited** by
any organization member", and threshold crossings currently write an audit-log event only — "Email
and other proactive alerts for threshold crossings are work in progress and are not sent today."

[E] **OpenRouter** meters in credits with USD as the base currency and no markup on inference. Its
Activity page shows Spend, Tokens and Requests and can "group by Model, API Key, or **Creator (org
member)**"; its Analytics API supports a `user` dimension that "returns **two** fields per row… `user`
is the account's display name … and **`user_email` is their email**… The raw user ID is never
returned." BYOK spend is "estimated based on market rates for that provider, and don't reflect any
discounts you might have from them." Workspace Budgets are org-level with hard `403` enforcement and
**no per-member budget**. A documented limitation: "the activity feed currently shows **all
organization member activity** when in organization context, not just your individual activity."

[E] **Braintrust** shows "Cost: **Estimated spend** based on model pricing", grouping by environment,
model, errors, **user** and custom metadata, using an explicitly logged `metrics.estimated_cost` when
present and falling back to a model registry keyed on an exact `metadata.model` match. **W&B Weave**
does automatic cost tracking from built-in pricing with per-call `costs` in the summary but **no
per-user cost surface**, and no cost tracking in its TypeScript SDK. **Arize Phoenix** rolls cost
from span → trace → **session** → project via OpenInference semantics, with project-level cost trends
"coming soon" and **no per-user grain**.

#### 6.4.4 OpenTelemetry GenAI — the standard that does not yet cover any of this

[E] **Structural change.** Core semconv v1.42.0 (2026-06-12) moved all `gen_ai.*` attributes,
metrics, events and spans out of the core repository into a dedicated
`open-telemetry/semantic-conventions-genai` repository (created 2026-05-05). That repository has
**zero git tags, zero releases, an empty changelog below the towncrier marker, and a README whose
"Schema URL" section reads `TODO`.** Everything in it is marked **Development** — not RC, not
stable — and the metrics doc still carries the disclaimer "These are initial Generative AI client
metric instruments and attributes but more may be added in the future."

[E] **The historical rename.** `gen_ai.usage.prompt_tokens` → `gen_ai.usage.input_tokens` and
`gen_ai.usage.completion_tokens` → `gen_ai.usage.output_tokens`, merged 2024-07-04 and shipped in
semconv v1.27.0 on 2024-08-02, "to align terminology between spans and metrics", filed as an
enhancement rather than a breaking change because gen_ai was experimental. A further unreleased
breaking rename changes `cache_creation.input_tokens` → `cache_write.input_tokens`.

[E] **Two contracts that matter, and they conflict with a major implementer.** The span attribute
`gen_ai.usage.input_tokens` is **inclusive**: "This value SHOULD include all types of input tokens,
**including cached tokens**", with a worked example of 100 text (40 cached) + 200 image →
`input_tokens: 300`. Langfuse's contract is the **exact opposite** — "each token must be counted in
exactly one key", and it subtracts cache reads and writes from `input` when ingesting `gen_ai.usage.*`.
Both specs also agree on one rule: when a provider reports both consumed and billed counts,
instrumentation must report the **billed** count.

[E] **The metric cannot express token class.** `gen_ai.client.token.usage` takes
`gen_ai.token.type ∈ {input, output}` only. Cache-read, cache-write, reasoning and per-modality
splits exist **only as span attributes**, not as metric dimensions.

[E] **There is still no cost attribute.** Issue #287 ("Add convention for operation costs") opened
2025-05-30 and remains open; PR #443 ("Add per-operation cost conventions `gen_ai.usage.cost.*`")
opened 2026-08-09, still open as of 2026-09-03, proposing `gen_ai.usage.cost.amount`, `.currency`,
`.source ∈ {provider, local}` and a `gen_ai.client.operation.cost` histogram. Its stated motivation:
"There's no standard OTel convention for reporting GenAI cost today; each vendor is rolling their
own (LiteLLM, Pydantic AI + Logfire, OpenRouter — different shapes for the same USD amount)." Two of
its design decisions are directly relevant to any dashboard: "**Floating point for `.amount`. This is
observability, not accounting**", and "**Frozen at recording time.** The recorded amount reflects the
pricing data in force when it was computed; consumers never recompute against later pricing." Cost
*allocation* — "which team/budget-owner gets charged" — and FOCUS integration are explicitly out of
scope.

[E] **The empirical case for per-class cost, from the spec's own issue tracker.** Issue #484
(2026-08-31): "**Backends that recompute without per-class data get it wrong: langfuse/langfuse#13807
shows recomputed Anthropic caching costs at roughly 40% of true spend**"; "Three incompatible
breakdown shapes already ship: LiteLLM's `gen_ai.cost.{class}_cost`, OpenInference's `llm.cost.*`
(eleven attributes), OpenRouter's `gen_ai.usage.{input,output,total}_cost`"; "**A total cannot
distinguish 'fully priced' from 'tokens only'.**" The underlying Langfuse issue reports a true cost of
`$0.52231845` against a derived value materially under-counted at roughly 40% of actual. [R] This is
the single most concrete published evidence in the survey that cache-class handling is where
token-derived cost goes wrong, and by how much.

[E] **There is no user identity in GenAI semconv at all.** A grep of the whole repository for
`enduser`, `user.id` and `user_id` returns zero hits. Identity attributes (`user.id`, `user.email`,
`enduser.id` — the last carrying an explicit PII warning) live in core semconv and are unwired to any
`gen_ai` signal. [R] **Per-user LLM cost attribution has no standardised OpenTelemetry path today**,
which is why every vendor invented its own: `Helicone-User-Id`, Langfuse `userId`, Portkey `_user`,
Datadog `user_handle`, Anthropic's `user.email` resource attribute.

[E] Agent and session concepts *are* in the spec: `gen_ai.agent.id` / `.name` / `.description` /
`.version`; **`gen_ai.conversation.id`** ("The unique identifier for a conversation (session, thread),
used to store and correlate messages within this conversation"); operations `create_agent`,
`invoke_agent`, `invoke_workflow`, `plan`, `execute_tool`, `retrieval`; and metrics
`gen_ai.invoke_agent.duration`, `.inference_calls`, `.tool_calls`, each carrying a conditionally-
required `error.type` but **no success status**. An unreleased breaking change removes cache token
attributes from the internal `invoke_agent` span because "Cache breakdowns on that span aggregate
across models and inference calls, which makes them misleading."

#### 6.4.5 The upstream asymmetry that shapes everything downstream

[E] Both leading model providers expose **tokens per named user but not dollars per named user** on
their general billing APIs. Anthropic's `/v1/organizations/usage_report/messages` can group by
`account_id` ("ID of the user account that made the request"); its `/v1/organizations/cost_report`
can group only by `description` and `workspace_id`. OpenAI's `/v1/organization/usage/completions` can
group by `user_id`; its `/v1/organization/costs` can group only by `project_id`, `line_item` and
`api_key_id`. [E] The exceptions are product-specific: Anthropic's Claude Enterprise
`user_cost_report` ("Returns one row per user, ranked by spend. Use this to see which users account
for the most cost") and Claude Code Analytics API (`estimated_cost` per user per day), and Cursor's
`POST /teams/spend`. [E] AWS Bedrock represents the pure cloud pattern: "Use tags to monitor costs",
with attribution at the resource-tag level and **never per person**.

[R] Three consequences follow, and they explain most of §4.4. Per-user cost is usually *derived*, not
billed. It is derived by a layer that does not own the invoice. And the derivation's hardest part —
cache-class pricing — is exactly where the published error rate is largest.

#### 6.4.6 Seats are the field's blind spot

[E] Three independent vendors document the same hole. Finout: Cursor seat cost "is **an estimate**…
This price is set manually and does not sync with your actual Cursor contract", and "**Codex
Enterprise seat fees aren't included**". Anthropic: on seat-based Enterprise plans the spend export
"only reflects spend that exceeds your seat allotment". CloudZero on OpenAI: "Usage that falls inside
a seat's included allowance carries no cost from OpenAI, so it does not appear as spend." [R] Any
cost-per-engineer figure built purely on usage APIs therefore systematically under-reports, by an
amount equal to the seat fee plus whatever consumption the seat allowance absorbed — which for a
low-usage engineer is nearly the whole cost.

---

## 7. Others' struggles: deprecations, demotions and public walk-backs

[R] The ticket asks for this lens explicitly. It is the most useful section in the brief for
anyone weighing durability, because it shows what the field tried and abandoned.

### 7.1 Metric APIs retired or replaced

| Date | What | Vendor's framing / what it tells you |
|---|---|---|
| 2025-01-31 | GitHub beta `/copilot/usage` endpoint retired (announced 2024-10-30 alongside Metrics API GA) | first-generation usage reporting replaced within months of GA |
| 2025-11-05 | GitHub legacy Copilot usage report CSV retired (deprecated three months prior) | — |
| 2026-01-29 → 2026-03-02 | GitHub **User-level Feature Engagement Metrics API** and **Direct Data Access API** sunset | the Feature Engagement API gave "a simplified view of user adoption of specific Copilot features through binary indicators"; Direct Data Access gave "user-level event data for Copilot code completion activity within supported IDEs". Both were Early Access, both died |
| **2026-04-02** | GitHub **`/orgs/{org}/copilot/metrics`** — the aggregate-only, ≥5-user Metrics API — sunset | rationale given: "Provide a single, unified source of truth for Copilot metrics" with "more granular and valuable insights, including IDE agents, models, languages, lines of code" |
| 2026-04-23 → 2026-08-01 | GitHub `used_copilot_coding_agent` renamed `used_copilot_cloud_agent`; legacy field kept four months | a field rename with a deprecation window — cheap to do, and evidence the schema is not settled |
| 2024-11-22 | Amazon dashboard cutover from the CodeWhisperer-era CloudWatch path | pre-cutover metrics still require `cloudwatch:GetMetricData` and `cloudwatch:ListMetrics` |
| — | Amazon `MetricData` telemetry event marked deprecated: "Do not use this" | — |
| 2025-10 | Google Gemini Code Assist **tools** deprecated and removed, replaced by agent mode + MCP | "Using the `@` symbol followed by the name of a tool no longer connects to Gemini Code Assist tools" |
| 2026-04 | Google replaced IAM permission `cloudaicompanion.instances.completeTask` with `geminicloudassist.agents.invoke` | — |
| ~2023–2024 | OpenAI legacy `GET /v1/usage` | **retired silently** — it does not appear on OpenAI's deprecations page; the `/v1/organization/usage/*` family replaced it from 2024-12-04 |
| ongoing (2026) | Google Workspace Directory → Users "Gemini Last usage" column | live vendor warning: "the Gemini last usage data on this page may display inaccurate or incomplete data for your organization" — a shipped metric degrading in place |
| 2026-11-30 (scheduled) | OpenAI Evals dashboard and API shutdown | — |

### 7.2 Metering units abolished or re-based

| Date | What | Notes |
|---|---|---|
| 2025-04 | **Windsurf removes "flow action credits"** | users had complained they had "no idea how many flow actions your single prompt would use up" |
| 2025-04-03 | **Devin $500/mo → $20 + $2.25/ACU** | ~96% entry-price cut with the ACU unit price *rising* on the cheap tier |
| 2025-06-16 → 2025-07-04 | **Cursor requests → tokens**, plus Ultra at $200 | Michael Truell: "We recognize that we didn't handle this pricing rollout well, and we're sorry. Our communication was not clear enough and came as a surprise to many of you." Refunds offered for the intervening period. The only public apology-plus-refund found in the survey outside AWS |
| 2025-06-18 | **Replit flat per-checkpoint → effort-based** | "Cost will reflect the true scope of the Agent's work" |
| **2025-08-15 → 2025-09-15** | **Kiro "spec requests" and "vibe requests" — a live billing unit for exactly one month** | Preceded by a waitlist and daily caps imposed within a week of preview launch (2025-07-21) and a tier table pulled from the site. Then backlash, a GitHub issue titled "Your Pricing Is a Wallet-Wrecking Tragedy" (#2182), and a Discord report that "when I make one request, Kiro has already consumed four to six vibe requests". AWS conceded a **metering bug** — "some tasks were inaccurately consuming multiple requests" — refunded August fees and overages ("We know the last few days haven't been smooth, and we don't take that lightly"), then made the product free until 2025-09-15 and refunded all September charges, then **abolished the unit** in favour of a single fractional credit charged "in 0.01 credit increments" |
| 2025-10-20 → 2026 | **Augment messages → credits → tokens + 40% service fee** | "Instead of counting 'messages,' credits more accurately reflect the actual cost of powering your request" |
| 2025-10-30 | **Warp requests → three credit buckets** (AI, compute, platform) sharing one pool | platform credits "billed by the agent hour" |
| **2026-03-19** | **Windsurf removes credits entirely** for non-rolling daily/weekly quotas, Pro $15 → $20 | criticised as a 33% rise that penalises bursty use, since unused daily allowance evaporates |
| **2026-06-01** | **GitHub premium requests → AI Credits** | "a quick chat question and a multi-hour autonomous coding session can cost the user the same amount"; absorbing inference cost "is no longer sustainable". Annual holdouts kept on legacy multipliers — **which were increased** |
| 2026-06-13 | Lovable unifies split credit balances into one pool | — |

[R] The pattern: **the synthetic unit is the least durable object in the field.** Six vendors
replaced their headline unit within eighteen months; one abolished a unit after a single month and
two rounds of refunds. Anything that stores history denominated in a vendor's synthetic unit inherits
that instability.

### 7.3 Whole products retired

- **Amazon Q Developer**: new signups blocked 2026-05-15; **end of support 2027-04-30** for IDE
  plugins and paid subscriptions; Java/.NET transformation goes with it. Migration target: Kiro. [E]
- **Gemini Code Assist for individuals / Google AI Pro / Google AI Ultra tiers**: stopped serving
  requests **2026-06-18**, consolidated into Antigravity. Standard and Enterprise unaffected. [E]
- **Sourcegraph Cody** Free, Pro and Enterprise Starter: signups closed 2025-06-25, deprecated
  2025-07-23; individuals pushed to Amp; Cody Enterprise retained by Sourcegraph after the
  2025-12-02 company split. [E]
- **Pluralsight Flow** (formerly GitPrime, acquired for $170M in May 2019, renamed 2020-01-17, sold
  to Appfire 2025-02-05): renewals closed 2026-06-30, **end of life 2027-12-31**, maintenance mode
  until then. [E?] *(the EOL wording is reproduced identically across multiple secondary write-ups;
  the first-party Appfire notice was not retrieved)* [R] Flow/GitPrime was the canonical
  per-developer engineering-metrics product, built around a per-engineer "Impact" score. Its death
  is the field's clearest market signal against individual-grain productivity scoring — and it died
  by acquisition and neglect, not by principled retirement.
- **Code Climate Velocity for Teams**: announced week of 2023-12-18, data deleted 2024-03-18, to
  refocus on Enterprise. Code Climate later spun Quality out as Qlty Software and repositioned around
  enterprise SEI; its sample dashboards now show **"AI Token Use — per developer"**. [E?] *(the
  Velocity sunset page was not directly reachable; content is indexed and quoted consistently)*
- **Augment Code**: Next Edit and Completions sunset 2026-03-31; IDE extensions sunset from
  2026-06-22, on the stated rationale that "developers are orchestrating fleets of agents across
  tasks rather than working at the level of individual lines of code". The company pivoted to Cosmos
  rather than shutting down. [E]

### 7.4 Metrics publicly demoted or refused

[E] The clearest cases, since these are the ones that bear directly on actionability:

- **OpenAI refuses lines-of-code and acceptance rate by name**, with published reasons (F23).
- **DX excludes acceptance rate and lines of code from its framework** and publishes the reasoning.
- **JetBrains ships acceptance rate and concedes it is wrong**: the metric "currently counts code as
  accepted even if the user later deletes or edits it, potentially inflating values."
- **Anthropic pre-labels its own contribution metrics as an underestimate**: "deliberately
  conservative and represent an underestimate of Claude Code's actual impact."
- **GitHub warns against its own adoption multiplier** as a "standalone measure of productivity" and
  against cross-team comparison, which "may reflect differences in team composition rather than
  adoption depth."
- **LeadDev, 2025-07-10**, quoting Laura Tacho (DX), Sabrina Farmer (GitLab) and Yonatan Arbel
  (JFrog), argued acceptance rate risks turning "coding into a game of compliance: 'accept more to
  show I'm productive', which can erode trust".
- **DORA, 2026-06-02**, "Finding balance in the era of tokenmaxxing": "when a metric becomes a target,
  it ceases to be a good measure", with an observed gaming pattern — "developers running autonomous
  agents on nonsense projects simply to calibrate their spend and stay above the company average" —
  and the finding that "teams with the highest budgets often achieve only a marginal increase in
  software delivery throughput at a 10x increase in cost." It cites Salesforce's **Agentic Work
  Units** and Shopify **replacing leaderboards with usage dashboards plus "circuit breakers" for
  runaway agents**. [R] That last item is the only reported instance in the survey of an organisation
  removing a leaderboard it had previously run.

---

## 8. What the published evidence says about whether any of it works

[R] Section 5 mapped vendor belief. This section maps evidence. The gap between them is the most
important thing in this brief.

### 8.1 The randomised evidence, and its collapse

[E] **METR, 2025-07-10** (arXiv 2507.09089; Becker, Rush, Barnes, Rein). RCT, 16 experienced
open-source developers, 246 tasks, in repositories they had contributed to for an average of five
years (mean 22k+ stars, 1M+ LOC), paid $150/hour, mostly Cursor Pro with Claude 3.5/3.7 Sonnet,
Feb–Jun 2025. Result: "When developers are allowed to use AI tools, they take 19% longer to complete
issues—a significant slowdown." Perception gap: developers forecast −24% before, and **still believed
they were 20% faster afterwards**; ML experts forecast −38%, economics experts −39%. All four
estimates were on the wrong side of zero. The authors explicitly do not claim the result generalises
beyond this population or forward in time.

[E] **METR, 2026-02-24** — the follow-up, and the important part. A second experiment (57 developers,
143 repositories, 800+ tasks, $50/hour, from Aug 2025) produced −18% for returning developers (CI
−38% to +9%) and −4% for new ones (CI −15% to +9%). METR's own conclusion: "we believe that the data
from our new experiment gives us an unreliable signal of the current productivity effect of AI
tools." Cause: selection effects — "30% to 50% of developers told us that they were choosing not to
submit some tasks because they did not want to do them without AI", and concurrent agent use broke
task-level timing. They are redesigning toward developer-level rather than task-level randomisation.

[R] **This is the single most consequential fact for anyone building agent analytics in 2026.** The
field's gold-standard experimental design has been declared unreliable by its own authors, because AI
use is no longer optional enough to withhold. Observational org-level analytics — exactly what every
vendor in this survey sells — is becoming the only feasible evidence base, at precisely the moment
Stanford's work shows it is most confounded by task type.

### 8.2 The large observational studies

| Study | Scale | Finding |
|---|---|---|
| **DORA 2024** (Oct 2024) | — | per 25% increase in AI adoption: **+2.1%** individual productivity, **+2.6%** job satisfaction, **−1.5%** delivery throughput, **−7.2%** delivery stability; 39.2% reported little or no trust in AI-generated code. *(effect sizes taken from first-party summaries, not the gated PDF)* |
| **DORA 2025** (2025-09-24) | ~5,000 professionals + 100+ hours qualitative | 90% use AI at work; >80% say it increased productivity; 30% still report little or no trust. Throughput sign **reversed**: "Unlike last year, we observe a positive relationship between AI adoption on both software delivery throughput and product performance." Stability did not: "AI adoption does continue to have a negative relationship with software delivery stability." Thesis: "AI doesn't fix a team; it amplifies what's already there." |
| **DORA AI Capabilities Model** (2025-11-25) | 78 in-depth interviews + literature | seven capabilities including a clear AI stance, connecting AI to internal context, strong version control, small batches, quality internal platforms, user-centric focus, healthy data ecosystem. *(the seventh renders inconsistently across two first-party summaries)* |
| **Faros AI**, *AI Productivity Paradox* (2025-07-23) | 10,000+ developers, 1,255 teams | +21% task completion, +98% merged PRs, +47% PRs/day, +154% PR size, **+91% PR review time**, +9% bugs per developer — and "any correlation between AI adoption and key performance metrics evaporates at the company level." |
| **Faros AI**, *AI Engineering Report 2026* | 22,000 developers, 4,000 teams | "more bugs, accelerating incidents, longer review cycles, and a quality gap that is widening as adoption deepens." |
| **LinearB 2026 Engineering Benchmarks** (2026-03-24) | **8.1M PRs, 4,800 teams, 42 countries** | 88.3% of developers use AI regularly. **AI-assisted PRs merge at 32.7% vs 84.5% for unassisted.** p75 PR size 400+ LOC vs 157. AI-assisted PRs wait **>5×** longer for review pickup. Refactor rate 37% unassisted vs "practically negligible" AI-assisted. "65% of organizations lack dependable data quality." |
| **DX Q4 Impact Report** (2025-11-04) | **435 companies, 135,000+ developers** | 91% adoption; **22% of merged code AI-authored**; 3.6 h/week average self-reported time saved; 2.3 PRs/week for daily AI users vs 1.4; time to 10th PR falls 91 → 49 days. And, from DX itself: "Developers report saving nearly 4 hours a week. But those savings aren't showing up proportionally in throughput"; "Some teams are shipping up to 50% more defects since AI adoption"; "Some organizations are seeing clear improvement to quality as AI usage increases, others are seeing serious degradation." |
| **Uplevel** (2024-09-17) | 800 developers; 351 with Copilot vs 434 matched controls | no significant improvement in PR cycle time (a 1.7-minute decrease) or throughput; **41% increase in bugs** in the Copilot group. CEO Joe Levy: "The data doesn't show appreciable gains in these specific areas through generative AI… most teams have yet to land on the most effective use cases." |
| **GitClear** (2024, 2025, 2026-06) | 153M → 211M → **623M changed lines** | 2025: **8-fold increase** in 2024 in duplicated 5+-line blocks; **moved/refactored lines 25% (2021) → under 10% (2024)**; copy/paste 8.3% → 12.3%; **2024 the first year copy/paste exceeded moved code**; churn 3.1% → 5.7%. 2026: block duplication **+81%**, within-commit copy/paste **+41%** (9.4% → 15.7%), **refactoring −70%** (21% → 3.8%), cross-file function calls −35%, long-term legacy maintenance −74%, error-masking constructs +47%, two-week churn +15%. "The throughput is real, but so is the debt it accrues." |
| **Stanford (Denisov-Blanch)** | ~100–120k developers, 600+ companies | median lift **~10–15%**; roughly **half of gross gains consumed by rework** (code changed again within ~3 weeks); by task class: low-complexity greenfield +30–40%, high-complexity greenfield +10–15%, **high-complexity work in large mature codebases can be net negative** |
| **He et al.** (arXiv 2607.01904, 2026-07-02) | **802 developers, 196,212 PRs, 28 months** | an enterprise 2× merged-PR mandate was met (2.09× baseline by Apr 2026); "Per-reviewer load roughly doubled and automated review overtook human review, while merge and revert rates held steady." |
| **Wheeler** (arXiv 2606.20882, 2026-06-18) | conceptual | authorship-based metrics (truck factor, degree-of-authorship) have "come uncoupled" from what they estimate: "the same footprint is now compatible with full, partial, or no understanding" |
| **Greg Wilson** (2026-05-20) | essay | twelve ways to be wrong, incl.: "Acceptance measures whether the generated code looked plausible enough for a developer to press Tab; it does not measure whether the code was correct, secure, or maintainable"; "Deleting 2000 lines of tangled logic and replacing it with 200 clean ones is an improvement that looks like a loss on this metric" |

### 8.3 Where the evidence converges

[R] Three things have cross-source support from independent datasets:

1. **The bottleneck moved to review.** Faros (+91% review time, 10k devs), LinearB (>5× pickup time,
   8.1M PRs) and He et al. (per-reviewer load doubled, 802 devs / 196k PRs) agree, using different
   data and different methods.
2. **Rework / churn is the metric everyone independently reached for**, with near-identical
   operationalisation — code re-changed within two to three weeks. GitClear's churn, Stanford's
   rework, LinearB's PR Rework, DORA's recommended "code rework rates".
3. **Effect size is conditional on task class.** Stanford's segmentation (greenfield vs mature,
   low- vs high-complexity) implies any org-level AI metric that does not condition on task type is
   confounded. [R] Devin's session categories and Cursor's Conversation Insights are the only shipped
   surfaces in the survey that could support that conditioning, and neither is marketed for it.

### 8.4 Where vendor belief and evidence diverge, item by item

| Signal the field markets as actionable | What the evidence says |
|---|---|
| **Lines of code accepted** | GitClear: volume rose while refactoring collapsed 70%. Wilson: a 2000→200-line improvement "looks like a loss on this metric". Wheeler: authorship no longer implies comprehension. OpenAI and DX refuse it outright |
| **Suggestion acceptance rate** | OpenAI: "almost 100% since users usually accept the change first". JetBrains: counts code "accepted even if the user later deletes or edits it". DX: "such a tiny part of the story". LeadDev: risks "a game of compliance" |
| **% of PRs that are AI-assisted** | LinearB: those PRs merge at 32.7% vs 84.5%. The denominator counts work that never ships |
| **Estimated time saved** | METR: self-report was wrong by ~39 percentage points *in direction*. DX's own data: savings "aren't showing up proportionally in throughput" |
| **Adoption / DAU-WAU** | DORA 2024 found throughput *down* with adoption; DORA 2025 found it up. Faros: correlation "evaporates at the company level". [R] Adoption is a leading indicator of nothing stable |
| **Token or credit spend as a proxy for output** | DORA 2026-06: "teams with the highest budgets often achieve only a marginal increase in software delivery throughput at a 10x increase in cost", plus an observed gaming pattern |
| **Rework / churn** | the one signal with converging independent support — and the one class-A vendors do not ship |
| **Review-stage timing** | converging support from three independent datasets — and shipped only by class C (LinearB's Checkup Time, Pickup Time, Review Time) |
| **Cost per accepted change / cost per verified outcome** | recommended by DORA (2026-06), shipped by Faros. No class-A or class-B vendor ships it |

[R] The honest summary: **the signals with the best evidence are the ones the agent platforms do not
expose, and the signals the agent platforms expose most prominently are the ones with the weakest
evidence.** That is not a criticism of any vendor's intent; it follows mechanically from where each
class sits relative to the run (§1.1). Acceptance is visible to the client at zero cost. Rework is
only visible weeks later, in Git.

---

## 9. Gaps in what the field exposes, framed by audience

[R] **How to read this section.** Each entry records something the surveyed field does *not* expose,
names which of **individual contributor / team lead / FinOps owner** would plausibly find it valuable
and on what basis, and then states the open question **as a question addressed to tickets 05 (metric
set) and 08 (dimension taxonomies)**, which are human-answered and are not answered here. Nothing
below is a recommendation, and nothing below asserts that this product should or should not carry
the signal. There is deliberately no diff against `CONTEXT.md` § Metric Concepts, which is declared
incomplete; diffing against it would manufacture gaps that do not exist.

[R] The audience attributions are reasoned, not sourced. Where a vendor has published evidence about
who wants a signal, that evidence is cited inline.

---

### G1. Outcome of an attempt

**What the field does not expose.** No class-A or class-B product in the survey reports whether an
agent run *succeeded*. Devin comes closest with per-session "Issues Detected" and an
unhealthy-session flag inferred from size; Anthropic emits `claude_code.api_error` and
`api_refusal` events and a `tool_result.success` boolean into your own telemetry backend, but no
aggregate; LiteLLM's daily rollups carry `successful_requests` / `failed_requests` at the request
layer; the OpenTelemetry GenAI agent metrics carry a conditionally-required `error.type` and **no
success status at all**. [E]

**Who would value it.**
- *Individual contributor* — high. A personal failure rate is self-diagnostic and carries no
  comparative sting; it is the kind of signal Devin's Personal Analytics and DX's Personal dashboard
  already establish an appetite for. [R]
- *Team lead* — high. Failure concentrated in one repository or one agent configuration is
  actionable in a way that failure spread evenly is not. [R]
- *FinOps owner* — high, and this is the least obvious of the three: spend on failed attempts is the
  purest waste line in the whole cost model, and it is the only cost category that can be reduced
  without reducing output. Faros is the one vendor that markets this framing, as "retry-loop token
  waste". [E]

**Question for tickets 05 and 08.** Does the metric set distinguish an attempt's outcome, and if so
at what grain — per AgentSession, per Task, or only as a rate?

---

### G2. Rework — the same work attempted more than once

**What the field does not expose.** Nothing in class A or B. The signal exists only one layer up:
LinearB's PR Rework, GitClear's two-week churn, Stanford's ~3-week rework window, DORA's June 2026
recommendation to pair the four keys with "cost per accepted change and code rework rates". [E]

[R] This is the sharpest single gap in the survey, because §8.3 shows rework is the one metric that
multiple independent research groups reached for *and operationalised nearly identically*, and §3.1
shows no agent platform ships it. The reason is structural rather than ideological: acceptance is
observable at the moment of the diff, rework is observable weeks later in Git, and class-A vendors
do not read Git. Anthropic's GitHub-integrated contribution metrics are the only class-A surface that
reads Git at all, and they use it for attribution rather than for rework.

**Who would value it.**
- *Individual contributor* — moderate. Useful as a personal signal; loaded if comparative. [R]
- *Team lead* — high. It is the difference between "we shipped 40 tasks" and "we shipped 28 tasks and
  redid 12". [R]
- *FinOps owner* — high. Rework is the multiplier that converts a per-attempt cost into a
  per-outcome cost, which is the unit the FinOps Foundation's own Unit Economics capability says
  practices should mature toward. [E]

**Question for tickets 05 and 08.** Is rework in the metric set, and if so is it defined on retries
of a Task (which the Task/AgentSession split makes directly measurable) or on downstream code churn
(which requires reading Git and inherits the two-to-three-week lag every research group reported)?

---

### G3. Cost per outcome, rather than cost per unit consumed

**What the field does not expose.** Every class-A and class-B product reports cost per token, per
credit, per request, per ACU or per user. **Not one reports cost per completed unit of work.** [E]
The demand is documented and comes from outside class A: DORA recommends "cost per accepted change"
(2026-06-02); Faros ships "cost per task" and "cost per verified outcome"; Vantage proposes
`Cost per PR = Monthly AI spend / PRs merged` and calls per-developer spend alone "a numerator
without a denominator"; the FinOps Foundation's Unit Economics capability describes maturing from
cost per token toward "cost per assist, cost per agent action, cost per case deflected"; CloudZero's
SVP Engineering: "Per-engineer AI spend is the easy question. The harder one: What business value are
you getting for it?" [E] Anthropic's Value tab is the nearest class-A approach, offering cost per
commit, per PR and per session with adjustable inline formulas. [E]

**Who would value it.**
- *Individual contributor* — low to moderate. Denominated per outcome it is less punitive than raw
  spend, but it is still a cost signal about a person. [R]
- *Team lead* — high. It is the only form in which a cost number answers a question a lead actually
  has. [R]
- *FinOps owner* — very high, and this is the one gap where the buyer has said so in public,
  repeatedly and by name. [E]

**Question for tickets 05 and 08.** If a cost-per-outcome metric is in scope, what is the
denominator — completed Task, merged PR, or something else — and does the answer change the
dimension taxonomy, since a denominator sourced from Git introduces a dimension the platform does not
own?

---

### G4. A categorical roll-up above Repository

**What the field does not expose.** Repository appears as a dimension at exactly two vendors (Cursor
Repository Insights; GitHub's `repos-1-day` report). **No vendor offers any grouping above it.** [E]
The nearest analogues classify the *work* rather than the *codebase*: Devin's eleven session
categories (Feature Development, Bug Fixing, Code Review, Refactoring & Optimization, Test
Generation, Migrations & Upgrades, CI/CD & DevOps, Security, Data & Automation, Documentation &
Content, Research & Exploration), Cursor Enterprise's Conversation Insights ("category, work type,
complexity, and specificity"), and LinearB's and Jellyfish's investment allocation by issue type. [E]

[R] The evidence that this matters is strong and comes from research rather than from vendors:
Stanford's segmentation found effect size ranges from +30–40% on low-complexity greenfield work to
**net negative** on high-complexity work in large mature codebases. If that holds, any org-level
aggregate that does not condition on the nature of the work is averaging across populations with
opposite signs.

**Who would value it.**
- *Individual contributor* — low. An IC generally knows what kind of code they work in. [R]
- *Team lead* — high. It is the difference between "the agent is underperforming" and "the agent is
  underperforming on our legacy service and outperforming on the new one". [R]
- *FinOps owner* — moderate to high. Allocation to a work domain maps onto the cost-centre hierarchy
  the FinOps Framework describes as the maturity path, in a way allocation to a repository does not.
  [R]

**Question for ticket 08.** Does the dimension taxonomy carry a level above Repository, and if so is
its vocabulary derived from the codebase (a repository label) or from the work (a per-session
classification, as Devin and Cursor do it)? The field offers precedent for the second and none for
the first.

---

### G5. Provenance of the agent configuration

**What the field does not expose.** Agent, skill and plugin names exist as *telemetry attributes* —
Anthropic's `agent.name` / `skill.name` / `plugin.name` / `marketplace.name` / `mcp_server.name` /
`mcp_tool.name`, OpenTelemetry's `gen_ai.agent.name`, Cursor's and Anthropic's `skills` analytics
endpoints, LiteLLM's `agent_id` and `DailyAgentSpend` rollup, OpenAI's "skill invocations, agent
identity usage". **No product groups them by provenance** — vendor-shipped versus org-authored versus
third-party. [E] Anthropic actively works against it: user-defined and third-party names are
**redacted to `custom` / `third-party` by default** unless `OTEL_LOG_TOOL_DETAILS=1`, on stated
cardinality grounds. [E]

**Who would value it.**
- *Individual contributor* — low. [R]
- *Team lead* — moderate to high. "Our own agent configurations cost more and fail more than the
  built-in ones" is an actionable finding; "agent `custom` costs more" is not. [R]
- *FinOps owner* — moderate. Provenance is a governance question as much as a cost one, and the
  field is trending that way: Portkey markets itself as "the governance layer for Claude Code, Codex,
  and other AI coding agents", Cline and Devin ship MCP registry allowlists, Cursor ships model-access
  policy. [E]

**Question for ticket 08.** Does the AgentTemplate dimension carry a provenance roll-up, and if so how
does it avoid the cardinality problem Anthropic solved by redaction — a problem the field has met and
answered by *removing* information rather than by bucketing it?

---

### G6. Peer-aggregate comparison for a non-admin

**What the field does not expose.** §3.4 found no shipped grant equivalent to "other teams'
totals, never resolved to names". The field offers cross-*organisation* benchmarking (DX's Direct
Benchmarking™, LinearB's 8.1M-PR benchmarks, Jellyfish Benchmarks, DX's 435-company Q4 report) and
*within*-organisation named visibility for admins, with essentially nothing in between. [E] Amp is
the one product that runs the other way, defaulting threads to workspace-wide visibility; Devin,
Anthropic, Augment, Cursor and DX ship `self`, permission-gated and mostly off by default. [E]

[R] The interesting part is not that peer-aggregate is rare but that both adjacent grants are common.
Vendors built org-wide named visibility for admins and self visibility for members, and skipped the
cell between them. Whether that is a product judgement or simply nobody's roadmap is not something
documentation can answer.

**Who would value it.**
- *Individual contributor* — high. A distribution to sit inside answers "is my usage normal?" without
  requiring anyone to be named. It is also the grant with the least legal friction: §3.5 records that
  German §87(1)(6) BetrVG co-determination attaches to systems monitoring individual behaviour or
  performance, and Factory's aggregate mode exists precisely for jurisdictions where per-individual
  analytics is forbidden. [E for the legal framing; R for the inference]
- *Team lead* — moderate. Leads generally already have named access. [R]
- *FinOps owner* — low. Distribution shape matters less than allocation. [R]

**Question for ticket 05, and for whoever owns the access model.** Is a peer-aggregate view in scope
— and if so, what is the minimum population size below which an "aggregate" stops being one? GitHub's
≥5-seat rule is the only k-anonymity threshold found anywhere in the hyperscaler corpus, and §F21
records that it now suppresses a join key rather than protecting a person. Google, Amazon, Anthropic,
Cursor and Zencoder document no threshold at all.

---

### G7. Alerting on anything other than money

**What the field does not expose.** §4.3 inventories every alert, digest and block found: **all of
them fire on spend or quota.** Not one fires on a rising failure rate, a collapsing success rate, a
rework spike or a quality regression. [E] The nearest exceptions all sit outside class A: Vantage,
CloudZero, Finout and Datadog ship cost *anomaly* detection; LiteLLM ships per-user spend anomaly
detection (3× the trailing 7-day average, $10 floor, off by default) — still a money signal; Google's
Gemini Enterprise dev-tools dashboard offers per-chart "Create alert policy" against Cloud
Monitoring, which could in principle target `error_type`; and Anthropic *recommends* alerting on
refusal rate and tool rejection rate in its OTel documentation without shipping it. [E]

**Who would value it.**
- *Individual contributor* — low. Alerts about oneself, delivered to oneself, are a narrow genre.
  Devin Coach is the counter-example and it intervenes *before* the spend rather than alerting after.
  [R]
- *Team lead* — high. The class of thing a lead wants to be told about — "this repository's success
  rate halved this week" — has no shipped precedent anywhere in the survey. [R]
- *FinOps owner* — already served, comprehensively. [R]

**Question for ticket 05.** If any metric is intended to be *watched* rather than *browsed*, which
one, and on what basis is a change in it distinguishable from noise? Every vendor that ships anomaly
detection had to answer this with an explicit floor — Vantage's static $5 plus 0.5% of report daily
cost plus a 20%-over-trailing-7-day rule, Datadog's minimum daily cost of 5, LiteLLM's $10.

---

### G8. Reconciling estimate to invoice

**What the field does not expose.** Almost every product labels cost estimated (§4.4) and then stops.
[E] Two exceptions define the shape of the gap: Cursor returns estimated `tokenUsage.totalCents` and
actual `chargedCents` plus `discountPercentOff` on the same row, and documents "To reconcile
event-level costs with `/teams/spend` totals, sum the `chargedCents` field across events"; and
Vantage's Custom LLM Enrichment apportions an authoritative billed total by token share with the
guarantee that "the sum of the enriched rows always equals the original cost row to the cent",
carrying unattributed spend in an explicit **leftover** row. [E] Anthropic's `modelPricing` managed
setting is a third approach — inject the org's contracted rates so client-side figures match. [E]

[R] The published error rates make this concrete rather than theoretical: recomputed Anthropic
caching cost at ~40% of true spend (OTel issue #484 citing langfuse#13807); LiteLLM's own guidance
that "A delta under ~10% is often explained by boundary effects and rounding. A delta over ~10%
usually means something is miscounted"; Anthropic's four documented client-side billing defects; and
the seat blind spot in §6.4.6, where usage-derived cost omits the seat fee entirely.

**Who would value it.**
- *Individual contributor* — low, except negatively: a figure attributed to a named person that is
  wrong by 40% is worse than no figure. [R]
- *Team lead* — moderate. [R]
- *FinOps owner* — very high. This is the FinOps owner's core professional concern, and FOCUS models
  it with four distinct cost columns (`BilledCost`, `EffectiveCost`, `ListCost`, `ContractedCost`) and
  **no estimated-cost concept at all**. [E]

**Question for ticket 05.** Where an illustrative rate card produces a cost figure, is the figure
presented as a single number, or does the metric set carry the estimate/actual distinction the field
found it necessary to model? Note that this repo's rate cards are declared illustrative, which makes
the question one about *presentation of uncertainty* rather than about reconciliation to a real
invoice.

---

### G9. The IC's own view

**What the field does not expose, and where it is changing.** Self-visibility is the fastest-growing
grant in the survey and is **uniformly opt-in, and usually off by default**: Devin's Personal
Analytics requires a named "View Personal Analytics" permission and is off by default; Anthropic's
individual member usage is an admin toggle (default On only since 2026-07-11) and only on
usage-based Enterprise plans; Augment's "My Usage", Cursor's own-usage view and Codex's per-user
settings page are plan entitlements. [E] What no product ships is an IC view that answers a question
the IC actually has rather than a smaller copy of the admin's view — with one exception, Devin
Coach, which surfaces a suggestion *in the input box before the prompt is sent* and gives the member
their own efficiency score and suggestion outcomes on the same page. [E]

**Who would value it.** By construction, the individual contributor. [R] The evidence that ICs want
*something* is oblique but real: `viberank.app` exists, is voluntary, ranks 1.2K self-submitting
developers by spend across five different tools, and nobody's employer asked for it. [E]

**Question for ticket 05, and for ticket 06 where role presets are decided.** If an IC-facing view is
in scope, is its metric set the same as the admin's at a narrower subject scope, or a different metric
set entirely? The field has one precedent for each answer — Anthropic and Augment do the former,
Devin Coach does the latter — and they are not variations on a theme.

---

### G10. Anything about quality

**What the field does not expose.** No class-A or class-B product in the survey exposes a defect
rate, a revert rate, a change-failure rate, a security-finding rate, or any other quality signal about
agent output. [E] The closest shipped things are OpenAI's Code Review comments bucketed **P0/P1/P2**
with reply-and-reaction sentiment, Cursor's Bugbot findings-per-review, Swarmia's "findings per PR",
and Devin's per-session Issues Detected with impact ratings — all of which measure *review activity*
rather than defects in production. [E] Quality lives entirely in class C: LinearB's PR Maturity and
PR Without Review, Jellyfish's code quality, DX's change failure rate and code maintainability,
GitClear's eight maintainability signals, DORA's stability keys. [E]

[R] And this is where the evidence is most one-sided. Uplevel measured a 41% increase in bugs; DX
reports "Some teams are shipping up to 50% more defects since AI adoption"; Faros found +9% bugs per
developer and a quality gap "widening as adoption deepens"; GitClear found refactoring down 70% and
duplication up 81%; DORA found a persistent negative relationship with delivery stability across two
consecutive years even as the throughput sign flipped. The signal the evidence most consistently
implicates is the signal the platforms most consistently omit.

**Who would value it.**
- *Individual contributor* — low as a personal metric, high as a team-level one. [R]
- *Team lead* — very high. [R]
- *FinOps owner* — moderate, and only when joined to cost, at which point it becomes G3. [R]

**Question for tickets 05 and 08.** Is any quality signal in scope, and if so, does it come from
inside the platform's own data (where the only available proxies are review-activity counts) or from
Git and incident systems (where the research-backed signals live, at the cost of a dependency the
platform does not own)?

---

### G11. Model-mix as an actionable lever rather than a breakdown

**What the field does not expose.** Model appears everywhere as a flat group-by (§3.2), and the
capability ordering the field invented for *pricing* — Zencoder's 0.25×–5× multipliers, GitHub's
legacy 0.25×–57× table, Kiro's multipliers — is not exposed as an analytics roll-up anywhere. [E]
Only two products connect model choice to an action: Devin Coach's "Heavyweight mode" suggestion,
which fires when "a heavyweight mode like Ultra is selected for a small, simple task (e.g. a one-line
copy change)" and offers a **Switch mode** action; and Cursor's Auto routing with Cost / Balance /
Intelligence modes. [E]

[R] `CONTEXT.md` records that the ~200× input-price spread across tiers is why model mix, not token
volume, dominates cost variance. The field's own pricing tables are consistent with that: Zencoder's
published range is 20× and GitHub's legacy multiplier range is 228×. What the field has not done is
turn that into a reporting surface — the multiplier is applied at purchase time and disappears.

**Who would value it.**
- *Individual contributor* — moderate. Devin Coach's existence is evidence a vendor believes ICs act
  on this if told at the right moment. [E]
- *Team lead* — high. [R]
- *FinOps owner* — very high. It is the largest controllable variable in the cost model. [R]

**Question for ticket 08.** Do the Model roll-up levels exist to support a *breakdown* or a
*comparison* — and if the latter, does a tier-level view need a normalising denominator (cost per
task at each tier) to say anything, given that a tier's share of spend is uninformative without
knowing what work it did?

---

### G12. Seat cost

**What the field does not expose.** §6.4.6: three independent vendors document that seat and
subscription fees are invisible to usage APIs or hand-entered. Finout's Cursor seat cost "is **an
estimate**… does not sync with your actual Cursor contract"; "Codex Enterprise seat fees aren't
included"; Anthropic's spend export "only reflects spend that exceeds your seat allotment"; CloudZero
on OpenAI: "Usage that falls inside a seat's included allowance carries no cost from OpenAI, so it
does not appear as spend." [E]

[R] The consequence is systematic and directional: any cost-per-engineer built on usage telemetry
under-reports by the seat fee plus whatever the seat allowance absorbed — which for a *low*-usage
engineer is close to their entire cost. A usage-derived cost ranking therefore does not just
mis-measure the total, it distorts the ordering, compressing exactly the low end that seat-economics
decisions care about.

**Who would value it.** Overwhelmingly the **FinOps owner**, and secondarily the **team lead** making
seat-reallocation decisions — which §4.2 shows is the single most concretely-marketed use of these
dashboards across the field (Zencoder "Reallocate seats", Swarmia's idle seats, AWS's inactive-user
playbook, Google's automatic licence reclaim). [E]

**Question for ticket 05.** If Cost is derived from TokenUsage against a rate card, does the metric
set acknowledge a fixed component, or is Cost defined as marginal consumption only? The field
answers this inconsistently and mostly by omission, and the omission is the reason seat-based and
usage-based orgs cannot compare their numbers.

---

### G13. What the individual actually did

**What the field does not expose, deliberately.** Every vendor draws a line between analytics and
content, and most state it. Anthropic redacts prompts, responses, tool details and tool content by
default in OTel export; OpenAI keeps prompt text in a Compliance API with 30-day retention and the
instruction "It's not a productivity dashboard. Don't use it to infer code quality or individual
performance"; Google's prompt-and-response logging is a separate admin toggle from metadata logging;
Amazon and Kiro put prompt logs in the customer's own S3 with left/right code context. [E]

[R] Recorded here not as a gap to fill but because it is the one place the field has *converged on a
boundary* rather than on a metric — and because the boundary is drawn in the same place by five
vendors independently. Anything that reasons about the surrounding decisions inherits it as context.

**Question for ticket 05, if any.** None. The field's answer here is consistent enough that there is
nothing open to ask.

---

## 10. Evidence quality and known gaps in this brief

### 10.1 What is strong

[R] Assessed honestly, by area:

- **Anthropic, Cursor, Devin, Zencoder, GitHub, Google, Amazon/Kiro, OpenAI** — strong. Read directly
  from first-party documentation, admin API references and changelogs, in most cases including exact
  field names, default sort orders, response shapes and verbatim purpose statements. Dates are
  documented rather than inferred.
- **FOCUS and the FinOps Framework** — strong. Read from the specification repository including the
  1.5 working draft, plus first-party Framework capability pages.
- **LiteLLM** — strong, read from the source repository at a pinned commit including the Prisma
  schema, alert-type enums and UI code comments.
- **OpenTelemetry GenAI** — strong, including open issues and PRs, which is where the unresolved
  questions actually live.
- **The research corpus** (METR, DORA, GitClear, Faros, LinearB, DX, Uplevel, Stanford, the two
  arXiv preprints) — strong on figures and dates.
- **The deprecation and walk-back timeline** — strong, and the most durable part of this brief, since
  dated sunset notices do not become less true.

### 10.2 What is weak, and exactly how

- **Quote fidelity varies by extraction path.** A substantial share of quotations were extracted
  through a summarising fetch layer rather than read from raw HTML. They should be treated as
  high-fidelity but re-verified before republication anywhere the exact wording is load-bearing. The
  quotes read directly from raw markdown or cloned repositories — Zencoder, Devin, Amp, FOCUS,
  LiteLLM, OpenTelemetry, Anthropic's `code.claude.com` and `platform.claude.com` pages — are
  verbatim.
- **OpenAI's Codex specifics rest partly on an archive.** `platform.openai.com`, `openai.com/index/*`
  and `help.openai.com` return 403 to fetchers, and `chatgpt.com/public/admin/api-reference` is
  auth-gated. The Codex analytics dashboard chart list, the Analytics API endpoint list and the
  "What it does not provide" quotes — including F23, one of this brief's headline findings — come
  from a **2026-07-03 Wayback snapshot** of `developers.openai.com/codex/enterprise/governance`. The
  live page has since been rewritten to defer entirely to the gated reference. **F23 should be
  re-verified against the authenticated reference before being relied on.**
- **Anthropic's post-2025 rate-limit sequence** (the 2026-05-06 doubling, the mid-2026 promotion, the
  2026-09-14 permanent reset) is from secondary press, not Anthropic support pages.
- **Amp's leaderboard is unconfirmed.** `ampcode.com/leaderboard` exists as a route but is auth-gated,
  and the term does not appear in current documentation. Whether Amp ships one, on what metric, and
  whether it names individuals, is open — and its absence from current docs may indicate deprecation.
- **Cursor's own two documentation pages contradict each other** on whether non-admin members can see
  the Usage Leaderboard. That determines whether the ranking is a management tool or a peer-visible
  social object, and it is unresolved.
- **Zencoder's pricing page and docs page disagree** on the plan gate for Analytics — "Pro Plus" on
  one, "Core or higher" on the other.
- **Antigravity's org tier is contradicted within Google's own site**: `antigravity.google/docs/plans`
  says "There is currently no support for: … Organizational tiers via contract" while
  `antigravity.google/pricing` advertises "New! Organization plan via Google Cloud".
- **Google's Code Assist metric list is internally inconsistent** — the Cloud Monitoring reference
  lists 10 metrics, the Code Assist docs page lists 13 with variant names. Unresolved.
- **DORA 2024's effect sizes** (+2.1% / +2.6% / −1.5% / −7.2%) were taken from first-party summaries,
  not the gated PDF. The DORA AI Capabilities Model's seventh capability renders inconsistently
  across two first-party summaries.
- **Pluralsight Flow's EOL wording** is reproduced consistently across secondary write-ups; the
  first-party Appfire notice was not retrieved. Same for Code Climate Velocity's sunset page.
- **DX's AI Measurement Framework and DX Core 4 whitepapers are gated PDFs**; their metric lists were
  reconstructed from DX's own public blog and newsletter pages.
- **Gartner's "Use These 3 Metrics to Measure Software Engineering Agentic AI Success" is paywalled**
  and was not read.
- **Cline's "TOP SPENDING USERS" panel is a marketing screenshot**, not documentation. It is strong
  evidence of what the vendor believes is compelling and weaker evidence of exactly what ships.
- **The legal framing in §3.5** (BetrVG §87(1)(6), EU AI Act high-risk classification) is from
  secondary practitioner sources, not primary statute. Directional only.
- **`viberank.app` figures** (1.2K developers, $12.5M, 14.2T tokens) are self-reported by a community
  site with no audit. Cited as evidence that the artefact exists and is popular, not for the numbers.

### 10.3 What was not covered

- **IBM Apptio Cloudability's per-user AI attribution** — help pages behind auth; not found either way.
- **Kubecost's hosted docs** (Alerts, Budgets, Reports, GPU Allocation) are JavaScript-rendered and
  were not retrievable.
- **Google Workspace Gemini audit-log BigQuery export schema**, and whether Gemini Enterprise's
  `analytics:exportMetrics` carries User-Level rows for allowlisted orgs.
- **Gemini Enterprise Agent Platform** as Antigravity's org route — identified, not investigated.
- **Jules' strategic status** after Google's June 2026 Antigravity consolidation. Its changelog
  appears frozen at 2026-03-09.
- **Amazon Q Developer's user-activity CSV identity column name** is undocumented (Kiro documents
  both `UserId` and `User_Email`).
- **Salesforce's Agentic Work Units** and **Shopify's leaderboard removal** are known only through
  DORA's June 2026 citation, not from primary sources. The Shopify item is the survey's only reported
  instance of an organisation retiring a leaderboard, so it is worth more verification than it got.
- **Non-English-language markets** were not surveyed at all.
- **Actual usage data.** Everything here is documentation, marketing and research. Nobody in this
  survey published what their customers *do* with these dashboards, and no telemetry about dashboard
  use exists in public. Every actionability claim in §5 is therefore an inference about vendor
  belief, as §5.1 states, and none of it is evidence about behaviour.

### 10.4 Systematic biases in this brief

[R] Three, stated plainly:

1. **Documentation over-represents what vendors are proud of.** A feature that ships badly and a
   feature that ships well read identically in docs. The deprecation timeline in §7 is the only part
   of this brief that partially corrects for that, which is why it is worth its length.
2. **The survey is skewed toward vendors with good documentation.** Anthropic, Cursor, Devin,
   GitHub, Google and the FinOps Foundation publish extensively; several smaller vendors were assessed
   on marketing pages. The depth of a row here is partly a measure of a vendor's technical-writing
   budget.
3. **Recency asymmetry.** Roughly half the dated facts in this brief are from 2026, and the field is
   changing fast enough that §7 documents six metering-unit changes and four API sunsets within
   eighteen months. Anything time-sensitive is dated inline; anything undated should be read as
   "as of 2026-09-05" and re-checked.

---

## Source index

Grouped by class. All URLs read between 2026-09-05 and the writing of this brief unless a snapshot
date is given.

### Anthropic
- `https://code.claude.com/docs/en/analytics` — Claude Code analytics dashboards, leaderboard, PR attribution
- `https://code.claude.com/docs/en/monitoring-usage` — OpenTelemetry metrics, attributes, events, suggested alerts
- `https://code.claude.com/docs/en/costs` — cost management routing table, spend caps, `modelPricing`
- `https://code.claude.com/docs/en/claude-code-on-the-web` — remote sessions, `is_remote`, no separate VM charge
- `https://code.claude.com/docs/en/agent-sdk/cost-tracking` — client-side estimate warnings
- `https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api` — per-user-per-day endpoint
- `https://platform.claude.com/docs/en/manage-claude/usage-cost-api` — bucket widths, group-bys, cost limitations, partner list
- `https://platform.claude.com/docs/en/api/admin/analytics` — Enterprise Analytics API, `user_cost_report`, `user_usage_report`
- `https://platform.claude.com/docs/en/manage-claude/analytics-api` — key types
- `https://support.claude.com/en/articles/12883420-view-usage-analytics-for-team-and-enterprise-plans` — spend report CSV incl. `Model family`, spend concentration
- `https://support.claude.com/en/articles/12157520-claude-code-usage-analytics` — Usage / Value / Contribution tabs
- `https://claude.com/blog/giving-admins-more-visibility-and-control-over-claude-usage-and-spend` (2026-07-02) — per-user spend limits, 75/90 and 75/95 thresholds
- `https://x.com/AnthropicAI/status/1949898502688903593` (2025-07-28) — weekly rate limits announcement

### OpenAI
- `https://learn.chatgpt.com/docs/enterprise/workspace-analytics.md` — four-surface routing table, export privacy warning
- `https://learn.chatgpt.com/docs/enterprise/analytics-api.md` — Codex Analytics API boundary
- `https://learn.chatgpt.com/docs/enterprise/governance.md` — surface selection
- `https://learn.chatgpt.com/docs/enterprise/compliance-api.md` — "not a productivity dashboard"
- `https://learn.chatgpt.com/docs/enterprise/usage-limits.md`, `.../chatgpt-work-usage-and-cost.md` — credits, overage, "not issued invoices"
- `https://learn.chatgpt.com/docs/pricing.md` — credits, five-hour message limits, Code Review metering
- `https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml` — usage/costs/spend-alert schemas
- `https://developers.openai.com/api/docs/changelog`, `.../deprecations`
- `http://web.archive.org/web/20260703073412/https://developers.openai.com/codex/enterprise/governance` — **archived 2026-07-03**; source of the "What it does not provide" quotes

### GitHub
- `https://docs.github.com/en/rest/copilot/copilot-usage-metrics`, `.../copilot-metrics`, `.../copilot-user-management`
- `https://docs.github.com/en/copilot/reference/copilot-usage-metrics/{copilot-usage-metrics,example-schema,team-level-metrics,interpret-copilot-metrics}`
- `https://docs.github.com/en/copilot/reference/metrics-data` — activity report columns
- `https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-organization/review-activity/review-user-activity-data` — default sort by last used
- `https://docs.github.com/en/billing/concepts/budgets-and-alerts` — user-scoped budgets, 75/90/100%
- `https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent`
- `https://docs.github.com/en/copilot/managing-copilot/monitoring-usage-and-entitlements/about-premium-requests`
- `https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/` — AI Credits rationale
- GitHub changelog posts dated 2024-10-30, 2025-02-21, 2025-07-18, 2025-10-28, 2025-11-05, 2025-12-05, **2026-01-29**, 2026-02-20, 2026-02-27, 2026-04-23, 2026-04-27, 2026-05-14, 2026-06-19, 2026-07-22, 2026-08-07
- `https://github.com/resources/insights/copilot-impact-dashboard` — adoption phases, "You can't move a curve you can't see"

### Google
- `https://knowledge.workspace.google.com/admin/generative-ai/review-gemini-usage-in-your-organization` — **User-level usage report, top-10% bucket** (updated 2026-08-26)
- `https://workspaceupdates.googleblog.com/2026/02/view-gemini-feature-usage-and-threshold.html` (2026-02-16/17)
- `https://workspaceupdates.googleblog.com/2025/07/gemini-audit-logs-reporting-api-audit-and-security-invesitgation-tools.html`
- `https://docs.cloud.google.com/gemini/docs/codeassist/monitor-gemini-code-assist`, `.../log-gemini`, `.../configure-logging`, `.../generate-metrics`, `.../manage-licenses`, `.../business-audit-logging`, `.../quotas`, `.../release-notes`
- `https://docs.cloud.google.com/monitoring/api/metrics_gcp_c` — authoritative `cloudaicompanion` metric list
- `https://docs.cloud.google.com/gemini/enterprise/docs/ai-developer-tools-metrics` — Antigravity org metrics, per-chart alert policy, broken tool-call metrics
- `https://docs.cloud.google.com/gemini/enterprise/docs/view-analytics` — User Level tab, sales allowlist, Value tab
- `https://jules.google/docs/usage-limits/` — tasks per day; `https://antigravity.google/docs/plans`, `https://antigravity.google/pricing`

### Amazon
- `https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/{monitoring-overview,dashboard,dashboard-metrics-descriptions,q-admin-user-telemetry,user-activity-metrics,q-admin-prompt-logging,monitoring-cloudwatch,monitoring-telemetry,opt-out-IDE,service-rename}.html`
- `https://aws.amazon.com/blogs/devops/amazon-q-developer-end-of-support-announcement/` (2026-04-30)
- `https://aws.amazon.com/blogs/devops/unlocking-the-power-of-amazon-q-developer-metrics-driven-strategies-for-better-ai-coding/` (2025-05-23) — "Who are our power users?"
- `https://aws.amazon.com/blogs/devops/how-to-identify-inactive-users-of-amazon-q-developer/` (2024-10-04)
- `https://kiro.dev/docs/enterprise/monitor-and-track/{,dashboard,user-activity,user-activity/opentelemetry,prompt-logging}/`
- `https://kiro.dev/blog/{introducing-kiro,pricing-waitlist-updates,pricing-plans-are-live,important-pricing-updates,free-until-september-15,new-pricing-plans-and-auto,waitlist-is-over,general-availability,enterprise-identity-and-usage-metrics,cap-prepay-overage}/`
- `https://github.com/kirodotdev/Kiro/issues/2182`; `https://www.theregister.com/2025/07/21/aws_kiro_usage_cap/`; `https://www.theregister.com/software/2025/08/18/aws_pricing_for_kiro_dev_tool_a_wallet_wrecking_tragedy/1467855`
- `https://github.com/aws-samples/sample-kiro-user-analytics-dashboard` — "Top 10 Users" leaderboard
- `https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles.html` — tag-based attribution

### Cursor
- `https://cursor.com/docs/account/teams/{analytics,analytics-api,admin-api,dashboard,members}`
- `https://cursor.com/docs/models`, `https://cursor.com/pricing`
- `https://cursor.com/blog/june-2025-pricing` (2025-07-04) — the apology
- `https://cursor.com/blog/teams-pricing-june-2026` (2026-06-01)
- `https://cursor.com/help/account-and-billing/spend-limits`
- `https://forum.cursor.com/t/team-admins-now-can-control-spend-alerts-and-limits/145259` (2025-12-04)
- `https://techcrunch.com/2025/06/17/anysphere-launches-a-200-a-month-cursor-ai-coding-subscription/`

### Zencoder
- `https://docs.zencoder.ai/llms-full.txt` — full docs corpus incl. `features/analytics`, `features/analytics-api`, `admin/quota-management`, `admin/user-management`, `admin/billing`, `admin/overview`, `faq/pricing`, `clis/*`
- `https://zencoder.ai/` — "AI orchestration for code and work"
- `https://zencoder.ai/enterprise` — enterprise positioning
- `https://zencoder.ai/solutions/engineering-managers` — "Every metric is team-level. The dashboard never reports on individuals." / "The $100K analytics stack you don't need"
- `https://zencoder.ai/pricing` — credits, multipliers, plan gates

### Devin / Cognition (incl. Windsurf)
- `https://docs.devin.ai/llms.txt`
- `https://docs.devin.ai/product-guides/session-insights.md` — ACU, session size, categories, issue timeline
- `https://docs.devin.ai/enterprise/features/usage-policies.md` — tiers, efficiency scores, approvals, daily digest
- `https://docs.devin.ai/enterprise/features/devin-coach.md` — prompt-time suggestions, coach analytics, blockers
- `https://docs.devin.ai/enterprise/security-access/personal-analytics.md` — self scope
- `https://docs.devin.ai/admin/billing/{usage,enterprise,self-serve}.md`
- `https://docs.devin.ai/get-started/devin-intro`; `https://devin.ai/blog/windsurf-is-now-devin-desktop`
- `https://venturebeat.com/programming-development/devin-2-0-is-here-cognition-slashes-price-of-ai-software-engineer-to-20-per-month-from-500` (2025-04-03)

### Amp / Sourcegraph
- `https://ampcode.com/llms.txt`, `https://ampcode.com/docs/markdown/collaborate/workspaces` (lastModified 2026-08-28), `https://ampcode.com/docs/markdown/pricing` (2026-08-25)
- `https://ampcode.com/news/explain-usage` (2026-08-21)
- `https://sourcegraph.com/blog/why-sourcegraph-and-amp-are-becoming-independent-companies` (2025-12-02)
- `https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans`

### Other agent platforms and assistants
- `https://factory.ai/news/factory-analytics` (2026-03-11); `https://docs.factory.ai/enterprise/usage-cost-and-analytics` — `telemetry.granularity`
- `https://docs.augmentcode.com/analytics/{overview,credit-dashboard-and-quotas,analytics-api,api-reference}.md`; `https://www.augmentcode.com/blog/augment-codes-pricing-is-changing` (2025-10-20); `https://docs.augmentcode.com/models/token-based-pricing.md`
- `https://docs.tabnine.com/main/administering-tabnine/managing-your-team/reporting/usage-per-user-page.md`
- `https://www.jetbrains.com/help/jetbrains-console/{ai-credits-consumption,ai-adoption-and-usage,monitor-current-ai-credits-usage}.html`
- `https://docs.warp.dev/enterprise/enterprise-features/analytics-api/`
- `https://cline.bot/enterprise` — "TOP SPENDING USERS" screenshot
- `https://docs.replit.com/billing/{ai-billing,managing-spend}.md`, `.../teams-billing/analytics-dashboard.md`; `https://replit.com/blog/effort-based-pricing` (2025-06-18)
- `https://docs.lovable.dev/introduction/credits-and-usage`
- `https://docs.devin.ai/desktop/accounts/analytics` (ex-Windsurf); `https://docs.devin.ai/windsurf/plugins/guide-for-admins`
- Qodo, Roo/Roomote, OpenHands, Bolt — vendor docs and pricing pages

### Engineering analytics and research
- `https://getdx.com/platform/`, `https://docs.getdx.com/dashboard/overview/`, `https://newsletter.getdx.com/p/introducing-the-ai-measurement-framework` (2025-07-09), `https://newsletter.getdx.com/p/introducing-the-dx-core-4` (2024-12-10), `https://getdx.com/blog/ai-measurement-framework-guide/`, `.../measuring-developer-activity/` (2025-11-26), `.../ai-assisted-engineering-q4-impact-report-2025/` (2025-11-04), `.../measure-ai-impact/` (2026-05-19)
- `https://newsletter.pragmaticengineer.com/p/measuring-the-impact-of-ai-on-software` (2025-07-23) — Tacho on acceptance rate
- `https://linearb.io/resources/ai-insights-dashboard`, `https://linearb.helpdocs.io/article/t7tcdvx6iu-ai-metrics-explained`, `https://linearb.io/dev-interrupted/podcast/linearb-2026-benchmarks-ai-pr-merge-rate` (2026-03-24)
- `https://jellyfish.co/platform/jellyfish-ai-impact/`, `.../impact-insights/`, `https://jellyfish.co/blog/engineering-metrics-how-data-driven-management-can-go-wrong/`
- `https://www.swarmia.com/product/ai-impact/`, `https://help.swarmia.com/features/ai-tools/ai-adoption`, `https://www.swarmia.com/blog/dont-stack-rank-your-developers/` (2025-09-26), `.../buyers-guide-engineering-intelligence-platforms/` (2025-07-17), `https://www.swarmia.com/changelog/`
- `https://www.faros.ai/copilot-module`, `https://www.faros.ai/blog/ai-software-engineering` (2025-07-23), `https://www.faros.ai/research`, `https://www.faros.ai/blog/lab-vs-reality-ai-productivity-study-findings` (2025-07-28)
- `https://uplevelteam.com/blog/genai-developers` (2024-09-17)
- `https://www.gitclear.com/coding_on_copilot_data_shows_ais_downward_pressure_on_code_quality` (2024), `.../ai_assistant_code_quality_2025_research`, `.../the_ai_code_quality_maintainability_gap` (2026-06)
- `https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/`, `https://arxiv.org/abs/2507.09089`, `https://metr.org/blog/2026-02-24-uplift-update/`
- `https://dora.dev/research/2024/dora-report/`, `https://dora.dev/dora-report-2025/`, `https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report` (2025-09-24), `https://dora.dev/ai/capabilities-model/report/` (2025-11-25), `https://dora.dev/insights/finding-balance-in-the-era-of-tokenmaxxing/` (2026-06-02), `https://dora.dev/guides/how-to-empower-software-delivery-teams/`
- `https://arxiv.org/abs/2607.01904` (2026-07-02) — enterprise 2× mandate, 802 devs / 196k PRs
- `https://arxiv.org/abs/2606.20882` (2026-06-18) — authorship-based metrics
- `https://third-bit.com/2026/05/20/twelve-ways-to-be-wrong/` — Greg Wilson
- `https://leaddev.com/reporting/the-rise-and-looming-fall-of-acceptance-rate` (2025-07-10)
- `https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/` — SPACE
- `https://appfire.com/newsroom/appfire-acquires-flow` (2025-02-05); Pluralsight Flow EOL notice (secondary)
- `https://www.minware.com/blog/claude-code-usage-data` (2026-08-25) — practitioner account on what to capture and skip

### FinOps, cost platforms, gateways, standards
- `https://focus.finops.org/focus-specification/`; FOCUS spec repository (`FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec`, commit `511773f`, 2026-09-03) — column definitions, `RELEASE-PLANNING.md`, `CHANGELOG.md`, `specification/attributes/unit_format.md`, `specification/appendix/ai_model_identity_examples.md`, `.../saas_examples/virtual_currency_pricing_model.md`
- `https://www.finops.org/introduction/what-is-finops/`, `https://www.finops.org/framework/`, `.../capabilities/{unit-economics,invoicing-chargeback,allocation,anomaly-management,reporting-analytics}/`, `.../technology-categories/ai/`
- `https://www.finops.org/wg/finops-for-ai-overview/` (2026-02-17), `https://www.finops.org/wg/token-economics-saas/` (2026-06-03), `https://www.finops.org/insights/token-economics-the-atomic-unit-of-ai-value/` (2026-05-10), `https://www.finops.org/insights/2026-finops-framework/` (2026-03-19), `https://www.finops.org/insights/introducing-focus-1-4/`, `https://data.finops.org/` — State of FinOps 2026
- `https://www.linuxfoundation.org/press/linux-foundation-announces-tokenomicon-...` (2026-06-10)
- `https://docs.cloudzero.com/docs/{connections-anthropic,connecting-to-openai,connections-cursor,notifications}.md`; `https://www.cloudzero.com/`; `https://www.cloudzero.com/blog/engineer-ai-spend-5000-per-month/` (Bill Buckley, 2026-05-07)
- `https://docs.vantage.sh/{connecting_anthropic,connecting_cursor,connecting_open_ai,custom_llm_enrichment}`; `https://www.vantage.sh/blog/agentic-coding-efficiency` (2026-04-24); `https://www.vantage.sh/blog/anthropic-analytics` (2026-07-02)
- `https://docs.finout.io/billing-integrations/ai-providers/*`; `https://www.finout.io/`
- `https://docs.datadoghq.com/cloud_cost_management/ai_costs`; `https://docs.datadoghq.com/llm_observability/monitoring/metrics/`; Datadog AI Impact (Preview) docs
- `https://opencost.io/blog/opencost-llmd-inference-cost` (2026-07-21); `https://www.apptio.com/products/cloudability/`
- `https://docs.litellm.ai/docs/proxy/cost_tracking`; LiteLLM repository (`BerriAI/litellm`, commit `17e1312`, v1.101.0) — `schema.prisma`, `litellm/types/integrations/slack_alerting.py`, `litellm/integrations/SlackAlerting/user_spend_alerts.py`, admin UI sources
- `https://docs.helicone.ai/rest/user/post-v1usermetricsquery`, `https://docs.helicone.ai/references/how-we-calculate-cost`, `https://helicone.ai/pricing`
- `https://langfuse.com/docs/observability/features/users.md` and Langfuse cost-tracking docs; `https://github.com/langfuse/langfuse/issues/13807`
- Portkey docs (analytics, budgets, usage-and-rate-limit policies, coding-agents governance page)
- `https://openrouter.ai/docs/cookbook/administration/analytics-cost-control` and OpenRouter credits/activity docs
- Braintrust `https://braintrust.dev/docs/deploy/monitor`; W&B Weave `https://weave-docs.wandb.ai/guides/tracking/costs`; Arize Phoenix `https://arize.com/docs/phoenix/tracing/how-to-tracing/cost-tracking`
- OpenTelemetry: `https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/` (moved notice); `open-telemetry/semantic-conventions-genai` repository at commit `94f432d` (2026-09-03) — `docs/gen-ai/gen-ai-metrics.md`, attribute registry, issues #287 / #484, PR #443; core semconv v1.27.0 changelog (2024-08-02) for the prompt→input rename; core semconv v1.42.0 (2026-06-12) for the repository split

### Community / practitioner
- `https://www.viberank.app/` — public cross-vendor spend leaderboard with named individuals
- `https://ccgather.com/` — community Claude Code stats leaderboard (noted, not analysed)
- German works-council and EU AI Act framing — secondary practitioner sources, directional only

---

## Reconciliation with briefs 01 and 02

**Written second, appended, body unedited.** Everything above this heading was written and saved
before briefs 01 and 02 were opened. Nothing above has been revised in light of them. This section
is the diff.

### R0. The limitation, stated before the claims

[R] `CONTEXT.md` — which this brief was handed and used — already carries brief 02's conclusions in
prose: the four-plus token classes, the OpenAI-superset-versus-Anthropic-disjoint hazard, the cache-
write TTL split, the ~200× tier price spread, the estimated-cost convention, the usage-to-the-minute
versus cost-at-daily-grain asymmetry, and the assertion that family and tier roll-ups have no vendor
precedent.

**On those specific points this brief cannot claim independent corroboration, and does not.** Having
read them in the glossary, the researcher went looking in a space where they were already known to be
true. What the diff *can* legitimately do on that axis is catch **contradictions** — cases where the
field has moved or where the earlier reading was too strong. Three are recorded below (R7, R8, R9),
and one of them matters.

Everywhere else — actionability, prominence, ranking, alerting, reporting artefacts, deprecations,
audience, and the whole FinOps and standards layer — the corroboration claim holds normally, because
`CONTEXT.md` says nothing about any of it.

---

### R1. Independent corroboration — efficacy is a category-wide blank

Brief 01 §2.6(a): *"Across every platform above, agent success/failure/retry as a first-class metric
is essentially absent… Nobody surveyed exposes a labelled 'task succeeded / failed' field or a retry
count."* Brief 02 §9(10): *"Nothing found on how any vendor presents 'rework' or retry cost… If model
mix is under-served by vendors, attempt-vs-task is unserved entirely."*

This brief reached the same conclusion from a different vendor set and by a different route — F12,
G1 and G2 — and adds three things the earlier briefs did not have:

- **The mechanism.** §8.4 and G2 argue the absence is structural rather than ideological: acceptance
  is observable at the moment of the diff, rework only weeks later in Git, and class-A vendors do not
  read Git. Anthropic's GitHub-integrated contribution metrics are the sole class-A surface that
  reads Git, and it is used for attribution, not rework.
- **Where the signal does live.** LinearB's **PR Rework**, Faros's **retry-loop token waste** and
  **cost per verified outcome**, GitClear's two-week churn, Stanford's ~3-week rework window — and
  DORA's own June 2026 recommendation to pair the four keys with *"cost per accepted change and code
  rework rates."*
- **The convergence.** §8.3 records that four independent research groups operationalised rework
  almost identically (code re-changed within two to three weeks). Brief 01 §1.1 noted LinearB's
  Rework Rate is *code* rework rather than *attempt* rework; this brief adds that the research
  literature has settled on the code-rework definition, which sharpens brief 01's distinction rather
  than dissolving it.

[R] Two independent passes, five months of vendor churn apart in documentation terms, reaching the
same blank. That is about as strong as a negative finding gets from documentation alone.

### R2. Independent corroboration — acceptance is the dominant proxy and it is contested

Brief 01 §2.6(b) and §4.4. This brief corroborates the prevalence (F1, §3.1) across a wider vendor
set, and **materially strengthens the critique side**, which brief 01 explicitly flagged as weak:
brief 01 §4.4 called the acceptance-rate critique *"folklore, not fact"* for want of primary
sources.

This brief supplies them:

- **OpenAI's own documentation** listing acceptance rate under "What it does not provide", with the
  reason *"almost 100% since users usually accept the change first"* (F23).
- **JetBrains' own documentation** conceding the metric *"currently counts code as accepted even if
  the user later deletes or edits it, potentially inflating values."*
- **DX's published exclusion** of acceptance rate from its framework, with Laura Tacho's reasoning.
- **LeadDev (2025-07-10)**, quoting Tacho, GitLab's Sabrina Farmer and JFrog's Yonatan Arbel, on
  acceptance rate as *"a game of compliance."*
- **Greg Wilson (2026-05-20)**: *"Acceptance measures whether the generated code looked plausible
  enough for a developer to press Tab; it does not measure whether the code was correct, secure, or
  maintainable."*

[R] Brief 01's caution was right at the time and is now over-cautious. The critique has primary
first-party sourcing — from two vendors who ship the metric and one who refuses to.

### R3. Independent corroboration — named-individual grain is the norm

Brief 01 §2.6(c). This brief corroborates it emphatically and extends it (F2, §3.5) with vendors
brief 01 did not survey — Cline, Factory, Warp, Kiro, Lovable, Zencoder, Amazon Q — and with the API
default-sort finding (Anthropic's `user_cost_report` defaulting to `amount` descending; OpenAI's
Codex `/usage` returning per-user rows unless you opt out with `group=workspace`).

Brief 01 §1.4's central observation — that the stated position is about **use** while the product
position is about **default visibility**, and the category has not settled which carries the
commitment — is independently reproduced here at §3.5 and F3, and extended: this brief finds exactly
**two** structurally non-attributing products (Qodo; Zencoder's Engineering Manager Dashboard) and
exactly **one** documented identity-stripping switch (Factory's `telemetry.granularity: aggregate`),
against a field of roughly thirty. Brief 01 found neither category, because none of those three
vendors was in its pass.

### R4. Independent corroboration — cost is role-gated in engineering analytics

Brief 01 §1.5, on effort-cost being gated behind Privileged User / Finance Manager / Viewer-denied
roles. This brief did not re-examine capitalisation gating, so it neither confirms nor disputes it.
What it adds is the **adjacent** finding from the FinOps layer (§6.4.1): the FinOps Foundation's
Allocation capability defines allocation over "Accounts, Projects, Folders, Subscriptions,
Departments, Organizational Units" and tags, and **never names individuals as an allocation target**;
FOCUS has no user column at any version through the 1.5 draft. [R] So the gating brief 01 observed
in engineering-analytics products has a doctrinal counterpart one layer up: the standards body that
defines cost allocation stops at the cost centre. Two different bodies of evidence pointing the same
way, gathered independently.

### R5. Independent corroboration — the research base

METR's 19% and the ~40-point perception gap; METR's 2026-02-24 design-change post; DORA 2024's
−7.2% stability and the 2025 amplifier reframe; GitClear's 2025 and 2026 figures; SPACE. All match
between briefs, including the numbers.

Two additions from this brief:

- **The METR follow-up's actual conclusion.** Brief 01 §5.2 records the 2026-02-24 post as evidence
  that METR *"treats the 19% as one data point under active methodological revision."* This brief
  quotes what the post says: *"we believe that the data from our new experiment gives us an
  unreliable signal of the current productivity effect of AI tools"*, caused by 30–50% of developers
  refusing to submit tasks they wanted AI for. [R] §8.1 draws the consequence: the field's
  gold-standard experimental design has been abandoned by its own authors because AI use is no
  longer optional enough to withhold, which leaves observational org-level analytics as the only
  feasible evidence base — the exact thing every vendor in both surveys sells.
- **Brief 01 §5.5 flagged Denisov-Blanch as *"conference-talk level, no located paper."*** This brief
  locates a peer-reviewed follow-up from the same cluster: He, Agarwal, Denisov-Blanch, Azaletskiy,
  Koyejo, Vasilescu, arXiv 2607.01904 (2026-07-02), 802 developers, 196,212 PRs, 28 months. It does
  not validate the 15–20% headline, but it is primary evidence from the same group, and its finding —
  *"Per-reviewer load roughly doubled and automated review overtook human review"* — converges with
  Faros's +91% review time and LinearB's 5× pickup time (§8.3).

### R6. Independent corroboration of brief 01's *unresolved question*, from a source it did not survey

Brief 01 §9 closes on this: *"every documented failure is a failure of comparative, ranked per-person
cost. Nothing found isolates non-comparative visibility."* Brief 01 §7 records the same tension
between Gartner's governance argument and the tokenmaxxing episode as unreconciled.

This brief reaches the same distinction from a completely different direction — the FinOps vendor
layer, which brief 01 did not survey — and finds two vendors drawing exactly that line in public:

- **CloudZero's SVP Engineering, Bill Buckley (2026-05-07):** *"I'm skeptical of the leaderboard
  model. The engineer with the highest token bill isn't the most productive."* — while CloudZero
  ships per-individual Anthropic Enterprise cost ingestion.
- **Vantage (2026-04-24):** per-developer AI spend *"is also a numerator without a denominator"*,
  proposing `Cost per PR`; and (2026-03-27) *"Per-developer patterns aren't about creating a
  leaderboard of who spends the most. They're about spotting outliers and understanding why."*

[R] Both vendors ship the per-person data and publicly reject the ranking use of it. That is the
visibility-versus-comparison distinction brief 01 identified as the crux, articulated by practitioners
whose commercial incentive runs the other way. It does not resolve the question — it is still a human
decision on tickets 05 and 06 — but it is independent evidence that the distinction is the one the
market is actually arguing about, not an artefact of how brief 01 framed it.

[E] Buckley also corroborates brief 01 §6's Meta episode from a second, independent direction:
*"Meta stood up an internal token leaderboard, then shut it down when it got weird."*

---

### R7. **Contradiction — GitHub's ≥5 floor no longer protects individuals**

This is the most consequential disagreement between the briefs.

**Brief 01 §2.1** calls it *"the single most transferable finding in this section"*: org- and
team-level reports *"will only return results for a given day if the organization/team contained five
or more members with active Copilot licenses on that day"* — *"A hard numeric privacy floor of 5,
enforced by the API rather than by policy."* **Brief 01 §2.6(c)** builds on it: *"GitHub Copilot is
the outlier, with the documented five-member floor… an AI-platform dashboard that withholds
per-named-individual data is doing something the category does not currently do."*

**This brief finds that reading is no longer current.** F21 and §3.2:

- The endpoint carrying that floor — `/orgs/{org}/copilot/metrics` — was **sunset on 2026-04-02**,
  under a closing-down notice dated 2026-01-29 that also retired the User-level Feature Engagement
  Metrics API and the Direct Data Access API on 2026-03-02.
- In the replacement (GA 2026-02-27) the ≥5 rule survives **only on `user-teams-1-day`**: *"Teams
  with fewer than 5 seated Copilot users are excluded from the user-teams reports"* — while
  sub-threshold members' activity *"is still in the per-user usage metrics report."*
- [R] The threshold is therefore now a **join-key suppression, not a privacy floor**. It withholds a
  team row; it does not withhold a person.

[R] Brief 01's claim was accurate for the API it cited — note its own citation carries
`apiVersion=2026-03-10`, dated before the sunset. This is documentation drift caught by a second
pass, which is precisely what the clean-slate constraint was bought for. **The downstream inference
is what needs retiring, not the observation**: GitHub is no longer the category's privacy outlier,
and a product withholding per-named-individual data is now doing something *no surveyed vendor*
does, rather than something one large vendor also does.

[E] The k-anonymity picture across the hyperscalers, as this brief found it: GitHub's team rule is
the only documented threshold anywhere; **Google documents none** (its Gemini Enterprise User Level
tab is gated by a *sales allowlist*, not a cohort minimum); **Amazon documents none** (Q Developer's
1,000-rows-per-file split is a shard, not a floor); Anthropic, Cursor and Zencoder document none.

### R8. **Contradiction — `family` roll-ups now have precedent, in two places**

`CONTEXT.md` records, citing brief 02 §7 and §10: *"Every surveyed platform treats model as a flat
group-by; none offers a family or cross-vendor tier roll-up… This is a deliberate design bet, not an
inherited convention."*

This brief finds two counter-examples on the **family** half (F6, F18b, §3.3):

1. **Anthropic's Team/Enterprise spend report CSV carries a `Model family` column** alongside
   `Model`. First-party, shipped, in a reporting artefact.
2. **The FOCUS 1.5 working draft adds `ModelFamily`** — *"Grouping of related models as defined by
   the model developer"* — as a FOCUS-defined `SkuPriceDetails` property, alongside `ModelDeveloper`,
   `ModelId` and `ModelVersion`. Target Dec 2026, not ratified.

[R] This is exactly the class of finding R0 says the diff can legitimately catch: a contradiction on
an axis where corroboration was off-limits. It does not overturn the design bet, and it makes the
tier half **stronger**, not weaker:

- The **tier** half of the claim survives intact. No analytics API surveyed offers a cross-vendor
  capability roll-up, and FOCUS 1.5's draft explicitly declines the problem: `ModelId` is *"not
  guaranteed to match across service providers."*
- What the field *has* built is a cross-vendor capability ordering expressed as **price**, not as an
  analytics dimension — Zencoder's 0.25×–5× credit multipliers, GitHub's legacy 0.25×–57×
  premium-request table, Kiro's multipliers (F6). [R] So the ordering exists, three vendors publish
  one, and nobody exposes it as something you can group by. Whether the pricing ordering and an
  analytical tier ordering are the same ordering is a question no vendor has addressed.

[R] The accurate revised statement: **family is being standardised and has first-party precedent;
cross-vendor tier has none, and the standards body that is standardising family has flagged
cross-provider identity as unresolved.**

### R9. Contradictions of fact, minor, all of them documentation drift

| Brief 01 says | This brief finds | Reading |
|---|---|---|
| §2.1 *"Cost is a separate system. Premium Request Analytics (GA 30 Sept 2025)…"* | **Premium requests were retired as the unit on 2026-06-01**, replaced by AI Credits at 1 credit = $0.01, with the legacy multiplier table *increased* for annual holdouts. Brief 01's own field table lists `ai_credits_used` without connecting it to the unit change | drift; brief 01 saw the new field but not the retirement |
| §2.4 Gemini Code Assist: *"per-GCP-project aggregate, not per user"*; *"token counts but no dollar cost — the one exception in the survey"* | True of **Cloud Monitoring** only. The moment an admin enables Cloud Logging, `LogEntry.labels.user_id` carries the user (Google's own samples show `user@company.com`), and **Google publishes the BigQuery queries** — "List individual users by day", "User-level breakdown of daily usage". No cohort floor documented | true of one surface, false of the product |
| §2.4 Google Workspace Gemini reports: *"org-level and user-level usage"* | Materially understated. The **User-level usage** report is default-on for all Workspace customers since 2026-02-16 and assigns each named employee a vendor-computed bucket whose top tier is defined as *"only the top 10% of users with non-zero overall Gemini usage that have used it 20 times or more"*, with stated purpose *"Identify power users"* / *"Identify users with low adoption rates who might benefit from training"* (F2b) | under-read; this is the strongest ranking artefact in either survey |
| §2.4 Amp: a *"Leaderboard 'tracking activity and contributions'"*, cited to `ampcode.com/leaderboard` | That route is **auth-gated**, and the word does not appear anywhere in Amp's current documentation, including the workspace page (lastModified 2026-08-28). Whether Amp ships one, on what metric, and whether it names individuals, is **unconfirmed** — its absence from current docs may indicate deprecation | **the two briefs disagree and neither can settle it.** Flagged in §10.2 as an open item |
| §2.4 Windsurf as an independent vendor row | Windsurf is now **Devin Desktop**; `docs.windsurf.com/*` 307-redirects into `docs.devin.ai/desktop/*` and Devin's consumption API breaks out `acus_by_product` as `devin` / `cascade` / `terminal` / `review`. Brief 01 caught the redirect in a footnote but kept the separate row | brief 01's footnote was right; the row should collapse |
| §1.2 *"the 'four keys' have become five,"* with **Deployment Rework Rate** split out (CD Foundation, Oct 2025) | **This brief did not find that.** §8 discusses DORA throughout and refers to "the four keys" | **brief 01 is right and this brief is wrong.** Recorded as an error in this brief, not a disagreement. It also sharpens R1: DORA promoted rework to a headline metric a year before this brief observed that no agent platform ships one |

---

### R10. What this brief found that neither 01 nor 02 had

Ordered by how much it changes the picture.

1. **Google Workspace's default-on named-employee percentile bucket** (F2b, R9). The strongest
   ranking artefact in any of the three briefs.
2. **OpenAI's published refusal of lines-of-code and acceptance rate** (F23, F24, F25). Brief 01 §2.4
   records OpenAI's per-user ranking table; neither brief records that OpenAI documents *why it
   refuses the two metrics Anthropic leads with*, while keeping the ranking. Two comparable vendors,
   opposite published conclusions about the same two metrics.
3. **The closure of the developer-side opt-out across all three hyperscalers** (F21b) — Amazon's
   *"That setting controls whether telemetry can be used by the AWS corporation, not your
   organization"*, Kiro's *"can't be configured by users"*, Google's 2025-08-27 telemetry override,
   GitHub's server-side supplementation. Neither earlier brief examined developer-side controls at
   all.
4. **The full deprecation and walk-back timeline** (§7). Brief 01 has Copilot's two generations;
   this brief has four generations and three sunsets with dates, plus Amazon Q Developer's
   **2027-04-30 end of support**, Gemini Code Assist for individuals ending **2026-06-18**, Cody's
   deprecation, Pluralsight Flow's **2027-12-31** EOL, and **Kiro's spec/vibe request unit that
   existed for exactly one month** before being abolished after a metering bug and two rounds of full
   refunds.
5. **Devin's efficiency architecture** — per-member **efficiency scores** (Healthy / Satisfactory /
   Needs improvement / Unknown) **gating automatic budget approval**, Devin Coach's prompt-time
   interventions with admin analytics on suggestion acceptance, the blockers view, and **Personal
   Analytics** as an explicit `self`-scope grant. Brief 01 §2.4 has Devin's Session Insights; none of
   this. [R] It is the only worked example in the field of a signal fed back to the individual
   *before* the spend rather than reported after.
6. **The FinOps and standards layer entire** (§6.4) — FOCUS versions and the 1.5 AI draft, the
   Framework's AI Technology Category, `Cost Per Token` / `Cost Per Inference` KPIs, showback-versus-
   chargeback doctrine, the Tokenomics Foundation, State of FinOps 2026's **98% of respondents now
   manage AI spend**, and the four cost platforms that resolve AI cost to a named engineer out of the
   box. Brief 02 covered provider billing APIs; neither brief covered the buyer.
7. **OpenTelemetry GenAI's state** — the 2026-06-12 repository split, Development status with zero
   releases, **no cost attribute** (PR #443 open since 2026-08-09), **no user identity attribute at
   all**, `gen_ai.token.type` limited to `input | output`, and the inclusive-versus-exclusive contract
   inversion against Langfuse. Plus the empirical number: **recomputed Anthropic caching costs at
   ~40% of true spend** (F18c). [R] Brief 02 established that cost derived from telemetry is labelled
   estimated; this supplies the published magnitude of the error and its cause.
8. **The seat blind spot** (G12, §6.4.6) — three vendors independently documenting that seat fees are
   invisible to usage APIs, and the consequence that usage-derived cost-per-engineer does not merely
   mis-measure the total but **distorts the ordering**, compressing exactly the low end that
   seat-economics decisions turn on.
9. **Alerting is entirely financial** (F8, §4.3, G7) — a complete inventory across ~15 vendors, in
   which not one alert fires on an outcome. Neither earlier brief inventoried alerting.
10. **Zencoder's two-surface split** (F4) — a per-user Member Activity table on one product and *"Every
    metric is team-level. The dashboard never reports on individuals"* on another, from the same
    vendor. Brief 01 did not cover Zencoder.
11. **Qodo's structural non-attribution** and **Factory's `telemetry.granularity: aggregate`** — the
    only two products in the field that cannot, or will not, resolve to a person, the latter citing
    works-council jurisdictions.
12. **Vantage's Custom LLM Enrichment** — apportioning an authoritative billed total by token share
    with an explicit **leftover** row, *"so totals always reconcile and no dollars are lost."* [R] A
    materially different architecture from estimating cost, and the only worked answer found to
    brief 02's "null means unattributed" observation.
13. **`viberank.app`** — a public, voluntary, cross-vendor leaderboard ranking named developers by
    API spend with gamified tiers. [R] It complicates the assumption running through brief 01 §6 that
    spend-ranking is purely a management imposition.
14. **DORA's June 2026 "tokenmaxxing" post** — which recommends **"cost per accepted change and code
    rework rates"**, reports *"teams with the highest budgets often achieve only a marginal increase
    in software delivery throughput at a 10x increase in cost"*, and cites Salesforce's **Agentic
    Work Units** and **Shopify replacing leaderboards with usage dashboards plus "circuit breakers"**.
    [R] This partially answers brief 01 §8.2's stated gap — *"no high-trust primary source
    establishing or validating [cost per successful task] for coding agents was found"*. DORA is not
    validation that the metric works, but it is a high-trust source establishing it as the recommended
    unit. And Shopify is a **fourth** organisation for brief 01 §6's tokenmaxxing series, reached
    through an entirely different source.

### R11. What briefs 01 and 02 have that this brief does not

Recorded so the three are read together rather than substituted.

- **The tokenmaxxing episode in depth.** Brief 01 §6 has Meta's Claudeonomics (April 2026, 60
  trillion tokens, gamified tiers, shut down in ~2 days), Amazon's KiroRank (shut down 2026-05-29,
  Dave Treadwell's *"Please don't use AI just for the sake of using AI"*), and Microsoft's Jay Parikh
  memo (division-level budgets, *"Tokenmaxxing is not what we are optimizing for"*), with documented
  gaming behaviours. This brief reached the episode only obliquely, through DORA's citation and
  CloudZero's blog. **Brief 01 is the stronger source and should be read for it.**
- **Gartner's June 2026 numbers** and the counter-pressure argument — 23% of technology leaders at
  $200–500/developer/month, ~6% above $2,000, *"token discipline will not emerge through developer
  choice alone"*. This brief has no equivalent demand-side evidence.
- **The critique canon** — McKinsey versus Beck/Orosz/North, Fowler's CannotMeasureProductivity,
  Larson, the Goodhart/Strathern provenance, HBR's workslop. This brief has Wilson and LeadDev; brief
  01 has the rest, with provenance flags.
- **DORA's five-metric re-cut** including Deployment Rework Rate (R9). Missed here.
- **Brief 02's cloud-platform depth** — Vertex, Azure Foundry and Bedrock billing surfaces, CUR
  granularity, projected-spend mechanics, billing-period and timezone semantics, and the illustrative
  rate card. This brief did not re-examine any of it.
- **Brief 01's engineering-analytics role-gating detail** (§1.5) — the specific Privileged User /
  Finance Manager / Viewer grants. Not re-verified here.

### R12. Net assessment of the clean-slate exercise

[R] Stated plainly, since the ticket bought this artefact at the cost of re-buying settled findings.

**What convergence bought.** Three findings now have two independent derivations: efficacy is a
category-wide blank (R1), acceptance is the contested dominant proxy (R2), and named-individual grain
is the norm rather than the exception (R3). The first two were reached from different vendor sets and
different source types. [R] For a brief that will be groomed and then relied on, that is worth
something a single pass cannot provide.

**What divergence bought, which is more.** The exercise caught one materially stale finding that a
grooming pass would probably have preserved — GitHub's ≥5 floor as a privacy protection, which brief
01 called its most transferable finding and which the sunset of 2026-04-02 quietly voided (R7). It
caught a first-party contradiction of a `CONTEXT.md` claim that is currently defended as a deliberate
design bet (R8), and did so on the one axis where corroboration was ruled out in advance — which is
exactly the case R0 predicted the diff could still serve. And it surfaced the fourteen items in R10,
most of which sit in territory neither earlier ticket was scoped to cover.

**What it cost.** R11 is the honest ledger: the tokenmaxxing episode, Gartner, the critique canon and
brief 02's cloud-platform depth are all better in the earlier briefs, and this brief missed DORA's
fifth metric outright.

[R] The three briefs are complements, not substitutes. Where they disagree, prefer the later
observation on *product surfaces* — that is where the drift is, and §7 shows the churn rate — and
prefer brief 01 on *episodes, critique and provenance*, where the sourcing is deeper and the facts do
not decay.
