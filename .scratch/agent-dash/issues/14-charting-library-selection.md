Type: grilling
Status: resolved
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

## Answer

Resolved by the human, 2026-09-05.

**shadcn/ui charts on Recharts 3.** Observable Plot is not selected.

### Which axis decided it

**Stack coherence and schedule** — the researcher's stated axis, taken as stated. Vendored MIT
source owned outright, React 19 a declared peer, Tailwind-native, and `ChartConfig` as a plain
runtime `Record` so dynamic series need no ceremony. This is a Next.js + shadcn take-home with a
deadline; a chart layer that argues with the rest of the stack costs more than Plot's modelling
advantages return.

Recorded honestly: this means Plot's genuine wins were **traded away, not refuted**. Plot's
one-accessor re-grouping makes stale series structurally impossible, which is exactly the failure
mode a roll-up switch invites; its 67 KB gzipped was the lightest measured; and its
Vitest 4 + jsdom 29 self-testing was the strongest testability evidence of any candidate. Those
are now costs this project carries rather than problems it avoided. See *Consequences* below.

### Follow-on decisions

**1. Palette ceiling — raised up front, by capping cardinality rather than extending the theme.**

Visible series are capped at **top-N + "Other"**. The `--chart-1..5` ceiling is therefore never
reached, so no `--chart-6..N` values are defined and no OKLCH generation is written.

