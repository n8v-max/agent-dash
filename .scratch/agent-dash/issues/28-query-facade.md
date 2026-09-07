Type: implementation
Status: resolved
Blocked by: 24, 25, 26, 27
Label: resolved

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

### 2026-09-08 — implemented (AFK build, wave 6)

Built on `main`, uncommitted. Gates: `pnpm lint` (0 errors, the one pre-existing `e2e/payload`
TODO warning) · `typecheck` · `test` 680 (594 before) · `test:coverage` 95.2 statements / 84.8 branches, every
per-file `src/domain/**` threshold met · `build` · `e2e` 22.

**What the seam is made of.**

- `src/domain/viewmodel.ts` — **new domain module**, the ViewModel assembly R-T7 requires to sit
  below the seam: the chart ViewModel, the mirror, `stackable`, the tile and the (generic,
  sorted-here) table.
- `src/domain/metrics/projection.ts` — **new**, plus T-U21 in substance. `PROJECTION_METHOD` is a
  **constant** so "the method is identical at 10% and at 90% elapsed" is expressible as an
  assertion rather than as prose; the elapsed fraction is a separate field, and there is no band,
  interval or bound on the type (R-N24), asserted as an absence over the returned keys.
- `src/domain/periods.ts` gains `civilDayIn` and `civilDaysBetween`, so projection does its
  civil-date arithmetic through the module that owns the program's single `Intl` conversion
  rather than opening a second one.
- `src/domain/metrics/duration.ts` gains `medianOf`, so R-N17's comparator median is the same
  nearest-rank median a duration is read with.
- `src/data/params.ts` — the **validated control-set type** (ticket 30 builds the parser),
  `DECLARED_CONTROLS` as R-C1's table in data, and `coerceGrain` for R-M11.
- `src/data/queries.ts` re-exports six page queries from `src/data/queries/**` (the 300-line
  budget; `queries.ts` alone would spend it).

**The panel → query map, for wave 9.** `summaryPage` → R-N4's four tiles (`tiles[3].chart` is the
stacked WorkType mix). `spendPage` → `costPerCompletedTask`, `totalSpend`, `costPerSession`,
`costPerCompletedTaskByWorkType`, `costByRepository`, `adoption.{tokensOverTime,modelMix,rateCard}`.
`workPage` → `velocity`, `acceptance` (five, `acceptanceAxis` shared), `taskRates`,
`incompleteAges`, `duration`, `presenceSpans`. `peoplePage` → `{surface: table | profile |
withheld}` plus `matrix` on every arm. `historyPage` → `{surface: table | session | withheld}`,
every row carrying R-N20.1's detail. `projectionPage` → `elapsed`, `method`, `actual`, `projected`,
`tiles`, `chart`.

**Three decisions recorded, not re-decided.**

1. **The seat charge is not extrapolated** on `/demo/projection`. R-M5 charges seats by whole
   months and R-D2 forbids pro-rating one across elapsed days, so a month's seat cost is final on
   day one; only session Cost is elapsed-proportional, and the ViewModel says so in `note`.
2. **A member-level grouping collapses subjects the viewer cannot name into one "Unnamed Members"
   series.** `team`/`org`/`peer-team` are *aggregated* scopes, so one series per unnamed person
   would be an identified breakdown built out of an aggregated grant. The rows stay in the totals;
   the identity does not appear. Same rule gives `/demo/people` and `/demo/history` their row sets
   and their "counted and not named" notes.
3. **`?session=` addresses R-N20.1's expanded row.** It is a surface switch, not a toolbar
   control, so it is deliberately absent from `DECLARED_CONTROLS.history` (R-C1) — exactly as
   `?member=` is absent from `DECLARED_CONTROLS.people`. The detail also rides on every row, so a
   purely client-side expansion needs nothing further.

**One argument against a spec line, recorded rather than acted on.** R-N8 stacks *Completed Tasks*
by WorkType and justifies it with "WorkType is a true partition — every AgentSession references
exactly one". That is true of sessions and not of Tasks: a Task whose accepted sessions span two
WorkTypes is counted in both, so the five columns can sum past the Organization's Completed Task
count. The implementation follows R-N8 (`stackable: true`) because the spec is the fixed point;
the honest alternatives are to measure sessions there, or to key a Task to its first accepted
session's WorkType. Ratio panels are separately never stackable, whatever their grouping.

### 2026-09-08 — implemented (AFK build, wave 6)

