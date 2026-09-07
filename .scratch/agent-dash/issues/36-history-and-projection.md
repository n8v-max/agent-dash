Type: implementation
Status: ready-for-agent
Blocked by: 31
Label: ready-for-agent

# `/demo/history` and `/demo/projection` — the two secondary surfaces

Both sit behind a flat two-item ellipsis menu in the header, each item carrying a one-line
description (R-N2). Two items do not earn a grouping; a third would.

## `/demo/history` — the raw rows under every aggregate

- **A flat table, one row per AgentSession** (R-N19): started (Organization timezone) · Member ·
  WorkType · Repository · Task key · execution mode · `accepted` · duration · tokens · cost.
- Selectors: date range, Member, WorkType, Repository. Default sort newest first, **client
  pagination at 50** — for readability, not for performance (R-N20, R-T36).
- **The Task key renders as plain text** in `owner/repo#number` form (R-N21). The external tracker
  is imaginary, and a dead link is worse than none.
- **A row expands** to show that session's four disjoint token class volumes and its Model mix
  (R-N20.1). **This is the only surface in the product carrying either** — R-M7 forbids Model as an
  axis on any aggregate, so per-session Model mix can appear nowhere else, and the four classes
  appear elsewhere only as rate-card columns, never as volumes. Ticket 07 declined this row in
  favour of extra selectors; the two were never alternatives. Settled 2026-09-07.
- **Hidden sessions appear here as nowhere else — that is, not at all** (R-N22).

## `/demo/projection` — where the current month lands

- Actual spend to date, plus month-end spend **extrapolated in proportion to the period elapsed**
  (R-N23). The method is stated in one sentence, the elapsed fraction is shown as a share, and the
  incomplete-period flag is present.
- **No confidence band** (R-N24). A band computed over authored fixture data would be fabricated
  precision dressed as rigour. The method plus the elapsed fraction is the honest uncertainty
  statement available here — a projection at 10% elapsed and one at 90% are different claims.
- **Projected cost is the one money figure labelled "estimated"** (R-V8), because a forecast is the
  one money figure here that really is an estimate. The token rate card does **not** render on this
  page; it lives on `/demo/spend` only.
- No controls (R-C1).
- **Nothing else in the product depends on this page** (R-N25).

## Done when

**T-U21** passes and **T-E9** finds no compute-rate-card values on either route.

## Notes

Ticket 05 left projection MVP-optional and leaning out, on the grounds that a projected number is
the least defensible thing on a page. Ticket 07 ships it — and the mitigation chosen is to **move it
off the core surfaces rather than to dress it**. Do not add it to `/demo` or `/demo/spend`.

`/demo/history` is where the recorded gap bites: the four disjoint token classes and per-session
Model mix appear on **no surface**, because the expandable row that would have exposed them was
declined in favour of extra selectors on a flat table. That is a known cost (`spec.md` § 13), not an
oversight to fix here.
