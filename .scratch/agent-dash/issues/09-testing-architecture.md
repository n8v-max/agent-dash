Type: grilling
Status: wontfix
Label: wayfinder:grilling

# Testing architecture and seams

## Question

Where are the seams that make this codebase testable, and what does "good test coverage" mean
for a fixture-backed analytics dashboard?

## What has to come out of it

- The seam between metric computation and rendering. Aggregation, roll-up switching and
  permission filtering are pure functions over fixture rows; whether they are actually isolated
  as such is the single highest-leverage structural decision here.
- Where permission enforcement lives, and how it is tested. A permission matrix is a
  combinatorial surface — asserting it by clicking through the UI does not scale.
- What each layer is responsible for proving: unit, component, e2e.
- What is deliberately not tested, and why.
- Whether chart *output* is asserted or only chart presence, and what that costs either way.
- How determinism is guaranteed, given fixtures are generated.

## Why it matters here

Test coverage is one of three stated grading criteria, and it is the one most often bolted on
afterwards. Deciding the seams before the spec is written is what makes coverage a property of
the architecture rather than a number chased later.

## Inputs handed over by resolved tickets

**From ticket 04 (2026-09-05)** — concrete, and they change how the chart layer is tested:

- **The jsdom sizing problem has a robust answer and a fragile one.** shadcn's `initialDimension`
  win evaporates the moment `vitest.setup.ts` polyfills `ResizeObserver`. Fixed numeric
  `width`/`height` (the `StaticDiv` path) needs zero mocks and does not interact with setup files.
  Worth deciding deliberately, because the fragile path fails in a confusing way later.
- **A roll-up switch is assertable**: `getAllByLabelText(/legend icon/)` is the best available
  handle on "did the series set actually change." That makes the central interaction testable at
  component level rather than only in Playwright — which bears directly on the seam question.
- **Recharts 3 has two open Next 15 blockers (#6117, #6316) that are webpack-specific**; the
  reporter states Turbopack is unaffected. A build-tool choice is therefore load-bearing for
  whether the test and dev stack works at all.
- shadcn's default legend uses `key={index}` — wrong for a legend whose entries change identity
  on toggle. A test that pins legend identity across a roll-up switch would catch it.

## Skills

Consult `codebase-design` alongside `grilling` and `domain-modeling` for this one.

**From ticket 14 (2026-09-05, HITL)** — the library is settled, which turns several of 04's
conditionals into facts:

- **shadcn/ui charts on Recharts 3.** The Plot branch of this ticket is closed; no
  `toHyperScript()` shim, no imperative-wrapper testing story.
- **A visually-hidden `<table>` mirror of the grouped data is in scope** as an accessibility
  requirement. That is very likely this ticket's answer to "is chart *output* asserted or only
  chart *presence*" — a table mirror is queryable DOM, so output becomes assertable without
  parsing SVG or falling back to Playwright. Decide whether that is the primary assertion or a
  secondary one.
- **`key={index}` legend keys are live**, since the day-one patches were deferred to encounter.
  A test that pins legend *identity* across a roll-up switch is what converts that deferred patch
  from a silent bug into a caught one — React will otherwise reconcile "Team A" into "Team B" in
  place. This ticket owns whether that test exists.
- **Turbopack is mandatory** (both open Next 15 × Recharts 3 blockers are webpack-specific), so
  the build-tool question 04 raised is answered and no longer load-bearing here.
- **Visible series are capped at top-N + "Other".** Series cardinality in tests is therefore
  bounded and known, which makes legend assertions tractable.
- Still open and owned here: `initialDimension` vs fixed numeric `width`/`height`. 14 recorded
  that the `ResizeObserver`-polyfill failure is confusing rather than loud, but did not decide.

**From ticket 05 (2026-09-07, HITL)** — three pure functions are now named and are this ticket's
most obvious unit-test targets:

1. **(rows, timezone) → period buckets.** Period boundaries fall in the Organization's declared
   timezone, not UTC, so day/week/month bucketing is a function of two inputs and is the one place
   an off-by-one is both easy to write and invisible in a chart.
2. **Session pricing over two rate cards.** Token cost from four disjoint classes against the
   token card, plus machine cost against the compute card, blended into one figure.
3. **The change-floor rule.** A change figure is suppressed only when the prior period holds
   nothing. Floor of one, not a magnitude threshold.

Also relevant: **hidden sessions** — infra-failed sessions absent from every metric — are a
filtering rule that must hold across the whole data layer, which is the kind of invariant that is
cheap to assert once and expensive to click through.

## Closed 2026-09-07 — wontfix

Scope cut to the top three tickets. **Recorded with a reservation**: test coverage is one of the
three stated grading criteria in the assignment, so this is the discard with the most exposure.

**The default that now applies**, assembled from decisions already made rather than from this
ticket:

- **Unit tests target the three pure functions ticket 05 named**: `(rows, timezone) → period
  buckets`, session pricing across the token and compute rate cards, and the change-floor rule.
  Plus the two ticket 08 named: the `WorkType → artefact kind` comparability intersection, and
  the hidden-session filter.
- **Chart output is asserted through the visually-hidden `<table>` mirror** that ticket 14 put in
  scope as an accessibility requirement. It is queryable DOM, so no SVG parsing and no fallback
  to Playwright.
- **Fixed numeric `width`/`height` for charts under test**, not `initialDimension`. This was the
  one item genuinely still open here, and it is settled by default on ticket 04's finding that
  the `ResizeObserver`-polyfill failure mode is confusing rather than loud.
- **Determinism** comes from fixtures being authored and committed rather than generated at test
  time.

**What that costs.** Nobody has decided where the seam between metric computation and rendering
sits. The intent — pure functions over fixture rows, isolated from React — is implied by the list
above but is not architecture until someone draws it. The specific risk ticket 14 flagged also
goes untested: shadcn's default legend uses `key={index}`, so React will reconcile "Team A" into
"Team B" in place across a roll-up switch, and only a test pinning legend *identity* catches it.
