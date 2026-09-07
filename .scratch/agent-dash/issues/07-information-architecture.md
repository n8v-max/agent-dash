Type: grilling
Status: resolved
Blocked by: 03
Label: wayfinder:grilling

# Information architecture and route map

## Question

How is this dashboard structured — what are the surfaces, what does each answer, and how does
navigation express the access model?

## What has to come out of it

- The surfaces and their routes, derived from the jobs rather than from the entity model.
- Where scope selection lives: a control present on every surface, a surface of its own, or
  something else.
- Where dimension roll-up switching lives, and whether it is per-chart or per-page.
- What navigation does with a surface the viewer has no permission for — hidden, visible and
  disabled, or visible with an upgrade-path explanation. This is a product decision with a real
  trade-off, not a rendering detail.
- How `/demo` relates to the authenticated surfaces: the same shell, or its own.

## Constraints already settled

The archived v1 route map (`/dashboard`, `/usage`, `/cost`, `/members`) mixed axes — three
datapoint classes and one subject scope — and is explicitly reopened. Public surface is thinned
to `/demo` plus a minimal landing.

## Inputs handed over by resolved tickets

**From ticket 03 (2026-09-05)**:

- **Cadence is unmeasured, and the money jobs look event-driven rather than habitual.** An IA
  built around a daily ritual may be built for a behaviour nobody exhibits. What does the
  structure look like if every visit is triggered by a question rather than a routine?
- **Aggregate above the individual, disaggregate below the company.** Over-aggregation is a named
  failure mode. If a surface only ever shows org totals, it fails the same literature that warns
  against individual grain — the IA has to make disaggregation reachable, not just permitted.
- **Ten seconds is the real legibility filter, not thirty**, and visual-complexity judgement
  lands in ~17ms. That is the wall-of-tiles problem measured rather than asserted.
- **Titles and supporting text carry the message** (Borkin et al., 10-second exposure). Chart
  labelling is load-bearing IA, not decoration.
- **None of nine surveyed public demos has a persona switcher.** This product's role switching on
  `/demo` is therefore unprecedented — which is either its most legible idea or a burden on a
  first-time viewer with a ten-second budget. Decide which, deliberately.

## Blocked by

03 — **resolved 2026-09-05. This ticket is now on the frontier.**

**From ticket 05 (2026-09-07, HITL)** — the metric set is settled and hands this ticket three
things it now owns outright:

- **View grouping and page layout are yours.** 05 declined to place its metrics on surfaces.
- **The fourth headline tile is provisional.** The headline is four tiles — Total spend ·
  Completed Tasks · Cost per completed Task · Rework rate — but rework rate may flatline at 0%,
  which is dead space at a ten-second read. What occupies that slot is this ticket's call.
- **Whether human-presence spans and machine time share one view or two.** Both are secondary,
  both are time-shaped, and both would duplicate chrome if split.

Also settled and constraining: Total spend exists only at monthly grain and coarser, so any
surface offering a day or week view cannot show it. Projection is a separate FinOps-first view
and is MVP-optional, so nothing else may depend on it.

## Answer

Resolved 2026-09-07, HITL, over five grilling rounds. The route axis is **the question**; the
subject never appears in a path. The product is **multi-tenant**, and `demo` is one Organization
slug among many the code supports.

### Route map

| Route | Renders | Period control |
|---|---|---|
| `/` | Landing. Minimal, carries the positioning line and one link to sign-in | — |
| `/sign-in` | Two "continue as" buttons. Issues that account's JWT, redirects to `/demo` | — |
| `/demo` | **The org root is the summary.** Four tiles, each a deep link. Nothing below them | Month, quarter |
| `/demo/spend` | What we spend, and what we get for it | Day, week, month |
| `/demo/work` | Whether the agents are working | Day, week, month |
| `/demo/people` | Who, and how they compare | Period only |
| `/demo/history` | The raw rows under every aggregate | Date range |
| `/demo/projection` | Where the current month lands | Current month |

