Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

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
