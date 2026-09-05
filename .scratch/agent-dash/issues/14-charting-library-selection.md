Type: grilling
Status: open
Label: wayfinder:grilling

# Charting library selection

## Question

shadcn/ui charts on Recharts 3, or Observable Plot?

## Why this exists

Graduated from ticket 04 on 2026-09-05. That ticket disqualified Tremor and ECharts on
one-sided evidence and correctly declined to settle the remainder, which is a judgement call
rather than a fact.

## The trade-off, as researched

**shadcn/ui charts on Recharts 3** — the researcher's recommendation, on stack coherence and
schedule:

- MIT, vendored source you own outright, 15 releases in 12 months, React 19 a declared peer.
- `ChartConfig` is a plain runtime `Record`, so dynamic series need no ceremony.
- `accessibilityLayer` defaults on: `role="application"`, arrow-key navigation,
  `role="status"` tooltip.
- Four day-one patches are documented, including the `key={index}` legend bug and the
  `--chart-1..5` palette — a hard ceiling of five that **fails silently at series #6**, which
  matters for a product whose whole point is switching to dimensions of arbitrary cardinality.
- Requires Turbopack: both open Next 15 blockers against Recharts 3 are webpack-specific.

**Observable Plot** — better on the axes this project actually stresses:

- One-accessor re-grouping; stale series structurally impossible, which is the failure mode a
  roll-up switch invites.
- Strongest testability evidence of any candidate — self-tested on Vitest 4 + jsdom 29, with a
  copyable `getBBox` stub.
- Lightest bundle measured, 67 KB gzipped.
- Against: **zero releases in 18.7 months** while features accumulate on `main`; bus factor 2;
  imperative API; no keyboard navigation; and its React SSR path depends on a `toHyperScript()`
  shim **this project would have to write and maintain**.

## What has to come out of it

- The choice, and which axis decided it — coherence and schedule, or modelling fit and bundle.
- If shadcn: whether the five-colour palette ceiling is raised up front or left to fail later,
  and whether the four documented patches are applied at setup or on encounter.
- If Plot: who owns the `toHyperScript()` shim and the accessibility gap, both of which are
  real recurring costs rather than one-time ones.
- Whether the accessibility difference is a genuine requirement here or a tiebreaker.

## Feeds

09 (the testing seam differs between them) and the eventual technical spec.
