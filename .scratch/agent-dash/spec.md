# Requirements spec — agent-dash

Status: draft for review
Written: 2026-09-07
Supersedes: nothing. First spec for this project.

**Sources.** This spec collapses settled decisions into requirements. It invents no product
positions. Every requirement traces to `CONTEXT.md`, `docs/adr/0001`–`0005`, or a resolved ticket
under `.scratch/agent-dash/issues/`. Where two settled sources disagree, the conflict and its
resolution are recorded in § Conflicts resolved rather than silently applied.

**Reading order for an implementer.** `CONTEXT.md` first — the domain model is two-dimensional and
non-obvious, and this spec uses its vocabulary without redefining it. Then `docs/adr/0003`,
`0004`, `0005`. Then this file, then `technical-spec.md`, then `testing-spec.md`.

**Requirement IDs are stable.** `testing-spec.md` and the implementation tickets reference them.
Do not renumber.

---

## 1. What this is

An organisation-level analytics dashboard for a fictional cloud agent-execution platform, built
as a take-home for ForGood AI. It is graded on three things: how valuable and usable the solution
is, test coverage, and the quality of the human decisions behind it.

**Product spine: cost control. Differentiator: joining cost to efficacy.** Cost alone is a
billing page every competitor already ships. The claim this product makes that others do not is
**Cost per completed Task** — attempts that produced nothing sit in the numerator and not in the
denominator, so waste raises the figure.

**The product makes no productivity claim.** Measuring a gain requires a pre-agent baseline, and
the observation window is entirely agent-assisted. Only period-over-period velocity is observable.
The product never asserts the contested premise, so it has nothing to defend.

### 1.1 Non-goals

Out of scope, each already argued and recorded:

- Quota, budgets, enforcement, alerting, notifications. This is an analytical dashboard, not a
  control plane. Cost *projection* is in; cost *limits* are out.
- Real OAuth, live API integration, a real GitHub App. Fixture data throughout.
- Role authoring UI. Permissions are data; the matrix renders read-only.
- `/features`, `/compare`, `/pricing`. The dashboard is the value demonstration.
- A designed zero-data state (ticket 11, `wontfix`). See R-E1.
- Quality signals — defect, revert, change-failure rates. They need Git and incident systems the
  platform does not own.
- Vendor-shaped token normalisation (ticket 13, `wontfix`). The boundary is documented in
  `CONTEXT.md` § Token class; no un-normalisable fixture rows exist.

---

## 2. Actors, tenancy and access

**R-A1 — The product is multi-tenant.** `demo` is an Organization slug, not a demo-mode prefix.
The code supports arbitrarily many Organizations; only `demo` is seeded.

**R-A2 — The Organization slug lives in the URL path**, not only in a token. Tenancy that exists
only in a token is invisible in the artefact a reviewer inspects, and breaks the moment one
account belongs to two Organizations.

**R-A3 — Two accounts ship, each holding a distinct JWT.**

| Account | Grants |
|---|---|
| Open default | `self` over all four classes · `org-member` over `jobs`, `tokens`, `cost`, `access` |
| Restricted (contractor) | `self` over all four classes · `team` over `jobs` and `tokens` |

Both are Members of `demo` with real sessions in the fixture.

**R-A3.1 — `self` is granted over every class, to every Role, always.** A Member can always see
their own data and their own permissions; restriction bites on *other people*. This is an invariant
of the model, not a property of a preset (`CONTEXT.md` § Access), and it is load-bearing: scopes
are not a ladder, so a Role holding only `team` over `jobs` would resolve nobody by name and
`/demo/people` would render with no people on it. It was load-bearing twice until C9 withdrew the
permission matrix; the surviving reason carries it alone. See § 11 C6, C9.

**R-A4 — `/sign-in` offers two "continue as" buttons**, each issuing that account's JWT and
redirecting to `/demo`.

**R-A5 — The header account switcher re-issues the token and reloads in place**, keeping the
viewer on the current URL. The difference must read as *the same page with fewer rows*.

**R-A6 — Enforcement is server-side and lives in the data layer.** A figure the acting Member is
not granted must never reach the client payload. Client-side filtering over a full fixture is
explicitly rejected: it ships every Member's data to a contractor's browser and makes the access
model theatre.

**R-A7 — A token/path Organization mismatch, or an unknown slug, returns 404 — not 403.** A 403
confirms that an Organization exists, which is a tenancy leak.

**R-A8 — Navigation is identical for both accounts.** No item is hidden, none is disabled. The
restricted account simply receives fewer rows.

**R-A9 — Visibility under the open default is symmetric.** Named individual usage and spend for
anyone in the Organization, visible to everyone on the same terms. No minimum-population floor at
any scope or class. No administrative tier sees more than an ordinary Member. (ADR-0003.)

**R-A10 — No permission matrix ships. `/demo/people` states the acting account's visibility in
one sentence**, e.g. *"You can see yourself by name; your Team's work reaches totals only."* It
carries no figures, so it is not an aggregate row under another name.

Ticket 07 sited a read-only matrix here because *"a viewer who switches and sees the tables shrink
needs somewhere to learn why."* The need is real; a permissions grid is not the MVP answer to it.
The restricted account's page is a single row, and one row with no explanation reads as a fault
rather than as a restriction — so the sentence is an empty-state affordance first and an access
disclosure second. See § 11 C9.

**The grant is withdrawn from the surface, not from the model.** `access` remains a class in R-A3
and `self` over it remains universal (R-A3.1); nothing renders it.

---

## 3. Routes and surfaces

**R-N1 — The route axis is the question, never the subject.** Subject scope and datapoint class
vary *inside* a page, in the query string. They never appear in a path.

