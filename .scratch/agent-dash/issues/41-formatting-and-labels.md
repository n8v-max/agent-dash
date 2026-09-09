Type: implementation
Status: resolved
Blocked by:
Label: resolved

# Currency, labels, sparklines, and the seat-month line

## Goal

Small display errors that read as carelessness in a ten-second review.

## Scope

- `/demo/people` Cost column: currency format with symbol and two decimals, same formatter as
  the tiles. One shared money formatter in `src/components/panels/figures.ts`; delete copies.
- `kind` values render as "Human" and "Service account". The raw enum never reaches the DOM.
- Acceptance sparklines on `/demo/work`: no axis ticks, no axis labels. Headline number and a bare
  line only. Same for any sparkline inside a tile.
- Total spend subtitle: verify the seat-month arithmetic. 18 human Members over 6 months is
  108 seat-months, not 6. Fix the computation or the wording; write what the number means.
- Session duration panel: the median line hugs the floor beside p95. Use two small panels or a
  log axis; pick one and record why.

## Done when

- Unit: formatter tests for money, kind label, seat-month sentence.
- e2e: People table cost cell matches `/^\$[\d,]+\.\d{2}$/`; no `service_account` text on any page.

## Notes

Decided by the human, 2026-09-09, round 3.

## Comments

### 2026-09-09 — implemented (AFK build, worktree `agent-dash-t41`, branch `ticket/41-formatting`)

`lint` 0 errors · `typecheck` clean · `test` **1130** across 52 files · `test:coverage` 97.97%
statements / 87.59% branches, every per-file `src/domain` threshold met · `build` clean · `PORT=3103
pnpm e2e` **111 passed**.

**One money formatter, and four copies deleted.** The formatter now lives in
`src/components/panels/figures.ts` as `usd` / `usdTick`, spelled `style: "currency"` — the one
spelling that cannot drift, because the symbol, its position and the two decimals come from the
locale and the currency code rather than from a template literal that happens to agree with them
today. Deleted: `money-figure.tsx`'s `MONEY` and `MONEY_TICK`, `projection-panel.tsx`'s own
`money`, and `figures.ts`'s own `$` + two decimals. The fourth was the one a reader actually met —
`data-table.tsx`'s bare `maximumFractionDigits: 2`, which is why `/demo/people`'s Cost column read
`310.5`, `220.25`, `41.2` one click from a tile reading `$310.50`.

**A table column now carries its unit, and the unit is a domain fact.** `TableColumn` gained
`unit?: FigureUnit` — the same vocabulary `TileViewModel.unit` uses — so the Cost column is money
because `src/data/queries/people.ts` said so, not because a cell recognised a column key. R-T6 is
intact: the component formats a resolved number in a declared unit and computes nothing. The same
one-line mechanism fixed `/demo/history`'s Cost column, which had the identical defect; the raw
rows under an aggregate now read as the same kind of figure the aggregate does.

**`Member.kind` reaches a reader as words.** `memberKind` joined `context.label.*` in
`src/data/queries/context.ts`, beside `member`, `team` and `workType`, so the People table and a
Member's profile resolve it from one map and cannot disagree. `MemberProfileViewModel.kind` became
`kindLabel`, which removes the last `kind === "service_account" ? … : …` ternary from the rendering
layer. **The e2e sweep asserts over `innerText`, not markup, and that is deliberate**: the enum is
legitimately in the document as a URL — the toolbar's kind filter links carry
`?member_kind=service_account`, which is R-C3 working — and what R-N15 governs is what a reader
reads.

**R-V11 is new, and it is the sparkline rule.** A chart inside a tile now carries no axes, no
ticks, no grid and no legend; the tooltip, `accessibilityLayer` (R-X3) and the R-X1 mirror are
untouched, so the chrome goes and the values do not. It is one branch in `furnitureFor`, which is
now exported for the same reason `stackIdOf` is: it is the *only* expression that decides whether a
chart has axes, so the rule is assertable over the decision rather than over Recharts' class names
in jsdom. `/demo/work`'s acceptance multiples set it — a 144px tile was spending most of its height
on a tick strip, a dashed grid and a one-entry legend restating the `<h3>` two lines above it.

**That also closed a defect `work-acceptance.tsx` had been reporting in prose.** Its header
recorded that the five multiples did not share a measure axis, so at month grain `deploy` at 33%
drew exactly as tall as `implementation` at 67%. With no axis drawn there is no axis to disagree
about: the comparison *between* templates is carried by the shared-axis rail, which is on
`acceptanceAxis` by construction, and each sparkline now carries only its own template's direction.
The stale paragraph is replaced by that reasoning.

### The decision this ticket asked for: the duration panel

**Two small panels, not a log axis.** `/demo/work` panel 5 is still *one* panel — R-N12's order is
a requirement and a seventh heading would have broken it — holding two charts side by side, Median
and p95, each on its own linear axis, with the two magnitudes stated together in the figure strip
above them. `durationPanel` returns `{ title, median, p95, summary }`.

