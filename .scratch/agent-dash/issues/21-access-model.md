Type: implementation
Status: ready-for-agent
Blocked by: 20
Label: ready-for-agent

# Permission matrix as a pure function

## Goal

`src/domain/access.ts` — the two-dimensional access matrix (subject scope × datapoint class)
implemented as a pure row filter, with both shipped presets expressed as data.

## Scope

- Scopes: `self`, `peer`, `team`, `peer-team`, `org`, `org-member`. Classes: `jobs`, `tokens`,
  `cost`, `access`. A permission is one cell; **it is not a level on a single ladder** and must not
  be implemented as one.
- Roles are **data**, not an enum (`CONTEXT.md` § Access).
- Two presets (R-A3):
  - **Open default** — `org-member` over `jobs`, `tokens`, `cost`, `access`.
  - **Restricted** — `self` over `cost`; `team` over `jobs` and `tokens`; **no `access`**.
- **Aggregated vs identified is a separate grant.** `team` resolves totals but not names;
  `org-member` resolves names. This distinction does no work in the default configuration, which is
  exactly why it needs implementing deliberately rather than falling out.
- **The filter runs on rows, before aggregation** (R-T17). Filtering a computed aggregate leaks by
  arithmetic; filtering rows does not.

## Done when

**T-U10** passes: all 24 cells asserted table-driven, both presets cell by cell including the
negatives, the aggregated/identified distinction, row-level filtering asserted on the *input* to
aggregation, and symmetry under the open default.

## Notes

ADR-0003 is the position: individual usage and spend are **open org-wide by default, symmetric, no
minimum-population floor at any scope or class**. The matrix is the *mechanism*, not the default —
it exists so visibility *can* be restricted, and the restricted preset ships precisely so the
mechanism is demonstrable. A grid where every cell is granted is indistinguishable from having no
grid.

Read ADR-0003 in full before implementing. It records two superseded positions, and the reasoning
that lost is the substance of the decision.
