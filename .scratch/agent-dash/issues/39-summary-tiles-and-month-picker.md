Type: implementation
Status: resolved
Blocked by:
Label: resolved

# `/demo` — tile order, legible breakdown, month picker, partial-month delta

## Goal

The ten-second read on `/demo` must not repeat a figure, must not draw an unreadable sparkline,
and must not show a change figure the data cannot support.

## Scope

1. **Tile order.** Total spend · Completed Jobs · Completed Jobs by template · Cost per completed
   Job. The breakdown tile sits beside the count it breaks down. Amend R-N4's order in `spec.md`.
2. **Breakdown tile is legible.** C11 already removed the duplicated headline. Render the reported
   month's five WorkTypes as sorted horizontal bars with value labels, not a stacked spline. No
   axis. At 390px it must still read.
3. **Month picker on `/demo`.** Options are the fixture's months only. Drop "All data" on this page
   only; other pages keep it. Default is the current month. C12's widened comparator stays.
4. **Hide the delta on a partial current month.** Amend C13: when the reported month is incomplete,
   every tile shows the "Partial month" flag and **no** percentage. The baseline rule from C13 is
   unchanged. Add a fourth suppression reason, `current-period-incomplete`, in the ViewModel.

## Done when

- e2e: `/demo` offers no "All data"; `?period=all` is dropped and the current month renders.
- e2e: Sep 2026 shows four flags and zero change figures; Aug 2026 shows four change figures.
- Unit: the tile ViewModel emits `current-period-incomplete` for a partial month.
- Visual: the breakdown tile shows five labelled bars at 1440 and 390.

## Notes

Decided by the human, 2026-09-09, rounds 1 and 2. Rework rate was offered for the fourth tile and
declined: the breakdown stays. The live site at review time still showed the pre-C11 duplicate.

## Comments

### 2026-09-09 — implemented (AFK build, worktree `agent-dash-t39`, branch `ticket/39-summary-tiles`)

`lint` clean · `typecheck` clean · `test` **1114** across 52 files · `test:coverage` 97.97% / 87.3%
(domain per-file thresholds hold) · `build` clean · `PORT=3101 pnpm e2e` **105 passed**.

**1. Tile order.** `summaryPage` now builds Total spend · Completed Jobs · Completed Jobs by
template · Cost per completed Job. `spec.md` R-N4 is amended with the order and the reason — a
breakdown two cards from the only tile it is a breakdown *of* makes the reader carry a number across
the ratio to use it. R-N8, C11 and the module comments lost the phrase "the fourth tile", which had
become a coordinate rather than a description; they say "the breakdown tile" now. The grid maths is
unchanged: the breakdown still spans two of the five columns, so `1+1+2+1` still fills the row.

**2. The breakdown tile.** It was already unstacked horizontal bars over the reported month (C11 did
that); what it was not was legible. Two changes, and the second is the one that mattered:

- **A value on each bar** — `LabelList` through the chart's own tick formatter, so a labelled bar
  and a labelled axis can never read differently, and no bare decimal reaches the payload T-E4
  scans. `valueLabels` is a `ChartFrame` prop and deliberately *not* a ViewModel field: `stackable`
  is domain-supplied because stacking makes a claim about the data, and a label on a bar makes none.
- **No axis at all, rather than an axis hidden with CSS** (`axes={false}` → `hide` on both axes,
  and the grid dropped with them). This was the actual legibility bug. A rendered-but-invisible
  `YAxis` still reserves `width={120}`, and the hidden `XAxis` still reserved its height: at 390px
  the five bars were squeezed into the right half of a card and were about 3px tall each. Measured
  before and after in the browser at both widths. Chart height went `h-32` → `h-44` for the same
  reason — five bars plus a legend that wraps to two lines on a phone.

