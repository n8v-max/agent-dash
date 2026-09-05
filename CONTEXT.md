# Domain Glossary

The canonical vocabulary for this project. Glossary only — no decisions, no routes, no
implementation detail. Decisions live on the wayfinder map and in `docs/adr/`.

---

## Organisation & People

**Organization** — The top-level billing and access-control unit. An org subscribes to the
platform and manages Members. All analytics are scoped to an Organization.

**GitHubOrg** — The external GitHub organisation linked to an Organization. Source of truth
for Team and Member import.

**Team** — A group of Members within an Organization, imported from a GitHubTeam in the linked
GitHubOrg. A Member belongs to one or more Teams. Hierarchy: Organization → Team → Member.

**Member** — A person who belongs to an Organization and runs Tasks. Carries a Role.

**Repository** — A GitHub repo within the linked GitHubOrg. Tasks are tagged to a Repository.
Surfaced in the UI as "Project".

A Repository carries a **work domain** label — e.g. mobile, data science, backend, frontend,
infrastructure config. The domain, not the repo identity, is what makes this dimension
analytically valuable: agent efficacy and cost profile differ sharply by the *nature of the
work*. The domain vocabulary is an open decision.

---

## Work

**Task** — The unit of work a Member asks an agent to do: one request, one intended outcome.
A Task is resolved by one **or more** AgentSessions. **UI alias: "Job".** `Task` is the
canonical term in code, schemas and specs; `Job` is the label shown to users and the name of
the corresponding datapoint class.

**AgentSession** — A single *attempt* at a Task. Has a start time, duration, status
(`completed` | `failed` | `interrupted`), and TokenUsage. The atomic unit of platform activity
and the grain at which cost is incurred.

**Rework** — A Task that required more than one AgentSession to resolve. The distinction
between Task and AgentSession exists so that Rework is *measurable*: three retries of one Task
and three first-time-successful Tasks are otherwise indistinguishable.

**AgentTemplate** — A named, versioned agent configuration that a Task runs under. Three kinds:
- `vendored` — built-in, shipped by the platform
- `user_tuned` — derived from a vendored template, customised by a Member or Organization
- `api_provided` — registered via the platform API (third-party or org-authored)

Every AgentSession references exactly one AgentTemplate.

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

**Rate card** — The pricing that converts TokenUsage into Cost. **It is not keyed on Model
alone**: in the real market the key is (model × token class × service tier × context tier ×
region × speed). How much of that key this project models is an open decision.

Rate cards here are **illustrative** and must be labelled as such wherever they are surfaced.
Useful stable ratios: output ≈ 5× input, cache read ≈ 0.1× input, cache write 1.25–2× input,
batch ≈ 50% off. The spread from the fastest to the frontier tier is roughly **200× on input** —
which is why Model mix, not token volume, dominates cost variance.

**TokenUsage** — Tokens consumed by an AgentSession, **keyed by Model**. A single AgentSession
may consume tokens across more than one Model.

**Token class** — The priced categories tokens fall into. Every token-based vendor reports at
least four, separately, because each is priced differently: uncached input, cache read, cache
write, output. Two hazards this project has to hold precisely, both established by ticket 02:

- **The classes are not defined the same way across vendors.** Anthropic and Bedrock report
  uncached input as a **disjoint** class; OpenAI's `input_tokens` is a **superset** that already
  includes cached and cache-write tokens. Summing them naively across vendors double-counts.
- **Cache writes subdivide by TTL** and are priced differently by TTL (Anthropic: 1.25× at 5m,
  2× at 1h). A single flat `cache_write_tokens` cannot be priced against that card.

How this project normalises across those definitions is an open decision (ticket 13).

**Model mix** — The distribution of TokenUsage across Models for a given population and
period, viewable at any of the three roll-up levels.

**Cost** — Monetary spend, derived from TokenUsage evaluated against the applicable rate card.
Rolls up to Member, Team, and Organization.

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
| `jobs` | Task and AgentSession activity: counts, status, duration, template, rework |
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
| Member | Member → Team → Organization |
| Model | exact model → family → tier |
| Repository | repository → work domain |
| AgentTemplate | template → kind (`vendored` / `user_tuned` / `api_provided`) |
| Cohort | Repository work domain, AgentTemplate, or both — **viewer-selected** |

**Cohort** — Not an access scope. A comparison group: the population it is *meaningful* to measure
a Member against, being those doing comparable work. Its key is viewer-selected, so membership is
computed per view rather than stored, and a Member belongs to as many cohorts as they do kinds of
work. It answers *"am I heavy or light on work like mine"*, which a Team-level or org-level
average cannot — the sole engineer doing mobile work has no meaningful comparator on their own
Team. Access does not gate it; relevance is what it is for.

## Metric Concepts

Only terms fixed by the model itself are listed here. The dashboard's metric *set* is an open
decision; terms graduate into this section as it settles.

**Success rate** — Share of AgentSessions with status `completed`, against `failed` and
`interrupted`.

**Session duration** — Wall-clock time from AgentSession start to end. Median and p95 are the
meaningful aggregations; the distribution is right-skewed, so the mean is not.

**Rework rate** — Share of Tasks requiring more than one AgentSession.