| Route | Renders | Period control |
|---|---|---|
| `/` | Landing: positioning line, one link to sign-in | — |
| `/sign-in` | Two "continue as" buttons | — |
| `/demo` | Org root — the summary. Four tiles, nothing else | Month |
| `/demo/spend` | What we spend, and what we get for it | Day, week, month |
| `/demo/work` | Whether the agents are working | Day, week, month |
| `/demo/people` | Who, and how they compare | Period only |
| `/demo/history` | The raw rows under every aggregate | Date range |
| `/demo/projection` | Where the current month lands | Current month |

**R-N2 — `/demo/history` and `/demo/projection` are secondary**, reached from a flat two-item
ellipsis menu in the header, each item carrying a one-line description. Two items do not earn a
grouping; a third would.

**R-N3 — Shell.** Top header: product mark · nav (`/demo`, spend, work, people) · ellipsis
(history, projection) · account switcher. Below it a **sticky page toolbar** holding that page's
declared controls, period first. The toolbar is absent on pages declaring no controls.

The header holds *who you are*; the toolbar holds *what is in the URL*. Keeping them visibly
separate keeps the two kinds of state distinct. No sidebar: four nav items plus an overflow do not
fill one, and the seven-column people table and the acceptance small multiples both want the
horizontal space.

### 3.1 `/demo` — the summary

**R-N4 — Four tiles, nothing below them.** Total spend · Completed Tasks · Cost per completed
Task · Completed Tasks by WorkType.

**R-N5 — Each tile is itself the link to the page carrying its evidence.** The tiles do both jobs
— the ten-second read and the route into detail — so no separate link row exists.

**R-N6 — `/demo` is month-locked. Month is the only period.** Total spend does not exist below
monthly grain, and a tile that silently changes metric with the period is the failure the
unaccepted-spend tile was cut to avoid.

`quarter` is dropped. It reached ticket 07 without ever entering the glossary — `CONTEXT.md`
§ Period semantics defines Period as day, week or month — and over the 150-day fixture window it
yields exactly two buckets, **both partial**, so every quarter figure on the surface that owns the
ten-second read would carry an incompleteness flag. See § 11 C7.

**R-N7 — Each tile carries a period-over-period change figure**, subject to the change floor
(R-M12) and to R-M13's partial-baseline rule.

**The comparison reads outside the selected window.** The prior month is the month before the
selection, whether or not the selection contains it — a comparison is not a filtered view. Without
this, choosing any single month clips the range so no prior bucket exists and all four change
figures suppress at once, which made the page's only control degrade the page. See § 11 C12.

**R-N8 — The fourth tile is Completed Tasks by WorkType**, rendered **unstacked** as sorted
horizontal bars over the reported month, longest first, with no axis labels at tile size. **All five
WorkTypes render; no "Other" bucket appears**, because the cap engages only above five series
(R-V4). It is never empty, which Rework rate — the slot's original occupant — could not guarantee.
Session counts were rejected as the measure: they are not velocity, because they *rise* when work
goes badly.

**The tile carries no headline figure and no change figure.** Its subject is the mix; the count is
the tile beside it. Building this tile from that one's reading printed the same number and the same
delta twice on the page graded for the ten-second read.

**It does not stack, because WorkType does not partition this measure.** The earlier justification —
every AgentSession references exactly one WorkType — is true of sessions, not of Tasks, and a Task's
sessions may span several. Measured against the committed fixture, August 2026: the slices sum to
162 against the Completed Tasks tile's 150 (restricted account, 55 against 49). That is the false
whole R-V1 exists to forbid. See § 11 C11.

### 3.2 `/demo/spend`

**R-N9 — Panels, in this order:**

1. Cost per completed Task over time
2. Total spend, split into session cost and seat cost
3. Cost per session, with the `accepted` filter
4. Cost per completed Task by WorkType
5. Cost by Repository

Then an **Adoption** section under its own heading, opening with a one-line statement that these
measure use and not money:

6. Tokens processed over time
7. Model mix at exact / family / tier

**R-N10 — The page opens with the ratio, not with Total spend.** Total spend has already been
read on the summary; repeating it in the first position spends the fold twice. The ratio is the
differentiator; the total is the number every competitor already ships.

**R-N11 — The illustrative token rate card renders as a collapsed table at the foot.** It is the
evidence for every money figure in the product and costs one collapsed table. **The compute rate
card is never displayed anywhere** — rates vary by machine specification and the breakdown is not
something a viewer should reason about.

### 3.3 `/demo/work`

**R-N12 — Panels, in this order:**

1. Completed Tasks per period — raw or per-capita
2. **Acceptance rate as small multiples**, one chart per WorkType on a shared axis
3. Rework rate and Decomposition rate as two lines on one chart (both Task-grain rates)
4. Incomplete Tasks as a horizontal bar by age bucket
5. Session duration — median and p95
6. Human-presence spans and machine time as one **stacked** composition, **restricted to
   `interactive` sessions and labelled so**. The three spans are disjoint and sum exactly to
   `machine_allocation_duration_s`, so they are a true partition and stack legitimately (R-V1)

**R-N13 — Acceptance rate uses small multiples, never a single chart with a WorkType selector.**
Acceptance rate is defined only *within* a WorkType, and the layout makes that visible with no
caption. A selector would hide four of five values and make a viewer click to discover that the
comparison is not offered.

**R-N14 — Human-presence spans are shown for `interactive` sessions only.** A `headless` session
is AFK for its entire lifetime by construction, so a view spanning both modes would merely
rediscover which sessions were headless.

### 3.4 `/demo/people`

**R-N15 — A table of Member · Team · kind · Completed Tasks · Sessions · Tokens · Cost.** Every
numeric column sortable. **Default sort: Completed Tasks descending.**

That is an ordering by output rather than by spend, and no percentile label is computed — but it
is an ordering the product chose, and it is recorded as a decision rather than left as drift.

