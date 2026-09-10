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
GitHubOrg. A Member belongs to one or more Teams.

**Teams and Members are many-to-many, so Team is a non-additive grouping.** The sum of every
Team's figures exceeds the Organization's, because an overlapping Member is counted in each Team
they belong to. There is no primary Team and no partition: Organization → Team → Member is a
containment hierarchy, not a roll-up. Any surface grouping by Team must therefore avoid forms
whose geometry asserts a partition, and must state how many Members overlap.

**Member** — An account that belongs to an Organization and runs Tasks. Carries a Role and a
**kind**: `human` or `service_account`. Kind is a roll-up level on the Member dimension, in the
same way `family` and `tier` are roll-ups on Model. It is load-bearing rather than cosmetic:
service accounts hold no seat, so any per-capita figure that includes them has a wrong
denominator.

**Repository** — A GitHub repo within the linked GitHubOrg. Tasks are tagged to a Repository.
**No UI alias**: "Repository" is the word this product's audience already uses, and ADR-0004 makes
repository *names* load-bearing precisely because a reader reads them as repositories. Renaming
them adds a translation layer for no gain. (Contrast `Task`/"Job" and `WorkType`/"template", which
rename terms whose technical form would confuse a viewer.)

A Repository carries **no work-domain label**, and no roll-up level: it is a flat dimension. The
nature of the work is expressed by `Repository × WorkType` instead. One label per repository would
be false — a real repository runs several technologies at once — and several labels would break
additivity on every chart grouped by them. The technology signal survives in the repository name.
See `docs/adr/0004-repository-carries-no-work-domain.md`.

---

## Work

**Task** — The unit of work a Member asks an agent to do: one request, one intended outcome.
A Task is addressed by one **or more** AgentSessions. **UI alias: "Job".** `Task` is the
canonical term in code, schemas and specs; `Job` is the label shown to users and the name of
the corresponding datapoint class.

A Task is **externally keyed**: it *is* a GitHub Issue in the linked GitHubOrg, referenced by its
real key in `owner/repo#number` form. GitHub is the only tracker integration. The platform **refuses to launch an AgentSession without one**, for
accountability; a Member with no existing issue creates one ad hoc at launch, seeded from the
session's opening intent. The key is therefore never absent and never synthetic, which is what
makes multi-session analysis trustworthy.

**The platform does not own the Task's lifecycle.** Whether the external issue is ultimately
resolved may depend on non-engineering work the platform never sees, so Task resolution is out
of scope. What the platform observes is the sessions it ran against the Task.

**AgentSession** — A single *attempt* at a Task by a single agent, and the atomic unit of platform
activity: the grain at which cost is incurred and the grain everything is stored at. It is
launched under a fixed set of labels — Member, Repository, WorkType, Task, `execution_mode` and
`machine_spec` — and accumulates measures as it runs.

**An attempt may be worked by more than one agent.** A session fans out to sub-agents, each of
which is a session of its own, so *attempt* and *session* stopped being the same thing. The two
terms below are what tell them apart, and every metric defined at "session" grain is defined over
the first of them. See `docs/adr/0008-a-child-session-rolls-up-into-its-root.md`.

**Root session** — An AgentSession launched by a Member: the attempt itself. It carries no parent.
**A root is what "a session" means in every metric**, and the population every session-grain figure
is counted over.

**Child session** — An AgentSession spawned by a root as part of the same attempt — a sub-agent
fan-out, not a retry. It **inherits** its root's Task, Member, Repository, WorkType and
`execution_mode`, and it runs *inside* its root's window: it starts after the root starts and ends
before the root ends.

A child **never carries `accepted`**. Acceptance is a property of the attempt — the WorkType's
criterion is met once, by the work as a whole — so the outcome sits on the root and the child has
none to disagree with.

A child's **Cost, TokenUsage and duration spans roll up into its root** for every aggregate, and it
appears as a row of its own nowhere except the raw session history. Its wall clock does not roll
up: the root's start and end already span the whole attempt, which is why a session's *machine
allocation* may exceed its *duration* — two agents holding two machines for an hour is two machine
hours inside one hour of work.

**The tree is one level deep.** A child's parent is always a root; a child spawns nothing. That is
a modelling choice, not an observation about agents, and it is what keeps the roll-up a single
addition rather than a traversal.

