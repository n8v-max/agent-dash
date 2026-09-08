Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

# Every ratio emits null when its denominator is zero

## Goal

A bucket that finished nothing has no cost per completed Job. Today it draws $0, and the panel text
promises a gap. Acceptance rate draws 0% for a week with no sessions. Both lie.

## Scope

- One rule in `src/domain`: a ratio with a zero denominator is `null`, never `0`.
- Applies to: Cost per completed Job (all groupings), Cost per session, Acceptance rate (all
  WorkTypes), Rework rate, Decomposition rate, per-capita variants, Projection when no day elapsed.
- Charts break the line at null (Recharts `connectNulls={false}`). Table mirrors show an
  em dash. Headline figures show "—" with the reason "no completed Jobs in this period".
- The restricted account's Cost per completed Job is the acceptance case: weeks 15–17, 20, 21, 23
  must draw nothing.

## Done when

- Unit test per ratio: zero denominator returns null.
- Property test seed: for any bucket, `ratio === null` iff `denominator === 0` (ticket 51 extends).
- e2e: restricted account, Spend, the mirror table for Cost per completed Job holds a dash in
  week 15.

## Notes

Decided by the human, 2026-09-09, round 3: null everywhere, including acceptance rate.
