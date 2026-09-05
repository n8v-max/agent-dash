Type: grilling
Status: open
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