**Machine spec** — The class of machine allocated to a session: `general`, `compute`, `memory` or
`storage`. It is fixed at launch and it is the key of the compute rate card. It is **not an
aggregation dimension**: nothing is grouped by it, in the same way `WorkType.source` is provenance
rather than a level.

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
  the artefact that actually matters, never the presence of a branch. `implementation`, `bugfix`
  and `refactor` accept on a **published pull request**; `review` on a **submitted review with an
  outcome**; `deploy` on a **commit landed on the default branch**.
- **`prompt_count`** — User messages sent during the session. The single interaction-volume
  measure; there is deliberately **no interruption counter**, because no surveyed vendor ships
  one and Devin documents `num_user_messages` as the standing proxy for "frequent interruptions
  or course corrections".
- **Output artefacts** — Typed counts of permanent objects produced. Every artefact lives on
  GitHub: `pull_request`, `commit`, `file_changed`, `line_changed`, `pr_comment`. Permitted kinds
  are declared per WorkType. See Output comparability, below.
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

**Machine allocation** — Wall-clock time a session held a machine. It is **priced**, against the
compute rate card keyed on the session's `machine_spec`, and the resulting figure folds into the
session's Cost alongside token cost. The compute rate card is **never surfaced**: rates vary by
specification and the breakdown is not something a viewer is asked to reason about.

Pricing it is what lets token spend and machine spend disagree. A CPU-heavy, token-light session —
CI-shaped work that burns machine time without consuming models — is invisible to a token figure
and visible in Cost.

**Hidden session** — An AgentSession that terminated through platform or infrastructure failure.
The platform absorbs its cost; it is not billed to the Organization, and it appears in no metric
and no view. Excluding these is what keeps Acceptance rate a clean measure of *agent* efficacy
with no platform noise in it, and it is why the session model needs no terminal-status field.

The rule reaches Child sessions as it reaches roots — a hidden child is absorbed too. **A hidden
root takes its children with it**, because a child whose root is not in the data has nothing to
roll up into; there is no such thing as a visible child of a hidden root.

**Output comparability** — Output artefact counts are comparable only across WorkTypes that
share an artefact kind. `refactor` and `implementation` both produce changed lines; `review` and
`refactor` share nothing, so no chart may put them on one axis. The three code WorkTypes —
`implementation`, `bugfix`, `refactor` — also share an *acceptance criterion*, so their acceptance
rates are comparable with each other; `review` and `deploy` are comparable with neither. The `WorkType → [artefact kind]`
map is **data**, and comparability is its intersection, evaluated in the data layer rather than
enforced by convention inside a chart component. In the UI the dependency runs the other way
round: **choosing a datapoint conditions which WorkTypes are offered**, so an incomparable
selection cannot be expressed in the first place.

**Rework** — A Task on which a **non-accepted root session** was followed by **another root
session**, read over the Task's **non-review** sessions. The follow-up need not attempt the same
class of work: a failed `implementation` followed by a `refactor` is still a second attempt at the
same Task. The distinction between Task and AgentSession exists so that Rework is *measurable* at
all — three retries of one Task and three first-time-successful Tasks are otherwise
indistinguishable.

**Reviews are excluded from the arrangement, and that is what keeps the label about repetition.**
Every implementation, refactor and bug fix is reviewed on its own Task, by somebody else — so a
`review` sits on *every* Task that had work built on it. Counting one would make the label a
statement about review coverage rather than about repeated attempts: a failed Job followed by the
review that found the problem would read as a second attempt, when the second attempt has not
happened yet. Excluding them leaves the two attempts adjacent, so `[implementation failed, review,
implementation accepted]` is Rework for the reason it should be. *(This narrows the reading ticket
05 established, which had a failed `review` followed by an `implementation` as the worked example.
The cross-WorkType clause survives among the four classes that remain; only `review` is out.)*

**It counts attempts, so it counts roots.** A Child session is one agent working *the same*
attempt and carries no acceptance of its own; counting it would read every sub-agent fan-out as a
failed session followed by another, and the metric would rise with how much a team parallelised
rather than with how much it repeated itself. On the committed fixture the difference between the
two readings is 18% and 31%.

**Completed Task** — A Task with **at least one accepted root session**. The unit of delivered
work. Only a root can be accepted, so the qualifier renames nothing it did not already mean.

