Type: grilling
Status: open
Blocked by: 05, 08
Label: wayfinder:grilling

# Fixture grain and schema

## Question

What is the exact shape of the fixture data, and at what grain is it stored?

## What has to come out of it

- **Grain.** Session-level rows, pre-aggregated rollups, or both — and what that costs in
  fidelity and in browser performance. Every filter and roll-up the metric set requires has to
  be answerable from whatever grain is chosen.
- **Derived vs stored.** Which values are computed at read time and which are baked in. Cost is
  derived from TokenUsage against a rate card; whether that derivation happens in the fixture or
  in the app is a real trade-off against testability.
- **Shape of the entity graph** across Organization, Team, Member, Repository, Task,
  AgentSession, TokenUsage, Model, AgentTemplate, Role.
- **Scale and generation.** How much data, over what period, generated how, and seeded so that
  every run is identical.
- **Realism.** The distributions that make the data believable — and, more importantly, the
  ones that make the intended findings actually *present* in the data rather than asserted over
  noise. A fixture that does not contain the insight the dashboard claims to surface is a
  broken demo.
- Whether the archived scale (4 teams / 20 members / 180 days) survives.

## Blocked by

05 (metrics determine what must be answerable) and 08 (taxonomies determine the categorical
columns). This is the ticket the archived v1 got backwards by fixing scale before shape.
