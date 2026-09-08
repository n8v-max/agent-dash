# What is not covered in `src/domain/**`

**T-Q3.** `testing-spec.md` § 8: *"Coverage is a floor, not a target. A ranked list of what is not
covered in `src/domain/**` is more useful than the percentage."* The spec puts that list in a PR
description; this repo has no PR flow, so it lives here, beside the code it is about, and is
regenerated whenever the domain layer moves.

Measured on ticket 38, 2026-09-08, against the committed fixture.

---

## The numbers, for the record

| | statements | branches | functions | lines |
|---|---|---|---|---|
| `src/domain/**` (T-Q2 gate: 95 / 90, **per file**) | 99.51% | 98.80% | 100% | 100% |
| whole repo (T-Q1 gate: 80 / 75 / 80 / 80) | 98.19% | 88.07% | 98.77% | 99.53% |

One file in the domain layer is below 100%: `src/domain/viewmodel.ts`, at 56/58 statements and
38/40 branches. Every other module is fully covered by line and branch.

**Which is exactly why the percentage is not the deliverable.** The list below is ranked by what
the product's claims rest on, not by how many lines are red — and its first two entries are
behaviours that a coverage report calls *covered*.

---

## The ranked list

### 1. The ISO week-year rollover is executed but never asserted

`src/domain/periods.ts` — `isoWeekKey`, via `bucketRows`.

Every week key any test produces is `2026-W15`…`2026-W37`: all mid-year. Nothing exercises a week
whose Thursday falls in a different calendar year — `2026-12-28` → `2026-W53`, `2027-01-01` →
`2026-W53`, `2025-12-29` → `2026-W01`.

**Why it is first.** The module's own header names this as the invariant the design rests on: *the
week a date belongs to is fixed by that week's Thursday, which is what makes the turn of the year
unambiguous*. Week keys are R-T8 stable series identities — React keys, chart column ids, mirror
row headers. The one branch that makes the claim true is the one nothing checks.

*Cheap to close:* yes. `planPeriods` + `bucketRows` over `2026-12-21..2027-01-10` at week grain,
asserting the key sequence contains `2026-W52, 2026-W53, 2027-W01`.

### 2. A withheld cell is only ever compared from one side

`src/domain/viewmodel.ts` — `compareCells`, the two uncovered branches.

`compareCells` has three `null` arms. A test does sort a column with one `null`
(`viewmodel.test.ts`), and it reaches exactly one of them: V8's insertion sort for three elements
always passes the later element first, and the `null` row is last in input order, so `null` is only
ever the **left** operand. The value-vs-`null`-on-the-right arm and the both-`null` arm have no
input anywhere in the suite.

**Why it matters.** The rule is R-A6's: *a withheld figure sorts last whichever way the column is
sorted; `null` is not a small number, and letting it flip with the direction would let the absence
of a grant decide who is at the top of the table.* Two withheld rows adjacent to each other is the
**ordinary** case under the Restricted preset, and it is the case with zero coverage. The existing
assertion passes on a comparator that is half-executed and dependent on input order.

*Cheap to close:* yes. Reorder the existing rows so the `null` row is first, and add a second one.

### 3. `TableColumn.sortable` is declared in the domain and enforced only in the component

`src/domain/viewmodel.ts` — `tableViewModel`.

`sortable` is documented as R-N15's per-column fact, and it is read only by `data-table.tsx`, to
decide whether to render a heading link. `tableViewModel` will sort by any column whose `key`
matches, sortable or not — and `people-viewmodels.fixture.ts` ships three real columns with
`sortable: false` (`member`, `team`, `kind`). Neither the permitting nor the refusing is asserted.

**Why it matters.** A hand-typed `?sort=member` produces a domain-blessed sort on a column the
product says it does not offer. R-T26 makes coercion the URL layer's job, and nothing in
`src/app/[org]/people/page.tsx` clamps it. This is a **question, not just a gap**: the intended
behaviour has never been written down.

*Cheap to close:* yes, once someone decides which behaviour is intended.

### 4. A well-formed but reversed range never reaches `planPeriods`

`src/domain/periods.ts` — `boundsOf`, the `lastDay < firstDay` clause.

Every `invalid-range` test uses a non-date (`"x".."y"`) or an impossible calendar date
(`2026-02-31`). A range whose `end` precedes its `start` is never handed to `planPeriods` or
`availableGrains`. `projection.test.ts` *does* cover the reversed case for `projectPeriodSpend`;
the sibling path here has no equivalent.

**Why it matters.** This is the gate the whole of R-M11 hangs off — `bucketRows` is total only
because, in the module's own words, *every way of being wrong was spent here*.

*Cheap to close:* yes. One rejection assertion plus `availableGrains` → `[]`.

### 5. `tokenModelMixLevels.partitions` cannot be observed `false`

`src/domain/metrics/adoption.ts`.

The field is documented as *derived from the results rather than declared beside them, which is
what makes it an assertion about this distribution rather than a restatement of the type*. But
slices are keyed off the roster labels and every counted entry has one, so the sum identity holds
structurally for every input the public API accepts. The test asserts `partitions === true`, which
is indistinguishable from asserting a hard-coded `true`.

**Why it matters.** R-M7's *exact → family → tier is a true partition, and the contrast case to
Team* is the claim the whole Model-mix surface rests on, and the field advertised as proving it
proves nothing.

