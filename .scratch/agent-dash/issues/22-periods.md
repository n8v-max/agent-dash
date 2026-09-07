Type: implementation
Status: resolved
Blocked by: 20
Label: resolved

# Period bucketing in the Organization's declared timezone

## Goal

`src/domain/periods.ts` — a pure `(rows, timezone, grain) → buckets` function. The one place an
off-by-one is both easy to write and invisible in a chart.

## Scope

- Day, week and month boundaries fall in the **Organization's declared timezone** (`Europe/Madrid`),
  never UTC (R-M10). An Organization's "last month" is the month its people worked.
- **Day grain is available only over ranges of two months or less** (R-M11). Reject or coerce at
  URL-parse time so an invalid state is unrepresentable — do not render it and warn.
- Buckets partition the range with no gaps and no double-counting.
- A period that has not finished carries `partial: true` (R-E2). One mechanism, used at both ends
  of the window and for the current month on `/demo/projection`.
- **No `Date.now()`** (P5). "Now" is an argument. The fixture window ends 2026-09-08; a function
  reading the wall clock passes today and fails tomorrow.

## Done when

**T-U1** and **T-U8** pass — including the 23:30 Europe/Madrid case, which buckets to that local
day and not the previous UTC day (A7).

## Notes

R-D5 seeds 22:00–24:00 local sessions **on purpose**: without them the declared-timezone decision
is never exercised. T-F6 asserts they exist, so this test cannot go vacuous.

**No DST transition falls inside the window**, so that case is explicitly not covered. Record it in
the test file so a future reader does not mistake the gap for an oversight.

## Comments

### 2026-09-07 — inherited from ticket 19 (AFK build, wave 1)

**A7 and T-U1's sharpest case cannot currently fail. Read this before writing `periods.ts`.**

R-D5 says sessions "between 22:00 and 24:00 Europe/Madrid … land on the previous UTC day", and A7
and T-U1 both test that a 23:30 Madrid session "buckets to that local day, not the previous UTC
day". **The premise is wrong.** The fixture window is entirely CEST (UTC+2), so 23:30 Madrid is
21:30 UTC *on the same date*. Local runs ahead of UTC, not behind it. A naive UTC implementation
buckets that row to the same day the correct implementation does, and passes.

The rows where UTC and Madrid dates genuinely differ are just after **local midnight**: 00:30
Madrid is 22:30 UTC on the previous day.

Ticket 19 seeded both populations rather than choosing between them, so you have data for each:

- **55 rows in the literal 22:00–24:00 Madrid window** — what R-D5 and T-F6 name.
- **29 rows whose UTC date genuinely differs from their Madrid date**, all 00:00–02:00 local — the
  discriminating case.

**Write T-U1 to cover both.** Keep the 23:30 case, because A7 names it and it must stay satisfied;
add the post-midnight case, because it is the one that actually falls over against a UTC
implementation. A test that only covers the 23:30 row is a test that passes against the bug it
exists to catch.

No spec was edited and no requirement was re-decided — recorded here so the implementer of R-M10
knows which case carries the weight. `no DST transition falls in the window` is verified, not
assumed: the generator checks Madrid's offset is +02:00 on every row it writes.

## Comments

### 2026-09-07 — implemented (AFK build, wave 3)

Gates green: `lint` · `typecheck` · `test` (231 tests, 45 new) · `test:coverage`
(100% statements / 100% branches; `periods.ts` clears its own per-file 95/90 group) · `build`.

Three files: `src/domain/periods.ts` (pure — `planPeriods`, `bucketRows`, plus `availableGrains`
and `parseGrain` for ticket 30), `src/domain/periods.test.ts` (pure, every row inline), and
`src/data/periods.fixture.test.ts` — the same claims against the **committed** rows, sited outside
`src/domain` so it may import `load.ts`. The split is P6: the pure test alone would pass against an
empty fixture.

**The tests were mutation-checked, which is the part that matters here.** Replacing the module's
`timeZone` with `"UTC"` fails **14 tests**, three of them fixture-backed. And the test named
`buckets a 23:30 Europe/Madrid session to that local day (A7)` **passed against that bug** — which
is ticket 19's finding reproduced as an experiment rather than an argument. Both cases are
therefore carried:

- **23:30 Madrid** (`2026-07-31T23:30+02:00` → `2026-07-31`) proves A7 stays satisfied. A sibling
  test asserts its UTC date is *also* `2026-07-31` and that a UTC plan buckets it identically, so
  the non-discrimination is pinned as a fact — if the window ever gains a winter month, that test
  fails and explains why.
- **Post-midnight** (`2026-08-01T00:58:51+02:00`, the shape of committed `ses_0443`) → Madrid
  `2026-08-01`, UTC `2026-07-31`. **This is the one that fails against a UTC implementation**, and
  it is asserted at all three grains: day, week (`2026-W32` vs `2026-W31`) and month.

**T-U8** is the aggregation-side counterpart: three rows around the Jul/Aug boundary costing
100 / 10 / 1000. Madrid totals `{07: 100, 08: 1010}`; UTC totals `{07: 110, 08: 1000}` — the 10 is
exactly what the declared timezone is worth, and the 100 is the case that cannot fail.
`Pacific/Auckland` gives `{07: 0, 08: 1110}`, proving boundaries move with the *declared* zone
rather than the server's, while the grand total stays 1110 in every zone — rows move, the sum does
not. The fixture test repeats it on real data: the one committed month-boundary crosser is billed
to August while its UTC date is July.

**Day grain over a long range is unrepresentable, not merely rejected.** `bucketRows` accepts only
a `PeriodPlan`, whose brand key is a module-private `unique symbol` that is never exported; the
only expression in the program that produces one is `planPeriods` returning `ok`. A rejected
request carries no `plan` property at all, so there is no value to render and no "render it anyway"
path to guard. The brand also carries the parsed bounds, the validated `now` and the timezone
converter, so `bucketRows` re-checks nothing and cannot itself reject. `availableGrains` exposes
the same predicate for ticket 30, so the control layer offers a grain or doesn't rather than
validating a second time.

Partition is asserted directly and non-trivially: 91 rows, one per day, **all at 00:30 local** so
every one sits on a different UTC date, over a 61-day range, `it.each` across all three grains —
buckets cover both ends, each starts the day after the previous ends, keys are unique, and the
flattened row ids equal the in-range set exactly.

**No DST transition falls in the window, and that is verified rather than assumed**: a test asserts
Madrid's offset is `GMT+02:00` at both window ends, and a header section records the gap so a
future reader does not read it as an oversight.

**Week convention: ISO-8601, weeks start Monday, keys like `2026-W15`.** Spain is an ISO-week
country and a Sunday start would split the working week across two buckets on every chart. The
week's Thursday fixes the week-numbering year, so the turn of the year is unambiguous.

### Two spec gaps recorded, neither re-decided

1. **R-M11's "two months or less" has no operational definition.** Read here as a calendar fact —
   the range must end before the same day-of-month two months on, so 1 Apr–31 May fits and
   1 Apr–1 Jun does not — with `addMonths` clamped to the target month's last day so a range
   starting on the 31st cannot stretch the limit. A day count would have to choose between 59 and
   62 and be wrong in some month. Documented in the module, pinned by tests, and a one-line change
   in `dayGrainFits` if a different reading is wanted.
2. **`partial` has three causes and deliberately one flag**, which is what R-E2's "one mechanism"
   asks for: clipped at the range start (April), clipped at the range end, or unfinished as of
   `now` (the `/demo/projection` case, tested either side of month end to prove `now` is genuinely
   an argument).
