# ADR-0009: At ten million sessions the loader becomes a query, and the seam holds

Date: 2026-09-09
Status: Accepted
Amended: 2026-09-10 ([ticket 66](../../.scratch/agent-dash/issues/66-fixture-window-volume-curve.md))
— every measured figure below was re-taken after the fixture went from 1,049 rows to 10,879. The
decision is unchanged; three of its numbers moved enough to be worth reading, and they are called
out where they sit.

Decided in [ticket 54](../../.scratch/agent-dash/issues/54-scale-adr.md), which asks for the
decision and forbids the code. **Nothing in the repository changes on account of it.** It extends
[ADR-0006](0006-computation-rendering-seam-is-a-viewmodel.md) — the seam it describes is the one
this document claims survives — and it inherits a complication from
[ADR-0008](0008-a-child-session-rolls-up-into-its-root.md) that is recorded under *Rework*, below.
It supersedes `technical-spec.md` R-T36 at volume and only at volume; R-T36 is right today and
this ADR says why.

## Context

**Everything in this application runs in one process over a static, committed fixture.** R-T36
records the envelope and the reason, and ticket 10 found the live constraint to be the opposite
one — **too few rows per bucket**, which is why R-M11 restricts day grain rather than why anything
needs optimising. Measured on the committed fixture today, `readDataset()` parses and validates
**10,879 rows** across 25 files in **75 ms**, and the whole of `/demo/spend` — seven panels
(R-N9) — resolves in **211 ms p50, 217 ms p95**.

*(Ticket 66 raised those from 1,049 rows / 8.2 ms and 23.8 ms p50. Both scaled linearly with the
row count and neither is a problem at this size, but the second was a load-bearing constant in
the budget below — see § The numbers, where it is re-taken and where the budget it feeds stops
closing inside 200 ms.)*

The question this ADR answers is what changes at **10M root sessions per Organization per year**,
four orders of magnitude up, and whether ADR-0006's three layers survive it. ADR-0006 put the seam
at a ViewModel and drew boundary 1 at `src/data/load.ts`: *"the only I/O in the application"*. It
says nothing about **which** rows cross that boundary, and that omission is the whole of the
headroom.

## Decision

**The seam holds. What changes is the population `load.ts` hands over.** It stops being every
session row and becomes a pre-aggregated row, and the layers above it are unchanged.

### 1. The grain

**`(day × member × repo × work_type × model)`**, with `day` the Organization's **civil** day, in
its declared timezone. `CONTEXT.md` § Period semantics fixes every boundary in that zone, so a
UTC-keyed day cannot be re-bucketed into an org-local week without going back to the sessions;
keying on UTC would defeat the fact table on the first week-grain read.

**It is one key with two measure groups, and they are two tables.** Session-grain measures — Cost,
session counts, acceptance, machine allocation, the three presence spans — live on the **model-free
projection** `(day × member × repo × work_type)`. Token-grain measures — the four disjoint classes
— live on the full key. `CONTEXT.md` § Model mix is the reason: *"a single AgentSession may consume
tokens across more than one Model, so no per-session metric can be grouped or filtered by Model
without attributing a session's cost to one of them unsoundly."* `AggregationInput` in
`src/domain/aggregate.ts` carries no model field for exactly that reason, and a cost column on a
model-keyed row would make money non-additive by model — the error R-M7 exists to prevent, written
into the storage layer where nothing above it could see it.

**`member` is in the key even though most panels roll it away.** The permission filter runs
*before* aggregation (R-A6, R-T17, technical-spec § 3.2) and resolves per Member. A pre-aggregate
that had already summed Members away could not be filtered, only apologised for.

