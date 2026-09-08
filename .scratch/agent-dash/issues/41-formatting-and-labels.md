Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

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
