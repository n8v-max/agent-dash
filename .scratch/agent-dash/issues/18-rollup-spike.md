Type: implementation
Status: resolved
Blocked by: 17
Label: resolved

# Roll-up spike — the falsification test for the charting decision

**Throwaway. Runs before any panel is built.** Ticket 14 names this "the cheapest available risk
reduction" and "the specific thing that would falsify this decision" (R-T31).

## Goal

Flip one shadcn/Recharts chart between 20 series and 4 series and watch the legend re-derive.
Establish, before the product depends on it, whether series identity survives a roll-up switch.

## Why it exists

Ticket 14 chose shadcn/Recharts 3 over Observable Plot on stack coherence and schedule, and
recorded honestly that **Plot's wins were traded away, not refuted**. Plot's one-accessor
re-grouping makes stale series structurally impossible — exactly the failure a roll-up switch
invites. This choice keeps that bug class, and this spike is the cost being paid down early.

The concrete hazard: shadcn's default legend uses `key={index}`, and ticket 14 deferred that patch
to encounter. With `key={index}` live, **React reconciles "Team A" into "Team B" in place** — the
DOM node persists, the colour persists, the label changes, nothing errors.

## Scope

- One chart, hard-coded data, a button flipping 20 → 4 series.
- Observe: does the legend entry set change identity, or only length? Do colours follow labels?
- Record what happens in this ticket's Answer, including whether patch 3 (`key={index}`) needs
  applying now rather than on encounter.
- Delete the spike. Its output is a finding and a decision, not code.

## Done when

The finding is written here, and either patch 3 is applied or the decision to defer it is
re-affirmed with the observed evidence behind it.

## Notes

Do not skip this because T-C3 will catch the bug later. T-C3 catches it in a component the product
depends on; this catches it while the charting decision is still cheap to reverse.

## Answer

**Ran 2026-09-07 (AFK build, wave 1) on `prototype/18-rollup-spike` (`c378fc9`).** The spike is
kept on that branch as the primary source and is deliberately not merged; `src/spike/` does not
exist on `main`. Ticket 31 points at it.

Both observations were run as tests rather than eyeballed, so the finding rests on measurement.

### What is actually in the vendored component

`key={index}` is live in shadcn 4.21.0's `src/components/ui/chart.tsx` at **two** sites, not one:
`ChartTooltipContent` (line 208) and `ChartLegendContent` (line 306). Ticket 14's patch 3 is
unapplied, as expected.

### Observation 1 — the legend across a 20 → 4 roll-up switch

```json
{ "beforeEntries": 20, "afterEntries": 4, "reusedNodes": 4, "firstNodeIdentical": true,
  "beforeLabels": ["Member 1", "Member 10", "Member 11", ...],
  "afterLabels":  ["Team A", "Team B", "Team C", "Team D"],
  "beforeSwatches": ["background-color: var(--color-member_1);", ...],
  "afterSwatches":  ["background-color: var(--color-team_a);", ...] }
```

**In-place reconciliation is confirmed.** `firstNodeIdentical: true`, and every one of the four
surviving entries is the *same DOM node object* it was before the flip. React did reconcile
"Member 1" into "Team A" in place, exactly as ticket 14 predicted.

**But the rendered output is correct.** The label and the colour both updated. This is the part
ticket 14 got wrong, and it is worth stating precisely: the predicted symptom — *"the DOM node
persists, the colour persists, the label changes"* — **does not occur** in this version of the
component. `ChartLegendContent` writes `itemConfig.label` as children and `item.color` as an
inline `background-color` on **every** render, so React updates both attributes even while reusing
the node. There is no uncontrolled state on those nodes for the stale key to strand.

### Observation 2 — does the reuse reach the series themselves?

Same 20 → 4 switch, `<Bar>` elements keyed by array index against keyed by `dataKey`:

```json
{ "keying": "index",   "beforeN": 20, "afterN": 4, "after": ["#777777","#111111","#222222","#333333"] }
{ "keying": "dataKey", "beforeN": 20, "afterN": 4, "after": ["#777777","#111111","#222222","#333333"] }
```

Byte-identical. Recharts derives fill and geometry from `dataKey` on each render, so index keying
does not corrupt series output either — with animation disabled. **With animation enabled the
question is unresolved rather than cleared**: jsdom produces no path geometry mid-transition, so
both keyings returned `null` and the spike cannot see whether Recharts interpolates from the
previous series' geometry. That is the one residual, and it is the case a human looking at a real
browser would catch in a second.

### The finding

**The bug class is real but currently latent, and latency is the problem.** Everything the legend
renders today is a controlled attribute, so the stale key strands nothing and the output is right.
It stops being right the moment any legend entry carries state React preserves across reuse — an
`itemConfig.icon` component with internal state (the config type already permits one), a CSS
transition on the swatch, focus, or the unresolved animation case above.

### Decision: apply patch 3, do not defer it

The ticket allows either. **Applied**, on this evidence, and against R-T32's default of patching on
encounter. Three reasons, in order of weight:

1. **There is no encounter.** R-T32 defers patches that announce themselves. This one does not:
   the output is correct today, so nothing will ever surface it. A silent latent defect is not
   deferred, it is inherited — and ticket 14 already flagged that two of the three deferred
   patches fail silently.
2. **Lint cannot catch it.** Ticket 17 made `react/no-array-index-key` an error, but it also
   global-ignores `src/components/ui/**` because shadcn primitives are vendored rather than
   authored. `chart.tsx` is precisely there. The rule that exists to catch this bug class does not
   cover the one file in the repo that currently commits it. **This is the load-bearing point** and
   it was not visible before ticket 17 landed.
3. **T-C3 would otherwise pin the bug.** `testing-spec.md` says T-C3 "is written before the patch
   and must fail if `key={index}` is reintroduced". Against an unpatched `chart.tsx` that test
   either fails on day one and blocks wave 9, or gets written to assert index-keyed behaviour —
   which pins the defect instead of catching it.

**The patch is bound to ticket 31**, not applied here, because `src/components/ui/chart.tsx` does
not exist on `main` yet — ticket 31 creates it. Applying it on this throwaway branch would put it
somewhere that never merges. Ticket 31 now carries the exact change:

```diff
--- ChartLegendContent, line ~306
-              key={index}
+              key={key}
--- ChartTooltipContent, line ~208
-              key={index}
+              key={item.dataKey ?? item.name ?? index}
```

`key` in the legend is already computed one line above as
`` `${nameKey ?? item.dataKey ?? "value"}` `` — the stable identity is in scope and simply is not
used. Once patched, the `.map((item, index) =>` binding in the legend is unused and should go.

### Two further findings for ticket 31, observed while here

- **`ChartContainer` wraps `ResponsiveContainer` and passes `initialDimension`** (default
  `320×200`). This is the exact construct R-T29 and T-C0 rule out for charts under test. Ticket 31
  needs `ChartFrame` to render at fixed numeric `width`/`height` in tests, which means either not
  routing test renders through `ChartContainer` or giving it an escape hatch. Do not add a
  `ResizeObserver` polyfill to `vitest.setup.ts` — T-C0 makes its absence the alarm.
- **Patch 2 is a false alarm.** The selector `[&_.recharts-cartesian-axis-tick_text]` is Tailwind
  arbitrary-variant syntax where `_` is a space, so it compiles to
  `.recharts-cartesian-axis-tick text` — a descendant selector, not the stale
  `..._text` class name it looks like. Nothing to patch. Worth recording so a later reader does
  not "fix" it.
