Type: grilling
Status: resolved
Blocked by: 16 (resolved)
Label: wayfinder:grilling

# Fixture grain and schema

## Question

What is the exact shape of the fixture data, and at what grain is it stored?

## What has to come out of it

- **Grain.** Session-level rows, pre-aggregated rollups, or both — and what that costs in
  fidelity and in browser performance. Every filter and roll-up the metric set requires has to
  be answerable from whatever grain is chosen.
- **Derived vs stored.** Which values are computed at read time and which are baked in. Cost is
  derived from TokenUsage against a rate card; whether that derivation happens in the fixture or
  in the app is a real trade-off against testability.
- **Shape of the entity graph** across Organization, Team, Member, Repository, Task,
  AgentSession, TokenUsage, Model, AgentTemplate, Role.
- **Scale and generation.** How much data, over what period, generated how, and seeded so that
  every run is identical.
- **Realism.** The distributions that make the data believable — and, more importantly, the
  ones that make the intended findings actually *present* in the data rather than asserted over
  noise. A fixture that does not contain the insight the dashboard claims to surface is a
  broken demo.
- Whether the archived scale (4 teams / 20 members / 180 days) survives.

## Blocked by

05 (metrics determine what must be answerable) and 08 (taxonomies determine the categorical
columns). This is the ticket the archived v1 got backwards by fixing scale before shape.

**From ticket 12 (2026-09-05, HITL)**:

- **The "must exercise both sides of the floor" requirement is withdrawn** — no floor exists, so
  Team sizes are unconstrained by access rules.
- **Replaced by a harder one: the fixture must contain at least one Member whose cohort crosses a
  Team boundary**, or the `cohort` scope — the central new idea in the access model — is never
  exercised by the demo or the tests. A fixture where work domains map cleanly one-to-one onto
  Teams silently makes cohort and team the same thing.
- **Cohort membership is computed, not stored.** It derives from Repository work domain and
  AgentTemplate on the rows themselves, so no cohort column is needed — but those two dimensions
  now carry access-model weight, not just analytical weight (see 08).
- **Rate cards must be present and priceable per Member**, since Team per-capita currency is
  derived, not stored.

**Correction — ticket 12 was reversed after the note above was written (2026-09-05).** The
requirements survive but their reason changed. `cohort` is no longer an access scope; it is an
aggregation dimension. The fixture must still contain **at least one Member whose cohort crosses a
Team boundary** — now so the *comparison control* is exercised rather than the permission model.
Access grants no longer constrain Team sizes at all: the default is `org-member` over everything.
New requirement instead: the fixture must support at least one **restricted Role preset** having a
visibly different view from the default, or ticket 06's presets cannot be demonstrated.


**From ticket 08 (2026-09-07, HITL)** — the entity graph and the categorical columns are fixed;
see `CONTEXT.md` §§ Work and Models & Money for field-level detail. Consequences for the fixture:

- **Grain is the AgentSession**, with TokenUsage at (session × model × four disjoint token
  classes). Cost is **derived, never stored** — the pricing function is a pure function and is
  09's cleanest unit-test target after the comparability intersection.
- **Every session carries an external Task key**; there are no unattributed sessions to model.
- **Invariant to assert in the generator**: the three duration spans sum exactly to
  `machine_allocation_duration_s`.
- **Distributions that must be present**, or the intended findings are asserted over noise:
  headless sessions ~100% AFK with zero interactive/idle time; at least one Task exhibiting
  Rework and one exhibiting Decomposition; at least one CPU-heavy, token-light session so the
  machine-allocation datapoint has something to find when it is expanded.
- **The `WorkType → [artefact kind]` map is fixture data**, not chart-layer convention.
- **Still needed from 08**: the Repository work-domain vocabulary and the Model roster.

## Blocking re-stated (2026-09-07)

`Blocked by` was `05, 08`. Ticket 08 is resolved, but it discharged only part of what this
ticket needed from it and graduated the rest. Current blockers:

- **05** — the metric set determines what the grain must be able to answer. Unchanged, and the
  keystone.
- **13** — whether the normalisation boundary is built or documented determines whether the
  fixture needs vendor-shaped token rows at all.
- **16** — the Repository work-domain vocabulary and the Model roster with its rate card. These
  are the categorical columns and the pricing input; 08 fixed their shape and left their values.

07 is deliberately **not** a blocker: this ticket owns the data, not its arrangement.

**From ticket 05 (2026-09-07, HITL)** — this ticket is now unblocked on 05. New fixture
requirements:

- **Organization carries a declared timezone.** Period boundaries derive from it.
- **A compute rate card keyed on machine specification**, plus a flat monthly **seat fee**.
- **Hidden sessions** — infra-failed — must not appear in customer analytics. Decide whether they
  exist in the fixture at all or are simply never generated.
- **Session has no `terminal_status`.** `accepted` is the only outcome field.
- Distributions that must be present, extending 08's list: at least one **Incomplete Task** in
  each age bucket, and at least one Member holding a seat with near-zero usage — otherwise the
  sharpest finding in the product has nothing to find.

## Answer

Resolved 2026-09-07, HITL, in the same session as ticket 16. This closes the map.

### The Organization

**Equilibrio**, slug `demo`, timezone **`Europe/Madrid`**. Spanish Member names, English Team
names, GitHub logins that do not trivially match the full names so the identity join is visibly
doing work. UTC+2 across the whole window: sessions between 22:00 and 24:00 local fall on the
previous UTC day, and the generator places some there **on purpose** — otherwise the declared-
timezone decision is never exercised. No timezone has a DST transition inside this window, so that
case is not covered.

### Window and scale

**12 Apr – 8 Sep 2026 inclusive, 150 days.** A mid-month start and a fixed end at the presentation
date. April and September are both partial and are **flagged as partial**, not withheld and not
pro-rated — the mechanism ticket 05 already settled for incomplete periods, used once for both
ends. April matters because seat cost is a whole month against 19 days of sessions, so its cost per
completed Task is inflated by construction and the flag is what stops that being read as a finding.

| | |
|---|---|
| Teams | 4 — Platform, Product, Data, Infrastructure |
| Members | 20 — 18 `human`, 2 `service_account` |
| Repositories | 5 — `web-console`, `mobile-app`, `api-gateway`, `ml-scoring`, `terraform-infra` |
| WorkTypes | 5 — `implementation`, `refactor`, `bugfix`, `review`, `deploy` |
| Models | 7 across 3 vendors (ticket 16) |
| Tasks | ~600 |
| AgentSessions | ~750 |

**Teams and Members are many-to-many, and Team aggregation is non-additive.** A primary Team for
roll-up was proposed and rejected: GitHub teams overlap, so a primary would be an invention. The
product handles it in the presentation instead — see Chart rules.

Four Teams over five Repositories blocks a one-to-one mapping, so the Team filter and the
Repository filter return different populations. That satisfies ticket 12's cross-boundary
requirement structurally rather than by hoping the generator produces it.

### Volume — the adoption ramp

**Median 0 sessions per Member per week in April rising to 2 in August; max 3 rising to 8.** That
gives ~750 sessions, an order of magnitude below the 9,000 first proposed. The trade is deliberate
and runs both ways:

- **Against**: charts are sparse. 750 over 150 days is ~5 sessions per day org-wide. **Day grain is
  therefore restricted to ranges of two months or less** — added to `CONTEXT.md` § Period semantics.
- **For**: it makes the sharpest finding in the product real. Seat cost is $39 × 18 humans × 6
  months = **$4,212** against ~$4,500 of session spend. Seats are ~48% of Total spend and dominate
  outright in April. A high-volume fixture would have buried that.

The archived v1 scale (4 teams / 20 members / 180 days) survives only in its team and member
counts. The window and the volume do not.

### Grain, storage and derivation

