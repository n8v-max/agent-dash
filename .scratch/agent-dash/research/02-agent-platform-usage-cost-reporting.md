# How agent and LLM platforms report usage and cost

Type: research brief
Resolves: `.scratch/agent-dash/issues/02-agent-platform-usage-cost-reporting.md` (`wayfinder:research`)
Researched: 2026-09-05. **Every price and every API shape below was retrieved on 2026-09-05.**

**Findings only.** This brief does not propose a fixture schema, a metric set, or a dimension
taxonomy for this project — those are decisions on tickets 05, 08 and 10. Where a finding has an
obvious implication for `CONTEXT.md`'s model, it is flagged as *Bearing* and left there.

Vocabulary follows `CONTEXT.md`. Vendor terms are quoted in `code` when they are the vendor's own
field names; they are not synonyms for this project's terms.

---

## 1. Headline findings

1. **The industry has converged on a two-endpoint split: a *usage* report in tokens and a
   *cost* report in money, queried separately.** Anthropic and OpenAI ship near-identical
   APIs — same bucket widths (`1m` / `1h` / `1d`), same default/max bucket limits
   (7/31, 24/168, 60/1440), same opaque-cursor pagination, and in both cases **cost is available
   at daily grain only** while usage goes down to the minute.
2. **Token usage is never reported as a single number.** The minimum reported taxonomy is
   four classes — uncached input, cache read, cache write, output — and Anthropic splits cache
   writes further by TTL (5-minute vs 1-hour). This project's `TokenUsage`
   (`input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`) matches the
   common denominator exactly.
3. **Cache read/write tokens are first-class in both pricing and reporting, everywhere.**
   No vendor examined folds them into "input tokens" in its reporting surface.
4. **Model is a first-class group-by dimension on every usage/cost API examined**, but almost
   nobody presents "model mix" as a *named* metric. The exception is Cursor, which reports a
   per-user-per-day `mostUsedModel` scalar, and OpenRouter, which publishes token share by model
   as a public leaderboard.
5. **Cost is reported in minor units as decimal strings, not floats**, by both Anthropic
   (Analytics API: "decimal strings in cents") and Cursor (`spendCents`, `chargedCents`).
   Anthropic explicitly warns against binary floating-point parsing.
6. **Money and tokens are reconciled at *model × token-class* grain.** OpenAI's cost line items
   are literally strings like `"gpt-6-astra, input_tokens"`; Anthropic's Enterprise cost report
   can be grouped by `token_type` with values `uncached_input_tokens`, `cache_read_input_tokens`,
   `cache_creation.ephemeral_5m_input_tokens`, `cache_creation.ephemeral_1h_input_tokens`,
   `output_tokens`. **A rate card is not one price per model; it is one price per
   (model × token class × modifier).**
7. **Per-seat cost reporting on agent platforms is always labelled *estimated*.** Anthropic's
   Claude Code Analytics API field is `estimated_cost`; the Claude Code OpenTelemetry metric is
   documented as "estimated cost". Authoritative money lives in the billing pipeline, not the
   product telemetry.
8. **The billing period is the calendar month at 00:00 UTC nearly everywhere** — with one
   important exception: Cursor bills on a *subscription cycle* (`subscriptionCycleStart`), and
   OpenAI lets an Enterprise workspace choose between calendar-month-UTC and cycle-aligned.
9. **"Projected spend" is a forecast product, not an arithmetic run-rate, at the two vendors that
   ship it.** AWS states an 80% prediction interval and *refuses to forecast* without a full
   billing cycle of history; Google uses a seasonality-aware ML model and forecasts up to 12
   months out.
10. **Recent data is provisional and vendors say so.** Anthropic's Enterprise cost data "can be
    revised for up to 30 days" and every response carries a `data_refreshed_at` watermark.

---

## 2. The convergent reporting shape

### 2.1 Anthropic — Usage & Cost Admin API (the API-platform view)

