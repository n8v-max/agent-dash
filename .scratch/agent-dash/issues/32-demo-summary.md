Type: implementation
Status: ready-for-agent
Blocked by: 31
Label: ready-for-agent

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
