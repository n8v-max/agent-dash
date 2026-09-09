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
  - **Scaffolded 2026-09-07** (commit `69dad0c`), infra only. **Next 16.3.4, not 15** —
    Turbopack is the stable default there, so ticket 14's bundler constraint is satisfied by
    construction rather than by a flag. Verified against Recharts 3.10.1.
    → ticket 14 § Amendment. Node pinned to **24.x** (Vercel's current default; 20.x
    deprecates 2026-10-01). Hosting still Vercel, still uncontested.
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
- **Repository is a first-class aggregation dimension**, ~~carrying a *work domain* label
  (mobile / DS / BE / FE / infra config)~~. **The work-domain label was reversed 2026-09-07 by
  ticket 16**: Repository is flat, and nature-of-work is carried by `Repository × WorkType` plus
  the repository name. → `docs/adr/0004-repository-carries-no-work-domain.md`
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

- **Information architecture and route map** ([ticket 07](issues/07-information-architecture.md),
  2026-09-07, HITL): the keystone's successor, settled over five rounds. **Routes vary by question
  only** — the subject never appears in a path, which is what the archived v1 map got wrong by
  mixing three datapoint classes with one subject scope. **The product is multi-tenant and `demo`
  is an Organization slug**, not a demo mode: the org sits in the path, the org root *is* the
  summary, and tenancy that lived only in a token would be invisible in exactly the artefact a
  reviewer inspects. Six surfaces — `/` landing, `/sign-in`, `/demo`, `/demo/spend`, `/demo/work`,
  `/demo/people` — with `/demo/history` (raw AgentSession rows) and `/demo/projection` **behind a
  header ellipsis** as secondary. **The fourth headline tile is Completed Tasks by WorkType**, top
  4 + "Other": rework rate leaves the headline because it can flatline, and session counts were
  refused because 05 established they rise when work goes badly. **Controls are declared per page**
  and every one serialises to the query string, so a bare route is valid and a shared link
  reproduces what the sender saw; state does not persist across pages. **Series cap is top 4 +
  "Other", ranked over the whole range and fixed across buckets**, which closes 14's `key={index}`
  legend-identity bug by construction — filtering is how a viewer reaches past the cap, and the cap
  never lifts. **Acceptance rate renders as small multiples**, one per WorkType, so its
  incomparability is visible in the layout rather than in a caption. **Two accounts, two JWTs,
  server-side enforcement**, a 404 rather than a 403 on org mismatch so tenancy does not leak, and
  navigation identical for both so the matrix acts in the data layer. → amends 05 (fourth tile,
  per-page filters, default ordering, projection ships) and 06 (restricted preset reinstated).
  **Recorded gap:** the four disjoint token classes and per-session model mix appear on no surface.

- **Repository work-domain vocabulary and the Model roster** ([ticket
  16](issues/16-work-domain-and-model-roster.md), 2026-09-07, HITL): **half the ticket was cut
  rather than filled.** **Repository carries no work-domain label and no roll-up level** — one
  label per repo is false because a repo runs several technologies at once, and several labels
  break additivity on every chart grouped by them. `Repository × WorkType` already meets the
  standard brief 15 set, and the technology signal survives in the repository *name*:
  `terraform-infra` at 0.44 acceptance against `web-console` at 0.78 is a finding the reader
  discovers rather than reads off an axis label. → `docs/adr/0004`. **`Cohort` is cut entirely** —
  with the filter set fixed at `Repository × Team × WorkType` on every surface it named nothing the
  filters do not; Repository now carries the similarity relation. **Model roster: seven models,
  three vendors, every tier cross-vendor (2/2/3)** — `tier` has no precedent, so a tier holding one
  vendor would be a coincidence rather than a claim. **`family` carries the vendor** (`Claude
  Opus`, `OpenAI GPT-5`, `Gemini Pro`), because vendor appears at no other level and a bare
  `Opus` legend makes the reader supply it. **Real model names**, since the tier bet is only
  checkable against models a reader has opinions about. **Token card: one input price per model,
  uniform ratios (read 0.1× / write 1.25× / output 5×), frontier over fast exactly 200×.**
  **Compute card `general`/`compute`/`memory`/`storage` at $0.30/$1.20/$0.90/$0.45 per hour, never
  displayed**; `machine_spec` added to the session's launch labels, because the card had no key
  without it. **Seat fee $39/human/month, flat.** **Both cards period-stable** — a mid-window change
  would make a spend rise ambiguous between usage and price, and no surface can say which. Token
  card displays on `/demo/spend` only; **"illustrative rates" on the card, "estimated" on projection
  alone.** → `CONTEXT.md` §§ Organisation & People, Work, Models & Money, Aggregation Dimensions.

