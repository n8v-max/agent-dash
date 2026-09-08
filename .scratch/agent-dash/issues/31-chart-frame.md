Type: implementation
Status: resolved
Blocked by: 30
Label: resolved

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

### 2026-09-08 — T-E4 will start failing on decimals when charts land (from ticket 30, wave 7)

**Read this before rendering a chart. It is the one thing likely to stop wave 9 being green.**

T-E4's cost assertion scans the **raw response payload** for the fixture's ungranted cost literals.
Any decimal anywhere in that payload can collide with one. Ticket 30 hit this in ordinary shell
work: a Tailwind class of `py-1.5` matched a real ungranted cost of `1.5`, and T-E4 failed on a page
that had leaked nothing at all.

Ticket 30 fixed it **without touching the test** — every decimal was removed from the shell's
Tailwind classes (integer spacing, `text-[11px]`, `calc(100%+8px)`). That works for CSS classes.
**It will not work for charts.** Recharts emits decimal path coordinates, viewBox values, tick
offsets and transforms by the dozen, and those cannot be authored away.

**Do not weaken T-E4 to a DOM query.** `testing-spec.md` § 10 is explicit that doing so makes the
product's central privacy claim untested while appearing tested, and ticket 29 demonstrated the
difference empirically: a probe leaking a name and a cost inside a `hidden` section failed T-E4 and
**passed** a `not.toBeVisible()` check.

**Refine the exclusion, do not relax the claim.** The defensible direction is to keep scanning the
whole payload but subtract the contexts that cannot carry a leaked figure — SVG geometry attributes
(`d`, `points`, `viewBox`, `transform`, `x`/`y`/`cx`/`cy`/`r`/`width`/`height`), `class`/`className`
values, and inline `style`. A cost that has actually leaked arrives either as a raw number in the
RSC props or as rendered text, and both survive that subtraction. Note the opposite temptation —
requiring costs to look like formatted currency (`$24.39`) — **is** a weakening: the RSC flight
payload carries raw props, so a leaked `24.39` would never match.

Whatever is chosen, keep ticket 29's two properties: the **positive control** (the payload does
contain the viewer's *own* name, so the negatives cannot pass vacuously) and the **non-emptiness
guards** on the search sets. And re-run ticket 29's falsification probe afterwards — render a
name and a cost in a `hidden` section and confirm T-E4 still fails — because an exclusion list is
exactly the kind of change that can quietly make an assertion unable to fire.

### 2026-09-08 — T-E4 measured, and the predicted decimal hazard does not exist

**The premise of the note above is wrong on this stack, and the remedy it proposes would have
removed nothing.** Recorded rather than re-decided: T-E4 is unchanged and green.

Measured with **ten `ChartFrame`s** — all five shapes, twice — temporarily rendered on
`/[org]/spend` and `/[org]/work` against real query output, in a **production build**
(`next build` + `next start`, which is what CI runs). The probes were reverted afterwards.

- `hasSvg: false`, `hasPath: false` on **both** routes. **Recharts emits no SVG into the response
  payload at all.** Recharts 3 delivers the chart's width and height to its store from a
  `useEffect` (`chartLayoutContext.js`), effects do not run during SSR, so `MainChartSurface`
  returns `null` and the entire chart — surface, paths, ticks, transforms, legend — exists only
  after hydration. T-E4 reads response bodies (`page.goto().text()` plus a raw `RSC: 1` fetch),
  never the hydrated DOM. **There are no chart geometry decimals in the payload to collide with
  anything.**
- Of the decimals T-E4 *did* flag, **zero** sat in any context the note proposed subtracting —
  SVG geometry attributes, `class`/`className`, inline `style`. The proposed exclusion would have
  been pure loss of coverage.

**The real hazard is different, and it is not about charts.** The 15 values flagged on
`/demo/spend` were all `<td>` cells of the R-X1 **mirror**: the viewer's **own** weekly cost
aggregates (verified — the Repository chart's series sum equals the viewer's own session total
exactly, 746.41, so the access model is correct), coinciding by value with *other* Members'
individual session-cost literals. `ungrantedCostLiterals` holds **443** distinct two-decimal
literals in a narrow money range, so **any page that renders a money figure at 2dp has a high
chance of tripping T-E4 whether or not it leaked anything** — chart or table, mirror or tile.
T-E4 has been green only because no page renders money yet. **Wave 9 hits this on its first
panel, and it is a question about T-E4's construction, not about the panels.** Left for whoever
owns `testing-spec.md` § 5; nothing here re-decides it.

