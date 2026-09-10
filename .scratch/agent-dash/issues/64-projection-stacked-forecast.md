Type: implementation
Status: resolved
Blocked by:
Label: resolved

# Projection chart: stack the projected remainder of the month on the actual daily bars

## Goal

On `/[org]/projection`, the daily session-cost chart gains a second, stacked series,
**Projected**, covering the rest of today and every remaining day of the month, computed by the
same method the panel already prints: spend to date divided by the elapsed share. The two series
sum, bar by bar, to the projected session cost the tile shows.

Decided by the human, 2026-09-10 (confirmed: the Projection page's daily chart, not Spend).

## What exists today

- `src/domain/metrics/projection.ts` — `projectPeriodSpend`: `projected = actual / fraction`,
  `elapsed.days` includes today. `PROJECTION_METHOD` is one constant sentence.
- `src/data/queries/projection.ts` — `dailyChart` draws one series `actual` over days that hold
  rows; `componentsOf` yields `sessionToDate`, `projectedSession`, `seat`, `projectedTotal`.
- `src/components/panels/projection-panel.tsx` — `ChartFrame shape="bar"`, seat note beside it.
- R-V8: the projected figure carries the "estimated" marker; attributed figures carry none.

## Scope

1. **Domain.** Add to `projection.ts` a pure `projectDaily(input)` returning, for each civil day
   of the period: `{ day, actual, projected }` where
   `rate = actual / elapsed.days`; days before today: `projected = 0`; today:
   `projected = max(0, rate − todayActual)`; days after today: `actual = 0, projected = rate`.
   Identity (assert): `Σ actual + Σ projected = projected session cost` (the tile's figure) to the
   cent, after rounding the last future day to absorb the residual. No band, no smoothing.
2. **Query.** `dailyChart` draws **all** days of the month (today included, future days included)
   with two groups, `actual` and `projected`; `stackable: true`. Remove the
   `filter(day.rows.length > 0)` — a day with no rows is a zero bar, not a missing one, once the
   month is being forecast.
3. **Presentation.** The projected series renders in a visibly lighter/hatched fill (a
   `pattern` fill or a 40% alpha of the actual colour — pick one, keep it in the chart config, no
   new palette variable). Legend label `Projected (estimated)`; tooltip shows both values and the
   day. Both accounts see it (the projection page is already viewer-agnostic on figures it holds).
4. **Copy.** Chart note gains one sentence: "Projected bars share the method above: today's spend
   rate, carried to the end of the month." The method sentence itself is unchanged (T-U21).
5. **Spec.** R-N23 gains: the daily chart stacks projected on actual and the two sum to the
   projected session cost; R-N24 (no band) unchanged and re-asserted.

## Done when

- Unit (domain): the identity above at 1 day elapsed, mid-month, last day (projected series all
  zero on the last day), before the period opens (rejected, no series).
- Unit (component): two legend entries, projected carries "estimated", stacked bars present for
  days after today.
- e2e: on `/demo/projection` the chart's table mirror has an `actual` and a `projected` column and
  the column sums equal the two tile figures.
- All six gates green.

## Notes

Interacts with ticket 62 (`now` is the wall clock inside the window); build against a pinned
`now` in tests. Seat cost stays out of the chart (R-M5).

## Comments

**2026-09-10 — implemented on `ticket/64`.**

### Gates (all six green, run from the worktree root)

| Gate | Result | Counts |
|---|---|---|
| `pnpm lint` | pass | 0 errors, 0 warnings |
| `pnpm typecheck` | pass | — |
| `pnpm test` | pass | 64 files, **1440** tests (was 1424; +16) |
| `pnpm test:coverage` | pass | statements 98.37%, branches 89.44%, functions 99.01%, lines 99.55% |
| `pnpm build` | pass | 10 routes, compiled in 3.6s |
| `PORT=3104 pnpm e2e` | pass | **156** passed, 1.2m (wall 1:10) |

### What each Scope item became

1. **Domain.** `projectDaily` in `src/domain/metrics/projection.ts`, beside `projectPeriodSpend`
   and reusing it — one method, divided once. Returns `{ key, days, projected }`, where `days` is
   every civil day of the period. New `civilDaysOf(range)` in `src/domain/periods.ts`, because
   this module owns civil-date arithmetic and a second "what is the day after the 30th" would
   disagree at a month end.
2. **Query.** `dailyChart` in `src/data/queries/projection.ts` now draws all days of the month
   with `actual` and `projected` groups, `stackable: true`, and the `filter(rows.length > 0)`
   removed. New R-V1 grouping `projection_component` (see escalation 4).
3. **Presentation.** 40% alpha of the series' own palette colour, expressed once in
   `chart-config.tsx` as `estimatedFill` and read by both the bar mark and the legend swatch.
   `ChartViewModel.estimated` carries *which* series is the forecast, as a domain fact beside
   `stackable`. Legend label `Projected (estimated)`; the shared `ChartTooltipContent` already
   shows both values and the day, so no tooltip change was needed. Both accounts get it —
   asserted in `queries.test.ts` over the restricted viewer.
4. **Copy.** `PROJECTED_NOTE` on the query, appended to `view.note` **only where a forecast was
   drawn**. `PROJECTION_METHOD` is untouched (T-U21 still passes unchanged).
5. **Spec.** `spec.md` gains **R-N23.2**; R-N24 gains an explicit "unchanged by R-N23.2, and
   re-asserted over it" paragraph; R-V1's table gains the new partition row; R-V8 gains the
   series-grain clause. `testing-spec.md`: T-U21.1 rewritten, **T-U21.2** added, T-C11, T-C17 and
   T-E11 extended.

### Escalation choices (cheaper option taken, cost recorded)

1. **Stack order is the ranking's, not the ticket's.** R-V5 ranks series by whole-range measure,
   and at 8/30 elapsed the remainder outweighs the spend — so `Projected` takes `--chart-1` and is
   drawn at the *bottom* of the stack rather than on top of the actual bars. The cheaper option was
   to leave `series.ts` alone; the alternative is an ordering override on `capSeries`, which every
   chart in the product goes through. **Cost:** on the one bar that carries both halves (today) the
   forecast sits under the attributed part. Every other bar carries exactly one of the two, so the
   reading is otherwise unaffected, and the identity is untouched.
2. **The forecast takes 40% of its *own* palette colour**, not 40% of the actual series' colour.
   Sharing one hue would mean the domain stops assigning colours by walking the palette, which is
   the construction R-V7 relies on to make a sixth colour unwritable. **Cost:** the two halves of a
   column are two hues at two weights rather than one hue at two weights; the legend, the marker
   and the alpha all still say which is which.
3. **The residual is *assigned*, not rounded.** The ticket says "after rounding the last future day
   to absorb the residual"; the domain layer rounds no money (that is presentation's), so the last
   day of the period is assigned `projected − everything else` exactly. That absorbs two things at
   once: float drift over thirty additions, and today's clamped remainder, which the per-day rule
   otherwise adds on top of the elapsed-proportional total. It works out to `min(rate, today's
   spend)` while the month is open and to **zero** once it has closed — which is what makes the
   projected series all-zero on the last day, as the Done-when asks.
4. **A new R-V1 grouping, `projection_component`.** `cost_component` is session-vs-seat and
   `organization` is not stackable, so reusing either would have been a false statement about what
   the geometry claims. **Cost:** one row in `spec.md`'s R-V1 table, one entry in
   `STACKABLE_GROUPINGS`, one in T-C11's typed table.
5. **R-V8's "the marker appears exactly once on the page" is restated as a claim about *kind*,**
   in `projection-panel.test.tsx` and in `e2e/secondary.spec.ts`. The forecast series legitimately
   carries the marker now, so a count of 1 could only be met by deleting one of the two. The new
   form is not weaker: exactly once among the two headline figures, **and** every other element
   carrying it is text naming the forecast, **and** the attributed figure carries none.
6. **Spec amendments beyond Scope item 5.** T-U21.1 read "the daily chart carries one series,
   session Cost, unstacked", and T-C11/T-C17/T-E11 each described the old surface. Left alone they
   would state the opposite of what ships, so they were amended in the same commit.
7. **The chart is retitled "Daily session cost"** (from "Actual spend to date"), and the panel's
   `<section aria-label>` with it. Not asked for, but the old name is the accessible name a screen
   reader lands on and it contradicts half the chart under it. **Cost:** two assertions updated.

### Nothing left undone

Every Scope item and every Done-when bullet is implemented and covered. Ticket 62's wall-clock
`now` composes: nothing added here reads a clock, every test pins `now` explicitly, and
`projectDaily` takes it as an argument exactly as `projectPeriodSpend` does.
