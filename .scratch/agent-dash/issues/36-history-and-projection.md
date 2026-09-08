Type: implementation
Status: ready-for-agent
Blocked by: 31
Label: ready-for-agent

# `/demo/history` and `/demo/projection` — the two secondary surfaces

Both sit behind a flat two-item ellipsis menu in the header, each item carrying a one-line
description (R-N2). Two items do not earn a grouping; a third would.

## `/demo/history` — the raw rows under every aggregate

- **A flat table, one row per AgentSession** (R-N19): started (Organization timezone) · Member ·
  WorkType · Repository · Task key · execution mode · `accepted` · duration · tokens · cost.
- Selectors: date range, Member, WorkType, Repository. Default sort newest first, **client
  pagination at 50** — for readability, not for performance (R-N20, R-T36).
- **The Task key renders as plain text** in `owner/repo#number` form (R-N21). The external tracker
  is imaginary, and a dead link is worse than none.
- **A row expands** to show that session's four disjoint token class volumes and its Model mix
  (R-N20.1). **This is the only surface in the product carrying either** — R-M7 forbids Model as an
  axis on any aggregate, so per-session Model mix can appear nowhere else, and the four classes
  appear elsewhere only as rate-card columns, never as volumes. Ticket 07 declined this row in
  favour of extra selectors; the two were never alternatives. Settled 2026-09-07.
- **Hidden sessions appear here as nowhere else — that is, not at all** (R-N22).

## `/demo/projection` — where the current month lands

- Actual spend to date, plus month-end spend **extrapolated in proportion to the period elapsed**
  (R-N23). The method is stated in one sentence, the elapsed fraction is shown as a share, and the
  incomplete-period flag is present.
- **No confidence band** (R-N24). A band computed over authored fixture data would be fabricated
  precision dressed as rigour. The method plus the elapsed fraction is the honest uncertainty
  statement available here — a projection at 10% elapsed and one at 90% are different claims.
- **Projected cost is the one money figure labelled "estimated"** (R-V8), because a forecast is the
  one money figure here that really is an estimate. The token rate card does **not** render on this
  page; it lives on `/demo/spend` only.
- No controls (R-C1).
- **Nothing else in the product depends on this page** (R-N25).

## Done when

**T-U21** passes and **T-E9** finds no compute-rate-card values on either route.

## Notes

Ticket 05 left projection MVP-optional and leaning out, on the grounds that a projected number is
the least defensible thing on a page. Ticket 07 ships it — and the mitigation chosen is to **move it
off the core surfaces rather than to dress it**. Do not add it to `/demo` or `/demo/spend`.

`/demo/history` is where the recorded gap bites: the four disjoint token classes and per-session
Model mix appear on **no surface**, because the expandable row that would have exposed them was
declined in favour of extra selectors on a flat table. That is a known cost (`spec.md` § 13), not an
oversight to fix here.

## Comments

### 2026-09-08 — T-U21 moves to ticket 28 (AFK build, wave 5)

**`src/domain/metrics/projection.ts` and T-U21 are built by ticket 28, not here.**

`technical-spec.md` § 2 lists the module, but every other domain module has an owner in an earlier
wave and this one did not — T-U21 sits in this ticket's Done-when, and this ticket is blocked by 31,
so it would land in wave 9. Ticket 28's Done-when is "every panel in `spec.md` § 3 has a query
returning a complete ViewModel", and § 3.6 is `/demo/projection`, so the façade cannot be complete
without it. Building it in 28 is the smaller change and keeps the wave order intact.

**What this ticket still owns:** rendering `/demo/projection` per R-N23/R-N24 — the method stated in
one sentence, the elapsed fraction shown as a share, the incomplete-period flag, **no confidence
band**, and the "estimated" label that R-V8 gives to Projected cost and to nothing else attributed.
Plus all of `/demo/history`, and **T-E9** finding no compute-rate-card values on either route.

**Verify T-U21 rather than re-deriving it.** Check that ticket 28's tests assert what T-U21 asks:
the method is identical at 10% elapsed and at 90% while the elapsed fraction differs — both
asserted, because they are two different claims — and that no confidence band is produced.

### 2026-09-08 — implemented (AFK build, wave 9, worktree `agent-dash-t36`)

