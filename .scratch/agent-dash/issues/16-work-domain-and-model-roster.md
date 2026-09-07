Type: grilling
Status: resolved
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

## Answer

Resolved 2026-09-07, HITL, over six rounds. **Half of this ticket's scope was cut rather than
filled**: the Repository work-domain vocabulary has no values because the label no longer exists.

### Repository work domain — cut

**Repository is flat.** It carries no work-domain label and no roll-up level.
→ `docs/adr/0004-repository-carries-no-work-domain.md`, `CONTEXT.md` §§ Organisation & People,
Aggregation Dimensions.

The ticket asked which axis the vocabulary sits on. `CONTEXT.md`'s example list was a *technology*
axis, but the standard ticket 15 set for it — separate Stanford's +30–40% greenfield population
from its net-negative mature-codebase population — is a *complexity* axis. Neither survived:

- **One label per repository is false.** A real repository runs several technologies at once.
- **Several labels break additivity.** A roll-up level is a partition by definition; a multi-valued
  label is a tag set, and every domain-grouped total would double-count.
- **`Repository × WorkType` already meets the standard**, and both are page filters already.
- **The signal survives in the repository name.** `terraform-infra` at 0.44 acceptance against
  `web-console` at 0.78 is a finding the reader discovers, not one read off an axis label.

Devin's eleven session categories were declined for the reason ticket 08 already gave: they
classify the *work*, which is WorkType's job, not the *codebase*.

**Consequence: `Cohort` is cut entirely.** Its key was work domain, WorkType, or both. With the
filter set fixed at `Repository × Team × WorkType` on every analytical surface, `Cohort` named
nothing the filters do not already name. It had already been demoted once by ticket 12, from an
access scope to an aggregation dimension. Repository now carries the similarity relation.

### Model roster — seven models, three vendors

`family` **carries the vendor**. Without it a legend reads `Opus`, `GPT-5`, `Gemini Pro` and the
reader must supply the vendor themselves; vendor appears at no other level.

| Model | `family` | `tier` |
|---|---|---|
| `claude-opus-5` | Claude Opus | `frontier` |
| `gpt-5.2` | OpenAI GPT-5 | `frontier` |
| `claude-sonnet-5` | Claude Sonnet | `balanced` |
| `gemini-3-pro` | Gemini Pro | `balanced` |
| `claude-haiku-4-5` | Claude Haiku | `fast` |
| `gpt-5.2-mini` | OpenAI GPT-5 mini | `fast` |
| `gemini-3-flash` | Gemini Flash | `fast` |

**Three vendors, not the minimum two, and every tier is cross-vendor (2/2/3).** `tier` is the one
roll-up with no vendor precedent (brief 15), so it is a design claim — and a tier holding a single
vendor's models would be a coincidence rather than a claim about capability classes.

**Real model names, not invented ones.** The platform is fictional; the models it routes to are
not. Invented names would read as a toy, and the tier bet is only checkable against models a
reader already has opinions about. The illustrative-rates label carries the price disclaimer.

Seven exact models also give the roll-up zoom control real work: 7 series at exact grain (over the
cap), 7 families, 3 tiers — ticket 14's roll-up spike with data behind it.

### Token rate card — illustrative, per million tokens

Input price is the only number per model. The other three classes derive by **uniform ratios**:
cache read 0.1×, cache write 1.25×, output 5×.

| Model | input | cache read | cache write | output |
|---|---|---|---|---|
| `claude-opus-5` | 15.00 | 1.50 | 18.75 | 75.00 |
| `gpt-5.2` | 12.00 | 1.20 | 15.00 | 60.00 |
| `claude-sonnet-5` | 3.00 | 0.30 | 3.75 | 15.00 |
| `gemini-3-pro` | 2.50 | 0.25 | 3.13 | 12.50 |
| `claude-haiku-4-5` | 0.80 | 0.08 | 1.00 | 4.00 |
| `gpt-5.2-mini` | 0.25 | 0.03 | 0.31 | 1.25 |
| `gemini-3-flash` | 0.08 | 0.01 | 0.09 | 0.38 |

Frontier input over fast input is **exactly 200×**, so ticket 02's finding — model mix, not token
volume, dominates cost variance — is present in the data rather than asserted over it. Uniform
ratios keep the card one number per model.

### Compute rate card — never displayed

`machine_spec` is added to the AgentSession's fixed launch labels; without it the compute card has
no key and machine cost is underivable. It is **not** an aggregation dimension.

| spec | rate |
|---|---|
| `general` | $0.30/hr |
| `compute` | $1.20/hr |
| `memory` | $0.90/hr |
| `storage` | $0.45/hr |

`compute` at 4× `general` is what makes the CPU-heavy, token-light session read as a cost anomaly
rather than a rounding difference. A flatter card would hide the one thing this card exists for.

**Seat fee: $39 per `human` Member per month, flat.** Not varied by Role — that would tie money to
the access matrix for no analytical gain.

### Period stability and the illustrative label

**Both cards are period-stable.** A mid-window price change would make a rise in spend ambiguous
between more usage and a higher price, and none of ticket 07's six surfaces can explain the
difference. That plants a misreading in the fixture; the honest shape is not worth it here.

**Where the labels go.** The token card displays on `/demo/spend` (spend rate plus a rates-per-token
table) and nowhere else; `/demo/projection` shows spend and the projection only. The compute card
displays nowhere. Two labels doing two different jobs: **"illustrative rates"** on the card, because
the rates are invented, and **"estimated"** on Projected cost only, because a forecast is the one
money figure that really is an estimate. "Estimated" was removed from attributed costs — see the
cost reversal in ticket 10 and `docs/adr/0005`.

### Feeds

Ticket 10 (categorical columns, the generator's pricing input), `CONTEXT.md` §§ Organisation &
People, Work, Models & Money, Aggregation Dimensions, and `docs/adr/0004`.

**Open, factual not decisional**: the `gpt-5.2` and `gemini-3` version strings were proposed from
knowledge with a May 2026 cutoff and should be checked against the current vendor lists before the
fixture ships. The roster's *shape* does not depend on the answer.
