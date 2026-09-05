# Research: jobs-to-be-done, and what makes a demo land

Ticket: `.scratch/agent-dash/issues/03-jtbd-and-demo.md` · Label: `wayfinder:research` · Researched 2026-09-05

**Findings only.** This brief does not propose an information architecture, a route structure, or a
metric set. Those are human decisions on tickets 07 and 05. Where a finding has an obvious design
implication I say what the evidence supports and stop; I do not pick.

**Vocabulary.** Uses `CONTEXT.md` terms exactly: Organization, Team, Member, Task (UI alias "Job"),
AgentSession, Rework, AgentTemplate, Model, TokenUsage, Cost, Permission (subject scope × datapoint
class), aggregated vs identified. Where a source uses its own words ("developer", "seat", "PR"),
that is the source's vocabulary, not a proposal to adopt it.

---

## 0. How to read the evidence in this brief

Evidence quality in this space is uneven and the unevenness is itself a finding.

| Tier | What it is | How much weight |
|---|---|---|
| **A — peer-reviewed / controlled** | SPACE, DevEx, Shneiderman, Borkin, Lindgaard, Liu/White/Dumais, METR's RCT, the two 2026 arXiv enterprise-rollout studies | Strongest available. Still mostly *not* about agent-usage dashboards specifically. |
| **B — first-party product documentation** | GitHub, Anthropic, Cursor, Amazon, Microsoft Viva Learn pages | Excellent evidence of *what the market has decided is table stakes* and *what privacy floors exist*. Not evidence that any of it works. |
| **C — credible practitioner research org** | Nielsen Norman Group, DORA, FinOps Foundation | Real studies or vendor-neutral community frameworks, but selection-biased samples. |
| **D — vendor marketing** | DX, Jellyfish, LinearB, Faros, Swarmia, Navattic, Storylane, Arcade, GitClear | Useful for *which questions buyers are told they have*, because vendors do talk to buyers. Worthless as evidence that the answers are true. Labelled inline throughout. |