- **Fixture grain and schema** ([ticket 10](issues/10-fixture-grain-and-schema.md), 2026-09-07,
  HITL): the last ticket on the map. **Equilibrio**, slug `demo`, `Europe/Madrid`, **12 Apr – 8 Sep
  2026**, 4 Teams / 20 Members (18 human, 2 service) / 5 Repositories / 5 WorkTypes / ~600 Tasks /
  **~750 sessions on an adoption ramp** — median 0 sessions per Member-week in April rising to 2 in
  August. That is 10× smaller than first proposed and the trade runs both ways: charts are sparse,
  so **day grain is restricted to ranges of two months or less**; but seat cost lands at ~48% of
  Total spend and dominates April outright, which is the sharpest finding in the product and a
  high-volume fixture would have buried it. **Cost is attributed upstream and stored on the session
  row; the application prices nothing** — this **reverses ticket 08** and the previous `CONTEXT.md`
  position that cost is derived and never stored. → `docs/adr/0005`. The cost is recorded rather
  than discovered: the pricing function was this map's named "cleanest unit-test target", and the
  tests that replace it assert **aggregations, not billing totals**. **Teams and Members are
  many-to-many and Team is non-additive** — a primary Team was proposed and rejected as an
  invention, so the product states the overlap instead. **Every artefact is on GitHub**: no
  `document`, no Jira, Tasks are GitHub Issues keyed `owner/repo#number`, and **`research` was cut
  from the WorkType vocabulary** as collateral, since with no document it could accept on nothing
  but a comment. `deploy` accepts on a **default-branch commit**, not a merged PR it never opens;
  the three code types now share "PR published" and are therefore comparable with each other.
  **Findings the data must carry**: acceptance 0.86 review → 0.34 deploy, and 0.78 `web-console` →
  0.44 `terraform-infra`; frontier models take **56% of token spend on 15% of tokens**, falling
  25%→10% across the window; rework 18%, decomposition 12%; all four Incomplete-Task age buckets
  occupied; one seat-holder under 5 sessions; ~20 CPU-heavy token-light sessions; ~2% hidden
  sessions **generated then excluded**, so the exclusion rule has something to be tested against.
  **Files follow provenance**: sessions as platform events, one file per (repo × work_type) ordered
  by timestamp, all 25 present with `[]` for empty pairs; members/teams/repos/issues as
  GitHub-shaped mocks with a simplified envelope; the rest as internal-API mocks. Seeded generator,
  **committed output**, tests read the output and never run the generator.
  **Chart rules handed to the build**: no stacking anywhere, no pie charts anywhere, side-by-side is
  fine, Team groupings state the overlap, and the **top-4 + "Other" cap applies only above five
  series**.

**Research tickets 01–05 are resolved (01–04, 15), and six HITL tickets (14, 12, 08, 05, 16, 10) are answered.**

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
| — | ~~16 vocabularies and roster~~ | grilling | **resolved 2026-09-07** |
| — | ~~10 fixture grain and schema~~ | grilling | **resolved 2026-09-07** |
| — | ~~07 IA and route map~~ | grilling | **resolved 2026-09-07** |
| — | ~~05 metric set~~ | grilling | resolved |
| — | ~~06 role presets~~ | grilling | **wontfix, partly amended by 07** — a second, restricted preset is reinstated so the matrix is exercised |
| — | ~~09 testing architecture~~ | grilling | **wontfix** — unit targets inherited from 05 and 08; the computation/rendering seam is undrawn |
| — | ~~11 zero-data state~~ | prototype | **wontfix** — no designed empty state; the `demo` org always carries data |
| — | ~~13 token normalisation~~ | grilling | **wontfix** — boundary documented, not built; no vendor-shaped fixture rows |

**Updated again 2026-09-07: 07 resolved.** 16 now leads, unblocks 10, and 10 is the last thing
the spec needs. 07 also handed 10 two new fixture requirements — an Organization slug, and two
Member accounts holding distinct scopes.