**Grain is the AgentSession.** TokenUsage at (session × model × four disjoint classes).

**Cost is attributed upstream and stored on the session row. The application prices nothing.**
This reverses ticket 08 and the previous `CONTEXT.md` position that cost is derived and never
stored. The rate cards move into the generator; the token card is displayed on `/demo/spend` as a
reference table showing what the generator priced against.
→ `docs/adr/0005-session-cost-is-attributed-not-derived.md`.

**The cost of that reversal is recorded, not discovered**: the pricing function was the map's named
"cleanest unit-test target", and test coverage is one of three stated grading criteria. The tests
that replace it assert **aggregations, not billing totals** — non-additive Team roll-ups, the
comparability intersection, timezone-bounded period edges, per-capita denominators that exclude
service accounts. Those are where this product's real failures live; pricing a session is
multiplication.

### Session shape

| | |
|---|---|
| Median session cost | ~$3.20 (p95 ~$35) |
| Median machine allocation | 1.8h; 3h for `implementation` |
| Interactive spans, median 108 min | 40 interactive / 30 idle / 38 AFK |
| Headless sessions | median 150 min, **100% AFK**, zero interactive, zero idle |
| Median tokens | 2.5M cache read, 100k uncached input, 200k cache write, 60k output |
| `execution_mode` | 70% `interactive`, 30% `headless` |
| `machine_spec` | `general` 60% · `compute` 15% · `memory` 15% · `storage` 10% |

The generator asserts on every row that the three spans sum exactly to
`machine_allocation_duration_s`. Idle at ~28% is what makes the idle span worth storing at all: a
token figure for the same session cannot see it.

`machine_spec` correlates with the repository rather than being noise — `memory` concentrates in
`ml-scoring`, `compute` in `terraform-infra` and `api-gateway`.

### Model mix

**Token share: `balanced` 55%, `fast` 30%, `frontier` 15%.** Priced against ticket 16's card,
`frontier` carries **~56% of token spend on 15% of tokens**. That is the 200× spread made visible,
and it is why tokens are an adoption measure and never a cost proxy.

**40% of sessions span two or more Models**, so "Model is a breakdown, not a comparison axis"
(ticket 05, G11) has real cases behind it rather than being a rule about a hypothetical.

**Trend: frontier token share falls from 25% in April to 10% in August.** Spend per session drops
while session count rises — a legible optimisation story, and the one thing on the dashboard a
reader can act on.

### Artefacts and acceptance

**Every artefact is on GitHub. There is no `document` kind, and no Jira.** Tasks are GitHub Issues
keyed `owner/repo#number`. `research` was cut from the WorkType vocabulary as collateral: with no
document it could produce nothing but a comment, and a WorkType whose acceptance criterion cannot
name a real artefact weakens the efficacy metric everywhere.

| WorkType | Artefact kinds | Acceptance criterion |
|---|---|---|
| `implementation` | pull_request, commit, file_changed, line_changed | PR published |
| `bugfix` | pull_request, commit, file_changed, line_changed | PR published |
| `refactor` | pull_request, commit, file_changed, line_changed | PR published |
| `review` | pr_comment | review submitted with an outcome |
| `deploy` | commit, pr_comment | commit landed on the default branch |

`deploy` cannot accept on "PR merged" — it produces no pull request. The default-branch commit is
its criterion and is strictly harder than PR published, which is why it can sit lowest without the
metric being unfair.

The three code WorkTypes now **share** a criterion, so their acceptance rates are comparable with
each other. `review` and `deploy` are comparable with neither, so the no-org-level-acceptance-rate
rule still holds. The comparability intersection keeps one live case: `review` shares nothing with
the code types.

### The findings the data must carry

**Acceptance rate by WorkType**: `review` 0.86 · `bugfix` 0.79 · `implementation` 0.71 ·
`refactor` 0.58 · `deploy` 0.34.

