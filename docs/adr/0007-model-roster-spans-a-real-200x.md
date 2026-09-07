# ADR-0007: The model roster is re-picked so the 200× spread is real

Date: 2026-09-07
Status: Accepted

Reverses the roster and token rate card settled in
[ticket 16](../../.scratch/agent-dash/issues/16-work-domain-and-model-roster.md), and amends
`CONTEXT.md` § Models & Money. Decided at the `/to-spec` handoff, after the version check ticket 16
itself asked for.

## Context

Ticket 16 fixed a seven-model roster and an illustrative token rate card, and flagged one item as
*"open, factual not decisional"*: the version strings were proposed from a May 2026 knowledge cutoff
and should be checked against current vendor lists before the fixture ships. It noted, correctly,
that *"the roster's shape does not depend on the answer."*

The check was run on 2026-09-07 against vendor pricing and model-list pages. The shape survived. The
contents did not, and the card turned out to be wrong in a way the ticket could not have seen.

**Three of the seven strings do not exist.** `gemini-3-pro` never reached GA — the preview shut down
2026-03-09. `gemini-3-flash` is a superseded preview. `gpt-5.2-mini` was never shipped; GPT-5.2 has
no mini or nano variant. A fourth, `gpt-5.2`, exists but OpenAI's own documentation now labels it a
previous flagship, so its `frontier` assignment is no longer true.

**And the card's headline property was manufactured.** Ticket 16 built it so frontier input over fast
input is *exactly* 200×, treating that as ticket 02's finding being *"present in the data rather than
asserted over it."* Against real prices the card inflates the top — 15.00 where `claude-opus-5` is
5.00 — and deflates the bottom — 0.08 where the roster's cheapest real model is 0.75. Each end is off
by an unremarkable amount; compounded, they fabricate the ratio. **The real spread across ticket 16's
roster is roughly 20×.**

A separate arithmetic error sat inside the same row: at an input of 0.08 the card's own uniform
ratios yield 0.01 / 0.10 / 0.40, but the row reads 0.01 / 0.09 / 0.38. An input of 0.075 reproduces
the row exactly *and* gives exactly 200× against 15.00. The intended value was 0.075; 0.08 is a
rounding error that was then propagated into two specs as a hard fixture invariant.

## Decision

**Keep ticket 16's shape. Replace its contents.** Seven models, three vendors, tiers 2/2/3, every
tier cross-vendor, `family` carrying the vendor, one authored input price per model with the other
three classes derived by uniform ratios — all retained.

| Model | `family` | `tier` | input $/MTok |
|---|---|---|---|
| `gpt-6-astra` | OpenAI GPT-6 Astra | `frontier` | 10.00 |
| `claude-opus-5` | Claude Opus | `frontier` | 5.00 |
| `claude-sonnet-5` | Claude Sonnet | `balanced` | 2.00 |
| `gemini-3.1-pro-preview` | Gemini Pro | `balanced` | 2.00 |
| `claude-haiku-4-5` | Claude Haiku | `fast` | 1.00 |
| `gemini-3.5-flash-lite` | Gemini Flash-Lite | `fast` | 0.30 |
| `gpt-5-nano` | OpenAI GPT-5 nano | `fast` | 0.05 |

**Input prices are real, as verified on 2026-09-07.** The other three classes remain derived by
uniform ratios — cache read 0.1×, cache write 1.25×, output 5× — which are Anthropic's real ratios
applied across all three vendors. The card therefore stays **illustrative** and keeps that label; it
is real inputs with a synthetic derivation, not an invoice.

**10.00 / 0.05 = exactly 200×**, with no thumb on the scale.

## Why

**Ticket 16's own standard forces the string fixes.** It chose real model names over invented ones
because *"invented names would read as a toy, and the tier bet is only checkable against models a
reader already has opinions about."* A reader with opinions is exactly the reader who notices that
`gemini-3-pro` never existed. Dead strings fail the standard that motivated using real names.

**The 200× spread is load-bearing beyond the fixture.** `CONTEXT.md` cites it as *why* Model mix
rather than token volume drives cost variance, and the rule that tokens are an adoption measure and
never a cost proxy rests on it. Keeping the roster and restating the spread at 20× would have meant
editing that reasoning down in three places. Re-picking the roster keeps the reasoning intact and
makes it true.

**200× is reachable, just not with mid-range models.** It needs a genuine premium reasoning model at
the top and a genuine nano model at the bottom. Ticket 16's roster had neither, which is why it had
to invent the ratio rather than find it.

## Consequences

- **`gemini-3.1-pro-preview` sits at `balanced`, which is contestable.** Google positions 3.1 Pro as
  its most capable model, which reads `frontier`. It is placed at `balanced` because at 2.00 input it
  prices with `claude-sonnet-5` (2.00), not with `gpt-6-astra` (10.00) or `claude-opus-5` (5.00) —
  and for a cost dashboard, price is the better signal of capability class than vendor marketing.
  This sharpens rather than weakens ticket 16's position that `tier` is a **design bet with no vendor
  precedent**: the bet is precisely that a cross-vendor capability class exists that vendors' own
  lineups do not express.
- **A `-preview` string ships in the fixture.** There is no GA Gemini 3.x Pro. The alternative was an
  invented string, which ticket 16 ruled out.
- **`claude-haiku-4-5` carries a retirement commitment of "not sooner than 2026-10-15"** — about five
  weeks out. It is real today; it is the roster entry most likely to need replacing next.
- **Derived fixture figures must be recomputed, not transcribed.** Ticket 16's *"frontier carries
  ~56% of token spend on 15% of tokens"* was computed against the old card and no longer holds. The
  fixture requirement becomes an invariant — *the `frontier` tier carries more token spend than any
  other tier while holding the smallest token share* — with the expected value derived from this card
  by the generator rather than hardcoded.
- **The uniform ratios are now known to be a vendor-specific convention**, not a market constant.
  Recorded in `CONTEXT.md` § Models & Money rather than left implicit.
- **This card is checkable in one click, which is the point.** Real inputs invite verification; the
  previous card would have failed it.

## Reversibility

Cheap. The roster and card are fixture data and generator inputs. What is not cheap to reverse is the
reasoning in `CONTEXT.md` and ADR-0002/0003 that leans on the spread, which is why the roster was
changed to fit the reasoning rather than the reasoning trimmed to fit the roster.

## Evidence

Vendor pricing and model-list pages, checked 2026-09-07: Claude models overview and pricing, OpenAI
API pricing and models list, Gemini API pricing, models and deprecations pages. Not verified: Vertex
AI pricing for Gemini, and cache-read/cache-write rates for OpenAI and Google — so the 0.1× / 1.25×
ratios are confirmed for Anthropic only.
