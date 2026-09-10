Type: implementation
Status: resolved
Blocked by:
Label: resolved

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

## Comments

### 2026-09-10 — built (branch `ticket/69`)

**What each scope item became.**

1. `src/components/panels/figures.ts` — `FORMATTERS.tokens` is now `inTokenUnits`: under 1,000 a
   whole grouped integer, then `K`, `M`, `B`; one decimal while the mantissa is below ten and none
   at or above it; no space, uppercase unit, `en-GB` mantissa. `tokensTick` is the axis spelling,
   with no decimal at all. The dead `whole` binding went with the change, and the module header's
   "no compact notation, because `1.2M` contributes `1.2`" paragraph is replaced by what is true
   now: the exclusion lives in the scanner, and tokens are the one unit that takes units.
2. Applied everywhere a `unit: "tokens"` already reaches `formatFigure` — People's Tokens column,
   `/demo/history`'s Tokens column and the session table, the member profile's tile and its
   comparator bar — none of which needed a code change, which is the point of the unit being a
   domain fact on the column. The two Adoption axes needed a new client wrapper,
   `src/components/panels/token-chart.tsx`: `tickFormat` is a function and `adoption-section.tsx`
   is a Server Component, so this is `money-chart.tsx`'s problem again and has `money-chart.tsx`'s
   solution. The session detail's four-class table and its total are untouched, and there is now a
   test that pins them as grouped integers rather than leaving it to the sum check.
3. **T-E4.** `e2e/support/costs.ts`'s literal matcher is rebuilt from two named edge classes —
   `IDENTIFIER_EDGE` and `TOKEN_UNIT_EDGE` — so "a decimal a `K`, `M` or `B` sits on is not a
   candidate cost literal" is a rule spelled in the code rather than an accident of the older
   letter lookahead (it was already implied by it; it is now stated, and tested, so a future
   narrowing of the identifier rule cannot silently re-admit token figures). Four scanner unit
   tests in `e2e/payload.spec.ts`: the cost literal found against each of `,24.39]`, `"24.39"`,
   `>24.39<`, `$24.39`; `1.3M` / `9.8K` / `2.1B` yielding the empty set; `1.3M` beside `1.30`
   yielding only `1.30`; and a bare `1.3` still found, so the exclusion is about the unit and not
   about the value. A fifth test is a **positive control on the wire**: the restricted account's
   `/people` payload does carry a compact token cell, so the exclusion is applied to a real figure
   on a real route rather than kept as a regex with nothing to match. The search set is otherwise
   untouched — the floor is still 300, the named guards still `24.39` / `7.31` / `0.7`, and no
   assertion became a DOM query.
4. Spec: R-N15 gains the token notation, the axis rule and the `/demo/history` exemption;
   `testing-spec.md` T-E4 gains the exclusion, why it is not a weakening, and the scanner's own
   tests; T-C9.2 gains the token half of "a column reads in its own unit".

**Choices made without asking, and what each cost.**

- **`999,999` reads `1M`, not `1,000K`.** The rule in § Scope puts it in the `K` band, and taken
  literally its mantissa (999.999, so no decimal) renders `1,000K` — a figure nobody writes. A
  mantissa that rounds to a full thousand now promotes to the band above. Cost: the two sides of
  the million boundary read identically, and the literal "< 1M → K" reading is broken across the
  top 0.05% of the `K` band. Both are cheaper than shipping `1,000K` in a column.
- **Hand-rolled bands, not `Intl`'s `notation: "compact"`.** The obvious spelling is wrong at this
  locale: `en-GB` compacts to `75k`, `1.2m` and `1bn`, and `1bn` beside `1.2m` in one column is
  two kinds of figure. The locale pinning is load-bearing (T-E4's set is built against it), so the
  suffix is the product's and only the mantissa is the locale's. Cost: ~15 lines of arithmetic
  where a formatter option would have done, and a `B` band that reads `1,000B` above a trillion
  rather than switching to `T` — deliberate, and unreachable at this product's scale.
- **`tokensTick` carries no decimal, as § Scope says**, and that is the one thing here with a
  latent cost: it is exactly what `MONEY_TICK`'s comment argues against, because an axis whose
  range sits inside one band can render two ticks reading alike. Measured on the committed
  fixture's Adoption charts, the ticks are `0 / 1M / 2M / 3M / 4M` — distinct — so the risk is
  real and not currently live. If a token axis ever collapses two ticks, the fix is one decimal
  in `tokensTick` and nothing else.
- **Out of scope and deliberately unchanged**, both visible next to something that did change:
  the Adoption panel's "Tokens processed" / "Readings" figures and the Model mix list render
  through `count()` (a count unit, shared with Sessions and Readings), and the R-X1 chart mirrors
  keep exact grouped figures for every unit, money included. Neither is a table column or a chart
  axis of unit `tokens`, and the mirror is the surface a screen reader reads the chart *off* — a
  rounded number there would be a different chart. § Scope named neither.
- **The Adoption axis test reaches Recharts' rendered ticks by text** (`getAllByText("4M")`),
  not by SVG traversal — `testing-library/no-node-access` forbids the latter and the repo forbids
  buying green with a disable. It discriminates: on `ChartFrame`'s default the same ticks read
  `4m`, which the test asserts is absent.

**Gates** (worktree root, `PORT=3109` for e2e): `lint` ✅ · `typecheck` ✅ · `test` ✅ (1,435, was
1,412) · `test:coverage` ✅ (98.41 / 89.28 / 99.00 / 99.54) · `build` ✅ · `e2e` ✅ (160, was
155 — the four scanner tests and the compact-token positive control; 1.1m wall, `PORT=3109`).
All six green.