Two endpoints, an Admin API key, org-scoped
([docs](https://platform.claude.com/docs/en/manage-claude/usage-cost-api), retrieved 2026-09-05):

- `GET /v1/organizations/usage_report/messages` — tokens
- `GET /v1/organizations/cost_report` — USD

Usage report
([reference](https://platform.claude.com/docs/en/api/admin-api/usage-cost/get-messages-usage-report),
retrieved 2026-09-05):

| Aspect | Value |
|---|---|
| Bucket widths | `1d` (default), `1h`, `1m` |
| Bucket limits | `1d`: default 7 / max 31 · `1h`: 24 / 168 · `1m`: 60 / 1440 |
| Bucket alignment | "Each time bucket will be snapped to the start of the minute/hour/day **in UTC**" |
| `group_by` | `account_id`, `api_key_id`, `context_window`, `inference_geo`, `model`, `service_account_id`, `service_tier`, `speed`, `workspace_id` |
| Token fields | `uncached_input_tokens`, `cache_read_input_tokens`, `cache_creation.ephemeral_5m_input_tokens`, `cache_creation.ephemeral_1h_input_tokens`, `output_tokens` |
| Non-token usage | `server_tool_use.web_search_requests` |
| Empty periods | buckets with no usage are returned with an empty `results` list |
| Freshness | "typically appears within 5 minutes of API request completion" |

Cost report: **daily granularity only** (`1d`), amounts "reported as decimal strings in lowest
units (cents)", groupable by `workspace_id` and `description`; grouping by `description` yields
parsed `model` and `inference_geo` fields. Two documented holes: **Priority Tier costs are absent
from the cost endpoint entirely** (you must infer them from usage), and **code execution appears in
cost but not in usage**. Console playground usage has a `null` `api_key_id`; the default workspace
has a `null` `workspace_id`.

*Bearing:* the "null means unattributed" pattern recurs at every vendor. Real cost data has an
unattributable residue.

### 2.2 OpenAI — Usage & Costs API

Same shape, independently arrived at. Verified against the published OpenAPI specification
([`openai/openai-openapi` `openapi.yaml`](https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml),
retrieved 2026-09-05) rather than the docs site, because `platform.openai.com` refuses automated
fetches.

`GET /v1/organization/usage/completions`:

- `bucket_width`: `1m` | `1h` | `1d` (default `1d`); limits `1d`: default 7 / max 31, `1h`: 24/168,
  `1m`: 60/1440 — **identical to Anthropic's**.
- `group_by`: `project_id`, `user_id`, `api_key_id`, `model`, `batch`, `service_tier`.
- `start_time` / `end_time` are **Unix seconds**, start inclusive / end exclusive.
- Result fields: `input_tokens` ("including cached and cache-write tokens"),
  `input_cached_tokens`, `input_cache_write_tokens`, `input_uncached_tokens`, `output_tokens`,
  plus per-modality splits (`input_text_tokens`, `input_audio_tokens`, `input_image_tokens`,
  `input_cached_text_tokens`, `output_audio_tokens`, `output_image_tokens`, …) and
  `num_model_requests`.
- Grouping keys are `null` unless you grouped by them.

`GET /v1/organization/costs`:

- `bucket_width`: **only `1d`**; `limit` 1–180, default 7.
- `group_by`: `project_id`, `line_item`, `api_key_id`.
- Result: `amount.value` (number), `amount.currency` ("Lowercase ISO-4217 currency e.g. \"usd\""),
  `line_item`, `project_id`, `api_key_id`, `quantity`, `quantity_unit`.
- `quantity_unit` enum: `tokens`, `1000_tokens`, `duration_seconds`, `duration_minutes`,
  `duration_hours`, `gibibyte_hours`, `images`, `characters`.
- The `line_items` filter doc gives the decisive example: a line item value is
  **`"gpt-6-astra, input_tokens"`** — model and token class concatenated.

*Bearing:* OpenAI's `input_tokens` is a **superset** that includes cached and cache-write tokens,
while Anthropic's `uncached_input_tokens` is a **disjoint** class. Summing "input tokens" across
vendors without normalising double-counts. This is the single most likely place for a
multi-vendor cost model to be silently wrong.

### 2.3 Anthropic — Claude Enterprise Analytics API (the closest analogue to this project)

This is the surface most like what agent-dash is modelling: an org-wide, **per-member**, per-model
usage and cost report over a linked identity directory
([docs](https://platform.claude.com/docs/en/manage-claude/analytics-api),
[reference](https://platform.claude.com/docs/en/api/admin/analytics), retrieved 2026-09-05).

Endpoints under `https://api.anthropic.com/v1/organizations/analytics/`:

| Endpoint | Grain |
|---|---|
| `GET /summaries` | org-level DAU/WAU/MAU, `assigned_seat_count`, adoption rates |
| `GET /usage_report` | tokens over time |
| `GET /user_usage_report` | tokens **per user** |
| `GET /cost_report` | cost over time |
| `GET /user_cost_report` | cost **per user** |

Shared `group_by` vocabulary on the usage and cost reports: `product`, `model`, `context_window`,
`inference_geo`, `speed`, `rbac_group_id`, `claude_tag_category`, `claude_tag_user_id`,
`slack_channel_id` — and on the cost reports additionally **`cost_type`** (`tokens` |
`code_execution` | `web_search`) and **`token_type`**
(`uncached_input_tokens`, `cache_read_input_tokens`,
`cache_creation.ephemeral_5m_input_tokens`, `cache_creation.ephemeral_1h_input_tokens`,
`output_tokens`).

Money fields: `amount` (post-discount, pre-credit) **and `list_amount`** (list price,
pre-discount), both "decimal strings in cents", `currency` always `"USD"`. The per-user reports
carry `order_by` (`amount` | `list_amount`, or for usage `total_tokens` | `output_tokens` |
`uncached_input_tokens` | `requests`) with `order` `asc`/`desc`, `limit` 1–1000 default 20 —
i.e. **the API is designed for a "top N spenders" leaderboard**.

Documented properties worth carrying:

- Max date range 31 days; `bucket_width=1m` capped at 24 hours.
- Freshness: cost/usage "typically available within four hours … but may take up to 24 hours",
  and **"Values for a given date can be revised for up to 30 days"**; "For invoicing-grade
  totals, query dates at least 30 days in the past."
- Every response carries `data_refreshed_at`; data after that watermark is incomplete.
- Engagement endpoints have a different, ~1-day lag; requesting an unavailable date returns a
  400 naming the most recent available day.
- Pagination cursors are bound to the query that issued them — changing `group_by[]` mid-sequence
  is a 400.
- Distinct counts in rollup mode are approximate (HyperLogLog, "typical <2% error").
- Known limitation: Claude Code used **through Amazon Bedrock is not reported here at all**.

*Bearing:* `rbac_group_id` is Anthropic's Team dimension, and `list_amount` vs `amount` is a real
distinction this project's single "rate card" collapses. Both are findings, not recommendations.

### 2.4 Anthropic — Claude Code Analytics API (per-developer, per-day)

`GET /v1/organizations/usage_report/claude_code`, one record per user per day
([docs](https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api),
retrieved 2026-09-05):

- Dimensions: `date`, `actor` (`user_actor` with `email_address`, or `api_actor` with
  `api_key_name`), `organization_id`, `customer_type` (`api` | `subscription`), `terminal_type`
  (`vscode`, `iTerm.app`, `tmux`, …).
- Core metrics: `num_sessions`, `lines_of_code.added` / `.removed`, `commits_by_claude_code`,
  `pull_requests_by_claude_code`.
- Tool decisions: `edit_tool.accepted` / `.rejected` and the same for `multi_edit_tool`,
  `write_tool`, `notebook_edit_tool`. The docs define the derived metric explicitly:
  "Tool acceptance rate = `accepted / (accepted + rejected)`".
- **`model_breakdown[]`** — an array per record, one entry per model, each with
  `tokens.input`, `tokens.output`, `tokens.cache_read`, `tokens.cache_creation` and
  `estimated_cost.amount` (**"Estimated cost in cents USD"**) + `estimated_cost.currency`.
- `starting_at` is a **UTC** date, one day per call. Freshness: ~1 hour, and "only data older
  than 1 hour is included in responses" so that pagination stays stable.

*Bearing:* this is a working example of **model mix stored per actor per day as a nested array**,
with cost carried alongside tokens at the same grain. It is the closest published shape to
`TokenUsage` "keyed by Model".

### 2.5 Claude Code OpenTelemetry (per-session, real-time)

The telemetry export ([docs](https://code.claude.com/docs/en/monitoring-usage), retrieved
2026-09-05) is the per-session view of the same data:

- `claude_code.token.usage` (unit: tokens) with attributes `session.id`, `user.id`, `model`,
  **`type` ∈ {input, output, cacheRead, cacheCreation}**, `query_source` (main/subagent/auxiliary),
  `speed`, `effort`, `agent.name`, `skill.name`, `mcp_server.name`, …
- `claude_code.cost.usage` (unit: USD) — documented as **estimated** cost, incremented after each
  API request, same attribute set.
- `claude_code.session.count`, `claude_code.lines_of_code.count` (`type` added/removed),
  `claude_code.commit.count`, `claude_code.pull_request.count`,
  `claude_code.code_edit_tool.decision` (`decision` accept/reject), `claude_code.active_time.total`.
- Event `claude_code.api_request` carries `model`, `cost_usd`, `cost_usd_micros` (estimated),
  `duration_ms`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`.
- The docs devote a section to **cardinality control**: `session.id` and `user.id` are called out
  as high-cardinality, and `OTEL_METRICS_INCLUDE_SESSION_ID` exists to drop session grain.

*Bearing:* the industry's own agent telemetry treats (session × user × model × token-type) as the
storage grain and explicitly warns that it is expensive. Also note `agent.name` — the
AgentTemplate dimension exists in the wild.

### 2.6 Cursor — Admin API (the closest *commercial* analogue)

([docs](https://cursor.com/docs/account/teams/admin-api), retrieved 2026-09-05)

- `POST /teams/daily-usage-data` — **one row per user per day**, `startDate`/`endDate` as epoch
  milliseconds, **"Date range cannot exceed 30 days"**, data "aggregates hourly; poll at most once
  per hour". Fields include `totalLinesAdded`, `acceptedLinesAdded`, `totalApplies`,
  `totalAccepts`, `totalRejects`, `totalTabsShown`, `totalTabsAccepted`, `composerRequests`,
  `chatRequests`, `agentRequests`, `subscriptionIncludedReqs`, `apiKeyReqs`, `usageBasedReqs`,
  `isActive`, and **`mostUsedModel`**.
- `POST /teams/spend` — per user: `spendCents`, `overallSpendCents` (current billing cycle),
  `fastPremiumRequests`, `hardLimitOverrideDollars`, `monthlyLimitDollars`,
  `effectivePerUserLimitDollars`; the response carries **`subscriptionCycleStart` (epoch ms)**.
  Sortable by `amount` | `date` | `user`.
- `POST /teams/filtered-usage-events` — **event grain**: `timestamp`, `userEmail`, `model`,
  `kind`, `maxMode`, `isTokenBasedCall`, `isChargeable`, `isHeadless`, and
  `tokenUsage` = { `inputTokens`, `outputTokens`, `cacheWriteTokens`, `cacheReadTokens`,
  `totalCents`, `discountPercentOff` }, plus `chargedCents` and `cursorTokenFee`.
  The docs state event-level costs reconcile to `/teams/spend` by summing `chargedCents`.
- Without `page`/`pageSize` the daily endpoint returns **only users active in the range**;
  pagination is what makes inactive members appear (with `isActive: false`).

*Bearing:* three grains shipped side by side — event, user-day, and billing-cycle-to-date — and a
documented reconciliation rule between them. Also: `isChargeable` exists, i.e. not every
recorded event costs money.

### 2.7 LiteLLM (self-hosted, an implemented schema for exactly this problem)

([docs](https://docs.litellm.ai/docs/proxy/cost_tracking), retrieved 2026-09-05) The
`LiteLLM_SpendLogs` table is per-request: `request_id`, `call_type`, `api_key` (hashed), `spend`
(dollars), `total_tokens` / `prompt_tokens` / `completion_tokens`, `model`, `model_group`,
`custom_llm_provider`, `api_base`, `user`, `team_id`, `end_user`, `request_tags`, `cache_hit`,
`cache_key`, `metadata`. Aggregation is served by `/spend/logs` and `/global/spend/report`,
grouped by team, customer, API key or internal user with per-model cost breakdowns.

Note the contrast: LiteLLM stores `spend` as a **float in dollars**, where the commercial APIs use
**decimal strings in cents**. It also carries `cache_hit` as a boolean rather than counting cache
tokens — a weaker taxonomy than the vendor APIs.

### 2.8 GitHub Copilot — a genuinely different unit

Copilot bills in **premium requests**, not tokens
([docs](https://docs.github.com/en/copilot/concepts/billing/copilot-requests), retrieved
2026-09-05): a chat prompt is 1 request, a code review is 13, a cloud-agent session is 1, and
different models carry different multipliers. Allowances are 300/month (Pro) and 1,500/month
(Pro+); overage is **$0.04 per premium request**; and **"Premium request counters reset on the 1st
of each month at 00:00:00 UTC"**, with no carry-forward.

The Copilot metrics REST API
([docs](https://docs.github.com/en/rest/copilot/copilot-metrics), retrieved 2026-09-05) is
report-oriented rather than query-oriented: `/orgs/{org}/copilot/metrics/reports/` and the
enterprise equivalent return `download_links` to generated 1-day and 28-day reports (org usage,
user-level metrics, repository PR data), available from 2025-10-10 with up to 1 year of history.
The day-boundary timezone is not stated on that page.

*Bearing:* not every credible platform prices in tokens. A request-with-multipliers rate card is a
real alternative shape, and it makes "tokens" unavailable as a currency-independent volume metric.

---

## 3. Cache read/write: how it is priced and how it is reported

**Pricing.** Anthropic publishes the multipliers explicitly
([pricing](https://platform.claude.com/docs/en/about-claude/pricing), retrieved 2026-09-05):

| Cache operation | Multiplier on base input price | Duration |
|---|---|---|
| 5-minute cache write | **1.25×** | 5 minutes |
| 1-hour cache write | **2×** | 1 hour |
| Cache read (hit) | **0.1×** (0.025× on Claude Fable 5.1 / Mythos 5.1) | same as preceding write |

with the break-even stated in prose: "caching pays off after one cache read for the 5-minute
duration (1.25x write), or after two cache reads for the 1-hour duration (2x write)". The
multipliers "stack with other pricing modifiers, including the Batch API discount and data
residency".

OpenAI's current pricing table
([pricing](https://developers.openai.com/api/docs/pricing.md), retrieved 2026-09-05) has
**converged on the same ratios** for its newest models: cached input at 0.1× input and cache
writes at 1.25× input (e.g. `gpt-6-astra`: input $10, cached input $1, cache writes $12.50). Older
GPT-5.x rows show cached input at 0.1× and **no cache-write column at all** — historically
OpenAI's automatic caching charged nothing for writes. Both regimes are live on the same page
simultaneously, which is itself a finding: *cache-write pricing is the least stable part of a
rate card.*

**Reporting.** Cache tokens are surfaced separately by every token-based platform examined:

| Platform | Cache read field | Cache write field |
|---|---|---|
| Anthropic usage API | `cache_read_input_tokens` | `cache_creation.ephemeral_5m_input_tokens`, `cache_creation.ephemeral_1h_input_tokens` |
| Anthropic Enterprise analytics | same, and as `token_type` values on the **cost** report | same |
| Claude Code Analytics | `tokens.cache_read` | `tokens.cache_creation` |
| Claude Code OTel | `type="cacheRead"` | `type="cacheCreation"` |
| OpenAI usage API | `input_cached_tokens` | `input_cache_write_tokens` |
| Cursor usage events | `cacheReadTokens` | `cacheWriteTokens` |
| LiteLLM | `cache_hit` (boolean only) | — |

Two nuances that matter for any cross-vendor arithmetic:

- **Anthropic's classes are disjoint; OpenAI's are nested.** OpenAI's own schema says
  `input_tokens` is "The aggregated number of input tokens used, **including cached and
  cache-write tokens**", and separately exposes `input_uncached_tokens`. Anthropic reports
  `uncached_input_tokens` with no total. Naively adding `input_tokens` across the two
  double-counts cache traffic.
- **Anthropic splits cache writes by TTL and prices the two differently** (1.25× vs 2×). A single
  `cache_write_tokens` counter cannot be priced correctly against Anthropic's own rate card
  without knowing the TTL split. No other vendor examined makes this distinction.

---

## 4. The cloud platforms: cost reporting is a *billing* surface, not a product surface

Anthropic, OpenAI and Cursor ship purpose-built usage APIs. On Google Cloud and Azure, LLM spend
is reported by the generic cloud billing pipeline, and the LLM-specific detail has to survive being
squeezed through a SKU or meter name.

### 4.1 Google Cloud / Vertex AI

**Where the money is.** Cloud Billing Reports group by Project, Service, SKU, Location, Product,
Application, Label keys, Project Hierarchy and more, on two distinct time axes — **Charge period
(usage date)** and **Billing period (invoice month)**
([Reports](https://docs.cloud.google.com/billing/docs/how-to/reports), retrieved 2026-09-05).

The BigQuery billing export is the real analytical surface. Standard export fields include
`service.description`, `sku.description`, `usage_start_time` / `usage_end_time` ("the start/end
time of the **hourly** usage window within which the given cost was calculated"), `usage.amount` /
`usage.unit`, `invoice.month` (YYYYMM), `cost_type` (regular / tax / adjustment / rounding error),
`labels`, `project`, `credits`, `currency`, and `export_time`
([Standard export structure](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-tables/standard-usage),
retrieved 2026-09-05). The detailed export adds `price.effective_price`, `cost_at_list`,
`resource.name` and `tags`
([Detailed export structure](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-tables/detailed-usage)).
**Row grain is per-SKU × per-project × per-hour.** Freshness: "typically … within a day, but can
sometimes take more than 24 hours"
([export docs](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery), retrieved
2026-09-05).

**Token classes are SKUs.** Google encodes the entire token taxonomy in SKU names, which means the
distinction survives into the invoice
([Gen AI v2 SKU group](https://cloud.google.com/skus/sku-groups/gen-ai-v2),
[Gemini 2.x SKU group](https://cloud.google.com/skus/sku-groups/vertex-api-gemini-2-x-skus),
retrieved 2026-09-05):

- `Gemini 3 Flash Text Input - Predictions` [7EBE-3B46-F75C]
- `Gemini 3 Flash Text Output - Predictions` [0127-F0B7-365E]
- `Gemini 3 Flash Text Input Caching` [E5C2-A033-7712] — the discounted cached read
- `Gemini 3 Flash Text Input Caching Storage` [148C-9912-0E1E] — **cache storage-hours**
- separate SKUs per modality (Audio / Image / Video Input, each with its own Caching pair)
- separate SKUs per service tier: `... Priority - Predictions`, `... Caching Flex`, Batch variants
- on the 2.x line, a **long-context split**: `Gemini 2.0 Flash Text Input (Long) - Predictions`
  [2AF0-41D8-C5F1], `Gemini 2.5 Pro Input Text Caching (Long)` [A7E4-0EAD-1D2E]
- and even a thinking-token split: `Gemini 2.5 Flash Text Output (Thinking On) - Batch Predictions`

So Google's implicit rate-card key is **(model × modality × token class × context tier × service
tier)** — five axes, not one.

**Product-side metrics** on `aiplatform.googleapis.com/PublisherModel`:
`publisher/online_serving/token_count` (DELTA/INT64, labels `type` input/output, `request_type`,
`modality`), `consumed_token_throughput`, `model_invocation_count`, and
`first_token_latencies` (DISTRIBUTION, carrying an `explicit_caching` label)
([GCP metrics A–B](https://docs.cloud.google.com/monitoring/api/metrics_gcp_a_b), retrieved
2026-09-05). **Gap:** no documented label or metric for *cached token counts* on `token_count` —
cached tokens appear in the API response (`cachedContentTokenCount`) and in billing SKUs, but not
in the default metric set.

**Context caching pricing:** implicit caching is on by default with no storage cost and caches
cleared "in 24 hours or less"; explicit caching gives a guaranteed discount plus "an hourly rate
per million tokens stored prorated down to the minute level"; the discount is **90% on Gemini 2.5+
and 75% on 2.0**; the minimum cacheable prompt is **2,048 tokens**; creating an explicit cache
charges its tokens **as standard input** (no write premium). *Trust note:* the context-cache
overview page would not render for automated fetch on 2026-09-05, so these are near-verbatim
quotations surfaced through search rather than a certified page read. The existence of the
`Input Caching` / `Input Caching Storage` SKUs corroborates the shape.

**Long context is a hard cliff:** "If a query input context is longer than or equal to **200K
tokens**, all tokens (input **and output**) are charged at long context rates." Note what that
means — *output* is repriced on the basis of *input* size.

### 4.2 Azure AI Foundry

**Cost Analysis** groups by Resource, Meter, Service, Subscription, Resource group, Location, Tag —
**one group-by at a time**; anything richer is pushed to Power BI or raw exports. Daily granularity
is capped at a 3-month range (1 month at management-group scope)
([Cost Analysis quickstart](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis),
retrieved 2026-09-05).

**Cost Details / Usage Details** rows are **daily**: `Quantity` is "The number of units consumed by
a product or service **on a given day**". Fields include `Date`, `MeterName`, `MeterCategory`,
`MeterSubCategory`, `MeterId`, `MeterRegion`, `EffectivePrice`, `UnitPrice`, `PayGPrice`,
`UnitOfMeasure`, `CostInBillingCurrency`, `costInUsd`, `PricingModel`
(`OnDemand`/`Reservation`/`Spot`/`SavingsPlan`), `ChargeType` (`Usage`/`Purchase`/`Refund`),
`ResourceId`, `ResourceGroup`, `Tags`, `BillingPeriodStartDate`/`EndDate`
([Usage details fields](https://learn.microsoft.com/en-us/azure/cost-management-billing/automate/understand-usage-details-fields),
retrieved 2026-09-05). **There is no record ID** — "The cost details file itself doesn't uniquely
identify individual records with an ID"; you synthesise a key. Reconciliation is
`Cost = EffectivePrice × Quantity` (EA).

**Azure Monitor token metrics** on `Microsoft.CognitiveServices/accounts`, PT1M grain, Total(Sum)
([Azure OpenAI monitoring reference](https://learn.microsoft.com/en-us/azure/foundry/openai/monitor-openai-reference),
retrieved 2026-09-05): `ProcessedPromptTokens`, `GeneratedTokens`, `TokenTransaction`
("prompt tokens (input) plus generated tokens (output)"), `ActiveTokens` ("Total tokens minus
cached tokens", PTU only), `AzureOpenAIContextTokensCacheMatchRate` (PTU only), and for the
non-OpenAI "Models" namespace `InputTokens` / `OutputTokens` / `TotalTokens`. Dimensions:
`ApiName`, `ModelDeploymentName`, `ModelName`, `ModelVersion`, `FeatureName`, `UsageChannel`,
`Region`.

For **Anthropic deployments on Foundry** the cache metrics are the most explicit anywhere:
`cacheReadInputTokens`, `ephemeral1hInputTokens`, `ephemeral5mInputTokens` — Anthropic's own field
names surfaced as Azure metrics, with a `ContextLength` dimension.

**Azure prompt caching** ([docs](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching),
retrieved 2026-09-05): cache reads are billed "at a discount on input token pricing" for Standard
and "up to 100% discount" for Provisioned; **cache writes became chargeable on newer models** —
"Models before the GPT-5.6 family don't charge extra to write to the cache. On GPT-5.6 models and
later model families, cache writes can incur charges". Minimum 1,024 tokens; reads reported as
`cached_tokens` under `prompt_tokens_details`, writes as `cache_write_tokens` on GPT-5.6+ Standard
PAYG. **No cache storage-hour charge** (unlike Google).

**Claude on Foundry has no per-model bill.** Claude models meter in **Claude Consumption Units**:
"CCU is the single billing dimension for Claude models in Foundry. One Marketplace meter replaces
the previous per-model token meters", metered hourly and invoiced monthly in arrears; cost
visibility is a "Single CCU line in Azure Cost Management; per-model token detail in the Foundry
portal"
([CCU billing](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/claude-models-billing),
retrieved 2026-09-05; the same CCU scheme applies on AWS —
[Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing), 100 CCU = $1.00).

*Bearing:* **per-model cost attribution is not always derivable from the bill.** On Azure, Claude
spend arrives as one line and per-model detail exists only in the product portal or in your own
token logging. Microsoft says so directly: "Token and request charts can temporarily differ from
Estimated cost … Use Estimated cost for near-real-time monitoring, and use Microsoft Cost
Management and invoiced charges for financial reconciliation", and "Estimates do not reflect
discounts or contracted pricing that may appear on your final bill"
([Manage costs in Foundry](https://learn.microsoft.com/en-us/azure/foundry/concepts/manage-costs),
retrieved 2026-09-05).

### 4.3 AWS Bedrock

Bedrock has the most explicit public documentation of the *reconciliation problem* of any vendor
examined, and it is worth reading for that alone.

**Token classes are usage types.** CUR 2.0 usage-type patterns
([Understanding your Bedrock CUR data](https://docs.aws.amazon.com/bedrock/latest/userguide/cost-mgmt-understanding-cur-data.html),
retrieved 2026-09-05):

| Token type | CUR usage type pattern |
|---|---|
| Input tokens | `*-input-tokens` or `*-mantle-input-tokens-*` |
| Output tokens | `*-output-tokens` or `*-mantle-output-tokens-*` |
| Cache read tokens | `*-cache-read-input-token-count` |
| Cache write tokens | `*-cache-write-input-token-count` |

Format: `{region}-{model}-{token-type}` for standard tier, `{region}-{model}-{token-type}-{tier}`
for priority/flex, `-cross-region-global` for cross-region. Real examples the docs give:
`USE1-Claude4.6Sonnet-input-tokens`, `USE1-Claude4.6Sonnet-cache-read-input-token-count`,
`USE1-Nova2.0Lite-input-tokens-flex`, `USE1-gpt-oss-120b-output-tokens-priority`. So the rate-card
key on Bedrock is **(region × model × token class × service tier × in-region/cross-region)**.

AWS states the reconciliation rule bluntly: *"All four token types must be accounted for when
reconciling usage to spend. If you only sum input and output tokens, your totals will not match
your bill. This is the most common source of reconciliation gaps, particularly for workloads that
use prompt caching heavily."*

**Cost cannot be attributed to a request from billing data.** *"CUR does not contain per-request
line items … neither carries a per-`requestId` identifier. To attribute cost to an individual
request or prompt, use your model invocation logs rather than CUR."* The FAQ is even shorter:
*"Q: Can I see cost for an individual prompt in AWS Cost Explorer or CUR? A: No."*
([cost-mgmt-faq](https://docs.aws.amazon.com/bedrock/latest/userguide/cost-mgmt-faq.html)). The
finest billing grain is **per usage type per day**.

**Five attribution mechanisms, four of which are aggregate-only**
([cost-management](https://docs.aws.amazon.com/bedrock/latest/userguide/cost-management.html)):
IAM principal attribution, application inference profiles, Projects, Workspaces — all "aggregated,
per usage type per day", into Cost Explorer/CUR — and per-request metadata tagging, which yields
**token counts only, per request, in invocation logs only**. *"Request metadata is not a cost
allocation tag. It is written only to your model invocation logs and never appears in AWS Cost
Explorer or CUR."*

Documented friction on cost allocation tags: they *"can take up to 24 hours to appear in Cost
Explorer and CUR after activation"*, they are *"not retroactive"*, they must be manually activated,
and an application inference profile is tied to one model — *"you need a separate profile for every
unique combination of model, team, and tag set."* Tag columns appear as `resourceTags/{key}` and
`iamPrincipal/{key}`. And there is no enforcement: *"Q: Can I require that every call is tagged?
A: Not from the Amazon Bedrock side."*

**Product-side metrics** (`AWS/Bedrock`,
[runtime metrics](https://docs.aws.amazon.com/bedrock/latest/userguide/monitoring-runtime-metrics.html)):
`Invocations`, `InvocationLatency`, `TimeToFirstToken`, `InvocationClientErrors`,
`InvocationServerErrors`, `InvocationThrottles`, `InputTokenCount`, `OutputTokenCount`,
`CacheReadInputTokens`, `CacheWriteInputTokens`. **The only dimension on these metrics is
`ModelId`** — no team, app or tenant axis exists at the metric layer.

**Prompt caching** ([docs](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html)):
implicit and explicit; *"tokens successfully read from cache are reported as cached tokens and
billed at the model's cache-read rate … Depending on the model, tokens written to cache can be
billed at a rate that is higher than the standard input token rate."* The accounting identity is
stated exactly: *"the `inputTokens` field represents only the non-cached input tokens …
total input tokens = `inputTokens` + `cacheReadInputTokens` + `cacheWriteInputTokens`."*
Cache reads *"don't count toward your TPM quota"*; cache writes do. Caching is **not available for
batch inference**. For GPT-5.6 on Bedrock: cache writes at 1.25×, cache reads at a 90% discount.

**A naming hazard worth recording:** the same quantity is spelled four ways —
CUR `*-cache-read-input-token-count`, CloudWatch `CacheReadInputTokens`, Converse response
`cacheReadInputTokens`, OpenAI-on-Bedrock `cached_tokens`.

### 4.4 OpenRouter — the one platform where per-request cost is authoritative

OpenRouter is the mirror image of Bedrock: cost is returned **with the response**.

- **Inline `usage` on every completion**
  ([usage accounting](https://openrouter.ai/docs/use-cases/usage-accounting), retrieved
  2026-09-05): `prompt_tokens`, `completion_tokens`, `total_tokens`,
  `completion_tokens_details.reasoning_tokens`, `prompt_tokens_details.cached_tokens`,
  `prompt_tokens_details.cache_write_tokens`, `cost` (credits charged),
  `cost_details.upstream_inference_cost`. The opt-in flags (`usage: {include: true}`,
  `stream_options`) are **deprecated and have no effect** — usage is now always returned.
- **`GET /api/v1/generation`** ([reference](https://openrouter.ai/docs/api-reference/get-a-generation)):
  `native_tokens_prompt` / `_completion` / `_reasoning` / `_cached` (provider's own tokenizer)
  alongside normalised `tokens_prompt` / `tokens_completion`, plus `total_cost` (USD),
  `cache_discount`, `upstream_inference_cost`, `usage`, `provider_name`, `latency`,
  `generation_time`, `streamed`, `finish_reason`, `is_byok`.
- **`GET /api/v1/activity`**
  ([reference](https://openrouter.ai/docs/api/api-reference/analytics/get-user-activity)):
  grain is **endpoint × date × model**, window is **"Last 30 (completed) UTC days"**. Fields:
  `date`, `model`, `model_permaslug`, `endpoint_id`, `provider_name`, `usage`,
  `byok_usage_inference`, `requests`, `prompt_tokens`, `completion_tokens`, `reasoning_tokens`.
- **Analytics API** (`POST /api/v1/analytics/query`,
  [cookbook](https://openrouter.ai/docs/cookbook/administration/analytics-cost-control)) — a
  genuine metrics/dimensions cube: metrics `total_usage`, `request_count`, `tokens_total`,
  **`cache_hit_rate`**, `usage_upstream`, `usage_cache`, `tokens_prompt`, `tokens_completion`,
  `reasoning_tokens`; dimensions `model`, `api_key_id`, `app`, `workspace`, `user`; granularity
  `day` | `week`; **max 2 dimensions per query**; responses carry `metadata.truncated`.
- **Activity page** ([guide](https://openrouter.ai/docs/guides/administration/activity-export)):
  three metric cards — Spend, Tokens, Requests — grouped by **Model, API Key, or Creator (org
  member)**, over 1 hour / 1 day / 1 month / 1 year, with CSV and PDF export. Caveat stated:
  *"Reasoning tokens are included in completion tokens for billing."*

**Rate card as data.** `GET /api/v1/models` returns a `pricing` object whose values are **strings
of USD per token**: `prompt`, `completion`, `request`, `image`, `web_search`,
`internal_reasoning`, `input_cache_read`, `input_cache_write`, plus an **`overrides`** array
carrying conditional pricing keyed on `min_prompt_tokens`, `utc_start`, `utc_end`, `utc_days`
([models guide](https://openrouter.ai/docs/guides/overview/models), retrieved 2026-09-05). That is
the most explicit statement anywhere that a rate card is **time- and size-conditional**, not a
constant.

Cache multipliers OpenRouter publishes across providers
([prompt caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching), retrieved
2026-09-05): writes — Anthropic/Alibaba 1.25× (5m) and 2× (1h), OpenAI GPT-5.6+ 1.25×, most others
free; reads — Anthropic/Alibaba/DeepSeek 0.1×, Moonshot/Grok 0.25×, Google/Groq 0.25×–0.5×.

---

## 5. Rate-card structure: what varies, what is stable

### 5.1 The key is never just the model

Collected across vendors, the axes a real rate card is keyed on:

| Axis | Who has it | Evidence |
|---|---|---|
| **Token class** (uncached in / cache read / cache write / output) | everyone | Anthropic `token_type`; OpenAI `line_item` `"model, input_tokens"`; Bedrock `*-cache-read-input-token-count`; OpenRouter `input_cache_read` |
| **Cache TTL** (5m vs 1h write) | Anthropic, and Bedrock/OpenRouter passing it through | Anthropic 1.25× vs 2× |
| **Service tier** (standard / batch / flex / priority) | Anthropic, OpenAI, Bedrock, Google | Anthropic `service_tiers[]` enum; Bedrock `-flex` / `-priority` usage-type suffixes; Google `... Caching Flex` SKUs |
| **Context tier** (short vs long) | OpenAI, Google, Anthropic (older models) | OpenAI short/long columns; Google `(Long)` SKUs and the ≥200K cliff; Anthropic `context_window` `0-200k` / `200k-1M` |
| **Region / data residency** | everyone | Anthropic 1.1× for `inference_geo: "us"`; OpenAI "10% uplift" for regional processing; Bedrock in-region vs cross-region unit prices; Bedrock/Azure per-region rows |
| **Speed mode** | Anthropic, OpenAI | Anthropic fast mode $10/$50 on Opus 5; OpenAI `service_tier: "fast"` (renamed from `priority` on 2026-07-30) |
| **Modality** | Google, OpenAI | Google per-modality SKUs; OpenAI `input_audio_tokens` / `input_image_tokens` |
| **Time of day / prompt size** | OpenRouter | `pricing.overrides` with `utc_start`, `utc_days`, `min_prompt_tokens` |
| **Negotiated discount** | everyone | Anthropic `amount` vs `list_amount`; Bedrock "does not reflect discounts, commitments…"; Azure "Estimates do not reflect … contracted pricing" |

Multipliers **stack**: Anthropic states caching multipliers stack with the Batch discount and with
data residency; fast-mode pricing stacks with both.

### 5.2 What is stable

Three ratios held across every vendor examined on 2026-09-05:

- **Output ≈ 5× input.** Anthropic: every single row on the pricing table is exactly 5×. OpenAI:
  5× (`gpt-6-astra`, `gpt-5.6-sol`), 6× (`terra`, `luna`), 8× (`gpt-5.1`).
- **Cache read = 0.1× input.** Anthropic (all but Fable/Mythos 5.1 at 0.025×), OpenAI (all rows),
  Google 2.5+ ("90% discount"), Bedrock GPT-5.6 ("90% discount"), OpenRouter's cross-provider table.
- **Cache write = 1.25× input** for a short TTL, **2× input** for a 1-hour TTL. Anthropic, OpenAI's
  newest models, Azure GPT-5.6, Bedrock GPT-5.6, and OpenRouter's provider table all agree.
- **Batch = 50% off** input and output. Anthropic, Azure ("50% discount on Global Standard
  Pricing"), Bedrock ("50% lower price compared to on-demand"), OpenAI (flex priced as batch).

### 5.3 What is unstable

- **Absolute prices.** Anthropic's page carries a live note that Sonnet 5's "introductory" $2/$10
  became the standard price and a scheduled increase to $3/$15 "will not occur"; Azure has a
  GPT-5.6 Sol promo running **2026-09-01 → 2026-11-30** that supersedes the launch rate.
- **Whether cache writes are charged at all.** OpenAI's own table shows GPT-5.x rows with no
  cache-write column next to GPT-5.6/GPT-6 rows with one; Azure says plainly that "Models before
  the GPT-5.6 family don't charge extra to write to the cache."
- **Tokenisation itself.** Anthropic notes that Claude 4.7+ "use a newer tokenizer … approximately
  **30% more tokens for the same text**". Token counts are therefore not comparable across model
  generations, let alone across vendors — a 30% token increase at a lower per-token price can be
  cheaper while looking worse on a token chart.

---

## 6. Illustrative rate card

**Read this as a snapshot, not a fact.** Every number was read from the cited page on
**2026-09-05**. Prices on this page change without notice — Anthropic revised Sonnet 5 pricing
mid-2026 and Azure has a promotional rate live right now that supersedes its own launch
announcement. **Anything derived from this table should be re-verified before it is relied on, and
labelled with its retrieval date wherever it is displayed.**

All figures are **USD per million tokens (MTok)**.

### 6.1 Anthropic first-party

Source: <https://platform.claude.com/docs/en/about-claude/pricing>, retrieved 2026-09-05.

| Model | Input | 5m cache write | 1h cache write | Cache read | Output |
|---|---|---|---|---|---|
| Claude Fable 5.1 | 10.00 | 12.50 | 20.00 | 0.25 | 50.00 |
| Claude Opus 5 | 5.00 | 6.25 | 10.00 | 0.50 | 25.00 |
| Claude Sonnet 5 | 2.00 | 2.50 | 4.00 | 0.20 | 10.00 |
| Claude Sonnet 4.6 | 3.00 | 3.75 | 6.00 | 0.30 | 15.00 |
| Claude Haiku 4.5 | 1.00 | 1.25 | 2.00 | 0.10 | 5.00 |

Batch: 50% off input and output (Opus 5 → $2.50/$12.50; Sonnet 5 → $1.00/$5.00; Haiku 4.5 →
$0.50/$2.50). Fast mode (research preview, Opus 5 / 4.8 only): $10 in / $50 out.
`inference_geo: "us"`: ×1.1 on every category. Web search: $10 per 1,000 searches.
Managed-agent session runtime: $0.08 per session-hour.

### 6.2 OpenAI first-party

Source: <https://developers.openai.com/api/docs/pricing.md>, retrieved 2026-09-05. Where a model
has short/long context columns, both are shown as `short → long`.

| Model | Input | Cached input | Cache write | Output |
|---|---|---|---|---|
| gpt-6-astra | 10.00 → 20.00 | 1.00 → 2.00 | 12.50 → 25.00 | 50.00 → 75.00 |
| gpt-5.6-sol | 4.00 → 8.00 | 0.40 → 0.80 | 5.00 → 10.00 | 20.00 → 30.00 |
| gpt-5.6-terra | 2.00 → 4.00 | 0.20 → 0.40 | 2.50 → 5.00 | 12.00 → 18.00 |
| gpt-5.6-luna | 0.20 → 0.40 | 0.02 → 0.04 | 0.25 → 0.50 | 1.20 → 1.80 |
| gpt-5.1 | 1.25 | 0.125 | — | 10.00 |
| gpt-5-mini | 0.25 | 0.025 | — | 2.00 |
| gpt-5-nano | 0.05 | 0.005 | — | 0.40 |

Batch ≈ 50% off; flex priced as batch for most models; fast mode (renamed from priority on
2026-07-30) at 2× standard; regional/data-residency processing carries a 10% uplift for models
released on or after 2026-03-05. **The token threshold separating "short" from "long" context is
not stated on the pricing page** — an unresolved gap.

### 6.3 Azure AI Foundry

Source: <https://azure.microsoft.com/en-us/blog/gpt-5-6-now-available-in-microsoft-foundry/>
(published 2026-07-09), retrieved 2026-09-05. Standard Global, short context.

| Model | Input | Cached input | Cache write | Output |
|---|---|---|---|---|
| GPT-5.6 Sol | 5.00 | 0.50 | 6.25 | 30.00 |
| GPT-5.6 Terra | 2.00 | 0.20 | 2.50 | 12.00 |
| GPT-5.6 Luna | 0.20 | 0.02 | 0.25 | 1.20 |

**Caveat, important:** the same post announces a promotional rate for Sol of **$4.00 in / $20.00
out** effective **2026-09-01 – 2026-11-30**, so the Sol row above is *not* the rate in force today.
The live pricing page (<https://azure.microsoft.com/en-us/pricing/details/azure-openai/>) rendered
every price cell as `$-` to automated fetch on 2026-09-05 and could not be read; it does confirm
that prices vary by Global / Data Zone / Regional deployment and that Batch is 50% off Global
Standard. **Claude models on Foundry have no per-token Azure rate card at all** — they meter in
Claude Consumption Units at $0.01/CCU.

### 6.4 OpenRouter (aggregator, list rates on model pages)

Retrieved 2026-09-05 from the individual model pages.

| Model | Input | Cache read | Cache write (5m) | Cache write (1h) | Output |
|---|---|---|---|---|---|
| [anthropic/claude-opus-4.6](https://openrouter.ai/anthropic/claude-opus-4.6) | 5.00 | 0.50 | 6.25 | 10.00 | 25.00 |
| [openai/gpt-5.4](https://openrouter.ai/openai/gpt-5.4) | 2.50 | 0.25 | — | — | 15.00 |
| [openai/gpt-5](https://openrouter.ai/openai/gpt-5) | 1.25 | 0.125 | — | — | 10.00 |

OpenRouter states it passes through provider pricing "without any markup", while its pricing page
lists a **5.5% platform fee** (credit purchase; 5% for crypto) and a 5% fee above a monthly
list-price allowance. BYOK costs **5% of what the same model/provider would cost on OpenRouter**.
These two statements are not reconciled in OpenRouter's own docs — see §9.

### 6.5 AWS Bedrock — not verified

The Bedrock pricing page renders its tables client-side; on 2026-09-05 only legacy rows resolved
to fetchable text (Claude 3.5 Sonnet v2: $6.00 in / $30.00 out / $7.50 cache write / $0.60 cache
read / batch $3.00/$15.00, for US East (N. Virginia), US East (Ohio), US West (Oregon)). These are
retired-generation models and should not be used as a current rate card. The docs confirm units are
**per 1M tokens**, batch is 50% off, and rates are region-scoped with distinct in-region vs
cross-region unit prices. **The machine-readable source is the AWS Price List API**, which carries
the same UsageType strings that appear in CUR — a better join key than the marketing page.

### 6.6 Google Vertex AI — not verified

No Gemini dollar figure could be verified on 2026-09-05: the pricing pages are JS-rendered or
exceed fetch limits. What *is* verified is the structure — separate SKUs per model × modality ×
token class × context tier × service tier, a 90% cached-input discount on Gemini 2.5+ (75% on
2.0), a separate hourly **cache storage** charge for explicit caches, a 2,048-token minimum, and a
hard long-context cliff at 200K input tokens that reprices **output** as well as input. The
durable machine-readable source is the Cloud Billing Catalog API keyed on the SKU IDs in §4.1.

### 6.7 Orders of magnitude (the shape worth remembering)

| Capability class | Input $/MTok | Output $/MTok | Cache read | Examples |
|---|---|---|---|---|
| frontier | 5 – 10 | 25 – 50 | ~0.1× input | Claude Opus 5, Claude Fable 5.1, gpt-6-astra, gpt-5.6-sol |
| balanced | 1 – 4 | 10 – 20 | ~0.1× input | Claude Sonnet 5, gpt-5.1, gpt-5.6-terra |
| fast | 0.05 – 1 | 0.4 – 5 | ~0.1× input | Claude Haiku 4.5, gpt-5-mini, gpt-5-nano, gpt-5.6-luna |

The spread from cheapest to dearest is roughly **200× on input** and **125× on output** — which is
why model mix, not token volume, dominates cost variance. Note also that the same tier costs
similar money across vendors: the cross-vendor `tier` roll-up in `CONTEXT.md` is defensible on
price grounds, not just on capability grounds.

---

## 7. Model mix as a dimension

**Model is a group-by on every usage or cost API examined**: Anthropic (`model` in usage, cost and
Enterprise analytics), OpenAI (`group_by=model`, and `model` embedded in every cost `line_item`),
Google (model is part of the SKU name), Azure (`ModelDeploymentName`, `ModelName`, `ModelVersion`
dimensions), Bedrock (`ModelId` on metrics, model in the usage type), OpenRouter (`model` +
`model_permaslug` + `provider_name`), Cursor (`model` on usage events), LiteLLM (`model` and
`model_group`).

**But almost nobody names the metric.** "Model mix" as a presented concept appears in only three
forms across everything examined:

1. **Cursor's `mostUsedModel`** — a single scalar per user per day. The cheapest possible
   presentation of mix: the mode, not the distribution.
2. **OpenRouter's public rankings** (<https://openrouter.ai/rankings>) — models ranked by tokens
   processed, over Today / This Week / This Month, with a Trending view comparing the past week to
   the preceding week, plus "Top models by task" ranked by **share of spend** and a "Market Share"
   section. This is the only place where token-share-by-model is presented as the headline object
   rather than as a filter. OpenRouter states the caveat itself: *"These rankings measure adoption,
   not quality"*, and they cover traffic through OpenRouter, not the market.
3. **Anthropic's `model_breakdown[]`** on the Claude Code Analytics API — mix stored as a nested
   per-actor-per-day array of (model, tokens, estimated cost). Not presented as a metric; supplied
   as a shape the caller charts.

**Roll-up levels above the exact model are essentially absent from vendor APIs.** No vendor
examined exposes a `family` or capability-`tier` grouping; Google's SKU names encode a family in a
string (`Gemini 3 Flash …`), and OpenRouter has `model_permaslug` and a separate `provider_name`,
but nothing is a first-class roll-up.

*Bearing:* `CONTEXT.md`'s three-level Model roll-up (exact → `family` → `tier`) is **not** something
any vendor gives you. It is a modelling decision this project is making on top of what vendors
supply, and it is the cross-vendor comparison that vendors have no incentive to provide. That is
either the differentiator or the liability, depending on how well the `tier` labels are defended.

---

## 8. Billing-period semantics, timezone, and projected spend

### 8.1 The period

| Platform | Period | Boundary |
|---|---|---|
| Anthropic (Console spend limits) | monthly | *"Monthly spend resets at 00:00 UTC on the first of each calendar month"* ([Spend Limits API](https://platform.claude.com/docs/en/manage-claude/spend-limits-api)) |
| Anthropic (Enterprise per-member limits) | `monthly` — *"Currently `monthly` is the only supported period"*, with `period` explicitly "an open set" | 00:00 UTC, 1st of calendar month |
| GitHub Copilot | monthly allowance | *"Premium request counters reset on the 1st of each month at 00:00:00 UTC"*, no carry-forward |
| OpenAI (Enterprise/Edu workspaces) | **choice of two** — "Monthly (default), which resets usage on the first day of each month in UTC" **or** "Aligned to billing cycle" | see note below |
| Cursor | **subscription cycle**, not calendar month — `/teams/spend` returns `subscriptionCycleStart` (epoch ms) and `overallSpendCents` "current billing cycle" | per-team anniversary |
| Azure | monthly, but *"the cycle start and end dates vary by subscription type"*; period close in UTC | UTC |
| Google Cloud | invoice month (`invoice.month`, YYYYMM) as an axis distinct from usage date | **report days start at midnight US/Canada Pacific**, observing US DST |
| OpenRouter | prepaid credits, deducted per request; monthly *fee allowance*; reporting window is a rolling "last 30 (completed) UTC days" | reporting UTC; billing boundary undocumented |

**The timezone finding is the sharp one.** Calendar-month-at-00:00-UTC is the dominant convention
(Anthropic, GitHub, OpenAI's default, Azure's close), but it is **not** universal: Google's billing
*report* day starts at **midnight US Pacific with DST**, Cursor bills on a per-team subscription
anniversary, and OpenAI lets an enterprise pick. A dashboard that hard-codes "calendar month, UTC"
is right most of the time and quietly wrong for at least two of the platforms examined.

*Trust note:* the OpenAI Enterprise usage-period quotation comes from a search-result extract of
`help.openai.com/en/articles/20001001…`; both `help.openai.com` and `platform.openai.com` returned
403 to direct fetch on 2026-09-05, so it is a **lower-trust citation** than the rest of this brief.
Anthropic's and GitHub's equivalents were read directly from the primary page.

### 8.2 Recent data is provisional — every vendor says so

| Platform | Stated freshness | Stated revision window |
|---|---|---|
| Anthropic Usage/Cost API | "typically … within 5 minutes" | — |
| Anthropic Claude Code Analytics | ~1 hour; only data older than 1 hour is returned | — |
| Anthropic Enterprise Analytics | 4h typical, up to 24h | **"can be revised for up to 30 days"**; "For invoicing-grade totals, query dates at least 30 days in the past"; `data_refreshed_at` watermark on every response |
| Cursor | hourly aggregation; poll at most once per hour | — |
| Google BigQuery export | "within a day, but can sometimes take more than 24 hours"; backfill up to 5 days | `export_time` tells you when a row was last updated |
| Azure Cost Management | EA/MCA 8–24h; PAYG up to 72h; estimates refreshed 6×/day | period closes up to 72h after month end; charges "can continue to accrue and can change until the fifth day"; **open-month estimates "don't consider tiered pricing plans … based on the highest tier"** |
| Bedrock | up to 24h for cost and for newly activated tags | tags never retroactive |

*Bearing:* "today's spend" is a fundamentally different object from "last month's spend", and
several vendors expose a machine-readable watermark (`data_refreshed_at`, `export_time`) precisely
so that clients can draw the line. This is a real UI problem the vendors have all had to solve.

### 8.3 Projected spend

Only the two hyperscalers ship a forecast, and neither computes a naive run-rate.

**AWS Cost Explorer**
([forecasting](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html),
retrieved 2026-09-05):

- *"Cost Explorer forecasts have a prediction interval of 80%. If AWS doesn't have enough data to
  forecast an 80% prediction interval, Cost Explorer doesn't provide a forecast. This is common for
  accounts that have less than one full billing cycle."* — **it refuses rather than guesses.**
- *"Because forecasts are predictions, the forecasted billing amounts are estimated and might
  differ from your actual charges for each statement period."*
- *"The range in the prediction band is dependent on your historical spend volatility … The more
  consistent and predictable the historical spend, the narrower the prediction range."*
- The interval is drawn: lines either side of the cost line, or either side of the bar top.

**Google Cloud Billing**
([forecasted costs](https://docs.cloud.google.com/billing/docs/how-to/reports/forecasted-costs),
retrieved 2026-09-05):

- *"The total forecasted cost combines … The total actual cost to date for the selected time period
  [and] The predicted cost for each future day in the selected time period."* — **actuals-to-date
  plus predicted-remainder, not an extrapolation of the whole period.**
- A seasonality-aware ML model: outlier handling, gap filling, and "multiple layers of seasonality
  … daily, weekly, and monthly cycles". Horizon up to **12 months**.
- *"The cost forecast is an approximation based on your historical trends."*
- Forecasts are **unavailable** under certain filters (Products, Originating products, Spend-based
  CUDs) and for Billing-period ranges.
- The selected time range "doesn't limit what data is used" — history from outside the view feeds
  the prediction.

**Azure** ([Cost Analysis](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis),
retrieved 2026-09-05): *"Forecasting employs a time series linear regression model"*, horizon up to
a year, with a documented lookback table (≤28-day forecast → 28-day lookback; >90 days → 90 days)
and the advice that *"At least 90 days of historical data are recommended for a more precise annual
forecast."* The Forecast REST API returns a `CostStatus` column (e.g. `"Forecast"`) alongside
`PreTaxCost` — **with no confidence interval field documented**.

*Bearing:* three shipped forecasts, three different methods (80%-interval statistical model;
seasonality-aware ML; plain linear regression), and one of the three declines to answer without a
full billing cycle. What they share is that the projection is **actual-to-date + predicted-
remainder**, and that all three attach a hedge in prose. None presents a bare number.

---

## 9. Where the evidence is thin, and where sources disagree

Stated plainly, because an unqualified brief is worse than a hedged one.

1. **No verified Gemini/Vertex dollar figures.** The Google pricing pages are JS-rendered or exceed
   the fetch size limit; three separate URL attempts failed on 2026-09-05. The *structure* of
   Google's pricing is well evidenced (SKU names and IDs); the *numbers* are not. Anything Gemini
   in a rate card must come from the Cloud Billing Catalog API or a human opening the page.
2. **No verified current-generation Bedrock figures.** Same cause. Only retired Claude 3.5-era rows
   rendered. Note the internal inconsistency in AWS's own docs: the CUR page opens by saying CUR 2.0
   "provides line-item detail for every Amazon Bedrock inference request" and later says CUR carries
   no per-request line items. The later statement is the operative one — the FAQ and every
   mechanism table corroborate "the finest grain is per usage type per day."
3. **No verified Azure list prices from the pricing page** — every cell rendered as `$-`. The Azure
   numbers in §6.3 come from a launch blog post dated 2026-07-09 and are already partly superseded
   by a promotion the same post announces.
4. **OpenAI docs are unreachable to automated fetch** (`platform.openai.com` and `help.openai.com`
   both 403). API shape was therefore taken from the published OpenAPI specification — arguably a
   *better* primary source — but the billing-period statement in §8.1 rests on a search extract and
   is flagged as lower-trust.
5. **OpenRouter contradicts itself on markup.** The FAQ says pricing is passed through "without any
   markup"; the pricing page lists a 5.5% platform fee and a 5% fee above a monthly allowance. These
   reconcile if the no-markup claim applies to the per-token model rate while fees apply to credit
   purchase and above-allowance volume — but OpenRouter never says so.
6. **Google's report timezone (US Pacific) is documented; its BigQuery export's is not.** Two
   Google docs that never reconcile with each other. Do not assert that the export's daily buckets
   align with the console's Pacific-time day — verify it empirically.
7. **The short/long context threshold on OpenAI's pricing page is undocumented** on that page.
   Google's equivalent (≥200K) *is* documented; Anthropic exposes `0-200k` / `200k-1M` as a
   reporting dimension.
8. **Bedrock's documented invocation-log schema lists only `input.inputTokenCount` and
   `output.outputTokenCount`** — no cache token fields — even though cache counts exist in the API
   response and in CloudWatch. Anyone costing from logs alone would mis-count cached workloads.
9. **Cache tokens are a billing dimension more consistently than a metrics dimension.** Google's
   `token_count` metric has no cached label; Azure's cache-match-rate and `ActiveTokens` are PTU-only
   for OpenAI models (though Anthropic deployments on Foundry get dedicated cache metrics).
10. **Nothing found on how any vendor presents "rework" or retry cost.** Cursor's `isChargeable`
    flag and Claude Code's `query_source` (main / subagent / auxiliary) are the closest anything
    comes to distinguishing one logical unit of work from the API calls that served it. If model
    mix is under-served by vendors, attempt-vs-task is unserved entirely.

---

## 10. Tensions this raises for `CONTEXT.md` (flagged, not resolved)

These are observations against the existing glossary. Each is a decision for another ticket.

- **`cache_write_tokens` as one field cannot be priced against Anthropic's own rate card**, which
  charges 1.25× for a 5-minute write and 2× for a 1-hour write. Anthropic, and Azure's
  Anthropic deployments, both report the TTL split.
- **"Input tokens" is not a portable concept.** Anthropic/Bedrock report *uncached* input as a
  disjoint class; OpenAI's `input_tokens` is a superset including cached and cache-write tokens.
- **Cost is not a pure function of (model, token counts).** Service tier, context tier, region,
  speed mode and negotiated discount all move the price, and Anthropic ships both `amount` and
  `list_amount` because of the last one. An "illustrative rate card" keyed on model alone is a
  defensible simplification only if it is stated as one.
- **`family` and `tier` roll-ups have no vendor precedent.** Every vendor stops at exact model.
- **Per-model cost is not always recoverable from billing** — Claude on Azure and on Claude
  Platform on AWS bills as one CCU line.
- **Money as decimal strings in minor units** is the commercial convention (Anthropic, Cursor),
  with explicit warnings against float parsing; LiteLLM's float-dollars is the outlier.
- **Cost derived from telemetry is labelled `estimated` by the vendor that owns both sides of it.**
- **Aggregation windows are capped in practice**: 31 days (Anthropic analytics), 30 days (Cursor,
  OpenRouter activity), 3 months at daily grain (Azure), 62 days before Google auto-rolls to
  monthly. Nobody serves 180 days at session grain over an API in one call.

---

## 11. Method and trust

Sources were read directly wherever a page would render to automated fetch, and OpenAI's API shape
was taken from its published OpenAPI specification rather than its docs site. Vendor pricing and
docs pages were preferred over every secondary write-up; no FinOps-vendor blog or third-party
summary is cited as evidence for a vendor's own behaviour. Two subagents gathered the
Google/Azure and Bedrock/OpenRouter material in parallel; their findings were folded in with the
same citation and dating discipline, including their own statements of what they could not verify.

Everything above was retrieved on **2026-09-05**.

### Primary sources

**Anthropic**
- Usage and Cost API — <https://platform.claude.com/docs/en/manage-claude/usage-cost-api>
- Usage report reference — <https://platform.claude.com/docs/en/api/admin-api/usage-cost/get-messages-usage-report>
- Analytics APIs — <https://platform.claude.com/docs/en/manage-claude/analytics-api>
- Enterprise Analytics reference — <https://platform.claude.com/docs/en/api/admin/analytics>
- Claude Code Analytics API — <https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api>
- Spend Limits API — <https://platform.claude.com/docs/en/manage-claude/spend-limits-api>
- Pricing — <https://platform.claude.com/docs/en/about-claude/pricing>
- Claude Code OpenTelemetry — <https://code.claude.com/docs/en/monitoring-usage>

**OpenAI**
- OpenAPI spec — <https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml>
- Pricing — <https://developers.openai.com/api/docs/pricing.md>
- Usage/Costs cookbook — <https://developers.openai.com/cookbook/examples/completions_usage_api>
- Enterprise usage limits (lower trust; 403 to direct fetch) — <https://help.openai.com/en/articles/20001001-manage-usage-limits-and-overages-in-chatgpt-enterprise-and-edu>

**Google Cloud**
- Billing reports — <https://docs.cloud.google.com/billing/docs/how-to/reports>
- Forecasted costs — <https://docs.cloud.google.com/billing/docs/how-to/reports/forecasted-costs>
- Standard BigQuery export — <https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-tables/standard-usage>
- Detailed BigQuery export — <https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-tables/detailed-usage>
- Gen AI v2 SKU group — <https://cloud.google.com/skus/sku-groups/gen-ai-v2>
- Gemini 2.x SKU group — <https://cloud.google.com/skus/sku-groups/vertex-api-gemini-2-x-skus>
- Monitoring metrics A–B — <https://docs.cloud.google.com/monitoring/api/metrics_gcp_a_b>

**Microsoft Azure**
- Cost Analysis quickstart (incl. forecast) — <https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis>
- Usage details fields — <https://learn.microsoft.com/en-us/azure/cost-management-billing/automate/understand-usage-details-fields>
- Understand Cost Management data — <https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/understand-cost-mgt-data>
- Azure OpenAI monitoring reference — <https://learn.microsoft.com/en-us/azure/foundry/openai/monitor-openai-reference>
- Prompt caching — <https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching>
- Manage costs in Foundry — <https://learn.microsoft.com/en-us/azure/foundry/concepts/manage-costs>
- Claude CCU billing — <https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/claude-models-billing>
- GPT-5.6 pricing announcement — <https://azure.microsoft.com/en-us/blog/gpt-5-6-now-available-in-microsoft-foundry/>

**AWS**
- Bedrock cost management — <https://docs.aws.amazon.com/bedrock/latest/userguide/cost-management.html>
- Understanding Bedrock CUR data — <https://docs.aws.amazon.com/bedrock/latest/userguide/cost-mgmt-understanding-cur-data.html>
- Application inference profiles — <https://docs.aws.amazon.com/bedrock/latest/userguide/cost-mgmt-application-inference-profiles.html>
- IAM principal attribution — <https://docs.aws.amazon.com/bedrock/latest/userguide/cost-mgmt-iam-principal-tracking.html>
- Cost management FAQ — <https://docs.aws.amazon.com/bedrock/latest/userguide/cost-mgmt-faq.html>
- Runtime CloudWatch metrics — <https://docs.aws.amazon.com/bedrock/latest/userguide/monitoring-runtime-metrics.html>
- Model invocation logging — <https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html>
- Prompt caching — <https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html>
- Bedrock pricing — <https://aws.amazon.com/bedrock/pricing/>
- Cost Explorer forecasting — <https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html>

**OpenRouter**
- Usage accounting — <https://openrouter.ai/docs/use-cases/usage-accounting>
- Activity API — <https://openrouter.ai/docs/api/api-reference/analytics/get-user-activity>
- Generation API — <https://openrouter.ai/docs/api-reference/get-a-generation>
- Activity export — <https://openrouter.ai/docs/guides/administration/activity-export>
- Analytics cookbook — <https://openrouter.ai/docs/cookbook/administration/analytics-cost-control>
- Models guide — <https://openrouter.ai/docs/guides/overview/models>
- Prompt caching — <https://openrouter.ai/docs/guides/best-practices/prompt-caching>
- BYOK — <https://openrouter.ai/docs/use-cases/byok>
- Pricing / FAQ / Rankings — <https://openrouter.ai/pricing>, <https://openrouter.ai/docs/faq>, <https://openrouter.ai/rankings>

**Agent platforms**
- Cursor Admin API — <https://cursor.com/docs/account/teams/admin-api>
- GitHub Copilot request billing — <https://docs.github.com/en/copilot/concepts/billing/copilot-requests>
- GitHub Copilot metrics API — <https://docs.github.com/en/rest/copilot/copilot-metrics>
- LiteLLM cost tracking — <https://docs.litellm.ai/docs/proxy/cost_tracking>
