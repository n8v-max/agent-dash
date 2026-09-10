Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

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
