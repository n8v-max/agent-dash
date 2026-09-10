# ADR-0011: The roster grows to ten, and the Model mix becomes a presence over time

Date: 2026-09-10
Status: Accepted

Amends [ADR-0007](0007-model-roster-spans-a-real-200x.md), which stays in force for everything it
decided about *how* a roster is picked. This one changes what the roster **is**, adds a monthly
presence to it, and reverses the direction of R-D17. Decided by the human on 2026-09-10 and
implemented in [ticket 70](../../.scratch/agent-dash/issues/70-model-roster-presence-and-palette.md).

## Context

ADR-0007 re-picked seven real models so the ~200× input-price spread the whole cost argument rests
on would be a property of the data rather than an assertion over it. It succeeded at that and left
two things it had no reason to look at.

**The roster showed a market, not a team.** Seven models, one per line, is a price list. What a
team actually does over five months is *move* — off the cheap model as the mid-range gets good
enough, onto the new frontier model the week it ships, from one version of a line to the next. None
of that is expressible with one model per line, and the fixture's committed monthly shares were
correspondingly flat: Sonnet ~30%, Gemini Pro ~22%, Haiku ~10%, every month, all window.

**And the one thing that did move, moved the wrong way.** R-D17 had the frontier tier's token share
*falling* from 25% to 10%, which reads as a team optimising its way down the price list. That is a
legible story and it is the wrong one for 2026: what a team does when a better frontier model
arrives is use it. The falling-frontier story was also carrying a second job it should not have
been — it was the entire reason `WEEKLY_SPEND_SHAPE` was shallower than the volume curve.

## Decision

### Ten models, three vendors, tiers 3 / 4 / 3

| id | vendor | `family` | `tier` | input $/MTok |
|---|---|---|---|---|
| `claude-fable-5-1` | Anthropic | Claude Fable | `frontier` | 10.00 |
| `claude-opus-5` | Anthropic | Claude Opus | `frontier` | 5.00 |
| `gpt-6-astra` | OpenAI | OpenAI GPT-6 Astra | `frontier` | 10.00 |
| `claude-sonnet-4-6` | Anthropic | Claude Sonnet | `balanced` | 3.00 |
| `claude-sonnet-5` | Anthropic | Claude Sonnet | `balanced` | 2.00 |
| `gpt-5.2` | OpenAI | OpenAI GPT-5 | `balanced` | 1.75 |
| `gemini-3.1-pro-preview` | Google | Gemini Pro | `balanced` | 2.00 |
| `claude-haiku-4-5` | Anthropic | Claude Haiku | `fast` | 1.00 |
| `gemini-3.5-flash-lite` | Google | Gemini Flash-Lite | `fast` | 0.30 |
| `gpt-5-nano` | OpenAI | OpenAI GPT-5 | `fast` | 0.05 |

**The 200× spread survives, unchanged and still unmanufactured**: 10.00 against 0.05 is exactly
200×, now reached by two models at the top rather than one. Everything ADR-0007 says about why that
figure is load-bearing stands.

**The other three token classes are still derived by the uniform ratios** — cache read 0.1×, cache
write 1.25×, output 5× — so the card remains *illustrative*: real inputs, synthetic derivation.

### `family` is the vendor's line, so a family may span versions **and tiers**

`claude-sonnet-4-6` and `claude-sonnet-5` share `Claude Sonnet`; `gpt-5-nano` and `gpt-5.2` share
`OpenAI GPT-5`. That is ticket 16's naming rule — *"the vendor's model line, carrying the vendor"* —
applied for the first time to a roster holding two versions of one line, and it is what lets the
family level say something the exact level cannot: the Sonnet family is flat at ~30 points across
the window while 4.6 hands over to 5 inside it.

**The consequence is that `family` and `tier` stop being a chain.** `OpenAI GPT-5` holds a `fast`
model and a `balanced` one, so a tier is no longer the sum of its families. All three levels still
partition the same tokens exactly — `aggregate.ts` sums each of them from the *exact* entries, never
from the level below — and that is what T-U17 asserts. What is no longer true, and was never
asserted, is `exact ⊂ family ⊂ tier`. This is honest rather than awkward: a vendor's line spans
capability classes, and a cross-vendor tier exists precisely because a vendor's own lineup does not
express one (ADR-0007's consequence on `gemini-3.1-pro-preview` makes the same point from the other
side).

### A monthly family table replaces the tier targets

