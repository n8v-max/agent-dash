Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

# Tokens read in K / M / B everywhere a token figure is a column or an axis

## Goal

A token figure reads as `75K`, `1.3M`, `2.1B` — units, not eight-digit integers — in every table
column and chart axis of unit `tokens`. The session detail's four-class table keeps full grouped
integers because it exists to show the four classes adding up.

Decided by the human, 2026-09-10.

## What exists today

- `src/components/panels/figures.ts` — `FORMATTERS.tokens = whole` (grouped integer). The header
  comment explains compact notation was avoided because T-E4's payload scan looks for bare decimal
  literals and `1.2M` contributes `1.2`.
- `data-table.tsx` formats a cell through `formatFigure(cell, unit)`; `chart-shapes.tsx` ticks
  through `tickFormat`; People, History and the session table carry `unit: "tokens"`.
- `e2e/payload.spec.ts` (T-E4) and `e2e/support/costs.ts` define the search set.

## Scope

1. `tokens` formatter: `< 1,000` → integer; `< 1M` → `K`; `< 1B` → `M`; else `B`. One decimal
   when the mantissa is below 10 (`1.3M`, `9.8K`), none otherwise (`75K`, `100M`). Locale-pinned
   `en-GB`, no space before the unit. A dedicated `tokensTick` for axes (no decimals at all).
2. Apply on: People Tokens column, History Tokens column, session table, the Adoption "tokens over
   time" axis and the Model mix axis, summary tile if it carries tokens. Session detail's class
   table and total: **unchanged** (T-C9.1 adds them).
3. **T-E4.** Amend the scan so a decimal immediately followed by `K`, `M` or `B` is not a
   candidate cost literal; add a unit test for the scanner with `1.3M` present and `1.30` absent.
   Keep the rest of the search set as it is.
4. Spec: R-N15 "each column reads in its own unit" gains the token notation; testing-spec T-E4
   notes the exclusion.

## Done when

- Unit: formatter table above, including boundaries 999 / 1,000 / 999,999 / 1,000,000 / 1e9.
- Unit: People table renders `M`/`B` strings for the fixture's rows; session detail still renders
  grouped integers.
- e2e: T-E4 passes for the restricted token (ticket 61's direct mint) with compact tokens on the
  page.
- All six gates green.