**Incomplete Task** — A Task with **no** accepted session. Deliberately an umbrella: it covers
both work still in flight and work someone gave up on, and the platform cannot tell them apart,
because it does not own the external Task's lifecycle. Age since the last session is reported
instead, and the reader draws their own conclusion.

**Decomposition** — A Task with more than one accepted **non-review root session**: work
deliberately split, not work repeated. A fan-out inside one attempt is not a split — nobody
decided to divide the Task when an agent spawned a helper — which is the same reason Rework counts
roots, and **a review is not a split either**, for the same reason it is not a second attempt.
Without that exclusion the label would be worthless rather than merely wrong: an accepted Job and
its accepted review are two accepted root sessions, so *every reviewed Task* would be a
Decomposition. Rework and Decomposition are independent labels on a Task rather than a partition;
a long Task can exhibit both. Separating them is what makes multi-session Tasks interpretable —
the raw count alone cannot tell a retry from a split.

**Completed and Incomplete are not narrowed the same way.** A Completed Task has an accepted root
session and an accepted review is one, so a Job whose implementation failed and whose review was
submitted is Completed — and the reviewer's accepted review is a completed Job on their own row.
That is the model's own consequence, not an oversight: acceptance is per session and the review's
criterion (*a submitted review with an outcome*) was met. The two Task-grain *labels* are about
the shape of the attempts; the two Task-grain *states* are about whether anything was accepted.

**WorkType** — The class of work a session is launched to do. **UI alias: "template".** It is
one dimension, not two: the agent configuration *is* the work type, so choosing "bugfix" both
declares intent and bootstraps the session — loading the appropriate skills and prefixing the
first prompt with framing such as *"implementing acme/api-gateway#412"*. Every AgentSession references
exactly one WorkType.

**A `review` session is generated from the session it reviews.** It carries that session's Task
and Repository, runs after it, and is run by a different human Member — so it is not a Job of its
own, and the three WorkTypes that accept on a published pull request (`implementation`, `bugfix`,
`refactor`) each carry one. Every other WorkType is declared at launch by the Member starting it.

The vocabulary is **global and flat**: `implementation`, `refactor`, `bugfix`, `review`, `deploy`.
`research` was cut: with every artefact on GitHub it could produce nothing but a comment, and a
WorkType whose acceptance criterion cannot name a real artefact weakens the efficacy metric
everywhere. Deliberately **not repo-scoped** — a WorkType may well behave differently on
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
| exact | the addressable model version — the storage grain | `claude-sonnet-5` |
| `family` | the vendor's model line, **carrying the vendor** | `Claude Sonnet` |
| `tier` | cross-vendor capability class | `frontier` \| `balanced` \| `fast` |

**`family` and `tier` are two roll-ups of exact, not a chain.** A family is the vendor's *line*
and holds every version of it, so `Claude Sonnet` holds 4.6 and 5, and `OpenAI GPT-5` holds
`gpt-5-nano` and `gpt-5.2` — one `fast` and one `balanced`. A tier is therefore the sum of its
**Models** and not of its families. All three levels partition the same tokens exactly, which is
what makes Model mix readable at any of them; what does not hold, and is never assumed, is that a
family sits inside one tier. A vendor's line spans capability classes, which is the same fact the
tier bet is made against.

**The roster** — ten models, three vendors, every tier cross-vendor, one authored input price each
(`docs/adr/0011-the-roster-grows-to-ten-and-the-mix-moves.md`, amending ADR-0007):

| Model | Vendor | `family` | `tier` | input $/MTok |
|---|---|---|---|---|
| `claude-fable-5-1` | Anthropic | Claude Fable | `frontier` | 10.00 |
| `claude-opus-5` | Anthropic | Claude Opus | `frontier` | 5.00 |
| `gpt-6-astra` | OpenAI | OpenAI GPT-6 Astra | `frontier` | 10.00 |
| `claude-sonnet-4-6` | Anthropic | Claude Sonnet | `balanced` | 3.00 |
| `claude-sonnet-5` | Anthropic | Claude Sonnet | `balanced` | 2.00 |
| `gpt-5.2` | OpenAI | OpenAI GPT-5 | `balanced` | 1.75 |
| `gemini-3.1-pro-preview` | Google | Gemini Pro | `balanced` | 2.00 |
| `claude-haiku-4-5` | Anthropic | Claude Haiku | `fast` | 1.00 |
| `gemini-3.5-flash-lite` | Google | Gemini Flash-Lite | `fast` | 0.30 |
| `gpt-5-nano` | OpenAI | OpenAI GPT-5 | `fast` | 0.05 |

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
**token rate card**, keyed on (model × token class), and the **compute rate card**, keyed on
`machine_spec`. Both are **inputs to the upstream system that attributes Cost**, not to this
application, which prices nothing — see Cost, below. Only the token card is ever surfaced to a
viewer, as a reference table showing the rates the attributed figures were priced against.

