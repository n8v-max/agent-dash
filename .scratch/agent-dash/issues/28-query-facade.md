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

### 2026-09-08 — design pass before implementing (AFK build, wave 6)

The handover calls for the extra design pass here and nowhere else. Recorded in the deep-module
vocabulary, because the choice that matters is **where the seam is and how wide the interface is**,
not what goes behind it.

**Decision: one query per page, not one per panel.**

The obvious shape is one exported function per panel — around twenty of them,
`costPerCompletedTaskOverTime(viewer, params)` and so on. Rejected. It is a **shallow** interface:
twenty entry points for a caller to learn, each a thin wrapper, and the route has to know which
seven to call and in what order. Worse, each would independently load rows, resolve the viewer's
grants, and bucket the range — so seven panels on one page could disagree about the population or
the bucket edges, which is the same failure `aggregate.ts` avoided by computing the overlap note in
the grouping pass that did the double counting.

**One function per page** — `spendPage(viewer, params) → SpendPageViewModel` — is the deeper
interface. A route learns one call. The load, the permission filter (R-T17, before aggregation),
and the bucketing happen **once per page**, so the panels on it cannot disagree. The page ViewModel
holds one fully-resolved panel ViewModel per panel, and the page component's whole job is to hand
each panel its slice.

Six functions, one per route in R-N1. `/demo/people` and `/demo/history` return discriminated
results where a param switches the surface (`?member=` → profile rather than table).

**The deletion test.** Delete `queries.ts` and the complexity does not vanish — it reappears in
every route, each loading, filtering, bucketing, aggregating, capping and comparing for itself.
It earns its keep.

**The interface is the test surface.** A page ViewModel is a single assertion target, and it is the
same surface the panels consume. There is nothing to test *past* it.

**R-T16 is enforced by the type, not by convention.** `Viewer` is producible only by ticket 29's
`resolveViewer`, which verifies the JWT. Every query takes it as its first parameter, so a query
callable without a viewer has no expression — "an unfiltered query does not typecheck" is
structural rather than aspirational.

**R-T7 — the mirror's independence is in the derivation path, not in the values.** T-C1 requires
the mirror's values to *equal* the rendered series, so they cannot be allowed to differ. What
R-T7 forbids is deriving the mirror *from the series array*, which would make it a second printing
of one array and prove nothing. The mirror is therefore built from the **aggregation result**
(bucket keys × group keys → values) on its own path, while the series are built from the same
aggregation through capping, ordering and painting. They share the arithmetic and not the array,
which is what makes T-C1 a real cross-check.

**A new domain module carries this**, because R-T7 says the mirror is built in the domain layer and
no module builds one yet. `queries.ts` stays orchestration — load, filter, bucket, measure, assemble
— over deep domain modules, and the ViewModel assembly itself lives below the seam so a component
still has nothing in scope to compute with.

**The params type must sit at or below `src/data`.** R-T26 puts the parse/serialise module in
`components/controls/` (ticket 30), but `queries.ts` consumes what it produces, and `src/data` may
not import `src/components`. Ticket 28 therefore defines the validated control-set **type**; ticket
30 builds the parser that produces it. `periods.ts` already exposes `availableGrains` and
`parseGrain` for exactly this handover.
