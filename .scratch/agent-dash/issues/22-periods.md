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
