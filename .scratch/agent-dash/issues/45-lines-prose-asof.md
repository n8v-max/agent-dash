Type: implementation
Status: ready-for-agent
Blocked by: 43
Label: ready-for-agent

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