`TIER_TOKEN_SHARE` is **deleted as a target**. `FAMILY_SHARE_BY_MONTH` — eight families × six
months, each row summing to 1 — is the authored thing, and the tier shares are *derived* from it and
the roster. R-D16's invariant survives as an assertion over what the generator emitted, priced from
the card: **the `frontier` tier carries more token spend than any other tier while holding the
smallest token share.** On the committed data that is frontier **62.5% of token spend on 22.1% of
tokens** (balanced 31.4%, fast 6.1%).

### R-D17 reverses: the frontier rises, and Haiku's fade is the optimisation story

Frontier token share runs **11.6% in April to 31.5% in September** as Fable arrives in June and
Astra grows through the summer. `claude-haiku-4-5` runs **28.0% down to 10.3%** over the same
window. The reader's actionable finding is unchanged in kind and better in substance: the fade of
the cheap model is a decision somebody made, where a falling frontier share was mostly a decision
nobody made.

Vendor token share over the window lands at **Anthropic 58%, OpenAI 32%, Google 10%**, against the
60 / 30 / 10 the human asked for and inside the ±3 points the generator asserts.

### The Model mix panel gets its own ten-colour palette, and R-V7 is amended for it alone

`--model-1..10` in `globals.css`, `MODEL_MIX_COLOR_VARS` in `domain/series.ts`, and a
`paletteFor(grouping)` seam in `domain/viewmodel.ts` that is the single expression deciding which
palette a chart takes. **Every other chart keeps `--chart-1..5` and keeps R-V4's top-four-plus-Other
cap**, which is derived from the palette it was handed and not from a number written beside it.

The panel also stops being stacked bars of token volume and becomes **one line per Model of that
Model's share of the period's tokens**, on a pinned 0–100% axis.

## Why

**A closed roster is not a comparison axis, and the cap was written for comparison axes.** R-V4
exists because a dimension that grows — twenty Members today, forty next quarter — makes an
unreadable chart and "the top four and the rest" is the honest reading of it. The Model roster is
ten rows of authored data that a reader is choosing *between*; folding six of them into a grey
"Other" deletes the finding the panel exists to show. R-V7's real content — that a chart's colours
and its cap are one decision, and that no code path generates a hue — is kept exactly, and the
amendment is scoped to the one grouping whose series set is closed.

**A share, not a volume, because the panel's question is "what did they move between".** Drawn as
volume every line rises together with adoption and the mix is the small residue between them; drawn
as share the mix holds still while the volume ramps, and the volume is the chart immediately above
it. The measure is therefore a ratio, so `stackable` is false — not because Model stopped
partitioning the tokens (R-V1 still permits it), but because a share of a whole is not a part of
one.

**Whole percentage points.** A share is read off a 0–100 axis to the nearest point, and rounding in
the domain layer keeps the rendered series and the R-X1 mirror the same number (T-C1) while keeping
bare decimals off the wire that T-E4's payload scan would otherwise have to reason about.

**The spend curve had to be re-fitted, and that is R-D17's doing rather than a free parameter.**
`WEEKLY_SPEND_SHAPE` was shallower than the volume curve — 1.39 against λ's 2.03 — because the
average priced token got *cheaper* as sessions got more numerous. It now gets dearer, so the curve
is steeper (≈3.1×, from ~$1,666 in the opening week to ~$5,138 in the closing one) and its midpoint
and steepness are its own: volume flattens across August and the mix does not, so a logistic sharing
λ's midpoint could not follow their product. **There is still no separate price ramp anywhere in the
generator** — the price ramp *is* the Model mix, which is the whole of what R-D17 claims.

## The version check

Run on 2026-09-10 against first-party vendor documentation, the same way ADR-0007 ran its check on
2026-09-07. ADR-0007's seven strings were not re-verified beyond the three that changed context.

- **`gpt-5.2` — verified, and the ticket's spelling of it was wrong.** The ticket proposed the id
  `gpt-5-2`. OpenAI's own pricing and model pages list **`gpt-5.2`**, with a dot, alongside
  `gpt-5.2-pro`; there is no `gpt-5-2`. The real string ships, on ADR-0007's standard — *"a reader
  with opinions is exactly the reader who notices that `gemini-3-pro` never existed"* — and it costs
  nothing, because the roster already carries a dot in `gemini-3.1-pro-preview` and
  `e2e/support/costs.ts` already excludes a decimal inside an identifier from T-E4's search set.