`/demo/history` and `/demo/projection` are **secondary**: they sit behind an ellipsis in the
header as a flat two-item menu, each item carrying a one-line description. Two items do not earn
a grouping; a third would.

### Panel inventory

**`/demo` — four tiles, nothing else.** Total spend · Completed Tasks · Cost per completed Task ·
**Completed Tasks by WorkType** (top 4 + "Other", stacked area). Each tile is itself the link to
the page carrying its evidence, so the tiles do both jobs — the ten-second read and the route
into detail — and no separate link row exists. Month-locked, because Total spend does not exist
at day grain and a tile that silently changes metric with the period is the failure the
metric-set ticket cut the unaccepted-spend tile to avoid.

**`/demo/spend`**, in order: Cost per completed Task over time · Total spend split into session
cost and seat cost · Cost per session, with the `accepted` filter · Cost per completed Task by
WorkType · Cost by Repository work domain. Then an **Adoption** section under its own heading and
a one-line statement that these measure use and not money: Tokens processed over time · Model mix
at exact / family / tier. The illustrative token rate card renders as a collapsed table at the
foot. The compute rate card is never shown.

The page opens with the ratio, not with Total spend. Total spend has already been read on the
summary, so repeating it in the first position spends the fold twice — and the ratio is the
differentiator, while the total is the number every competitor already ships.

**`/demo/work`**, in order: Completed Tasks per period, raw or per-capita · **Acceptance rate as
small multiples**, one chart per WorkType on a shared axis · Rework rate and Decomposition rate
as two lines on one chart, both being Task-grain rates · Incomplete Tasks as a horizontal bar by
age bucket · Session duration, median and p95 · Human-presence spans and machine time in one
stacked composition, restricted to `interactive` sessions and labelled so.

Small multiples are the answer to "comparable in shape, not in value": acceptance rate is defined
only within a WorkType, and the layout makes that visible with no caption. A single chart with a
WorkType selector would hide five of six values and make a viewer click to discover that the
comparison is not offered.

**Human-presence spans and machine time share one view** — the loose item handed over by the
metric set. Both are time-shaped, both are secondary, and splitting them duplicates chrome for
two thin panels.

**`/demo/people`** — table of Member · Team · kind · Completed Tasks · Sessions · Tokens · Cost,
every numeric column sortable, **default sort Completed Tasks descending** (see Amendment 2).
`?member=…` replaces the list with that member's profile: the four headline tiles at their scope,
their WorkType mix, and the **cohort comparator** — paired bars showing the member's value beside
the cohort median for Completed Tasks per period, Cost per completed Task and Tokens processed,
with the cohort key named in words ("mobile · implementation, 6 members").

Paired bars rather than a distribution strip: a strip shows a position within a spread, which is
a percentile drawn rather than written, and the metric set's prohibition is about the claim, not
the wording. Acceptance rate cannot join the comparator, because a member's cohort spans several
WorkTypes and one acceptance figure would average incommensurable criteria.

The **read-only permission matrix** sits collapsed at the foot of this page. Navigation does not
change between accounts, so a viewer who switches and sees the tables shrink needs somewhere to
learn why — and `/demo/people` is where they already are when they notice.

**`/demo/history`** — flat table, one row per AgentSession: started (Organization timezone) ·
Member · WorkType · Repository · Task key · execution mode · `accepted` · duration · tokens ·
cost. Selectors: date range, Member, WorkType, Repository. Default sort newest first, client
pagination at 50. The Task key renders as plain text; the external tracker is imaginary and a
dead link is worse than none. Hidden sessions appear here as nowhere else — that is, not at all.

**`/demo/projection`** — actual spend to date, projected month-end extrapolated in proportion to
the period elapsed, the method stated in one sentence, the elapsed fraction shown as a share, and
the incomplete-period flag. **No confidence band.** A band computed over authored fixture data
would be fabricated precision dressed as rigour; the method plus the elapsed fraction is the
honest uncertainty statement available here, since a projection at 10% elapsed and one at 90% are
different claims.

### Controls

