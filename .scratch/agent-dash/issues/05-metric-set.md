Type: grilling
Status: open
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
