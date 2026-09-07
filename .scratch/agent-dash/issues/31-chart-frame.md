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

## Comments

### 2026-09-07 — inherited from ticket 18 (AFK build, wave 1)

**Patch 3 is now this ticket's, and the decision is "apply", not "defer".** Ticket 18 ran the
spike and found the `key={index}` reconciliation is real but **silent** — the legend reuses the
same DOM nodes across a roll-up switch, yet label and colour both update correctly, so nothing
will ever surface it on encounter. It also found that `react/no-array-index-key` (made an error by
ticket 17) **cannot** catch it, because ticket 17 global-ignores `src/components/ui/**` as
vendored. Read ticket 18's Answer before writing T-C3; the exact two-site diff is recorded there,
and the spike is on branch `prototype/18-rollup-spike` (`c378fc9`).

Sequencing per the ticket: write T-C3 first, watch it fail against the unpatched component, then
patch. Both `ChartLegendContent` (line ~306) and `ChartTooltipContent` (line ~208) carry
`key={index}` — the ticket assumed one site.

**`ChartContainer` passes `initialDimension` to `ResponsiveContainer`.** This is the R-T29 / T-C0
construct, present in the vendored file the moment `shadcn add chart` runs. `ChartFrame` needs
fixed numeric `width`/`height` under test, so it must either bypass `ChartContainer` for the
Recharts element or give it an explicit dimension escape hatch. Still no `ResizeObserver` polyfill
in `vitest.setup.ts` — T-C0 makes its absence the alarm.

**Patch 2 needs no work.** `[&_.recharts-cartesian-axis-tick_text]` is Tailwind arbitrary-variant
syntax in which `_` is a space, so it compiles to the descendant selector
`.recharts-cartesian-axis-tick text`, not to a stale class name. Recorded so nobody "fixes" it.

### Scope defect — this ticket's stacking line is stale

The Scope above says **"No stacking and no pie charts, anywhere (R-V1, R-V2)"**, and the Notes say
T-C11 asserts "no `stackId`". Both were written against ticket 10's blanket ban, which the specs
have since superseded and which is recorded as a resolved conflict:

- `spec.md` R-V1 is **"Stacking asserts a partition, so stack only partitions"**, and § 11 C8
  records the narrowing explicitly. WorkType, Model tier/family, execution mode and the three
  duration spans **are** partitions and stack legitimately.
- Two shipped panels depend on that: R-N8's fourth summary tile (stacked area by WorkType) and
  R-N12 panel 6 (the stacked human-presence composition).
- `testing-spec.md` T-C11 says a blanket `no stackId` assertion "would have been easier and would
  have forbidden two legitimate part-to-whole panels", and specifies a **table-driven** assertion
  instead: a chart stacks if and only if its ViewModel carries `stackable: true`, and a
  Team-grouped ViewModel asserting `stackable: true` is itself a failure.

**The specs are the fixed point** (AFK handover § 8), so implement R-V1 and T-C11 as the specs
state them, not as this ticket's Scope line does. Only the pie half of the absence assertion is a
static "nothing imports this" check; the stacking half is the table-driven test. Recorded rather
than re-decided.