Both cards are **period-stable**: a rate does not change inside a reporting window. A mid-window
change would make a rise in spend ambiguous between more usage and a higher price, and no surface
can tell the reader which it was.

The token card **is not keyed on Model alone**: in the real market the key is (model × token class × service tier × context tier ×
region × speed). How much of that key this project models is an open decision.

Rate cards here are **illustrative** — see the labelling rule under Cost, below. Ratios: output ≈ 5× input,
cache read ≈ 0.1× input, cache write 1.25–2× input, batch ≈ 50% off. **These are Anthropic's
ratios and do not generalise** — OpenAI prices output at ~8× input, Google at ~6×. This project
applies them uniformly across all three vendors so the card stays one authored number per model;
the precision lost is stated rather than discovered.

The spread from the fastest to the frontier tier is **200× on input**, which is why Model mix, not
token volume, dominates cost variance. That figure is a property of this project's roster rather
than a constant of the market: it is reachable only with a roster spanning a genuine premium
reasoning model and a genuine nano model, and a roster of mid-range models spans nearer 20×.
See `docs/adr/0007-model-roster-spans-a-real-200x.md`, as amended by ADR-0011 — the roster grew to
ten and the spread is unchanged, now reached by two frontier models against the same nano one.

**TokenUsage** — Tokens consumed by an AgentSession, **keyed by Model**. A single AgentSession
may consume tokens across more than one Model.

Stored as **four raw, disjoint counts** per (AgentSession × Model): uncached input, cache read
(hits), cache write (creation/misses), and output. Disjointness is the property that matters —
it is the only shape that sums safely. The counts are kept because token volume is an adoption
measure in its own right, not because Cost is computed from them here — it is not.

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

**A mix is read over time as well as at a moment.** What a team moves *between* — off the fast
model as the balanced ones get good enough, onto a frontier model the month it arrives, from one
version of a line to the next — is a change in the mix and not a change in volume, and it is the
part of the picture that predicts the bill. The Model mix surface therefore draws each Model's
**share of the period's tokens** period by period, on a fixed 0–100% scale. A share is not a part
of a whole, so it is never stacked.

**The roster is closed, and that is what makes the mix an exception.** Every other dimension the
product charts grows — more Members, more Repositories — so a chart of it is capped and the rest
are swept into "Other". A reader of the mix is choosing between exactly the ten Models in the table
above, and an "Other" holding six of them would delete the finding. The Model mix is the one
surface with a palette of its own, sized to the roster.

**Cost** — Monetary spend. At AgentSession grain it is **token cost plus machine cost**, blended
into one figure; a session never presents the two separately.

**Cost is attributed upstream and stored on the session row.** The platform's billing system
prices each session against the two rate cards and hands the figure over; this application
aggregates it and prices nothing. Analytics that computed its own money would contradict the rule
below that authoritative money lives in billing. The consequence — that the pricing function is no
longer this project's cleanest unit-test target — is recorded in
`docs/adr/0005-session-cost-is-attributed-not-derived.md`.

**Seat cost** — The recurring per-seat subscription fee. Seats attach to Members of kind `human`
only; service accounts hold none. Seat cost is **not a metric of its own and not part of session
Cost**. It is a component of a *total* — and only at monthly grain and coarser, because
apportioning a monthly fee across days is invented precision.

**Total spend** — For a population over a period: session Cost plus Seat cost. Available at
monthly grain and coarser. This is the only figure that represents what the Organization actually
pays. It rolls up to Member, Team, and Organization.

Seat cost is what makes a low-usage Member legible: a seat held against near-zero usage is the
highest cost per unit of work in the Organization, and a consumption-only model cannot see it.

Authoritative money lives in billing, not in analytics — which is why this product reads an
attributed figure rather than computing one. An attributed figure is the bill, so it is **not**
labelled "estimated"; only **Projected cost** carries that label, because a forecast is the one
money figure here that really is an estimate.

