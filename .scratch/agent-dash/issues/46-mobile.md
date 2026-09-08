Type: implementation
Status: ready-for-agent
Blocked by: 43, 44, 45
Label: ready-for-agent

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
