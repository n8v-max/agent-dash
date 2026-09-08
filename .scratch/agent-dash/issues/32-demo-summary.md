Type: implementation
Status: resolved
Blocked by: 31
Label: resolved

# `/demo` — the summary

## Goal

The org root: four tiles, nothing else. The ten-second read.

## Scope

**Four tiles (R-N4), arranged as the thesis** — two money, two efficacy, with the third being the
differentiator itself:

**Total spend · Completed Tasks · Cost per completed Task · Completed Tasks by WorkType**

- **Each tile is itself the link** to the page carrying its evidence (R-N5). The tiles do both jobs
  — the ten-second read and the route into detail — so **no separate link row exists**.
- **Nothing below the tiles.**
- **Month-locked: month is the only period** (R-N6). Total spend does not exist at day grain, and a
  tile that silently changes metric with the period is the failure the unaccepted-spend tile was cut
  to avoid. `quarter` was dropped (`spec.md` § 11 C7) — it never entered the glossary, and over the
  150-day window it yields two buckets, both partial.
- Each tile carries a **period-over-period change**, subject to the change floor (R-N7, R-M12).
- The fourth tile renders **Completed Tasks by WorkType** as a small **stacked** area with no axis
  labels at tile size (R-N8). WorkType is a true partition — every AgentSession references exactly
  one — so it stacks legitimately under the narrowed R-V1 (`spec.md` § 11 C8). **All five WorkTypes
  render and no "Other" bucket appears**: the cap engages only above five series, which voids ticket
  07's "non-degenerate at top 4 + 'Other'" fixture requirement. The full chart lives on `/demo/work`.

## Done when

**T-E7** passes, and the four tiles read as one argument at a glance: *this is the total, this is
what we got, this is the rate, this is what kind of work it was.*

## Notes

The fourth slot was left provisional by ticket 05 because **Rework rate may flatline at 0%**, which
is dead space at a ten-second read. Ticket 07 filled it with Completed Tasks by WorkType because it
is **never empty**, which was the objection to the slot in the first place. Rework rate leaves the
headline entirely and keeps its place on `/demo/work`.

**Session counts were rejected as the tile's measure**, on ticket 05's own grounds: they are not
velocity, because they *rise* when work goes badly.

`/demo` is an authenticated surface. The question of how it relates to the authenticated surfaces
dissolved once `demo` was recognised as an org slug rather than a demo mode.

## Comments

### 2026-09-08 — inherited from ticket 28 (AFK build, wave 6)

**The fourth tile stacks a measure R-N8's own justification does not cover. Do not silently
"fix" it, and do not silently ship it without knowing.**

R-N8 makes this tile a stacked area of **Completed Tasks** by WorkType, and justifies the stacking
with *"WorkType is a true partition — every AgentSession references exactly one"*. That holds for
**sessions**. It does not hold for **Tasks**: a Task with accepted sessions in two WorkTypes is a
Completed Task under both, so the five columns can sum past the Organization's Completed Task
count. That is the false geometric claim R-V1 exists to prevent — the same shape as the Team
problem R-V3 makes explicit and requires a note for.

It is real in the committed fixture, not hypothetical: ticket 25 found **118 Tasks spanning more
than one WorkType**.

**Ticket 28 followed R-N8** — the query returns `stackable: true` for this tile — because the spec
is the fixed point and this is not an implementer's call (AFK handover § 8). Render what the
ViewModel says.

The two honest alternatives, for whoever decides:
- **Measure sessions in this tile**, where the partition genuinely holds. But R-N4 names Completed
  Tasks, and ticket 05 rejected session counts as a velocity measure on the grounds that they
  *rise* when work goes badly.
- **Key each Task to its first accepted session's WorkType**, restoring the partition at the cost
  of a rule nothing else in the product uses.

Note this also touches T-C11, which asserts stacking follows the partition: a ViewModel claiming
`stackable: true` for a grouping that does not partition the measure is exactly what T-C11 calls a
failure. As things stand the tile satisfies R-N8 and sits awkwardly against T-C11's principle.
**Flagged for the human; not re-decided.**

### 2026-09-08 — implemented (AFK build, wave 9)

All six gates green; T-E7 passes with 9 new e2e tests. "Nothing else" is asserted as **exact counts
over `main`** — 1 list, 5 headings, 1 chart group, 1 mirror table, 4 links — because any fifth
panel brings at least one of those with it. Month-only is asserted on the *offered options*
(`All data` or `Mon YYYY`, none matching `/quarter|\bQ[1-4]\b/i`) rather than on the absence of a
quarter, so a quarter reappearing fails. `?period=2026-Q3` is dropped and the default stands.

**The R-N8 over-count is now measured, not argued.** Through the real query: open account, Aug 2026,
the stacked mirror columns sum to `58+35+25+32+12 = 162` against the Completed Jobs tile's **150**;
restricted account, `15+17+13+7+3 = 55` against **49**. The geometry claims a whole the measure does
not have, in the shape R-V1 exists to prevent and T-C11 calls a failure. Rendered as the ViewModel
says and flagged; not re-decided.

**A second consequence, rendered rather than resolved: tiles 2 and 4 show the same figure and the
same change** (`41 · −73%` twice on the open account), because the ViewModel builds tile 4 from the
same reading as tile 2. R-N7 requires a change on each tile and R-T6 forbids a component dropping
what the ViewModel carries. It is a real cost on the page graded for the ten-second read, and both
honest fixes live above the panel: drop `value` from the mix tile, or measure something else there.

**The period control fights R-N7 on this page.** The shared toolbar offers "All data" plus each
month; selecting one clips the range to that month, so no prior bucket exists and **all four
changes suppress** (`/demo?period=2026-08` renders four "no prior period" messages and collapses
the stacked area to a single column). R-N7 therefore holds only on the default range. Either the
summary's period control should choose the *reported* month while the query keeps reading a
comparator, or `/demo` should declare no period control at all — "month-locked" arguably means
there is nothing to choose.

Design: the period and comparison basis are identical on all four tiles, so they are said **once**
above the row rather than four times. The mix tile lays out *across* (figure left, chart right) so
all four figures sit on one baseline. **No colour on the change** — up is good for Completed Jobs
and bad for Cost per completed Job, the ViewModel carries no polarity, and colouring it would be
the component editorialising; direction is a sign a screen reader reads plus an `aria-hidden` glyph.
No emphasis on the differentiator: equal weight is what makes the four read as one argument.

Two shared-file gaps recorded: `ChartFrame` has no way to express R-N8's "no axis labels at tile
size" (worked around with arbitrary variants from the panel; a `labels?: boolean` or `dense` prop
would be the clean fix), and `ChartLegendContent` is a single unwrapped flex row that rendered five
WorkTypes outside the card at tile width.