**Ticket 29's falsification probe was re-run with the ten charts present**, in the same production
build: a Member name and an ungranted cost rendered inside a `<section hidden>` on `/[org]/work`.
Both assertions failed — `["Nuria Castells Vidal"]` and `["2.44"]` — so T-E4 still fires, and the
charts do not mask it. Probe reverted.

### 2026-09-08 — two smaller notes from the same wave

**Ticket 18's recorded patch-3 diff does not typecheck as written.**
`key={item.dataKey ?? item.name ?? index}` fails `TS2322`: Recharts 3 types `dataKey` as
`string | number | ((obj) => unknown)`, and a function is not a `React.Key`. Applied as
`key={String(item.dataKey ?? item.name ?? index)}` — the minimal change that keeps the stable
identity. The legend site is exactly as recorded (`key={key}`, and the now-unused `index`
binding removed).

**The `base-nova` chart palette is a monochrome ramp, and it reads badly for categorical series.**
`--chart-1` is `oklch(0.87 0 0)` against a `--background` of `oklch(1 0 0)` — roughly 1.2:1 — and
it is the variable `series.ts` assigns to the *top-ranked* series. Five greys are also not
categorically distinguishable, which is the one job a series palette has. R-V7 caps the palette at
**five**; it says nothing about their hues, so redefining the five values in `globals.css` is
permitted and would not extend anything. Not done here: the charts are not on a page yet, no
component hard-codes a colour (every mark reads `var(--color-<key>)` off the `ChartConfig`), so
this stays a one-file change for whoever owns the panels' visual pass. Recorded, not re-decided.

### 2026-09-08 — implemented (AFK build, wave 8)

All six gates green. `ChartFrame` carries R-T28's four responsibilities and nothing else; the five
shapes are built from the ViewModel.

**T-C3 was written first and failed against the pristine vendored component**, exactly as ticket
18's spike predicted:

```
AssertionError: expected [ <div …(1)>…(1)</div>, …(3) ] to deeply equal []
+ [ "Platform", "Data", "Mobile", "Infrastructure" ]
```

All four surviving legend entries were **the same DOM node objects** that had been Member names —
React reconciled Members into Teams in place. Patch 3 then applied at both sites. Ticket 18's
recorded tooltip diff needed one change to typecheck: Recharts 3 types `dataKey` as possibly a
function, which is not a `React.Key`, so it is `String()`-wrapped. The legend site is exactly as
recorded.

**T-C11** is table-driven over all eleven groupings and typed as a total `Record<Grouping, boolean>`,
so a new domain grouping fails to compile until someone decides its geometry. Two static assertions
back it: **no `Pie` in any module including the vendored `chart.tsx`**, and **every `stackId` in the
chart modules is the one `stackIdOf` produces** — so a panel cannot reach around the rule.

**Fixed dimensions without a `ResizeObserver` polyfill**: given two fixed numbers Recharts skips its
size detector entirely, and `ChartContainer`'s inner `ResponsiveContainer` sees a positive context
and passes children through, so `initialDimension` is never consulted. The absence of the polyfill
is asserted, since T-C0 makes it the alarm.

**The predicted T-E4 chart-decimal hazard does not exist on this stack, and that was measured
rather than assumed.** Recharts 3 sizes from an effect, so no SVG reaches the response payload at
all — ten `ChartFrame`s mounted on two routes in a production build produced `hasSvg: false`. The
exclusion the ticket proposed would have removed nothing and only narrowed the assertion, so it was
not made. The falsification probe was re-run with the charts mounted and T-E4 still fires.

Two follow-ups landed on `main` afterwards, both found by wave 9: `measureDomain` on `ChartFrame`
(R-N13's shared axis was not actually honoured), and the Model-mix series key fix. One gap
recorded and not closed: `ChartFrame` has no way to express "no axis labels at tile size" (R-N8),
which ticket 32 worked around with arbitrary variants from its own panel.