**R-N16 — `?member=…` replaces the list with that Member's profile**: the four headline tiles at
their scope, their WorkType mix, and the comparator (R-N17).

**R-N17 — The comparator is paired bars**, showing the Member's value beside the **Comparison
group's** median for Completed Tasks per period, Cost per completed Task and Tokens processed. The
key is named in words, e.g. *"api-gateway · implementation, 6 members"*.

**Comparison group** is a glossary term (`CONTEXT.md` § Aggregation Dimensions): the Members who
worked a given `Repository × WorkType` pair in the selected period, computed per view and never
stored. It is not an access scope and gates nothing.

Paired bars, not a distribution strip: a strip shows a position within a spread, which is a
percentile drawn rather than written.

**R-N18 — Acceptance rate does not join the comparator.** A Member's comparison group spans
several WorkTypes, and one acceptance figure would average incommensurable criteria.

### 3.5 `/demo/history`

**R-N19 — A flat table, one row per AgentSession**: started (Organization timezone) · Member ·
WorkType · Repository · Task key · execution mode · `accepted` · duration · tokens · cost.

**R-N20 — Selectors: date range, Member, WorkType, Repository.** Default sort newest first,
client pagination at 50.

**R-N20.1 — A row expands to show that session's four disjoint token class volumes and its Model
mix.** This is the only surface in the product carrying either. Per-session Model mix is meaningful
*only* here: R-M7 forbids Model as an axis on any aggregate, so no other panel can legally show it.
The four classes appear elsewhere only as rate-card *columns*, never as volumes.

Ticket 07 declined this row in favour of extra selectors on a flat table; the two are not
alternatives, and without it the most carefully modelled part of `CONTEXT.md` § Models & Money is
provable in tests and prose but never on screen.

**R-N21 — The Task key renders as plain text**, in `owner/repo#number` form. The external tracker
is imaginary; a dead link is worse than none.

**R-N22 — Hidden sessions appear here as nowhere else — that is, not at all.**

### 3.6 `/demo/projection`

**R-N23 — Actual spend to date, plus month-end spend extrapolated in proportion to the period
elapsed.** The method is stated in one sentence, the elapsed fraction is shown as a share, and the
incomplete-period flag is present.

**R-N24 — No confidence band.** A band computed over authored fixture data would be fabricated
precision dressed as rigour. The method plus the elapsed fraction is the honest uncertainty
statement available here — a projection at 10% elapsed and one at 90% are different claims.

**R-N25 — Nothing else in the product depends on `/demo/projection`.**

---

## 4. Metrics

**R-M1 — The metric inventory.** No metric outside this table ships.

| Metric | Class | Grain and scoping |
|---|---|---|
| Total spend | `cost` | Session Cost + Seat cost. **Monthly grain and coarser only** |
| Cost per session | `cost` | Filters: WorkType, Repository, `accepted`. Day / week / month |
| Cost per completed Task | `cost` | The join. Filter: presence of a WorkType |
| Completed Tasks per period | `jobs` | Velocity. Raw by default, per-capita on toggle |
| Acceptance rate | `jobs` | **Within a WorkType, always** |
| Rework rate | `jobs` | Task grain |
| Decomposition rate | `jobs` | Task grain |
| Incomplete Tasks | `jobs` | Bucketed by age since last session |
| Tokens processed | `tokens` | Sortable column and time series. Adoption, not cost |
| Model mix | `tokens` | Distribution at exact / family / tier |
| Session duration | `jobs` | Median and p95 |
| Human-presence spans | `jobs` | Composition, `interactive` sessions only |
| Projected cost | `cost` | `/demo/projection` only |

**R-M2 — Hidden sessions are excluded from every metric and every view.** An AgentSession that
terminated through platform or infrastructure failure is absorbed by the platform, is not billed
to the Organization, and appears nowhere. This is what makes Acceptance rate a clean measure of
*agent* efficacy with no platform noise in it. The exclusion is a data-layer invariant, applied
once, not a per-query filter.

**R-M3 — A session has exactly one outcome field, `accepted`.** There is no `terminal_status` and
no completion rate.

**R-M4 — Session Cost is attributed upstream and stored on the session row. The application
prices nothing.** It aggregates an attributed figure. (ADR-0005.)

**R-M5 — Seat cost sits outside session Cost**, as a component of Total spend, at monthly grain
and coarser only. Seats attach to `human` Members only. Apportioning a monthly fee across days is
invented precision.

**R-M6 — There is no Organization-level acceptance rate.** Averaging across criteria that measure
different things produces a number that means nothing.

**R-M7 — Model is a breakdown, not a comparison axis.** No per-session metric may be grouped by
or filtered on Model. A session may span several Models, so doing so attributes one session's cost
to one model unsoundly. Model mix stays a distribution at all three roll-up levels.

**R-M8 — Output artefact counts are comparable only across WorkTypes sharing an artefact kind.**
The `WorkType → [artefact kind]` map is data, and comparability is its intersection, evaluated in
the data layer. In the UI the dependency runs the other way: **choosing a datapoint conditions
which WorkTypes are offered**, so an incomparable selection cannot be expressed in the first
place.

**R-M9 — Tokens processed is the four disjoint classes summed.** It is an adoption measure, never
a cost proxy, and is never presented beside a spend figure in a way that invites the inference.
The Adoption section heading and its one-line statement (R-N9) carry this.

**R-M10 — Period boundaries fall in the Organization's declared timezone**, not UTC. Bucketing is
therefore a pure function of `(rows, timezone)`.

**R-M11 — Day grain is available only over ranges of two months or less.** Over a longer range a
daily bucket holds too few sessions to read.

**R-M12 — The change floor is one.** A change figure is suppressed when the prior period holds
*nothing at all*, and when the prior period is *incomplete* (R-M13). Above zero and complete it is
shown: two to three sessions week-over-week really is +50%, and on a narrow self-view that is the
honest reading, not noise.