All six gates green: `lint` (0 errors; the one warning is ticket 29's T-E4 TODO) · `typecheck` ·
`test` (**680 tests**, up from 594) · `test:coverage` (statements 95.2 / branches 84.8 / functions
96.3 / lines 97.0, no threshold error; every per-file `src/domain/**` 95/90 met — `viewmodel.ts`
96.55/95, `projection.ts` 100) · `build` · `e2e` (22 passed).

`src/data/queries.ts` re-exports eleven modules under `src/data/queries/`, with `context.ts`
carrying `pageContext(viewer, params)` — the once-per-page load, permission filter and bucketing
the design called for. All six page queries take `(viewer: Viewer, params: ControlSet)` with
`Viewer` first, and `Viewer` is producible only by `resolveViewer`, so R-T16's "an unfiltered query
does not typecheck" is structural.

`ControlSet` lives in `src/data/params.ts` alongside `DECLARED_CONTROLS` (R-C1 expressed as data)
and `coerceGrain` (R-M11). Ticket 30 builds the parser that produces it.

**Every panel has a query.** `/demo` four tiles each with an R-N7 change figure · `/demo/spend`
panels 1–7 in R-N9 order with the ratio first (R-N10) plus the R-N11 rate card · `/demo/work`
panels 1–6 including the five acceptance small multiples on a shared axis and the `interactive`-only
presence spans · `/demo/people` table, `?member=` profile, comparator and the R-A10 matrix on every
arm · `/demo/history` the ten-column table with `detail` on every row (R-N20.1) · `/demo/projection`
actual, extrapolation, elapsed share and the incomplete flag. Nothing omitted — this was the wave-9
precondition and it is met.

**The mirror's independence.** The aggregation result is a `Cell[]` — (bucket key × group key) →
value — built once per panel. Two paths leave it: the series through `capSeries` (whole-range
ranking, cap, painting), and the mirror summed straight out of a `Map<group, Map<bucket, number>>`
grid. The mirror takes only **column identity and order** from the capped set; every number comes
from the grid, and the "Other" column is an independent sum over exactly the groups the cap did not
name. `mirrorFrom` never reads a `SeriesPoint`. `queries.test.ts` walks **every chart on every
page** and compares `fromMirror(chart)` against `fromSeries(chart)` on real data with the cap
engaged.

**`stackable` is three domain facts ANDed** — `STACKABLE_GROUPINGS[grouping] && measure ===
"additive" && (rollup.partition ?? true)`. R-V1's table is data. **Team is false three times over**:
declared false, and `aggregate.ts` reports `partition: false` for it. Asserted for team-subject
`/demo/spend` and `/demo/work`, which also carry R-V3's overlap note. A **ratio is never stackable**
however cleanly its grouping partitions the rows — which R-V1 does not say and which follows from
what stacking claims.

**T-U21** (19 tests): elapsed-proportional extrapolation with `now` injected, the civil day read in
the Organization's timezone rather than UTC; at 10% and 90% elapsed the `method` is *identical* (it
is a constant, so this is expressible) while `elapsed.fraction` differs, both asserted; and **no
confidence band** — no key matching `band|confidence|interval|lower|upper|margin`, with the exact
key set pinned and the method sentence asserted to carry no interval word.

One correctness fix worth a reviewer's eye: whole-range figures read `ClassView.rows`, the buckets'
own rows flattened, so a summary figure and the chart beside it cannot disagree about which sessions
are in the period.

### Spec problem — R-N8 stacks a measure its own justification does not cover

**R-N8 makes the fourth summary tile a stacked area of *Completed Tasks* by WorkType**, and
justifies the stacking with *"WorkType is a true partition — every AgentSession references exactly
one"*. That is true of **sessions**. It is not true of **Tasks**: a Task with accepted sessions in
two WorkTypes is a Completed Task under both, so the five columns can sum past the Organization's
Completed Task count — which is exactly the false claim R-V1 exists to prevent, and the same shape
as the Team problem R-V3 makes explicit.

The fixture makes this real, not hypothetical: ticket 25 found **118 Tasks spanning more than one
WorkType**.

**R-N8 was followed** (`stackable: true`), because the spec is the fixed point and this is not an
implementer's call. The two honest alternatives, for whoever decides: measure **sessions** in that
tile, where the partition genuinely holds — but R-N4 names Completed Tasks and ticket 05 rejected
session counts as a velocity measure; or **key each Task to its first accepted session's WorkType**,
which restores the partition at the cost of a rule nothing else in the product uses.

### Three decisions recorded rather than re-decided

1. **The seat charge is not extrapolated on `/demo/projection`** — only session Cost is. R-M5 makes
   seat cost a whole-month charge and R-D2 forbids pro-rating it, so projecting a fraction of it
   would invent the precision both refuse.
2. **Member-level groupings collapse subjects reached only through an *aggregated* grant into one
   "Unnamed Members" series.** A per-person breakdown built from a `team` grant would be an
   identified reading of an aggregated scope, which is precisely the distinction T-U10 exists to
   keep.
3. **`?session=` addresses R-N20.1's expanded row** as a surface switch, and is deliberately absent
   from `DECLARED_CONTROLS.history` exactly as `?member=` is absent from `people` — neither is a
   control, and R-C1 says a page shows only its declared controls.
