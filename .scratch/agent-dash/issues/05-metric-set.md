Type: grilling
Status: resolved
Blocked by: 01, 02, 03
Label: wayfinder:grilling

# The metric set

## Question

Which metrics does this dashboard show, to which cells of the access matrix, at which grain —
and which candidate metrics are deliberately excluded?

## What has to come out of it

- The metric inventory, each one defined precisely enough to implement and test.
- Which datapoint class (`jobs` / `tokens` / `cost`) each belongs to, since that is what gates
  visibility.
- Which are headline and which are supporting — a dashboard that ranks nothing is a metrics dump.
- How cost and efficacy are actually *joined*, that being the stated differentiator.
- Period semantics: comparison windows, and how projected spend is computed and caveated.
- The exclusions, with reasons. What was considered and rejected is the part an interviewer probes.

## Constraints already settled

Spine is cost control; the differentiator is joining cost to efficacy (map, Decisions so far).
Quota and enforcement are out of scope, so a metric implying a limit has nowhere to land.
Rework is measurable because Task → AgentSession is one-to-many.

## Inputs handed over by resolved tickets

**From ticket 01 (2026-09-05)** — two questions this ticket now has to settle explicitly:

1. **Is the line "no per-person cost" or "no *ranked comparative* per-person cost"?** Every
   documented 2026 failure (Meta's "Claudeonomics", Amazon's "KiroRank") was a failure of
   ranking. No source isolates non-comparative individual visibility as harmful, and Microsoft's
   response was to move the *target* to division level while keeping individual visibility.
   ADR-0001 currently takes the stricter line on judgement, not evidence. Meanwhile Gartner
   (June 2026) reports $200–500/dev/month token spend and argues discipline "will not emerge
   through developer choice alone." Both pressures are real and the literature does not
   reconcile them.

2. **Efficacy is unoccupied ground.** Nothing surveyed exposes a labelled task-succeeded/failed
   field or a retry count; acceptance rate is the universal proxy and its critique traces to no
   primary study. This project *can* measure Rework because Task → AgentSession is one-to-many.
   That is either the strongest differentiator available or a sign the metric is harder to make
   trustworthy than it looks — decide which, deliberately.

**From ticket 02 (2026-09-05)** — constraints the metric set must respect:

- Vendors report usage to the minute but **cost only at daily grain**. Any cost metric finer
  than a day is a fiction; decide whether to inherit that honesty or diverge and say why.
- **Projected spend is a forecast product, not a run-rate.** AWS publishes an 80% prediction
  interval and refuses to forecast at all without a full billing cycle; Azure ships bare linear
  regression with no interval. If this dashboard projects, it owes the viewer an uncertainty
  statement — a naked projected number is the least defensible tile on the page.
