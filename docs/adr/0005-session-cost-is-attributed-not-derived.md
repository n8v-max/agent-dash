# ADR-0005: Session cost is attributed upstream, not derived in the app

Date: 2026-09-07
Status: Accepted

Decided in [ticket 10](../../.scratch/agent-dash/issues/10-fixture-grain-and-schema.md).
Reverses a position taken by [ticket 08](../../.scratch/agent-dash/issues/08-dimension-taxonomies.md)
and previously written into `CONTEXT.md` § Models & Money.

## Context

Ticket 08 settled that TokenUsage is stored as four disjoint counts and that **Cost is derived
from them against the rate card, never stored**. The map named the resulting pricing function
"the cleanest unit-test target" available to the project.

## Decision

**Cost is attributed per AgentSession upstream, by the platform's billing system, and stored on
the session row.** The application aggregates it. The application prices nothing.

Both rate cards move into the fixture generator, which prices each session and writes a `cost`
field. The token card is still displayed on `/demo/spend` as a reference table showing the card
the generator used; the compute card is displayed nowhere.

## Why

**It is how the real system works.** Billing attributes cost per session; analytics reads it.
`CONTEXT.md` already said as much — *"authoritative money lives in billing, not in analytics"* —
while simultaneously requiring the analytics layer to compute the money itself. The two
statements could not both be true.

**It moves the test surface to where the risk is.** The interesting failures in this product are
aggregation failures: non-additive Team totals, the comparability intersection, timezone-bounded
period edges, per-capita denominators that include service accounts. Pricing a session is
multiplication.

## Consequences

- **The project loses its cleanest unit-test target**, and test coverage is one of three stated
  grading criteria. This is the real cost of the decision and it is recorded rather than
  discovered. The tests that replace it assert aggregations, not billing totals.
- **`CONTEXT.md` § Models & Money is rewritten**: cost is stored, the cards are generator inputs,
  and the four token classes remain stored because volume is still an adoption measure.
- **The "estimated" label narrows to projection only.** An attributed figure is the bill, not an
  estimate of it. Labelling it "estimated" would understate the one solid number on the page. The
  rate-card display keeps a separate "illustrative rates" label, because the rates are invented
  even though the costs are not.
- A stored cost can disagree with the displayed card. It does not here, because the generator
  prices from that card — but the reconciliation is now a property of the generator rather than a
  guarantee of the code path.
