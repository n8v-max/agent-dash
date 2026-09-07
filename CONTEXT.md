# Domain Glossary

The canonical vocabulary for this project. Glossary only — no decisions, no routes, no
implementation detail. Decisions live on the wayfinder map and in `docs/adr/`.

---

## Organisation & People

**Organization** — The top-level billing and access-control unit. An org subscribes to the
platform and manages Members. All analytics are scoped to an Organization. It declares a
**timezone**, which fixes where every day, week and month boundary falls in its analytics.

**GitHubOrg** — The external GitHub organisation linked to an Organization. Source of truth
for Team and Member import.

**Team** — A group of Members within an Organization, imported from a GitHubTeam in the linked
GitHubOrg. A Member belongs to one or more Teams. Hierarchy: Organization → Team → Member.

**Member** — An account that belongs to an Organization and runs Tasks. Carries a Role and a
**kind**: `human` or `service_account`. Kind is a roll-up level on the Member dimension, in the
same way `family` and `tier` are roll-ups on Model. It is load-bearing rather than cosmetic:
service accounts hold no seat, so any per-capita figure that includes them has a wrong
denominator.

**Repository** — A GitHub repo within the linked GitHubOrg. Tasks are tagged to a Repository.
Surfaced in the UI as "Project".

A Repository carries a **work domain** label — e.g. mobile, data science, backend, frontend,
infrastructure config. The domain, not the repo identity, is what makes this dimension
analytically valuable: agent efficacy and cost profile differ sharply by the *nature of the
work*. The domain vocabulary is an open decision.

---

## Work

**Task** — The unit of work a Member asks an agent to do: one request, one intended outcome.
A Task is addressed by one **or more** AgentSessions. **UI alias: "Job".** `Task` is the
canonical term in code, schemas and specs; `Job` is the label shown to users and the name of
the corresponding datapoint class.

A Task is **externally keyed**: it *is* an issue in an external tracker (Jira, GitHub Issues),
referenced by its real key. The platform **refuses to launch an AgentSession without one**, for
accountability; a Member with no existing issue creates one ad hoc at launch, seeded from the
session's opening intent. The key is therefore never absent and never synthetic, which is what
makes multi-session analysis trustworthy.

**The platform does not own the Task's lifecycle.** Whether the external issue is ultimately
resolved may depend on non-engineering work the platform never sees, so Task resolution is out
of scope. What the platform observes is the sessions it ran against the Task.

**AgentSession** — A single *attempt* at a Task, and the atomic unit of platform activity: the
grain at which cost is incurred and the grain everything is stored at. It is launched under a
fixed set of labels — Member, Repository, WorkType, Task, and `execution_mode` — and accumulates
measures as it runs.

