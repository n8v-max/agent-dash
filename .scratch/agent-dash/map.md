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
- ~~**Peer visibility covers `jobs`, never `cost`.**~~ **Reversed 2026-09-05 by ticket 12**, in
  two steps. Individual usage and spend are now **open org-wide by default, symmetric, to every
  Member**. ADR-0001 and ADR-0002 are both superseded, retained for their reasoning.
  → `docs/adr/0003-individual-visibility-is-open-by-default.md`
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

- **Charting library selection** ([ticket 14](issues/14-charting-library-selection.md),
  2026-09-05, HITL): **shadcn/ui charts on Recharts 3**, decided on stack coherence and schedule.
  Plot's re-grouping and bundle wins were traded away, not refuted, so the roll-up spike (flip one
  chart 20→4 series, watch the legend) becomes the cheapest risk reduction available and belongs
  early in the build. The `--chart-1..5` ceiling is closed by **capping visible series at top-N +
  "Other"** rather than extending the theme — a better chart independently of the bug, but N and
  the "Other" behaviour are left to 05/07. Day-one patches deferred to encounter **except** the
  `v4`/`base-*` scaffold, which is a setup constraint, not an encounterable defect: the legacy
  styles pin deprecated `recharts@2.15.4` and would silently reverse this decision. Turbopack is
  mandatory (both Next 15 blockers are webpack-only). Accessibility is a requirement, not a
  tiebreaker: a roll-up-naming `aria-label` plus a **visually-hidden table mirror**, which doubles
  as the assertion target that lets 09 assert chart *output* rather than presence.

- **Aggregate re-identification, and the visibility position** ([ticket
  12](issues/12-aggregate-reidentification.md), 2026-09-05, HITL): **no minimum-population floor,
  and individual usage and spend are open org-wide by default.** Every Member holds `org-member`
  scope over `jobs`, `tokens` and `cost`; visibility is symmetric, with no administrative tier
  seeing more than an ordinary Member. The subtraction attack the ticket was opened to close is
  obsolete rather than defended — the identified figure is shown directly.
  Reached in three steps, and the two rejected positions are the substance: ADR-0001's strict line
  fell to its own Known gap (every documented 2026 failure was a *ranking*, and it conceded it
  took the stricter line "on judgement, not evidence"); ADR-0002's per-class comparison model fell
  as elaborate machinery for withholding one number. → `docs/adr/0003`, which folds in both.
  Carried forward: **no anti-ranking guardrail** — declined, not endorsed, Goodhart exposure
  recorded in full. **The matrix is the mechanism, not the default**, so restricted Role presets
  ship alongside the permissive one to demonstrate it — ticket 06. **`cohort` is demoted** from a
  subject scope to an aggregation dimension: a viewer-keyed comparison group over work domain and
  template, gating nothing. Enforcement is data-layer.
  → `CONTEXT.md` §§ Access and Aggregation Dimensions.

- **Actionable signal landscape** ([ticket 15](issues/15-actionable-signal-landscape.md),
  2026-09-05): charted mid-session and answered clean-slate — the researcher was blocked from
  briefs 01–04 so that convergence would mean something. **The field ranks named engineers by
  default and publishes the rationale** (Google Workspace default-on since 2026-02-16, top bucket
  literally "the top 10% of users"; Anthropic's `user_cost_report` sorted by spend by default;
  Cursor `/leaderboard`; Cline "TOP SPENDING USERS"). Justifications are always enablement or
  budget, never evaluation. **Every alert in the field fires on money** — nothing alerts on
  failure, rework or quality across ~15 vendors. Anthropic and OpenAI **publicly disagree on the
  headline metric**, OpenAI listing LOC and accept rate under "what it does not provide". Thirteen
  gaps raised as questions to 05/08, of which **seat cost** is the sharpest: seat fees are
  invisible to usage APIs, so usage-derived cost-per-engineer distorts the *ordering*, not just
  the total. **GitHub's ≥5 floor — 01's most transferable finding — was sunset 2026-04-02**, which
  corroborates 12's no-floor decision rather than undermining it. Corrected `CONTEXT.md`: `family`
  now has vendor precedent (Anthropic spend CSV, FOCUS 1.5 draft `ModelFamily`); **`tier` does
  not, and the bet is stronger for it.**

