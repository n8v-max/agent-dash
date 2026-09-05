# ADR-0002: The unit of comparison differs by datapoint class

Date: 2026-09-05
Status: **Superseded** by [ADR-0003](0003-individual-visibility-is-open-by-default.md) on the day
it was written, 2026-09-05.

*A false start, retained briefly and retired.* This ADR proposed that each datapoint class be
compared against a different population — `tokens` across a work cohort, `cost` within a Team. The
decision to make individual usage and spend open org-wide removed the problem it solved: the
per-class split existed to withhold currency while sharing volume, and nothing is withheld now.
Its one surviving idea — that a *comparison group* should be the people doing comparable work — is
kept, demoted from an access scope to an aggregation dimension. See `CONTEXT.md` § Aggregation
Dimensions.

## Context

[ADR-0001](0001-peer-visibility-excludes-cost.md) treated the access matrix as one question —
*how sharply can you see other people* — answered once, uniformly, for every datapoint class. Its
amendment of 2026-09-05 broke that assumption: the `tokens` clause was reversed while the `cost`
clause stood. That is not a patch to a single cell. It means the two classes are answering
different questions and therefore need different comparison populations.

The pressure came from [ticket 12](../../.scratch/agent-dash/issues/12-aggregate-reidentification.md),
which set out to decide a k-anonymity floor and instead reopened what the aggregates were *for*.
The stated purpose of showing a Member any comparison figure is **ballpark self-reference** —
*"am I heavy or light"* — not expense auditing. Once that is the job, the Team stops being the
obvious comparison population, because the Team is an organisational unit and the question is an
analytical one. If one person on a Team does mobile work, comparing their volume against four
backend engineers answers nothing.

Two facts from the research constrain the answer:

- **~200× input-price spread across model tiers**
  ([ticket 02](../../.scratch/agent-dash/research/02-agent-platform-usage-cost-reporting.md)).
  Model mix, not volume, is the dominant cost lever. A token count is therefore a *poor* proxy
  for spend — which is what makes token volume safe to share and money not.
- **Every documented 2026 failure was a ranking, not a disclosure**
  ([ticket 01](../../.scratch/agent-dash/research/01-competitive-metric-landscape.md)). Meta's
  Claudeonomics ranked the top 250 token users with gamified tiers; Amazon's KiroRank scored staff
  on token consumption and induced *tokenmaxxing* — agents pointed at pointless work to climb the
  board — which raised compute spend with no matching value. Microsoft pre-empted the same failure
  by setting budgets at **division** level. Nothing in the record isolates non-comparative
  individual visibility as the harm.

## Decision

**Each datapoint class is compared against the population that makes it meaningful.**

| Class | Unit | Default for a Member | Additional grant |
|---|---|---|---|
| `jobs` | `peer` | named teammates | — |
| `tokens` | `cohort` | named, anyone doing comparable work, any Team | — |
| `cost` | `team` | own spend, plus Team **per-capita** — not named | team-level access → named individual breakdown |

**`cohort`** is added to the subject-scope vocabulary as a seventh scope. Its key is
**viewer-selected** — Repository work domain, AgentTemplate, or both — so cohort membership is
computed per view rather than stored, and a Member belongs to as many cohorts as they do kinds of
work. `peer-team` is retained but no longer carries the phrase *"never resolved to named
Members"*: named cross-Team reach now exists, via `cohort`, for `tokens` only.

Three supporting decisions:

- **No minimum-population floor, at any scope or class.** Accepted with its consequence: see
  *Consequences*.
- **No structural guardrail against ranking.** The access model neither mandates nor forbids a
  leaderboard. Whether one ships is a metric-set and IA question (tickets 05, 07).
- **Enforcement lives in the data layer.** The permission filter is a pure function over fixture
  rows and a below-grant figure never reaches the client payload. A view-layer filter would leave
  the number in devtools, which is not a guarantee.

## Consequences

**Accepted: the subtraction hole is real and unguarded.** Team per-capita × headcount is the Team
total; minus one's own spend it resolves to the remaining members' total — exactly, on a Team of
two. No floor prevents this. The product's position is that it does not *display* named peer
currency, not that named peer currency is unrecoverable. Stating this is the point: a guarantee
that arithmetic defeats is worse than an honest limit, and GitHub Copilot's k=5 floor was the only
surveyed precedent for the alternative.

**Accepted: the Goodhart exposure is unmitigated.** With no anti-ranking rule, this product can be
built into the artifact that Meta and Amazon both withdrew. The mitigation relied upon is
symmetry — every Member sees every other Member's token volume on the same terms, so there is no
asymmetric watcher — plus the fact that the visible cross-person number is *volume*, which the
200× spread makes a weak target to inflate toward. That is a weaker mitigation than a structural
rule and is recorded as such. The exposure lands hardest here of all places, because a
cost-control dashboard that induces tokenmaxxing defeats its own premise.

**Cost: two comparison surfaces to design, not one.** A cohort-keyed token comparison and a
team-keyed currency view are different components answering different questions, and the cohort
key is a user-facing control. This is real IA work — ticket 07.

**Open: token volume does not serve the product spine.** The spine is cost control. But the same
200× spread that makes token volume safe to share also makes it a poor predictor of spend, so
cohort token comparison serves **adoption intensity**, not cost. The product's most widely visible
cross-person metric is therefore not the one its positioning rests on. Ticket 05 owns this.

**Open: named per-person model mix is not settled.** `tokens` is defined in `CONTEXT.md` as
"TokenUsage volume **and Model mix**". Named volume plus named model mix plus a visible rate card
reconstructs named currency by multiplication — circumventing the `cost` clause that ADR-0001's
amendment preserved. Model was settled as a *distribution display, not a filter*, which points the
right way but does not close it. **Whether per-named-Member model mix is exposed must be decided
in ticket 06**, and this ADR's `cost` position is contingent on that answer.

**Reversibility.** The scope vocabulary and the per-class table are data — cheap to change in
code. The stated position is not, which is why it is here rather than only in a ticket.

## Evidence

`.scratch/agent-dash/research/01-competitive-metric-landscape.md` and
`02-agent-platform-usage-cost-reporting.md` (2026-09-05).
Decision record: `.scratch/agent-dash/issues/12-aggregate-reidentification.md`.
