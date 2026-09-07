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

## Converged against `CONTEXT.md` (2026-09-07)

Ticket 08 wrote most of this ticket's answer into `CONTEXT.md` § Models & Money while settling
the session data model. Recording what is now closed, so this ticket is scoped to what is
genuinely still open rather than re-litigating settled text.

**Closed — do not reopen without a reason:**

- **The canonical set is four disjoint classes**: uncached input, cache read, cache write,
  output, stored per (AgentSession × Model). Disjointness is the stated reason: it is the only
  shape that sums safely.
- **Cache-write TTL is collapsed** to a single class. The consequence is stated in `CONTEXT.md`
  rather than left to be discovered: this model cannot reproduce an Anthropic invoice.
- **The rate-card key is collapsed to (model × token class).** Region, service tier, context
  tier and speed are dropped.
- **The precision claim is fixed**: the product estimates an invoice, it does not reproduce one,
  and cost is labelled estimated wherever it appears.
- **Cost is derived, never stored.** The pricing function is a pure function over the four
  counts — ticket 09's cleanest unit-test target after the comparability intersection.

**Still open, and this ticket's remaining work:**

1. **The un-normalisable reading.** Dropped, approximated, or surfaced as a gap. `CONTEXT.md`
   explicitly defers this one here. A silently wrong total is the worst of the three, but
   "surfaced as a gap" is a UI commitment that costs a component and a fixture case, and
   dropping is only defensible if the drop itself is counted somewhere visible.
2. **How far the vendor-mapping table is a shipped artefact.** The data is fixtures throughout,
   so no vendor reading is ever actually parsed. The mapping — OpenAI's `input_tokens` as a
   superset that must be decomposed, Anthropic and Bedrock as already-disjoint — can be a spec'd
   and unit-tested normalisation function with vendor-shaped inputs, or prose in `CONTEXT.md`
   with no code behind it. The first is the more defensible answer to *"is this multi-vendor by
   decision or multi-vendor by assertion"*; the second is honest about a fixture-backed demo.
   Decide which, and note that ticket 09 named this the clearest example of a pure function to
   test against known-tricky inputs — which is an argument, not a decision.
3. **Whether a session's tokens may span vendors, not just models.** `CONTEXT.md` fixes that one
   AgentSession may consume tokens across more than one Model. If those Models can come from
   different vendors within one session, normalisation is a per-row concern and not merely an
   import-time one.

**Downgraded.** This was raised as a correctness question blocking the fixture, and at the
storage grain it no longer is — the canonical shape is fixed and the fixture is written in it.
What survives is a scoping question about how much of the normalisation boundary this project
builds versus documents. Cheaper than it looked, and it should be resolved before 10 so the
fixture knows whether it needs vendor-shaped input cases at all.