**3. Month picker.** `periodOptions` takes a `PageKey` now, and `OFFERS_WHOLE_WINDOW` is a total
record over the six pages — `/demo` is the only `false`. A new export, `defaultPeriodRange(page,
bounds)`, is the first offered option, so `/demo` opens on the current month and every other page
still opens on the whole window; `putRange` compares against *that* rather than against the window,
which is what keeps the bare route canonical (R-C4) on a page whose default is not the window. An
unoffered token — `?period=window`, `?period=all`, `?period=2026-Q3` — is dropped and the default
stands, which is R-T26's existing rule and needed no new arm. The offered months are the fixture's,
because the bounds are the Organization's observation window.

**4. The partial-month delta.** `change.ts` gains a fourth suppression, `current-period-incomplete`,
checked **after** the three prior-period rules so a comparison failing on both sides reports the
baseline — a period with no basis to compare against is the more fundamental fact. C13 is amended in
`spec.md` with the numbers that decided it, measured on the committed fixture: eight days of
September against the whole of August is Total spend −46%, Completed Jobs −73% and **Cost per
completed Job +96%** — a whole month of seat cost (R-M5) over eight days of work, reading as the
product's central metric nearly doubling. R-M12, R-M13, R-N7 and A8 are amended to match, and
`testing-spec.md` T-U3's *"current period incomplete → shown, and flagged"* bullet is rewritten (it
asserted the asymmetry this ticket withdraws).

**The flag moved from the period line onto the tiles.** All four carry "Partial month", standing
where each tile's change figure would have been, so a tile with no delta explains itself; the
breakdown carries it too, since it draws the same fragment of a month. The period line keeps the
month name and states the reason once — *"This month is unfinished, so no change is shown against
the month before."* — rather than four cards repeating a sentence. Where the suppression is
`current-period-incomplete` the tile prints no domain message: the badge is that suppression's copy.
The other three reasons still print their words, because each is about a *prior* month the viewer
cannot see, and the words are the only account of it there is.

### Decisions taken under the escalation rule

**"Aug 2026 shows four change figures" is implemented as three.** The Done-when asks for four, but
C11 removed the breakdown tile's change figure and `testing-spec.md` T-E7 asserts *"three tiles
carry a headline figure, not four"*; a fourth would re-admit the duplicate of the Completed Jobs
delta that C11 exists to have removed. Taken as the cheaper reading — the flag is a property of the
*month*, so all four tiles carry it, while the change is a property of a *figure*, and only three
tiles have one. Cost: the ticket's two numbers are asymmetric (four flags, three figures), and a
reader comparing the two e2e assertions needs C11 to see why.

**The domain rule is global, not `/demo`-local.** `changeBetween` is reached only through
`readingOf`, which only `summary.ts` calls, so today the two are the same thing — but the rule is
written where the arithmetic is rather than as a filter on the tile ViewModel. A part-month against
a whole month is wrong wherever it is computed, and putting the rule in `change.ts` means the next
page to grow a change figure inherits it. Cost: if a future surface genuinely wants a flagged
part-month comparison, it has to argue with the domain layer rather than opt out locally.

**Value labels are on the mark, not on a re-keyed chart.** The alternative read of "five labelled
bars" was to make the WorkTypes the chart's *buckets* and the count a single series, so each bar
could carry its own category name on a category axis. Rejected as the more expensive option: it
would re-key the ViewModel, collapse the five-colour identity to one, put a sort in the query layer
that R-V5 currently does in `series.ts`, and rewrite T-C11's arithmetic assertion. The names stay in
the legend and in the R-X1 mirror; only the figures are on the bars.

### Left undone, deliberately

- **The legend orders alphabetically while the bars order by rank.** Recharts orders legend entries
  by the series' render order in its own payload, and the two disagree on this tile. It reads fine
  now that every bar carries its own figure, and fixing it means either reordering `series` (which
  is R-V5's ranking and not a display choice) or patching the legend. Not attempted.
- **The figure tiles have visible slack under the figure** at wide widths, because the breakdown
  tile is taller than a figure and the cards share a row height. Pre-existing, and unchanged here.
- **`valueLabels` on a vertical `bar`/`grouped-bar` chart is written but unused** — labels go to
  `top` there rather than `right`. It is two lines and the alternative was a prop that silently does
  nothing on four of the five shapes; no panel exercises it, so it is uncovered.