- **Session data model — inputs and outputs** ([ticket 08](issues/08-dimension-taxonomies.md),
  2026-09-07, HITL): the AgentSession fact table settled end to end, grounded in a field
  inventory of Claude Code OTel, the Claude Code Analytics API, Devin, Cursor, Copilot and
  Cline. **`AgentTemplate` is renamed `WorkType`** — the configuration *is* the class of work,
  so it is one dimension rather than two; `vendored`/`user_tuned`/`api_provided` demoted from a
  roll-up level to a provenance label. Flat and global: repo-specific variants were declined,
  since a WorkType behaving differently per repo is a finding to surface, not a reason to
  multiply cardinality. **Declared at launch, not classified post-hoc** — the two vendors with
  this dimension (Devin's `category`, Cursor's `workTypes`) both classify at teardown, and
  declaring it is the deliberate divergence, because the label must exist *before* the session
  in order to bootstrap its skills and prompt prefix. **Task is externally keyed** and launch is
  blocked without a tracker issue, so multi-session analysis is never undermined by missing
  keys; the platform explicitly does **not** own the external issue's lifecycle, which is what
  keeps every session row immutable. **`execution_mode: interactive | headless`** is a session
  property independent of `Member.kind` (`human` / `service_account`), following Cursor's
  `isHeadless` rather than the RPA attended/unattended pair, which no agent vendor uses.
  **Acceptance is split from terminal status** — a session can exit cleanly and produce nothing
  — which in turn splits multi-session Tasks into **Rework** (retry of the same WorkType after
  a non-accepted session) and **Decomposition** (several accepted sessions), converting ticket
  05's stated doubt about rework into two separate findings. Tokens stored as four disjoint
  classes and summed for display; cost derived, never stored. Three human-presence duration
  spans; machine allocation stored but unpriced and out of the MVP display.
  **Cut:** cost centre (isomorphic to Team), interruption counter (no vendor ships one),
  repo-scoped templates, `on_behalf_of` attribution. → `CONTEXT.md` §§ Work, Models & Money,
  Metric Concepts.
  **Corrects brief 01:** "efficacy is a category-wide blank" no longer holds — Devin ships
  `category`, `status_detail` and `num_user_messages` as first-class session fields, and Cursor
  ships `workTypes`/`categories`/`complexity`. The differentiator is not unoccupied ground; it
  is ground occupied by two vendors, **neither of whom joins it to cost**.
  **Still open in 08:** the Repository work-domain vocabulary and the Model roster.

- **The metric set** ([ticket 05](issues/05-metric-set.md), 2026-09-07, HITL): the keystone,
  settled over five rounds. **Headline is four tiles arranged as the thesis** — Total spend ·
  Completed Tasks · Cost per completed Task · Rework rate — two money, two efficacy, with the
  third being the differentiator itself. **`terminal_status` is cut**: a session is `accepted` or
  it is not, and sessions that fail on infrastructure are **hidden**, their cost absorbed by the
  platform. That achieves by exclusion what 08 wanted an enum for, and frees `completed` for Task
  grain. **Machine allocation is now priced** against an undisplayed compute rate card keyed on
  machine spec, and folds into session Cost — which is what makes the CPU-heavy, token-light
  session detectable at all. **Seat cost is modelled**, humans only, as a component of Total spend
  at monthly grain and coarser, never inside session Cost; it unlocks the sharpest finding in the
  product, that a seat held against near-zero usage is the highest cost per unit of work in the
  org. **Cost per completed Task** answers G3, with waste in the numerator and not the
  denominator. **Rework drops its same-WorkType clause.** **Incomplete Task** is an umbrella
  reported by age bucket, because the platform does not own the external Task's lifecycle and
  cannot tell in-flight from abandoned. **Ranking exists but never by default** — tables sort by
  cost and tokens; no surface defaults to it and no percentile labels are computed. **The product
  makes no productivity claim**: no pre-agent baseline exists, so only period-over-period velocity
  is observable — which retires ticket 03's "say the premise is contested" question entirely.
  **Periods fall in the Organization's declared timezone, not UTC**, and comparison is
  unrestricted with incomplete periods flagged rather than withheld; the change floor is **one**.
  **Model is a breakdown, not a comparison axis** (G11), since a session spans Models. Filters are
  per-metric and ergonomic, not a unified combinatorial set.
  **Cut:** completion rate, quality signals, org-level acceptance rate, unaccepted-spend tile,
  interruption counter, standalone seat metric, idle-time waste metric, compute-rate display,
  default-sorted top-spenders view, productivity-gain claim. Projection survives as a separate
  FinOps-first view and is MVP-optional.
  → `CONTEXT.md` §§ Work, Models & Money, Metric Concepts (rewritten).
  **Handed to 07**: view grouping, page layout, and what occupies the fourth tile when rework
  rate flatlines at 0%.

**Research tickets 01–05 are resolved (01–04, 15), and four HITL tickets (14, 12, 08, 05) are answered.**

**Collision discharged, then re-opened and discharged again.** Brief 15 was gathered clean-slate
against the `CONTEXT.md` and ADR-0001 that predate ticket 12, and its ticket asserted ADR-0001
"stands". Ticket 12 then reversed the visibility position **twice** on the same day: ADR-0001 and
ADR-0002 are now both superseded by **ADR-0003**, the `cohort` scope has been demoted to an
aggregation dimension, and § Access has been rewritten. Brief 15's *findings* remain unaffected —
they are observations about other vendors — but its Reconciliation section diffs against documents
that no longer exist in that form and must be re-read against ADR-0003.