**R-M13 — Comparison is unrestricted. An incomplete *current* period is flagged; an incomplete
*prior* period is withheld.** Any period may be compared with any other. The asymmetry is the point:
a part-month on screen is visible, flagged and chosen by the viewer, whereas a part-month used as a
baseline is none of those things and inflates the comparison without bound. Withholding is not
pro-rating — R-E2 forbids inventing the missing days, not declining to divide by them. See § 11 C13.

**R-M14 — Per-capita divides by active *human* Members**, excluding service accounts, which hold
no seat and would give the denominator the wrong size. Raw is the default; per-capita is offered
wherever more than one Member is aggregated.

**R-M15 — Ranking exists but is never editorialised.** Per-Member tables sort by total cost and by
total tokens. **No surface defaults to sort-by-cost, no tile is titled "top spenders", and no
Member carries a computed percentile label.** Every documented 2026 failure was default-on ranking
as the headline, not the ability to sort a table.

**R-M16 — Incomplete Tasks are reported bucketed by age since the last session**: 0–7 · 8–30 ·
31–90 · **91+** days. The buckets are half-open and must not double-cover day 90. The platform does not own the external Task's lifecycle and cannot tell
in-flight from abandoned, so age carries what the label cannot claim.

---

## 5. Controls and URL state

**R-C1 — Controls are declared per page, not per chart.** Each page declares the dimensions its
panels use; a control applies to every panel on that page that uses that dimension, and to no
others. **No page shows a control its panels cannot use, and no page shows a greyed control.**

| Page | Declared controls |
|---|---|
| `/demo` | Period (month) |
| `/demo/spend` | Period and grain · subject (Team or Member) · Repository · WorkType · `accepted` · per-capita · Model roll-up (exact/family/tier), **scoped to the Adoption section** |
| `/demo/work` | Period and grain · subject · Repository · WorkType · `execution_mode` · per-capita |
| `/demo/people` | Period · Team · Member kind · sort |
| `/demo/history` | Date range · Member · WorkType · Repository |
| `/demo/projection` | — |

**Per-capita applies to additive money panels only.** On `/demo/spend` it divides Total spend and
the Team, Repository and WorkType breakdowns; it does not touch Cost per completed Task, which is
already normalised, nor the comparator, where a median divided by a headcount means nothing. The
denominator is the humans who contributed in that bucket and group, `service_account` Members
excluded (R-M14). Under a Member subject grouping the denominator is one and the figure is
unchanged — that is the control applying and returning identity, not a control the panel cannot use,
so R-C1's ban on inert controls is not engaged. See § 11 C14.

**R-C2 — `execution_mode` earns its place on `/demo/work` beyond the spans panel.** It is the one
control that separates unattended runs from supervised ones across duration and acceptance, and the
session model makes it deliberately independent of `Member.kind`. That independence is invisible
unless a viewer can filter on both.

**R-C3 — Every control serialises to the query string** via the History API. Period, grain,
filters, roll-up level, subject and sort all serialise. A roll-up level changes a chart more than
most filters do, so omitting it would break the share.

**R-C4 — Omitted parameters take the page default**, so a bare route is valid and shareable.

**R-C5 — Control state does not persist across pages.** Carrying it would make `/demo/work` show a
period the viewer set on `/demo/spend` and never sees again.

---

## 6. Chart and presentation rules

**R-V1 — Stacking asserts a partition, so stack only partitions.** Stacking is permitted where the
grouping genuinely partitions the measure, and forbidden where it does not. No caption can undo a
false claim made by the geometry — but the claim is only false where the grouping is non-additive.

| Grouping | Partition? | Stacking |
|---|---|---|
| WorkType, Model tier/family, execution mode, machine spec, duration spans | Yes | Permitted |
| **Team** | **No** — Members are many-to-many with Teams | **Forbidden** |
| **Repository** | **No** for Task-grain measures — a Task's sessions may span repositories | **Forbidden** |

Ticket 10 stated this as "no stacking, anywhere", reasoning that *"stacking encodes a partition;
Team is not one."* That reasoning is correct and does not reach WorkType or the duration spans,
both of which `CONTEXT.md` defines as disjoint and exhaustive. Stated as a blanket ban it would
have forced two part-to-whole panels into geometries that read worse and claim no more. See § 11 C8.

**R-V2 — No pie charts, anywhere.** Side-by-side charts and grouped bars are fine.

**R-V3 — Any Team grouping states the overlap in words**, e.g. *"3 Members belong to more than one
Team; totals overlap."* Teams and Members are many-to-many, so Team is a non-additive grouping and
Team figures do not sum to the Organization.

**R-V4 — Series cap: top 4 + "Other", engaging only above five series.** A dimension with five or
fewer distinct values in the selected range renders all of them; an "Other" bucket holding one
repository reads as a rendering fault. The cap therefore bites on Member (20) and exact Model (7),
and not on Repository (5) or WorkType (5). See § Conflicts resolved C1.

**R-V5 — The series set is ranked by the chart's own measure across the whole selected range**,
then bucketed. Ties break by name ascending. The set is **stable across every bucket** and is
recomputed only when the range, filters or roll-up level change.

Ranking per bucket is forbidden: it makes series identity change mid-chart, which is both
misleading and the exact input that triggers the legend reconciliation bug recorded in ticket 14.

**R-V6 — "Other" is inert.** It is not clickable and does not expand. Its tooltip lists what it
holds. **Filtering is how a viewer reaches beyond the top four; the cap itself never lifts.**

**R-V7 — The five-colour palette is never extended.** `--chart-1..5` is the ceiling; four series
plus "Other" fills it exactly. No `--chart-6..N` values are defined and no OKLCH generation is
written. Categorical palettes run out of distinguishable hues around 10–12, so a 20-series chart is
unreadable whether or not it is coloured.