**A specific caution about JTBD itself.** The jobs-to-be-done framing has no peer-reviewed
foundation. Christensen's version is a *theory* illustrated by anecdote (the milkshake story —
[HBS Online summary](https://online.hbs.edu/blog/post/jobs-to-be-done-examples)), and Ulwick's
Outcome-Driven Innovation is a *consultancy methodology* owned by the firm that sells it
([Strategyn](https://strategyn.com/jobs-to-be-done/),
[Wikipedia](https://en.wikipedia.org/wiki/Outcome-Driven_Innovation)). Its own claim to rigour is
self-issued. So: no source below states "the job of an agent-usage analytics dashboard is X". What
exists is (a) research on what engineering organisations *do* with metrics, (b) product docs
showing what vendors *built*, and (c) vendor copy naming the questions they *say* buyers ask. The
jobs below are inferred from those three; the inference is mine, and each is flagged with how
firmly it is grounded.

**One more piece of context on evidence quality.** The most-cited claim that engineering productivity
*can* be measured across companies is McKinsey's 2023 "Yes, you can measure software developer
productivity" — a consultancy marketing piece, behind a wall I could not fetch, so it is characterised
here only through the rebuttals. Those rebuttals are unusually strong and unusually unanimous: Kent
Beck with Gergely Orosz
([pragmaticengineer](https://newsletter.pragmaticengineer.com/p/measuring-developer-productivity),
[kentbeck](https://newsletter.kentbeck.com/p/measuring-developer-productivity)), Dan North
([dannorth.net](https://dannorth.net/mckinsey-review/), read second-hand), and LeadDev
([leaddev.com](https://leaddev.com/career-development/what-mckinsey-got-wrong-about-developer-productivity)).
North's objection is definitional rather than operational: *"Just don't try to measure the individual
contribution of a unit in a complex adaptive system, because the premise of the question is flawed."*
**The disagreement is itself the finding**: the question "can you measure a developer" is genuinely
contested by serious people, so a product that answers it confidently is taking a side. A product
that instead measures *the agent platform's* behaviour — Tasks, AgentSessions, Rework, Cost — is
answering a narrower question that is not contested in the same way.

---

## 1. The forcing condition: nobody can tell whether agents are working without measurement

This is the single strongest evidence-backed reason the product category exists at all, and it is
the one finding that is genuinely surprising rather than merely plausible.

- **METR's randomised controlled trial (Tier A).** 16 experienced open-source developers, 246 real
  tasks on their own mature repositories (~5 years' familiarity each), randomly assigned AI-allowed
  vs AI-disallowed. Result: *"When developers are allowed to use AI tools, they take 19% longer to
  complete issues."* The perception gap is the headline: participants **forecast a 24% speedup**
  beforehand, and **still believed they had been sped up by 20%** after doing the work — while
  actually being slowed by 19%. A ~39-point gap between felt and measured.
  [metr.org](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) ·
  [arXiv 2507.09089](https://arxiv.org/abs/2507.09089).
  METR's own caveats matter and should be repeated: small sample, one setting, early-2025 tooling
  (Cursor Pro + Claude 3.5/3.7 Sonnet), and METR has since said it is
  [changing the experiment design](https://metr.org/blog/2026-02-24-uplift-update/) and treats the
  result as dated.
- **Contrasting Tier A evidence, same year, opposite sign.** Murphy-Hill, Butler & Savelieva,
  *Adoption and Impact of Command-Line AI Coding Agents: A Study of Microsoft's Early 2026 Rollout
  of Claude Code and GitHub Copilot CLI* — tens of thousands of engineers, four-month window —
  found *"adopters merged roughly 24% more pull requests than they would have otherwise."*
  [arXiv 2607.01418](https://arxiv.org/abs/2607.01418).
- **And a longitudinal case study reaching 2×.** He, Agarwal, Denisov-Blanch, Azaletskiy, Koyejo &
  Vasilescu, *AI Writes Faster Than Humans Can Review* — 802 developers, 196,212 pull requests,
  Jan 2024–Apr 2026 at a company whose CTO mandated doubling merged PRs per engineer. Throughput
  *"reached 2.09x the pre-mandate baseline"*. But: *"per-reviewer load roughly doubled and
  automated review overtook human review, while merge and revert rates held steady."*
  [arXiv 2607.01904](https://arxiv.org/abs/2607.01904).
- **DORA 2024 (Tier C) put numbers on the double edge.** For every 25% rise in AI adoption: a
  *"2.1% increase in productivity and 2.6% increase in job satisfaction"*, but also *"a 1.5% decrease
  in delivery throughput and a 7.2% reduction in delivery stability."*
  [dora.dev/research/2024/dora-report](https://dora.dev/research/2024/dora-report/).
- **DORA 2025 (Tier C, ~5,000 respondents plus 100+ hours of qualitative work).** Google's DORA
  programme frames the whole phenomenon as *"AI's primary role is as an amplifier, magnifying an
  organization's existing strengths and weaknesses."*
  [dora.dev/research/2025/dora-report](https://dora.dev/research/2025/dora-report/).
- **Practitioner sentiment is diverging from usage (Tier C).** Stack Overflow's 2025 survey:
  *"84% of respondents are using or planning to use AI tools"* (up from 76%), yet more developers
  *"actively distrust the accuracy of AI tools (46%) than trust it (33%)"*, with positive sentiment
  down from 70%+ in 2023–24 to 60%. 66% report *"AI solutions that are almost right, but not
  quite"* and 45.2% say debugging AI-generated code is more time-consuming.
  [survey.stackoverflow.co/2025/ai](https://survey.stackoverflow.co/2025/ai).

**What this supports.** Three independent Tier-A results on the same question point in different
directions depending on population, task, and codebase maturity. That is not a reason to distrust
measurement — it is the strongest possible argument *for* an organisation measuring its own
population rather than importing a number from a report. It also means the honest job of a dashboard
here is **"tell me what is actually happening in *my* Organization"**, not "prove agents work".

**A caution the same evidence forces.** The gap between felt and measured productivity runs in both
directions. A dashboard that shows only volume (Tasks run, tokens consumed) measures enthusiasm, not
value. The 2× study's finding that reviewer load doubled while merge and revert rates held steady is
the shape of a real second-order cost that no activity metric would have surfaced.

---

## 2. Jobs, by vantage point in the access matrix

`CONTEXT.md` expresses personas as cells in a (subject scope × datapoint class) matrix, not as job
titles. Below, each vantage point is named by its scope/class reach, and each job carries a
grounding rating. **Cadence figures are the weakest part of this brief** — see §2.6.

### 2.0 The one thing every high-trust source agrees on

Before the individual vantage points: there is a rare and near-total consensus in the peer-reviewed
and primary literature about the aggregated/identified boundary. It is the best-evidenced finding in
this entire brief, and it happens to be the axis `CONTEXT.md` already built the access model around.

- **SPACE (ACM Queue 2021, Tier A):** *"Teams and organizations should be cognizant of developer
  privacy and report only anonymized, aggregate results at the team or group level."* And on activity
  counts specifically: *"Activity metrics alone do not reveal which of these is the case, so they
  should never be used in isolation either to reward or to penalize developers."* The paper frames
  individual-level analysis as legitimate only when done *for and by* the developer themselves.
  It also notes developers report productivity measures "aren't useful" because of *"misuse of
  measures by leaders or managers."*
  [queue.acm.org/detail.cfm?id=3454124](https://queue.acm.org/detail.cfm?id=3454124).
- **Google's *Software Engineering at Google*, "Measuring Engineering Productivity" chapter (Tier A-
  adjacent — Google-authored, publicly hosted):** *"The only way to make these measurements work is
  to let go of the idea of measuring individuals and embrace measuring the aggregate effect."* And
  the Goodhart mechanism stated outright: *"If productivity metrics are used for performance reviews,
  engineers will be quick to game the metrics, and they will no longer be useful for measuring and
  improving productivity across the organization."*
  [abseil.io/resources/swe-book/html/ch07.html](https://abseil.io/resources/swe-book/html/ch07.html).
  A second, load-bearing gate from the same chapter: ***"Before measuring productivity, ask whether
  the result is actionable, regardless of whether the result is positive or negative."***
- **How Google actually operates it (reported second-hand, Tier C):** *"No data ever leaves our team
  un-aggregated... once we aggregate the data, it goes out onto dashboards that are available to
  anyone."* [newsletter.getdx.com](https://newsletter.getdx.com/p/how-google-measures-productivity).
  That is close to a working precedent for the aggregated-vs-identified split: **aggregation is what
  buys broad readership.** It is the same trade `CONTEXT.md` encodes when it says a Member can
  benchmark against org-wide numbers without resolving them to people.
- **DORA (Tier C):** frames the goal as *"to improve your team's performance over time, not to compete
  against other teams or organizations"*, and cautions directly against *"setting metrics as a goal"*
  and against comparing metrics between vastly different applications.
  [dora.dev four-keys guide](https://dora.dev/guides/dora-metrics-four-keys/).
- **DX Core 4 (Tier D — vendor, but unusually blunt):** on diffs/PRs per engineer, *"It is critical
  that this metric is never used at the individual level or tied to performance evaluations."*
  [newsletter.getdx.com](https://newsletter.getdx.com/p/introducing-the-dx-core-4).

**And the counter-pressure, which is equally well-evidenced and points the opposite way.** The DevEx
paper (Noda, Storey, Forsgren & Greiler, ACM Queue 2023, Tier A) names over-aggregation as its own
named failure mode: *"A common mistake made by organizational leaders is to focus on companywide
results instead of data broken down by team and persona (e.g., role, tenure, seniority)."*
[queue.acm.org/detail.cfm?id=3595878](https://queue.acm.org/detail.cfm?id=3595878).

So the literature does **not** say "aggregate as far as possible". It says: *aggregate above the
individual, disaggregate below the company.* Those two constraints together describe a band, not a
direction — which is exactly what a two-dimensional matrix with `team` / `peer-team` / `org` scopes
can express and a single role ladder cannot.

**The documented failure mode is mechanistic, not hypothetical.** Kent Beck's account of Facebook,
published with Gergely Orosz (Tier C — practitioner, but first-hand and from the co-creator of XP),
gives the ladder step by step: scores appear → *"Then those scores started cropping up in performance
reviews"* → *"Then those scores became goals. 'Move from 4.2 to 4.5.'"* → *"Directors put pressure on
managers for better scores. Managers started negotiating with individual contributors for better
survey scores"* → outright trade (*"Give me a 5 & I'll make sure you get an exceeds expectations"*) →
*"Directors started cutting managers & teams with poor scores, whether those cuts made organizational
sense or not."*
[newsletter.pragmaticengineer.com](https://newsletter.pragmaticengineer.com/p/measuring-developer-productivity) ·
[newsletter.kentbeck.com](https://newsletter.kentbeck.com/p/measuring-developer-productivity).
DX documents a smaller-scale version: *"When a manager used Jira dashboards to rank developers by
task completion, work-in-progress spiked, code review suffered"*
([getdx.com](https://getdx.com/blog/pitfalls-of-developer-activity-metrics/), Tier D).

**The uncomfortable corollary, named only by trade press.** LeadDev states plainly what the academic
sources only warn against: *"one popular reason CTOs want to measure developer productivity is to
identify which engineers to fire"*, and that to developers being tracked *"it feels a lot like
spying, like somebody's watching."*
[leaddev.com](https://leaddev.com/career-development/what-mckinsey-got-wrong-about-developer-productivity)
(Tier C/D — trade press). This is a real gap between prescribed and actual use, and it is the single
most important thing to know about the `peer` and `org-member` scopes before designing anything into
them.

**Why the pressure toward identified metrics exists at all** — Swarmia's structural account (Tier D,
vendor, but the mechanism is plausible and matches the Beck ladder): *"the numbers travel through
layers (team lead to EM to director to VP), and context falls away at every step up"*, while
*"an enterprise leader owes the executive team a coherent, comparable picture across dozens of teams,
on a schedule."*
[swarmia.com](https://www.swarmia.com/blog/developer-productivity-enterprise-change-management/).

### 2.1 `self` scope (a Member's own data: `jobs`, `tokens`, and their own `cost`)

The best evidence for this vantage point is not from AI tooling at all; it is from a decade of
peer-reviewed work on developer self-monitoring at UZH/Microsoft/UBC.

- **Meyer, Murphy, Zimmermann & Fritz, "Design Recommendations for Self-Monitoring in the
  Workplace: Studies in Software Development", CSCW 2018 (Tier A).** Method: iterative design with
  N=20, survey N=413, three-week field study N=43 with a probe called WorkAnalytics.
  [ACM DL 10.1145/3134714](https://dl.acm.org/doi/10.1145/3134714) ·
  [author page](https://andre-meyer.ch/design-recommendations-for-self-monitoring-in-the-workplace-studies-in-software-development/).
  Its three design recommendations, verbatim from the abstract: use experience sampling to increase
  awareness about work; provide *"a large variety of different metrics to retrospect about work"*;
  and provide *"actionable insights, enriched with benchmarking data from co-workers"* to encourage
  behaviour change.
- **The lab's summarised findings across that programme (Tier A, secondary summary):** purposeful
  daily self-reflection increased developers' awareness of productive and unproductive habits
  (**84.5%**) and led to positive improvements (**79.6%**); **82%** said the retrospection increased
  awareness and gave novel insights. Developers *"preferred easy-to-grasp visualizations with one
  clear focus"* and *"too much detail turned out to be counter-intuitive"*; *"a comparison with
  other developers seems to increase the overall value of a visualization, but measures need to be
  taken to preserve the individual's privacy."*
  [hasel.dev/project/individual-productivity](https://hasel.dev/project/individual-productivity/) ·
  [UZH PersonalAnalytics](https://www.ifi.uzh.ch/en/seal/people/meyer/personal-analytics.html).
  The tool stores data *"locally on the users machine (to avoid privacy issues!)"* — a design choice
  that is itself evidence of how sharp the privacy concern is at this scope.
- **Beller, Orgovan, Buja & Zimmermann, "Mind the Gap: On the Relationship Between Automatically
  Measured and Self-Reported Productivity" (Tier A), 81 developers at Microsoft.**
  [arXiv 2012.07428](https://arxiv.org/abs/2012.07428). Exists to bridge exactly the felt-vs-measured
  gap that METR later quantified.

**Jobs inferred (grounding: strong for the general self-monitoring job; inferred for the
agent-specific version):**

| Job | Trigger | What they do with the answer | Grounding |
|---|---|---|---|
| "Am I actually getting value out of this, or does it just feel that way?" | Periodic, self-initiated; the felt/measured gap | Change how they work — model choice, task decomposition | **Strong** (Meyer; METR gap) |
| "Where is my Rework coming from?" | After a bad run; a Task that took several AgentSessions | Adjust prompting, template, or which work they hand to an agent | **Inferred** — Rework is this product's own construct; no source measures it |
| "Am I normal?" | Ambient curiosity; onboarding to the platform | Calibrate expectations; ask a peer how they do it | **Strong** that comparison adds value (Meyer); **strong** that it must be privacy-protected |
| "Is my own spend about to become someone else's problem?" | Notification of a limit; a large session | Self-throttle | **Weak** — inferred from the existence of per-user spend limits in Cursor and Anthropic's products (§3) |

**The load-bearing finding for this scope:** peer comparison is what makes self-analytics valuable,
*and* it is the thing that must be de-identified. That is precisely the aggregated-vs-identified
distinction `CONTEXT.md` already encodes, arrived at independently by a peer-reviewed study.

### 2.2 `team` scope aggregated + `peer` scope named (a Team lead)

See §2.0 first — the aggregated/identified consensus lands hardest on this vantage point, because
`peer` scope (named individual Members of one's own Team) is the exact cell every high-trust source
warns about.

- **SPACE (Tier A)** additionally argues *against* single-metric dashboards for this reader: leaders
  should track at least three dimensions simultaneously, to support *"smarter decisions and tradeoffs
  among team members"* ([ACM Queue](https://queue.acm.org/detail.cfm?id=3454124)).
- **Practitioner consensus, widely repeated (Tier C/D):** individual metrics create competition and
  encourage gaming; good dashboards focus on team and system performance. See e.g. Fowler's
  [Measuring Developer Productivity via Humans](https://martinfowler.com/articles/measuring-developer-productivity-humans.html).
- **A first-hand practitioner account of rolling one out (Tier C).** Laura Tacho, then Senior
  Director at CloudBees, deployed GitPrime/Pluralsight Flow to 300+ engineers and reports two
  mistakes: over-trusting a vendor's proprietary "impact" score, and finding the rollout *"a heavy
  lift when it came to getting her team to trust her."* Her recommended posture: *"Focus on outcomes,
  not output, but you might use output metrics like activity from GitHub and JIRA to debug why
  outcomes were missed."*
  [lauratacho.com](https://lauratacho.com/blog/using-metrics-to-measure-individual-developer-performance).
  Note the framing: activity data as a **debugging** instrument for a known-bad outcome, not as a
  standing scoreboard. That is the most concretely stated version of the team-lead job found
  anywhere.
- **A real product's answer to this exact question (Tier B), and the best precedent found.**
  Microsoft Viva Insights separates *two different floors* for a manager view:
  - **Minimum team size** — *"Only managers whose team size meets or exceeds the Minimum team size
    setting can access insights... The minimum team size must be set to at least five."* This gates
    **whether the vantage point exists at all**.
  - **Minimum group size** — *"Minimum group size helps protect individual privacy. Because it's
    easier to guess information about an individual based on results about a smaller group, we hide
    organization insights for weeks when fewer people are active... than the minimum group size...
    it also has to be at least five."* This gates **which cells render**.
    [manager-settings](https://learn.microsoft.com/en-us/viva/insights/advanced/setup-maint/manager-settings) ·
    [privacy-settings](https://learn.microsoft.com/en-us/viva/insights/advanced/setup-maint/privacy-settings).
  - Viva also ships a **Member-side opt-out** of row-level behavioural metrics — with a notable
    carve-out: *"Opt-out does not apply to Copilot usage data, which will still be available at the
    row level."* Even the most privacy-engineered product in the space treats AI-usage data as a
    different class from behavioural data.

**Jobs inferred (grounding: moderate — the questions are named by vendors, the behaviour is not
independently observed):**

| Job | Trigger | What they do with the answer | Grounding |
|---|---|---|---|
| "Has my Team actually adopted this, or do I have licences sitting idle?" | Renewal; a rollout milestone | Reassign or reclaim; nudge non-adopters | **Strong that products build for it** (§3); weak that leads act on it |
| "Who on my Team is struggling with the tooling — and who should be teaching it?" | Ongoing; retro; 1:1 prep | Pair the two together | **Moderate.** Anthropic's own docs name this: use the leaderboard to *"find team members with high Claude Code adoption who can share prompting techniques"*, and watch for *"dips in usage that may indicate friction or issues"* ([docs](https://code.claude.com/docs/en/analytics)) |
| "Is agent output creating review debt for my Team?" | Rising PR volume | Rebalance review load | **Strong that the effect is real** ([arXiv 2607.01904](https://arxiv.org/abs/2607.01904)); **no evidence** any current product surfaces it |
| "Which kinds of work do agents actually succeed at here?" | Planning; deciding what to delegate | Steer what gets handed to an agent | **Inferred.** DORA's amplifier framing and the divergent Tier-A results support the premise that efficacy varies by context; no source measures it per work domain |
| "We missed something — why?" | A specific bad outcome already known | Use activity data to diagnose, then discard it | **Moderate–strong** (Tacho, first-hand; consistent with Google's GSM loop). The only job in this table where a high-trust source recommends looking at identified activity data *at all* |

**The strongest single caution for this scope,** because it is peer-reviewed and it is about exactly
the `peer` cell: the SPACE authors and the whole self-monitoring literature converge on the same
point — comparison is valuable, identification is hazardous. `docs/adr/0001-peer-visibility-excludes-cost.md`
is consistent with that; the evidence would extend the same caution to any identified metric that
reads as a performance ranking.

**A note on leaderboards, since two products ship one.** Anthropic's Teams/Enterprise dashboard has a
top-10 *"Leaderboard: top contributors ranked by Claude Code usage"* and Cursor's analytics API
returns a leaderboard with `email` and `line_acceptance_ratio` and `rank` (both Tier B, §3).
Anthropic's own docs frame its purpose as finding people who can *"share prompting techniques"* —
i.e. teaching, not ranking. Every Tier-A source in §2.0 says a visible per-Member ranking is the
mechanism by which a metric becomes a target. Both facts are true simultaneously; the tension is real
and is a decision, not a finding.

### 2.3 `org` scope with `cost` (an org-wide reader with cost visibility)

The clearest statement of this job in the entire literature is the opening sentence of a Tier-A
paper's abstract, and it should probably be quoted verbatim in any downstream spec:

> *"Organizations rolling out agentic command line tools like Anthropic's Claude Code and GitHub's
> Copilot CLI need to know who will try them, who will keep using them, and whether the tools
> produce enough output to justify their cost. At organizational scale, token spend can run into
> millions of dollars annually, so misreading adoption, retention, or impact can make a rollout
> expensive without changing engineering velocity."*
> — [arXiv 2607.01418](https://arxiv.org/abs/2607.01418)

That is three jobs in one sentence: **adoption**, **retention**, **cost-justified impact**.

Corroborating evidence:

- **Order-of-magnitude, first-party (Tier B).** Anthropic's own cost documentation: *"Across
  enterprise deployments, the average cost is around $13 per developer per active day and $150-250
  per developer per month, with costs remaining below $30 per active day for 90% of users."*
  [code.claude.com/docs/en/costs](https://code.claude.com/docs/en/costs). At 200 engineers that is a
  budget line an exec notices.
- **The same doc names the divergence this product's spine depends on** — that Model choice, session
  length and caching are the levers between token volume and money: it lists long context, cache
  misses, model default left on the expensive tier, and idle-session behaviours as the causes of
  *"unexpectedly high spend"*, and its per-model `/usage` breakdown is keyed by Model exactly as
  `CONTEXT.md` describes TokenUsage. (Tier B.)
- **FinOps Foundation, "FinOps for AI" (Tier C, vendor-neutral community).** Applies
  Inform → Optimize → Operate to token spend; names tagging/attribution of every call to
  team/feature/service, **showback and chargeback**, anomaly detection, and — most relevant —
  recommends **cost-per-output** metrics over raw total spend.
  [finops.org/wg/finops-for-ai-overview](https://www.finops.org/wg/finops-for-ai-overview/) ·
  [token-economics](https://www.finops.org/wg/token-economics-saas/).
- **Vendors selling into this job (Tier D, marketing).** Jellyfish markets token spend *"by tool,
  team, or initiative"* and *"defensible ROI data instead of vendor-reported activity metrics"*
  ([jellyfish.co](https://jellyfish.co/platform/jellyfish-ai-impact/ai-token-usage-monitoring/));
  Faros markets *"Token Intelligence"* to *"trace every AI dollar to shipped outcomes"* and reports —
  as its own finding, unverified — that *"any correlation between AI adoption and key performance
  metrics evaporates at the company level"* ([faros.ai](https://www.faros.ai/blog/ai-software-engineering));
  DX frames buyer pain as three questions: *"Which tools are working?"*, *"How are they being
  used?"*, *"What's actually driving value?"*
  ([getdx.com whitepaper](https://getdx.com/whitepaper/ai-measurement-framework/)).

| Job | Trigger | What they do with the answer | Grounding |
|---|---|---|---|
| "Is this spend justified by output?" | Budget cycle; renewal; board or exec reporting | Renew, expand, cut, or renegotiate | **Strong** (arXiv 2607.01418; FinOps cost-per-output; every vendor in the category) |
| "Where is the money going — which Teams, which Models, which work?" | Monthly close; a spend spike | Chargeback/showback; change default Model; investigate | **Strong** (FinOps; Anthropic Console groups spend by workspace for chargeback) |
| "Did adoption stick, or was it a novelty spike?" | Post-rollout, ~1–4 months | Continue or re-launch the rollout | **Strong** (arXiv 2607.01418 explicitly tests retention over a four-month window) |
| "Which Teams are outliers — high spend, low output, or the reverse?" | Ad hoc | Go ask that Team | **Moderate** (FinOps anomaly detection; Jellyfish/Faros marketing) |

Note the *first-party framing of the same job*: Anthropic's analytics docs say contribution metrics
*"help answer 'Is this tool worth the investment?' with data from your own codebase"* and list three
uses — *"demonstrate ROI, identify adoption patterns, and find team members who can help others get
started."* [code.claude.com/docs/en/analytics](https://code.claude.com/docs/en/analytics). (Tier B.)

### 2.4 `org-member` scope + `access` class (an org administrator)

Weakest-evidenced vantage point of the four, and worth saying so plainly: I found **no** study of
what administrators do with an analytics permission model. What exists is compliance practice and
product precedent.

- **NIST SP 800-53 Rev. 5, AC-6(7) "Review of User Privileges" (Tier A-equivalent — a standard, not
  a study):** *"Review [organization-defined frequency] the privileges assigned to
  [organization-defined roles and classes] to validate the need for such privileges; and reassign
  or remove privileges, if necessary, to correctly reflect organizational mission and business
  needs."* The frequency is deliberately left to the organisation. Its rationale: circumstances
  change, so periodic review confirms the original justification still holds.
  [csf.tools mirror of AC-6(7)](https://csf.tools/reference/nist-sp-800-53/r5/ac/ac-6/ac-6-7/) ·
  [AC-2 Account Management](https://csf.tools/reference/nist-sp-800-53/r5/ac/ac-2/).
- **Practice-level cadence (Tier D — compliance-tooling vendors, consistent with each other but all
  selling access-review software):** general user access reviews at least **quarterly**, privileged
  accounts **monthly or continuous**, standard applications semi-annual or annual; ad-hoc reviews
  triggered by reorgs, layoffs and M&A; and the auditor's requirement that *if you claim quarterly
  reviews you must produce evidence for every quarter in the window*. See
  [Vanta](https://www.vanta.com/resources/how-do-you-perform-quarterly-access-reviews),
  [AccessOwl](https://www.accessowl.com/blog/detailed-guide-to-soc-2-access-reviews),
  [Torii](https://www.toriihq.com/articles/soc2-access-reviews). Treat the *shape* (periodic +
  event-triggered) as reliable and the specific numbers as vendor convention.
- **Product precedent (Tier B):** Viva Insights gives the admin exactly two levers — who is eligible
  for a vantage point (minimum team size) and which cells suppress (minimum group size) — plus
  end-user opt-out. Anthropic's Claude Code dashboard is **Admin/Owner-only** on Teams/Enterprise,
  and on the Console requires the `UsageView` permission granted to *"Developer, Billing, Admin,
  Owner, and Primary Owner roles"* ([docs](https://code.claude.com/docs/en/analytics)).

| Job | Trigger | What they do with the answer | Grounding |
|---|---|---|---|
| "Who can see what, and is that still right?" | Periodic review; reorg; joiner/mover/leaver; audit | Reassign or remove a Permission | **Moderate** (NIST AC-6(7) mandates the review; cadence is vendor convention) |
| "Can I explain the model to someone who is worried about being surveilled?" | A Member asks; a works-council or privacy question | Show the matrix | **Inferred**, but strongly implied by Viva shipping opt-out and dual floors, and by the self-monitoring literature's privacy findings |
| "Did we open cost data too widely?" | Someone saw a number they shouldn't have | Narrow a Permission | **Inferred** — consistent with `docs/adr/0001` |

**Notable market gap, stated as a fact about products rather than a recommendation:** of the products
inspected, none exposes its permission model as a *readable artefact* to the people governed by it.
Viva exposes admin *settings*; Anthropic exposes a role list in docs. Nothing renders the matrix.

### 2.5 The triggering decisions, named

The ticket asks for *the decision*, not "improve productivity". These are the concrete ones that
appear in sources, ordered by how well evidenced they are:

1. **Winning buy-in for an investment.** The best-substantiated recurring trigger, and it comes from
   a peer-reviewed source. *DevEx in Action* (ACM Queue, Tier A): *"proposed initiatives and
   investments to improve DevEx struggle to get buy-in as business stakeholders question the value
   proposition."* [queue.acm.org/detail.cfm?id=3639443](https://queue.acm.org/detail.cfm?id=3639443).
   The data exists to answer a sceptical stakeholder, not to be watched.
2. **Justifying or renewing the spend.** §2.3 — stated verbatim in
   [arXiv 2607.01418](https://arxiv.org/abs/2607.01418)'s abstract and in Anthropic's own docs
   (*"Is this tool worth the investment?"*).
3. **Board / CTO–CFO communication.** DX (Tier D, vendor) frames its product around *"the executive
   struggling to articulate overall productivity in leadership or board meetings"* and a leader
   *"lacking a shared language with their CTO or CFO"*
   ([newsletter.getdx.com](https://newsletter.getdx.com/p/introducing-the-dx-core-4)) — corroborated
   independently by LeadDev's framing.
4. **Spotting a bottleneck to fix.** The best-evidenced *good* use. Google's loop, as described by
   its Engineering Productivity Research team: *"Find my next big problem, focus on that, see it
   improve in the logs, and then later in the survey as it starts to fix things for the developer.
   Now let's go take the next big problem."*
   ([newsletter.getdx.com](https://newsletter.getdx.com/p/how-google-measures-productivity), Tier C).
5. **Headcount justification** for a platform/DevProd function (Tier D, DX).
6. **Deciding who to cut.** Named only by trade press and demonstrated once, first-hand, in Beck's
   Facebook account (§2.0). Every academic source warns against it; practitioners closer to the
   ground say it happens.
7. **Periodic access review** (§2.4) — the only trigger with a compliance mandate behind it.

### 2.6 On cadence — a partial answer and an honest gap

I could not find a credible source that *measures* how frequently engineering leaders actually open a
metrics dashboard. What exists is prescriptive guidance and product-design proxies.

| Cadence | Source | What it actually governs |
|---|---|---|
| **Quarterly to semi-annual** | DevEx paper (Tier A): *"a quarterly or semi-annual survey cadence is optimal for most organizations"*; eBay runs *"quarterly surveys"* ([ACM Queue](https://queue.acm.org/detail.cfm?id=3595878)) | Perceptual/survey metrics, not telemetry |
| **Every 3–6 months** | *DevEx in Action* (Tier A): *"Repeat this process of data collection and setting goals... every three to six months"* ([ACM Queue](https://queue.acm.org/detail.cfm?id=3639443)) | The goal-setting and investment-review loop |
| **Continuous logs, cross-checked quarterly** | Google Eng Prod Research (Tier C) | The VP bottleneck-hunting loop in §2.5 item 4 |
| **Daily**, tool-prompted | Meyer et al. (Tier A) — but for **self**-reflection, not manager review, and prompted by the tool rather than self-initiated ([hasel.dev](https://hasel.dev/project/individual-productivity/)) | The `self` vantage point only |
| **"On a schedule" set by exec reporting** | Swarmia (Tier D) | Cadence driven by reporting obligation, not by a natural inspection rhythm |
| **Quarterly / monthly-for-privileged** | Compliance-tooling vendors (Tier D), under NIST's organisation-defined frequency | Access review (§2.4) |

**Two further signals worth having:**

- **The money jobs are event-driven, not habitual.** Every trigger named in Tier-A/B sources for §2.3
  is an *event*: a rollout milestone, a renewal, a budget cycle, a spend spike, a CTO mandate (in
  [arXiv 2607.01904](https://arxiv.org/abs/2607.01904) it is literally an email), an audit.
- **Data freshness as a proxy for the cadence the builders expected (Tier B).** Anthropic's Claude
  Code analytics *"typically appear within 24 hours after enabling, with daily updates"* and its
  analytics API is *"daily aggregation, one record per user per day"*; GitHub's Copilot metrics are
  daily reports over a 100-day window; Amazon Q refreshes hourly, active users daily. Nobody built
  these for real-time monitoring.

**On whether these dashboards get used at all:** genuinely thin evidence, and what exists is
compromised. The "dashboard nobody bookmarks" claim circulates almost exclusively in blogs published
by companies selling dashboards. A widely quoted "66% of developers don't believe current metrics
reflect their contributions" traces to a content-mill summary citing an unlinked vendor survey and
**could not be verified** — do not cite it. Anything more specific about cadence or abandonment than
the table above would be invention.

---

## 3. What the market has already decided is table stakes

This section is almost entirely Tier B (official product docs). It is not evidence that these
metrics are good — GitClear's data in §5 argues some are actively misleading — but it is reliable
evidence of what a viewer will expect to find, and of where the real privacy floors sit.

**Convergent core across GitHub Copilot, Cursor, Claude Code, Amazon Q, Windsurf and Sourcegraph
Cody:** suggested-vs-accepted volume, an acceptance rate, and active/engaged user counts, reported
**per user per day**.

- **GitHub Copilot metrics API** — `total_active_users`, `total_engaged_users`, per-model
  `total_code_suggestions` / `total_code_acceptances` / `total_code_lines_suggested` /
  `total_code_lines_accepted`, broken out by language, editor and model; per-user reports carry
  `login`, `last_authenticated_at`, `last_activity_at`.
  [concepts](https://docs.github.com/en/copilot/concepts/copilot-usage-metrics/copilot-metrics) ·
  [REST reference](https://docs.github.com/en/rest/copilot/copilot-metrics) ·
  [metrics data](https://docs.github.com/en/copilot/reference/metrics-data).
  **No cost or token fields at all** — Copilot is seat-priced, so its schema has no notion of spend.
- **Claude Code Analytics API** — one record per user per day: `core_metrics.num_sessions`,
  `lines_of_code.added/removed`, `commits_by_claude_code`, `pull_requests_by_claude_code`,
  `tool_actions.*.{accepted,rejected}`, and `model_breakdown[]` carrying
  `tokens.{input,output,cache_read,cache_creation}` and `estimated_cost`.
  [docs](https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api). The
  four-way token split and per-Model keying match `CONTEXT.md`'s TokenUsage exactly — this is the
  real shape of the data, not an invented one.
- **Cursor Admin/Analytics API** — per-user daily usage, per-user token accounting with
  `totalCents`/`chargedCents`, per-user `spendCents` and `monthlyLimitDollars`, **billing groups**
  with per-group spend, a leaderboard with `email` and `line_acceptance_ratio`.
  [analytics-api](https://cursor.com/docs/account/teams/analytics-api) ·
  [admin-api](https://cursor.com/docs/account/teams/admin-api).
- **Amazon Q Developer** — names seat economics directly in its metric list: *Active subscriptions*
  ("You are being charged for these") vs *Pending subscriptions* ("not yet started... not being
  charged").
  [docs](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/dashboard-metrics-descriptions.html).
- **Anthropic's own Teams/Enterprise dashboard** (Tier B, and the closest analogue to this product):
  summary tiles are *PRs with CC*, *Lines of code with CC*, *PRs with Claude Code (%)*, *Suggestion
  accept rate*, *Lines of code accepted*; charts are Adoption (users, sessions), PRs per user,
  PRs-with vs PRs-without breakdown, and a top-10 Leaderboard with CSV export.
  [docs](https://code.claude.com/docs/en/analytics). Two things stand out: it is a **single
  vantage point** (Admin/Owner only — no Team-lead view, no self view), and its metrics carry an
  explicit humility note — *"These metrics are deliberately conservative and represent an
  underestimate"*.

**Privacy floors — only one was found in the whole AI-tooling market.**

| Product | Documented aggregation floor |
|---|---|
| GitHub Copilot | *"Teams with fewer than 5 seated Copilot users are excluded from the user-teams reports"* ([docs](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/team-level-metrics)) |
| Cursor | None documented — per-user email exposed in admin API and leaderboard |
| Claude Code | None documented — per-user email addressable, daily |
| Amazon Q | None documented |
| Microsoft Viva Insights | Two, both ≥5, and both admin-configurable upward (§2.2) |

That is a real finding: **the general workplace-analytics market has converged on a k≥5 aggregation
floor; the AI-coding-tool market largely has not.** A product whose central idea is a two-dimensional
access matrix is unusual against that baseline rather than merely conventional.

**Cost governance is now first-class, not an add-on.** Cursor ships per-user spend limits and billing
groups as API objects; Anthropic ships a dedicated Usage & Cost API that groups by `workspace_id`
for chargeback and *lists third-party FinOps platforms* (CloudZero, Datadog, Grafana Cloud, Harness,
Honeycomb, Vantage) in its own documentation
([usage-cost-api](https://platform.claude.com/docs/en/manage-claude/usage-cost-api)) — i.e. the
vendor already assumes a FinOps function consumes this downstream.

**Vendor-marketed buyer questions (Tier D, but consistent across six independent vendors):** are our
licences being used / can we reclaim idle seats (Swarmia markets *"find unused licenses that might
need attention"* — [help.swarmia.com](https://help.swarmia.com/ai-assistant-metrics/ai-adoption-metrics));
what is our cost per developer/team/tool; is AI actually making us faster; how do we charge spend back
to Teams. GitHub's July 2026 dashboard update reportedly added a cohort bucket for
licensed-but-non-engaged users, and GitHub documents *no automated seat reclamation* — admins pull
last-activity dates manually
([docs](https://docs.github.com/en/copilot/tutorials/roll-out-at-scale/assign-licenses/remind-inactive-users)).

---

## 4. Demo legibility: what a first-time viewer actually does

### 4.1 The attention window — real numbers, real provenance, real caveats

- **Liu, White & Dumais, "Understanding Web Browsing Behaviors through Weibull Analysis of Dwell
  Time", SIGIR 2010 (Tier A).** 205,873 pages, >2 billion visits. Found that **99% of pages exhibit
  negative aging**: the longer a visit lasts, the *less* likely the user is to leave next instant.
  [Microsoft Research](https://www.microsoft.com/en-us/research/publication/understanding-web-browsing-behaviors-through-weibull-analysis-of-dwell-time/).
- **NNG's practitioner reading of that result (Tier C).** Users often leave in **10–20 seconds**; the
  first **10 seconds** are the critical filter; the hazard curve flattens around **30 seconds**,
  after which those who stayed tend to stay 2+ minutes. NNG's own design implication: *"clearly
  communicate your value proposition within 10 seconds."*
  [nngroup.com](https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/).
  **Caveat NNG itself makes:** this is generic web-page dwell time, not dashboards. It applies most
  directly to a first-time viewer of an unfamiliar dashboard — an evaluator, a demo audience — which
  is exactly the case the ticket asks about, and not at all to a habituated daily user.
- **Aesthetic verdict forms far faster than comprehension.** Lindgaard et al. (2006) found visual-
  appeal judgements at **50 ms** exposure correlate with judgements at 500 ms
  ([B&IT 25(2)](https://www.tandfonline.com/doi/abs/10.1080/01449290500330448)); Tuch et al. (2012)
  pushed it to **17 ms**, and found **visual complexity** has a stronger effect than prototypicality,
  with high complexity producing a more negative first impression
  ([IJHCS 70(11)](https://www.sciencedirect.com/science/article/abs/pii/S1071581912001127)).
  Both Tier A. **This is the "wall of tiles" finding**: a dense, unstructured grid can register as
  bad before a single number is read.

**So the ticket's "thirty seconds" is defensible** — it sits right at the point where the hazard
curve flattens — but the operative window for the *decision to keep reading* is nearer **10 seconds**,
and the operative window for **"does this look competent"** is under **1/20th of a second**.

### 4.2 What the eye does, and what is folklore

- **F-pattern: real, but NNG itself walked back the strong version.** The 2006 study (232 users) is
  real ([nngroup](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content-discovered/)),
  but NNG's 2017 correction is explicit that F is *"the default pattern when there are no strong cues
  to attract the eyes toward meaningful information"* — one of several patterns (layer-cake, spotted,
  marking, bypassing, commitment), conditional on unformatted text and low engagement
  ([nngroup 2017](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/)). NNG's
  own conclusion is *not* "design for F" but "give strong cues so users don't fall back to F".
- **Layer-cake pattern (Tier C, NNG eye-tracking), and the most transferable to KPI tiles.** Fixations
  land on headings, dipping into body text only where the heading earns it — *"by far the most
  effective way to scan"*, **but only when headings carry information scent**; vague headings break
  it. [nngroup](https://www.nngroup.com/articles/layer-cake-pattern-scanning/). A KPI tile label is
  structurally a heading.
- **Shneiderman's mantra (Tier A, 1996, ~5,700 citations):** *"Overview first, zoom and filter, then
  details-on-demand."*
  [The Eyes Have It (PDF)](https://hci.stanford.edu/courses/cs448b/papers/shneiderman96eyes.pdf).
- **Dashboard-specific eye-tracking exists but is thin.** Yang et al., *Dashboard Vision*, IEEE TVCG
  2025 — 1,216 dashboards, eye movements from 60 participants — and its most useful caveat is that
  **visual attention is not comprehension**: eye time on a tile does not mean insight gained
  ([PDF](https://www.cs.tufts.edu/~remco/publications/2025/TVCG2025-DashboardVision.pdf)). Zhang et
  al., *Sensors* 24(18) 2024, found a significant interaction between layout order and visual
  complexity, with the most important chart best placed **left-centre**, and summarised as *"order is
  more"* alongside "less is more" ([MDPI](https://www.mdpi.com/1424-8220/24/18/5966)) — effect sizes
  unverified, abstract-level read only.
- **Explicitly rejected as fabricated.** A search summariser produced NNG-attributed statistics
  ("users abandon screens with more than 7 competing elements above the fold", "Z-pattern boosts
  usability by 70%", "progressive disclosure reduces cognitive load by 55%") that do not exist on
  nngroup.com. **Do not use these**; they are recorded here only so they are not rediscovered and
  believed.

### 4.3 Why a dashboard reads as a wall of tiles — Stephen Few

Few is a practitioner authority, not an experimentalist, but he is the field's standard reference and
his central point is the one most directly on the ticket's question.

- **Definition** (*Information Dashboard Design*, O'Reilly 2006): *"a visual display of the most
  important information needed to achieve one or more objectives, consolidated and arranged on a
  single screen so it can be monitored at a glance."*
- **The context finding, verbatim** (*Why Most Dashboards Fail*, Perceptual Edge 2007):
  > *"the value 7,822 YTD units, without additional context would tell you little. Compared to what?
  > ... your next question ought to be, how good or bad? Are we on track? Is this better than
  > before? The right context for the key measures makes the difference between numbers that just
  > sit there on the screen and those that enlighten and inspire action."*
  [PDF](https://www.perceptualedge.com/articles/misc/WhyMostDashboardsFail.pdf). His worked fix pairs
  each measure with a **sparkline** (history) and a **bullet graph** (target + qualitative bands),
  fitting seven contextualised metrics in the space of three bare gauges.
- **His 13 pitfalls** ([PDF](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf)),
  of which four bear hardest here: **#2 inadequate context**; **#4 expressing measures indirectly**
  (showing actual and budget separately and making the viewer compute the variance); **#9 arranging
  data poorly** — his own example is a dashboard putting a vendor logo in the top-left prime real
  estate; **#10 ineffective highlighting** — *"when everything is visually prominent, nothing stands
  out."*
- **Honest limit:** I found **no controlled experiment** isolating "number alone" vs "number +
  comparison" for comprehension speed or accuracy. Few's position is well-argued authority, not an
  RCT.

### 4.4 Titles and annotation — the best-evidenced lever

- **Borkin et al., "Beyond Memorability: Visualization Recognition and Recall", IEEE TVCG 2015 (Tier
  A).** 393 visualizations, 33 participants, eye-tracking plus written recall after a **10-second
  exposure** — the exposure length itself matches the attention window above. Finding, verbatim:
  ***"Titles and supporting text should convey the message of a visualization."*** Recall clusters
  around what the title said. The most recognisable charts had **one clear visual centre of
  interest**. [PubMed](https://pubmed.ncbi.nlm.nih.gov/26390488/).
- **Borkin et al., "What Makes a Visualization Memorable?", IEEE TVCG 2013 (Tier A).** 2,070
  visualizations; colour and recognisable objects increase memorability; visually distinctive charts
  are *more* memorable than generic bar/line charts
  ([PDF](http://web.mit.edu/zoya/www/docs/InfoVis_borkin-128.pdf)).
- **Kong, Liu & Karahalios, CHI 2018 (Tier A).** Title *slant* changes the perceived main message of
  an **identical** chart. [ACM DL](https://dl.acm.org/doi/10.1145/3173574.3174012). **This cuts both
  ways**: an interpreted title is the strongest known lever for fast comprehension *and* the
  strongest known vector for spin. For a product surfacing illustrative rate cards, that is a live
  risk, not a hypothetical one.
- **Suggestive but not established** (arXiv preprints): informative titles reduce mental effort vs
  generic titles but do **not** reliably improve accuracy or credibility judgements — a good title
  makes a chart *feel* easier without making the viewer more correct
  ([arXiv 2306.06043](https://arxiv.org/html/2306.06043v2)).

### 4.5 How many tiles — the honest answer

Miller's 7±2 (*Psychological Review*, 1956) is one of the most **misapplied** results in UX: it
concerns the span of absolute judgement on a unidimensional stimulus and immediate verbatim recall,
not on-screen item counts where the information stays visible
([Wikipedia summary of the misapplication](https://en.wikipedia.org/wiki/The_Magical_Number_Seven,_Plus_or_Minus_Two)).
Cowan's reanalysis (*BBS* 2001) puts focused-attention capacity nearer **4±1**
([PDF](https://memory.psych.missouri.edu/assets/doc/articles/2001/cowan-bbs-2001.pdf)).
**Neither is a validated threshold for dashboard tile counts.** What both *do* support is Few's
pitfall #1: anything pushed off-screen must be held in working memory to be compared, and working
memory is small on any of these estimates.

---

## 5. A cross-cutting caution the evidence forces

Every product in §3 reports acceptance rate and accepted lines. Independent analysis suggests those
are the metrics least likely to track value.

- **GitClear** (Tier D-with-caveats — a vendor, but presenting an empirical code analysis rather than
  a product pitch): 211M lines of code changes analysed. Code churn rose from ~3.3% pre-AI to 5.7%
  (2024) to 7.1% (2025); duplicated blocks rose ~8×; 2024 was *"the first year on record where
  within-commit copy/paste exceeded 'moved' (refactored) code"*; refactoring's share of changed lines
  fell from 25% (2021) to under 10% (2024).
  [gitclear.com](https://www.gitclear.com/ai_assistant_code_quality_2025_research).
- **DORA 2025 (Tier C)** reports AI adoption relating *negatively* to delivery **stability** even
  while improving throughput ([dora.dev](https://dora.dev/research/2025/dora-report/)).
- **[arXiv 2607.01904](https://arxiv.org/abs/2607.01904) (Tier A)** found reviewer load doubling as
  throughput doubled.

**Acceptance rate measures whether code was taken, not whether it was good.** Any of the four
vantage points above can be given a number that goes up while the thing it stands for gets worse.
`CONTEXT.md` already carries the constructs that resist this — **Rework** (Tasks needing more than
one AgentSession) and **success rate** are precisely the "did it actually work" side that no product
in §3 reports. That is a differentiation finding, not a design instruction.

---

## 6. Public, no-auth demos: what actually exists

No dominant pattern. What was directly observed:

| Product | Pattern observed |
|---|---|
| **[Sentry Sandbox](https://sandbox.sentry.io)** | A genuine, fully interactive product with seeded errors, working filters and full nav. Persistent **"SANDBOX DEMO"** banner. Soft email-capture CTA, no wall. No persona switcher, no guided tour. |
| **[Fathom live demo](https://usefathom.com/changelog/jul2021-live-demo)** | No login. Data is realistic; the *subject* is deliberately absurd — a fictional "hilariousplatypus.com". Fakeness is signalled by context, not by disclaimers on numbers. |
| **[Plausible "Live Demo"](https://plausible.io/plausible.io)** | The opposite strategy: **real production data from the vendor's own site**, wrapped in a marketing page with trial CTAs. Maximises credibility, sacrifices sandbox freedom. |
| **[Grafana Play](https://play.grafana.org)** | The reference open demo instance (multiple demo dashboards, `testdata` source). Could not be rendered by the fetch tool — client-side app — so banner/tour details are **unverified**. |
| **[Metabase](https://www.metabase.com/demo)** | *Not* an interactive demo: a 75-second video plus trial signup and "talk to an expert". A separate [examples gallery](https://www.metabase.com/examples) is static screenshots. |
| **Superset / Preset** | No vendor-hosted public demo found; instead [seed content on GitHub](https://github.com/preset-io/public-examples) you load into your own workspace. |
| **Datadog** | No self-serve sandbox: a facilitated [interactive demo workshop](https://www.datadoghq.com/partner-enablement/sessions/dpn-interactive-demo/), a gated trial, and a self-deployed seed app ("storedog") for generating realistic telemetry. |
| **PostHog** | [posthog.com/demo](https://posthog.com/demo) is a video/booking page. Signup-gated is the first-party funnel. |
| **Linear / Cal.com** | Different pattern entirely — real product UI embedded *in the marketing page* rather than a separate try-it environment. |

**Reading across these:** cheap-to-seed developer tools (Sentry) run genuine labelled sandboxes;
complex enterprise observability (Datadog) prefers gated or self-deployed; classic BI (Metabase,
Superset) skips sandboxes for trial signup; privacy-first analytics (Plausible, Fathom) blend "look
at real data" with demo framing. **None observed had a persona/role switcher** — which makes a
role-switching demo an unusual move against this baseline rather than a conventional one.

### 6.1 Demo-length data — vendor-published, and the one number worth caring about

All Tier D, self-reported, from companies selling demo software to customers who opted into their
tooling. Not neutral benchmarks.

- **[Storylane](https://www.storylane.io/blog/learnings-from-analyzing-demo-lengths-across-9-industries)**
  (n = 34 demos, 5,409 sessions): overall average 21 steps / 26% completion. Top 10%: **9 steps, 64%
  completion**. Bottom 10%: 37 steps, 1.39%. **The directly relevant row:** the "Cloud Computing,
  Cyber Security, Data Tech" category averaged **43 steps and 10.7% completion** — the *worst* of
  nine sectors, against "Product/Marketing/Sales Tech" at 11 steps and 41%. Strong negative
  correlation between length and completion.
- **[Navattic, State of the Interactive Product Demo 2025](https://www.navattic.com/report/state-of-the-interactive-product-demo-2025)**
  (28,000+ demos on their own platform + 280 of their own customers surveyed): top-1% demos average
  **2.1 min** time-on-demo; **71% of top performers are ungated**, with ungated showing ~10% higher
  engagement than gated; mid-demo forms beat up-front forms by 9.7%.
- **[Arcade](https://www.arcade.software/post/interactive-demo-statistics)** — aggregates other
  vendors' numbers and contains internally inconsistent figures. Treat as loosely assembled marketing
  copy, not a dataset.

### 6.2 First-run and seeded data — the one Tier-C source directly on point

- **NNG, "Designing Empty States in Complex Applications" (Tier C).** Three guidelines: communicate
  system status (*"no records for the selected date range"*, not a blank void); give **in-context**
  learning cues rather than up-front tutorials, because in-context help is applied immediately and is
  more memorable; and offer a direct path to the key task.
  [nngroup](https://www.nngroup.com/articles/empty-state-interface-design/). **Its worked example is
  a log-analytics tool (Loggly) whose empty state offers two paths — add data sources, or "explore
  with demo data".** That is the closest thing to a research-body endorsement of seeded demo data as
  a legitimate first-run affordance. Directly relevant to ticket 11.
- **Activation benchmarks (Tier D/C, self-reported surveys — directional only):** OpenView/Pendo
  2025 product benchmarks (>2,600 companies) report up to 91% of new users dropping off within 14
  days without hitting value, and a 69% correlation between strong 7-day activation and strong
  3-month retention; recommendations include *"enable hands-on discovery through sample data and
  contextual guidance before full setup"*
  ([Amplitude summary](https://amplitude.com/blog/time-to-value-drives-user-retention)).
  OpenView's [2023 benchmarks](https://openviewpartners.com/2023-product-benchmarks/) put "normal"
  activation at 20–40%.
- **Labelling synthetic data — a genuine evidence gap.** No NNG-tier study was found on whether demo
  data should look real or obviously fake, or how it should be labelled. Observed practice spans the
  full spectrum: Sentry uses a **section-level banner** with realistic data and no per-number
  disclaimers; Fathom uses realistic numbers on an obviously fictional subject; Plausible uses real
  data. There is no documented best practice — only three deliberate, different choices. Worth
  noting given `CONTEXT.md`'s requirement that rate cards be **labelled illustrative wherever
  surfaced**: no evidence supports one labelling mechanism over another, so that choice is free.

---

## 7. What is *not* in the evidence

Stated explicitly so nobody downstream mistakes silence for support.

1. **No source measures how often an engineering leader opens a dashboard.** Only prescriptive
   cadences for *survey* instruments and product-refresh proxies. §2.6.
2. **No rigorous evidence on dashboard abandonment.** The claim circulates only in blogs published
   by dashboard vendors; one widely repeated statistic could not be traced to any primary source.
   §2.6.
3. **No study of what administrators do with an analytics permission model.** §2.4.
4. **No controlled experiment on "number alone vs number + comparison".** Few's authority only. §4.3.
5. **No validated tile-count limit.** Miller and Cowan are both misapplied here. §4.5.
6. **No rigorous test of realistic vs obviously-fake demo data, or of labelling.** §6.2.
7. **No product found reports Rework or a first-time-success rate** — the constructs `CONTEXT.md`
   defines. Absence of precedent, not evidence against.
8. **No product found exposes its permission model as a readable artefact to the people governed by
   it.** §2.4.
9. **Independent evidence on whether agents help is genuinely unsettled** — −19% (METR RCT), +24%
   (Microsoft, tens of thousands of engineers), +109% (one mandate-driven case study). §1.
10. **McKinsey's original 2023 article could not be read directly** (paywalled); it is characterised
   here only through four independent rebuttals. §0.
11. **The literature gives a band, not a direction, on aggregation** — above the individual, below
   the company — and nothing tells you where inside that band a given cell should sit. §2.0.

---

## 8. Where these findings land downstream

Pointers only. Each row is a **question the evidence sharpens**, not an answer. The answers are 05,
06, 07 and the landing copy, and they are human decisions.

| Downstream | Findings that bear on it | The question they sharpen |
|---|---|---|
| **07 — information architecture** | §2 (four vantage points, each with a different *trigger*, not a different data slice); §2.5 (triggers are events, not habits); §2.6 (no evidence of habitual visiting); §4.1 (a 10s filter, a 30s commit); §4.2 (Shneiderman's overview-first is a principle, not a finding) | If the jobs are event-triggered and mostly *episodic*, is a structure organised around recurring visits the right shape at all — and does each vantage point deserve its own entry, or one surface that resolves differently per Permission? |
| **05 — metric set** | §3 (the market's convergent core, and that it is all activity); §5 (acceptance rate measures whether code was taken, not whether it was good); §1 (the felt/measured gap); §2.0 item on Google's actionability gate | Which candidate metrics survive the question *"is the result actionable regardless of whether it is positive or negative?"* — and which of them can go up while the thing they stand for gets worse? |
| **06 — role preset table** | §2.0 (aggregate above the individual, disaggregate below the company); §2.2 and §3 (the k≥5 floors, and that the AI-tooling market mostly lacks them); §2.2 note on leaderboards | Where inside the band does each preset sit, and does any preset grant a *visible per-Member ranking* — the specific mechanism the Beck ladder runs on? |
| **11 — empty state** | §6.2 (NNG's three guidelines, and its worked example of a log-analytics tool offering "explore with demo data") | Is the zero-data view a status message, a learning cue, a path to the key task — or a door into seeded data? |
| **`/demo` and landing copy** | §4.1 (10s to communicate the value proposition; 17ms for complexity to register); §4.4 (titles carry the message, and can slant it); §6 (nine observed demos, no persona switcher among them); §6.1 (data-tech demos have the *worst* completion of nine sectors when long) | What is the one thing a first-time viewer must understand, and how few steps can carry it? |
| **Open: rate-card labelling** | §6.2 (no evidence favours any labelling mechanism); §4.4 (an interpreted title is the strongest lever *and* the strongest vector for spin) | Banner, per-figure label, or fictional-subject framing — the evidence is silent, so this is a free choice made on other grounds |

---

## 9. Source index by tier

**Tier A — peer-reviewed / controlled / standards**
[SPACE (ACM Queue 2021)](https://queue.acm.org/detail.cfm?id=3454124) ·
[DevEx (ACM Queue 2023)](https://queue.acm.org/detail.cfm?id=3595878) ·
[DevEx in Action (ACM Queue)](https://queue.acm.org/detail.cfm?id=3639443) ·
[Software Engineering at Google, ch. 7](https://abseil.io/resources/swe-book/html/ch07.html) ·
[Meyer et al. CSCW 2018](https://dl.acm.org/doi/10.1145/3134714) ·
[Beller et al., Mind the Gap](https://arxiv.org/abs/2012.07428) ·
[METR RCT](https://arxiv.org/abs/2507.09089) ·
[Microsoft CLI-agent rollout](https://arxiv.org/abs/2607.01418) ·
[Enterprise 2× mandate](https://arxiv.org/abs/2607.01904) ·
[Shneiderman 1996](https://hci.stanford.edu/courses/cs448b/papers/shneiderman96eyes.pdf) ·
[Liu/White/Dumais SIGIR 2010](https://www.microsoft.com/en-us/research/publication/understanding-web-browsing-behaviors-through-weibull-analysis-of-dwell-time/) ·
[Lindgaard 2006](https://www.tandfonline.com/doi/abs/10.1080/01449290500330448) ·
[Tuch 2012](https://www.sciencedirect.com/science/article/abs/pii/S1071581912001127) ·
[Borkin 2013](http://web.mit.edu/zoya/www/docs/InfoVis_borkin-128.pdf) ·
[Borkin 2015](https://pubmed.ncbi.nlm.nih.gov/26390488/) ·
[Kong CHI 2018](https://dl.acm.org/doi/10.1145/3173574.3174012) ·
[Yang TVCG 2025](https://www.cs.tufts.edu/~remco/publications/2025/TVCG2025-DashboardVision.pdf) ·
[Zhang Sensors 2024](https://www.mdpi.com/1424-8220/24/18/5966) ·
[Cowan BBS 2001](https://memory.psych.missouri.edu/assets/doc/articles/2001/cowan-bbs-2001.pdf) ·
[NIST AC-6(7)](https://csf.tools/reference/nist-sp-800-53/r5/ac/ac-6/ac-6-7/)

**Tier B — first-party product documentation**
[Claude Code analytics](https://code.claude.com/docs/en/analytics) ·
[Claude Code costs](https://code.claude.com/docs/en/costs) ·
[Claude Code Analytics API](https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api) ·
[Usage & Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api) ·
[GitHub Copilot metrics](https://docs.github.com/en/copilot/concepts/copilot-usage-metrics/copilot-metrics) ·
[Copilot team-level floor](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/team-level-metrics) ·
[Cursor Analytics API](https://cursor.com/docs/account/teams/analytics-api) ·
[Cursor Admin API](https://cursor.com/docs/account/teams/admin-api) ·
[Amazon Q metrics](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/dashboard-metrics-descriptions.html) ·
[Viva manager settings](https://learn.microsoft.com/en-us/viva/insights/advanced/setup-maint/manager-settings) ·
[Viva privacy settings](https://learn.microsoft.com/en-us/viva/insights/advanced/setup-maint/privacy-settings)

**Tier C — credible practitioner research orgs**
[NNG dwell time](https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/) ·
[NNG F-pattern correction](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/) ·
[NNG layer-cake](https://www.nngroup.com/articles/layer-cake-pattern-scanning/) ·
[NNG empty states](https://www.nngroup.com/articles/empty-state-interface-design/) ·
[Few, Why Most Dashboards Fail](https://www.perceptualedge.com/articles/misc/WhyMostDashboardsFail.pdf) ·
[Few, Common Pitfalls](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf) ·
[DORA 2024](https://dora.dev/research/2024/dora-report/) ·
[DORA 2025](https://dora.dev/research/2025/dora-report/) ·
[DORA four keys guide](https://dora.dev/guides/dora-metrics-four-keys/) ·
[Stack Overflow 2025 AI](https://survey.stackoverflow.co/2025/ai) ·
[Beck & Orosz response to McKinsey](https://newsletter.pragmaticengineer.com/p/measuring-developer-productivity) ·
[Kent Beck, same](https://newsletter.kentbeck.com/p/measuring-developer-productivity) ·
[Dan North, McKinsey review](https://dannorth.net/mckinsey-review/) ·
[LeadDev on McKinsey](https://leaddev.com/career-development/what-mckinsey-got-wrong-about-developer-productivity) ·
[Laura Tacho on individual metrics](https://lauratacho.com/blog/using-metrics-to-measure-individual-developer-performance) ·
[How Google measures productivity](https://newsletter.getdx.com/p/how-google-measures-productivity) ·
[Fowler, measuring productivity via humans](https://martinfowler.com/articles/measuring-developer-productivity-humans.html) ·
[FinOps for AI](https://www.finops.org/wg/finops-for-ai-overview/) ·
[HASEL individual productivity](https://hasel.dev/project/individual-productivity/)

**Tier D — vendor marketing (treat as evidence of asked questions, not of answers)**
[DX AI measurement](https://getdx.com/whitepaper/ai-measurement-framework/) ·
[DX Core 4](https://newsletter.getdx.com/p/introducing-the-dx-core-4) ·
[DX, pitfalls of activity metrics](https://getdx.com/blog/pitfalls-of-developer-activity-metrics/) ·
[Swarmia on enterprise measurement](https://www.swarmia.com/blog/developer-productivity-enterprise-change-management/) ·
[Jellyfish token monitoring](https://jellyfish.co/platform/jellyfish-ai-impact/ai-token-usage-monitoring/) ·
[LinearB](https://linearb.io/blog/ai-measurement-framework) ·
[Faros](https://www.faros.ai/blog/ai-software-engineering) ·
[Swarmia](https://help.swarmia.com/ai-assistant-metrics/ai-adoption-metrics) ·
[GitClear](https://www.gitclear.com/ai_assistant_code_quality_2025_research) ·
[Navattic](https://www.navattic.com/report/state-of-the-interactive-product-demo-2025) ·
[Storylane](https://www.storylane.io/blog/learnings-from-analyzing-demo-lengths-across-9-industries) ·
[Arcade](https://www.arcade.software/post/interactive-demo-statistics) ·
[Vanta access reviews](https://www.vanta.com/resources/how-do-you-perform-quarterly-access-reviews) ·
[AccessOwl SOC 2](https://www.accessowl.com/blog/detailed-guide-to-soc-2-access-reviews)
