Type: implementation
Status: resolved
Blocked by: 43, 44, 45
Label: resolved

# Full phone support at 390px

## Goal

Every page overflows horizontally on a phone. Scroll width is 572 to 784px on a 390px viewport.

## Scope

- Global bar wraps; panel-local toggles wrap inside their header.
- Tables scroll inside their card; the page never scrolls sideways.
- Charts cap at container width; legends wrap; tick labels thin to every other bucket.
- Summary tiles stack, one per row, breakdown bars still labelled.
- Header: nav collapses to a row of short labels, account switcher becomes the avatar only.

## Done when

- e2e at 390×844 for all six routes: `document.documentElement.scrollWidth <= 390`.
- Playwright project `mobile-chromium` added and run in CI.

## Notes

Decided by the human, 2026-09-09, round 1: full phone support, not tablet-and-up.

## Comments

### 2026-09-09 — implemented (AFK wave 2, primary worktree, commit on `main`)

`lint` clean · `typecheck` clean · `test` **1299** across 59 files · `test:coverage` 98.19% /
88.76% · `build` clean · `e2e` **150 passed** across both projects.

**The Done-when, measured.** All six routes at 390×844, `document.documentElement.scrollWidth`:

| Route | Before | After |
|---|---|---|
| `/demo` | 588 | **390** |
| `/demo/spend` | 682 | **390** |
| `/demo/work` | 784 | **390** |
| `/demo/people` | 588 | **390** |
| `/demo/history` | 588 | **390** |
| `/demo/projection` | 588 | **390** |

The ticket's stated 572–784 is the same picture read at a slightly different rendering; the shape
of it — one common 588 and two pages worse — is what the diagnosis turned on.

**Written failing first.** `e2e/mobile.spec.ts` and the `mobile-chromium` project went in before
any fix and failed on all six routes plus the restricted-account sweep and the table-scroller
claim, with the widest offending elements printed in each failure message. That report is what
found the two causes, and neither was the one the ticket's scope list would have suggested first.

**Cause 1 — the header, on all six routes.** The mark, six nav labels and the switcher need 588px
and the row could not shrink below it. It is now a **wrapping** header: identity on the first
line, the whole nav on the second, both type sizes one notch down. Nothing is hidden and no
overflow control came back — R-N2 and A33 are the two rules that bar was rebuilt for last wave,
and the new test asserts six links **visible** with no button and no "⋯", plus that the nav does
not overflow its own row.

**Cause 2 — the R-X1 mirrors, on `/demo/spend` and `/demo/work`.** The widest thing on `/demo/work`
was a 784px `<table class="sr-only">` that nobody can see. A table's used width is never less than
its min-content width, so `width: 1px` never held it and `overflow: hidden` clipped its contents
rather than its own box — and an absolutely positioned box that wide still counts towards the
document's scroll width. The `sr-only` class moved onto a wrapping `<div>`. This is the find worth
recording: it is invisible at every width above ~700px, it affects *every* chart in the product,
and no visual review would ever have located it.

**Three more, found by looking rather than by measuring.** None of them moved `scrollWidth`,
because Recharts' own `overflow: hidden` was quietly eating them:

- **The legend did not wrap.** shadcn ships `flex` with no `flex-wrap`, so five entries at 390px
  ran off both edges of the card and the first and last labels were cut in half — a legend
  silently deleting two of the five names it exists to give. Passed as a class from
  `SeriesLegend`, not patched into the vendored `ui/chart.tsx`, which stays a verbatim copy.
- **The comparator's paired bars had no bars.** `grid-cols-[11rem_1fr_6.5rem]` wants 304px and the
  card offers 286, so the `1fr` bar track collapsed to zero and R-N17's *paired bars* rendered as
  a table of two figures. Two lines below `sm`, with explicit placement so the reading order is
  name, bar, figure at both widths.
- **The two wide tables already had their scrollers** (`overflow-x-auto`), so nothing needed
  fixing there — but the mechanism had no test. It has one now, asserted as a real overflow
  (`scrollWidth > clientWidth`) so a card that merely clipped its columns would fail.

