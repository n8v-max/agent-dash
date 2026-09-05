# Charting library fit

Research brief for `.scratch/agent-dash/issues/04-charting-library-fit.md` (`wayfinder:research`).

**Researched:** 2026-09-05. Library health is time-sensitive; every claim below is dated.
**Method:** primary sources only — GitHub REST API (repo metadata, commits, releases, issue
threads), the npm registry packuments, and library source files read directly out of their
repos. Marketing pages were not used for any health claim.

---

## The constraint that decides this

`CONTEXT.md` § Aggregation Dimensions: every dimension carries **roll-up levels**, and selecting
a level is "a user-facing control, not a schema choice".

| Dimension | Roll-up levels |
|---|---|
| Member | Member → Team → Organization |
| Model | exact model → family → tier |
| Repository | repository → work domain |
| AgentTemplate | template → kind |

So one chart must survive the user flipping from ~20 Members to ~4 Teams to 1 Org — the
**number of series, their keys, their colours and their legend entries all change at runtime**.
The chart is a function of `(rows, groupBy)`, not a fixed set of `<Line dataKey="...">`.

### Is anything disqualified on that axis?

**No.** This was the ticket's explicit disqualification test, and every candidate passes it.
None of the six forces a chart-per-grouping structure. They differ only in *how much ceremony*
the re-grouping costs:

| Library | How series are declared | Runtime-dynamic? |
|---|---|---|
| Tremor (npm + Raw) | `categories: string[]` prop | Native — pass a different array |
| Nivo | `keys: string[]` prop | Native — pass a different array |
| Recharts / shadcn | children: `series.map(k => <Area dataKey={k}/>)` | Yes — children are just React |
| ECharts | `series: [...]` array in `setOption` | Yes — rebuild the array |
| Observable Plot | `marks: [...]`, grouping is a channel accessor | Yes — **swap one function** |
| visx (`xychart`) | children: `series.map(k => <BarSeries dataKey={k}/>)` | Yes — children are just React |

The interesting differences are therefore elsewhere: **who is still maintaining the thing**,
whether it runs on React 19, and whether you can assert on its output in a test.

---

## TL;DR

1. **Tremor is not a viable choice for a project started in 2026.** This is not a close call.
   The npm package has had no release in ~20 months and its `peerDependencies` still exclude
   React 19; the copy-paste successor ("Tremor Raw") has had no substantive commit in ~17
   months and its React 19 upgrade PR has sat unreviewed since June 2026; and Tremor's own
   co-founder stated in August 2025 that "net-new development will be happening in shadcn/ui".
   Worst of all, the one open Tremor Raw chart bug that matters is *in the dynamic-categories
   code path* — exactly the code path this project depends on. Evidence one-sided → **drop it**.