**R-V8 — Attributed money figures carry no "estimated" label.** An attributed figure is the bill,
not an estimate of it. Two labels do two different jobs:

- **"Illustrative rates"** on the token rate card, because the rates are invented.
- **"Estimated"** on Projected cost only, because a forecast is the one money figure here that
  really is an estimate.

See § Conflicts resolved C3.

**R-V9 — Where a filter empties a panel, it renders plain "no data for this selection" text.** The
shell, navigation and controls stay present.

---

## 7. Accessibility

**R-X1 — Every chart carries a visually-hidden `<table>` mirror of its grouped data.** This is a
product requirement, not a test affordance — though it is also the assertion target that lets the
test suite assert chart *output* rather than chart *presence*.

**R-X2 — Every chart carries an `aria-label` naming the current roll-up level.** The chart
container is a plain `<div>`, and the roll-up level is the one piece of state a screen-reader user
cannot otherwise recover.

**R-X3 — Recharts' `accessibilityLayer` is enabled** on every chart, giving `role="application"`,
arrow-key navigation and a `role="status"` tooltip.

---

## 8. Data requirements

The fixture is authored, committed, and deterministic. Full schema in `technical-spec.md` § 6.
These are the requirements the *data* must satisfy for the product's claims to be true of it.

**R-D1 — The Organization.** Equilibrio, slug `demo`, timezone `Europe/Madrid`. Spanish Member
names, English Team names, GitHub logins that do not trivially match full names, so the identity
join is visibly doing work.

**R-D2 — Window: 12 Apr – 8 Sep 2026 inclusive, 150 days.** April and September are partial and
are **flagged as partial** — not withheld, not pro-rated. April matters: seat cost is a whole
month against 19 days of sessions, so its Cost per completed Task is inflated by construction, and
the flag is what stops that being read as a finding.

**R-D3 — Scale.** 4 Teams · 20 Members (18 `human`, 2 `service_account`) · 5 Repositories · 5
WorkTypes · 7 Models across 3 vendors · ~600 Tasks · ~750 AgentSessions.

**R-D4 — Volume is an adoption ramp**: median 0 sessions per Member per week in April rising to 2
in August; max 3 rising to 8. Low volume is deliberate — it is what makes seat cost (~$4,212
against ~$4,500 of session spend, ~48% of Total spend) the sharpest finding in the product. A
high-volume fixture would have buried it.

**R-D4 governs where it collides with a session-cost distribution.** Ticket 10 also specified a
median session cost of ~$3.20 with p95 ~$35. Both cannot hold: the ramp fixes the session count, and
those totals then fix the mean, leaving no distribution that reaches that median and that p95. The
ramp wins, because the seat-cost finding above rests on it and the percentiles support no claim the
product makes. Recorded 2026-09-09; the percentile figures are withdrawn, not deferred.

**R-D5 — Timezone edge cases are seeded on purpose.** Sessions fall in the first two hours after
local midnight — 00:00–02:00 Europe/Madrid — so they land on the *previous* UTC day. Without them
the declared-timezone decision is never exercised. No DST transition falls inside the window; that
case is not covered.

**Corrected 2026-09-09.** This rule previously named 22:00–24:00 Madrid as the discriminating band.
It is not: Madrid is UTC+2 over this window, so 23:30 local is 21:30 UTC on the *same* civil date
and buckets identically under either timezone. The rows that discriminate are just after local
midnight. Proved by mutation — switching `periods.ts` to UTC fails 14 tests and the test named for
A7 was **not** among them, so A7's worked example could not fail. The fixture seeds both
populations and T-U1 covers both; only the illustration was wrong. See § 11 C10.

**R-D6 — Acceptance rate by WorkType**: `review` 0.86 · `bugfix` 0.79 · `implementation` 0.71 ·
`refactor` 0.58 · `deploy` 0.34.

**R-D7 — Acceptance rate by Repository**: `web-console` 0.78 · `mobile-app` 0.70 · `api-gateway`
0.62 · `ml-scoring` 0.55 · `terraform-infra` 0.44. The Stanford complexity signal reaches the
reader through the repository names, with no domain column — ADR-0004 working.

**R-D6 and R-D7 are the two margins of one table.** They are the same sessions counted twice, so
they can hold together only if both marginals reconcile to one Organization-wide acceptance rate —
a constraint neither rule stated and the generator therefore had to satisfy implicitly. It is now
stated: the fixture must produce a single grand total consistent with both lists, and T-F4 asserts
it over raw JSON.

**R-D7 is a cross-WorkType acceptance figure by construction**, which is the one figure R-M6 and
A21 forbid the product to state. That is not a contradiction: it is a *fixture* property, verified
over raw JSON and never computed through a metric or rendered on a surface. If it ever reaches a
query it becomes an A21 failure.

**R-D8 — Rework 18% of Tasks; Decomposition 12%.**

**R-D9 — Incomplete Tasks present in all four age buckets.** 91+ days is reachable inside a
150-day window, so the oldest bucket is not empty by construction.

**R-D10 — One `human` Member holds a seat with fewer than 5 sessions** across the whole window.
The sharpest finding in the product needs a person to point at.

**R-D11 — ~20 CPU-heavy, token-light sessions** on `compute` in `terraform-infra` and
`api-gateway`: long, almost no tokens. Invisible to a token view, visible in Cost.

**R-D12 — ~2% hidden sessions are generated, then excluded in the data layer.** If they never
existed the exclusion rule would have nothing to act on and could not be tested. With them, the
same query returning different counts with and without the filter is a cheap, sharp test.

**R-D13 — One `service_account` runs `interactive` sessions** (the deploy account), and humans run
`headless` ones. That is the cell that would be lost if `execution_mode` and `Member.kind` were
conflated.

