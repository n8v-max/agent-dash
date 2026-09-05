Type: grilling
Status: open
Label: wayfinder:grilling

# Cross-vendor token-class normalisation

## Question

What does a token count *mean* in this product, given that vendors do not define token classes
the same way — and what is the canonical internal representation everything normalises into?

## Why this exists

Graduated from ticket 02 on 2026-09-05. This is a correctness question, not a presentation one.

- Anthropic and Bedrock report **uncached input** as a disjoint class. OpenAI's `input_tokens`
  is a **superset** that already contains cached and cache-write tokens. Adding a Claude row to
  a GPT row without normalising double-counts, silently, in a way that looks plausible.
- Cache writes **subdivide by TTL** and price differently by TTL (Anthropic: 1.25× at 5m, 2× at
  1h). The four-field shape in `CONTEXT.md` cannot express that, so it cannot be priced against
  Anthropic's own card.
- Rate cards are keyed on (model × token class × service tier × context tier × region × speed).
  A four-field TokenUsage keyed only by model cannot address that card.

This product is multi-vendor by decision, so it owns this problem rather than inheriting a
vendor's answer.

## What has to come out of it

- The canonical internal token-class set, and whether it is a disjoint partition or allows
  supersets. Disjoint is the only shape that sums safely.
- How each vendor's reported shape maps into it, and what happens when a vendor does not report
  a class this product models.
- How much of the rate-card key is modelled and how much is collapsed — and what precision is
  lost by collapsing, stated explicitly rather than discovered later.
- Whether cache-write TTL is modelled, or cache write is collapsed to one blended rate.
- Whether an un-normalisable vendor reading is dropped, approximated, or surfaced as a gap. A
  silently wrong total is the worst of the three.

## Feeds

10 (the fixture cannot be shaped until this is settled), 09 (this is the clearest example of a
pure function that must be unit-tested against known-tricky vendor inputs), and `CONTEXT.md`
§ Models & Money, which currently flags the question rather than answering it.
