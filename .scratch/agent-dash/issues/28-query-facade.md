Type: implementation
Status: ready-for-agent
Blocked by: 24, 25, 26, 27
Label: ready-for-agent

# The query façade and the ViewModel boundary

**This ticket builds the seam.** Ticket 09 was closed `wontfix` recording that nobody had decided
where the seam between metric computation and rendering sits. `technical-spec.md` § 3 decided it;
this ticket implements it.

## Goal

`src/data/queries.ts` — the façade every Server Component calls, returning fully resolved,
serialisable ViewModels.

## Scope

- **The boundary is a data structure, not a function call** (R-T6). A panel component receives a
  ViewModel and renders it. It does not receive `AgentSession[]`. It does not filter, bucket, sum,
  sort, rank, cap or compare — **there is nothing in scope for it to compute with.**

  The weaker version — components importing `aggregate()` and calling it in render — leaves the
  aggregation reachable from React, which means it gets tested through React, which is the exact
  failure ticket 09 was worried about.

- ViewModel shape per `technical-spec.md` § 3.1: `buckets`, `series`, `other`, `overlapNote`,
  `empty`, `rollUpLevel`, `mirror`.
- **`key` is a domain-supplied stable identity, never an array index** (R-T8).
- **The table mirror is built here, not derived in the component** (R-T7). Derived in the component
  it would be a second rendering of the same array and would prove nothing; built upstream it is an
  independent statement of what the chart claims, and therefore a real assertion target.
- **Every query takes `(viewer, params)`** (R-T16). There is no query function callable without a
  viewer — an unfiltered query must not typecheck.
- The permission filter runs **before** aggregation (R-T17).

## Done when

Every panel in `spec.md` § 3 has a query returning a complete ViewModel, and the ESLint boundary
rule (R-T33) still passes.

## Notes

This is the highest-leverage structural decision in the project. If the seam erodes — if a component
starts computing — the thing that made coverage a property of the architecture is gone, and test
coverage is one of three grading criteria. The lint rule from ticket 17 is what keeps it from
decaying into a convention.