**Brief 15 independently corroborates the final position**, which is worth recording because it
arrived after the decision and was not available to it: the field **ranks named engineers by
default and publishes the rationale** (Google Workspace default-on; Anthropic's `user_cost_report`
sorted by spend; Cursor `/leaderboard`; Cline "TOP SPENDING USERS"), and **GitHub's ≥5 floor —
brief 01's most transferable finding, and the only surveyed precedent for a floor — was sunset
2026-04-02.**

The remaining frontier is entirely HITL.

## Convergence pass — 2026-09-07

A pass over the open tickets after ticket 08 resolved, to close the distance between this map and
a writable spec. No HITL question was answered; what changed is which questions are still live and
in what order they have to fall.

**Ticket 16 charted** — *Repository work-domain vocabulary and the Model roster*
([16](issues/16-work-domain-and-model-roster.md)). The two items ticket 08 closed with as "still
open". Shape is settled, values are not: the work-domain value list and whether a Repository
carries one domain or several, and the model roster with `family` / `tier` assignments and the
illustrative rate card. A vocabulary ticket, not a modelling one.

**Ticket 13 downgraded and narrowed.** It was charted as a correctness question blocking the
fixture. Ticket 08 wrote most of its answer into `CONTEXT.md` § Models & Money — four disjoint
classes, cache-write TTL collapsed, rate-card key collapsed to (model × token class), precision
loss stated rather than discovered, cost derived and never stored. What survives is a scoping
question, not a correctness one: what happens to an un-normalisable vendor reading, and how much
of the vendor-mapping boundary is *built and unit-tested* versus *documented in prose*, given the
data is fixtures throughout and no vendor reading is ever actually parsed.

**Ticket 10 re-blocked**: `05, 08` → **`05, 13, 16`**. 08 discharged the entity graph and the
grain but graduated the categorical *values* and the normalisation scoping question, which are
exactly what a fixture needs. 07 is deliberately not a blocker — 10 owns the data, not its
arrangement.

**Brief 15's thirteen gaps routed into ticket 05.** Six are discharged: G1 outcome and G2 rework
by `accepted` / `terminal_status` and the Task-retry definition; G4 by the work-domain dimension,
with its values passed to 16; G5 by `source` being provenance rather than a roll-up level; G6 by
ADR-0003's no-floor position; G13 was never open. **Seven remain live** — G3 cost per outcome
(the differentiator in metric form, and the denominator is the decision), G7 watched-versus-browsed
and its noise floor, G8 presenting uncertainty, G9 the IC's own view, G10 quality, G11 model mix as
a lever rather than a breakdown, G12 seat cost. Plus the top-spenders view, which no brief raised
and no ticket has discharged.

## Critical path to spec

Five tickets are open and unblocked; two are blocked behind them. The path is not flat — **05 is
the keystone and gates most of the remainder.**

**Updated 2026-09-07, twice.** Ticket 05 resolved, then **scope cut to three tickets.** Four
were closed `wontfix` — not answered, but defaulted, with each default and its cost recorded in
the ticket file. The map now closes after 10.

| Order | Ticket | Type | State |
|---|---|---|---|
| 1 | [07](issues/07-information-architecture.md) IA and route map | grilling | open |
| 2 | [16](issues/16-work-domain-and-model-roster.md) vocabularies and roster | grilling | open |
| 3 | [10](issues/10-fixture-grain-and-schema.md) fixture grain and schema | grilling | blocked by 16 |
| — | ~~05 metric set~~ | grilling | resolved |
| — | ~~06 role presets~~ | grilling | **wontfix** — one permissive preset ships; the matrix is documented, never exercised |
| — | ~~09 testing architecture~~ | grilling | **wontfix** — unit targets inherited from 05 and 08; the computation/rendering seam is undrawn |
| — | ~~11 zero-data state~~ | prototype | **wontfix** — no designed empty state; `/demo` always carries data |
| — | ~~13 token normalisation~~ | grilling | **wontfix** — boundary documented, not built; no vendor-shaped fixture rows |

07 leads because 05 handed it three decisions outright — view grouping, page layout, and what
occupies the fourth headline tile when rework rate flatlines. 16 then unblocks 10, and 10 is the
last thing the spec needs.

**The discard with the most exposure is 09.** Test coverage is one of the three stated grading
criteria, and while five unit-test targets are already named by 05 and 08, nobody has drawn the
seam between metric computation and rendering. Recorded there in full.

## Handoff shape

`/to-spec` and `/to-tickets` are named in this map's Destination but **are not installed skills in
this environment**. The handoff is therefore manual, and per `docs/agents/issue-tracker.md` it
lands as files in this repo rather than in a tool. The assignment's step 1–4 map onto four
artefacts:

- `.scratch/agent-dash/spec.md` — requirements
- the technical implementation spec
- the testing spec, which is ticket 09's output written as requirements rather than as a decision
- the step-by-step plan, which becomes `.scratch/<slug>/issues/NN-*.md` implementation tickets

Naming and splitting of the middle two is itself unsettled and is the first thing `/to-spec` would
have decided. It is recorded here rather than left to be discovered at the boundary.

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