- Cost derived from telemetry is **estimated** everywhere and labelled so.
- Billing period is calendar-month at 00:00 UTC nearly everywhere, with real exceptions
  (subscription anniversaries; Google's Pacific-with-DST day boundary).

**From ticket 03 (2026-09-05)**:

- **The premise is contested at Tier A** — METR found 19% slower against a 20%-faster belief;
  two 2026 studies found large gains. That disagreement is arguably this product's reason to
  exist: an org has to measure itself. Decide whether the dashboard says so out loud.
- **Over-aggregation is a failure mode too.** The target is a band — aggregate above the
  individual, disaggregate below the company. A metric that only ever shows an org total fails
  the same paper that warns against individual grain.
- **The money jobs look event-driven, not habitual.** Nothing measures dashboard open frequency.
  A metric set designed for a daily ritual may be designed for a cadence nobody has.
- **Acceptance rate measures whether code was taken, not whether it was good** — and Rework and
  success rate are constructs *no shipped product reports*. Confirmed independently by 01 and 03.

## Blocked by

01, 02, 03 — **all resolved 2026-09-05. This ticket is now on the frontier.**

**From ticket 12 (2026-09-05, HITL)** — two of this ticket's queued questions are now answered,
and one new problem lands squarely here:

- **Question 1 above is settled, and not in ADR-0001's favour.** The line is neither "no
  per-person cost" nor "no ranked comparative cost" — **no structural guardrail against ranking
  was imposed at all**. The access model neither mandates nor forbids a leaderboard. That decision
  was recorded as *declining to prohibit*, explicitly leaving the call to this ticket. So: does a
  top-spenders view ship? The Goodhart evidence is unmitigated and is now this ticket's to weigh —
  Amazon's KiroRank raised compute spend with no matching value, which is a cost-control dashboard
  causing the exact harm it exists to prevent.
- **The comparison population differs by class.** `tokens` compares across a viewer-keyed
  **cohort** (work domain / template / both, spanning Teams); `cost` compares within a **Team**,
  per-capita for Members, named only at team-level access. Every metric in the inventory has to
  declare which unit it uses — a metric with no defensible comparison population is not
  implementable.
- **No population floor**, so no metric needs a suppression rule or an n-threshold caveat.
- **The largest unresolved cost of ticket 12 is a metric problem.** Token volume is now the most
  widely visible cross-person figure — but ticket 02's **~200× input-price spread across tiers**
  means volume is a poor predictor of spend. So the product's most visible comparative metric
  serves **adoption intensity**, not cost control, and cost control is the spine. Either find the
  metric that makes cohort comparison speak to money (cost-per-outcome at cohort grain? efficiency
  against a same-work baseline?), or state plainly that the cohort surface answers a different
  question than the headline. Do not leave this implicit.

**Correction — ticket 12 was reversed after the note above was written (2026-09-05).** The
per-class comparison model is withdrawn: there is no `tokens`-at-cohort / `cost`-at-team split.
**Individual usage and spend are open org-wide by default, to every Member, symmetrically**
([ADR-0003](../../../docs/adr/0003-individual-visibility-is-open-by-default.md)).

What this changes for the metric set:

- **The ranking question is now unavoidable, not deferred.** With named per-person cost visible to
  everyone, this ticket decides whether a top-spenders view ships. The access model declined to
  forbid it. Brief 15 found the field ranks by default and justifies it as *enablement or budget,
  never evaluation* — so the live question is whether this product adopts that framing or declines
  the view on the Goodhart evidence (Amazon's KiroRank raised their compute bill).
- **`cohort` survives as a comparison group, not a permission.** "Compare me against people doing
  comparable work" remains the most defensible framing for a per-person metric, and it is now a
  presentation choice this ticket owns rather than an access rule.
- **Seat cost is now load-bearing** (brief 15). Seat fees are invisible to usage APIs, so
  usage-derived cost-per-engineer distorts the **ordering**, not just the total. A product
  publishing named per-person spend to everyone is publishing that ordering whether or not it
  renders a leaderboard. Decide explicitly whether seat cost is modelled.
- **Every alert in the field fires on money; nothing alerts on failure, rework or quality**
  (brief 15, ~15 vendors). Still the clearest unoccupied ground, and unaffected by the reversal.


**From ticket 08 (2026-09-07, HITL)** — the session data model is settled, and it changes what
this ticket has to decide:

- **Efficacy has a field now.** `accepted` (per-WorkType acceptance criterion) is separate from
  `terminal_status`, so **acceptance rate** and **completion rate** are different metrics and
  this ticket must not conflate them. Acceptance is only comparable *within* a WorkType.
- **Rework is trustworthy after all**, which retires this ticket's queued doubt. `accepted`
  splits multi-session Tasks into **Rework** (retry of the same WorkType after a non-accepted
  session) and **Decomposition** (several accepted sessions) — two findings from one shape,
  where the raw session count was ambiguous between them.
- **Token totals are an adoption measure, not a cost proxy**, and that is now an explicit
  position rather than an oversight: the displayed figure sums four disjoint classes, so it
  weights a cache read like an output token. Cost carries the money.
- **Machine allocation is stored but out of the MVP display.** Any metric this ticket wants from
  it is a post-MVP expansion, and utilisation is *not* derivable from the three human-presence
  duration spans.
- **AFK time must be scoped to `interactive` sessions.** Headless sessions are 100% AFK by
  construction, so an unscoped AFK metric only rediscovers `execution_mode`.
- **The ranking question is untouched by 08 and still lands here.**

## Brief 15's thirteen gaps, routed (2026-09-07)

Brief 15 raised G1–G13 as open questions addressed to this ticket and to 08. Ticket 08 has since
resolved, and it discharged six of them outright. Routing the list so this ticket carries what is
actually still live rather than all thirteen.

**Discharged — closed, with the answer and where it lives:**

| Gap | Discharged by | Answer |
|---|---|---|
| G1 outcome of an attempt | 08 | `accepted` and `terminal_status`, both at AgentSession grain, deliberately different numbers |
| G2 rework | 08 | Defined on retries of a Task at the same WorkType after a non-accepted session. The Git-churn branch, with its two-to-three-week lag, was not taken |
| G4 roll-up above Repository | 08 | Work domain. Its *value list* is now ticket 16, not this one |
| G5 configuration provenance | 08 | `source` (`vendored`/`user_tuned`/`api_provided`) is provenance metadata, not a roll-up level. Nothing groups by it, so the cardinality problem Anthropic solved by redaction does not arise |
| G6 peer-aggregate and the k-anonymity floor | 12 / ADR-0003 | No floor. `org-member` over `jobs`, `tokens` and `cost` is the default grant, so there is no aggregate-only tier to size |
| G13 what the individual actually did | brief 15 itself | Nothing open; the field is consistent and this product follows it |

**Live, and this ticket's to answer:**

- **G3 — cost per outcome.** The stated differentiator, in metric form. Not one surveyed product
  reports cost per completed unit of work, while DORA, Faros, Vantage, CloudZero and the FinOps
  Foundation all ask for it by name. **The denominator is the decision**: accepted AgentSession,
  Task, or merged PR. 08 makes the first two internal and free; the third is sourced from Git,
  which this platform does not own. Note that acceptance is only comparable *within* a WorkType,
  so a single org-wide cost-per-outcome number needs an argument for existing at all.
- **G7 — watched versus browsed.** Alerting is out of scope, so the alert half is closed; the
  design half is not. If any metric is intended to be *watched*, this ticket names it and states
  how a change in it is distinguishable from noise. Every vendor shipping anomaly detection had
  to set an explicit floor (Vantage $5 + 0.5%; Datadog daily minimum 5; LiteLLM $10). A trend
  arrow with no noise floor is the same claim without the honesty.
- **G8 — presenting uncertainty.** Rate cards here are illustrative by decision, so this is not
  reconciliation to a real invoice; it is whether a derived cost figure renders as one number or
  carries the estimate/actual distinction the field found necessary. Ticket 02 already binds the
  harder case: a projection without an interval is the least defensible tile on the page.
- **G9 — the IC's own view.** Under ADR-0003 the field's opt-in default is moot, but the shape
  question is untouched and has one precedent each way: the admin's metric set at a narrower
  subject scope (Anthropic, Augment) or a genuinely different metric set (Devin Coach). Shared
  with ticket 06.
- **G10 — quality.** Nothing in the field exposes a defect, revert or change-failure rate. Either
  this product carries no quality signal, or it takes one from inside its own data (where the
  only proxies are review-activity counts) or from Git and incident systems (where the
  research-backed signals live, at the cost of a dependency it does not own). 08 declined to
  model WorkType drift and recorded it as future work, which narrows but does not settle this.
- **G11 — model mix as a lever, not a breakdown.** 08 kept all three roll-up levels but did not
  say what they are *for*. A tier's share of spend is uninformative without knowing what work it
  did, so a tier-level comparison needs a normalising denominator — which is G3's denominator
  again, applied at a different grain. The roster itself is ticket 16.
- **G12 — seat cost.** Already flagged above as load-bearing. Is Cost marginal consumption only,
  or does it acknowledge a fixed component? Seat fees are invisible to usage APIs, so a
  usage-derived per-engineer figure distorts the **ordering**, not just the total — and under
  ADR-0003 that ordering is published to everyone whether or not a leaderboard is rendered.

**Plus the one question no brief raised and no ticket discharged: does a top-spenders view ship?**
Recorded above under ticket 12's correction. It is the last undecided product question with a
straight yes/no, and it is the one an interviewer will reach for first.

## Answer

Resolved 2026-09-07, HITL, over five grilling rounds. Terms graduated into `CONTEXT.md`
§§ Work, Models & Money and Metric Concepts.

### The inventory

| Metric | Class | Grain and scoping |
|---|---|---|
| Total spend | `cost` | Session Cost + Seat cost. Monthly grain and coarser only |
| Cost per session | `cost` | Filters: WorkType, Repository, `accepted`. Aggregates to day / week / month |
| Cost per completed Task | `cost` | The join. Filter: presence of a WorkType |
| **Completed Tasks per period** | `jobs` | Velocity. Raw by default, per-capita on toggle |
| Acceptance rate | `jobs` | **Within a WorkType**, always. Over time aggregates |
| Rework rate | `jobs` | Task grain |
| Decomposition rate | `jobs` | Task grain |
| Incomplete Tasks | `jobs` | Bucketed by age since last session |
| Tokens processed | `tokens` | Sortable column and time series. Adoption, not cost |
| Model mix | `tokens` | Distribution at exact / family / tier |
| Session duration | `jobs` | Median and p95 |
| Human-presence spans | `jobs` | Composition, **`interactive` sessions only** |
| Projected cost | `cost` | Separate FinOps-first view. MVP-optional |

### Headline

Four tiles, arranged as the thesis — two money, two efficacy, and the third is the
differentiator itself:

**Total spend · Completed Tasks · Cost per completed Task · Rework rate**

Each carries a period-over-period change. The same four serve the individual, team and
organisation views. **The fourth slot is provisional**: rework rate may flatline at 0%, which is
dead space at a ten-second read, so what occupies it is ticket 07's call.

### Decisions, and what each one closed

**The session has one outcome field.** `terminal_status` is cut, and with it completion rate. A
session is `accepted` or it is not. Sessions that fail on platform or infrastructure faults are
**hidden**: the platform absorbs their cost, the Organization is not billed, and they appear in
no metric. This achieves by exclusion what ticket 08 wanted an enum for — acceptance rate becomes
a clean measure of *agent* efficacy with no platform noise in it. It also removes the
`completed` collision, freeing the term for Task grain.

**Cost is three things, at two grains.** Session Cost = token cost + machine cost, blended.
Machine allocation is now **priced**, against a compute rate card keyed on machine specification
that is never displayed — rates vary by spec and the breakdown is not something a viewer should
reason about. Pricing it is what makes the CPU-heavy, token-light session detectable at all;
unpriced it was a duration nobody compared against money. Seat cost sits outside session Cost as
a component of **Total spend**, at monthly grain and coarser only.

**Seat cost is modelled, and it pays for itself immediately** (brief 15's G12). Seats attach to
`human` Members only. The finding it unlocks: a seat held against near-zero usage is the highest
cost per unit of work in the organisation, and a consumption-only model cannot see it. It also
fixes the per-capita denominator.

**Cost per completed Task is the answer to G3.** Denominator is the Completed Task, not the
merged PR — 08 already made a published pull request the acceptance criterion for
`implementation`, so a PR denominator both duplicates that and imports a Git dependency the
platform does not own. Attempts that produced nothing sit in the numerator and not the
denominator, so waste raises the figure. That is the mechanism.

**Rework loses its same-WorkType clause.** Rework is a non-accepted session followed by another
session in the same Task, of any type. Requiring the same class of work was too strict: a failed
`research` session followed by an `implementation` session is still a second attempt at the same
Task. Consequence accepted: the rate runs higher than the strict reading would give.

**Incomplete is an umbrella, on purpose.** A Task with no accepted session may be in flight or
abandoned, and the platform cannot tell — it does not own the external Task's lifecycle. Rather
than invent a cutoff, report the count bucketed by age since the last session and let the reader
conclude. Age carries what the label cannot claim.

**Ranking exists but is never the default.** Per-member tables sort by total cost and by total
tokens, because transparency and expectation-matching argue for it and ADR-0003 already opened
the data. But no surface defaults to sort-by-spend, no tile is titled "top spenders", and no
Member carries a computed percentile label. Every documented 2026 failure was **default-on
ranking as the headline** — Amazon's KiroRank raised compute spend with no matching value — not
the ability to sort a table. The product ships the data and declines to editorialise an ordering.

**The product makes no productivity claim.** Measuring a gain needs a pre-agent baseline, and the
dashboard's window is entirely agent-assisted, so no baseline exists. Only period-over-period
velocity is observable. This retires ticket 03's question of whether to say the premise is
contested out loud: the product never asserts the premise, so it has nothing to litigate. It is
also the more defensible position than either side of the METR disagreement.

**Model is a breakdown, not a comparison axis** — resolving G11. A session may span several
Models, so grouping a per-session metric by Model would attribute one session's cost to one model
unsoundly. Model mix stays a distribution at all three roll-up levels. This confirms ticket 12's
"distribution display, not a filter" for a reason that ticket did not have.

**Filters are per-metric and chosen for ergonomics**, not a single unified dimension set applied
combinatorially. The shared-set proposal was rejected: it optimises for implementation symmetry
over the viewer.

**Period boundaries fall in the Organization's declared timezone.** Not UTC. An organisation's
"last month" should be the month its people worked. Aggregation is therefore a pure function of
(rows, timezone) — a clean unit-test target for ticket 09 and a required fixture field for 10.

**Comparison is unrestricted; incompleteness is flagged, not withheld.** Any period may be
compared with any other. The change floor is **one**: a change figure is suppressed only when the
prior period holds nothing at all. Above zero it is shown — two to three sessions week-over-week
really is +50%, and on a narrow self-view that is the honest reading rather than noise. This is
the answer to G7, and it is deliberately looser than the field's: every vendor shipping anomaly
detection sets a magnitude floor, but those exist to gate *alerts*, and alerting is out of scope
here.

**The self view is the individual view with comparators.** Same metric set at `self` scope, plus
the cohort comparator, which answers *"am I heavy or light on work like mine"* — a question that
only has meaning from a personal vantage. Answers G9. Shared with ticket 06.

**Projection is a separate, FinOps-first view and may not make the MVP.** It is proportional to
the period elapsed. Deliberately not on the core surfaces: ticket 02 is right that a projected
number is the least defensible thing on a page, and the mitigation chosen is to move it off the
page rather than to dress it.

### Exclusions

| Cut | Reason |
|---|---|
| `terminal_status`, completion rate | Infra failure is the platform's cost. Hiding those sessions gives a cleaner acceptance rate than an enum would |
| Quality signals — defect, revert, change-failure rates | Internal proxies are review-activity counts, which are not quality. The research-backed signals need Git and incident systems, at a two-to-three week lag and a dependency the platform does not own. `bugfix` WorkType is a lateral proxy, noted, out of MVP |
| Organisation-level acceptance rate | WorkType-scoped by definition; an org-wide figure averages incommensurable criteria |
| Model as a group-by or filter on any per-session metric | A session spans Models. Unsound attribution |
| Unaccepted-spend tile | Derivable from cost per session with the `accepted` filter. No third ratio |
| Interruption counter | No surveyed vendor ships one; `prompt_count` is the standing proxy |
| Standalone seat-cost metric | A component of Total spend, not a metric |
| Idle time as a waste metric | A real signal, held back to keep the surface small. Named expansion |
| Compute rate card display | Varies by machine spec; not something a viewer should reason about |
| Default-sorted "top spenders" view | Ranking available by sorting; the product does not editorialise an ordering |
| Productivity-gain claim | No pre-agent baseline exists in the data |
| Year-over-year as a *restriction* | Not excluded — comparison is unrestricted, incompleteness is flagged |

### Handed downstream

- **07 (IA)** — view grouping and page layout, including whether human-presence spans and machine
  time share one view; and what occupies the fourth headline tile when rework rate is flat.
- **06 (role presets)** — the self view's shape, shared with G9.
- **10 (fixture)** — Organization timezone as a field; the compute rate card keyed on machine
  spec; seat fee; hidden sessions absent from customer analytics; and distributions that make
  Rework, Decomposition and a CPU-heavy token-light session all present.
- **16 (roster)** — the compute rate card joins the token rate card in scope.
- **09 (testing)** — three pure functions named: (rows, timezone) → period buckets, session
  pricing over two rate cards, and the change-floor rule.

## Amended 2026-09-07 by ticket 07 (information architecture)

Three positions taken here were changed downstream. Recorded so the change is visible rather than
discovered.

1. **The fourth headline tile is Completed Tasks by WorkType**, not Rework rate. The slot was left
   provisional here because rework may flatline at 0%. Rework rate leaves the headline entirely;
   it keeps its place on `/demo/work`. Session counts were rejected as the tile's measure, on this
   ticket's own grounds that they are not velocity.
2. **"Filters are per-metric" is superseded by per-page declared control sets.** Each page
   declares the dimensions its panels use; a control applies to every panel on that page using
   that dimension. This is not the unified combinatorial set this ticket rejected — no page shows
   a control its panels cannot use — but it is a coarser grain than "per metric".
3. **"No surface defaults to a ranking" is amended.** `/demo/people` defaults to Completed Tasks
   descending. That is an ordering by output rather than by spend, and no percentile label is
   computed, but it is an ordering the product chose. The rest of the position holds: no tile is
   titled "top spenders", and no surface defaults to sort-by-cost.
4. **Projection ships.** Left MVP-optional here; it ships as a secondary surface behind the header
   ellipsis at `/demo/projection`, with the method and the elapsed fraction stated and no
   confidence band. Nothing else depends on it.

Also discharged: **human-presence spans and machine time share one view**, on `/demo/work`.
