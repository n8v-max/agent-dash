Type: implementation
Status: resolved
Blocked by: 61
Label: resolved

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


## Comments

### Resolution — 2026-09-10

Implemented in `src/data/as-of.ts` (`datasetAsOf(now)`), applied in `queries/context.ts`
(`pageContext`) and `queries/controls.ts` (`controlOptions`), with `clock.ts` reading the same
slice for the as-of stamp and cutting the window at `now`'s civil day.

Scope, item by item:

1. **One slice.** `src/data/as-of.ts` — the fixture with every root whose `ended_at` is after
   `now` removed, its children going with it. A root ending exactly at `now` stays. Where the cut
   removes nothing the loaded `Dataset` is returned **by identity**, so today's production read is
   free and the "no-op until ticket 66" claim is a test rather than a comment. Memoised per `now`,
   bounded at four entries.
2. **Applied once.** `pageContext` and `controlOptions` are the only callers under `queries/`;
   `T-U35` in `src/data/as-of.test.ts` asserts the absences in the shape T-C19 uses — nothing
   under `src/data/queries/`, `src/app/` or `src/components/` names `loadDataset`, the five
   modules that do are an allow-list, `datasetAsOf` is named in exactly two places, and no module
   outside `as-of.ts` compares `ended_at` against anything. `T-U27`'s "one producer of a
   `Dataset`" claim was amended in the same commit: `as-of.ts` returns one too, and the two
   properties that make that safe (it opens no file, it derives from `loadDataset`) are asserted
   directly.
3. **The clock.** `requestNow()` is unchanged except for `AGENT_DASH_NOW`, which substitutes for
   the wall clock and is clamped by the same midday-UTC ceiling. An unparseable value is ignored.
   `playwright.config.ts` pins it on the spawned `webServer` (`e2e/support/now.ts`); documented,
   commented-out, in `.env.example`. Set nowhere else, and absent on Vercel.
4. **Window end.** `observationWindow(now)` returns `min(window_end, civil day of now in the
   Organization's timezone)`, never inverting. `periodOptions`, `defaultPeriodRange`, the
   `?from=`/`?to=` clip and the History date inputs' `max` all already read that window, so the
   single change reaches all four with no new call sites. R-D2's partial flag needed no change:
   `periods.ts`'s `isPartial` already flags a bucket `nowDay < endExclusive`.
5. **As-of stamp.** `dataAsOf(now)` reads `datasetAsOf(now).sessions`.
6. **Projection identity.** Added to `queries.test.ts`: the actual series' bars sum to
   `components.sessionToDate`, actual + forecast sums to `projectedSession`, and no bar carrying
   a figure in the measured series falls after `now`'s civil day.

Spec amended in this commit: **R-D2** (the window the product reads is the declared window cut at
`now`, and the rows are cut with it), **R-C4** (the default period is that cut window), **R-N3.1**
(the stamp is read off the slice), and a new **A42**. `testing-spec.md` gained § 3.6 (**T-U35**),
**T-E19**, and the A42 row.

### Escalations

- **Memoisation is keyed on the exact `now`, not on the floored minute.** The ticket asked for
  minute granularity; flooring the *cut* would silently discard up to 59 seconds of rows and would
  break "keeps a root ending exactly at `now`", and flooring only the *key* would make the slice
  depend on which caller warmed the cache within that minute. A page's queries all share one `now`
  string (one `requestNow()` per request, carried on `ControlSet`), so the sharing the ticket asks
  for is delivered either way. Cost: two requests one second apart each build a slice — one filter
  over 742 rows. The cache is bounded at four entries so a long-lived dev server cannot grow.
- **The slice is not quite a no-op in production today, and that is the point.** With the clamp at
  midday UTC on 2026-09-08, seven of 742 roots end after `now` — including `ses_0757`, which ran
  until 01:15 the next morning and was the session the as-of stamp named. Cutting them is exactly
  scope item 5's defect being fixed, so the Notes' "no-op" is approximately rather than exactly
  true, and no requirement was relaxed to make it so.
- **`e2e/support/fixture.ts` restates the cut.** T-E4 builds its cost search set off the fixture
  JSON deliberately, so with the page reading fewer rows a *legitimate* own figure fell outside
  the allow-list and `/demo/projection` reported a false leak (`13.04`). The cut is restated
  there beside R-M2 and R-M19, for the reason that file's header already gives: what a test
  allows must describe the population the page renders. The claim is unchanged.
- **The pinned e2e instant is `2026-09-08T12:00:00Z`** — exactly where `clock.ts`'s clamp already
  lands the wall clock today, so pinning changed nothing the suite reads. A pleasanter mid-window
  instant would have rewritten every period default, month list and count in the suite for no
  gain; after ticket 66 this pin is what keeps them stable while the fixture runs past today.

### Gates — 2026-09-10, all six green

| Gate | Result | Detail |
|---|---|---|
| `pnpm lint` | pass | no errors, no warnings |
| `pnpm typecheck` | pass | `next typegen && tsc --noEmit` clean |
| `pnpm test` | pass | 1508 tests, 65 files (was 1504 / 64) |
| `pnpm test:coverage` | pass | statements 98.29% · branches 89.40% · functions 99.02% · lines 99.47% |
| `pnpm build` | pass | Turbopack, 10 routes, compiled in ~2.7s |
| `PORT=3102 pnpm e2e` | pass | 179 passed (was 171), **48.0s** wall |