## The map is closed — 2026-09-07

**16 and 10 both resolved. No open tickets remain, and nothing is left to decide before specs can
be written.** The destination stated at charting is reached.

Two settled positions were reversed on the way out, and both are recorded as ADRs because a future
reader will otherwise wonder what happened to them:

- **ADR-0004** — Repository carries no work-domain label. Contradicts this map's own charting
  decision and brief 15's argument for the dimension.
- **ADR-0005** — session cost is attributed upstream, not derived. Contradicts ticket 08 and the
  previous `CONTEXT.md`. **This is the map's largest outstanding exposure**, and it compounds the
  one already recorded against ticket 09: the project has now discarded both its named cleanest
  unit-test target *and* the ticket that would have drawn the computation/rendering seam, while
  test coverage remains one of three stated grading criteria. The replacement targets — non-additive
  Team roll-ups, the comparability intersection, timezone-bounded period edges, per-capita
  denominators excluding service accounts — are named in ticket 10 but have no owning ticket.

**The `/to-spec` handoff is done — 2026-09-07.** Three specs and 22 implementation tickets landed;
see **Handoff shape** for what was decided at the boundary and what the specs had to settle
themselves. Both exposures recorded above — ticket 09's undrawn seam and ADR-0005's unowned
replacement test targets — are now carried by named artefacts rather than by this map.

**The discard with the most exposure is 09.** Test coverage is one of the three stated grading
criteria, and while five unit-test targets are already named by 05 and 08, nobody has drawn the
seam between metric computation and rendering. Recorded there in full.

## Handoff shape

`/to-spec` and `/to-tickets` are named in this map's Destination but **are not installed skills in
this environment**. The handoff was therefore manual, and per `docs/agents/issue-tracker.md` it
landed as files in this repo rather than in a tool.

**Done 2026-09-07.** The naming and splitting this section left unsettled — *"the first thing
`/to-spec` would have decided"* — was decided as **three specs plus tickets**, mirroring the
assignment's steps 1–4 one to one, because the second interview reads the work against those steps:

- `.scratch/agent-dash/spec.md` — requirements (step 1)
- `.scratch/agent-dash/technical-spec.md` — technical implementation (step 2)
- `.scratch/agent-dash/testing-spec.md` — testing (step 3)
- `.scratch/agent-dash/issues/17-*.md` … `38-*.md` — 22 implementation tickets (step 4), numbered
  on from this map's own ticket 16 in the same feature directory

**Two things the specs settled that no ticket owned.** Both were recorded here as exposure on the
way out, and both were carried, not inherited:

- **The computation/rendering seam** — ticket 09's largest open item. Drawn in `technical-spec.md`
  § 3 as a **ViewModel boundary**: components receive fully resolved, serialisable ViewModels and
  have nothing in scope to compute with. Enforced by an ESLint import rule, not by convention.
- **The four ADR-0005 replacement unit-test targets** — non-additive Team roll-ups, the
  comparability intersection, timezone-bounded period edges, per-capita denominators excluding
  service accounts. Named by ticket 10 with no owning ticket; now first-class in
  `testing-spec.md` § 3.2 and owned by tickets 23 and 26.

**Five conflicts between settled sources were found and resolved**, each in favour of the later
decision, and each recorded in `spec.md` § 11 rather than silently applied: the series cap's
threshold (07 vs 10), "Cost by Repository work domain" (07 vs ADR-0004), the "estimated" marker on
attributed money (07 vs ADR-0005), the comparator's key (07 vs ADR-0004), and the restricted
preset's grants (06/07 vs 10). The fourth is the only one resolved by judgement rather than by
recency, and is flagged as an open question for the human.

### Grilled to close — 2026-09-07

The handoff's own open questions were then grilled, with two facts checked by sub-agent rather than
asserted: the model roster against live vendor lists, and the whole settled corpus swept for
contradictions the spec author missed. Ten decisions, all confirmed by the human.

**Three more 07-vs-later conflicts surfaced and are recorded in `spec.md` § 11** as C6–C8: who holds
`access`, `quarter` as a period, and stacking. All three had been resolved silently by the first
draft, two of them wrongly.