**And the stated grain is one column short, which reading `src/data/params.ts` is what shows.**
`ControlSet` carries two session-level *filters* that are not group-bys and are therefore not in
the ticket's grain: `accepted`, which `/demo/spend`'s Cost per session panel reads
(`queries/spend.ts`), and `executionMode`, which `/demo/work` reads, both of them R-C2
panel-local controls. A filter has to be expressible in the key or it cannot be applied at all, so
**`accepted` and `execution_mode` ride the session fact as two further key columns.** They are
two booleans over a fact whose other keys are already fine-grained, so the widening is small and
measured: **1.104×** on the committed fixture (6,606 cells → 7,291). It was 1.037× before ticket
66; a busier Member-day lands on more distinct cells, so the two flags separate more of them. Every other filter is already
derivable — `team` and `memberKind` from `member`, `repository` and `workType` from their own
columns. `machine_spec` stays out, because `CONTEXT.md` says it is *"not an aggregation
dimension"* and nothing filters on it.

### 2. Where the pre-aggregation runs

**On the write path, in the ingest pipeline, once per session-tree — not in this application and
not in the read path.** ADR-0005 put pricing upstream; this puts summation upstream of the same
boundary. The application still prices nothing, and now also sums nothing below a day.

Two of `load.ts`'s five invariants move with it. **R-M2** — the hidden-session strip — and
**R-M19** — the child roll-up — become *pipeline* invariants: a hidden row and a child row never
reach the fact table at all, so the read path is handed a population that never held one. That is
the same argument ADR-0008 made for putting the fold at parse (*"a per-query fold is a fold
somebody eventually forgets"*), moved one boundary earlier. **R-D19** — a missing session file is a
fault — has no analogue and dies with the fixture.

A day's cell is **upserted, never appended**. See *Rework*, below, for why the job cannot be a
pure per-day map.

### 3. What stays computed at request time

Three things, and each fails for its own reason.

**Ratios.** A ratio *of* two pre-aggregates is fine; a pre-aggregated *ratio* is not, because it
cannot be re-divided at a coarser grain. Cost per completed Task for a month is not the mean of its
days' figures: Σcᵢ / Σtᵢ ≠ mean(cᵢ/tᵢ) unless every tᵢ is equal, and they never are. Storing the
rate would also destroy R-M18's absence — `src/domain/ratio.ts` returns `null` for a day that
completed nothing, and `null` is not a value a coarser roll-up can average past. So **the fact
tables carry no rate column of any kind**: two sums, and `ratio()` divides them at request time,
once, where the rule already lives.

**Top-N.** `capSeries` in `src/domain/series.ts` ranks across the **whole selected range** and then
buckets. That order is not recoverable from the daily top-4: a Member ranked fifth every day can be
first over ninety of them. The rank is a function of the range, the range is a URL parameter, and
pre-aggregating a rank fixes it against a range nobody selected. The same holds for `Other`, whose
membership is the complement of a rank.

**Change.** `changeBetween` needs the prior period, and `CONTEXT.md` § Period semantics *"imposes
no restriction on the base"* — any period may be compared with any other. A stored change is a
change against one particular base. R-M12's floor compounds it: the figure is suppressed only where
the prior period holds **nothing**, which is a fact about a period the fact table has not been asked
about yet.

**The line, stated once: the store may sum. Only the domain layer may divide, rank, compare or
partition.** Everything the store is permitted to do is collapse a dimension the page does not
display. The moment it computes a per-capita denominator it has taken over R-M14's exclusion of
service accounts; the moment it groups by Team it has taken over R-V3, and `aggregate.ts`'s overlap
note — built from the very placement that did the double counting, so that *"the note is not a
second opinion about the data"* — becomes a second opinion about a total it did not compute.

### 4. The one query that does not fit the grain: Rework

**Task is not in the grain, and adding it would not help, because Rework is not a sum.** It is an
ordered predicate over a Task's root sessions — `factsFor` in `src/domain/metrics/efficacy.ts`
reads `ordered.slice(0, -1).some((session) => !session.accepted)`. And the population is the
**filtered** one: `taskFacts` groups whatever rows the range and the permission filter handed it,
so a per-Task boolean materialised once is wrong for every range but the one it was computed over.

**It is served by a second fact at `(day × task_key)`**, carrying four columns over root sessions
only: `roots`, `non_accepted`, the start of the day's **last** root, and whether that last root was
accepted. Over any range, per Task — R = Σ roots, N = Σ non_accepted, and `lastAccepted` read off
the row with the maximum last-root start:

```
rework        ⇔  N − (lastAccepted ? 0 : 1)  >  0
decomposition ⇔  (R − N)  >  1
completed     ⇔  (R − N)  ≥  1
```

The first line is the whole of `factsFor`'s Rework: the non-accepted roots that are *not* the last
one. All three of `TaskFacts`' labels fall out of sums plus one lookup, over an arbitrary range,
which is the property a materialised boolean does not have.

**ADR-0008 has just made this harder, and it fixes an order between two jobs.** Rework is now
defined over **root** sessions, so *the child roll-up must complete before the Task grouping
begins*. In-process that is one line of `load.ts`; in a pipeline it is a hard dependency, and the
Task-grain job may not read the raw session stream.

**Worse, the roll-up is not day-local.** A child starts *after* its root and may cross midnight, so
its cost belongs to its **root's** civil day, not its own. Measured on the committed fixture:
**113 of 2,960 children — 3.8% — start on a later civil day than the root they roll into**, a
share unchanged at ten times the volume (it was 11 of 292), which is what makes it a property of
the fan-out rather than of one draw. A
map/reduce that partitions on the child's own timestamp puts 3.8% of the fan-out on the wrong day
and gets 3.8% of every day-grain cost figure wrong, silently, in a direction no invariant here
would catch. The job therefore keys on the root's day and holds a late-arrival window, and the
day's cell is rewritten rather than added to.

### 5. History

`/demo/history` is the only surface that reads raw session rows, and **it is not paginated in any
sense that survives scale.** `src/data/queries/history.ts` builds a `HistoryRow` for *every*
readable session in the range and hands the whole array to `tableViewModel`; `PAGE_SIZE = 50` is a
client-side slice, and R-T36 says so plainly — *"paginates client-side at 50 for readability, not
for performance"*. At 10M sessions one day of range is ~27,000 rows and the ViewModel is megabytes
crossing the RSC boundary.

It becomes a **server-side keyset page** on `(started_at, id)` — already the loader's tiebreak in
`byStartedAt`. The two figures R-N20.1 makes legal only here, per-session token classes and
per-session Model mix, are fetched **per expanded row** rather than for every row on the page.
`withheldNote`'s count comes back from the store as a count, not as a subtraction between two
materialised arrays.

## The numbers

Every figure below is derived. **The fixture measurements were re-taken on 2026-09-10, on ticket
66's dataset**; the machine measurements on Node 24.x, warm process, single-threaded. The
pre-ticket-66 figures are kept alongside where the movement is the interesting part.

### Row counts

Counted over the **post-roll-up** population, which is the fact tables' actual input: hidden rows
gone, children folded into their roots, a child's tokens carried at its *root's* day and labels.

| Measured on the committed fixture | | before ticket 66 |
|---|---|---|
| Session rows on disk | **10,879** | 1,049 |
| Hidden (R-M2) | 158 | 15 |
| Visible rows | 10,721 | 1,034 |
| Visible **roots** — the session fact's input | **7,761** | 742 |
| Children — **zero** fact rows | 2,960 | 292 |
| TokenUsage entries, distinct `(attempt × model)` after the fold | **11,467** → **1.478 per attempt** | 1,091 → 1.470 |
| Tasks | 5,970 | 570 |
| Session fact — distinct `(day × member × repo × work_type × accepted × execution_mode)` | **7,291** | 733 |
| the same without the two flag columns | 6,606 | 707 |
| Token fact — distinct `(day × member × repo × work_type × model)` | **10,930** | 1,075 |
| Task fact — distinct `(day × task_key)` over roots | **6,537** | 703 |

Three collapse ratios fall out: 7,761 / 7,291 = **1.064** attempts per session-fact cell,
11,467 / 10,930 = **1.049** attempt-models per token-fact cell, 7,761 / 6,537 = **1.187** attempts
per Task-day cell. All three rose with the density, and all three are still close to 1.

At **10M root sessions/org/year**, applying each ratio directly:

- Session fact: 10,000,000 / 1.064 = **9.4M rows/year** — 25,750/day
- Token fact: 10,000,000 × 1.478 / 1.049 = **14.1M rows/year** — 38,600/day
- Task fact: 10,000,000 / 1.187 = **8.4M rows/year** — 23,100/day
- **Total ≈ 31.9M rows/org/year, ~87,400/day**

**Ticket 66 turned this paragraph's conclusion around, and the mechanism is the one it named.**
The raw input at the same volume is 10M roots + 3.81M children (the fixture's 2,960 / 7,761 =
0.381 children per attempt) + 20.5M TokenUsage rows (2.049 per attempt, counted over roots *and*
children) = **34.3M rows**. The three fact tables are now **7% smaller** than the data they
summarise, where at 1,049 rows they came out 18% *larger*. Pre-aggregation started paying for
itself the moment a Member's day held more than one attempt — which is what the sentence below
predicted, arriving four orders of magnitude below the volume it was written about.

The ratios are measured at **3.22 attempts per active Member-day** across 2,412 active Member-days
(before ticket 66: 1.31 across 567, on a fixture R-D4 then required to be low-volume). They are
still a *floor* on collapse and the row counts above are still a *ceiling*, because collapse only
grows with density. **One assumption, named:** at ~7 attempts per active Member-day — the shape a
5,000-Member Organization would have to have to reach 10M/year at all — a Member's day lands on
about three distinct cells, giving a collapse near **2.3** and a session fact of ~4.3M rows/year.
The measured 1.064 at 3.22 attempts/day is consistent with that and no more than consistent: this
fixture spreads a Member's day over five Repositories and five WorkTypes, so its cells stay nearly
unique. The true figure sits between the two, and **the ceiling is what the p95 below is budgeted
against.**

**So the argument for the grain is not size.** It is that a read at this grain touches no session
id, resolves no parent link, joins to no TokenUsage table and scans no column it will not sum — and
above all that the row count stops being a function of the fan-out. ADR-0008's children are
**27.2% of the rows on disk and zero rows in the fact table.**

### Expected p95 for a Spend page read

The four machine measurements the budget rests on:

| Measured | p50 | p95 | before ticket 66 |
|---|---|---|---|
| `readDataset()` — parse + validate 10,879 rows, 25 files | 75.13 ms | 81.02 ms | 8.20 / 9.51 ms over 1,049 rows |
| `spendPage(viewer, params)` — all seven R-N9 panels, whole fixture | 211.23 ms | 217.26 ms | 23.83 / 24.66 ms over 742 attempts |
| `rollUp(…, "member")` — 5,000 Members, 100 Teams, 1,000 rows | 1.35 ms | 4.33 ms | unchanged (synthetic) |
| `rollUp(…, "member")` — 5,000 Members, 200,000 rows | 12.66 ms | 17.05 ms | unchanged (synthetic) |

`rollUp`'s asymptotic cost is **76 ns/row**. The two fixture rows scaled at 9.2× and 8.9× against
10.4× the data, so both are **linear in the row count and neither has a knee** — the only property
the budget below asked of them. `spendPage` works out at **20.2 µs per visible row**, and that
constant is the one that moved the budget.

For a 90-day, organisation-wide read of `/demo/spend`:

| Stage | p95 | Derivation |
|---|---|---|
| Store: range scan + `GROUP BY` | 80 ms | 90 × (25,750 + 38,600 + 23,100) = **7.87M** day-grain rows, day-partitioned, six narrow columns, at ≥10⁸ rows/s/core |
| Transfer of the grouped result | 10 ms | ≤5,000 rows (below) |
| Domain: seven roll-ups, cap, change, per-capita, mirrors | 30 ms | 7 × 4.33 ms measured |
| ViewModel, serialise, RSC render | 100 ms | **re-measured, ticket 66** — 20.2 µs/row over the ≤5,000 rows below |
| **Total** | **220 ms** | |

The Task fact is in the scan because `/demo/spend` needs it: `completedTaskKeys` feeds both Cost
per completed Task panels (R-N9 items 1 and 4).

**Ticket 66 pushed this budget past 200 ms, and the term that moved is the one measured here
rather than assumed.** The last row was 25 ms because the whole of `/demo/spend` over 1,034 rows
took 24.66 ms p95, and that page's cost is linear in the rows it reads: 20.2 µs each. The stage is
bounded by the ≤5,000 grouped rows the store hands over rather than by the session count, so it is
5,000 × 20.2 µs ≈ **100 ms**, and the total becomes **220 ms**. Two honest readings, and this ADR
takes neither yet:

- the 200 ms target survives only if the domain-and-render stage gets **four times cheaper per
  row**, or the store groups down to fewer than ~2,500 rows — which would mean giving up either
  R-V12's 5,000 ranked Members or a bucket axis;
- or the target moves. 220 ms is still a fast server read, and the figure this budget exists to
  bound is a **read**, not a page (see the last consequence below).

**Nothing is done about it here**, because this ADR forbids the codebase anticipating it and
ticket 66 was told to record the measurement rather than act on it. It is the first thing to
re-derive when the pipeline is actually built.

**Why the domain layer never sees more than ~5,000 rows.** The store applies the `GROUP BY` down to
the page's own axes, and both are bounded. Buckets: ≤62 at day grain (R-M11 caps it at two months),
≤53 weeks, ≤24 months. Groups: the largest dimension the page displays, which is Members. And the
two maxima do not multiply, because R-V12 makes the subject-grouped panels **lose their time axis**
at `subject=member`. The largest legal result on `/demo/spend` is 5,000 ranked Members, or 53
weekly buckets against one Organization total.

**The one assumption, named.** The store's scan rate is the only number above that is not measured.
Rather than assume a vendor figure we measured the **pessimistic bound**: the same hash `GROUP BY`,
in JavaScript, in this repository, runs at 76 ns/row — 13.2M rows/s — which would put the 7.87M-row
scan at **598 ms** and blow the budget on its own. Holding the *other* three stages at their
measured 140 ms means the store has to sustain **≥98M rows/s** to reach even 220 ms, which is
**7.4×** `rollUp`'s rate in V8 (it was 4.7× before ticket 66 re-measured the render stage). A day-partitioned
columnar engine summing six narrow columns is normally one to two orders faster than that. If it is
not, this budget fails at the store term and nowhere else, and the other three rows of the table
are unaffected.

**The trigger for a second materialisation.** The store term is linear in the range. Holding the
other three stages at their measured 140 ms leaves 80 ms of scan inside the 220 ms total, which at
10⁸ rows/s is 8M rows, which at 87,400 rows/day is **about three months** (it was five before
ticket 66 re-measured the render stage). Beyond that a **month-grain twin of the same key** is
materialised — same columns, `month` in place of `day`. On the fixture the day→month collapse now
measures **1.99×** on the session fact and **1.78×** on the token fact, where at 1,049 rows it was
1.18× and 1.14×: a Member's month holds 20.6 active days rather than 1.3, so the collapse has
begun to arrive. Both are still floors, and they approach the 30× day multiplier as density
rises. **It is not built now**, and it cannot serve week buckets, because
weeks do not nest in months — so the day table remains the only source for the week grain, and a
week-grain read over a year is the shape that will need attention first. R-M11's two-month cap on
*day grain* is a legibility rule and does not help here; it only means the five-month wall is met
at week or month grain, never at day.

## Alternatives

**No fact table — every page is a `GROUP BY` over the session and `token_usage` tables, with the
child roll-up as a self-join.** Cheapest to build: no pipeline, no second copy of the data,
nothing to backfill. Rejected on the fan-out. ADR-0008's roll-up would run *per query*, which is
precisely the *"per-query fold somebody eventually forgets"* it refused — and it would run it 10M
rows at a time, joining a table to itself on `parent_session_id` before a single figure could be
summed. It also puts R-M2's hidden strip back into every query.

**Put the ratios in the fact table.** Rejected above: a stored rate cannot be re-divided at a
coarser grain, and it turns R-M18's `null` into a value someone averages.

**One table, with `model` in the key and `cost` on it.** Rejected: it attributes a session's cost
to one of the models it spanned, which R-M7 forbids and which `AggregationInput` is deliberately
shaped to make unrepresentable. Recorded because it is the change someone will propose on the
grounds that two facts are two tables to backfill, and because the fixture would not falsify it —
1.470 models per attempt means most rows would look fine.

**Sum `member` away and key the fact on Team.** Rejected twice over: the permission filter resolves
per Member and runs before aggregation, and Team is *not a partition* (R-V3, `CONTEXT.md`
§ Aggregation Dimensions), so a Team-keyed fact would store an overlapping Member's figure several
times and could never be rolled up to the Organization.

**Materialise Rework as a boolean per Task.** Rejected: the label is range-dependent. The
counter-example is one row — a Task whose only non-accepted root falls outside the selected range
is *not* Rework in that range and *is* Rework overall — and the stored boolean cannot express both.

**Let the store compute the aggregates and hand `src/data/queries/` a finished shape.** The
tempting one, because it makes the p95 budget trivially safe. Rejected because it reverses ADR-0006
by the back door: R-V3's overlap note, R-M14's per-capita denominator, R-V4's cap and R-V1's
`stackable` are domain facts, and a store that computed them would put the product's four most
error-prone rules in SQL where no unit test in this repository reaches them. The line drawn under
§ 3 is what keeps this option shut.

## Consequences

- **R-T36 is superseded at volume and correct below it.** *"No pagination, virtualisation,
  streaming or memoisation"* stays true of the shipped application. What changes is that it is now
  a statement about the fixture rather than about the architecture, and this ADR is the thing that
  says where it stops.
- **`load.ts` becomes a query and `Dataset` becomes its contract.** `sessions` stops being an
  array. Every one of the module's five documented invariants either migrates to the pipeline
  (R-M2, R-M19), survives as a store constraint (unique ids, resolvable `model_id`) or dies with
  the fixture (R-D19).
- **`Dataset.childSessions` cannot survive.** A `ReadonlyMap` of every child in the dataset is 292
  entries today and ~4M at 10M sessions. It becomes a per-root fetch on `/demo/history`, which is
  the only reader it ever had.
- **The `cached ??= readDataset()` singleton becomes a cache with an invalidation problem.** Today
  it is a pure memo over an immutable committed file and needs no policy. Against a live store it
  needs one, and the first thing that policy has to decide is what a partially-ingested day looks
  like — which is the same question R-M13's incomplete-period flag answers for a different reason.
- **The fact table cannot be reconciled to the raw session count**, because hidden rows are gone
  before it is written. That is the property [ADR-0010](0010-byok.md) would need if BYOK is ever
  accepted: its vendor-billed total must be summed *before* a hidden root's tree is discarded, and
  under this decision "before" means in the pipeline, not in `load.ts`. **The two ADRs interact at
  exactly one line**, and it is the same line ADR-0008 and R-M2 already share.
- **The Organization's timezone is now in a primary key.** `CONTEXT.md` says the Organization
  *"declares a timezone, which fixes where every day, week and month boundary falls in its
  analytics"*. Today that is a field on one JSON file. Under this decision, changing it invalidates
  every fact row for that Organization and requires a full rebuild from the session stream — which
  is an argument for keeping the raw sessions, not only the facts.
- **The p95 above is a budget for a read, not for a page.** Nothing here measures or budgets the
  chart render, the client bundle or Recharts. The seam is what makes those separable; it does not
  make them free.
- **The budget no longer closes inside 200 ms on measured constants** (added 2026-09-10, ticket
  66). `spendPage` is 20.2 µs per visible row and the stage it feeds was budgeted at 25 ms off a
  1,034-row measurement; at the ≤5,000 rows the store hands over it is ~100 ms, and the total is
  220 ms. The store term is unchanged and the seam is unaffected — what changed is that the
  cheapest-looking stage in the table is now the second most expensive one.
- **The suite that guards all of this got slower, and one file crossed 2×** (added 2026-09-10,
  ticket 66). `pnpm test` went 11.2 s → 14.1 s (1.26×) and `pnpm e2e` 51.7 s → 90.3 s (1.75×)
  against 10.4× the data — both sublinear, because most of the suite does not read the fixture.
  `fixture-contract.test.ts` is the exception at **2.3×** (0.83 s → 1.93 s): it reads and
  re-validates the whole dataset once per doctored case, so it is the one file whose cost is
  linear in the row count by construction, and `test:mutation` re-runs the suite per mutant on
  top of that. Recorded rather than fixed, per ticket 66's own instruction. The fix, when it is
  wanted, is the same seam this ADR is about — the contract cases need *a* dataset, not *the*
  dataset, and nothing in T-U26 depends on its size.
- **Nothing in the repository changes today.** No fact table, no pipeline, no store, no pagination
  change on `/demo/history`. This is a decision record, and the codebase must not anticipate it.

## Reversibility

**Asymmetric.** The write side is highly reversible — a fact table is derived data and can be
dropped and rebuilt from the session stream, which is exactly why the raw sessions must be retained
after §2 stops reading them. The read side is not: once `load.ts` returns a query result rather
than an array, every caller that assumed a materialised `readonly AgentSession[]` — `taskFacts` and
`childSessions` most of all — has been rewritten against a different shape, and going back means
rewriting them again.

**What is genuinely irreversible is the grain itself.** Choosing
`(day × member × repo × work_type × model)` forecloses any future dimension that is not
functionally determined by it: an aggregation dimension added later — `execution_mode`, say, which
`CONTEXT.md` explicitly calls a property of the session — requires either a wider key and a full
backfill, or a fall back to the session table for the one query that needs it. That is the decision
to argue with, and it should be argued with before the first backfill, not after.

## Evidence

Fixture figures were counted over `src/fixtures/data/` — **re-counted on 2026-09-10 against
ticket 66's dataset**, and originally on 2026-09-09 at commit `916a4e6`: 10,879 rows across 25
`sessions/*.json` files, reduced to the **post-roll-up** population `load.ts` produces — hidden
rows dropped, children folded into their roots, a child's `token_usage` carried at its root's day
and labels — and then counted as distinct tuples at each of the three fact grains. The
day-boundary crossing (113 of 2,960) was counted by comparing each child's `started_at` civil date
with its root's.

Timings were taken in-process under Vitest 4.1.11 on Node 24.x, warm, single-threaded, discarding
warm-up iterations: `readDataset()` over 25 runs (20 in the original) and `spendPage` over 60 (120
in the original), both against the open account and the full committed window; `rollUp` over 15
runs at each of six (Members × rows) points, from which the 76 ns/row asymptote is read. The
`rollUp` figures are synthetic and were not re-taken. The measurement harness was temporary and is
not committed — the numbers above are reproducible from the four call sites named in the tables.

Code claims were checked against `src/data/load.ts`, `src/data/queries/history.ts`,
`src/data/queries/spend.ts`, `src/data/params.ts`, `src/domain/aggregate.ts`,
`src/domain/metrics/efficacy.ts`, `src/domain/ratio.ts` and `src/domain/series.ts`, and against
`technical-spec.md` § 3 and § 10 and `spec.md` R-N9, R-N20, R-M7, R-M11, R-M18 and R-V12.
