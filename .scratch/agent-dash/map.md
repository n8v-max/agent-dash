# Map: agent-dash

Label: `wayfinder:map`
Charted: 2026-09-05

## Destination

**Nothing left to decide before specs can be written.** The map closes when every open
decision about *what this dashboard is and how it is structured* is settled and recorded.

Downstream, outside this map: `/to-spec` collapses these decisions into requirements /
technical / testing / fixture specs, `/to-tickets` slices those into implementation tickets,
and the build runs in its own sessions.

## Notes

**This map does not carry execution.** Plan-don't-do is in force with no override. Any ticket
here that reads "build the X" is mis-typed. Product code is written after the map closes, in
separate sessions, from a spec.

**Domain**: an org-level analytics dashboard for an imaginary cloud agent-execution platform.
Take-home for ForGood AI. Graded on: how valuable and usable the solution is, test coverage,
and the quality of the human decisions.

**Read first**: `CONTEXT.md` (glossary — the model is non-obvious and two-dimensional) and
`docs/adr/`. **Ignore `.scratch/_archive/`** — superseded, and its tickets contain
agent-written answers.

**Every session must consult**: `grilling` + `domain-modeling` for `wayfinder:grilling`
tickets; `prototype` for prototype tickets; `codebase-design` for ticket 09.

**Term collision**: `Task` is a *product* entity in this domain (the unit of work a Member
asks an agent to do — see `CONTEXT.md`). It is unrelated to the `wayfinder:task` ticket type.
There are currently no `wayfinder:task` tickets on this map.

**Standing preference**: the human answers HITL tickets. Do not pre-answer a grilling or
prototype question in the ticket body — that failure is why v1 of this map was archived.

## Decisions so far

Settled at charting (2026-09-05), before any ticket existed:

- **Destination is decisions, not code.** Map hands off at `/to-spec`; the assignment's own
  step 4→5 boundary. → this file
- **Prior Q1–Q22 are a draft, not settled input.** Cheap-to-reverse choices carried forward
  (Next.js, Vercel, local JSON fixtures, Vitest + Playwright); load-bearing ones reopened.
  → `.scratch/_archive/handover-v1.md`
- **Access is a two-dimensional matrix**, not a role ladder: (subject scope × datapoint class).
  Roles are named presets over it, expressed as data. → `CONTEXT.md` § Access
- **Peer visibility covers `jobs`, never `cost`.** → `docs/adr/0001-peer-visibility-excludes-cost.md`
- **Product spine is cost control; the differentiator is joining cost to efficacy.**
  Cost alone is a billing page every competitor already has.
- **Task → AgentSession is one-to-many**, so that Rework is measurable. "Job" is the UI alias
  for Task. → `CONTEXT.md` § Work
- **Multi-vendor model routing, stored at exact-model grain**, with `family` / `tier` roll-up
  labels and a user-facing zoom control. Model choice is the speed/cost lever, so abstracting
  it away destroys the insight. Rate cards are illustrative and labelled as such.
  → `CONTEXT.md` § Models & Money
- **Repository is a first-class aggregation dimension**, carrying a *work domain* label
  (mobile / DS / BE / FE / infra config). Nature-of-work is what makes it analytically
  valuable. → `CONTEXT.md` § Aggregation Dimensions
- **Public surface thinned**: `/demo` and a minimal landing earn their place; the OAuth-like
  signup flow does not.

Resolved tickets:

- **Competitive metric landscape** ([ticket 01](issues/01-competitive-metric-landscape.md),
  2026-09-05): engineering-analytics vendors role-gate effort-cost and none ships peer-visible
  cost; AI-platform vendors do the opposite and rank users by spend by default. GitHub Copilot
  is the lone exception, with a k-anonymity floor of five. Agent efficacy is a category-wide
  blank — nothing surveyed exposes labelled task success or retry counts. Corrected a factual
  error in ADR-0001 and graduated ticket 12.
- **Agent & LLM platform usage/cost reporting**
  ([ticket 02](issues/02-agent-platform-usage-cost-reporting.md), 2026-09-05): the industry
  converged on usage-in-tokens plus cost-in-money, with cost at daily grain only. Rate cards are
  keyed on far more than model. Vendors disagree on whether input tokens are disjoint or a
  superset, so naive cross-vendor sums double-count — graduated ticket 13. No vendor offers a
  family or tier roll-up, making that part of this model a bet rather than a convention. ~200×
  input-price spread across tiers confirms model mix as the dominant cost lever.
- **JTBD and demo legibility** ([ticket 03](issues/03-jtbd-and-demo.md), 2026-09-05): the
  productivity premise is contested at Tier A (METR: 19% slower while feeling 20% faster; two
  2026 studies opposite), which is itself the argument for measuring one's own org. The
  aggregated/identified boundary is the best-evidenced finding and validates the access matrix —
  but over-aggregation is a documented failure mode too, so the target is a band: aggregate above
  the individual, disaggregate below the company. Cadence is unmeasured; the money jobs look
  event-driven rather than habitual. Ten seconds, not thirty, is the real legibility filter.
- **Charting library fit** ([ticket 04](issues/04-charting-library-fit.md), 2026-09-05):
  **Tremor is disqualified** — 20 months without a release, React 19 excluded by its own peer
  range, its co-founder pointing net-new work at shadcn/ui, and its one open chart bug sitting
  inside the `categories.map()` loop that a roll-up switch drives through. ECharts is out on a
  live, un-advisoried supply-chain compromise. Every candidate passed the dynamic re-grouping
  test, so maintenance health was the discriminator, not capability. Final choice between
  shadcn/Recharts 3 and Observable Plot graduated to ticket 14.

**All four research tickets are resolved. The remaining frontier is entirely HITL.**

## Not yet specified

- **Landing copy and positioning.** The hero currently reads "Ship faster. Know why." — written
  before the product had a point of view. Revisit once 01/03 land.
- **In-browser performance envelope.** 180 days at session grain across 20 members may or may
  not be tractable client-side. Sharpens once fixture grain (10) is decided.
- **Onboarding beyond the empty state.** Distinct from ticket 11, which is only the zero-data
  *view*. Whether there is a first-run flow at all is downstream of IA (07).
- **Demo-mode role switching UX.** How a visitor moves between role presets on `/demo` without
  auth. Downstream of 06 and 07.
- **Responsive scope and theming.** Breakpoint targets, dark mode. Low stakes; deliberately
  left dim until the component inventory exists.

## Out of scope

- **Quota, budgets, and enforcement.** This is an analytical dashboard, not a control plane.
  Cost *projection* stays in; cost *limits* are out.
- **OAuth-like signup flow and role-picker ceremony.** Demonstrates plumbing, not product;
  a plain role switcher covers it.
- **`/features`, `/compare`, `/pricing`.** The dashboard is the value demonstration.
- **Role authoring UI.** Permissions are data and the matrix is rendered read-only; CRUD forms
  are not the interesting part of the idea.
- **Real GitHub OAuth or live API integration.** Fixture data throughout.
- **Alerting and notifications.** Follows quota out of scope.
- **The build itself.** The destination boundary — see Notes.
