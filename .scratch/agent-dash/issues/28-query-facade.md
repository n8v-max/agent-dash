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

## Comments

### 2026-09-08 — a dependency gap in the wave plan (AFK build, wave 5)

**`src/domain/metrics/projection.ts` has no owning ticket before this one, and this ticket needs it.**

`technical-spec.md` § 2 lists `domain/metrics/projection.ts` in the layout. Every other module there
has an owner in an earlier wave — `types.ts` (20), `periods.ts` (22), `access.ts` (21),
`aggregate.ts` (23), `spend.ts` (24), `efficacy.ts` (25), `adoption.ts`/`duration.ts`/
`comparability.ts` (26), `series.ts`/`change.ts` (27). Projection is the exception: its unit test
**T-U21** is listed under **ticket 36's** Done-when, and ticket 36 is blocked by 31, so it lands in
wave 9 — *after* this ticket.

But this ticket's Done-when is *"every panel in `spec.md` § 3 has a query returning a complete
ViewModel"*, and § 3.6 is `/demo/projection` (R-N23). So the façade cannot be complete without a
projection module that does not yet exist.

**Resolved by building it here**, which is the smaller change and keeps the wave order intact:

- **This ticket builds `src/domain/metrics/projection.ts`** — elapsed-proportional extrapolation,
  with `now` injected (P5) — and its unit tests, which are T-U21 in substance:
  *"At 10% elapsed and at 90% elapsed the method is identical and the elapsed fraction differs —
  both asserted, because they are different claims. **No confidence band is produced** (R-N24)."*
- **Ticket 36 then inherits T-U21 as already satisfied**, and is left with rendering: the
  one-sentence method statement, the elapsed fraction as a share, the incomplete-period flag, and
  the "estimated" label that R-V8 gives to Projected cost alone. It should verify T-U21 rather than
  re-derive it.

This is recorded rather than re-decided — nothing in any spec changed, and no requirement moved.
Ticket 36 has the matching note.

### The panel checklist this ticket's Done-when resolves to

`spec.md` § 3, enumerated, because "every panel" is the wave-9 precondition and needs to be
checkable rather than judged:

- **`/demo`** (R-N4) — Total spend · Completed Tasks · Cost per completed Task · Completed Tasks by
  WorkType. Each carries a period-over-period change figure subject to the change floor (R-N7).
- **`/demo/spend`** (R-N9) — 1 Cost per completed Task over time · 2 Total spend split into session
  and seat cost · 3 Cost per session with the `accepted` filter · 4 Cost per completed Task by
  WorkType · 5 Cost by Repository · 6 Tokens processed over time · 7 Model mix at exact/family/tier.
  Plus the illustrative token rate card (R-N11).
- **`/demo/work`** (R-N12) — 1 Completed Tasks per period (raw or per-capita) · 2 Acceptance rate as
  small multiples, one per WorkType · 3 Rework and Decomposition as two lines · 4 Incomplete Tasks
  by age bucket · 5 Session duration median and p95 · 6 Human-presence spans, `interactive` only.
- **`/demo/people`** — the seven-column table (R-N15) · the `?member=` profile (R-N16) · the
  comparator (R-N17) · the permission matrix (R-A10).
- **`/demo/history`** — the flat session table (R-N19) · the expandable row (R-N20.1).
- **`/demo/projection`** — actual to date plus the extrapolation (R-N23).