Why not the log axis, which was the cheaper change:

1. **A log axis lies to a glance, and the glance is what this page is graded on.** On a log scale a
   4× gap looks like a small one and a doubling looks like a wobble. A reader who does not notice
   the axis — which is most readers in ten seconds — reads the wrong story, and unlike a stacking
   error there is no geometry rule that catches it. That is the same class of falsehood R-V1
   forbids: a chart asserting something its caption cannot undo.
2. **It breaks on the values this product is about to have.** Ticket 40 makes every zero-denominator
   ratio `null`, so buckets with no sessions become gaps — and a log scale has no place to put a
   zero or a gap at its floor. Choosing a geometry that a sibling ticket is about to feed nulls into
   would be choosing a bug.
3. **Two panels reuse a pattern the product already has** (R-N13's small multiples) instead of
   introducing a scale type that appears exactly once. The cost is real and is stated: the two
   series are no longer comparable *by eye* at a glance. That comparison is recovered where it
   belongs — in the figure strip, in one shared unit, where "44 min" beside "3 hr 15 min" is a
   sharper statement of the ratio than two lines on one axis ever was.

Both charts keep their axes and their legends, deliberately: a tick strip is what makes a duration
line a duration, and the one-entry legend is how a reader tells the left chart from the right one.
R-V11 does not apply — these are half-panels, not tiles.

### The seat-month arithmetic: the computation was wrong, not the wording

`/demo/spend` read *"18 human Members · 6 seat-months"*. **6 is a month count wearing a seat-month
label**, and it is out by a factor of the size of the Organization. A **seat-month is one month held
by one seat**, so the quantity the fee is charged per is `seats × months`: 18 human Members over 6
months is **108 seat-months**, and $4,212 is 108 × the $39 monthly fee — it was never 6 × anything.

Fixed in the domain rather than in the copy, because the field name was the error:
`SeatBearingPeriod.seatMonths` became `months` (it counts months and always did), and
`TotalSpend` now carries **both** `months` and `seatMonths = seats × months`, with
`seatCost = seatMonths × fee`. The seat charge is now written as *quantity × price*, so the figure
and the sentence a panel writes under it come out of one expression. The hint reads
**"18 human Members × 6 months = 108 seat-months"** — every number on the ViewModel, the `×` and the
`=` punctuation rather than arithmetic the component performs (R-T6). R-M5 gained the definition.

### Spec amendments, in this commit

- **`spec.md` R-V11** (new, § 6) — a chart inside a tile carries no axes, ticks, grid or legend;
  tooltip, `accessibilityLayer` and the mirror are unaffected. R-N8 already said this for the
  summary tile's bars; R-V11 names it once for every tile.
- **`spec.md` R-N12 item 5** — panel 5 is two small multiples, one per statistic, each on its own
  axis, and the paragraph under it records why and that a log axis was rejected.
- **`spec.md` R-N15** — each column reads in its own unit, the Cost column is the tiles' own money
  formatter, and the raw `kind` enum never reaches a reader.
- **`spec.md` R-M5** — a seat-month is one month held by one seat; the count is `seats × months`.
- **`spec.md` § 10** — **A29** (tile charts carry no furniture) and **A30** (one money formatter, no
  raw kind enum). Appended; nothing renumbered.
- **`testing-spec.md`** — T-C9.2, T-C9.3, T-C12 and T-C13 added, T-U12 extended with the seat-month
  identity, and A29/A30 given owning tests in § 9.

### Deliberately left undone

- **The `/demo` mix tile still hides its axis labels with CSS**, not with R-V11. It is a
  `display: none` on Recharts' tick-label layer in `summary-tiles.tsx`, with an e2e test asserting
  the computed style — so the labels are rendered and then hidden rather than never drawn. R-V11 is
  the mechanism that replaces it and the tile should set `bare`, but **`summary-tiles.tsx` is ticket
  39's file** and ticket 39 owns "no axis" on that tile in its own scope. Flipping it here would
  have taken that test with it and handed 39 a conflict. Left for 39, which now has the prop.
- **`ChartFrame.measureDomain` is now unused by every panel.** It was added for the acceptance
  multiples' shared axis; R-V11 removed their axis, so nothing pins one anywhere. It is kept rather
  than deleted — the next pair of side-by-side charts *with* a drawn axis will need it, and it is
  the only expression in the product that can pin a scale — and both its doc comments were rewritten
  to say so, because the old ones claimed a caller that no longer exists.
- **The acceptance tooltip and the R-X1 mirror still render acceptance as a bare `0.71`**, not as
  `71%`. `tickFormat` never reached either of them, so this predates the ticket and is unchanged by
  it; the headline figure above each sparkline reads `71%`. Worth a ticket, out of scope for this
  one.
- **The Duration column on `/demo/history` keeps its "(s)" label** rather than taking the `seconds`
  unit, which would have rendered "1,234s" under a heading that already says the unit.