`lint` 0 errors · `typecheck` clean · `test` **956** across 42 files · `test:coverage` 97.9% / 89.0%
· `build` both routes dynamic · `PORT=3136 pnpm e2e` 58 passed, 1 failed — **T-E4 on `["3.1","3.5"]`,
which was a defect in the test's regex and is fixed on `main` (`fb0c936`)**: both literals come from
the model ids `gemini-3.1-pro-preview` and `gemini-3.5-flash-lite`, and the decimal pattern excluded
digits and dots either side but not letters. Diagnosed here, correctly left unfixed because
`e2e/support/costs.ts` was off-limits to this wave, and verified by measurement — the set difference
between the loose and strict patterns on the restricted `/demo/history` payload is exactly
`{3.1, 3.5}`.

**T-U21 was verified, not re-derived.** Ticket 28's tests assert the method is identical at 10% and
90% (three separate expectations, and the method is a `typeof PROJECTION_METHOD` constant on the
return type so it *cannot* vary with the figure) while the elapsed fraction differs — asserted as a
separate `it`, which is the "two different claims" point. No confidence band is asserted two ways:
a key-name filter over the object and its `elapsed`, and an exact `Object.keys().sort()` equality,
so a new field of *any* name fails. Nothing there was changed.

**T-E9's literal wording is unsatisfiable against this fixture, and the crawl was rebuilt to make
the same claim discriminate.** Crawling for the compute card's bare rate values finds `1.2` and
`0.9` on `/demo/history` — both are session `cost` values on R-N19's rows. `0.3` will appear on
`/demo/spend` too, because it is also `gemini-3.5-flash-lite`'s uncached-input rate. That is
`support/costs.ts`'s own "value identity is not fact identity" defect in a new place. T-E9 instead
asserts, over all six routes as the open account, across HTML **and** RSC flight: **no structural
marker** (`machine_spec`, `usd_per_hour`, the card's `unit` and `label` — deliberately not "per
hour" or a bare "compute", since a marker trippable by honest copy is a marker someone deletes
rather than investigates); **no (specification, rate) pairing** within 80 characters in either
order, which is one row of the card and survives a renamed header; and **not the whole card** —
no payload holds all four rates. Three positive controls: a synthetic serialised card trips all
three, a synthetic row of session costs equal to two rates trips none. Recorded as an argument in
the spec file's header; no spec was edited.

**T-C9.1** reads the four token-class volumes back **out of the DOM**, strips separators, sums them
and compares against the rendered "Tokens processed" figure — never against a fixture literal, so
dropping or duplicating a class fails. It also asserts exactly four named rowheaders in R-N20.1's
order and that **no `%` appears**, since a share would be a division and components do not compute.

**"Estimated" is driven off the ViewModel's own tile key**, so which figure is the forecast is not
re-decided in copy. Three assertions: it is on the projected figure; spend-to-date does not match
`/estimat/i`; and the marker occurs **exactly once** in the panel — repeated live in e2e. The token
rate card does not render here (asserted absent).

`data-table.tsx` was read and deliberately left a Server Component: making the shared table
client-side to serve one page's row expansion would push every page's rows into the flight payload.

**Design notes.** The task key renders in the mono face so `owner/repo#412` reads as an identifier
rather than prose; the expanded row is a full-width band with a `--chart-1` left rule holding
Token classes and Model mix side by side. On projection, the method sentence and the elapsed share
sit in one band because together they are the whole uncertainty statement R-N24 leaves available —
and the share is **text, not a meter**: a data mark there would have to argue with R-T28, and the
spec asks for a share, not a visualisation. `ChartFrame`'s `aspect-video` was overridden to 16/5 via
a child selector (no `!important`) because at dashboard width it produced a ~790px-tall chart.

### Two things reachable but not clickable, recorded

1. **R-N20 asks for "default sort newest first", but § 5 gives `/demo/history` four controls and
   none of them is sort.** The ViewModel sorts and the table exposes `aria-sort`, but a viewer can
   only change it by hand-editing the URL. Header sort links were **not** added: sorting is URL
   state, and adding a control the page does not declare cuts across R-C1.
2. **The `surface: "session"` arm renders and works** (`?session=ses_0001` shows the detail, an
   unknown id shows the withheld note — both verified live) **but nothing in the app constructs
   that link.** Building it properly means preserving the date range and filters through
   `components/controls/schema.ts`'s href builder, a shared file this wave could not touch.
