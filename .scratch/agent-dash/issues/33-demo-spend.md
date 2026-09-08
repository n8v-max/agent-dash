Type: implementation
Status: resolved
Blocked by: 31
Label: resolved

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

### 2026-09-08 — implemented (AFK build, wave 9)

All six gates green. **T-C9 is three separate statements** because R-V8 makes three separate
claims: no attributed figure carries "estimated" (checked against `innerHTML` as well as
`textContent`, so a marker in an `aria-label` or `title` cannot hide, with a non-vacuity guard that
real money rendered); Projected cost does (asserted on the rule, both arms, since that figure lives
on ticket 36's page — so the marker can be neither always-on nor never-on); and the rate card
carries "illustrative rates" (the label is a component constant, not a fixture string, so it cannot
be edited out of the data).

**A25 needs no defending in the panel.** The ViewModel refuses sub-monthly Total spend, so at
`grain=day` the ratio panel buckets by day while Total spend still buckets by month and renders the
R-M5 note. There is no expression in the panel that could re-bucket.

Money ticks are **whole grouped dollars, not compact**: compact rendered two identical ticks
(`$1k, $2k, $2k`), and the decimal form would put a bare decimal in the payload T-E4 scans.

Three defects found here were fixed on `main` afterwards, in files this wave could not touch: the
**Model mix rendered unpainted bars** at `family`/`exact` (the display label was the series key, so
shadcn minted `--color-Claude Sonnet`); the T-E4 **rate-card and model-id collisions**; and
`ChartFrame`'s `tickFormat` **cannot cross the RSC boundary** — it typechecks, builds, passes every
jsdom test, and throws in the browser. That last one cost four e2e failures before it was found and
is worth a line in `chart-frame.tsx`'s header.

**Two things recorded, not re-decided.** `perCapita` is declared for this page in
`DECLARED_CONTROLS` but `spendPage` never reads it, so the toolbar's Raw/Per-capita control changes
nothing — in tension with R-C1's "no page shows a control its panels cannot use". And a requirement
ID reaches user-facing copy: the Adoption statement ends "…never a cost proxy (R-M9)" and renders
verbatim from the data layer.

A judgement call, recorded in the component: the Model mix distribution list renders every slice,
including ones the chart folded into "Other". R-V4's cap is read as a rule about *series* (five
colours, R-V7), and R-V6 already discloses the tail by name in Other's tooltip; the list has no
swatches, no expansion and no click.

### 2026-09-09 — resolved by the human: C14

Per-capita was declared for this page by R-C1 and read by nothing on it, so the control rendered and
changed nothing. It now divides **Total spend** and **Cost by Repository** — the page's two additive
money panels — and deliberately not the three ratios, which are already normalised.

Total spend stays stackable under the toggle, unlike `/demo/work`'s velocity panel: session cost per
Member and seat cost per Member sum exactly to total spend per Member, so R-V1 has no reason to veto
the geometry. The denominator is R-M14's, now shared with `work.ts` rather than copied.
