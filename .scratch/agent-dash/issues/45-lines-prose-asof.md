Type: implementation
Status: resolved
Blocked by: 43
Label: resolved

# Linear lines, one-sentence panels, as-of timestamp

## Scope

1. **Interpolation**: every line and area uses `linear` or `monotone`. Splines overshoot 0% and
   100% on acceptance and below $0 on cost. Pick one, apply in the shared chart config only.
2. **Panel prose**: one sentence per panel, visible. The rest moves behind a "Why this number"
   disclosure in the panel header. No ADR argument is deleted, it is folded.
3. **As-of timestamp** in the global bar, right-aligned: "Data to 8 Sep 2026 23:28", read from
   the latest `ended_at` in the loaded fixture, in the Organization timezone. Feeds the ingest
   sketch in ticket 55.

## Done when

- Unit: chart config exports one interpolation constant; no panel overrides it (lint or test).
- e2e: each panel header has at most one visible `<p>` before the chart; the disclosure exists.
- e2e: the as-of string is present on every `/demo*` page and matches the History top row.

## Notes

Decided by the human, 2026-09-09, round 3.

## Comments

### 2026-09-09 — implemented (AFK wave 2, straight to `main`)

All six gates green: `lint` clean · `typecheck` clean · `test` **1292** across 59 files ·
`test:coverage` 98.2% statements / 88.8% branches, every per-file domain threshold met · `build`
clean · `e2e` **140 passed**.

**Item 1 — `linear`, and the constant is `CHART_INTERPOLATION` in `chart-config.tsx`** (R-V13,
A37, T-C19). `linesFor` and `areasFor` in `chart-shapes.tsx` were the only two places a curve was
named and both hard-coded `monotone`; they now read the constant, and `ShapeInput`/`ChartFrameProps`
carry no curve field, so a panel has nothing to override it with.

**Why `linear` rather than `monotone`.** The ticket's reason is overshoot, and `monotone` reduces
it rather than removing it — it still invents the *shape* between two measurements. That is the
same act R-V10 already forbids `connectNulls` from committing across a gap, so the product now
answers it the same way in both places: a mark joins two readings and claims nothing between them.
`linear` is also the reading a viewer already assumes a chart is making.

"No panel overrides it" is a **test**, not a lint rule, and it is deliberately two assertions: the
marks carry the constant, *and* no module anywhere under `src/` spells a Recharts curve name in a
`type=` prop. The second is the one that matters — a rendering assertion passes against a product
where some other panel went back to a spline, because that panel's chart is not the one under
test. Mutation-checked: reverting the two marks to `monotone` fails four assertions in the file.

**Item 2 — one sentence visible, the rest behind a native `<details>`** (R-V14, A38, T-C20, T-E16).
`src/components/panels/panel-prose.tsx` holds the whole rule: `splitProse` cuts at the first
sentence terminator followed by whitespace, and `PanelProse` renders the lead as the panel's one
paragraph and the remainder inside a `<details><summary>Why this number</summary>`. Both panel
chromes — `PanelCard` (`/demo/spend`, Adoption) and `WorkPanel` (`/demo/work`) — call it, so the
two pages cannot disagree about how much prose a panel shows.

**The fold is mechanical on purpose, and that is how "no ADR argument is deleted" is enforced
rather than promised.** No panel's copy was rewritten or shortened: the strings are byte-identical
and the cut is computed. So T-C20's central assertion is a **round trip** — `lead + " " + rest`
is the paragraph that went in, word for word — which is a claim no screenshot and no "shows one
sentence" assertion could make. ADR-0004's flat Repository, ADR-0005's attributed cost and R-M5's
whole-month seat charge all still ship, one click away.

Native `<details>`, so the disclosure adds no client JavaScript, survives scripting being off, and
keeps `components/panels/`'s chromes Server Components.