**Declared per page, not per chart.** This reverses the grilling recommendation and supersedes
the metric set's "filters are per-metric": each page declares the dimensions its panels use, and
a control applies to every panel on that page that uses that dimension and to no others. Not
every dimension appears on every page, and no page shows a greyed control.

| Page | Declared controls |
|---|---|
| `/demo` | Period (month, quarter) |
| `/demo/spend` | Period and grain · subject (Team or Member) · Repository, with work-domain roll-up · WorkType · `accepted` · per-capita · Model roll-up (exact/family/tier), scoped to the Adoption section |
| `/demo/work` | Period and grain · subject · Repository · WorkType · `execution_mode` · per-capita |
| `/demo/people` | Period · Team · Member kind · sort |
| `/demo/history` | Date range · Member · WorkType · Repository |
| `/demo/projection` | — |

`execution_mode` earns its place on `/demo/work` beyond the spans panel: it is the one control
that separates unattended runs from supervised ones across duration and acceptance, and the
session model makes it deliberately independent of `Member.kind`. That independence is invisible
unless a viewer can filter on both.

**Every control serialises to the query string** via the History API. Omitted parameters take the
page default, so a bare route is valid and shareable. Period, grain, filters, roll-up level,
subject and sort all serialise — a roll-up level changes a chart more than most filters do, so
omitting it would break the share. **State does not persist across pages**: carrying it would
make `/demo/work` show a period the viewer set on `/demo/spend` and never sees again.

**Series cap: top 4 + "Other", fixed everywhere.** Four plus Other fills the five-colour shadcn
theme exactly, so the silent transparent-series failure is unreachable by construction. The set
is ranked by the chart's own measure **across the whole selected range**, then bucketed; ties
break by name ascending. The set is stable across every bucket and recomputed only when the
range, filters or roll-up level change. Ranking per bucket was rejected: it makes series identity
change mid-chart, which is both misleading and the exact input that triggers the `key={index}`
legend reconciliation bug the charting ticket flagged. **Filtering is how a viewer reaches beyond
the top four; the cap itself never lifts.** "Other" is inert, and its tooltip lists what it holds.

### Shell

Top header: product mark · nav (`/demo`, spend, work, people) · ellipsis (history, projection) ·
account switcher. Below it, a **sticky page toolbar** holding that page's declared controls,
period first; absent on pages that declare none.

Four nav items plus an overflow do not fill a sidebar, and a sidebar costs horizontal space that
the seven-column people table and the acceptance small multiples both want. Separating header
from toolbar also keeps the two kinds of state visibly distinct: the header holds who you are,
the toolbar holds what is in the URL.

### Auth, tenancy and the access model

**The product is multi-tenant.** `demo` is an Organization slug, not a demo-mode prefix — the
code supports as many organizations as needed, and only the demo org is seeded and mocked. The
org lives **in the path**, because tenancy that exists only in a token is invisible in exactly
the artefact a reviewer inspects, and breaks the moment one account belongs to two orgs.

**Two accounts, two JWTs.** The role-preset ticket was closed `wontfix` with one permissive
preset, recording that if one thing were reinstated it should be a single restricted preset. It
is reinstated here, as the cheapest possible proof that the two-dimensional access matrix does
work: an org-wide member holding `org-member` scope over `jobs`, `tokens` and `cost`, and a
contractor scoped to `self`. A grid where every cell is granted is indistinguishable from having
no grid.

They are **accounts, not client-side personas**. `/sign-in` offers two "continue as" buttons, each
issuing that account's JWT. The header switcher re-issues the token and reloads **in place**,
keeping the viewer on the current URL, so the difference is legible as the same page with fewer
rows.

**Enforcement is server-side.** The token's org must match the path segment. A mismatch or an
unknown slug returns **404, not 403** — a 403 confirms that an org exists, which is a tenancy
leak. Client-side filtering over the full fixture was rejected outright: it ships every member's
data to a contractor's browser and makes the access model theatre.