**R-D14 — At least one Repository is worked by Members of two or more Teams**, and **at least 3
Members belong to more than one Team**, so the non-additive case is real rather than hoped for.

**R-D15 — 40% of sessions span two or more Models**, so R-M7 has real cases behind it.

**R-D16 — Model token share: `balanced` 55%, `fast` 30%, `frontier` 15%.** The roster and token
rate card are fixed by ADR-0007; frontier input over fast input is **exactly 200×** (`gpt-6-astra`
10.00 against `gpt-5-nano` 0.05), with real verified input prices and no thumb on the scale.

The invariant the fixture must satisfy is **the `frontier` tier carries more token spend than any
other tier while holding the smallest token share**. The precise percentage is *derived by the
generator from the card* and asserted, never hardcoded — ticket 16's "~56%" was computed against a
card ADR-0007 replaced.

**R-D17 — Frontier token share falls from 25% in April to 10% in August.** Spend per session drops
while session count rises — a legible optimisation story, and the one thing on the dashboard a
reader can act on.

**R-D18 — The two accounts of R-A3 must differ visibly on `/demo/people` and `/demo/spend`**, or
the reinstated restricted preset is untestable.

**R-D19 — All 25 `(repository × work_type)` session files exist.** Empty pairs hold `[]`, so the
file set declares the full matrix and a missing file is unambiguously a fault rather than a valid
state.

**R-D20 — The GitHub → Member join is authored, not modelled.** The match rule is documented in
the fixture README so a reader can see the join, but **no GitHub user fails to match**. An
unmatched user is a real product problem that none of the six surfaces would show.

---

## 9. Empty and degenerate states

**R-E1 — There is no designed zero-data state.** The `demo` Organization always carries data.
Where a filter empties a panel, R-V9 applies. An Organization with no data would see a functioning
dashboard full of empty panels; acceptable because `demo` is the only surface a reviewer reaches.

**R-E2 — A partial period is flagged, never withheld or pro-rated.** One mechanism, used at both
ends of the window and for the current month on `/demo/projection`.

---

## 10. Acceptance criteria

Testable statements the build must satisfy. `testing-spec.md` assigns each to a layer.

| # | Criterion | Traces to |
|---|---|---|
| A1 | `/demo` renders exactly four tiles and no other panel; each tile is a link to its evidence page | R-N4, R-N5 |
| A2 | `/demo` offers month only; no quarter period is reachable | R-N6 |
| A3 | Requesting day grain over a range longer than two months is rejected or coerced, never rendered | R-M11 |
| A4 | No hidden session appears in any metric, any table, or any chart mirror | R-M2, R-D12 |
| A5 | Team-grouped totals exceed the Organization total, and the overlap statement is present | R-V3, R-D14 |
| A6 | Per-capita denominators exclude `service_account` Members | R-M14, R-D3 |
| A7 | A session at 00:30 Europe/Madrid buckets to that local day, not the previous UTC day it falls in | R-M10, R-D5 |
| A8 | A change figure is suppressed when and only when the prior period holds zero or is incomplete | R-M12, R-M13 |
| A9 | The restricted account receives strictly fewer rows on `/demo/people` and `/demo/spend`, with identical navigation | R-A3, R-A8, R-D18 |
| A10 | A restricted-account payload contains no figure outside its grants | R-A6 |
| A11 | A token whose Organization does not match the path segment yields 404 | R-A7 |
| A12 | A chart stacks only where its grouping partitions its measure; no pie chart exists | R-V1, R-V2 |
| A13 | A 20-series Member grouping renders 5 series (4 + "Other"); a 5-series Repository grouping renders 5 and no "Other" | R-V4 |
| A14 | Series identity is stable across every bucket of one chart, and across a roll-up switch | R-V5 |
| A15 | Every chart exposes a visually-hidden table mirror whose values equal the rendered series | R-X1 |
| A16 | Every chart's `aria-label` names the current roll-up level | R-X2 |
| A17 | No attributed money figure carries an "estimated" marker; Projected cost does; the token card carries "illustrative rates" | R-V8 |
| A18 | The compute rate card appears on no surface | R-N11 |
| A19 | Every control round-trips through the query string; a bare route renders page defaults | R-C3, R-C4 |
| A20 | Navigating between pages does not carry control state | R-C5 |
| A21 | Acceptance rate is never rendered as a single cross-WorkType figure | R-M6, R-N13 |
| A22 | No per-session metric can be grouped by or filtered on Model | R-M7 |
| A23 | Choosing a datapoint offers only WorkTypes sharing its artefact kind | R-M8 |
| A24 | No surface defaults to sort-by-cost; `/demo/people` defaults to Completed Tasks descending | R-M15, R-N15 |
| A25 | Total spend is unavailable below monthly grain on every surface | R-M1, R-M5 |
| A26 | April and September render the partial-period flag | R-D2, R-E2 |
| A27 | Human-presence spans render for `interactive` sessions only, and say so | R-N14 |
| A28 | No permission matrix renders on any surface; `/demo/people` states the acting account's visibility in words | R-A10 |

---

## 11. Conflicts resolved

Two settled sources disagreed. Each resolution takes the later decision, and each is recorded
because a future reader will otherwise think the spec drifted.

C1–C8 were settled at the handoff. **C9–C14 were settled on 2026-09-09**, after the unattended build
implemented the spec as written and reported where the spec contradicted itself or its own
reasoning. Those six take the *better decision* rather than the later one, because in each case both
sides were the same author.

**C1 — Series cap: "fixed everywhere" vs "only above five series".** Ticket 07 § Controls states
the top-4 + "Other" cap applies everywhere. Ticket 10 § Chart rules — resolved *after* 07 —
states it applies only above five series, because an "Other" bucket holding one repository reads
as a rendering fault. **Resolved in favour of ticket 10** (R-V4). The palette ceiling that motivated the cap is still
never reached.

