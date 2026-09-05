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
