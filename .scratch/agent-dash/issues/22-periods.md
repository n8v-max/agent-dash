Type: implementation
Status: ready-for-agent
Blocked by: 20
Label: ready-for-agent

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