**"Tick labels thin to every other bucket" — decided, and the decision is not literally that.**
Recharts already thins by default (`preserveEnd`), so a hard "every other" would have been a
regression at 1440 where all 22 weekly labels have room. What went in instead is
`BUCKET_TICK_INTERVAL = "equidistantPreserveStart"`, declared beside `CHART_INTERPOLATION` in
`chart-config.tsx` and applied once in `chart-shapes.tsx` — Recharts picks the smallest N for
which every Nth label fits, so it *is* every other bucket at 390 and every third at 1440, and the
labels that survive are **evenly spaced**. `preserveEnd` also thins but unevenly, and three weeks
at three different distances read as three arbitrary buckets rather than as a sampled axis. This
extends the existing decision point rather than adding a fifth knob to `ChartFrame`, per the
brief. **The one thing it must not touch is a `horizontal-bar`'s category axis** — thinning that
deletes a bar's name and leaves the bar, which is a chart that lies — so the exclusion is asserted
directly in T-C22 rather than left to follow from where the constant happens to be applied.

**The `mobile-chromium` project is scoped to `mobile.spec.ts` alone, and that is a choice.** The
brief flagged that a second project roughly doubles the e2e suite. Every other spec asserts rows,
URLs, payload contents and mirror cells, none of which a viewport can change, so running them
twice would buy nothing; the desktop project carries `testIgnore` for the same file so it is not
run twice either. The suite went from 140 to 150 tests and from ~36s to ~40s. The two existing
tests that genuinely need a second width — T-E7's breakdown tile and T-E12's toolbar — already set
their own viewport inside the desktop project, and were left there so each width stays beside the
requirement it belongs to. CI runs `pnpm e2e` unchanged, which now runs both projects against the
one server it starts; the `PORT` and `reuseExistingServer` logic is untouched.

**Specs amended in the same commit.** `spec.md` gains **R-V15** (the measurement, and a table of
the five mechanisms with what each is the alternative to) and **A40**; § 13's "responsive
breakpoints … unspecified and deliberately so" is corrected, and narrowed rather than deleted —
R-V15 states one width, not a breakpoint system, and the tablet range between 390 and 1440 is
still deliberately unspecified. `testing-spec.md` gains **T-E17** and **T-C22**, the two-project
note under § 5, and a row in § 7 saying that widths between 390 and 1440 are deliberately
untested. Every new identifier was grepped for first; R-V14, A39, T-C21 and T-E16 were the highest
allocated, so this takes the next free one in each series.

**One existing test was adapted, and not weakened.** T-C1's five mirror assertions moved from
`toHaveClass("sr-only")` on the `<table>` to the same assertion on the box that now carries it,
reached through a `data-testid` rather than by walking out of the table, plus a new check that the
table is not `aria-hidden`. The claim — off screen, still in the accessibility tree — is unchanged.
Both halves of this ticket's chart work were mutation-checked: reverting the wrapper fails all five
T-C1 cases, removing `flex-wrap` fails T-C22, and dropping the tick interval fails four more.

**`src/app/page.tsx` was not touched.** The landing was measured out of curiosity and reports 390
at this viewport, as does `/sign-in`, so there is nothing for the human to fix there.

### Deliberately left undone

- **A scroll affordance on the two wide tables.** `/demo/people` and `/demo/history` scroll inside
  their cards, and nothing on screen says so — a phone reader may not discover the five columns to
  the right of Team. The cheap options (a fade, a "swipe" hint, a per-row card layout) are each a
  visual-design decision this ticket has no requirement for, and R-V15 asks that the page not
  scroll sideways rather than that the table advertise that it does. Worth a follow-up ticket.
- **Widths between 390 and 1440.** Everything here keys off Tailwind's `sm` (640px), so the layout
  between 640 and 1440 is whatever the desktop rules already did. That range is unspecified in
  `spec.md` and stays so; it is recorded in `testing-spec.md` § 7 rather than left implicit.
- **`/demo/spend?subject=member`'s ranked bars are cramped at 390.** Five bars and a five-entry
  legend inside a 288px-tall card is legible but tight. R-V12 fixes the form and the category axis
  is hidden by design, so the fix would be a panel height that varies with width — a change to
  `panel-card.tsx`'s one-height-for-every-chart decision, which is R-N9's and not this ticket's.