**Acceptance rate by Repository**: `web-console` 0.78 · `mobile-app` 0.70 · `api-gateway` 0.62 ·
`ml-scoring` 0.55 · `terraform-infra` 0.44.

The repository spread carries brief 15's Stanford signal through the repository names, which is
ADR-0004 working: no domain column, and the finding still lands. `deploy` at 0.34 is the strongest
single claim in the fixture — agents are poor at deploys, and deploys are where a service account
runs *interactive* sessions.

Also required to be present:

- **Rework 18% of Tasks, Decomposition 12%.**
- **Incomplete Tasks in all four age buckets**: 0–7 · 8–30 · 31–90 · 90+ days. 90+ is reachable
  inside a 150-day window, so the oldest bucket is not empty by construction.
- **One human Member holding a seat with fewer than 5 sessions** across the whole window. The
  sharpest finding in the product needs a person to point at.
- **~20 CPU-heavy, token-light sessions** on `compute` in `terraform-infra` and `api-gateway`:
  long, almost no tokens. Invisible to a token view, visible in Cost.
- **~2% hidden sessions** — infra-failed. **Generated, then excluded in the data layer.** If they
  never existed the exclusion rule would have nothing to act on and could not be tested; with them,
  the same query returning different counts with and without the filter is a cheap, sharp unit test.
- **One `service_account` running interactive sessions** (the deploy account), and humans running
  headless ones. That is the cell ticket 08 said would be lost if `execution_mode` and `Member.kind`
  were conflated.
- **At least one Repository worked by Members of two or more Teams.**
- **At least 3 Members belonging to more than one Team**, so the non-additive case is real.

### Files, generation and provenance

Datasets are shaped by **where they would really come from**:

- **Sessions — platform events.** One JSON file per `(repository × work_type)`, rows ordered by
  timestamp. All **25 files exist**; empty pairs hold `[]`, so the file set declares the full matrix
  and a missing file is unambiguously a fault rather than a valid state. ~30 rows per file.
- **Members, Teams, Repositories, Tasks — mocked GitHub API**, serialised. GitHub field names
  (`login`, `email`, `full_name`, `id`, `full_name` for repos) with a **simplified envelope**: no
  pagination, no `_links`, no unread fields. A faithful envelope would need a real adapter layer,
  and ticket 13 was closed `wontfix` on exactly that ground.
- **WorkTypes, Models, rate cards, Organization — mocked internal API**, serialised.

**The GitHub → Member join is authored, not modelled.** The match rule (fuzzy on email and full
name) is documented in the fixture README so a reader can see the join, but **no GitHub user fails
to match**. An unmatched user is a real product problem that none of ticket 07's six surfaces would
show, and modelling it would add an unreachable state to every aggregation.

**Deterministic**: committed generator script, fixed seed, **committed JSON output**. Tests read the
committed output and never run the generator — a test that regenerates its own input tests the
generator, not the app. A CI check asserts the committed output still matches the seed.

### Accounts

Both Members sit in `demo`, per ticket 07's two accounts / two JWTs / server-side enforcement.

- **Open default** — `org-member` over `jobs`, `tokens`, `cost`.
- **Restricted preset** — `self` over `cost`, `team` over `jobs` and `tokens`, no `access`.

Both must have real sessions in the fixture, and the restricted view must differ **visibly** on
`/demo/people` and `/demo/spend`, or ticket 06's reinstated preset is untestable.

### Chart rules (handed to the build, not to `CONTEXT.md`)

- **No stacking, anywhere.** Stacking encodes a partition; Team is not one, and no caption can undo
  a false claim made by the geometry.
- **No pie charts, anywhere.**
- Side-by-side charts and grouped bars are fine.
- Any Team grouping states the overlap: *"3 Members belong to more than one Team; totals overlap."*
- **The top-4 + "Other" series cap applies only above five series.** Five repositories show five;
  an "Other" bucket holding one repository reads as a rendering fault. The cap still bites on
  Member (20) and exact Model (7).