**Execution mode** — Whether a human is at the keyboard: `interactive` | `headless`. It is a
**property of the session, not of the Member**: a human runs headless sessions, and a service
account's session can be taken over. Conflating it with `Member.kind` would collapse two
independent bits into one and lose the interesting cell. The naming follows shipped precedent
(Cursor's `isHeadless`) rather than the RPA "attended/unattended" pair, which no agent vendor
uses.

**Session measures** — What an AgentSession accumulates as it runs. All are observable at
session end, which is what keeps session rows immutable and every metric free of an as-of date.

- **`accepted`** — Whether the session met its WorkType's acceptance criterion. **This is the
  session's only outcome field.** Each WorkType defines its own criterion, and the criterion names
  the artefact that actually matters: for `implementation` it is a **published pull request**, not
  the presence of a branch or a commit.
- **`prompt_count`** — User messages sent during the session. The single interaction-volume
  measure; there is deliberately **no interruption counter**, because no surveyed vendor ships
  one and Devin documents `num_user_messages` as the standing proxy for "frequent interruptions
  or course corrections".
- **Output artefacts** — Typed counts of permanent objects produced: `pull_request`, `commit`,
  `file_changed`, `line_changed`, `comment`, `document`. Permitted kinds are declared per
  WorkType. See Output comparability, below.
- **TokenUsage** — See § Models & Money.
- **Duration spans** — See below.

**Duration spans** — Three disjoint spans, keyed on **human presence**, partitioning the
session's machine allocation:

| Span | Meaning |
|---|---|
| `interactive_duration_s` | a human is engaged — typing or reading, within the idle timeout |
| `idle_duration_s` | the human has gone quiet past the timeout; the session is still live |
| `afk_duration_s` | no human at the keyboard; the agent runs unattended |

`machine_allocation_duration_s` is their sum. A `headless` session is `afk` for its entire
lifetime by construction and then suspends — it has no interactive or idle time at all. **AFK
time is therefore only informative for `interactive` sessions**; an AFK view spanning both modes
would merely rediscover which sessions were headless.

Because the partition is keyed on the *human* rather than on the actor doing the work, agent
execution time is **not separately recoverable** from these three spans. That is accepted, and
noted here because it is the change machine-use analysis will require.

**Machine allocation** — Wall-clock time a session held a machine. It is **priced**, against a
compute rate card keyed on the machine specification allocated, and the resulting figure folds
into the session's Cost alongside token cost. The compute rate card is **never surfaced**: rates
vary by specification and the breakdown is not something a viewer is asked to reason about.

Pricing it is what lets token spend and machine spend disagree. A CPU-heavy, token-light session —
CI-shaped work that burns machine time without consuming models — is invisible to a token figure
and visible in Cost.

**Hidden session** — An AgentSession that terminated through platform or infrastructure failure.
The platform absorbs its cost; it is not billed to the Organization, and it appears in no metric
and no view. Excluding these is what keeps Acceptance rate a clean measure of *agent* efficacy
with no platform noise in it, and it is why the session model needs no terminal-status field.

**Output comparability** — Output artefact counts are comparable only across WorkTypes that
share an artefact kind. `refactor` and `implementation` both produce changed lines; `review` and
`refactor` share nothing, so no chart may put them on one axis. The `WorkType → [artefact kind]`
map is **data**, and comparability is its intersection, evaluated in the data layer rather than
enforced by convention inside a chart component. In the UI the dependency runs the other way
round: **choosing a datapoint conditions which WorkTypes are offered**, so an incomparable
selection cannot be expressed in the first place.

**Rework** — A Task on which a **non-accepted** session was followed by **another session** —
of any WorkType. The follow-up need not attempt the same class of work: a failed `research`
session followed by an `implementation` session is still a second attempt at the same Task.
The distinction between Task and AgentSession exists so that Rework is *measurable* at all —
three retries of one Task and three first-time-successful Tasks are otherwise indistinguishable.

**Completed Task** — A Task with **at least one accepted session**. The unit of delivered work.

**Incomplete Task** — A Task with **no** accepted session. Deliberately an umbrella: it covers
both work still in flight and work someone gave up on, and the platform cannot tell them apart,
because it does not own the external Task's lifecycle. Age since the last session is reported
instead, and the reader draws their own conclusion.

**Decomposition** — A Task with more than one **accepted** session: work deliberately split, not
work repeated. Rework and Decomposition are independent labels on a Task rather than a
partition; a long Task can exhibit both. Separating them is what makes multi-session Tasks
interpretable — the raw count alone cannot tell a retry from a split.

**WorkType** — The class of work a session is launched to do. **UI alias: "template".** It is
one dimension, not two: the agent configuration *is* the work type, so choosing "bugfix" both
declares intent and bootstraps the session — loading the appropriate skills and prefixing the
first prompt with framing such as *"implementing Jira ABC-42"*. Every AgentSession references
exactly one WorkType.

The vocabulary is **global and flat**: `research`, `implementation`, `refactor`, `bugfix`,
`review`, `deploy`. Deliberately **not repo-scoped** — a WorkType may well behave differently on
a mobile repo than on an infra one, but that interaction is a *finding to surface*, not a reason
to multiply the values by the repository count.

Each WorkType carries a **source** label recording where its configuration came from —
`vendored` | `user_tuned` | `api_provided`. Source is provenance metadata, not an aggregation
level: nothing is grouped by it.

Each WorkType also defines its own **acceptance criterion** and its own set of permitted
**output artefact kinds**, which is why output volume is not comparable across all of them.

**WorkType is declared at launch, not classified afterwards.** The two shipped precedents do the
opposite — Devin assigns a `category` at session teardown "based on the work performed", Cursor
derives `workTypes` from conversation content. Declaring it is the deliberate choice, because the
label has to exist *before* the session runs in order to bootstrap it. The gap this leaves —
sessions that drift from their declared type — is a real efficacy signal and is recorded as
future work, not modelled here.

---

## Models & Money

**Model** — A specific, addressable model version that an AgentSession runs against. The
platform is model-agnostic and routes across vendors. A Model carries roll-up labels so the
same underlying data can be viewed at three zoom levels:

| Label | Meaning | Example |
|---|---|---|
| exact | the addressable model version — the storage grain | `claude-sonnet-5-20250929` |
| `family` | the vendor's model line | `Sonnet` |
| `tier` | cross-vendor capability class | `frontier` \| `balanced` \| `fast` |

Model selection is a **speed/cost lever**, not an implementation detail: it is the mechanism
by which token volume and monetary cost diverge. The ~200× input-price spread across tiers is
what gives that divergence its size.

**The `tier` roll-up has no vendor precedent; `family` now has some.** Every surveyed platform
treats model as a flat analytics group-by (ticket 02), but two first-party counter-examples exist
for `family`: Anthropic's Team/Enterprise spend-report CSV carries a `Model family` column
alongside `Model`, and the FOCUS 1.5 working draft adds a standards-track `ModelFamily` —
*"Grouping of related models as defined by the model developer"* (ticket 15). **Cross-vendor
`tier` remains without precedent** and stays a deliberate design bet — arguably a stronger one
now, since FOCUS notes that `ModelId` is *"not guaranteed to match across service providers"*,
which is precisely the gap a capability tier exists to close.

**Rate card** — The pricing that converts a measured quantity into Cost. There are two: the
**token rate card**, keyed on (model × token class), and the **compute rate card**, keyed on the
machine specification allocated. Only the token card is ever surfaced to a viewer.

The token card **is not keyed on Model alone**: in the real market the key is (model × token class × service tier × context tier ×
region × speed). How much of that key this project models is an open decision.

Rate cards here are **illustrative** and must be labelled as such wherever they are surfaced.
Useful stable ratios: output ≈ 5× input, cache read ≈ 0.1× input, cache write 1.25–2× input,
batch ≈ 50% off. The spread from the fastest to the frontier tier is roughly **200× on input** —
which is why Model mix, not token volume, dominates cost variance.

**TokenUsage** — Tokens consumed by an AgentSession, **keyed by Model**. A single AgentSession
may consume tokens across more than one Model.

Stored as **four raw, disjoint counts** per (AgentSession × Model): uncached input, cache read
(hits), cache write (creation/misses), and output. Disjointness is the property that matters —
it is the only shape that sums safely. Cost is **derived** from these against the rate card,
never stored alongside them.

For display the four are **summed into one "tokens processed" figure**, because four numbers per
model is more than a viewer needs. That the sum weights a cache read the same as an output token
is accepted: token volume is an adoption measure, not a cost proxy, and cost already diverges
from volume through Model choice and effort level regardless.

**Token class** — The priced categories tokens fall into. Every token-based vendor reports at
least four, separately, because each is priced differently: uncached input, cache read, cache
write, output. Two hazards this project has to hold precisely, both established by ticket 02:

- **The classes are not defined the same way across vendors.** Anthropic and Bedrock report
  uncached input as a **disjoint** class; OpenAI's `input_tokens` is a **superset** that already
  includes cached and cache-write tokens. Summing them naively across vendors double-counts.
- **Cache writes subdivide by TTL** and are priced differently by TTL (Anthropic: 1.25× at 5m,
  2× at 1h). A single flat `cache_write_tokens` cannot be priced against that card.

This project's canonical set is the four disjoint classes named under TokenUsage above, and
every vendor reading normalises into it. Cache-write TTL is **collapsed** to a single class, and
the rest of the rate-card key — region, service tier, context tier, speed — is collapsed to
(model × token class). The precision lost is real and is stated rather than discovered: this
model cannot reproduce a vendor invoice, only estimate one. Ticket 13 carries the remaining
question of what happens to an un-normalisable vendor reading.

**Model mix** — The distribution of TokenUsage across Models for a given population and
period, viewable at any of the three roll-up levels. It is a **breakdown, not a comparison
axis**: a single AgentSession may span several Models, so no per-session metric can be grouped
or filtered by Model without attributing a session's cost to one of them unsoundly.

**Cost** — Monetary spend. At AgentSession grain it is **token cost plus machine cost**, both
derived — token cost from TokenUsage against the token rate card, machine cost from machine
allocation against the compute rate card. The two are **blended by default**; a session presents
one figure.

**Seat cost** — The recurring per-seat subscription fee. Seats attach to Members of kind `human`
only; service accounts hold none. Seat cost is **not a metric of its own and not part of session
Cost**. It is a component of a *total* — and only at monthly grain and coarser, because
apportioning a monthly fee across days is invented precision.

**Total spend** — For a population over a period: session Cost plus Seat cost. Available at
monthly grain and coarser. This is the only figure that represents what the Organization actually
pays. It rolls up to Member, Team, and Organization.

Seat cost is what makes a low-usage Member legible: a seat held against near-zero usage is the
highest cost per unit of work in the Organization, and a consumption-only model cannot see it.

Cost derived from usage telemetry is **estimated**, and every surveyed vendor labels it so —
authoritative money lives in billing, not in analytics. This product surfaces estimates only,
and says so. Note also that vendors report usage down to the minute but **cost only at daily
grain**; whether this product inherits that asymmetry is an open decision.

---

## Access

Access is **two-dimensional**. A permission is a single cell in the matrix below; it is not a
level on a single ladder.

**Subject scope** — *whose* data is reachable, and how sharply:

| Scope | Meaning |
|---|---|
| `self` | the acting Member's own data |
| `peer` | **named** individual Members of the acting Member's own Team |
| `team` | the acting Member's own Team, **aggregated** |
| `peer-team` | other Teams, **aggregated only** |
| `org` | the whole Organization, **aggregated** |
| `org-member` | **named** individual Members across the whole Organization |

**Datapoint class** — *what* is reachable about them:

| Class | Covers |
|---|---|
| `jobs` | Task and AgentSession activity: counts, status, duration, work type, rework |
| `tokens` | TokenUsage volume and Model mix |
| `cost` | monetary spend |
| `access` | Visibility of the Role and permission model itself |

**Permission** — One granted (subject scope × datapoint class) cell.

**Role** — A named preset over the permission matrix. Roles are **data**, not a fixed enum: an
Organization with `access` at `org-member` scope can define its own. (Whether that authoring
happens *in this product* is a separate question from how the model is expressed.)

**The default is open, org-wide, and symmetric.** Every Member holds `org-member` scope over
`jobs`, `tokens` and `cost`: named individual usage and spend, for anyone in the Organization,
visible to everyone on the same terms. There is no minimum-population floor and no class that
resolves less sharply than another.

The matrix is therefore **the mechanism, not the default** — it exists so that visibility *can* be
restricted, and the shipped presets include genuinely restricted Roles precisely so the mechanism
is demonstrable. See `docs/adr/0003-individual-visibility-is-open-by-default.md`, which records
this position along with the two stricter ones that preceded it and why each fell.

**Aggregated vs identified** — The distinction the matrix is *able* to encode: seeing a
population's *totals* and resolving those totals to *named people* are separate grants. The
default grants both, so the distinction does no work in the default configuration — it exists for
Organizations that restrict, and for the restricted presets shipped to demonstrate it.

---

## Aggregation Dimensions

**Aggregation dimension** — A categorical axis that analytics can be grouped by, carrying one
or more **roll-up levels** so the same underlying rows are viewable at several zoom levels
without being re-stored. Selecting a level is a user-facing control, not a schema choice.

| Dimension | Roll-up levels |
|---|---|
| Member | Member → Team → Organization; `kind` (`human` / `service_account`) |
| Model | exact model → family → tier |
| Repository | repository → work domain |
| WorkType | flat — no roll-up levels; `source` is provenance, not a level |
| Cohort | Repository work domain, WorkType, or both — **viewer-selected** |

**Cohort** — Not an access scope. A comparison group: the population it is *meaningful* to measure
a Member against, being those doing comparable work. Its key is viewer-selected, so membership is
computed per view rather than stored, and a Member belongs to as many cohorts as they do kinds of
work. It answers *"am I heavy or light on work like mine"*, which a Team-level or org-level
average cannot — the sole engineer doing mobile work has no meaningful comparator on their own
Team. Access does not gate it; relevance is what it is for.

## Metric Concepts

**Acceptance rate** — Share of AgentSessions that met their WorkType's acceptance criterion.
This is the efficacy metric. Reported **within** a WorkType, since the criterion differs by type,
which is why there is no Organization-level acceptance rate: averaging across criteria that
measure different things produces a number that means nothing.

**Rework rate** — Share of Tasks exhibiting Rework.

**Decomposition rate** — Share of Tasks exhibiting Decomposition.

**Incomplete Task count** — Tasks with no accepted session, reported **bucketed by age since the
last session**. The bucketing carries the meaning the platform cannot assert: it does not know
whether a Task is in flight or abandoned.

**Completed Tasks per period** — The velocity measure, and the only one. Session counts are not
velocity: they *rise* when work goes badly.

**Cost per session** — Session Cost, aggregated over a period.

**Cost per completed Task** — Total Cost over a period divided by Completed Tasks in it. This is
where cost meets efficacy, and it is the product's central claim: attempts that produced nothing
sit in the numerator and not in the denominator, so waste raises the figure.

**Tokens processed** — The four disjoint token classes summed. An **adoption** measure, not a
cost proxy, and never presented beside a spend figure in a way that invites the inference.

**Session duration** — Wall-clock time from AgentSession start to end. Median and p95 are the
meaningful aggregations; the distribution is right-skewed, so the mean is not.

**Projected cost** — Total spend extrapolated to the end of the current period, in proportion to
the period elapsed. A forecast, not a measurement.

---

### Period semantics

**Period** — Day, week, or month. Boundaries are computed in the **Organization's declared
timezone**, so an Organization's "last month" is the month its people worked, not a UTC artefact.

**Period-over-period comparison** — Any period may be compared with any other; the product
imposes no restriction on the base. A period that has not finished is **flagged as incomplete**
rather than withheld.

**Comparison floor** — A change figure is suppressed only when the prior period holds **nothing**
to compare against. Above zero it is shown: two to three sessions week-over-week really is +50%,
and on a narrow self-view that is the honest reading, not noise.

**Per-capita** — Any population figure may be divided by its **active human Members**, excluding
service accounts, which hold no seat and would give the denominator the wrong size. Raw is the
default; per-capita is available wherever more than one Member is aggregated, and is what makes
populations of different sizes comparable.