**Two things deliberately did *not* fold.** A qualification that moves with a control is not
standing prose: the per-capita denominator (C14 — "the denominator is shown whenever the toggle is
on") and R-M5's monthly-grain note stay visible under the chart, and the `accepted` filter's
sentence **moved from the question to the footnote** for the same reason, since appending it to the
question would have hidden live control state behind a drawer purely because it was last in the
string. That relocation is why `spend-panels.test.tsx`'s "says which outcome filter" assertion still
passes unchanged. `work-presence.test.tsx` was the one test that had to follow relocated copy: it
asserted the whole `note` in one node, and now asserts the restriction visible, the argument folded,
and the two halves reassembling into the ViewModel's `note` exactly — a strictly stronger claim.

**Item 3 — the as-of stamp** (R-N3 amended, R-N3.1, A39, T-U23, T-C21, T-E15). Three layers:
`src/domain/observation.ts` decides which row is the dataset's edge (pure, no clock, no `now`),
`src/data/clock.ts`'s `dataAsOf()` formats it in the Organization's timezone through the product's
one instant formatter, and `PageToolbar` renders it right-aligned. The value is a domain/data fact
carrying `sessionId`, `instant` and `observedTo`, which is what ticket 55's ingest sketch needs —
a watermark and a row to resume from — rather than a component's formatting of a date.

**Escalated decision: the rule selects on `ended_at`; the stamp prints that session's `started_at`.**
The ticket says both "read from the latest `ended_at`" and "matches the History top row", and over
the committed fixture those are one row (`ses_0757`) and two different instants: it started
`2026-09-08 23:28` and ended `2026-09-09 01:15`. Printing the end instant would put the stamp
**past `window_end`** — every date control on the page carries `2026-09-08` as its `max` (R-D2,
R-N20) — and would match no row on any surface, so the "matches the History top row" e2e could only
have been written as an inequality. Printing the start makes the stamp character-for-character the
top row's Started cell, and it is exactly the instant the ticket's own worked example gives
(*"Data to 8 Sep 2026 23:28"*). So `ended_at` decides **which** session — the honest ingest
semantics, since a session's measures are only observable at its end — and `started_at` is what is
shown. Both instants are on the value, so ticket 55 loses nothing. **Cost of the choice:** the
visible stamp understates the true watermark by one session's duration, and a future ingest that
wanted the strict watermark on screen would have to reconcile it with `window_end` first.

**Format is `YYYY-MM-DD HH:MM`, not the ticket's `8 Sep 2026 23:28`.** The ticket's spelling would
have made the stamp and the History cell two different strings for the same moment, which is the
one thing the check is for. `instantIn` moved out of `queries/context.ts` into `src/data/instant.ts`
so both readers share it — the same argument ticket 41 made for the money formatter.

**R-N3 is amended, and the spec says so.** The bar used to be *absent* on `/demo/projection`
because it declared no control; a freshness stamp on five surfaces out of six would read as the
sixth being stale, so the bar now stands everywhere and holds the stamp alone there. The half of
the old rule that carried the requirement is asserted more sharply than before, in both
`page-toolbar.test.tsx` and `e2e/controls.spec.ts`: the bar renders **and holds no control and no
link at all**. No test was deleted for this; two were rewritten to the amended rule.

**The stamp is not viewer-scoped**, and T-E15 asserts both accounts are told the same thing. It
carries no cost, no name and no count — it is the calendar the figures were taken over, in the same
class as the observation window both accounts already meet in `/demo/history`'s date bounds. R-A6
governs figures reaching a payload, and this is not one.

**`data-session` on the History `<tr>`** is the one addition made for testability, and it is the
row's own domain identity (R-T8) rather than an affordance: with it, "the stamp matches the History
top row" is an identity between two session ids rather than two formatters agreeing by luck, which
is what T-E15 asserts alongside the string equality.

**Left undone, deliberately.** The panel *footnotes* are not folded — see above. `/demo/people`,
`/demo/history` and `/demo/projection` carry no `PanelCard`/`WorkPanel` panels, so R-V14 reaches
nothing on them; their page-level ledes are untouched, being one line each already. And the
disclosure's summary hides the native marker in favour of a dotted underline; no chevron was added.