**One thing is lost, and the earlier draft of this entry was too glib in saying otherwise.** Ticket
07 handed ticket 10 a fixture requirement — *"the WorkType distribution must make the fourth
headline tile non-degenerate at top 4 + 'Other'"*. WorkType has exactly five values, so under R-V4
the cap never engages there and no "Other" bucket can exist. The requirement is unsatisfiable and is
**voided, not inherited**; R-N8 states the tile renders all five WorkTypes instead.

**C2 — "Cost by Repository work domain" and the work-domain roll-up control.** Ticket 07 names a
`/demo/spend` panel "Cost by Repository work domain" and a Repository control "with work-domain
roll-up". ADR-0004 — decided by ticket 16, *after* 07 — removed the work-domain label entirely and
made Repository flat with no roll-up levels. **Resolved in favour of ADR-0004**: the panel is
"Cost by Repository" — item 5 of R-N9 — and the control carries no roll-up (R-C1).

**C3 — "Every money figure carries an 'Estimated' marker".** Ticket 07 § Auth requires this.
ADR-0005 and ticket 16, both later, removed "estimated" from attributed costs: an attributed
figure is the bill, and labelling it an estimate would understate the one solid number on the
page. **Resolved in favour of ADR-0005** (R-V8).

**C4 — The comparator's key.** Ticket 07 specifies a "cohort comparator" on `/demo/people`, keyed
on work domain and WorkType, labelled e.g. *"mobile · implementation, 6 members"*. ADR-0004 — later
— **cuts `Cohort` entirely**, on the grounds that with the filter set fixed at
`Repository × Team × WorkType`, `Cohort` named nothing the filters do not already name, and states
that *"Repository now carries the similarity relation."*

**Resolved by re-keying, not by cutting.** The comparator panel survives — it is ticket 05's
answer to *"am I heavy or light on work like mine"*, a question that only has meaning from a
personal vantage. Its key becomes `Repository × WorkType`, and its label reads
*"api-gateway · implementation, 6 members"*. The comparison group is the Members who worked that
pair in the selected period.

This is the one place where the spec makes a judgement rather than transcribing one, and it is
flagged as Q1 below.

**C5 — The restricted preset's grants.** Ticket 06's amendment and ticket 07 both describe the
contractor as "scoped to `self`". Ticket 10 § Accounts — later — specifies `self` over `cost`,
`team` over `jobs` and `tokens`, no `access`. **Resolved in favour of ticket 10** (R-A3). The
richer grant is also the better demonstration: a purely `self`-scoped account exercises one cell,
where this one exercises three at two different scopes.

---

**C6 — Who holds `access`.** An earlier draft granted the open default `access` and the restricted
preset none. That took ticket 06's *unanswered-and-defaulted* line (`org-member × access` survives)
for one cell while § 11 C5 declares ticket 10 authoritative for these same account rows —
inconsistent, and undocumented. But ticket 10's three-class list cannot be read literally either:
under it **neither** account holds `access`, the matrix renders for nobody, and both ADR-0003's
*"restricted presets ship so the mechanism is demonstrable"* and ticket 07's rationale for siting
the matrix on `/demo/people` collapse.

**Resolved by making `self` universal** (R-A3.1): every Role holds `self` over every class, so both
accounts reach the matrix and each sees its own grants. That the literal reading produces a matrix
nobody can see is itself the evidence that ticket 10's list was shorthand for the *data* classes,
not a decision about `access`.

**C7 — `quarter` as a period.** Ticket 07 gives `/demo` a month/quarter control. `CONTEXT.md`
§ Period semantics defines Period as **day, week or month**, and `quarter` appears in no ADR, no
other ticket, and nothing in the technical or testing specs implements or tests a quarter bucket.
**Resolved in favour of the glossary**: `/demo` is month-only (R-N6). Over the 150-day window
quarter yields two buckets, both partial, so the option was degenerate as well as undefined.

**C8 — Stacking.** Ticket 07 specifies the fourth tile as a *stacked area* and the human-presence
panel as a *stacked composition*. Ticket 10, later, says **"No stacking, anywhere."** An earlier
draft took ticket 10 silently, deleting the word from both panels and leaving neither with a named
geometry — one of them a part-to-whole composition with pies also forbidden.

**Resolved by narrowing the rule to its own reasoning** (R-V1). Ticket 10 forbids stacking because
*"stacking encodes a partition; Team is not one"* — an argument about false claims, not about
stacking. WorkType and the three duration spans are both defined in `CONTEXT.md` as disjoint and
exhaustive, so the geometry's claim is true of them. "Stack only partitions" is still a hard,
testable rule, and it keeps Team groupings unstacked for exactly the reason ticket 10 gave.

---

**C9 — The permission matrix does not ship.** Two settled sources disagreed about *who* sees the
read-only permissions grid at the foot of `/demo/people`: A28 said the open account and not the
restricted one, while R-A10 and C6 said both, each seeing its own grants. The build implemented
R-A10 and left A28 the only acceptance criterion in the spec with no test behind it.

**Resolved by removing the surface rather than choosing a side** (2026-09-09). A permissions grid
is not MVP: it is a second information architecture, rendered to end users, explaining a mechanism
the product already demonstrates by switching accounts. The disagreement was about the audience for
a table that should not exist.

What replaces it is smaller and does a job the matrix never did: one sentence on `/demo/people`
naming what the acting account can see. Under C10 the restricted account's page is a single row,
and a single row with no explanation reads as a fault. C6 is not reversed — `self` over `access`
stays universal, because R-A3.1's other justification carries it alone.

---

**C10 — The restricted account's `/demo/people` is one row.** `testing-spec.md` T-E2 described the
restricted account seeing its own named row *plus its Team's aggregate row* — 2 against 20 — the
claim being that the difference is one of kind, not of length. The build shipped the named row plus
an aggregate *sentence*.

