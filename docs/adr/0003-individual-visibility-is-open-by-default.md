# ADR-0003: Individual usage and spend are open org-wide by default

Date: 2026-09-05
Status: Accepted

Supersedes [ADR-0001](0001-peer-visibility-excludes-cost.md) and
[ADR-0002](0002-comparison-unit-differs-by-class.md), both of which are retained for their
reasoning. This ADR folds in their history so the position can be read in one place.

## Context

Agent-usage analytics is surveillance-adjacent. Every metric this product surfaces about a
Member — sessions run, tokens consumed, dollars spent — can be read either as *capacity
information* or as *a performance signal about a person*, and the product does not get to choose
which reading a manager applies. It only gets to choose what it makes visible. That framing has
been constant across all three positions; what changed is the conclusion drawn from it.

**The question was answered three times in one day, each time under direct pressure.** Recording
the sequence, because the rejected positions are the substance of the decision:

**Position 1 — ADR-0001: `peer` grants `jobs`, never `tokens` or `cost`.** No Member sees a named
colleague's usage or spend; cost is analysed along non-person dimensions (Model, AgentTemplate,
Repository work domain) where the actionable finding actually lives. *"The refactor template is
expensive on infra-config repos"* is a decision an engineering leader can act on; *"Sam is
expensive"* is not.

**Why it fell.** Its own Known gap defeated it. Every documented 2026 failure was a **ranking**,
not a disclosure, and no source isolates non-comparative individual visibility as harmful. ADR-0001
conceded it took *"the stricter line on judgement, not evidence."* It also carried a Known hole:
withholding named cost does not prevent recovery of it by subtraction from a small Team's
aggregate, so the guarantee was weaker than it read.

**Position 2 — ADR-0002: the unit of comparison differs by class.** `tokens` compared across a
work cohort spanning Teams, `cost` within a Team as a per-capita figure, named breakdown only at
team-level access. Rested on a real fact: the ~200× input-price spread across model tiers makes
token volume a poor predictor of spend, so volume is safe to share where money is not.

**Why it fell.** It was elaborate machinery for withholding one number, and it bought less than it
cost: the subtraction hole survived it, per-named-Member model mix reopened the same leak by
multiplication, and it required a seventh subject scope plus two separate comparison surfaces. Its
complexity was load-bearing only under an assumption — that named spend is harmful to disclose —
that Position 3 rejects outright.

**Position 3 — this ADR.**

## Decision

**Every Member holds `org-member` scope over `jobs`, `tokens` and `cost` by default.** Named
individual usage and spend, for anyone in the Organization, visible to everyone on the same terms.

- **Symmetric.** If you can see mine, I can see yours. There is no asymmetric watcher and no
  administrative tier that sees more than an ordinary Member.
- **No minimum-population floor**, at any scope or class. Nothing is suppressed, merged or noised
  for small populations. The subtraction concern that opened ticket 12 is moot: there is nothing
  to recover by arithmetic that is not already shown directly.
- **No structural guardrail against ranking.** The access model neither mandates nor forbids a
  leaderboard; whether one ships is a metric-set and IA question (tickets 05, 07).
- **The permission matrix is retained as the mechanism.** Visibility is gated by a scope grant, as
  it always was — the default simply grants the widest one. `access` remains a datapoint class and
  the matrix is rendered read-only.
- **Restricted presets ship alongside the permissive default**, so the mechanism is demonstrable
  rather than theoretical. Ticket 06 owns which ones.
- **Enforcement lives in the data layer.** The permission filter is a pure function over fixture
  rows; a view-layer filter would leave the number in the client payload, which is not a gate.
- **`cohort` is not an access scope.** It survives ADR-0002 as an *aggregation dimension* — the
  population it is meaningful to compare a Member against, keyed on work domain and/or template,
  viewer-selected and computed per view. Relevance, not permission.

## Consequences

