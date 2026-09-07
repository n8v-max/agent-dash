Type: implementation
Status: ready-for-agent
Blocked by: 31
Label: ready-for-agent

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
hide five of six values and make a viewer click to discover that the comparison is not offered.

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
