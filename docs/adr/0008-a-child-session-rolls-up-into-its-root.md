# ADR-0008: A sub-agent's session rolls up into the session that spawned it

Date: 2026-09-09
Status: Accepted

Decided in [ticket 48](../../.scratch/agent-dash/issues/48-multi-agent-sessions.md).
Reverses the position taken by
[ticket 08](../../.scratch/agent-dash/issues/08-dimension-taxonomies.md) — **one agent per
AgentSession** — and amends `CONTEXT.md` § Work and § Metric Concepts.

## Context

Ticket 08 settled the session model on a single agent: an AgentSession is *"a single attempt at a
Task"*, launched under a fixed set of labels, and a Task addressed by several sessions is a Task
that was attempted several times. Two of the product's three differentiator metrics are built
directly on that reading:

- **Rework** — a non-accepted session followed by another session on the same Task;
- **Decomposition** — more than one accepted session on the same Task.

`CONTEXT.md` says why they exist at all: *"The distinction between Task and AgentSession exists so
that Rework is measurable"* — three retries and three first-time successes are otherwise
indistinguishable.

**The platform this dashboard reports on is multi-agent.** A session fans out to sub-agents, and
each sub-agent is a session: it holds its own machine, burns its own tokens, and is billed. Under
ticket 08's model those extra rows land on the same Task, carry no acceptance of their own, and are
therefore counted as retries. **The Rework rate rises with how much a team parallelises.** Measured
on the committed fixture the error is not marginal: 18% of Tasks exhibit Rework, and 31% do if the
fan-out is counted as attempts.

The same reading corrupts everything else stated per session. Acceptance rate divides by sessions
that could never be accepted. Cost per session divides one attempt's spend across the agents that
did it, so the more a team fans out the cheaper each "session" reads. The velocity of a Task worked
by four agents looks like four times the activity.

## Decision

**An AgentSession carries `parent_session_id: string | null`.** A **root** has `null`. A **child**
names its root, and:

- **inherits five labels** — Task, Member, Repository, WorkType and `execution_mode` — which the
  loader enforces over the committed data rather than trusting;
- **never carries `accepted`**: acceptance is the attempt's, and the attempt is the root;
- **runs inside its root's window**: it starts after the root and ends before it;
- **is one level deep**: a child's parent is always a root, and a child spawns nothing.

**"A session" means a root session, everywhere.** Rework, Decomposition, Completed Task, Acceptance
rate, Cost per session and session counts are all defined over roots.

**A child's Cost, TokenUsage and duration spans roll up into its root, once, at parse** — on the
same line of `src/data/load.ts` as R-M2's hidden-session strip, and for the same reason: a
per-query fold is a fold somebody eventually forgets. Nothing above the data layer is handed a
population that still holds children. The child rows survive on a separate map, keyed by root, and
are read by `/demo/history` alone.

**The wall clock does not roll up.** The root's `started_at` and `ended_at` already span the whole
attempt, so Session duration is unchanged by a fan-out. Machine allocation *is* summed, because two
agents holding two machines for an hour is two machine-hours.

**"Agents per session" is added to the Session duration panel**, as median and p95.

## Why

**The metric the product is graded on was wrong in the direction that flatters nobody.** Rework
rate is one of three figures this dashboard exists to state, and on a multi-agent platform it read
a team's parallelism as its failure rate. No caption fixes that; only the model does.

**A child is not a second attempt, and the difference is observable.** A retry starts after the
previous session ended and is launched by a person. A sub-agent starts *inside* its parent's window
and is launched by an agent. The parent link records what the platform already knows, rather than
asking a heuristic to recover it from timestamps.

**One fold, at the boundary, is the only placement that cannot drift.** The alternative — every
query folding for itself — puts the same three-line addition in twelve places, and the first one
that forgets it double-counts a fan-out's cost against its own root. ADR-0005 already put cost
attribution upstream so this application aggregates rather than derives; folding at parse keeps
"the rows the application sees" a single, stated population.

**Acceptance on the root, and only there, makes the wrong shape unrepresentable.** A child with an
outcome is a fixture fault, not a row to interpret, so no denominator anywhere can quietly acquire
sessions that had no criterion to meet.

## Consequences

- **Session counts fall and per-session money rises**, on the same work. The committed fixture
  carries 1,049 rows on disk — 1,034 of them visible — against 742 attempts. Every figure stated
  per session is now stated per attempt, and the median session cost moved from $3.44 to $3.64
  because a session's cost is its whole tree's.
- **`machine_allocation_duration_s` and `ended_at − started_at` are no longer equal on every row.**
  They were always two different claims — when the session ran, and what it held a machine for —
  and this is what makes them come apart. `duration.ts` reads the instants, so nothing had to
  change; the fixture test that asserted the equality now asserts the *difference is exactly the
  children's machine time*.
- **Seat cost fell from 48.2% to 46.2% of Total spend.** A child's cost is real session spend, and
  R-D4's sharpest finding is a ratio with session spend in the denominator. The fan-out is sized in
  `targets.mts` so the finding survives, and that sizing is now a fixture constraint like any other.
- **The Hidden rule acquired a second clause**: a hidden root takes its children with it. A visible
  child of a hidden root would be a cost with nowhere to roll up to.
- **`/demo/history` gained the only view of the tree.** Every other surface reads a figure that
  already has the fan-out inside it, which is exactly why the page showing raw rows has to show it.
- **The model does not describe a deeper tree, and will not by accident.** A grandchild is a
  fixture fault. If sub-agents ever spawn sub-agents, this decision is what has to be revisited —
  the roll-up becomes a traversal and `childFaults` is where the change starts.
- **Agent execution time is still not separately recoverable** from the three presence spans
  (`CONTEXT.md` § Duration spans). The fan-out makes the *machine* time of parallel agents visible
  and says nothing about which of them was doing the work.

## Reversibility

Moderate. The field, the loader's fold and the generator's fan-out are cheap to remove. What is not
cheap is the reasoning: `CONTEXT.md` § Work now defines Rework, Decomposition and Acceptance rate
over roots, and every figure in the committed fixture was regenerated with children in it. Reverting
would mean regenerating the dataset and re-deriving every asserted figure — which is the same work
this ticket did, in the other direction.