- **`gpt-5.2`'s price — $1.75 / MTok input, $14.00 output.** First-party. The ticket left it as
  *verify*; 1.75 is the figure, and the derived classes follow from it (0.175 / 2.1875 / 8.75).
  Third-party aggregators quote $0.875 for the same model and describe it as a recent 50% cut. The
  first-party page is what ADR-0007 checked against and is what is used; the discrepancy is recorded
  here rather than averaged away. It moves nothing structural — `gpt-5.2` is `balanced` at either
  figure, and neither end of the 200× spread runs through it.
- **`claude-fable-5-1` at 10.00 and `gpt-6-astra` at 10.00** are the two ends of the top of the
  card. Astra is carried over from ADR-0007's verified card unchanged. Fable's placement at 10.00
  is the ticket's, and it puts the two frontier flagships at parity, which is what makes the 200×
  spread reachable from either vendor rather than from one.
- **`claude-sonnet-4-6` at 3.00** is the previous Sonnet's list price, above `claude-sonnet-5` at
  2.00 — which is the shape a version handover has and is why the handover is worth drawing: the
  team moves onto the newer model *and* the cheaper one.

## Consequences

- **`claude-haiku-4-5`'s retirement commitment is now load-bearing.** ADR-0007 flagged it as "not
  sooner than 2026-10-15 — the roster entry most likely to need replacing next". It is now the model
  R-D17's optimisation story is *about*, so replacing it means re-authoring the family table's first
  row, not swapping a string.
- **Three published figures moved with the mix**, and every one of them is a consequence of the
  price ramp rather than of a level anybody set: total session cost over the window is **$72,682**
  against $59,258, the seat fee falls to **5.5%** of Total spend, and **cost per completed Task now
  rises across the window** where it used to fall. The last of those inverted a fixture test, which
  was rewritten to assert the new direction rather than the old number.
- **A ten-colour categorical palette cannot clear the all-pairs separation gates, and does not.**
  Validated with the `dataviz` skill's own script in both themes: on the **adjacent** pairlist — the
  documented one for lines, stacks and bars — it passes everything, worst CVD ΔE 11.3 light / 10.2
  dark against a target of 8, worst normal-vision ΔE 22.1 / 20.9 against a floor of 15. Under
  `--pairs all` it fails, at ΔE 4.0 / 6.4 light and 2.6 / 5.2 dark. That is the documented series
  cap binding — the skill's own reference palette cannot pass all-pairs past **three** slots, and no
  re-ordering or re-stepping fixes it, because the pairlist stops depending on order. The relief is
  the one R-V7's five-colour palette already relies on and this panel has more of: every series is
  named beside its swatch in the legend, the levels table under the chart names every Model with its
  exact token count and share, and the R-X1 mirror carries every figure. Identity is never
  colour-alone here.
- **Colour follows the series' *rank*, not the Model.** `capSeries` paints by walking the palette,
  which is what makes "no series can be emitted without a colour" true by construction — so the
  vendor hues are a property of the palette as a *set* (five warm, three cool, two green) and not a
  mapping from vendor to hue. Pinning a colour to a Model would need a `colorOf` on the series input
  and an R-V5 amendment; neither was in scope. Recorded in the ticket's comments as the cheaper
  option taken.

## Reversibility

Cheap for the data, as ADR-0007's was: the roster, the card and the family table are generator
inputs, and one `pnpm fixtures:generate` reverses any of them. The palette and the `paletteFor` seam
are cheap too — the seam is one total lookup, and deleting the amendment means returning `model` to
`CHART_COLOR_VARS` and letting the cap engage again.

What is **not** cheap to reverse is R-D17's direction, for ADR-0007's own reason: `spec.md` R-D4,
`WEEKLY_SPEND_SHAPE` and the fixture's cost-per-Task trend all now read off a mix that gets dearer,
and putting the frontier share back on a downward path means re-fitting the spend curve and
re-writing three paragraphs of reasoning. That is the direction the change was made in — the
reasoning was moved to fit the data the human asked for, not trimmed to fit the old data.

## Evidence

OpenAI API pricing and models pages, checked 2026-09-10 (`gpt-5.2` at 1.75 / 14.00; `gpt-6-astra`
present and current). Anthropic's published pricing for the Claude roster, carried forward from
ADR-0007's 2026-09-07 check for `claude-opus-5`, `claude-sonnet-5` and `claude-haiku-4-5`. Not
verified, and stated so: third-party aggregator pricing for `gpt-5.2`, which disagrees with the
first-party page by a factor of two; cache-read and cache-write rates for OpenAI and Google, which
remain Anthropic's ratios applied across all three vendors.
