Type: implementation
Status: resolved
Blocked by: 31
Label: resolved

# `/demo/work` — whether the agents are working

## Goal

The efficacy page.

## Scope

**Panels, in this order (R-N12):**

1. Completed Tasks per period — raw or per-capita
2. **Acceptance rate as small multiples**, one chart per WorkType on a shared axis
3. Rework rate and Decomposition rate as two lines on one chart — both are Task-grain rates
4. Incomplete Tasks as a horizontal bar by age bucket
5. Session duration — median and p95
6. Human-presence spans and machine time as one **stacked** composition, **restricted to
   `interactive` sessions and labelled so**. The three spans are disjoint and sum exactly to
   `machine_allocation_duration_s`, so they partition the measure and stack legitimately under the
   narrowed R-V1 (`spec.md` § 11 C8). The ViewModel carries `stackable: true`; a component never
   decides this

**Small multiples are not negotiable (R-N13).** Acceptance rate is defined only *within* a WorkType,
and the layout makes that visible with no caption. A single chart with a WorkType selector would
hide four of five values and make a viewer click to discover that the comparison is not offered.
*(Corrected 2026-09-09 from "five of six"; `research` was cut, so there are five WorkTypes.)*

**Human-presence spans are `interactive`-only (R-N14).** A `headless` session is AFK for its entire
lifetime by construction, so a view spanning both modes would merely rediscover which sessions were
headless. Label it.

**Controls**: period and grain · subject · Repository · WorkType · `execution_mode` · per-capita.

**`execution_mode` earns its place beyond the spans panel** (R-C2): it is the one control that
separates unattended runs from supervised ones across duration and acceptance, and the session model
makes it deliberately **independent of `Member.kind`**. That independence is invisible unless a
viewer can filter on both. R-D13 puts a `service_account` running `interactive` sessions and humans
running `headless` ones in the fixture — that is the cell ticket 08 said would be lost if the two
were conflated.

## Done when

**T-U20** and **T-C1** hold for panel 6, and acceptance rate is never rendered as a single
cross-WorkType figure (A21).

## Notes

Human-presence spans and machine time **share one view** — the loose item handed over by ticket 05.
Both are time-shaped, both are secondary, and splitting them duplicates chrome for two thin panels.

The fixture's acceptance spread is the product's sharpest claim: `review` 0.86 · `bugfix` 0.79 ·
`implementation` 0.71 · `refactor` 0.58 · `deploy` 0.34 (R-D6). `deploy` at 0.34 says agents are
poor at deploys — and deploys are where a service account runs *interactive* sessions.

### 2026-09-08 — implemented (AFK build, wave 9)

All six gates green; 48 new tests. **A21 is asserted as an absence, four ways**, because an absence
needs a set of things that would be present if it were violated. The fixture gives the five
WorkTypes five distinct rates over equal denominators, so every shape a synthesised cross-WorkType
figure could take is an identifiable value: the mean of the five (66%) and the pooled counts it
would be made of appear nowhere; no region or heading name matches
`/\ball\b|overall|average|combined|every|aggregate|total/i` and exactly five regions exist; the
panel is handed five tiles and renders five (asserted again at two); and the authored modules are
scanned for any `reduce`/`filter`/`sort`/`concat`/`flatMap`/`Math.max|min` and for any non-`import
type` reach into `@/domain` or `@/data`. **There is no expression in the rendering layer that could
produce the figure.**

**Panel 6 states its restriction twice and neither sentence is authored in the rendering layer** —
the ViewModel's own note, and a pill whose text is the field's literal type (`"interactive"`), so
the label cannot be wrong. Both survive an emptied chart, because R-V9 replaces the chart and not
the panel. T-C1 holds on its mirror, and the panel-level cross-check T-U20 makes possible is
asserted too: each mirror column summed equals the slice total printed beside it, and the three
together equal the printed machine allocation.

Stacking is asserted as an absence in the panel's own source — `work-presence.tsx` contains no
`stackId` and no `stackable`; the stack arrives through `chart.stackable`.

**R-N13's shared axis was not actually honoured, and this ticket found it.** `ChartFrame` had no
way to be told a measure extent, so Recharts scaled each of the five multiples to its own maximum.
At `?grain=month` they render 0–100%, 0–80%, 0–100%, 0–100%, 0–60% — **`deploy` at 33% draws
exactly as tall as `implementation` at 67%**. Fixed on `main` afterwards (`measureDomain` on
`ChartFrame`, fed from the ViewModel's `acceptanceAxis`, so the scale stays a domain fact). Until
then the panel carried a `role="meter"` rail per tile with `aria-valuemin`/`max` from the same
axis, which is the comparison the panel exists for on a genuinely shared scale — and it is retained,
because it is machine-readable where the chart geometry is not.

Design: durations lead and shares follow on panel 6, because three percentages rounded
independently sum to 101% as often as 100%, and a panel whose case for stacking is that its parts
sum exactly should not print a total that looks wrong.

**Spec note:** R-N13 says a selector "would hide four of five values"; this ticket's text says
"five of six". Five is right — `research` was cut, so there are five WorkTypes, and `spec.md` says
four hidden. Nothing depends on it; the ticket carries the other number.
