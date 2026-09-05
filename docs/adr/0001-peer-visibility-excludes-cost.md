# ADR-0001: Peer visibility covers jobs, never cost

Date: 2026-09-05
Status: Accepted

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

**`peer` scope grants the `jobs` datapoint class, and does not grant `tokens` or `cost`.**

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

**Known gap.** This ADR governs *scope*, not *display*. The documented 2026 failures — Meta's
"Claudeonomics", Amazon's "KiroRank" — were all failures of **ranked comparative** per-person
cost, and no source isolates non-comparative individual visibility as harmful. A strictly
evidence-led reading would forbid the *leaderboard*, not the *datapoint*. This ADR takes the
stricter line; whether that is right is an open question for ticket 05, not a settled one.

**Known hole.** Withholding `peer` cost does not prevent recovery of it by subtraction from
`team` aggregates in a small Team. GitHub Copilot addresses this with a hard k-anonymity floor
of five. Ticket 12 decides whether this product does the same; until it resolves, the guarantee
in this ADR is weaker than it reads.

## Evidence

`.scratch/agent-dash/research/01-competitive-metric-landscape.md` (ticket 01, 2026-09-05).
An earlier revision of this ADR claimed most engineering-analytics competitors ship a
cost-per-member leaderboard. That conflated the two vendor categories and was wrong; corrected
above.