The reasoning is that this is the better chart independently of the bug: categorical palettes run
out of distinguishable hues around 10–12, so a 20-series "group by Member" roll-up is unreadable
whether or not it is coloured. Extending the theme would have made a bad chart render instead of
making it a good chart. The silent-failure mode (`ChartStyle` filters out config entries with no
colour, so series #6 emits no `--color-<key>` and renders transparent with no error) is closed by
construction — nothing can ask for a sixth colour.

*Open consequence for 05/07:* "top-N" needs a value and a rule. What N is, whether it is fixed or
per-chart, how "Other" behaves on click, and whether the cap is a hard rule or a default the
viewer can override are **not settled here** — they are metric-set and IA questions. What is
settled is that a cap exists and that the palette is not extended past five.

**2. Day-one patches — deferred to encounter, with one exception that cannot be deferred.**

Patches 2 (stale `.recharts-cartesian-axis-tick_text` selector), 3 (`key={index}` legend keys) and
4 (blank-mount guard, [#8547](https://github.com/shadcn-ui/ui/issues/8547)) are **applied on
encounter**, not at setup. Accepted cost: two of the three fail silently rather than loudly.

**Patch 1 is not an on-encounter item and is recorded as a setup constraint.** "Scaffold from a
`v4` or `base-*` style" is a `components.json` decision at init; there is no later moment at which
it is encountered. The legacy `default` / `new-york` styles pin **`recharts@2.15.4`, npm-marked
deprecated** — the same dead 2.x branch that disqualified Tremor in ticket 04. Landing there would
silently reverse this ticket's decision. **The spec must state the `v4`/`base-*` scaffold and the
resulting `recharts@3.8.0` pin as a hard requirement.**

Two further setup-time facts are recorded alongside it, being properties of the initial install
rather than defects to encounter:

- **Turbopack, not webpack.** Both open Next 15 blockers against Recharts 3
  ([#6117](https://github.com/recharts/recharts/issues/6117),
  [#6316](https://github.com/recharts/recharts/issues/6316)) are webpack-specific; the #6117
  reporter states plainly that Turbopack works. Choosing the bundler is choosing whether this
  entire risk class exists.
- **No React 19 override.** shadcn's own React 19 page still advises a `package.json` override and
  `--legacy-peer-deps` for Recharts. That advice is stale — written for 2.x. Recharts 3.x declares
  `react: ^19.0.0` as a real peer.

**3. Accessibility — a genuine requirement, not a tiebreaker.**

Beyond Recharts 3's default `accessibilityLayer` (`role="application"`, arrow-key navigation,
`role="status"` tooltip), two additions are in scope:

- A chart-level `aria-label` naming the **current roll-up level**, since the container is a plain
  `<div>` and the roll-up level is the one piece of state a screen-reader user cannot otherwise
  recover.
- A **visually-hidden `<table>` mirror** of the grouped data.

The table mirror is load-bearing twice over. It is the best screen-reader affordance available
here, and it is simultaneously the most robust assertion target in the test suite — it converts
chart output from "not queryable" into a plain DOM table. That is a direct input to ticket 09's
question of whether chart *output* is asserted or only chart *presence*: with a table mirror, the
answer can be output, without needing to parse SVG.

### Consequences carried forward

- **The roll-up spike is now the cheapest available risk reduction.** Ticket 04 named it the
  highest-value cheap experiment in the brief: flip one chart between 20 and 4 series and watch
  the legend re-derive. Plot's accessor model would have removed this bug class structurally; this
  choice keeps it. Not run here — plan-don't-do is in force — but it belongs in the technical spec
  as an early build step, and it is the specific thing that would falsify this decision.
- **Legend identity across a roll-up switch needs a test regardless of patch timing.** With
  patch 3 deferred, `key={index}` is live: React will reconcile "Team A" into "Team B" in place.
  Ticket 09 already holds `getAllByLabelText(/legend icon/)` as the handle for "did the series set
  actually change"; a test pinning legend *identity* across a switch is what turns the deferred
  patch from a silent bug into a caught one.
- **Do not build the test suite on `initialDimension`.** shadcn's `{width: 320, height: 200}` is
  why its charts render in bare jsdom at all — but a `ResizeObserver` polyfill in
  `vitest.setup.ts` (extremely common boilerplate) makes the resize effect run,
  `getBoundingClientRect()` return 0×0, and the chart vanish. Fixed numeric `width`/`height`
  is the robust path. Ticket 09 owns the decision; this ticket records that the fragile path
  fails confusingly.
- **Two mechanical caveats on runtime-computed `ChartConfig`**, both consequences of choosing
  dynamic series: `--color-${key}` interpolates the key **raw** into a CSS custom-property name,
  so group ids must be slugified (a team named `Ops / EU` emits `--color-Ops / EU`); and
  `ChartStyle` is a `dangerouslySetInnerHTML` sink, so colour values must never be
  user-controlled strings.
- **Registry churn is live.** As of [#11758](https://github.com/shadcn-ui/ui/pull/11758)
  (2026-09-04) `cn` moved out of `@/lib/utils` into a published `cn` package, so `chart.tsx` now
  opens with `import { cn } from "cn"`. Tutorials written a week ago will not match.
- **Aggregation stays server-side.** `chart.tsx` is `"use client"`, but that is not a real
  constraint: aggregation, roll-up and permission filtering are pure functions over fixture rows
  and belong in a Server Component, passing a small serialised result to a thin client chart.
  The seam matters more than the library — ticket 09.

---

## Amendment — 2026-09-07: the stack moved to Next 16

Recorded when the app was scaffolded (commit `69dad0c`), after this ticket resolved.

**This ticket's Turbopack requirement is unchanged in substance and satisfied by default.**
It was written against Next **15**, where Turbopack is opt-in and both open Recharts 3
blockers ([#6117](https://github.com/recharts/recharts/issues/6117),
[#6316](https://github.com/recharts/recharts/issues/6316)) are webpack-specific. Next
**16.3.4** makes Turbopack the stable default bundler for dev and build; webpack is now the
opt-in path (`next build --webpack`). The risk class this ticket set out to avoid no longer
depends on remembering a flag.

**Verified, not assumed.** A Recharts `3.10.1` `BarChart` on a real route compiled and
prerendered clean under `next build` on 16.3.4. The first build attempt used `src/app/_smoke/`
and proved nothing — Next treats `_`-prefixed directories as private and never routed it.
Re-run at `src/app/smoke/` it appeared in the route table and passed. Route since removed.

**Recharts is installed at `3.10.1`, not the `3.8.0` this ticket names.** That figure was the
version the shadcn `v4`/`base-*` scaffold pinned at the time of writing. The hard requirement
here is the **scaffold style**, not the version number: the legacy `default`/`new-york` styles
still pin the deprecated `recharts@2.15.4`, and landing there would silently reverse this
ticket. `components.json` has not been created yet — that requirement passes to whoever runs
`shadcn init`.

**Costs the bump carries, none of which touch this ticket:** `next lint` is removed (ESLint is
invoked directly, which lands in ticket 09's territory), `middleware.ts` is renamed `proxy.ts`,
`params`/`cookies`/`headers` are async-only, and several `next/image` defaults changed.
