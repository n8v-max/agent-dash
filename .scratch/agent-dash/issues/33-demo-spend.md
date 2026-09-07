Type: implementation
Status: ready-for-agent
Blocked by: 31
Label: ready-for-agent

# `/demo/spend` — what we spend, and what we get for it

## Goal

The money page, opening with the ratio rather than the total.

## Scope

**Panels, in this order (R-N9):**

1. Cost per completed Task over time
2. Total spend, split into session cost and seat cost
3. Cost per session, with the `accepted` filter
4. Cost per completed Task by WorkType
5. **Cost by Repository** — flat, no work-domain roll-up. See `spec.md` § 11 C2: ticket 07 named
   this "Cost by Repository work domain", and ADR-0004 (later) removed the label entirely.

Then an **Adoption** section under its own heading, opening with a one-line statement that these
measure **use and not money**:

6. Tokens processed over time
7. Model mix at exact / family / tier

**The page opens with the ratio, not with Total spend** (R-N10). Total spend has already been read
on the summary; repeating it in the first position spends the fold twice. The ratio is the
differentiator; the total is the number every competitor already ships.

**The illustrative token rate card renders as a collapsed table at the foot** (R-N11), labelled
**"illustrative rates"** because the rates are invented. **The compute rate card is never displayed
anywhere.**

**No attributed money figure carries an "estimated" marker** (R-V8). An attributed figure is the
bill, not an estimate of it; labelling it an estimate would understate the one solid number on the
page. See `spec.md` § 11 C3 — this reverses a line in ticket 07, following ADR-0005.

**Controls** per `spec.md` § 5: period and grain · subject · Repository · WorkType · `accepted` ·
per-capita · Model roll-up **scoped to the Adoption section**.

## Done when

**T-C9** passes and Total spend is unavailable below monthly grain on this page (A25).

## Notes

The Adoption heading and its one-line statement carry R-M9: **Tokens processed is an adoption
measure, never a cost proxy**, and is never presented beside a spend figure in a way that invites
the inference. The ~200× input-price spread across tiers is exactly why volume is a poor predictor
of spend — R-D16 puts `frontier` at ~56% of token spend on 15% of tokens, so the divergence is in
the data rather than asserted over it.

The rate card is the evidence for every money figure in the product and costs one collapsed table.
Asking a viewer to trust invented prices whose basis is withheld is worse here than in a real
product.
