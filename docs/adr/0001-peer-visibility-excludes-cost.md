# ADR-0001: Peer visibility covers jobs, never cost

Date: 2026-09-05
Status: **Superseded** by [ADR-0003](0003-individual-visibility-is-open-by-default.md), 2026-09-05.

*Retained for its reasoning, not its conclusion.* This ADR was in force, shaped tickets 06 and 12,
and was reversed in two steps on the day it was written — first partially (see Amendment below),
then wholly. ADR-0003 folds this history in and is the document to read for the current position.
The evidence and the surveillance argument recorded here are still the best statement of the case
that lost.

## Context

Agent-usage analytics is surveillance-adjacent. Every metric this product surfaces about a
Member — sessions run, tokens consumed, dollars spent — can be read either as *capacity
information* or as *a performance signal about a person*, and the product does not get to
choose which reading a manager applies. It only gets to choose what it makes visible.

The access model is two-dimensional: a permission is a (subject scope × datapoint class) cell,
where subject scope ranges over `self`, `peer`, `team`, `peer-team`, `org`, `org-member`, and
datapoint class over `jobs`, `tokens`, `cost`, `access` (see `CONTEXT.md` § Access). The
question this ADR settles is what the `peer` scope — *named individuals on your own team* —
grants.

Two positions were live:

1. **Peer scope grants everything.** Full transparency inside a team; teammates see each
   other's spend. Simple to explain, and it is what a naive reading of "team dashboard" implies.
2. **Peer scope grants `jobs` only.** Teammates see *what each other worked on*; nobody sees
   what a named teammate *cost* except that teammate.

The pull toward (1) is real: a cost-per-member leaderboard is trivially easy to build, it is
visually striking, and in the *AI-platform* category it is the default — Cursor ships a
`leaderboard` endpoint with an explicit `rank` field and per-user spend; OpenAI's admin console
ranks users by credits consumed. The *engineering-analytics* category behaves oppositely:
effort-cost there is universally role-gated, and no vendor surveyed ships peer-visible cost.
This product sits between the two categories, which is why the question has to be answered
deliberately rather than inherited.

## Decision

**`peer` scope grants the `jobs` datapoint class, and does not grant `cost`.**

*(As originally written this also withheld `tokens`. That clause was reversed on 2026-09-05 — see
Amendment.)*

Peer-level cost is not reachable at team scope by anyone. Cost becomes resolvable to named
individuals only at `org-member` scope, which is an administrative grant, not a default one.

Aggregates remain broadly visible: any Member can see team-level and org-level totals for
benchmarking. What is withheld is the *resolution of those totals to a named colleague*, which
is precisely the distinction the access model is built around.

## Consequences

**Accepted.** Individual agent spend is not a performance signal, and a product that ranks
engineers by dollars spent teaches its users to optimise for the wrong thing. An engineer who
knows their spend is on a leaderboard will avoid the frontier model on the hard task — which is
exactly the task where it pays for itself. Making per-person cost cheap to view manufactures
that pressure whether or not any manager intends it.

**Cost.** The single most visually obvious chart in this product category is unavailable. Any
"top spenders" view has to be built from aggregates or from `org-member` scope, and the demo
gives up an easy screenshot.

**Where cost analysis goes instead.** Spend is analysed along non-person dimensions — Model,
AgentTemplate, Repository work domain, Team — which is also where the actionable finding
actually lives. "The refactor template is expensive on infra-config repos" is a decision an
engineering leader can act on; "Sam is expensive" is not.

**Where the line is deliberately not drawn.** `jobs` at peer scope *is* granted: teammates
seeing what each other worked on is collaboration, and withholding it would make the product
worse without protecting anything. The claim is not that visibility is bad, it is that the
`cost` class specifically converts into a personal performance judgement in a way `jobs`
does not.

**Reversibility.** Low cost to reverse in code — it is a cell in a permission matrix. High cost
to reverse in product terms, because it is a stated position, which is why it is recorded here.

**Known gap — resolved 2026-09-05, see Amendment.** This ADR governs *scope*, not *display*. The documented 2026 failures — Meta's
"Claudeonomics", Amazon's "KiroRank" — were all failures of **ranked comparative** per-person
cost, and no source isolates non-comparative individual visibility as harmful. A strictly
evidence-led reading would forbid the *leaderboard*, not the *datapoint*. This ADR takes the
stricter line; whether that is right is an open question for ticket 05, not a settled one.

**Known hole — resolved 2026-09-05 by accepting it, see Amendment.** Withholding `peer` cost does not prevent recovery of it by subtraction from
`team` aggregates in a small Team. GitHub Copilot addresses this with a hard k-anonymity floor
of five. Ticket 12 decides whether this product does the same; until it resolves, the guarantee
in this ADR is weaker than it reads.

## Evidence

`.scratch/agent-dash/research/01-competitive-metric-landscape.md` (ticket 01, 2026-09-05).
An earlier revision of this ADR claimed most engineering-analytics competitors ship a
cost-per-member leaderboard. That conflated the two vendor categories and was wrong; corrected
above.

## Amendment — 2026-09-05

Resolved by the human on [ticket 12](../../.scratch/agent-dash/issues/12-aggregate-reidentification.md),
which reopened both the Known gap and the Known hole above.

**What changed: the `tokens` clause is reversed.** Named token volume *is* visible for other
Members — not at `peer` scope, but at the new `cohort` scope, meaning anyone doing comparable
work regardless of Team. The reasoning that withheld it does not survive contact with the
evidence this ADR itself recorded: the harm in the documented 2026 episodes was **ranking**, and
a token count is not a spend figure. See [ADR-0002](0002-comparison-unit-differs-by-class.md).

**What did not change: the `cost` clause stands.** No regular Member sees a named colleague's
currency figure at any scope. A Member's currency comparison is their Team's **per-capita**
average. Named individual currency is an *additional* grant, held with team-level access.

This is worth stating plainly because it is easy to misread the amendment as a wholesale reversal.
It is not. The strict position on money held under direct pressure; the position on token volume
did not.

**The Known gap is resolved, and not in this ADR's favour.** The gap asked whether the line is
"no per-person cost" or "no *ranked comparative* per-person cost". The decision is that **no
structural guardrail against ranking is imposed** — a leaderboard is neither mandated nor
forbidden by the access model, and whether one ships is a metric-set and IA question (tickets 05
and 07). The `cost` clause above therefore rests on scope alone, which is a narrower foundation
than this ADR originally implied. Recorded rather than papered over.

**The Known hole is resolved by accepting it.** No minimum-population floor is introduced, at any
scope. On a small Team, Team per-capita × headcount minus one's own spend resolves to the
remaining members' total — exactly, on a Team of two. This ADR does **not** guarantee that a
named colleague's spend is unrecoverable; it guarantees only that the product does not display
it. Anyone reading the original wording as a privacy guarantee was reading more than it can
deliver, which is why this paragraph exists.