The rates themselves are **illustrative** and are labelled so wherever the token rate card is
displayed. That label and the projection label warn about two different things: the rates are
invented, and the forecast is uncertain. The attributed costs are neither.

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

**`self` is granted over every class, to every Role, always.** A Member can always see their own
data and their own permissions. This is an invariant of the model rather than a property of a
preset: restriction bites on *other people*, never on the acting Member's view of themselves.

It is load-bearing in two places. Because scopes are not a ladder, a Role holding `team` over
`jobs` would otherwise hold no grant resolving the acting Member by name, and a restricted account
would meet a page with no people on it. And because `access` is a class like any other, a Member
whose view has just narrowed can always reach the matrix explaining why — which is the whole reason
the matrix is sited where a viewer notices the narrowing.

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
| Repository | flat — no roll-up levels |
| WorkType | flat — no roll-up levels; `source` is provenance, not a level |

**Team is the one non-additive level.** Members are many-to-many with Teams, so Team figures
overlap and do not sum to the Organization. Every other level named here is a true partition.

**`Cohort` is cut.** It was a viewer-keyed comparison group over Repository work domain and
WorkType. Work domain no longer exists, and once the filter set is fixed at
`Repository × Team × WorkType` on every analytical surface, `Cohort` named nothing the filters do
not already name. The similarity relation it expressed — *"people doing work like mine"* — is now
carried by Repository. See `docs/adr/0004-repository-carries-no-work-domain.md`.

**Comparison group** — The Members who worked a given `Repository × WorkType` pair in the selected
period. It is what survives of `Cohort`, re-keyed onto dimensions that still exist, and it is
**computed per view, never stored**. A Member belongs to as many comparison groups as they do kinds
of work.

It is not an access scope and gates nothing; it is relevance, not permission. Nor is it a filter:
a filter shows a population's aggregate, where a comparison group yields a **median set beside the
acting Member's own value**. That is the one comparison a filter cannot express, and it is why the
group survived ADR-0004's cut of `Cohort` rather than being subsumed by the filter set.

## Metric Concepts

**Acceptance rate** — Share of **root sessions** that met their WorkType's acceptance criterion.
This is the efficacy metric. Reported **within** a WorkType, since the criterion differs by type,
which is why there is no Organization-level acceptance rate: averaging across criteria that
measure different things produces a number that means nothing. Child sessions are not in the
denominator: they carry no outcome, so counting them would divide by attempts that could never
have been accepted.

**Rework rate** — Share of Tasks exhibiting Rework.

**Decomposition rate** — Share of Tasks exhibiting Decomposition.

**Incomplete Task count** — Tasks with no accepted session, reported **bucketed by age since the
last session**. The bucketing carries the meaning the platform cannot assert: it does not know
whether a Task is in flight or abandoned.

**Completed Tasks per period** — The velocity measure, and the only one. Session counts are not
velocity: they *rise* when work goes badly.

**Cost per session** — Session Cost, aggregated over a period, per **root session**. The
numerator holds every agent's cost and the denominator counts attempts, so a Task worked by four
agents reads as one expensive session rather than four cheap ones.

**Cost per completed Task** — Total Cost over a period divided by Completed Tasks in it. This is
where cost meets efficacy, and it is the product's central claim: attempts that produced nothing
sit in the numerator and not in the denominator, so waste raises the figure.

**Tokens processed** — The four disjoint token classes summed. An **adoption** measure, not a
cost proxy, and never presented beside a spend figure in a way that invites the inference.

**Session duration** — Wall-clock time from root session start to end, which spans the whole
attempt because a Child session runs inside its root's window. Median and p95 are the meaningful
aggregations; the distribution is right-skewed, so the mean is not.

**Agents per session** — How many agents worked one attempt: the root, plus everything it spawned.
Reported as median and p95, beside Session duration, because on a multi-agent platform how long a
session ran and how many agents ran it are one reading in two halves. A session that fanned out to
nothing is one agent, never none.

**Projected cost** — Total spend extrapolated to the end of the current period, in proportion to
the period elapsed. A forecast, not a measurement.

---

### Period semantics

**Period** — Day, week, or month. Boundaries are computed in the **Organization's declared
timezone**, so an Organization's "last month" is the month its people worked, not a UTC artefact.

**Day is available only over ranges of two months or less.** Over a longer range a daily bucket
holds too few sessions to read, and every surveyed vendor reports cost at daily grain and no
finer for the same reason.

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
