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

**From ticket 12 (2026-09-05, HITL)**:

- **The "must exercise both sides of the floor" requirement is withdrawn** — no floor exists, so
  Team sizes are unconstrained by access rules.
- **Replaced by a harder one: the fixture must contain at least one Member whose cohort crosses a
  Team boundary**, or the `cohort` scope — the central new idea in the access model — is never
  exercised by the demo or the tests. A fixture where work domains map cleanly one-to-one onto
  Teams silently makes cohort and team the same thing.
- **Cohort membership is computed, not stored.** It derives from Repository work domain and
  AgentTemplate on the rows themselves, so no cohort column is needed — but those two dimensions
  now carry access-model weight, not just analytical weight (see 08).
- **Rate cards must be present and priceable per Member**, since Team per-capita currency is
  derived, not stored.

**Correction — ticket 12 was reversed after the note above was written (2026-09-05).** The
requirements survive but their reason changed. `cohort` is no longer an access scope; it is an
aggregation dimension. The fixture must still contain **at least one Member whose cohort crosses a
Team boundary** — now so the *comparison control* is exercised rather than the permission model.
Access grants no longer constrain Team sizes at all: the default is `org-member` over everything.
New requirement instead: the fixture must support at least one **restricted Role preset** having a
visibly different view from the default, or ticket 06's presets cannot be demonstrated.


**From ticket 08 (2026-09-07, HITL)** — the entity graph and the categorical columns are fixed;
see `CONTEXT.md` §§ Work and Models & Money for field-level detail. Consequences for the fixture:

- **Grain is the AgentSession**, with TokenUsage at (session × model × four disjoint token
  classes). Cost is **derived, never stored** — the pricing function is a pure function and is
  09's cleanest unit-test target after the comparability intersection.
- **Every session carries an external Task key**; there are no unattributed sessions to model.
- **Invariant to assert in the generator**: the three duration spans sum exactly to
  `machine_allocation_duration_s`.
- **Distributions that must be present**, or the intended findings are asserted over noise:
  headless sessions ~100% AFK with zero interactive/idle time; at least one Task exhibiting
  Rework and one exhibiting Decomposition; at least one CPU-heavy, token-light session so the
  machine-allocation datapoint has something to find when it is expanded.
- **The `WorkType → [artefact kind]` map is fixture data**, not chart-layer convention.
- **Still needed from 08**: the Repository work-domain vocabulary and the Model roster.
