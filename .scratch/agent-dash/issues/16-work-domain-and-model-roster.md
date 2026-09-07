Type: grilling
Status: open
Label: wayfinder:grilling

# Repository work-domain vocabulary and the Model roster

## Question

What are the actual *values* of the two categorical vocabularies ticket 08 fixed the shape of
but did not fill — Repository work domain, and the Model roster with its `family` / `tier`
roll-up labels and illustrative rate card?

## Why this exists

Graduated from ticket 08 (2026-09-07), which settled the AgentSession fact table end to end and
closed with "Still open in 08: the Repository work-domain vocabulary and the Model roster."
Both are aggregation dimensions in `CONTEXT.md`, so the fixture cannot be shaped without them.

This is a vocabulary ticket, not a modelling one. The dimensions, their roll-up levels and the
storage grain are all settled. What is open is the value list.

## What has to come out of it

**Repository work domain**

- The closed value list. `CONTEXT.md` names *mobile / data science / backend / frontend /
  infrastructure config* as an example, not a decision.
- Whether a Repository carries exactly one domain or several. One is simpler and makes the
  roll-up a true partition; several is more honest about real monorepos and breaks
  additivity — that trade has to be made explicitly, because every chart grouped by domain
  inherits it.
- Whether there is an `other` / unclassified value, and what it does to a comparison.
- Why this vocabulary and not Devin's eleven session categories, which classify the *work*
  rather than the *codebase* and which ticket 08 already declined once by keeping WorkType flat.

**Model roster**

- The exact models in the fixture, across at least two vendors, since multi-vendor routing is a
  settled decision and a single-vendor roster would not exercise it.
- Their `family` labels, and their `tier` assignment across `frontier` | `balanced` | `fast`.
  `tier` is the one roll-up with no vendor precedent (brief 15), so the assignment is a design
  claim and should read as one.
- The illustrative rate card: a price per (model × token class) for all four disjoint classes.
  Ratios already fixed as useful and stable in `CONTEXT.md`: output ≈ 5× input, cache read
  ≈ 0.1× input, cache write 1.25–2× input, and ~200× input spread from fast to frontier.
- Whether the roster is period-stable or whether a mid-window price change is modelled. A rate
  card that never changes is a simpler pure function; one that does is the honest shape and is
  what makes "cost is derived, never stored" load-bearing rather than incidental.
- Where the "illustrative, not a real price list" label is surfaced, given `CONTEXT.md` requires
  it *wherever* rate cards appear.

## Constraints already settled

`CONTEXT.md` § Aggregation Dimensions fixes Repository → work domain and exact model → family →
tier. § Models & Money fixes the four disjoint token classes, collapses the rate-card key to
(model × token class), and requires rate cards to be labelled illustrative. Model mix is a
*distribution display, not a filter* (ticket 12).

## Inputs handed over by resolved tickets

**From ticket 15 (2026-09-05)** — G4 records that **no surveyed vendor offers any grouping above
Repository**, so this vocabulary is unprecedented ground rather than a convention to copy. The
evidence that it matters is Stanford's segmentation: effect size runs from +30–40% on
low-complexity greenfield work to **net negative** on high-complexity work in large mature
codebases. An org-level aggregate that does not condition on the nature of the work is averaging
across populations with opposite signs — which is the argument for this dimension existing, and
also the standard the vocabulary has to meet. A value list that does not separate those two
populations buys nothing.

**From ticket 02 (2026-09-05)** — the ~200× input-price spread across tiers is what makes model
mix the dominant cost lever. A roster whose members are priced close together produces a fixture
in which the product's central claim is invisible.

## Feeds

10 (the fixture's categorical columns and its pricing function), and `CONTEXT.md`
§ Aggregation Dimensions, which currently carries the dimension without its values.

**From ticket 05 (2026-09-07, HITL)** — scope added: **a compute rate card** joins the token rate
card. It is keyed on the **machine specification allocated**, and unlike the token card it is
**never displayed** to a viewer. Machine cost folds into session Cost. Also needed: the **seat
fee**, a flat monthly per-`human`-Member figure that sits outside session Cost and appears only in
Total spend at monthly grain and coarser.
