Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

# Control bar, panel-local toggles, active-filter sentence, nav, History dates

## Goal

Spend shows nine control groups and Work ten, in two rows. Half of them change one panel.

## Scope

1. **Global bar keeps**: Period, Grain, Subject, Repository, Template. One row at 1440.
2. **Panel-local**: Accepted, Measure (Raw / Per capita), Model level (Exact / Family / Tier), Mode
   (interactive / headless) move into the header of each panel that reads them. A toggle that
   reaches two panels renders on both, bound to one query param. Params and URLs do not change.
3. **Active-filter sentence** under the page heading: "Week grain · by Team · mobile-app · all
   templates". Reset stays as is.
4. **Nav**: History and Projection become nav items. The "⋯" overflow is removed. Secondary weight
   is allowed (smaller, right-aligned), hidden is not.
5. **History**: date inputs apply on change. The Apply button goes. Native date input, browser
   locale.

## Done when

- e2e: at 1440 the global bar on Spend has five groups; each moved toggle is found inside its
  panel's header; the URL after a toggle click is unchanged from today's.
- e2e: nav has six links, no overflow button.
- e2e: History changes range with no Apply click.

## Notes

Decided by the human, 2026-09-09, rounds 1, 2 and 3. Ticket 45 also edits the toolbar, so run
this first and 45 after.
