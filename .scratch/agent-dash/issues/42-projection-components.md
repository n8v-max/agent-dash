Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

# `/demo/projection` — show the two components

## Goal

Spend to date includes the seat fee. Only session cost is extrapolated. A reader cannot verify the
projected figure from what is on screen.

## Scope

- Both tiles show a two-line breakdown under the headline: session cost and seat cost.
- The projected tile shows "session cost × (30 / 8) + seat cost" with the real numbers.
- Chart: add the seat cost as a flat reference line or a note; do not stack it into days (R-M5).
- The method text shrinks to one sentence; the arithmetic replaces the prose.

## Done when

- Unit: projection ViewModel carries `session_to_date`, `seat`, `projected_session`, `projected_total`
  and the identity `projected_total === projected_session + seat` holds.
- e2e: the four numbers are on the page and sum.

## Notes

Decided by the human, 2026-09-09, round 1 (P1 item 7).
