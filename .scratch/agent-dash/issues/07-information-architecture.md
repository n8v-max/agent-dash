Type: grilling
Status: open
Blocked by: 03
Label: wayfinder:grilling

# Information architecture and route map

## Question

How is this dashboard structured — what are the surfaces, what does each answer, and how does
navigation express the access model?

## What has to come out of it

- The surfaces and their routes, derived from the jobs rather than from the entity model.
- Where scope selection lives: a control present on every surface, a surface of its own, or
  something else.
- Where dimension roll-up switching lives, and whether it is per-chart or per-page.
- What navigation does with a surface the viewer has no permission for — hidden, visible and
  disabled, or visible with an upgrade-path explanation. This is a product decision with a real
  trade-off, not a rendering detail.
- How `/demo` relates to the authenticated surfaces: the same shell, or its own.

## Constraints already settled

The archived v1 route map (`/dashboard`, `/usage`, `/cost`, `/members`) mixed axes — three
datapoint classes and one subject scope — and is explicitly reopened. Public surface is thinned
to `/demo` plus a minimal landing.

## Inputs handed over by resolved tickets

**From ticket 03 (2026-09-05)**:

- **Cadence is unmeasured, and the money jobs look event-driven rather than habitual.** An IA
  built around a daily ritual may be built for a behaviour nobody exhibits. What does the
  structure look like if every visit is triggered by a question rather than a routine?
- **Aggregate above the individual, disaggregate below the company.** Over-aggregation is a named
  failure mode. If a surface only ever shows org totals, it fails the same literature that warns
  against individual grain — the IA has to make disaggregation reachable, not just permitted.
- **Ten seconds is the real legibility filter, not thirty**, and visual-complexity judgement
  lands in ~17ms. That is the wall-of-tiles problem measured rather than asserted.
- **Titles and supporting text carry the message** (Borkin et al., 10-second exposure). Chart
  labelling is load-bearing IA, not decoration.
- **None of nine surveyed public demos has a persona switcher.** This product's role switching on
  `/demo` is therefore unprecedented — which is either its most legible idea or a burden on a
  first-time viewer with a ten-second budget. Decide which, deliberately.

## Blocked by

03 — **resolved 2026-09-05. This ticket is now on the frontier.**

**From ticket 05 (2026-09-07, HITL)** — the metric set is settled and hands this ticket three
things it now owns outright:

- **View grouping and page layout are yours.** 05 declined to place its metrics on surfaces.
- **The fourth headline tile is provisional.** The headline is four tiles — Total spend ·
  Completed Tasks · Cost per completed Task · Rework rate — but rework rate may flatline at 0%,
  which is dead space at a ten-second read. What occupies that slot is this ticket's call.
- **Whether human-presence spans and machine time share one view or two.** Both are secondary,
  both are time-shaped, and both would duplicate chrome if split.

Also settled and constraining: Total spend exists only at monthly grain and coarser, so any
surface offering a day or week view cannot show it. Projection is a separate FinOps-first view
and is MVP-optional, so nothing else may depend on it.
