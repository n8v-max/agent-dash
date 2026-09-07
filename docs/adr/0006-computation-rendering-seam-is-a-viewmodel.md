# ADR-0006: The computation/rendering seam is a ViewModel, not a function call

Date: 2026-09-07
Status: Accepted

Decided at the `/to-spec` handoff. Closes the open item recorded in
[ticket 09](../../.scratch/agent-dash/issues/09-testing-architecture.md), which was itself closed
`wontfix`.

## Context

Ticket 09 asked where the seam between metric computation and rendering sits, and named it *"the
single highest-leverage structural decision here."* It was cut when scope narrowed to the top three
tickets, and closed recording its own cost:

> Nobody has decided where the seam between metric computation and rendering sits. The intent —
> pure functions over fixture rows, isolated from React — is implied by the list above but is not
> architecture until someone draws it.

The map named this *"the discard with the most exposure"*, because test coverage is one of three
stated grading criteria and this is the ticket that would have made coverage a property of the
architecture rather than a number chased afterwards.

Two forms of the same intent were available.

**The weak form.** Aggregation lives in pure functions; components import them and call them during
render. This is what most React codebases do, it satisfies a literal reading of "pure functions over
fixture rows", and it is what ticket 09's default position would most naturally have produced.

**The strong form.** Aggregation lives in pure functions whose *results* cross the boundary as a
plain data structure. Components receive resolved values and have no aggregation function in scope.

## Decision

**The seam is a ViewModel: a plain, serialisable, fully resolved data structure.** A panel component
receives one and renders it. It does not receive `AgentSession[]`. It does not filter, bucket, sum,
sort, rank, cap or compare.

Three layers, two boundaries:

1. `src/data/load.ts` — the only I/O in the application. Parses committed fixtures; strips hidden
   sessions once, as a dataset invariant.
2. `src/domain/**` — pure functions. Permission filtering, bucketing, aggregation, comparability,
   capping, change. May not import `react`, `next`, `node:fs`, or anything from `src/app`,
   `src/data` or `src/components`.
3. `src/app/**` and `src/components/**` — rendering only.

`src/data/queries.ts` is the façade between 2 and 3, and every query takes `(viewer, params)`: an
unfiltered query does not typecheck.

**The boundary is enforced by an ESLint `no-restricted-imports` rule, not by convention.**

## Why

**Because the weak form leaves aggregation reachable from React.** If a component can call
`aggregate()`, then sooner or later a metric is only exercised by rendering — which is precisely the
failure ticket 09 was worried about. Making the boundary a *data structure* rather than a *function
call* means a component physically cannot compute: there is nothing in scope to compute with. That
is what converts an intent into architecture.

**Because it makes the test pyramid fall out rather than be imposed.** With no computation in
components, there is no numeric assertion a component test could make that a unit test does not make
better. The layers stop competing for the same assertions.

**Because the table mirror only works this way.** Every chart carries a visually-hidden `<table>`
mirror, which is both the accessibility affordance and the suite's primary assertion target. Built
in the domain layer it is an independent statement of what the chart claims; derived in the component
from the series it renders, it would be the same array printed twice and would prove nothing.

## Consequences

- **Components are near-trivial, and component coverage is thin by design.** The global 80% coverage
  threshold is carried by the domain layer. `src/domain/**` therefore carries its own raised bar —
  95% statements / 90% branches — so that high coverage of trivial rendering code cannot mask thin
  coverage of the arithmetic that decides what the product claims.
- **Every panel needs a query.** More plumbing than the weak form, paid once per panel.
- **A ViewModel must stay serialisable**, since it crosses the Server/Client Component boundary.
  No class instances, no functions, no `Date` objects.
- **Series identity is domain-supplied.** The ViewModel carries an explicit stable `key`, never an
  array index — which is what makes shadcn's `key={index}` legend patch mechanical when encountered,
  and makes the legend-identity test possible at all.
- **The rule decays the moment the lint rule is removed.** It is the only thing standing between this
  decision and a convention.

## Reversibility

Low while panels are few; high once they are many. Reversing means every panel that renders a
ViewModel learns to aggregate instead. Recorded here because it is cheap to reverse *now* and
expensive later, and because a reader who finds a component unable to call `aggregate()` will
otherwise assume an oversight.