*Cheap to close:* **no.** It cannot be made `false` from outside. Closing it honestly means either
widening the seam to admit a hand-built `Distribution` as a negative control, or softening the
doc comment to say what the field actually is.

### 6. The `incomplete` flag is unchecked on the `no-prior-period` arm

`src/domain/change.ts`.

`incompleteIn` is computed and returned on both suppressed arms. The
`prior-period-holds-nothing` arm asserts it; the `no-prior-period` arm does not.

**Why it matters.** R-M13 — *incompleteness is flagged, not withheld*. April in the fixture window
is simultaneously the first bucket (no prior) **and** clipped (partial), so this combination is
what the first tile of every range renders.

*Cheap to close:* yes, one line.

### 7. A column holding both a string and a number silently sorts lexicographically

`src/domain/viewmodel.ts` — `compareValues`.

`TableCell` is `string | number | null`, so one column may hold both. Mixed cells fall through to
`localeCompare`, which orders `10` before `9`. No test puts both types in one column.

**Why it matters.** R-T6 — *a sort it renders is a sort the domain layer decided.* A numeric column
carrying a formatted or placeholder string for one row becomes lexicographic for the whole column,
with no error and no note.

*Cheap to close:* yes.

### 8. `now` preceding the whole range makes every bucket partial, unasserted

`src/domain/periods.ts` — `isPartial`.

Covered for `now` inside the range. A `now` earlier than `range.start` flags **every** bucket.

**Why it matters.** R-E2 is one flag with three causes; a future-dated range renders every column
flagged, which is plausible on any date-range control, and no test says whether that is intended.

*Cheap to close:* yes.

### 9. The one instant-parsing site in `src/domain` with neither a guard nor a test

`src/domain/metrics/duration.ts` — `sessionDurationSeconds`.

`Date.parse` on a non-instant yields `NaN`, which propagates through the sort in
`sessionDurationSummary` and out as a `NaN` median; an `ended_at` before `started_at` yields a
negative duration. Only well-formed instants are exercised.

**Why it matters.** Every sibling has an explicit "not an instant" path *with* a test
(`periods.ts`, `efficacy.ts`). This one feeds R-M1's headline median and p95. It is guarded
upstream by T-F2's span-sum invariant over the committed fixture — but that is a fixture fact, not
a function contract, and nothing records the choice.

*Cheap to close:* yes — a test that pins the intended behaviour, or a note recording that the
fixture invariant is the guard.

### 10. `spanKey`'s sort is executed but its effect is never observed

`src/domain/metrics/spend.ts`.

`spanKey` sorts and de-dupes before keying; every test hands it buckets already in order.

**Why it matters.** The seat-bearing period's key is its R-T8 stable identity on the Total-spend
surface (`2026-04..2026-09`). A caller passing buckets in reverse would otherwise key it backwards.

*Cheap to close:* yes — reverse the array in the existing test and keep the expectation.

### 11. A rejection's `available` list is unchecked on two of three reasons

`src/domain/periods.ts` — `reject`.

Only the `day-grain-needs-a-shorter-range` rejection has its `available` asserted. For
`unknown-timezone` and `invalid-now`, `reason` is asserted and `available` is not — yet it is
computed from the range and is non-empty.

**Why it matters.** `available` is documented as *what the control offers instead*. A control
reading it off an `unknown-timezone` rejection would offer grains for a plan that failed for an
unrelated reason.

*Cheap to close:* yes — extend the existing rejection test.

---

## Not on this list, on purpose

Four `testing-spec.md` § 7 decisions live inside `src/domain/**`. Each is a decision, not a gap,
and closing any of them would be re-deciding a settled question:

| § 7 decision | Where it surfaces in `src/domain` |
|---|---|
| **DST transitions** | `periods.ts` states the ambiguous- and missing-hour cases are out of scope because no transition falls in the fixture window (R-D5). `periods.test.ts` records it in the suite, exactly as § 7 requires |
| **Quarter buckets** | `PERIOD_GRAINS` has three members; `parseGrain("quarter") === undefined` is asserted. Nothing implements a quarter (`spec.md` § 11 C7) |
| **Session pricing** | `metrics/spend.ts` reads `cost` off the row and never derives it (ADR-0005, R-M4); `adoption.test.ts` asserts the absence of anything that prices |
| **Vendor-shaped token normalisation** | `metrics/adoption.ts` *reports* the superset-shaped reading and deliberately does not normalise it (ticket 13 `wontfix`). The reporting is fully tested, empty and negative cases included |

One near-miss, recorded so it is not mistaken for a gap on a later pass: `series.ts` documents that
a dimension value literally keyed `"other"` would collide with the reserved `OTHER_SERIES_KEY` and
be marked `inert`. `series.test.ts` does not cover it — but `src/data/series.fixture.test.ts`
asserts the guard over the committed roster. It is covered elsewhere, not undecided.

---

## Scope note

Ticket 38 produced this list; it did not close any of it. Its Done-when is that every criterion in
`spec.md` § 10 has a passing owning test, and none of the eleven items above is an acceptance
criterion — they are domain behaviours below the criteria. **Item 2 is the one to do next**: it is
the only entry where the product's *access* model is the thing left unasserted, and it is a
five-line change to an existing test file.
