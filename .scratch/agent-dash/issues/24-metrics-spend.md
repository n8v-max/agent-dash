Type: implementation
Status: ready-for-agent
Blocked by: 23
Label: ready-for-agent

# Spend metrics

## Goal

`src/domain/metrics/spend.ts` — Total spend, Cost per session, Cost per completed Task.

## Scope

- **Cost is read from the session row, never computed** (R-M4, R-T11). Cost is attributed upstream
  by the platform's billing system; this application aggregates it and prices nothing (ADR-0005).
  There is no rate-card arithmetic in this file.
- **Total spend = session Cost + Seat cost**, at **monthly grain and coarser only** (R-M5).
  Apportioning a monthly seat fee across days is invented precision. Seats attach to `human`
  Members only.
- **Cost per completed Task** is the product's central claim. Total Cost over a period divided by
  Completed Tasks in it: attempts that produced nothing sit in the numerator and not in the
  denominator, so waste raises the figure. A period with spend and zero Completed Tasks must not
  divide by zero.
- Cost per session, with the `accepted` filter.

## Done when

**T-U12** and **T-U13** pass. Total spend is unavailable below monthly grain (A25), and April's
whole-month seat charge against 19 days of sessions is asserted as **correct-and-flagged, not
corrected** (R-D2).

## Notes

Seat cost is what makes a low-usage Member legible: a seat held against near-zero usage is the
highest cost per unit of work in the Organization, and a consumption-only model cannot see it.
R-D10 puts one such Member in the fixture — the sharpest finding in the product needs a person to
point at.

April is inflated by construction. The partial flag is what stops that being read as a finding.
