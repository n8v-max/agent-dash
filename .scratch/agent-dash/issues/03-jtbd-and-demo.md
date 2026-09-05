Type: research
Status: resolved
Label: wayfinder:research

# Jobs-to-be-done, and what makes a demo land

## Question

What jobs does an engineering organisation actually hire an agent-usage analytics dashboard to
do — and what makes an analytics demo legible to a non-technical viewer within thirty seconds?

## Scope

**JTBD.** For each vantage point in this product's access model (an individual engineer, a team
lead, an org-wide reader with cost visibility, an org administrator): what decision or
recurring question brings them to a dashboard like this, how often, and what they do with the
answer. Ground this in published material — practitioner writing, vendor case studies, research
on how engineering leaders use metrics — not invention.

**Demo legibility.** What is known about how analytics products open: what a first-time viewer
looks at first, what makes a dashboard read as insightful rather than as a wall of tiles, how
long the attention window actually is. Any documented patterns for public no-auth demo routes.

## Why it is being asked

Directly blocks information architecture (07): the route structure is being decided *from* the
jobs rather than from the datapoint classes. Also feeds the metric set (05) and the landing
copy currently sitting in the map's fog.

## Deliverable

A brief at `.scratch/agent-dash/research/03-jtbd-and-demo.md`, sources cited. Do not design the
IA or pick the metrics — those are human decisions on 07 and 05.

## Answer

Brief: [`.scratch/agent-dash/research/03-jtbd-and-demo.md`](../research/03-jtbd-and-demo.md)
— 864 lines, ~170 cited URLs, every source tiered A–D with vendor marketing labelled inline.
Resolved 2026-09-05.

Gist:

- **The premise is contested at Tier A.** METR's RCT found experienced devs **19% slower** with
  AI while believing they were 20% faster — a ~39-point felt/measured gap. Two 2026 arXiv studies
  point the other way (+24% merged PRs at Microsoft; 2.09× at a mandate-driven firm). Three
  strong results disagreeing is the best argument that an org must measure **itself**.
- **The aggregated/identified boundary is the best-evidenced finding in the brief**, and it maps
  onto this project's access matrix. Google's stated practice: *"no data ever leaves our team
  un-aggregated... once we aggregate, it goes onto dashboards available to anyone."*
- **Over-aggregation is its own documented failure mode.** The DevEx paper names focusing on
  companywide results instead of team and persona breakdowns as a common mistake. *Aggregate
  above the individual, disaggregate below the company* — a band, not a direction, and a
  two-dimensional matrix can express it where a role ladder cannot.
- **Weaponisation has a first-hand mechanism**, from Kent Beck at Facebook: scores → performance
  reviews → goals → managers negotiating scores with reports → teams cut on scores.
- **Evidence strength varies sharply by vantage point.** `self` is peer-reviewed (Meyer et al.,
  CSCW 2018 — 84.5% awareness gain, with peer comparison both the value and the thing needing
  de-identification). `org`+`cost` has the clearest statement anywhere. `org-member`+`access` is
  the weakest, resting only on NIST AC-6(7) and convention.
- **Cadence is an honest gap.** Nothing measures how often a leader opens a dashboard.
  Prescriptive cadences exist only for survey instruments. The money jobs look **event-driven,
  not habitual** — which cuts against a daily-ritual IA.
- **Only GitHub has a privacy floor** (teams &lt;5 excluded); Cursor, Claude Code and Amazon Q
  expose named users with none. **Microsoft Viva has two floors**, separating "who gets a view"
  from "which cells suppress" — a direct precedent for ticket 12.
- **Acceptance rate measures whether code was taken, not whether it was good.** Rework and
  success rate are constructs no shipped product reports — independently confirming ticket 01.
- **Demo legibility**: 30s is defensible (Liu/White/Dumais, SIGIR 2010) but the real filter is
  **10s**, and visual-complexity judgement lands in **17ms** — the wall-of-tiles problem,
  empirically. Borkin et al.: titles and supporting text carry the message. Folklore flagged and
  excluded: F-pattern (walked back by NNG), Miller's 7±2 (misapplied), and some NNG-attributed
  dashboard stats that appear fabricated.
- **Nine public demos surveyed; no dominant pattern and none has a persona switcher.** Long
  demos convert worst in the data/cloud sector (43 steps → 10.7%; 9 steps → 64%, vendor
  self-reported). NNG explicitly endorses "explore with demo data" as a first-run affordance.

Consequences: inputs handed to 05, 06, 07, 11 and 12. Unblocks 05, 07 and (with 02) 08.
