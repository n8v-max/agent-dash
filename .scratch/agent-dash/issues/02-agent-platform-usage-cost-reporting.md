Type: research
Status: resolved
Label: wayfinder:research

# How agent and LLM platforms report usage and cost

## Question

What are the real reporting shapes for token usage, model mix, and spend on agent and LLM
platforms — and what does a credible rate card look like?

## Scope

- How Anthropic, OpenAI, Google, AWS Bedrock, Azure AI, OpenRouter and similar expose usage and
  cost to an organisation: what dimensions, what grain, what periodisation.
- How cache read/write tokens are priced and reported, and whether they are surfaced separately
  in practice.
- Rate-card structure across vendors: what varies, what is stable, orders of magnitude.
- Whether anyone reports *model mix* as a first-class dimension, and how they present it.
- Billing-period semantics in the wild: calendar month vs rolling window, timezone handling,
  how "projected spend" is typically computed and caveated.

## Why it is being asked

This project stores TokenUsage at exact-model grain across multiple vendors with `family` and
`tier` roll-ups (`CONTEXT.md` § Models & Money). That shape needs to be defensible against how
the real thing works. Feeds the metric set (05), dimension taxonomies (08) and fixture
schema (10).

## Deliverable

A brief at `.scratch/agent-dash/research/02-agent-platform-usage-cost-reporting.md`, sources
cited. Include an illustrative multi-vendor rate card with a clear note on where the numbers
came from and how stale they may be.

## Answer

Brief: [`.scratch/agent-dash/research/02-agent-platform-usage-cost-reporting.md`](../research/02-agent-platform-usage-cost-reporting.md)
— ~1,000 lines, all figures retrieved and dated 2026-09-05. Resolved 2026-09-05.

Gist:

- **The industry converged on a two-endpoint shape**: usage in tokens, cost in money. Anthropic
  and OpenAI arrived at near-identical designs independently — same bucket widths, same limits,
  cursor pagination, and **cost at daily grain only** while usage goes to the minute.
- **Four token classes minimum**, reported separately because each prices differently. Two traps:
  vendors disagree on whether input is disjoint or a superset, and cache writes subdivide by TTL.
  → graduated ticket 13.
- **Rate cards are keyed on (model × token class × service tier × context tier × region × speed)**,
  not on model. `CONTEXT.md` corrected.
- **No vendor offers a `family` or cross-vendor `tier` roll-up.** Model is a flat group-by
  everywhere. This project's roll-up labels are a design bet without precedent — recorded as such.
- **Anthropic's `user_cost_report` supports `order_by amount`** — the per-member spend leaderboard
  ADR-0001 forbids is shipped by the closest analogue to this product.
- **Per-seat cost is always labelled *estimated*.** Authoritative money lives in billing.
- **Projected spend is a forecast product, not a run-rate**: AWS uses an 80% prediction interval
  and refuses to forecast without a full billing cycle; Azure uses bare linear regression.
- **Ratios**: output ≈5× input, cache read 0.1×, cache write 1.25–2×, batch −50%, and ~**200×**
  from fast to frontier on input. That spread is why model mix dominates cost variance — it
  validates the multi-vendor exact-grain decision.
- **Gaps declared**: Gemini and current Bedrock prices unverified (JS-rendered pages); OpenRouter
  contradicts itself on markup; OpenAI's billing-period claim rests on a lower-trust source.

Consequences: `CONTEXT.md` § Models & Money corrected in four places; ticket 13 graduated;
inputs handed to 05 and 10.
