Type: implementation
Status: ready-for-agent
Blocked by: 61
Label: ready-for-agent

# Every query reads the data to now: one slice, applied once, for every surface

## Goal

The fixture will extend past today (ticket 66 moves `window_end` to 2026-09-25). From this ticket
on, **the product shows rows up to the current instant and nothing later**, on every page, in every
query, without any per-query filter. The as-of stamp, the period menus, the date bounds and the
projection all read the same clock and the same slice.

Decided by the human, 2026-09-10.

## What exists today

- `src/data/clock.ts` — `requestNow()` clamps the wall clock to midday UTC on `window_end`;
  `observationWindow()` returns the Organization's declared window; `dataAsOf()` reads the latest
  `ended_at` across the whole loaded fixture.
- `src/data/load.ts` strips hidden rows once at load ("a per-query filter is a filter somebody
  eventually forgets", line 14). `loadDataset()` is memoised and takes no clock.
- `src/data/queries/context.ts` — `pageContext` bucket-filters by the selected period; `now`
  arrives on `ControlSet` (P5).
- `src/components/controls/schema.ts` — `periodOptions` lists every month the window touches;
  date inputs carry `window_end` as `max`.
- Tests pin `now` on the params; e2e does not, and relies on the clamp.

## Scope

1. **One slice.** Add `datasetAsOf(now: string): Dataset` in `src/data/` (next to `load.ts`),
   returning the loaded dataset with sessions whose **`ended_at` is after `now` removed** — a
   session is observable at its end (`observation.ts`), so a session still running at `now` is
   not yet a row. Children follow their root (a root cut takes its children; a child that ended
   after `now` under a root that ended before it cannot exist — assert in the fixture contract).
   Memoise per `now` at minute granularity so a page's several queries share one slice.
2. **Apply it in one place.** The façade in `src/data/queries.ts` (or `pageContext`) is the only
   caller; `observationWindow()`, `dataAsOf()`, `controlOptions` and every page query read through
   it. Add a test in the style of T-C19: no module under `src/data/queries/` and no page imports
   `loadDataset` directly — only `datasetAsOf` and `load.ts` itself do.
3. **The clock.** `requestNow()` becomes `min(wall clock, window_end midday UTC)` as now, **plus
   an override**: `AGENT_DASH_NOW` (server-side env, ISO 8601). Set it in `playwright.config.ts`
   (`webServer.env`) to a fixed instant inside the window so e2e figures are stable day to day;
   never set it in Vercel. Document in `.env.example`.
4. **Window end is the earlier of `window_end` and the civil day of `now`** in the Organization's
   timezone, for: `observationWindow()`, `periodOptions` (no month beyond the current one), the
   History date inputs' `max`, and R-D2's partial-period flag (the current month is partial
   because it is in progress).
5. **As-of stamp** reads the sliced rows, so it never names a session that "has not happened".
6. **Projection** already takes `now`; verify that with the slice in place `sessionToDate` equals
   the chart's actual bars (identity test).

## Done when

- Unit: `datasetAsOf` drops a root ending after `now` together with its children; keeps a root
  ending exactly at `now`.
- Unit: with `now` mid-window, `periodOptions` stops at the current month and History `max` is
  the current civil day.
- e2e: with `AGENT_DASH_NOW` pinned, the as-of stamp and the History top row agree (T-E15 still
  holds) and no rendered Started cell is later than the pinned instant, on every route.
- Spec: amend R-D2 wording ("the window the product reads is the declared window cut at now"),
  R-N3.1, R-C4 default period. All six gates green.

## Notes

Runs before the fixture is extended (ticket 66); until then the slice is a no-op in production
and exercised by tests with a pinned `now`. Keep `src/domain/**` clock-free (P5).
