Type: research
Status: resolved
Label: wayfinder:research

# Competitive metric landscape and the productivity-metrics critique

## Question

What metrics do engineering-analytics and AI-coding platforms actually surface today, and what
is the standing critique of developer-productivity measurement that this dashboard has to have
an answer to?

## Scope

Two halves, both needed.

**What exists.** LinearB, Waydev, Swarmia, DX, GitHub Copilot metrics/Copilot Workspace,
Cursor's team analytics, and any vendor dashboards for agent or LLM platform usage. For each:
which metric families are surfaced (adoption, velocity, quality, cost, efficacy), at what
grain, and to whom.

**What is wrong with it.** DORA and SPACE framing; the documented failure modes of individual
developer productivity metrics (Goodhart effects, surveillance dynamics, lines-of-code-style
proxies). Anything credible on how AI-assist metrics specifically go wrong.

## Why it is being asked

Feeds the metric set (05) and the dimension taxonomies (08). This project has already taken a
position that peer-level cost is not visible (`docs/adr/0001`); the critique literature is what
either validates or undermines that position, and the CEO interview will probe it.

## Deliverable

A brief at `.scratch/agent-dash/research/01-competitive-metric-landscape.md`, with sources
cited inline. Findings only — do not propose this product's metric set; that is ticket 05 and
it is a human decision.

## Answer

Brief: [`.scratch/agent-dash/research/01-competitive-metric-landscape.md`](../research/01-competitive-metric-landscape.md)
— ~990 lines, 171 inline citations, resolved 2026-09-05.

Gist:

- **The two categories behave oppositely.** Engineering-analytics vendors (Swarmia, DX, LinearB,
  Waydev) share a metric vocabulary and differ mainly on *grain*; effort-cost is universally
  role-gated and none was found shipping peer-visible cost. AI-platform dashboards are the
  reverse: Cursor ships a `leaderboard` endpoint with `rank` and per-user spend, OpenAI's admin
  console ranks users by credits. Named-individual grain is the AI-platform default.
- **GitHub Copilot is the documented exception**: a hard k-anonymity floor of five licensed
  members per day, enforced at the API. Its metrics schema was rewritten on 2026-02-27; older
  field names are dead.
- **Stated position ≠ shipped default.** DX says its Speed metric must never be used at
  individual level, yet ships a Personal Dashboard with individual metrics on by default.
- **Claude Code's Analytics API is the closest existing shape** to this project's TokenUsage —
  per-user, per-model input/output/cache split plus estimated cost, arrived at independently.
- **Agent efficacy is a category-wide blank.** Nothing surveyed exposes a labelled
  succeeded/failed field or a retry count. Acceptance rate is the dominant proxy and its
  critique could not be traced to a primary study.
- **The 2026 tokenmaxxing episode is the sharpest evidence**: Meta's "Claudeonomics" and
  Amazon's "KiroRank" both killed within weeks; Microsoft moved AI-usage targets to division
  level. Every documented failure was of *ranked comparative* per-person cost — no source
  isolates non-comparative visibility.
- **Counter-pressure is equally documented.** Gartner (24 June 2026): 23% of tech leaders spend
  $200–500/dev/month on tokens, and token discipline "will not emerge through developer choice
  alone." Nothing in the literature reconciles the two.

Consequences recorded elsewhere:

- ADR-0001 corrected — its competitor claim conflated the two categories.
- New ticket **12** graduated from this finding: aggregate re-identification below a population
  floor.
- Two live tensions logged to the map's fog for ticket 05 to settle.