2. **Recommended replacement: the shadcn/ui `chart` component over Recharts 3.** It is a ~370
   line vendored wrapper you own outright, MIT, over the most actively maintained React chart
   library in the ecosystem (57M weekly downloads, 15 releases in 12 months). Its `ChartConfig`
   is a plain runtime `Record`, so a config computed from the current roll-up level is the
   *intended* usage, not a hack; and Recharts 3 turned `accessibilityLayer` on by default, giving
   you `role="application"` + arrow-key data navigation + a `role="status"` tooltip live region
   with no work. **It is not free of day-one work** — see the four patches in
   [What to fix on day one](#what-to-fix-on-day-one).

3. **One genuine judgement call remains: Observable Plot.** Plot is a materially better *fit*
   for this specific requirement — swapping roll-up level is a one-accessor change rather than
   rebuilding a children array, and the stale-series class of bug is structurally impossible.
   Its testability evidence is also the strongest of any candidate: **Plot tests itself on
   Vitest 4 + jsdom 29**. But it is pre-1.0, has had **no stable release since 2025-02-14**
   while merged features pile up on `main`, has a bus factor of 2, and is imperative (a
   `useEffect` + `ref` escape hatch inside React). See
   [The one real trade-off](#the-one-real-trade-off) — this one is flagged for a human, and the
   flag is about *risk appetite and stack coherence*, not about capability.

4. **ECharts should be ruled out on operational grounds, not aesthetic ones.** Its React wrapper
   was compromised in a May 2026 npm supply-chain attack and the compromised artifacts are
   **still published today with no security advisory**; and there is an open, unanswered
   `Vitest: Unexpected token 'export'` bug against ECharts itself. visx and Nivo are both healthy
   and could do the job, but each buys a real cost for no gain here. Details below.

---

## Tremor: current state

### Timeline (all dates verified against primary sources)

| Date | Event | Source |
|---|---|---|
| 2024-05-20 | `[Bug]: Charts don't render in React 19 RC` filed against `@tremor/react`. Maintainer: *"Tremor currently requires React 18.2+. V19 is not supported."* | [tremor-npm#1054](https://github.com/tremorlabs/tremor-npm/issues/1054) |
| 2024-05-30 | `[Feature]: React 19 support` filed. **Still open as of 2026-09-05**, 22 reactions. | [tremor-npm#1072](https://github.com/tremorlabs/tremor-npm/issues/1072) |
| 2024-11-09 | Maintainer `severinlandolt`: *"Got recharts working, but to publish a working package version, need to update a few dependencies 🔨"* — never shipped. | [tremor-npm#1054](https://github.com/tremorlabs/tremor-npm/issues/1054#issuecomment) |
| 2024-12-14 | Last `4.0.0-beta-tremor-v4.4` prerelease. v4 never reached stable. | [npm packument](https://registry.npmjs.org/@tremor/react) |
| 2025-01-13 | **`@tremor/react@3.18.7` published. Last release to date.** Last commit to `tremor-npm` the same day. | [npm](https://registry.npmjs.org/@tremor/react), [tremor-npm commits](https://github.com/tremorlabs/tremor-npm/commits/main) |
| 2025-01-22 | Vercel acquires Tremor; founders join Vercel Design Engineering to work on the Vercel Dashboard and v0. | [vercel.com/blog/vercel-acquires-tremor](https://vercel.com/blog/vercel-acquires-tremor) |
| 2025-04-12 | Last **substantive** commit to `tremorlabs/tremor` (Tremor Raw): "BREAKING CHANGE: Update to tailwind v4". | [tremor commits](https://github.com/tremorlabs/tremor/commits/main) |
| 2025-05-12 | `Will Tremor continue to be supported post Vercel acquisition?` filed. Vercel's `leerob`: *"We'll have more news to share here soon 😄"*. **Still open as of 2026-09-05.** | [tremor#140](https://github.com/tremorlabs/tremor/issues/140) |
| 2025-08-07 | Tremor co-founder Christopher Kindl, on the Vercel community forum: **"You can continue to use our components and blocks, but net-new development will be happening in shadcn/ui."** | [community.vercel.com/t/tremor-shadcn-and-vercel/17242](https://community.vercel.com/t/tremor-shadcn-and-vercel/17242) |
| 2025-10-10 | Last commit of any kind to `tremorlabs/tremor` — housekeeping only ("Delete chromatic.yml", "rm storybook publish"). | [tremor commits](https://github.com/tremorlabs/tremor/commits/main) |
| 2026-06-11 | Outside contributor opens a full React 19 / Recharts 3 upgrade PR for Tremor Raw. **0 comments, unreviewed as of 2026-09-05.** | [tremor#166](https://github.com/tremorlabs/tremor/issues/166) |
| 2026-04-27 | Last comment on the "will it be supported" thread: *"Another dead project"*. | [tremor#140](https://github.com/tremorlabs/tremor/issues/140) |

### The v3 → Tremor Raw split, decoded

There are **two** Tremors, and both are stalled:

- **`@tremor/react` (the npm package)** — `tremorlabs/tremor-npm`, Apache-2.0, 16.5k stars,
  **63 open issues**, `pushed_at` **2025-01-13**. Latest `3.18.7`. Its declared
  `peerDependencies` are `{"react": "^18.0.0", "react-dom": ">=16.6.0"}` — **React 19 is not in
  the range**, so `npm install` on this project's stack fails without `--legacy-peer-deps` or an
  `overrides` block. It depends on `recharts@^2.13.3`, i.e. Recharts **2.x**, not 3.x.
  ([npm packument](https://registry.npmjs.org/@tremor/react), read 2026-09-05.)
  The docs site still says *"Tremor is designed for React and requires React v18.2.0+"* with no
  deprecation banner ([npm.tremor.so](https://npm.tremor.so/docs/getting-started/installation),
  2026-09-05) — which is the trap: nothing on the marketing surface tells you it is frozen.

- **Tremor Raw (the copy-paste components)** — `tremorlabs/tremor`, Apache-2.0, 3.6k stars, 26
  open issues, `pushed_at` **2025-10-10**. This is the shadcn-style "own the source" successor.
  Its `package.json` pins `react: ^18.3.1`, `@types/react: ^18.3.20`, `recharts: ^2.15.2` — so
  the *reference* implementation is still a React 18 / Recharts 2 codebase. The docs say
  *"Tremor Raw is designed for React v18.2.0+ and requires Tailwind CSS v4.0+"*
  ([tremor.so](https://tremor.so/docs/getting-started/installation), 2026-09-05) — again, no
  mention of React 19.

Because Tremor Raw is copy-paste, the React 19 peer-dep problem is not an *install* blocker for
it — you paste source, there is no peer range to violate. The problem is runtime bugs plus the
fact that nobody is fixing them.

### The React 19 / Next 15 runtime tax, concretely

Tremor Raw charts *do* run on React 19 + Next 15, but only after a workaround the maintainers
documented in an issue rather than in the docs. From
[tremor#114](https://github.com/tremorlabs/tremor/issues/114) (opened 2025-02-04, closed
2025-02-19) and [tremor#126](https://github.com/tremorlabs/tremor/issues/126) (opened
2025-03-04, **still open**), maintainer `severinlandolt` and multiple users:

```jsonc
// package.json — required for Tremor charts to render on React 19
"overrides": { "react-is": "^19.0.0" }
```

You need this because Recharts 2.x pulls a React-18-era `react-is`. Users on #126 report the
override alone did not fix them; one confirmed working stack was
`next@^15.1.7 / react@^19.0.0 / recharts@^2.15.1` + the override. As of 2026-08-06 a user on
that thread is still asking *"Is Tremor still maintained?"*.

### The disqualifying detail

[tremor#126 — "[Bug]: AreaChart local component not show data"](https://github.com/tremorlabs/tremor/issues/126)
is open since 2025-03-04. On 2025-04-15 `jvandenaardweg` diagnosed it in Tremor Raw's own
shipped source:

> The issue probably lies in how `<defs>` is used. The provided examples are just wrong in how
> they map over the data and how the components are rendered. […] When you move the `<defs>`
> outside the `map`, and the `<Area>` in it's separate map, it works.

That is a bug **in the `categories.map(...)` loop** — the exact code path that makes a Tremor
chart re-group. This project's headline requirement drives straight through the one open,
unfixed, maintainer-unacknowledged defect in the library. That is what turns "stale but usable"
into "do not build on this".

### What Tremor got *right*, and worth stealing

Read directly from
[`src/components/AreaChart/AreaChart.tsx`](https://github.com/tremorlabs/tremor/blob/main/src/components/AreaChart/AreaChart.tsx)
and [`src/utils/chartColors.ts`](https://github.com/tremorlabs/tremor/blob/main/src/utils/chartColors.ts)
(read 2026-09-05):

```ts
export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>()
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length])
  })
  return categoryColors
}
```

`<AreaChart data={rows} index="date" categories={dynamicKeys} />` is genuinely the nicest
re-grouping API of any candidate — a `string[]` prop, colours assigned by modulo. **Copy this
idea into whatever you build.** Note the ceiling though: `chartColors` defines exactly **9**
colours (blue, emerald, violet, amber, gray, cyan, pink, lime, fuchsia) as a closed union type,
and `index % 9` means a 20-Member roll-up silently reuses colours. Any dimension with >9 members
needs a "top N + Other" bucketing rule regardless of library — that is a metric-design decision
(ticket 05 / 08), not a charting one, and it should be made explicitly.

Also worth noting: Tremor Raw's chart has **almost no accessibility**. Grepping the source, the
only a11y in the whole 989-line `AreaChart.tsx` is `tabIndex={0}` on the legend scroll area and
`aria-hidden` on decorative icons. There is no `role="img"`, no chart-level `aria-label`, and it
does **not** pass Recharts' `accessibilityLayer`. Recharts 3 would give you more for free.

### Licensing

Apache-2.0 for both repos (verified via GitHub API, 2026-09-05). Fine for this project, but note
Apache-2.0 carries attribution/NOTICE obligations that MIT (shadcn/ui, Recharts, visx, Nivo)
does not — a small but real difference when you are *vendoring source into your repo*.

---

## Comparison

Health data from the GitHub REST API and npm registry, all read **2026-09-05**. Sizes are
full-package minified+gzip from bundlephobia (read 2026-09-05) — a ceiling, not what a
tree-shaken app ships.

| | **Tremor** (npm / Raw) | **shadcn/ui charts** | **Recharts 3** | **visx** | **Nivo** | **Observable Plot** | **ECharts** |
|---|---|---|---|---|---|---|---|
| Latest stable | `3.18.7` | rolling registry | `3.10.1` | `4.0.0` | `0.99.0` | `0.6.17` | `6.1.0` |
| Released | **2025-01-13** | continuous | 2026-07-25 | 2026-06-11 | 2025-05-23 | **2025-02-14** | 2026-05-19 |
| Repo last push | 2025-01-13 / 2025-10-10 | 2026-09-04 | 2026-09-04 | 2026-06-22 | 2026-07-21 | 2026-09-01 | 2026-09-04 |
| Releases, last 12 mo | **0** / n/a | ~107 (CLI) | **15** | 1 | **0** | **0** | 1 |
| Open issues | 63 / 26 | 859 | ~393 | 149 | 50 | ~251 | ~1,500 |
| Stars | 16.5k / 3.6k | 123k | 27.5k | 21.0k | 14.1k | 5.4k | 67.2k |
| Weekly downloads | 388k | 8.7M (CLI) | **57.3M** | 519k | 1.66M | 611k | 5.13M |
| Bus factor | 0 (stalled) | 1 (shadcn) | **1** (PavelVanecek) | **1** (hshoff) | **1** (plouc) | 2 | many (Apache) |
| License | Apache-2.0 | **MIT** | MIT | MIT | MIT | ISC | Apache-2.0 |
| React 19 in peer deps | **No** (`^18.0.0`) | n/a (vendored) | **Yes** | **Yes** | **Yes** | n/a (no React dep) | wrapper: unpinned |
| Dynamic re-grouping | Native prop, **but buggy** | Good (+`animationMatchBy`) | Good | Good (`xychart`) | Native prop | **Best** (accessor swap) | ⚠️ manual diffing |
| RSC | client-only | client-only | client-only | client-only | `@nivo/static` | SSR w/ DIY shim | static-only |
| Bundle (min+gz) | 217 KB | ≈ Recharts + 10 KB | 147.5 KB | **48.8 KB** (`xychart`) | 78 KB (`bar`) | **67 KB** (measured) | 100–150 KB shaken |
| a11y baseline | ~none | Recharts 3's | **keyboard nav by default** | ⚠️ one `aria-label`, total | per-datum ARIA + focus | per-datum ARIA channels | `aria` off by default; **decals** |
| jsdom-assertable | needs work | **yes** (fixed size) | **yes** (fixed size) | yes (pass w/h) | yes (non-responsive) | **yes — self-tested on Vitest+jsdom** | ❌ canvas; open Vitest bug |
| Verdict | **Drop** | **Recommended** | (is the engine) | escape hatch | a11y-first alternative | judgement call | **rule out** |

---

## Per-library assessment

### shadcn/ui charts — **recommended**

`shadcn-ui/ui`, MIT, 123k stars, `pushed_at` 2026-09-04. Not a dependency — the CLI copies
`chart.tsx` (~373 lines) into your repo, so it is *your* code with no upgrade treadmill and no
abandonment risk. This is the same "own the source" bet Tremor Raw asked you to make, except the
upstream is the most active component project in the React ecosystem rather than a frozen one.

Read from the registry source
([`chart.tsx`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/chart.tsx),
2026-09-05):

**Dynamic re-grouping — good.** `ChartConfig` is a plain runtime record, not a fixed schema:

```ts
export type ChartConfig = Record<string, {
  label?: React.ReactNode
  icon?: React.ComponentType
} & ({ color?: string; theme?: never } | { color?: never; theme: Record<"light"|"dark", string> })>
```

So `useMemo(() => buildConfig(groupBy, rows), [groupBy, rows])` is the intended shape, and the
series children are just `keys.map(k => <Area key={k} dataKey={k} fill={`var(--color-${k})`} />)`.

Two mechanical caveats for a runtime-computed config, both from reading `ChartStyle`:
`--color-${key}` interpolates the key **raw** into a CSS custom-property name, so slugify group
ids (a team called `Ops / EU` emits `--color-Ops / EU`); and the block is a
`dangerouslySetInnerHTML` sink, so colour values must never be user-controlled strings.

**⚠️ Colour: the default palette is a hard ceiling of five, and it fails silently.** This is the
correction to the most common assumption about shadcn charts. `globals.css` defines **exactly**
`--chart-1` … `--chart-5` (light and dark), and there is **no cycling, generation or
interpolation anywhere in `chart.tsx`**. `ChartStyle` filters
`Object.entries(config).filter(([, c]) => c.theme ?? c.color)` — a config entry with no colour
emits no `--color-<key>` at all, so `fill="var(--color-foo)"` resolves to nothing and series #6
renders black or transparent with no error. **A "group by Member" roll-up will hit this
immediately.** You must supply your own palette layer. In order of quality: (a) cap visible
series at top-N + "Other" — usually the better data-viz answer regardless; (b) define
`--chart-6…N` yourself with checked contrast in both themes; (c) generate OKLCH hues
programmatically — but hue-rotation alone is not colour-blind safe. `ChartStyle` will happily
emit whatever you give it; the ceiling is the *theme*, not the component.

**Testability — good, but the mechanism is more delicate than it looks.** `ChartContainer`
passes `initialDimension = {width: 320, height: 200}` to `ResponsiveContainer`, where Recharts'
own default is `{-1,-1}` (verified in
[`ResponsiveContainer.tsx`](https://github.com/recharts/recharts/blob/main/src/component/ResponsiveContainer.tsx))
— which is why bare Recharts renders **nothing** in jsdom. So shadcn charts *do* render in a
bare jsdom.

⚠️ **But that win evaporates if your `vitest.setup.ts` polyfills `ResizeObserver`** — extremely
common boilerplate. The resize effect begins
`if (containerRef.current == null || typeof ResizeObserver === 'undefined') return noop;`, so a
polyfill makes the effect run, call `getBoundingClientRect()` → `0×0` → `setContainerSize(0,0)`,
and the chart **disappears**. Do not build a test suite on `initialDimension` without verifying
this empirically first. **The robust answer is to size charts with fixed numbers in unit tests**
— see [Testability](#testability-the-cross-cutting-answer).

**Accessibility.** Inherits Recharts 3's default `accessibilityLayer` (below). The container is
a plain `<div>`, so a chart-level `aria-label` naming the *current roll-up level*, and a
visually-hidden `<table>` mirror of the grouped data, are yours to add — and worth adding, since
a hidden data table is simultaneously the best screen-reader affordance *and* the most robust
thing to assert on in a test.

**RSC.** `"use client"` at the top of `chart.tsx`. Not a real constraint: do the aggregation and
roll-up in a Server Component (they are pure functions over fixture rows — see ticket 09) and
pass a small serialised result to a thin client chart. Every React chart library here is
client-only; the seam matters more than the library.

**Cost.** ~10 KB of your own source on top of Recharts.

#### What to fix on day one

Four things, all in your own copied file, all verified against the live registry on 2026-09-05:

1. **Scaffold from a `v4` or `base-*` style.** Those pin `recharts@3.8.0`. The legacy `default`
   and `new-york` styles still pin **`recharts@2.15.4`, which npm marks deprecated** — an old
   `components.json` will silently land you on the dead 2.x branch that Tremor is stuck on.
2. **Patch the stale axis selector.** `chart.tsx` still contains
   `[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground`, but Recharts 3 renamed the
   class to `.recharts-cartesian-axis-tick-label`, so axis labels come out the wrong colour
   ([#10477](https://github.com/shadcn-ui/ui/issues/10477), open; fix PR
   [#10479](https://github.com/shadcn-ui/ui/pull/10479) unmerged).
3. **Revert the legend keys to stable ids.** Commit `408b25c` (2026-03-23) changed
   `ChartLegendContent`'s `key={item.value}` to `key={index}` to silence a React warning. Index
   keys are **exactly wrong for a legend whose entries change identity on toggle** — React will
   reconcile "Team A" into "Team B" in place. This is the single most relevant upstream defect to
   this project's requirement.
4. **Guard the initial mount.** [#8547](https://github.com/shadcn-ui/ui/issues/8547) (open) —
   charts render blank roughly 1 load in 10 because the container is measured before layout
   settles. The in-thread fix (don't mount until width/height ≥ 32px) also makes Playwright
   screenshots deterministic.

Also note: shadcn's own [React 19 page](https://ui.shadcn.com/docs/react-19) still tells you to
add a `package.json` override and install with `--legacy-peer-deps` for Recharts. **That advice
is stale** — it was written for Recharts 2.x. Recharts 3.x declares `react: ^19.0.0` as a real
peer; no override is needed. And as of `#11758` (2026-09-04) the registry moved `cn` out of
`@/lib/utils` into a published `cn` package, so `chart.tsx` now opens with `import { cn } from
"cn"` — very fresh churn that will not match tutorials written a week ago.

### Recharts 3 (the engine underneath)

MIT, 27.5k stars, ~393 open issues, `pushed_at` 2026-09-04. `3.10.1` released 2026-07-25 —
**15 releases in the last 12 months**, roughly monthly. 231 issues opened vs 304 closed in that
window, so the backlog is shrinking. **57.3M weekly downloads**, by far the largest install base
here. `peerDependencies` are `react: ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0` — React 19 is a
*declared* peer, no override needed. (Contrast `recharts@2.15.4`, which had `react-is@^18.3.1`
as a **hard dependency** — that is the root cause of Tremor's `react-is` override problem.)

Recharts 3.0 (2025-06-23) was a full state-management rewrite onto Redux Toolkit with ~3,500 new
unit tests. Three things from it matter here
([v3.0.0 release notes](https://github.com/recharts/recharts/releases/tag/v3.0.0)):

> **Accessible by default** — `accessibilityLayer` is now on on all polar and cartesian charts
> by default. Tab into the chart and use the arrow keys to navigate.

> **Legend Portals** — you can now use portals to position your Legend anywhere you'd like,
> including outside of your chart.

Verified in the shipped build: with `accessibilityLayer` on, the root `<svg>` gets
`role="application"` and `tabIndex={0}` (a *single* tab stop, then arrow keys move between data
points — a deliberate choice, per the
[a11y wiki](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility)); tooltip
content renders with **`role="status"`**, so values are announced as you arrow through; legend
swatches carry `aria-label="<series name> legend icon"`; `<Brush>` is `role="slider"`. That is
the best out-of-the-box React chart a11y in this comparison, and the legend `aria-label` doubles
as the cleanest test hook for dynamic series (below). Known limitation the wiki tells you to
surface yourself: VoiceOver users must turn QuickNav off. Open a11y gaps:
[#3816](https://github.com/recharts/recharts/issues/3816) (multiple charts on one page — relevant
to a dashboard), [#5390](https://github.com/recharts/recharts/issues/5390),
[#2801](https://github.com/recharts/recharts/issues/2801).

**Recharts 2.x is formally dead.** Maintainer `PavelVanecek` in
[#7361](https://github.com/recharts/recharts/issues/7361) (2026-05-24):

> I have deprecated all versions older than 3.0.0… **The 2.x branch has not seen a release for a
> year and I doubt there will ever be another one.** The codebase is too hard to maintain, and
> our resources are limited.

`recharts@2.15.4` now carries an npm `deprecated` field. This is the final nail in the Tremor
coffin — both Tremor packages pin Recharts 2.x.

**Dynamic re-grouping: supported, with two things to get right.**
- **Animation matching.** Recharts 3 added `animationMatchBy`, defaulting to `matchByIndex`
  ("match items by array index with proportional stretching"). **When a roll-up toggle changes
  the number of categories, `matchByIndex` produces nonsense tweens** — bar 3 of "Member"
  morphing into bar 3 of "Team". Set `animationMatchBy={matchByDataKey('group')}`, or
  `isAnimationActive={false}` on the toggle path. Get this wrong and the feature *looks* broken.
- **Stable keys.** Give every `.map()`-generated child a `key` derived from the series id, never
  the index. There is a recurring history of duplicate-key warnings from generated children
  (#6049, #4004, #2633 — all closed, but the pattern returns).

No open bug says "changing `dataKey` at runtime breaks the chart"; the old ones (#846, #655)
predate the 3.0 rewrite. One to watch on a multi-chart dashboard:
[#5996](https://github.com/recharts/recharts/issues/5996) — legend Redux state conflicts when two
charts share a page (open, needs reproduction).

**Three risks worth writing down:**
1. **Bus factor 1.** Of ~578 non-dependabot commits in the last year, **372 are `PavelVanecek`**
   (next: `ckifer`, 26). He wrote "95% of the code" for 3.0 and still merges daily. The project
   has a standing "looking for contributors" issue. Mitigated by 57M weekly downloads and MIT
   licensing — this is not a library that would go unforked — but it is the same single-maintainer
   shape that killed Tremor.
2. **⚠️ The Redux rewrite leaks into Next.js webpack builds.** Two open issues:
   [#6117](https://github.com/recharts/recharts/issues/6117) (`ERR_REQUIRE_ESM` on
   `@reduxjs/toolkit` under Next 15 webpack — **65 comments**) and
   [#6316](https://github.com/recharts/recharts/issues/6316)
   (`_toolkit.createSlice is not a function` on Next 15 + React 19). **The reporter on #6117
   notes "turbopack works fine", and both issues are webpack-specific.** *Actionable: run Next 15
   with Turbopack and this class of problem largely evaporates.* On webpack, budget half a day
   for the RTK resolution dance (add `@reduxjs/toolkit` as a direct dependency, or
   `experimental.esmExternals: false`).
   Also open: [#7463](https://github.com/recharts/recharts/issues/7463) — infinite `setState`
   loop when a chart unmounts behind a React 19 Suspense boundary (relevant if charts are
   remounted on toggle), and [#2272](https://github.com/recharts/recharts/issues/2272) — SSR
   hydration `id` mismatch, open with `P1` since 2024.
3. **Bundle.** 147.5 KB min+gz — **~19% heavier than 2.x** (123.9 KB), the price of the Redux
   rewrite. Roughly 183 KB of that (unzipped) is d3, pulled in as *submodules* via
   `victory-vendor` rather than monolithic d3, and `sideEffects: false` plus a real ESM build
   make it genuinely tree-shakeable — the repo guards this with a `treeshaking.test.ts` and
   bundlewatch budgets.

**Recharts directly vs. shadcn charts is barely a choice** — shadcn *is* Recharts plus ~370 lines
of container, tooltip and legend you would otherwise write yourself. Take shadcn unless you want
a bespoke tooltip contract.

---

## Testability: the cross-cutting answer

Ticket 09 asks whether chart *output* is asserted or only chart presence. It can be asserted, but
the mechanism has to be chosen deliberately rather than discovered. For the recommended stack:

**1. Do not fight `ResponsiveContainer` in unit tests — size the chart with numbers.** Reading
`RechartsWrapper` in `recharts@3.10.1`: when both `width` and `height` are numbers it renders
`StaticDiv`, which reports the literal numbers and **never touches
`getBoundingClientRect`**. So `<LineChart width={800} height={400}>` renders a full SVG in jsdom
with **zero mocking**. Percentage sizing (the `width="100%"` default) returns `null`, because
jsdom's `getBoundingClientRect()` always returns zeros
([jsdom#1590](https://github.com/jsdom/jsdom/issues/1590)). Give your chart component a `width`/
`height` (or `responsive`) prop so tests take the static path and the app takes the responsive
one. This is more robust than relying on shadcn's `initialDimension`, which a `ResizeObserver`
polyfill silently defeats.

**2. If you must test tooltips, copy Recharts' own setup.** Their
[`test/README.md`](https://github.com/recharts/recharts/blob/main/test/README.md) documents both
traps: you need `mockGetBoundingClientRect`, **and** fake timers — because the Redux
`autoBatchEnhancer` depends on `requestAnimationFrame`, "nothing happens until you advance the
timers". Their setup uses
`vi.useFakeTimers({ toFake: ['requestAnimationFrame','cancelAnimationFrame'] })`, then
`userEvent.setup({ advanceTimers: vi.runOnlyPendingTimers })` and `vi.runOnlyPendingTimers()`
(not `runAllTimers` — infinite loop) after interactions. Recharts tests itself with Vitest + RTL
against **jsdom 29** ([#7500](https://github.com/recharts/recharts/pull/7500), 2026-06), which is
the strongest evidence that jsdom is a supported target.

**3. Assert on text and ARIA, not on SVG paths.** What is meaningfully assertable:

| Assertion | Hook |
|---|---|
| "The Team roll-up produced 4 series" | `getAllByLabelText(/legend icon/)` — Recharts labels every legend swatch `aria-label="<name> legend icon"`. **This is the cleanest roll-up assertion available and needs no class names.** |
| "The legend now names the teams" | `getByText('Platform')` — legend and axis tick labels are real `<text>` nodes |
| "The chart is present and focusable" | `getByRole('application')` |
| "Hovering point N announces the value" | `getByRole('status')` (tooltip live region) |
| Series geometry | ❌ unlabelled `<path d="...">` — brittle, do not |

⚠️ Recharts class names are **not contractual and do churn** — shadcn is currently shipping a bug
from exactly that (`.recharts-cartesian-axis-tick` → `-tick-label` in v3,
[#10477](https://github.com/shadcn-ui/ui/issues/10477)). Prefer text/ARIA hooks.

**4. Test the grouping as a pure function, and let the DOM test only confirm the wiring.** This
is the ticket-09 seam. `(rows, groupBy) → series[]` is where the roll-up correctness lives and
where combinatorial coverage is cheap; the component test then only needs to prove that N series
in produces N legend entries out. Adding a visually-hidden `<table>` of the grouped data pays
twice — it is the best screen-reader affordance *and* the most stable thing in the DOM to assert
against.

**5. Push "does it actually redraw" to Playwright.** Recharts' maintainer recommends this
explicitly, and the project practises it: `recharts@3.10.1` ships `test-vr` scripts running
**Playwright inside Docker** to pin font rendering. Do the same, or screenshots will diff between
macOS dev and Linux CI.

### visx — technically the best-engineered dependency, but a11y-naked

`airbnb/visx`, MIT (`LICENSE` reads "Copyright (c) 2017-2018 **Harrison Shoff**" — an individual,
not Airbnb Inc.), 21.0k stars, 149 open issues. Looked moribund — **zero stable releases in all
of 2025**, nothing between `3.12.0` (2024-11-07) and **`4.0.0` (2026-06-11)** — but v4 is a real
revival. [Release notes](https://github.com/airbnb/visx/releases/tag/v4.0.0): "React 19 Support",
"Breaking: Require React 18 or 19", `d3-shape`/`d3-path` v3, **lodash removed entirely**,
`prop-types` removed, and the test suite migrated off Jest/Enzyme **to Vitest**. Peers are
`react: ^18.0.0 || ^19.0.0`; `@types/react` was made an *optional* peer, which avoids duplicate-
types conflicts on React 19. Zero open React 19 issues.

**Correction to a common assumption: visx is not only low-level primitives.** It has two tiers,
and only the second matches its reputation:

1. **`@visx/xychart`** — declarative and batteries-included. `XYChartProps.children: ReactNode`,
   with `BarSeries` / `BarStack` / `BarGroup` / `LineSeries` / `AreaSeries` / `GlyphSeries` (plus
   animated variants) each taking a `dataKey` and a `colorAccessor`. Re-grouping is
   `{keys.map(k => <BarSeries key={k} dataKey={k} .../>)}` — the same shape as Recharts, with
   axes, legend and tooltip provided. Comparable code volume to Nivo.
2. **Raw primitives** (`@visx/shape` + `scale` + `axis` + `group` + `legend`) — here the
   low-level reputation holds: you build the scales, run the d3 stack/group layout, and hand-roll
   the legend and tooltip. Realistically 200–400 lines for a re-groupable multi-series chart.

- **Re-grouping (tier 1): good, with a genuine advantage.** Colours come from a `scaleOrdinal`
  *you* own, so keeping "Alice is always violet" stable across a Member→Team→Member round trip is
  explicit, rather than implicitly reshuffling when the key set changes.
- **Bundle: the lightest here.** `@visx/xychart` 48.8 KB min+gz (+ `@visx/legend` 2.2 KB), and
  `sideEffects: false` with clean `exports`, so unused series types genuinely shake out.
- **Testability: good, with a documented escape hatch.** `XYChart` explicitly bails at zero size
  (`if (width <= 0 || height <= 0) { ... return null }`) — the same jsdom failure mode as
  Recharts. But the measurement path is *conditional*: pass explicit `width` and `height` and
  `ParentSize` is never mounted, so no `ResizeObserver` and real SVG in jsdom. visx testing its
  own suite under Vitest is a strong signal.
- **⚠️ a11y: essentially nothing.** Grepping the entire shipped `@visx/xychart@4.0.0` ESM tree for
  ARIA attributes returns **exactly one hit** — `"aria-label": accessibilityLabel` on the root
  `<svg>`. No `role`, no `aria-labelledby`, no per-datum labels. Bars *can* be made focusable via
  `tabIndex`, which without an accessible name is arguably worse than not focusable. A
  `@visx/a11y` package was merged to `master` on 2026-06-15 but **is not published to npm** —
  `registry.npmjs.org/@visx/a11y` returns no `dist-tags`. Do not plan around it.
- **Issue tracker is effectively unresponsive.** #2031 (2026-09-01), #2029 (2026-08-13), #1974
  (2025-11-19) and #1925 (2025-09-17) all sit at **zero comments**. Last push 2026-06-22.

**Verdict:** the best-engineered dependency of the six, and the right tool if you need a mark
nobody ships. But for a dashboard of area/bar/donut charts on a deadline, you would be trading a
keyboard-accessible-by-default chart (Recharts 3) for one where the entire accessibility layer is
a multi-day workstream that recurs every time the series set changes. Keep it in your pocket.
(Curiosity worth noting: `feat(registry): add shadcn-compatible chart registry (#2019)` landed on
`master` 2026-06-17 — also unpublished. The ecosystem is converging on the shadcn registry model.)

### Nivo — the accessibility outlier, but 15 months without a release

`plouc/nivo`, MIT (© Raphaël Benitte), 14.1k stars, only **50 open issues** (the tidiest tracker
here). Last stable `0.99.0` on **2025-05-23** — ~15.5 months ago — after 11 releases crammed into
one month (2025-04-22 → 2025-05-23), then silence. Commits continue (last 2026-07-21) but
**everything merged since May 2025 is unreleased**, including the Pie and Sunburst ARIA
additions. Maintainership is genuinely one person: `plouc` has 1,021 commits, the next-highest
contributor 244, and every recent merge is `plouc`'s. Funding is a single Open Collective.

`@nivo/core@0.99.0` peers are `react: ^16.14 || ^17.0 || ^18.0 || ^19.0`; React 19 support landed
in [#2713](https://github.com/plouc/nivo/pull/2713) (2025-04-22) and **did make it into 0.99.0**.
One open React 19 defect ([#2801](https://github.com/plouc/nivo/issues/2801), 2025-10-16) is a
key-prop console warning in `@nivo/geo` Choropleth legends — irrelevant here.

- **Re-grouping: native and clean.** `keys: readonly string[]` is a plain prop consumed by the
  `useBar` hook, which memoizes on it. Changing `keys` re-derives series, scales, colours and
  legend. No open issue describes runtime `keys` changes breaking. Two gotchas: `initialHiddenIds`
  only *seeds* state (remount with `key={rollupLevel}` if a switch must reset hidden series), and
  colours are assigned by scheme against key *order* — pass `colors={d => myColourMap[d.id]}` if
  you want stable colour identity across roll-up levels.
- **a11y: the best built-in story of any React candidate.** Verified by grepping the shipped
  bundle, not the docs. `SvgWrapper` emits `role`, `aria-label`, `aria-labelledby`,
  `aria-describedby`, and `tabIndex` when `isFocusable`. It goes **per-datum** too — `@nivo/bar`
  types declare `barAriaLabel?: (d: ComputedDatum<D>) => string` and `barAriaLabelledBy`, and
  `BarItem` accepts `isFocusable`/`ariaLabel`/`ariaDisabled`/`ariaHidden`. That means
  keyboard-tabbable bars with per-bar screen-reader labels *derived from the current roll-up
  level* — which is exactly right for this requirement. ⚠️ It is essentially undocumented:
  `nivo.rocks/guides/accessibility` returns **404**; you discover these props by reading `.d.ts`.
- **Testability: good.** `Responsive*` wrappers delegate to `react-virtualized-auto-sizer` and hit
  the jsdom zero-size problem, but `@nivo/bar` also exports the plain `Bar` with explicit
  `width`/`height` — use that in unit tests. `BarItem` accepts a `testId` prop, and the ARIA
  attributes make `getByRole`/`getByLabelText` viable in a way they are not against visx. Nivo is
  also the only React candidate shipping a **server-rendering package**: `@nivo/static@0.99.0`
  (built for `renderToStaticMarkup`), which makes snapshot-assertable static SVG possible.
  Caveat: it depends on the whole chart suite — keep it out of the client bundle.
- **Bundle: the weakest.** `@nivo/bar` 78.1 KB min+gz. Nivo's own code is small (~9 KB gz); the
  weight is lodash + the d3 constellation. Worse, `@nivo/core` **does not declare
  `sideEffects: false`**, so bundlers must retain everything — the floor is materially higher than
  visx's. It still depends on `lodash@^4.17.21`, and the request to address that
  ([#2834](https://github.com/plouc/nivo/issues/2834), 2026-05-29) sits at zero comments.
- **Styling:** Nivo brings its own theme object. It does not compose with Tailwind tokens the way
  a shadcn chart does, so dark mode and design-token consistency become extra work.

**Verdict:** the strongest a11y case of any React candidate, and `@nivo/static` is a real
testability differentiator. But you would be adopting a one-maintainer, still-`0.x`-after-nine-
years codebase with no npm release in 15 months, ~50% more bundle, no tree-shaking, and a
theming model that fights Tailwind — to buy ARIA you can add to a shadcn chart yourself. **If
accessibility were a contractual/WCAG obligation, Nivo would be the pick.** For this project it
is not, and Recharts 3's keyboard-nav-by-default closes most of the gap.

### ECharts — healthy core, compromised React wrapper, untestable output

`apache/echarts`, Apache-2.0, 67.2k stars, ~1,500 open issues, `6.1.0` released **2026-05-19**
(after `6.0.0` on 2025-07-30). Verified as an Apache **Top-Level Project** with its own PMC since
2021-01-26 ([projects.apache.org](https://projects.apache.org/json/foundation/projects.json)),
not in the Attic. 288 issues opened vs **793 closed** in the last 12 months — a shrinking
backlog, which is rare. The core library is unambiguously the healthiest project in this brief.

Its problems are all at the edges, and all three land on this project.

**⚠️ Supply chain: `echarts-for-react` was compromised in May 2026 and is not fully remediated.**
This is the single most important operational finding in this brief. On **2026-05-19** three
versions (`3.0.7`, `3.1.7`, `3.2.7`) were published within ten minutes via a maintainer account
breach ("Mini Shai-Hulud" attack), carrying a `preinstall` hook and an obfuscated ~498 KB payload
that scraped GitHub/npm tokens and environment variables and exfiltrated them
([#623](https://github.com/hustcc/echarts-for-react/issues/623),
[#625](https://github.com/hustcc/echarts-for-react/issues/625)). The same author's
**`size-sensor`** — a *runtime dependency of the wrapper* — was hit at `1.0.4` / `1.1.4` /
`1.2.4`. As of 2026-09-05:

- `echarts-for-react@3.0.7` and `size-sensor@1.0.4` are **still published and installable**,
  merely deprecated, with the misleading message *"This version was published in error"*.
- **No GitHub Security Advisory exists** for either package (`/advisories?ecosystem=npm` returns
  empty for both).
- The clean `latest`, `echarts-for-react@3.0.6`, declares `"size-sensor": "^1.0.1"` — a range
  that **includes the compromised `1.0.4`**, and npm resolves ranges to the highest satisfying
  version, installing deprecated ones with only a warning. *(This last step is inferred from
  registry data plus npm semver behaviour, not executed — confirm with `npm why size-sensor`
  before treating it as fact. Impact is currently blunted because the payload's git ref was
  purged from `antvis/G2` and it was an `optionalDependency`, but you would still be installing
  an attacker-published version.)*

Mitigation if you go this route: pin `size-sensor` to `1.0.3` via `overrides`, commit a lockfile,
`--ignore-scripts` in CI — or **skip the wrapper entirely** and write the ~60-line
`useEffect` + `echarts.init` + `setOption` binding yourself, which removes the single-maintainer,
breached-account, React-19-types and CJS-interop risks in one move. There is no official Apache
React binding; ECharts ships framework-agnostic.

- **Re-grouping — the documented default is the trap.** `setOption` uses *Normal Merge* by
  default, specified as: **"No existing component will be removed. Only add and update are
  supported in this mode."** So Member (20 series) → Org (1 series) → Member leaves 19 phantom
  series and 19 phantom legend entries. Fixes: `notMerge: true` recreates everything but resets
  animation, zoom and legend-selection state on every roll-up switch; `replaceMerge:
  ['series','legend']` is the intended tool but requires you to assign and manage a **stable `id`
  per series** as the grouping key changes. Either way you are hand-writing the diffing layer
  that every other candidate gives you for free. Also open:
  [#21566](https://github.com/apache/echarts/issues/21566) — legend clicks stop responding when
  `setOption` is called at ≥30fps.
- **a11y: the one clear win.** `aria.enabled` is **off by default** (ship it as-is and you ship an
  unlabelled chart), but turning it on auto-generates a full narrative `aria-label` for the chart,
  and `aria.decal` adds **texture patterns as a non-colour encoding** across bar/line/pie/etc.
  That matters here: at Member-level roll-up you may render 20+ series, and categorical palettes
  run out of distinguishable hues around 10–12. No other candidate ships this. The caveat is that
  under Canvas the whole chart is one opaque node with one long label — no per-element a11y tree,
  no keyboard navigation into data points.
- **Bundle:** 360 KB min+gz for the full build (measured). Tree-shaking via `echarts/core` +
  explicit `echarts.use([...])` gets a bar+line+tooltip+legend build to roughly **100–150 KB gz**
  — still the heaviest here, and one stray `import * as echarts from 'echarts'` anywhere in the
  tree silently restores the full 360 KB.
- **Testability: the disqualifier.** ECharts renders to `<canvas>` by default — there is no DOM
  to query, so "the legend now has 12 entries" is simply not assertable; you would need the
  native `canvas` package (node-gyp) just to stop `getContext('2d')` returning null. The SVG
  renderer emits queryable nodes but with **no semantic hooks** — you match generated `<text>`
  positionally. And there is a live, unanswered blocker on exactly this stack:
  [apache/echarts#20707 "Vitest: Unexpected token 'export'"](https://github.com/apache/echarts/issues/20707),
  **open since 2025-01-21 with no maintainer response** — ECharts ships CJS containing ESM syntax,
  and the reporter says the usual `server.deps.inline` workaround did not fix it. Realistically
  you would test your own option-building function and defer all rendering assertions to
  Playwright, which is precisely what ticket 09 is trying to avoid.
- **React 19:** wrapper peers are `^15.0.0 || >=16.0.0` — permissive rather than verified. Two
  open, uncommented issues: [#628](https://github.com/hustcc/echarts-for-react/issues/628)
  (2026-07-03, React 19 removed the global `JSX` namespace; the wrapper's `.d.ts` still
  references it — **TypeScript-only, but it red-lines `tsc` in a TS project like this one**) and
  [#619](https://github.com/hustcc/echarts-for-react/issues/619) (2026-03-19, CJS default-export
  interop crash on Vite 8 — a class of bug Next 15/Turbopack could plausibly hit).

**Verdict:** the right answer for a 100k-point scientific plot with a dedicated build engineer.
Wrong shape for a Tailwind dashboard that must be unit-tested, and the wrapper's unremediated
supply-chain state makes it an active liability rather than a neutral one.

### Observable Plot — the genuine alternative

`observablehq/plot`, **ISC**, 5.4k stars, ~251 open issues + 96 open PRs. Health is the odd one
out, and the shape of it matters: **the repo is not dead, the release process is.** Last commit
**2026-09-01**; a real feature burst in March–April 2026 (34 commits) merged the `arealine` mark,
ordinal opacity, opacity legends and `light-dark()` support — **none of which has ever been
published**. Meanwhile the **last stable release was `0.6.17` on 2025-02-14**, 18.7 months ago.

The corroborating detail is damning: `package.json` on `main` still reads `"version": "0.6.17"`;
`CHANGELOG.md` still has `0.6.17` at the top under a heading of `Year: Current (2025)`; the
`LICENSE` copyright line stops at 2025; docs version badges on `main` carry a bare PR number with
the version field literally unfilled (`<VersionBadge pr="2382" />`); and there are **no open
milestones and no release-prep PR**. Bus factor is 2 — `mbostock` (19 commits in 12 months) and
`Fil` (17).

On strategy: there is no primary source saying Plot is deprecated, and it is not. Observable's
own [2025 year in review](https://observablehq.com/blog/observable-2025-year-in-review) speaks
about Plot positively and says Canvas will pull "favorite charts from the D3 and Plot galleries".
But read that carefully — **Plot is positioned as an input to Observable's hosted Canvas product,
not as a standalone library receiving release investment**, and the commit record matches. Treat
"Observable is still investing in Plot" as *true of the code, false of the release pipeline*.

**Why it is the best fit for *this specific requirement*.** Plot is a grammar of graphics, so
grouping is a *channel*, not a component structure. Switching roll-up level is swapping one
accessor function ([group transform docs](https://github.com/observablehq/plot/blob/main/docs/transforms/group.md),
read 2026-09-05):

```js
const by = { member: d => d.memberId, team: d => d.teamId, org: () => "Org" }[rollup]

Plot.plot({
  marks: [Plot.barY(rows, Plot.groupX({ y: "sum" }, { x: "date", fill: by, y: "cost" }))]
})
```

`color: {legend: true}` generates the legend **from the scale domain**, which is itself inferred
from the distinct `fill` values on every render. So series count, colour scale and legend entries
all re-derive from the data. There is no children array to rebuild, no `ChartConfig` to
recompute, and — because the React integration is destroy-and-recreate — **the stale-series class
of bug is structurally impossible**. Compare that to maintaining a parallel `keys[]` + `config{}`
+ `children[]` triple in the Recharts world, plus getting `animationMatchBy` right.

**Testability — the strongest evidence in this brief.** Plot tests *itself* on this project's
exact stack. From
[`vitest.config.ts`](https://github.com/observablehq/plot/blob/main/vitest.config.ts) on `main`:
`environment: "jsdom"`, with devDependencies `vitest ^4.0.8` and `jsdom ^29.0.1` (migrated from
Mocha in [#2373](https://github.com/observablehq/plot/pull/2373), 2026-03). And the answer to the
"jsdom has no `getBBox`" problem is in their own `test/setup.ts` — copy it verbatim:

```ts
// JSDOM doesn't implement getBBox; stub it to avoid uncaught errors from postrender callbacks.
if (typeof SVGElement !== "undefined" && SVGElement.prototype["getBBox"] === undefined) {
  SVGElement.prototype["getBBox"] = () => ({x: 0, y: 0, width: 0, height: 0});
}
```

`Plot.plot()` is **synchronous** and returns a real SVG node — no `waitFor`, no fake timers, no
`ResponsiveContainer`, no `ResizeObserver`. You can assert immediately: count legend entries,
count distinct `fill` values. Caveat: because `getBBox` returns zeroes, anything depending on
measured text width (auto margins, tick-label collision/rotation) is unreliable in jsdom — assert
on structure and data, push geometry to Playwright. Known weak spot:
[#2187](https://github.com/observablehq/plot/issues/2187), static `Plot.tip` marks do not work
under jsdom.

**SSR — real, but with a caveat the docs soft-pedal.** From
[`docs/features/plots.md`](https://github.com/observablehq/plot/blob/main/docs/features/plots.md):

> The **document** option specifies the document used to create plot elements. It defaults to
> `window.document`, but can be changed to another document, say when using a virtual DOM
> implementation for server-side rendering in Node.

⚠️ The canonical React snippet in Plot's own docs calls `.toHyperScript()` — and **`toHyperScript`
is not part of Plot**; it does not appear anywhere in `src/`. It is a method on the nodes of the
virtual `Document` implementation *you* must supply, which the docs decline to show ("For
brevity, the virtual `Document` implementation is not shown"). So the RSC path is real but **you
own an undocumented mini-DOM shim**, and Plot's docs warn SSR "is only practical for simple plots
of small data". For an interactive roll-up switcher you want the client path anyway.

**React 19 risk: effectively nil.** Plot has **zero React dependency** (deps are only `d3`,
`isoformat`, `interval-tree-1d`), so it cannot break on a React major. Real ESM with
`"type": "module"`, so no CJS-interop pain in Next 15. Mark your wrapper `"use client"` and
return `() => plot.remove()` from the effect — that cleanup matters, because React 19 StrictMode
double-invokes effects in dev.

**Accessibility.** Per-mark `ariaDescription` and `ariaHidden`, per-datum `ariaLabel` and `title`
channels, plus `className` (v0.6.16+) —
[`docs/features/marks.md`](https://github.com/observablehq/plot/blob/main/docs/features/marks.md).
Because they are *channels*, they re-derive on re-group for free:
``ariaLabel: d => `${seriesBy(d)}: ${d.value}` `` stays correct across roll-up switches, which is
more expressive than Recharts' chart-level story. Two gaps: ⚠️ `title`, `href` and `ariaLabel`
**can only be channels** — a plain string is read as a *column name*, so a constant label must be
written `ariaLabel: () => "…"` (a genuine footgun); and there is **no built-in keyboard
navigation**, where Recharts 3 gives you arrow-key data traversal for free.

**What it costs.**
- **Imperative.** `Plot.plot()` returns a DOM node; React integration is `useEffect` + `ref` +
  teardown on every re-render. Idiomatic and well-trodden, but it is an escape hatch out of
  React, and interactivity beyond the built-in `tip` (click-to-filter, hover linking across
  charts) is wired by hand rather than via props.
- **Styling.** Plot emits its own SVG with its own default styles. Making it look like the rest
  of a Tailwind/shadcn dashboard — dark mode, tokens, fonts — is manual work that shadcn charts
  give you for free.
- **Bundle: actually the lightest realistic option.** The UMD build measures **67 KB min+gz with
  d3 already bundled in** — under half the 125 KB bundlephobia headline and below Recharts' 147.5
  KB. It ships raw ESM source (`"exports": {"default": "./src/index.js"}`) so bundlers shake from
  source, though it depends on the `d3` *metapackage* rather than individual `d3-*` modules.
- **No non-colour encoding.** No decal/pattern equivalent to ECharts. At >12 series you would
  hand-roll SVG `<pattern>` fills.
- **Release risk.** Pre-1.0, nothing shipped in 18.7 months, bus factor 2. Bounded, though: ISC
  licence, three dependencies, and a two-file integration surface mean vendoring or forking is
  cheap — and **nothing this project needs is in the unreleased backlog**, so pinning `0.6.17`
  exactly is a viable stance.

---

## The one real trade-off

Everything above is one-sided **except** shadcn/Recharts vs. Observable Plot, and that one is a
genuine judgement call, so it is flagged rather than decided:

| | shadcn/ui + Recharts 3 | Observable Plot |
|---|---|---|
| Fit for the roll-up requirement | Good — rebuild config + children, mind `animationMatchBy` | **Excellent — swap one accessor; stale series impossible** |
| Stack coherence | **Native** Tailwind/shadcn/React | Foreign; imperative escape hatch, manual theming |
| Maintenance | **15 releases/12mo**, 57M downloads/wk — but bus factor 1 | Active repo, **0 releases in 18.7 months**, pre-1.0, bus factor 2 |
| Testability | Good — fixed-size path needs no mocks | **Excellent — self-tested on Vitest 4 + jsdom 29** |
| Accessibility | **Keyboard nav + live-region tooltip by default** | Rich per-datum ARIA channels, **no keyboard nav** |
| Bundle | 147.5 KB gz | **67 KB gz** |
| Interactivity | Declarative props | Hand-wired |
| Day-one work | 4 known patches (palette, legend keys, selector, mount guard) | A `useEffect`+`ref` wrapper and a theming pass |
| Risk | Low, but webpack/RTK friction — **use Turbopack** | Moderate — you may be pinning the last release forever |

**The honest framing:** Plot is the better *modelling* of the problem; shadcn/Recharts is the
better *fit for this codebase and this deadline*. Plot's advantage is real and specific — the
class of bug this ticket is worried about cannot occur, and its jsdom evidence is the strongest
of any candidate. Its disadvantage is equally specific: you would be adopting a library whose
maintainers merge features but do not cut releases, and paying a theming and interactivity tax to
make it look and feel like the rest of a shadcn dashboard.

Since this project is graded on architecture, testing and polish — where "looks and behaves like
a coherent product" counts alongside "chart assertions run in Vitest" — stack coherence and the
keyboard-accessible default win. **Recommendation stands at shadcn/ui charts on Recharts 3.**
The counter-argument is not weak, though, and a reviewer who values grammar-of-graphics
correctness over stack coherence could reasonably choose Plot; if that is the call, pin `0.6.17`
exactly and accept it may be the last release.

## What would change the answer

- If Recharts 3 mis-handles a roll-up switch (legend not re-deriving, `matchByIndex` tweening
  nonsense, series identity churn from index keys), Plot's accessor model removes that whole bug
  class. **Prove this with a 30-minute spike before committing** — flip one chart between 20 and
  4 series and watch the legend. This is the highest-value cheap experiment in this brief.
- **Use Turbopack.** Both open Next 15 blockers against Recharts 3 (#6117, #6316) are
  webpack-specific, and the #6117 reporter states plainly that "turbopack works fine". Choosing
  the bundler is choosing whether this risk exists.
- If accessibility is being graded hard and >12 series are on screen, ECharts' decal patterns are
  the only built-in answer to colour-blind-safe categorical encoding — but the wrapper's
  supply-chain state makes that a bad trade. Cap series at top-N + "Other" instead, which is a
  better chart anyway and dodges shadcn's 5-colour ceiling at the same time.
- If accessibility became a contractual/WCAG obligation, **Nivo** — not ECharts — is the
  reconsider: per-datum `barAriaLabel` + `isFocusable` is days of work you would otherwise write.
- If a mark is needed that Recharts does not ship, drop to visx for that one chart. They compose
  fine; both are plain SVG React.

---

## Sources

All read 2026-09-05 unless a different date is given inline.

**Tremor**
- <https://github.com/tremorlabs/tremor-npm> — repo metadata via GitHub API: Apache-2.0, 63 open issues, `pushed_at` 2025-01-13
- <https://github.com/tremorlabs/tremor> — Tremor Raw: Apache-2.0, 26 open issues, `pushed_at` 2025-10-10
- <https://registry.npmjs.org/@tremor/react> — `3.18.7` (2025-01-13), `peerDependencies.react: ^18.0.0`, `recharts: ^2.13.3`
- <https://github.com/tremorlabs/tremor-npm/issues/1054> — "[Bug]: Charts don't render in React 19 RC" (2024-05-20, open)
- <https://github.com/tremorlabs/tremor-npm/issues/1072> — "[Feature]: React 19 support" (2024-05-30, open)
- <https://github.com/tremorlabs/tremor/issues/114> — Next.js 15 render failure + `react-is` override (closed 2025-02-19)
- <https://github.com/tremorlabs/tremor/issues/126> — "[Bug]: AreaChart local component not show data"; `<defs>`-in-`map` diagnosis (2025-03-04, **open**)
- <https://github.com/tremorlabs/tremor/issues/140> — "Will Tremor continue to be supported post Vercel acquisition?" (2025-05-12, open)
- <https://github.com/tremorlabs/tremor/issues/148> — "So did vercel just buy tremor to extinguish it?" (2025-09-03)
- <https://github.com/tremorlabs/tremor/issues/166> — React 19 / Recharts 3 upgrade PR (2026-06-11, 0 comments)
- <https://vercel.com/blog/vercel-acquires-tremor> — acquisition announcement, 2025-01-22
- <https://community.vercel.com/t/tremor-shadcn-and-vercel/17242> — co-founder: "net-new development will be happening in shadcn/ui" (2025-08-07)
- <https://npm.tremor.so/docs/getting-started/installation> — "requires React v18.2.0+"
- <https://tremor.so/docs/getting-started/installation> — "Tremor Raw is designed for React v18.2.0+ and requires Tailwind CSS v4.0+"
- `src/utils/chartColors.ts`, `src/components/AreaChart/AreaChart.tsx`, `src/components/AreaChart/areachart.spec.ts` in `tremorlabs/tremor`

**shadcn/ui**
- <https://github.com/shadcn-ui/ui> — MIT, `pushed_at` 2026-09-04; `shadcn@4.21.0` CLI (2026-09-04), 107 releases in 12 months
- <https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/chart.tsx> — `ChartConfig`, `ChartStyle`, `initialDimension`
- Live registry `chart.json` — `new-york-v4` / `base-*` pin `recharts@3.8.0`; legacy `default` / `new-york` pin `recharts@2.15.4` (deprecated)
- <https://github.com/shadcn-ui/ui/issues/10477> — stale `.recharts-cartesian-axis-tick` selector after Recharts 3 (open); fix PR <https://github.com/shadcn-ui/ui/pull/10479>
- shadcn-ui/ui commit `408b25c` (2026-03-23) — legend keys changed to `key={index}`; `228b0e3` (2026-03-23) — Recharts v3 support; `#11758` (2026-09-04) — `cn` moved to its own package
- <https://github.com/shadcn-ui/ui/issues/8547> — intermittent blank chart on first mount (open)
- <https://ui.shadcn.com/docs/react-19> — Recharts guidance here is stale (written for 2.x)
- <https://github.com/shadcn-ui/ui/blob/main/apps/v4/app/globals.css> — exactly `--chart-1` … `--chart-5`

**Recharts**
- <https://registry.npmjs.org/recharts> — `3.10.1` (2026-07-25), MIT, `react: ^16.8 || ^17 || ^18 || ^19` peers; `2.15.4` carries a `deprecated` field
- <https://github.com/recharts/recharts/releases/tag/v3.0.0> — accessibility by default, legend portals, Redux rewrite (2025-06-23)
- <https://github.com/recharts/recharts/issues/7361> — maintainer: "2.x… I doubt there will ever be another one" (2026-05-24)
- <https://github.com/recharts/recharts/issues/6117> (65 comments) and <https://github.com/recharts/recharts/issues/6316> — RTK/ESM failures under Next 15 **webpack**; "turbopack works fine"
- <https://github.com/recharts/recharts/issues/7463> — infinite setState behind a React 19 Suspense boundary (open, 2026-06)
- <https://github.com/recharts/recharts/blob/main/test/README.md> — `getBoundingClientRect` mock + fake-timer requirements
- <https://github.com/recharts/recharts/blob/main/test/helper/mockGetBoundingClientRect.ts>, `test/vitest.setup.ts`, `test/helper/expectLegendLabels.tsx`
- <https://github.com/recharts/recharts/blob/main/src/component/ResponsiveContainer.tsx> — `initialDimension` default `{-1,-1}`; `src/chart/RechartsWrapper.tsx` — `StaticDiv` path
- <https://github.com/recharts/recharts/wiki/Recharts-and-accessibility> — arrow-key model, `role="application"`, VoiceOver QuickNav caveat
- <https://github.com/recharts/recharts/pull/7500> — jsdom bumped to 29 (2026-06)
- <https://recharts.github.io/en-US/guide/animations> — `animationMatchBy` / `matchByDataKey`
- <https://github.com/recharts/recharts/issues/3816>, `/5390`, `/2801`, `/5996` — open a11y and multi-chart issues

**visx / Nivo**
- <https://github.com/airbnb/visx/releases/tag/v4.0.0> — React 19 support, lodash removed, Vitest migration (2026-06-11)
- <https://github.com/airbnb/visx/discussions/1908> — maintenance thread, 2025-04-30 → 2026-06-11
- <https://registry.npmjs.org/@visx/xychart> — `4.0.0`, peers `react: ^18.0.0 || ^19.0.0`; `@visx/a11y` returns no `dist-tags` (unpublished)
- <https://raw.githubusercontent.com/airbnb/visx/master/LICENSE> — MIT, © Harrison Shoff
- <https://github.com/plouc/nivo> — MIT, 50 open issues, last commit 2026-07-21; `plouc` 1,021 commits vs next-highest 244
- <https://registry.npmjs.org/@nivo/bar> — `0.99.0` (2025-05-23), peers include `^19.0`
- <https://github.com/plouc/nivo/issues/2618> — React 19 support, closed 2024-07-01
- <https://github.com/plouc/nivo/issues/2834> — lodash vulnerability update request, 0 comments (2026-05-29)
- <https://www.npmjs.com/package/@nivo/static> — SSR/static rendering package @ 0.99.0
- `@nivo/core` and `@nivo/bar` shipped `.d.ts` + ESM bundles — `barAriaLabel`, `isFocusable`, `testId`, and the absent `sideEffects` field

**Observable Plot**
- <https://github.com/observablehq/plot> — ISC, last commit 2026-09-01, last release `v0.6.17` 2025-02-14; `package.json` on `main` still `0.6.17`, no open milestones
- <https://github.com/observablehq/plot/blob/main/vitest.config.ts> and `test/setup.ts` — jsdom environment, `getBBox` stub
- <https://github.com/observablehq/plot/pull/2373> — Mocha → Vitest migration (2026-03)
- <https://github.com/observablehq/plot/blob/main/docs/features/plots.md> — the `document` option (SSR)
- <https://github.com/observablehq/plot/blob/main/docs/features/marks.md> — `ariaLabel` / `ariaDescription` / `ariaHidden` / `className`, and the channels-only constraint
- <https://github.com/observablehq/plot/blob/main/docs/transforms/group.md> — `Plot.groupX`, `color: {legend: true}`
- <https://github.com/observablehq/plot/issues/2187> — `Plot.tip` does not work under jsdom (open)
- <https://observablehq.com/blog/observable-2025-year-in-review> — Plot positioned as input to Canvas

**ECharts**
- <https://github.com/apache/echarts> — Apache-2.0, `6.1.0` 2026-05-19; 288 opened / 793 closed in 12 months
- <https://projects.apache.org/json/foundation/projects.json> — `echarts` is a TLP with its own PMC since 2021-01-26; absent from the Attic
- <https://github.com/hustcc/echarts-for-react/issues/623> and <https://github.com/hustcc/echarts-for-react/issues/625> — **May 2026 supply-chain compromise**; `echarts-for-react` 3.0.7/3.1.7/3.2.7 and `size-sensor` 1.0.4/1.1.4/1.2.4
- <https://registry.npmjs.org/echarts-for-react> and `/size-sensor` — compromised versions still published and deprecated-not-unpublished; no GHSA exists for either
- <https://github.com/apache/echarts/issues/20707> — "Vitest: Unexpected token 'export'", open and unanswered since 2025-01-21
- <https://raw.githubusercontent.com/apache/echarts-doc/master/en/api/echarts-instance.md> — Normal Merge: "No existing component will be removed"; `replaceMerge`
- <https://raw.githubusercontent.com/apache/echarts-doc/master/en/option/component/aria.md> — `aria.enabled` off by default; `aria.decal`
- <https://github.com/hustcc/echarts-for-react/issues/628> (React 19 `JSX` namespace, open), `/619` (CJS interop, open)
- <https://github.com/apache/echarts/issues/21566> — legend clicks drop at high-frequency `setOption`

**Measurements**
- <https://bundlephobia.com/> — min+gzip figures, read 2026-09-05
- Locally gzipped published dist artifacts — Observable Plot UMD 67 KB, ECharts full 360 KB / common 234 KB / simple 165 KB
- <https://api.npmjs.org/downloads/point/last-week/> — weekly downloads, week of 2026-08-23