- **`self` is now granted over every class, to every Role, always** — a model invariant, not a preset
  property. It fixes a real defect: scopes are not a ladder, so the restricted preset as ticket 10
  wrote it resolved *no* Member by name, and `/demo/people` would have rendered with no people on
  it. It also puts the permission matrix in front of the one viewer who needs it. → `CONTEXT.md`
  § Access
- **Stacking is narrowed, not banned.** Ticket 10's "no stacking, anywhere" was reasoned from *"Team
  is not a partition"* — an argument about false claims, not about stacking. WorkType and the three
  duration spans are partitions, so the rule became **stack only partitions**, and the ViewModel
  carries `stackable` as a domain fact rather than a styling choice.
- **`quarter` is dropped** — it never entered the glossary and yields two partial buckets over the
  window.
- **The comparator survives, re-keyed**, and its population is now a glossary term: **Comparison
  group**. → `CONTEXT.md` § Aggregation Dimensions
- **The expandable `/demo/history` row is reinstated**, closing the recorded gap that the four token
  classes and per-session Model mix appeared on no surface.
- **ADR-0006** — the computation/rendering seam is a ViewModel, not a function call. Ticket 09's
  open item, finally owned.
- **ADR-0007** — the model roster is re-picked so the 200× spread is real. Ticket 16's own
  version check found three of its seven strings did not exist and its "exactly 200×" was
  manufactured by compounding errors at both ends; the true spread was ~20×. Shape kept, contents
  replaced.

Six mechanical errors were also fixed, the sharpest being a rate-card row whose input price
contradicted its own derived columns and had been propagated into two specs as a hard invariant.

## Not yet specified

- **Landing copy and positioning.** The hero currently reads "Ship faster. Know why." — written
  before the product had a point of view. Revisit once 01/03 land.
- ~~**In-browser performance envelope.**~~ **Closed 2026-09-07 by ticket 10.** 150 days at
  session grain across 20 Members is ~750 rows — comfortably tractable client-side. The live
  constraint turned out to be the opposite one: too *few* rows per bucket, which is why day grain
  is restricted to ranges of two months or less.
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

- **Tenancy is a Membership, and the Viewer type is nominal** ([ticket
  58](issues/58-viewer-tenancy-is-not-enforced-on-the-member.md), 2026-09-10, HITL scope): the
  finding ticket 56 recorded, fixed. `resolveViewer` checked the token's `org_slug` against the
  `[org]` path and then looked the Member up **across the whole dataset**, so a token minted for
  one Organization naming a Member of another resolved signed-in. Vacuous in practice — one
  Organization seeded, `Member` carrying no Organization at all — and **that vacuity is why nothing
  caught it**, which is the transferable lesson rather than the bug.
  **The human widened the fix twice and narrowed it once.** Member↔Organization became
  **many-to-many** via a `memberships.json` join file carrying the **Role per pairing** — because
  the same person may be an owner in one Organization and a contractor in another, and a `role`
  field on `Member` would have to pick one of those to be true. A second Organization in the
  fixture was asked for, then withdrawn: **one dataset, slug still `demo`, display name now
  "Equilibrio S.L."** — which demonstrates R-A1's "slug, not a mode" claim better than a rename
  would, because the two are now visibly different strings.
  **The cost, recorded rather than glossed:** with one Organization seeded no Member can hold two
  Memberships, so the switcher's Organization-switch group **never renders in the shipped app**. It
  has unit coverage against a hand-built two-Organization `Dataset` and no e2e coverage, and the
  regression test was verified to fail when the Organization predicate is removed — ticket 58 § 4
  asked for exactly that and it was the easy thing to skip. The mint path was closed on the same
  terms as the reading path, since closing one alone leaves the artefact issuable.
  **58-B folded in:** `Viewer` is now branded with a non-exported `unique symbol`, so `queries.ts`'s
  claim that it "is producible only by `resolveViewer`" is half type-enforced and half convention —
  and the comment now says which half is which. → R-A1 § Amendment, `docs/security.md` § 6.

- **Ticket 08 closed** (2026-09-10, bookkeeping): it carried `partially resolved` for three days
  after ticket 16 answered both of its remaining items on 2026-09-07 — Repository work domain cut,
  Model roster settled at seven models over three vendors. No new reasoning; the status line was
  simply stale. → [ticket 08](issues/08-dimension-taxonomies.md) § Closed.