**Accepted, and this is the substance of the decision: the Goodhart exposure is unmitigated.** It
was raised before the decision and re-raised after, and the position was reaffirmed each time. The
record it runs against is specific. Meta's *Claudeonomics* (April 2026) ranked the top 250 token
users across 85,000+ staff with gamified tiers — *Token Legend*, *Session Immortal*, *Cache
Wizard* — and was withdrawn after roughly two days. Amazon's *KiroRank* (shut down 29 May 2026)
scored staff on token consumption and induced **tokenmaxxing**: agents pointed at unnecessary work
purely to climb, which *"drove up compute cost without proportional value"*. Microsoft pre-empted
the same failure by setting token budgets at **division** level, its EVP writing *"Tokenmaxxing is
not what we are optimizing for."*

That last case is the sharpest warning available, because Amazon's leaderboard made their compute
bill *worse* — a cost-control dashboard causing the harm it exists to prevent. What this product
relies on instead of a structural rule: **symmetry**, which removes the asymmetric-watcher dynamic
present in none of those three cases, and the fact that ranking is a *display* choice this ADR
leaves open rather than a thing the access model forces. Neither is equivalent to a rule. This is
a deliberate, informed position, not an oversight, and it should be defended as one.

**Corroboration that arrived after the decision, not before it.** Brief 15
(`.scratch/agent-dash/research/15-actionable-signal-landscape.md`) was gathered clean-slate and
resolved after this position was taken. It supports it on two counts, and the sequencing is worth
recording so the support is not mistaken for the reasoning:

- **The field ranks named engineers by default and publishes its rationale.** Google Workspace has
  been default-on since 2026-02-16 with a top bucket labelled *"the top 10% of users"*; Anthropic's
  `user_cost_report` sorts by spend by default; Cursor ships `/leaderboard`; Cline ships *"TOP
  SPENDING USERS"*. The stated justification is consistently **enablement or budget, never
  evaluation** — which is precisely the framing this product must adopt to be defensible.
- **GitHub's ≥5 k-anonymity floor was sunset on 2026-04-02.** That floor was brief 01's most
  transferable finding and the only surveyed precedent for the mechanism ticket 12 set out to
  build. Its withdrawal means the no-floor decision follows the field rather than departing from
  it.

**Open, and sharpened by brief 15: seat cost distorts the ordering, not just the total.** Seat fees
are invisible to usage APIs, so a cost-per-engineer figure derived from usage alone mis-ranks
people — a light user on a paid seat can cost more than a heavy user without one. This matters far
more under this ADR than under its predecessors: a product that shows named individual spend to
everyone is publishing an ordering, whether or not it renders a leaderboard. If that ordering is
wrong, the exposure is not just Goodhart but plain inaccuracy. Ticket 05 owns whether seat cost is
modelled.

**Won: the model got much simpler.** No floor, no per-class comparison units, no seventh scope, no
team per-capita device, no tokens-vs-currency split, no rate-card reconstruction hazard. Most of
what tickets 12 and 06 were carrying was machinery for withholding something no longer withheld.

**Won: the honest claim replaces an unenforceable one.** ADR-0001 promised that named peer cost was
unreachable; arithmetic defeated that on any small Team. This ADR promises nothing it cannot keep.

**Cost: the access matrix is invisible in the default configuration.** `CONTEXT.md` calls the
two-dimensional matrix a central, non-obvious idea, and a config that grants every cell
demonstrates none of it. This is why restricted presets ship — the mechanism has to be shown
working, or the modelling effort behind it is not visible to anyone assessing the product.

**Cost: the demo now argues a position rather than dodging one.** A product showing named spend
per person is the artifact two named companies withdrew. `/demo` must make the reasoning legible —
symmetry, no ranking mandated, comparison framed against comparable work — or a first-time viewer
will read it as the failure mode rather than the response to it. Tickets 07 and 03's ten-second
legibility budget both bear on this.

**Reversibility.** The grants are data — a preset change, not a rewrite. The stated position is
not reversible at the same cost, which is why it is recorded here.

## Evidence

`.scratch/agent-dash/research/01-competitive-metric-landscape.md`,
`02-agent-platform-usage-cost-reporting.md`, and `15-actionable-signal-landscape.md`
(all 2026-09-05; brief 15 resolved after this decision was taken).
Decision record: `.scratch/agent-dash/issues/12-aggregate-reidentification.md`.