**Resolved in favour of one row and no aggregate** (2026-09-09), which is neither of the two things
on the table. The aggregated grant is real and stays in the model — `team` over `jobs` and `tokens`
still folds unnamed teammates into totals on `/demo/work` and `/demo/spend`, which is where the
mechanism is legible. Restating it as a row on the people table put an aggregate beside a named row
in one column set, inviting exactly the subtraction R-M17 exists to prevent. T-E2 becomes a plain
count: 1 against 20, with C9's sentence carrying the explanation.

---

**C11 — The fourth `/demo` tile does not stack.** R-N8 stacked Completed Tasks by WorkType,
justified by "every AgentSession references exactly one WorkType". True of sessions; the tile counts
Tasks, and a Task's sessions may span several WorkTypes — 118 of the fixture's do. Measured through
the real query, open account, August 2026: `58+35+25+32+12 = 162` against the Completed Tasks tile's
**150**; restricted account, **55** against **49**. Two tiles on one screen disagreeing about the
same quantity.

**Resolved by unstacking, not by re-keying the measure** (2026-09-09). Keying each Task to its
completing session's WorkType would have restored the partition, at the price of a definition
nothing else in the product uses; switching the measure to sessions would have contradicted R-N4 and
ticket 05's rejection of session counts as velocity. Sorted horizontal bars over one month make no
part-to-whole claim, so the slices need not sum. C8 stands: the human-presence spans panel is still
a legitimate stack, and R-V1 still permits stacking where the grouping genuinely partitions the
measure. Only this ViewModel's claim to partition was false.

The tile also loses its headline figure and change figure, which were built from tile 2's reading
and printed the same number and delta twice.

---

**C12 — A change figure reads outside the selected window.** R-N7 gives every `/demo` tile a
period-over-period change; the page's only control is a month picker, which clipped the range so no
prior bucket existed and suppressed all four figures at once. The one control on the page made the
page worse every time it was used.

**Resolved by separating the comparison from the view** (2026-09-09). The prior month is the month
before the selection, in the data, whether or not the selection contains it. A filtered view answers
"what happened here"; a comparison answers "compared with what", and the second question does not
inherit the first's bounds.

---

**C13 — Incompleteness is withheld on the baseline and flagged on the current period.** R-M13 said
incompleteness is *flagged, never withheld*, which C12 turns into a defect: the fixture window opens
and closes on partial months, so comparing against the month before the selection can silently take
a part-month as its baseline and report a large fake rise.

**Resolved asymmetrically, on purpose** (2026-09-09). A partial *current* month is on screen, is
already flagged (R-E2, A26) and is what the viewer chose to look at, so it renders with its flag —
*"September so far"*. A partial *prior* month is none of those things: it is read outside the
window, invisible, and inflates the comparison without bound. It suppresses, with its reason given,
alongside the existing zero floor.

Rejected: comparing equal elapsed days of each month. It is honest and non-empty, but it invents a
second comparison mode and sits against R-E2's *never pro-rated*. `change.ts` already computed an
`incomplete` flag over either side and deliberately did not act on it; this is the rule that acts.

---

**C14 — Per-capita on `/demo/spend` is wired, not withdrawn.** R-C1 declared a per-capita control
for `/demo/spend`, but no panel on that page read it, so the control changed nothing — against
R-C1's own ban on controls a page's panels cannot use.

**Resolved by implementing it** (2026-09-09) rather than deleting the declaration. Spend per person
is the page's most defensible normalisation and the denominator already existed in the aggregation
layer. It applies to additive money panels only; ratios and the comparator are left alone. Under a
Member subject grouping the denominator is one, which is the control applying and returning
identity — not an inert control, so no exception to R-C1 is needed.

---

## 12. Open questions

None. Fourteen conflicts have been resolved, C9–C14 of them on 2026-09-09 after the unattended
build surfaced them; each is recorded above with the reasoning that decided it, and each is
reflected in `testing-spec.md`.

The two questions this spec opened at the handoff — the comparator's key and the restricted
account's sight of the permission matrix — were settled on 2026-09-07 as C4 and C6. C4 keeps the
comparator, re-keyed onto `Repository × WorkType`, on the grounds that a comparator is a **median
beside your own value** and no filter produces one; the term is now defined in `CONTEXT.md` as
**Comparison group**. C6 was overtaken by C9, which removes the surface the question was about
without reversing the grant it settled.

---

## 13. Recorded gaps

Carried forward from the map, not resolved here.

~~**The four disjoint token classes and per-session Model mix appear on no surface.**~~ **Closed
2026-09-07 by R-N20.1** — the expandable `/demo/history` row ticket 07 declined is reinstated. It is
the only surface either can legally occupy.

~~**Landing copy is unwritten, and stays human-owned** (ticket 37).~~ **Closed 2026-09-09.** The
hero read "Ship faster. Know why." — written before the product had a point of view, and
inconsistent with R-M1's refusal to make a productivity claim. Direction was settled 2026-09-07:
lead with the ratio, waste as the supporting mechanism, nothing about speed or productivity gain.

**The line, written by the human who owns it:**

> **Agent spend, measured per finished task. Not per token, not per seat.**

*"Measured"*, not *"priced"* — a vendor's verb on a hero reads as how this product charges you.
"Not per seat" is a claim about the **unit reported**, not about what the numerator holds: total
spend does include seat cost (R-M5), and a reader who takes it the other way will find the
contradiction one click in. Kept deliberately, the contrast being with per-seat and per-token
*pricing models* rather than with this product's cost base.

**Onboarding beyond the empty state, demo-mode role-switching UX beyond R-A5, responsive
breakpoints and dark mode** are unspecified and deliberately so.
