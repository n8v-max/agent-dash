Type: implementation
Status: ready-for-agent
Blocked by: 30
Label: ready-for-agent

# ChartFrame: the table mirror, accessibility, and series identity

## Goal

One `ChartFrame` wrapping every chart in the product, plus the five chart shapes the panels need.

## Scope

**`ChartFrame` is responsible for exactly four things** (R-T28), and no panel does any of them
itself:

1. An **`aria-label` naming the current roll-up level** (R-X2). The container is a plain `<div>`,
   and the roll-up level is the one piece of state a screen-reader user cannot otherwise recover.
2. Recharts' **`accessibilityLayer`** (R-X3) — `role="application"`, arrow-key navigation,
   `role="status"` tooltip.
3. Rendering the ViewModel's `mirror` as a **visually-hidden `<table>`** (R-X1).
4. The **empty fallback** — plain "no data for this selection" text, with shell, navigation and
   controls still present (R-V9).

**The mirror is a product requirement, not a test affordance.** It is the best screen-reader
affordance available here. That it is simultaneously the most robust assertion target in the suite —
converting chart output from "not queryable" into a plain DOM table — is why chart *output* can be
asserted at all without parsing SVG.

**Other requirements:**

- **`ChartConfig` is built from the ViewModel's series** (R-T30), so config and rendered series
  cannot drift.
- **Charts under test render at fixed numeric `width`/`height`, never `initialDimension`** (R-T29,
  T-C0). This settles the one item ticket 09 left genuinely open: `initialDimension`'s advantage
  evaporates the moment a `ResizeObserver` polyfill lands in `vitest.setup.ts`, and the resulting
  failure is **confusing rather than loud**. Do not add a `ResizeObserver` polyfill.
- **No stacking and no pie charts, anywhere** (R-V1, R-V2). Stacking encodes a partition; Team is
  not one, and no caption can undo a false claim made by the geometry.
- Day-one patches 2, 3 and 4 apply **on encounter** (R-T32), informed by ticket 18's finding.

## Done when

**T-C0, T-C1, T-C2, T-C3, T-C10, T-C11** pass.

## Notes

**T-C3 is the most valuable component test in the suite.** shadcn's default legend uses
`key={index}`; with it live, React reconciles "Team A" into "Team B" in place — the DOM node
persists, the colour persists, the label changes, nothing errors. It is a silent wrong-colour bug on
the product's central interaction. Write T-C3 **before** applying patch 3, and it must fail if
`key={index}` is ever reintroduced.

T-C11 asserts an absence across the codebase (no `stackId`, no pie import) — that is a static
assertion over the chart modules, because a rendering test cannot prove an absence.