**Navigation is identical for both accounts.** No item is hidden and none is disabled; the
restricted account simply receives fewer rows. This gives the test suite a clean target — one
request per account per route, asserting rows rather than pixels.

**Every money figure carries an "Estimated" marker** with a shared tooltip, and the illustrative
token rate card is reachable at the foot of `/demo/spend`. The rate card is the evidence for every
money figure in the product and costs one collapsed table; asking a viewer to trust invented
prices whose basis is withheld is worse here than in a real product.

### The fourth headline tile

The metric set left the slot provisional, because Rework rate may flatline at 0%. It is filled by
**Completed Tasks by WorkType** — top 4 + "Other", stacked area, no axis labels at tile size, with
the full chart on `/demo/work`.

Rework rate leaves the headline. Completed Tasks by WorkType keeps the headline reading as one
argument — this is the total, this is what we got, this is the rate, this is what kind of work it
was — and it is never empty, which was the objection to the slot in the first place. Session
counts were rejected as the measure: the metric set is explicit that they are not velocity,
because they *rise* when work goes badly.

### Answers to the ticket's stated deliverables

- **Surfaces derived from the jobs, not the entity model.** Six, on one axis. The archived v1 map
  mixed three datapoint classes with one subject scope; here routes vary by question only, and
  both other axes — subject and datapoint class — vary inside the page.
- **Where scope selection lives.** In the query string, as a subject filter on `/demo/spend` and
  `/demo/work`, and as `?member=…` on `/demo/people`. It is never a route.
- **Where roll-up switching lives.** In the page toolbar, as a declared control. This is the
  reversal noted above: per-chart placement was recommended on the grounds that panels do not
  share a dimension, and the per-page policy answers that by having each page declare only the
  dimensions its panels actually use.
- **What navigation does with an unreachable surface.** Nothing — navigation is identical, and
  the data layer returns fewer rows. Chosen over hiding, which makes the mechanism disappear at
  the moment it acts, and over disabling, which advertises surfaces to no purpose once the
  permission matrix is published on `/demo/people` anyway.
- **How `/demo` relates to the authenticated surfaces.** It *is* an authenticated surface. The
  question dissolved once `demo` was recognised as an org slug rather than a demo mode.

### Amendments to earlier decisions

Recorded here rather than silently applied.

1. **Auth exists.** The grilling round had settled that no auth would exist and that `/demo` was
   the whole app. Corrected by the human: production code must support many organizations, so
   `demo` is one org slug, and the two presets are two accounts holding distinct JWTs. Everything
   downstream — server-side enforcement, the 404 on slug mismatch, `/sign-in` — follows from that
   correction. → also amends the role-preset ticket, which is `wontfix` with one preset.
2. **`/demo/people` defaults to an ordering by output.** The metric set states that no surface
   defaults to a ranking. Sorting by Completed Tasks descending is an ordering by output rather
   than by spend, and no percentile label is computed, but it is still an ordering the product
   chose. Recorded as a visible decision, not drift.
3. **`/demo/projection` ships.** The metric set left it MVP-optional and leaning out, on the
   grounds that a projected number is the least defensible thing on a page. It ships as a
   secondary surface behind the ellipsis, with the method and elapsed fraction stated and no
   fabricated band. Nothing else depends on it.

### Recorded gap

**The four disjoint token classes and the per-session model mix appear on no surface.** Every
panel in the product either sums them (Tokens processed) or distributes them (Model mix). The
expandable `/demo/history` row that would have exposed them was declined in favour of extra
selectors on a flat table. The cost: the most carefully modelled part of `CONTEXT.md` § Models &
Money is provable only in tests and in prose, never on screen.

### Handed downstream

- **Fixture (ticket 10)** — the demo org needs two Member accounts with distinct scopes; the
  Organization needs a slug; and the WorkType distribution must make the fourth headline tile
  non-degenerate at top 4 + "Other".
- **Spec** — `/sign-in` route naming, JWT issuance shape, and the middleware that matches token
  org against path segment are implementation detail settled by the decisions above, not by a
  further grilling round.
