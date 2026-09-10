Type: implementation
Status: ready-for-agent
Blocked by: 68
Label: ready-for-agent

# Model roster to Fable and Astra, families with a month-by-month presence, and a distinct palette for the Model mix

## Goal

The Model mix shows the **full range** of what a team actually moved between across the window:
Claude from Haiku to Fable, OpenAI from nano to Astra, Gemini on the side. Presence changes over
time — Haiku popular in April–June and down to ~10% by September, Sonnet 5 taking over from
Sonnet 4.6, Fable and Astra arriving late. Token share by vendor lands at **60% Anthropic, 30%
OpenAI, 10% Google** over the window. The Model mix panel draws one line per family over time
in a palette of its own, more distinctive than the five shared chart colours.

Decided by the human, 2026-09-10 (confirmed: amend R-V7 for the Model mix panel only, ten
colours).

## What exists today

- `src/fixtures/data/models.json` — seven models, three vendors, tiers 2/2/3; `family` carries
  the vendor line ("Claude Sonnet", "OpenAI GPT-6 Astra"). `rate_cards.json` token card with
  uniform derivation (cache read 0.1×, cache write 1.25×, output 5× of input). ADR-0007 pins
  the roster and the real 200× input spread (`gpt-6-astra` 10.00 vs `gpt-5-nano` 0.05).
- `targets.mts` — `TIER_TOKEN_SHARE` 55/30/15, `FRONTIER_SHARE_BY_MONTH` 25% → 10%,
  `MODEL_WEIGHT_WITHIN_TIER`, `MULTI_MODEL_SHARE` 0.4. R-D16 (derived invariant: frontier
  carries the most token spend on the smallest token share), R-D17 (frontier falls).
- Committed monthly family shares are flat: Sonnet ~30%, Gemini Pro ~22%, Haiku ~10% every month.
- `src/domain/series.ts` — `CHART_COLOR_VARS` (five), `SERIES_LIMIT` derived from it; R-V5 ranks
  and caps at top 4 + Other. `globals.css` `--chart-1..5` light and dark.
- `src/data/queries/adoption.ts` — `ModelMixPanel` (chart shape `bar`, all three levels).

## Scope

1. **Roster** (`catalog.mts`, `models.json`, `rate_cards.json`), ten models. Prices are real
   first-party input rates, output and cache classes by the existing uniform derivation:

   | id | vendor | family | tier | input $/M |
   |---|---|---|---|---|
   | `claude-fable-5-1` | Anthropic | Claude Fable | frontier | 10.00 |
   | `claude-opus-5` | Anthropic | Claude Opus | frontier | 5.00 |
   | `claude-sonnet-5` | Anthropic | Claude Sonnet | balanced | 2.00 |
   | `claude-sonnet-4-6` | Anthropic | Claude Sonnet | balanced | 3.00 |
   | `claude-haiku-4-5` | Anthropic | Claude Haiku | fast | 1.00 |
   | `gpt-6-astra` | OpenAI | OpenAI GPT-6 Astra | frontier | 10.00 |
   | `gpt-5-2` | OpenAI | OpenAI GPT-5 | balanced | *verify* |
   | `gpt-5-nano` | OpenAI | OpenAI GPT-5 | fast | 0.05 |
   | `gemini-3.1-pro-preview` | Google | Gemini Pro | balanced | 2.00 |
   | `gemini-3.5-flash-lite` | Google | Gemini Flash-Lite | fast | 0.30 |

   Check `gpt-5-2`'s id and price against OpenAI's current list the way ADR-0007 did, and record
   the check in a new ADR-0011 that amends 0007 (roster grows; the 200× spread still holds: Fable
   and Astra 10.00 against nano 0.05). Families are the vendor line across versions, which is
   why Sonnet 4.6 and 5 share one and GPT-5 nano and GPT-5.2 share one — that is the "existing
   naming approach" applied.
2. **Presence by month** — replace `FRONTIER_SHARE_BY_MONTH` with `FAMILY_SHARE_BY_MONTH`
   (Apr … Sep, share of tokens, rows sum to 1), authored to these stories and asserted ±2 points:
   - Claude Haiku: 28, 26, 22, 16, 12, 10.
   - Claude Sonnet: 24, 26, 28, 30, 30, 30 (within it, Sonnet 4.6 : Sonnet 5 goes 70:30 in
     April to 5:95 in September).
   - Claude Opus: 6, 6, 6, 5, 5, 5. Claude Fable: 0, 0, 2, 6, 10, 13.
   - OpenAI GPT-5 (nano + 5.2): 26, 25, 24, 22, 20, 18. GPT-6 Astra: 6, 7, 8, 10, 12, 13.
   - Gemini Pro + Flash-Lite: 10 every month, Pro : Flash-Lite 60:40.
   Vendor totals over the window: Anthropic ≈ 60%, OpenAI ≈ 30%, Google ≈ 10% — assert ±3 points.
   Keep `MULTI_MODEL_SHARE`. Delete `TIER_TOKEN_SHARE` as a target; **derive** the tier shares
   and keep R-D16's invariant as an assertion (frontier: Opus + Fable + Astra ≈ 12–30% of tokens,
   rising, and still the largest token spend). R-D17 is rewritten: frontier *rises* late in the
   window as Fable and Astra arrive; the optimisation story moves to Haiku's fade.
3. **Chart.** The Model mix panel becomes a **line chart of share over time**: one line per
   series at the chosen level (exact: 10, family: 7, tier: 3), y-axis 0–100%, page grain buckets,
   `stackable: false`; the levels table stays. R-V5's cap for this chart is the new palette's
   length, so nothing is folded into Other at any level.
4. **Palette.** Add `MODEL_MIX_COLOR_VARS` (`--model-1..10`) in `series.ts`, and a
   `paletteFor(chart)` seam so `seriesViewModel` takes the palette as an argument; every other
   chart keeps `CHART_COLOR_VARS`. Colours: vendor-hued — Anthropic in five warm steps
   (terracotta → ochre), OpenAI in three cool steps (navy → teal), Google two greens — with
   light and dark values. **Load the `dataviz` skill before picking values** and run its palette
   validator for contrast in both themes; keep the swatch SVG integer-only (T-E4).
5. **Spec.** R-V7 amended: "The five-colour palette is never extended **for comparison charts**;
   the Model mix panel, where the series set is a closed roster, carries its own ten-colour
   palette, capped at the roster." R-D16/R-D17 rewritten as above; R-M7 unchanged (still a
   breakdown, never an axis). CONTEXT.md § Models & Money roster table; ADR-0011.

## Done when

- Generator asserts the monthly family table, the vendor split and the R-D16 derived invariant.
- Unit: `seriesViewModel` with the mix palette emits ten distinct `colorVar`s and no Other;
  with the shared palette still caps at five (existing tests unchanged).
- e2e: Model mix legend on `/demo/spend` at exact level lists ten models; Haiku's September
  share reads ≤ 12% in the table mirror; screenshot in light and dark attached to the ticket.
- All six gates green.
