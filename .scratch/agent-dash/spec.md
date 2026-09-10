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
- Role authoring UI. Permissions are data, and no matrix renders at all — § 11 C9 withdrew the
  read-only grid this line used to promise. `/demo/people` states the acting account's visibility
  in one sentence instead (R-A10, A28).
- `/features`, `/compare`, `/pricing`. The dashboard is the value demonstration.
- A designed zero-data state (ticket 11, `wontfix`). See R-E1.
- Quality signals — defect, revert, change-failure rates. They need Git and incident systems the
  platform does not own.
- Vendor-shaped token normalisation (ticket 13, `wontfix`). The boundary is documented in
  `CONTEXT.md` § Token class; no un-normalisable fixture rows exist.

---

## 2. Actors, tenancy and access

**R-A1 — The product is multi-tenant.** `demo` is an Organization slug, not a demo-mode prefix —
and the seeded Organization's *name* is "Equilibrio S.L.", so the two are visibly different
strings rather than a claim a reader has to take on trust.

Tenancy is a **Member↔Organization Membership** (`memberships.json`), many-to-many, carrying the
Role — because the Role is held per Organization and the same person may be an owner in one and a
contractor in another. `resolveViewer` resolves the acting Member *through* a Membership in the
Organization the path and the token agree on, so all three must agree and not merely two.

**Amended 2026-09-10 by ticket 58.** This requirement previously said "the code supports
arbitrarily many Organizations; only `demo` is seeded", and `src/data/accounts.ts` glossed that as
"a second Organization is a fixture change and no code change". That was **false** for the sign-in
path: the Member was looked up across the whole dataset with no Organization predicate, so a token
minted for one Organization naming a Member of another resolved signed-in. It was unreachable only
because one Organization was seeded and `Member` carried no Organization at all — which is why no
test caught it. The narrowed and true claim: the *code* path is indifferent to how many
Organizations exist; a second one costs **data** — pluralising `organization.json` and its load
check, plus a Repository set, a Task set and the full (repository × work_type) session matrix
R-D19 requires. Still one seeded, deliberately; the two-Organization case is covered by unit tests
against a hand-built `Dataset`, and has no e2e coverage for that reason.

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
redirecting to `/demo`. *Amended 2026-09-10, ticket 60: `/sign-in` offers one "sign in to the
demo account" action for the open default; the restricted account is reached from the header
switcher (R-A5).* **Amended again 2026-09-10, ticket 61: the product offers one account and
one action, and nothing else anywhere.** The restricted contractor is offered on no surface —
not on `/sign-in`, not in the header — and `POST /api/session` mints only for the offered list,
so its id returns 400. The preset, its grants and its seated Member are unchanged; it is
demonstrable only under test, from a token minted directly off the fixture.

**R-A5 — The header account switcher re-issues the token and reloads in place**, keeping the
viewer on the current URL. The difference must read as *the same page with fewer rows*.
*Amended 2026-09-10, ticket 61: the switcher no longer switches — it **identifies and links
out**.* It shows the acting Member's name and their Organization's name, and offers one action,
**Add another account**, which is a link to `/sign-in`. It carries no Role line, no Organization
group, no explanation of any mechanic, and no `<form>`: with one account offered, a control that
re-issued identity in place had nothing to switch between. The in-place return path stays in
`POST /api/session`, which still honours a validated `Referer` for a sign-in made from a page
under the Organization.

**R-A6 — Enforcement is server-side and lives in the data layer.** A figure the acting Member is
not granted must never reach the client payload. Client-side filtering over a full fixture is
explicitly rejected: it ships every Member's data to a contractor's browser and makes the access
model theatre.

**R-A7 — A token/path Organization mismatch, or an unknown slug, returns 404 — not 403.** A 403
confirms that an Organization exists, which is a tenancy leak.

**R-A8 — Navigation is identical for every account.** No item is hidden, none is disabled. A
restricted account simply receives fewer rows. *Restated 2026-09-10, ticket 61 — unchanged in
substance: navigation is identical for any account that can be signed in, and the header
switcher differs between accounts only in the name it prints, never in what it offers.* Since
only one account can be signed in, the claim's remaining bite is on the seated contractor, and
it is still asserted against it end to end from a directly minted token.

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
| `/sign-in` | Two "continue as" buttons, and a link back to `/` | — |
| `/demo` | Org root — the summary. Four tiles, nothing else | Month |
| `/demo/spend` | What we spend, and what we get for it | Day, week, month |
| `/demo/work` | Whether the agents are working | Day, week, month |
| `/demo/people` | Who, and how they compare | Period only |
| `/demo/history` | The raw rows under every aggregate | Date range |
| `/demo/projection` | Where the current month lands | Current month |

**R-N2 — `/demo/history` and `/demo/projection` are nav items at secondary weight** (amended
2026-09-09, ticket 43). All six surfaces are links in the header. The two secondary ones may read
smaller and sit apart from the four primary questions; **they may not be hidden**, and no overflow
control exists.

They were behind a flat two-item ellipsis, on the argument that *"two items do not earn a grouping;
a third would"*. That argument is still right and it argued for the wrong thing: a menu is not a
grouping either, and what the disclosure actually cost was two of the product's six surfaces
needing a click and a guess to find. The one-line descriptions each item carried go with it — a
description is what a menu row needs to justify opening the menu, and a nav item does not.

**R-N3 — Shell.** Top header: product mark · nav (`/demo`, spend, work, people, then history and
projection at secondary weight) · account switcher. Below it a **sticky page toolbar** holding that
page's **global** controls, period first; the panel-local controls render in panel headers instead
(R-C6).

**The toolbar stands on every `/[org]` surface** (amended 2026-09-09, ticket 45). It was absent on
a page holding no global control — `/demo/projection` — on the argument that an empty bar is a
promise of controls that never arrive. The argument holds and no longer applies: R-N3.1 puts the
as-of stamp in the bar, so the bar there is not empty, it carries a fact. A freshness claim
standing on five surfaces out of six would read as the sixth being stale. What survives of the old
rule is the part that mattered — `/demo/projection` renders the bar **holding no control at all**,
so R-C1's ban on offering a control a page's panels cannot use is unchanged.

Under the page heading, the **active-filter sentence** (R-C7).

**R-N3.1 — The toolbar carries an as-of stamp, right-aligned** (added 2026-09-09, ticket 45):
*"Data to 2026-09-08 23:28"*. Every page states a **period**; none of them stated how fresh the
rows behind it are, and a stalled ingest and a quiet week are the same picture — an empty bucket at
the right-hand end of a chart.

**The stamp is a domain and data fact, not a component's formatting of a date.** The session it is
read off is the one with the greatest **`ended_at`**: a session's measures are observable at session
end (`CONTEXT.md` § Session measures), so the last thing the platform knows is the last session
that *finished*, not the last one that began, and the two are different rows in general. That
instant is the watermark ticket 55's ingest sketch takes, and it travels on the value with the
session id beside it.

**What the stamp prints is that session's start**, in the Organization's declared timezone (R-M10)
and through the product's one instant formatter — so the string is, character for character, the
top row of `/demo/history` under its default newest-first sort (R-N19, R-N20), which is the page a
reader checks it against. Printing the end instant would name a moment **past `window_end`**
(R-D2), which every date control on the page is bounded by, and would match no row on any surface.
The two readings are one row apart and the choice is recorded rather than left implicit.

It is **not viewer-scoped**: it carries no cost, no name and no count, in the same way the
observation window does, and both accounts already meet that window in `/demo/history`'s date
bounds. R-A6 governs figures reaching a payload; this is the calendar the figures were taken over.

**It is read off the rows the page reads — the dataset as of `now`** (amended 2026-09-10, ticket
62). The stamp answers "how fresh are the rows behind this page", so it has to be read off those
rows and not off the file behind them: over the uncut fixture it named a session that, as of
`now`, had not finished — and, once the fixture runs past today, would name one that had not
begun. It is the one claim on the toolbar a reader is invited to check against `/demo/history`,
and the check means nothing unless both sides read the same slice.

The header holds *who you are*; the toolbar holds *what is in the URL*. Keeping them visibly
separate keeps the two kinds of state distinct. No sidebar: six nav items do not fill one, and the
seven-column people table and the acceptance small multiples both want the horizontal space.

### 3.1 `/demo` — the summary

**R-N4 — Four tiles, nothing below them.** Total spend · Completed Tasks · Completed Tasks by
WorkType · Cost per completed Task.

**The breakdown sits beside the count it breaks down** (amended 2026-09-09). It was fourth, two
cards away from the only tile it is a breakdown *of*, so reading it meant carrying a number across
the ratio. The order is now the argument in sequence — what the month cost, what it produced, what
kind of work that was, and the rate joining the first two — and the differentiator still ends the
sentence rather than opening it.

**R-N5 — Each tile is itself the link to the page carrying its evidence.** The tiles do both jobs
— the ten-second read and the route into detail — so no separate link row exists.

**R-N6 — `/demo` is month-locked. Month is the only period.** Total spend does not exist below
monthly grain, and a tile that silently changes metric with the period is the failure the
unaccepted-spend tile was cut to avoid.

`quarter` is dropped. It reached ticket 07 without ever entering the glossary — `CONTEXT.md`
§ Period semantics defines Period as day, week or month — and over the fixture window it yields
exactly two buckets, **both partial**, so every quarter figure on the surface that owns the
ten-second read would carry an incompleteness flag. See § 11 C7.

**The picker offers the Organization's months and nothing else, and opens on the current one**
(amended 2026-09-09). "All data" is dropped **on this page only**; every other page keeps it. A
whole-window option here was a period the page's own argument could not be read over — five months
of spend beside a change figure measured on the last of them — and it made the page's default a
figure no tile could compare. The months offered are the *fixture's* months, so a period holding
no data is not on the list. A token the page does not offer, `?period=window` among them, is
dropped and the default stands (R-C4).

**R-N7 — Each tile carries a period-over-period change figure**, subject to the change floor
(R-M12) and to R-M13's two unfinished periods. On a month still running there is no change figure
on any tile, and **every tile carries the partial flag in its place** (R-E2, § 11 C13) — the flag
stands where the figure would have been, so a tile with no delta on it explains itself.

**The comparison reads outside the selected window.** The prior month is the month before the
selection, whether or not the selection contains it — a comparison is not a filtered view. Without
this, choosing any single month clips the range so no prior bucket exists and all four change
figures suppress at once, which made the page's only control degrade the page. See § 11 C12.

**R-N8 — The breakdown tile is Completed Tasks by WorkType**, rendered **unstacked** as sorted
horizontal bars over the reported month, longest first, **with no axis and a value label on each
bar**. **All five WorkTypes render; no "Other" bucket appears**, because the cap engages only above
five series (R-V4). It is never empty, which Rework rate — the slot's original occupant — could not
guarantee. Session counts were rejected as the measure: they are not velocity, because they *rise*
when work goes badly.

The axis is **not drawn**, not drawn-and-hidden: an axis that renders nothing still reserves its
width, which was a third of the card at 1440px and half of it at 390px. With it gone the bars have
the card, and the figure a tick scale would have carried is on the bar instead. The tile must read
at 390px, which is the width the requirement is stated at.

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

**R-N9.1 — Cost by Repository reads months, whatever the page grain is** (added 2026-09-09,
ticket 44). Five repositories across the page's twenty-two weeks is a hundred and ten bars, which
is a texture rather than a comparison. The grain is fixed in the query, not in the panel, and the
panel carries **the same one-line note Total spend carries** — one sentence, on both, because it
is one claim about the same buckets. Each panel's own reason stays in its own copy: Total spend
cannot exist below a month at all (R-M5, A25), while this panel could and would be unreadable.

Per-capita still divides it (R-C1), and it is still flat — no work-domain roll-up (ADR-0004,
§ 11 C2).

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
5. Session duration — median and p95, as **two small multiples, one per statistic, each on its
   own axis** — carrying the **Agents per session** reading, median and p95, in the same figure
   strip (R-M19)
6. Human-presence spans and machine time as one **stacked** composition, **restricted to
   `interactive` sessions and labelled so**. The three spans are disjoint and sum exactly to
   `machine_allocation_duration_s`, so they are a true partition and stack legitimately (R-V1)

**Panel 5 is one panel holding two charts, not two panels.** R-N12's order is a requirement and
this is still its fifth item. The split is a *scale* decision, added 2026-09-09: the p95 is several
times the median — ~4.4× over the committed fixture — so on one shared linear axis the axis belongs
to the p95 and the median draws as a flat rule along the floor of the panel, which is the one thing
a trend line exists to show being unreadable. The two are compared by *magnitude* in the figure
strip above the charts, which is where a comparison of two unlike readings belongs; each chart is
read for its own shape. A log axis was the alternative and was rejected — see ticket 41.

**Agents per session joins that strip and adds no third chart** (added 2026-09-09, ticket 48). On a
multi-agent platform a session's machine time is its whole tree's, so how long an attempt ran and
how many agents ran it are one reading in two halves; a fan-out is what explains a duration that
holds more machine time than wall clock. It is a figure and not a chart because R-N12's fifth item
is two small multiples and stays two.

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

**A reviewer's accepted review is a completed Job on their row** (added 2026-09-10, ticket 67).
A Completed Task is a Task with an accepted root session (`CONTEXT.md` § Work) and a review is a
root session; since R-D22 every implementation, refactor and bug fix is reviewed by somebody
else, so a Member's Completed Tasks now include the Jobs they reviewed as well as the ones they
built. That is the present semantics of `completedTaskKeys` and it is left as it is: acceptance
is a property of a *session*, the review's criterion is *a submitted review with an outcome*, and
narrowing the column to Jobs a Member built would need a second, per-Member definition of
"completed" that nothing else in the model has. The lede's copy is unchanged — it names the
column, not what it counts.

**The Sort control *is* the table's headings** (added 2026-09-10, ticket 63). Each numeric heading
is a link that sets `?sort=`, and the sorted column carries `aria-sort`; there is no second sort
widget in the toolbar. A menu in the bar listed every column twice and stood away from the rows it
ordered, so a reader had two places to look and only one of them showed the current ordering.

That is an ordering by output rather than by spend, and no percentile label is computed — but it
is an ordering the product chose, and it is recorded as a decision rather than left as drift.

**Each column reads in its own unit, and the unit is the domain's.** The Cost column is currency —
symbol, grouped thousands, exactly two decimals — from the **same formatter the summary tiles use**;
there is one money formatter in the product and no surface spells its own. The `kind` column reads
"Human" and "Service account": `human` and `service_account` are a closed vocabulary and a URL
value, and **the raw enum never reaches a reader** on any surface. Added 2026-09-09 (ticket 41),
after `/demo/people` shipped a Cost column reading `310.5` one click from a tile reading `$310.50`.

**A token figure reads in K, M and B.** `75K`, `1.3M`, `2.1B` — one decimal while the mantissa is
below ten, none at or above it, no space before the unit, and the unit letter uppercase at the
`en-GB` pinning every figure in the product takes. Below a thousand a token count reads as itself.
An axis tick takes the same units and no decimal at all, because a tick is a position on a scale
and the tooltip and the R-X1 mirror carry the reading exactly. This governs **every** table column
and chart axis of unit `tokens` — `/demo/people`, `/demo/history`, the session table, the member
profile's tile and comparator bar, and both Adoption axes on `/demo/spend`.

**The one exemption is `/demo/history`'s expanded row** (R-N20.1), whose four token-class volumes
and their total stay full grouped integers: that table exists so a reader can check that four
disjoint classes add up, and four rounded figures need not. Added 2026-09-10 (ticket 69), because
an eight-digit integer is a length to count before it is a number to compare, and a Tokens column
of them compares nothing (R-N4). It is the only unit that takes compact notation, and it is
available because `e2e/support/costs.ts` excludes a decimal a `K`, `M` or `B` sits on from T-E4's
candidate cost literals — a bare decimal on screen would still be a collision, and still is one.

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

**The date range is a pair of native date inputs, in the browser's locale, and it applies on
change** (amended 2026-09-09, ticket 43). There is no Apply button. Every other control in the
product is a link and following it is the whole gesture; a range that also needed a button was the
one control asking for a second one. Native, because the calendar, the keyboard behaviour and the
field order are then the viewer's own platform's rather than this project's opinion of them — the
value crossing the wire stays ISO `YYYY-MM-DD` whatever the display order is.

An edit that is incomplete, or outside the observation window, **does not navigate**: the inputs
carry the window as `min`/`max` and are `required`, and the form submits only when it is valid.
That is R-T26's coercion arrived at before the navigation rather than after it.

**R-N20.1 — A row expands to show that session's four disjoint token class volumes and its Model
mix.** This is the only surface in the product carrying either. Per-session Model mix is meaningful
*only* here: R-M7 forbids Model as an axis on any aggregate, so no other panel can legally show it.
The four classes appear elsewhere only as rate-card *columns*, never as volumes.

Ticket 07 declined this row in favour of extra selectors on a flat table; the two are not
alternatives, and without it the most carefully modelled part of `CONTEXT.md` § Models & Money is
provable in tests and prose but never on screen.

**R-N20.2 — A root row expands to the child sessions under it**, indented, each carrying its own
tokens, cost and Model mix (added 2026-09-09, ticket 48). This is the **only** view of the session
tree in the product: every other surface reads a figure that already has the fan-out folded into it
(R-M19), which is exactly why the page showing raw rows has to show it. The root's own cells carry
the *tree's* cost, tokens and duration, so the children read as a breakdown of the row above them
and never as rows to add to it — and the expansion says so in words. The fan-out is named in the
expander's accessible label, so a reader who cannot see the indent learns of it without opening
the row. The Hidden rule reaches a child as it reaches a root (R-N22): a hidden root takes its
children with it.

**R-N21 — The Task key renders as plain text**, in `owner/repo#number` form. The external tracker
is imaginary; a dead link is worse than none.

**R-N22 — Hidden sessions appear here as nowhere else — that is, not at all.**

### 3.6 `/demo/projection`

**R-N23 — Actual spend to date, plus month-end spend extrapolated in proportion to the period
elapsed.** The method is stated in one sentence, the elapsed fraction is shown as a share, and the
incomplete-period flag is present.

**R-N23.1 — Both figures are broken into the two components they are the sum of**, and the
projection's arithmetic is printed with the month's real numbers: `session cost × (days in the
month ÷ days elapsed) + seat cost = projected total`. The two figures are not the same sum —
spend to date is session Cost plus a **whole** month's seat charge, and **only the session part is
extrapolated** (R-M5, R-D2) — so two totals alone are unverifiable from the page. The method text
is one sentence and the arithmetic stands in place of prose explaining it. The seat charge is
stated **beside** the daily chart as a flat monthly figure and is never a series in it:
apportioning a monthly fee across days is the invented precision R-M5 forbids.

**R-N23.2 — The daily chart stacks the month's projected remainder on the actual bars**, and the
two series sum, bar by bar, to the projected **session** cost the tile prints. It is the same
method the panel already states, applied per civil day: spend to date over the days elapsed is a
rate, a day already spent is owed nothing more, today carries the part of its own rate it has not
reached, and every day still to come carries one rate. Every civil day of the month is drawn,
today and the days ahead included — a day with no session is a zero bar, not a missing one, once
the whole month is being forecast. The projected series is drawn in a lighter fill of its own
palette colour and its legend entry carries R-V8's "estimated" marker, because the two halves of
a column are not the same kind of claim: the lower one is the bill and the upper one is a
forecast. The seat charge remains outside both (R-M5, R-D2).

**R-N24 — No confidence band.** A band computed over authored fixture data would be fabricated
precision dressed as rigour. The method plus the elapsed fraction is the honest uncertainty
statement available here — a projection at 10% elapsed and one at 90% are different claims.
**Unchanged by R-N23.2, and re-asserted over it**: a stacked forecast is a second figure drawn at
the same grain as the first, not a bound on either. No band, no interval and no low/high pair is
computed, carried on the ViewModel or drawn — and a shaded ribbon around the projected bars would
be exactly the rigour-shaped decoration this rule forbids.

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
| Agents per session | `jobs` | Median and p95, beside Session duration |
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

**The quantity the fee is charged per is the seat-month, and a seat-month is one month held by one
seat** — so the count over a population is `seats × months` and Seat cost is exactly
`seats × months × fee`. Over the committed fixture that is 18 human Members × 6 months = **108**
seat-months, not 6. Stated because a surface said otherwise: `/demo/spend`'s Total spend panel
printed a bare month count under a seat-month label, understating the quantity by the size of the
Organization. Added 2026-09-09 (ticket 41).

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
*nothing at all*, when **either period is *incomplete*** (R-M13), and when **either period has no
figure at all** (R-M18). Above zero, with both periods finished, it is shown: two to three sessions
week-over-week really is +50%, and on a narrow self-view that is the honest reading, not noise.
The floor is never a magnitude threshold.

The last condition is not a further kind of floor: it is R-M18 reaching the comparison. A ratio
over a zero denominator is `null`, and a `null` read as `0` reports a *fall to nothing* off a
period whose measure was never defined — under a headline figure already printing an em dash for
the same absence. The floor itself is still a count of one, and still never a magnitude.

**R-M13 — Comparison is unrestricted. An unfinished period on *either* side of it withholds the
change figure.** Any period may be compared with any other. A part-month used as a baseline inflates
the comparison without bound; a part-month on screen deflates it by exactly the days it has not
reached yet, and the second is the one the reader meets by default on `/demo`. Both are flagged
(R-E2) and neither is compared. Withholding is not pro-rating — R-E2 forbids inventing the missing
days, not declining to divide by them. See § 11 C13, which drew this asymmetrically at first and
says why the asymmetry fell.

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

**R-M18 — A ratio with a zero denominator is `null`, never `0`.** A bucket that finished nothing
has no Cost per completed Task; a week with no session has no Cost per session; a WorkType that ran
nothing has no Acceptance rate. Drawn at zero, each of them claims a measurement that was never
taken — that the work was free, or that every attempt failed — and the claim is louder than any
caption beside it.

It applies to **every** ratio the product computes: Cost per completed Task at every grouping,
Cost per session, Acceptance rate within each WorkType, Rework rate, Decomposition rate, the
per-capita variants (R-M14), Projected cost before any of the period has elapsed (R-N23), the seat
share of Total spend, the Model-mix shares (R-M7) and the human-presence span shares (R-N12
item 6).

**It is one expression in the domain layer**, not a guard repeated at each site: nine
`denominator === 0` checks are nine chances to write `0`, and a reader cannot tell from any one of
them what the product's rule is. Expressed once, the rule has a single test and a property a
future suite can bind to — *the reading is `null` if and only if the denominator is zero*.

**A measured zero is not an absence.** An acceptance rate of 0 over five sessions is a
measurement and renders as `0%`; over no sessions there is nothing to render. Nothing in this rule
rounds, clamps or hides a real zero.

**R-M19 — A session means a *root* session, and a child rolls up into it.** The platform is
multi-agent: an AgentSession fans out to sub-agents, each of which is a session of its own. A
child inherits its root's Task, Member, Repository, WorkType and `execution_mode`, never carries
`accepted`, and runs inside its root's window. Added 2026-09-09 (ticket 48, ADR-0008).

- **Every session-grain figure counts roots**: session counts, Acceptance rate, Cost per session,
  and the Task-grain labels Rework and Decomposition. A fan-out is one attempt worked by several
  agents, not several attempts, and counting it as several is what made Rework rise with how much
  a team parallelised — 18% of Tasks against 31% on the committed fixture.
- **Cost, TokenUsage and duration spans roll up into the root** for every aggregate, so no figure
  loses a child's spend and none counts it twice. The **wall clock does not**: the root's start and
  end already span the attempt, which is why a session's machine allocation may now exceed its
  duration.
- **The fold happens once, in the data layer, at parse** — beside R-M2's hidden-session strip and
  for the same reason. Nothing above it is offered a population that still holds children.
- **The tree is one level deep.** A child's parent is always a root; a grandchild is a fixture
  fault, not a shape to interpret.

**Agents per session** — how many agents worked one attempt — is reported as median and p95 beside
Session duration (R-N12 item 5). A root that spawned nothing is one agent, never none.

---

## 5. Controls and URL state

**R-C1 — Controls are declared per page, not per chart.** Each page declares the dimensions its
panels use; a control applies to every panel on that page that uses that dimension, and to no
others. **No page shows a control its panels cannot use, and no page shows a greyed control.**

| Page | Declared controls |
|---|---|
| `/demo` | Period (month) |
| `/demo/spend` | Period and grain, labelled **Aggregation** · subject, labelled **Per** (Organisation, Team or Member) · Repository · WorkType · `accepted` · per-capita · Model roll-up (exact/family/tier), **scoped to the Adoption section** |
| `/demo/work` | Period and grain (**Aggregation**) · subject (**Per**) · Repository · WorkType · `execution_mode` · per-capita |
| `/demo/people` | Period (calendar months only) · Team · Member kind |
| `/demo/history` | Date range · Member · WorkType · Repository |
| `/demo/projection` | — |

**`grain` and `subject` are labelled Aggregation and Per** (added 2026-09-10, ticket 63). "Grain"
and "Subject" are this program's words for them, and neither is a word an engineering manager
reading a spend chart reaches for; the Per control's options read Organisation, Team and Member.
The query string is unchanged — `?grain=` and `?subject=` are what they always were — so a link
shared before the relabelling opens the same page after it (R-C3).

**`/demo/people` offers calendar months and no "All data"** (added 2026-09-10, ticket 63), and
opens on the month `now` falls in, in the Organization's timezone. Every row on that page is a
Member's figures *over the period*: "All data" is a career total, it grows without bound as the
Organization keeps working, and it puts a Member who left in March beside one who arrived last
week. A month is the unit the Organization is billed in (R-M5) and the unit `/demo` already
reports, so the two month-locked surfaces agree on what a period is. Team and Member kind stay
filters over that month.

**`sort` is still a control of `/demo/people` and is no longer in its toolbar** — its control is
the table's own headings (R-N15, R-C6). It is declared, parsed and serialised exactly as before.

**Per-capita applies to additive money panels only.** On `/demo/spend` it divides **Total spend**
and **Cost by Repository**. It does not touch Cost per completed Task, Cost per session or the
by-template breakdown: all three are ratios, already normalised, and a rate divided by a headcount
states nothing. Neither of the two panels it does divide is under the subject control, so no
grouping puts one Member in a denominator.

**The denominator is R-M14's and no other**: the population's active human Members,
`service_account` excluded — not the authors of the rows in view. `aggregate.ts` gives the reason
and it is not a convenience: a denominator recomputed per bucket would vary with the measure, so
two metrics over one population would disagree about how many people it holds, and it would delete
exactly the Member R-D10 seeds — a seat held against near-zero usage, which is the sharpest finding
in the product. See § 11 C14.

**R-C2 — `execution_mode` earns its place on `/demo/work` beyond the spans panel.** It is the one
control that separates unattended runs from supervised ones across duration and acceptance, and the
session model makes it deliberately independent of `Member.kind`. That independence is invisible
unless a viewer can filter on both.

**R-C3 — Every control serialises to the query string** via the History API. Period, grain,
filters, roll-up level, subject and sort all serialise. A roll-up level changes a chart more than
most filters do, so omitting it would break the share.

**R-C4 — Omitted parameters take the page default**, so a bare route is valid and shareable. The
default period is the observation window **as R-D2 cuts it at `now`** — the whole cut window on a
page that offers it, and otherwise the newest month that window touches, which is the month `now`
falls in (amended 2026-09-10, ticket 62). A page never opens on, and its period control never
offers, a month the product has no data for yet.

**R-C5 — Control state does not persist across pages.** Carrying it would make `/demo/work` show a
period the viewer set on `/demo/spend` and never sees again.

**R-C6 — A control renders where its reach is** (added 2026-09-09, ticket 43). R-C1 says *which*
controls a page has; this says *where on the page* each one stands.

| Placement | Controls | Why |
|---|---|---|
| The global toolbar | period · grain (**Aggregation**) · subject (**Per**) · Repository · template · date range · Team · Member kind · Member | each narrows the **population every panel on the page is read off** |
| The header of each panel that reads it | `accepted` · per-capita · Model roll-up · `execution_mode` | each changes **some** of the page's panels and not the rest |
| The table's own headings | sort | the ordering is a property of the table, and the heading is both where a reader sees which column is ordering it and where they reach to change it |

**Sort left the toolbar on 2026-09-10 (ticket 63).** The bar carried a menu listing every sortable
column twice — "Cost high to low", "Cost low to high", and six more — beside a table whose
headings already set `?sort=` and already carry the `aria-sort` a reader reads the ordering off.
Two widgets for one parameter, and only one of them stood on the thing it ordered. The parameter
did not move: `?sort=` parses, serialises and round-trips exactly as before, and the heading links
are built by the same `controlHref` the menu used.

`/demo/spend` showed nine control groups and `/demo/work` ten, in two rows at 1440px, and half of
them changed one panel out of seven. A bar reads as a page-wide claim, and for those it was not
one: `accepted` narrows Cost per session alone, the Model roll-up redraws one chart inside the
Adoption section, and per-capita divides the two additive money panels and leaves the three ratios
beside them untouched. The bar now holds five groups and fits one row at 1440px.

**A control reaching two panels renders on both, bound to the one parameter.** Per-capita stands
on Total spend and on Cost by Repository; `execution_mode` stands on the acceptance multiples and
on the duration panel, which is R-C2's *"across duration and acceptance"* read literally. Two
nodes, one query parameter: they cannot disagree, and following either writes the same URL.

**No parameter and no URL changes** — this is the constraint the change was made under. A
panel-local control is the same key, spelled the same way in the query string, serialised by the
same rules (R-C3, R-C4). A link shared before this change and one shared after it are the same
link.

**R-C7 — Every controlled page states its active filters in one line under the heading** (added
2026-09-09, ticket 43), e.g. *"Week aggregation · per Team · mobile-app · all templates"*. The
phrases spell the controls' own labels, so the sentence and the bar above it read as one claim;
a chosen Team reads *"Platform team"*, because a bare name beside the other phrases does not say
which dimension narrowed the page (ticket 63).

**Every filter has a phrase, including the ones nobody set.** "all templates" appears when no
template is chosen, because the reading a viewer needs is *what population is this figure over* —
and an omitted phrase makes that answer depend on knowing what could have been there. It is the
same reason a nullable filter offers "All templates" as an option rather than as an absence
(R-C1's "no greyed control" has the same shape).

The period is not in the sentence — the period control prints its own current value in the bar
above it — and neither is sort, which changes which row is first rather than which rows there are.
The sentence is absent, not empty, on a page that filters nothing. Reset is unchanged and stays in
the toolbar.

---

## 6. Chart and presentation rules

**R-V1 — Stacking asserts a partition, so stack only partitions.** Stacking is permitted where the
grouping genuinely partitions the measure, and forbidden where it does not. No caption can undo a
false claim made by the geometry — but the claim is only false where the grouping is non-additive.

| Grouping | Partition? | Stacking | Form (R-V12) |
|---|---|---|---|
| WorkType, Model tier/family, execution mode, machine spec, duration spans | Yes | Permitted | series |
| **Team** | **No** — Members are many-to-many with Teams | **Forbidden** | series |
| **Repository** | **No** for Task-grain measures — a Task's sessions may span repositories | **Forbidden** | series |
| **Member** | Yes — a session has one Member | **Forbidden**: R-V1 permits, it does not require | **ranked** |

**The table gained a form column on 2026-09-09** (ticket 44). Stacking was never the only thing a
grouping decides about the geometry it may be drawn in: **Member decides the shape of the chart
itself**, because twenty of them capped to four plus "Other" (R-V4) is five lines crossing each
other and a reader takes nothing off any of the five. Both columns are domain facts on the
ViewModel, and neither is a panel's to choose. Member is a true partition and still never stacks,
which is what the "permits, does not require" reading of this table has always meant.

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
  really is an estimate. It reaches a chart **series** as well as a tile (R-N23.2): the projected
  bars are the same forecast said per day, and their legend entry reads `Projected (estimated)`.
  The rule is about which *kind* of figure may carry it, not about how many times it appears —
  and no attributed figure carries it in either place.

See § Conflicts resolved C3.

**R-V9 — Where a filter empties a panel, it renders plain "no data for this selection" text.** The
shell, navigation and controls stay present.

**R-V10 — R-M18's `null` renders as an absence, in three places and one way.**

- **Charts break at it.** A line or area mark is drawn with `connectNulls={false}`, so the series
  has a gap where there is no reading. Connecting it would invent the readings it spans, which is
  the zero-claim with interpolation on top.
- **Table mirrors (R-X1) hold an em dash**, so the accessible statement of the chart and the chart
  itself make one claim rather than two.
- **A headline figure shows "—" and the reason beside it**, in the words the metric computed —
  *"September holds $412.60 of spend and no Completed Job to divide it by"*. A bare dash reads as
  a rendering fault; the sentence is what makes it read as an absence.

**A missing bucket on an *additive* measure is still a zero.** A Repository that ran nothing in a
week cost nothing, and that line belongs on the floor. Which of the two a missing bucket is
follows from the measure, which the ViewModel already carries as a domain fact (R-V1).

**R-V11 — A chart rendered inside a tile carries no axes, no ticks, no grid and no legend.** At tile
size the furniture is larger than the mark and restates a figure the tile already prints beside it:
R-N13's acceptance multiples are 144px tall, and a tick strip, a dashed grid and a one-entry legend
took most of that to repeat the heading above them. What is left is a sparkline — a shape, read for
its direction, beside the number it is the shape of. The **tooltip, `accessibilityLayer` (R-X3) and
the R-X1 mirror are unaffected**: the chrome goes, the values do not. R-N8 already stated this for
the summary tile's bars ("no axis labels at tile size"); R-V10 is the same rule, named once, for
every tile in the product. Added 2026-09-09.

**R-V12 — A chart's *form* is a domain fact, and `subject=member` is `ranked`.** Every chart
carries one of two forms, decided by the query that built it and never by the panel that renders
it:

| Form | Bucket axis | Reads as |
|---|---|---|
| `series` | the page's periods | a trend, left to right |
| `ranked` | **none** — one bucket spanning the selected period | one bar per group, longest first |

**At `subject=member`, every panel the subject control reaches is `ranked`.** That is
`/demo/spend`'s Cost per completed Job and Cost per session, and `/demo/work`'s Completed Jobs per
period. There is no time axis: one horizontal bar per Member over the selected period, ordered by
R-V5's whole-range ranking of the panel's own measure, capped at top 4 + "Other" exactly as any
other grouping is (R-V4). **The R-X1 mirror is transposed with it** — one row per Member, headed
by the grouping — because a table of one row and twenty columns is the accessible statement of a
chart nobody can read either.

Team and Organization stay `series`: four Teams over twenty-two weeks is a trend, and twenty
Members over twenty-two weeks is not. The rule is keyed on the *grouping*, not on the series
count, so it cannot flip mid-range as a filter narrows the population.

**It is a fact on the ViewModel for the same reason `stackable` is** (R-V1): a panel that could
choose its own form could choose a different one from the panel beside it, and the two would then
be read as though they answered the same question in the same way. A panel still names the shape
its `series` form takes; it never names the ranked one.

Decided by the human, 2026-09-09, rounds 2 and 3. Added by ticket 44.

**R-V13 — One interpolation, `linear`, for every line and every area** (added 2026-09-09, ticket
45). It is declared once, in the shared chart config, and applied once, in the shape factory. No
panel names a curve: `ChartFrame` carries no curve prop, so overriding it is not expressible.

A spline draws a curve *through* the points it was given, and the curve leaves the range those
points span — above 100% and below 0% between two real acceptance readings, below $0 between two
real costs. Each of those is a value the domain layer never computed, which is the same fault
R-V10 forbids `connectNulls` from committing across a gap, with a smooth edge on it. `monotone`
overshoots less and still invents the shape between two measurements; `linear` invents the least a
mark joining two points can, and it is the reading a viewer already assumes a chart is making.

**R-V14 — A panel states one sentence, and folds the rest behind "Why this number"** (added
2026-09-09, ticket 45). Each panel's standing prose renders as **one visible paragraph** — its
first sentence — with everything after it inside a native `<details>` disclosure in the panel
header. `<details>` rather than a control, so the fold costs no client JavaScript, survives
scripting being off, and keeps the panel chromes Server Components.

**No argument is deleted; it is relocated.** Several of these paragraphs carry an ADR's reasoning —
ADR-0004's flat Repository on Cost by Repository, ADR-0005's attributed cost on Cost per session,
R-M5's whole-month seat charge on Total spend — and shortening one would lose a position the
project's own docs record. The fold is therefore **mechanical**: the cut is at the first sentence
terminator and the remainder is carried verbatim, so the copy a panel writes and the copy a reader
can reach are the same words. Seven panels on `/demo/spend` and six on `/demo/work` each carried a
three-sentence paragraph above their chart, and a wall of justification is prose a viewer skips —
taking the sentence that says *what the panel answers* with it.

**A qualification of the current selection is not standing prose and does not fold.** The
per-capita denominator, R-M5's monthly-grain note and the `accepted` filter's sentence stay visible
below the chart: each moves with a control, and a divisor a reader has to open a drawer to find is
the failure C14 was fixed to prevent.

**R-V15 — Every surface fits a 390px phone, and the page never scrolls sideways** (added
2026-09-09, ticket 46). Full phone support, not tablet-and-up: at a 390×844 viewport
`document.documentElement.scrollWidth` is **at most 390** on every one of R-N1's six authenticated
routes. It is stated as a measurement rather than as a look, because a horizontal scrollbar on the
document is the one layout fault a reader meets before they have read anything, and it is
invisible at the width the rest of this spec is written at. The six routes measured 572–784px
before this rule existed.

**Nothing is hidden to make it fit.** The five mechanisms, each stated because each is the
alternative to dropping something:

| Surface | At 390px | Instead of |
|---|---|---|
| The header | wraps to two lines — mark and switcher, then the whole nav one step tighter | an overflow menu, which R-N2 removed and A33 forbids |
| The account switcher | the avatar alone; the name and Role line drop | a second bar |
| A wide table | scrolls **inside its own card** | dropping columns a viewer came for |
| A chart | caps at its container; its legend **wraps** | a legend clipped at both edges, which silently deletes two of five series names |
| A period axis | thins its tick labels to an evenly-spaced subset — every other bucket, or every third, as the width allows | twenty-two labels drawn over each other |

**The last two are chart-layer decisions and are declared where R-V13's interpolation is** — once,
in the shared chart config, applied once in the shape factory. The thinning is on the **period**
axis only: a `horizontal-bar`'s category axis holds one tick per bar, and thinning it would delete
a bar's name while leaving the bar, which is a chart that lies rather than one that is crowded.

**Panel-local controls (R-C6) wrap inside their panel header and the global toolbar wraps in
place**, so R-C6's placement rule holds at both widths and no control moves to a different owner
on a phone. The summary tiles stack one per row, and R-N8's breakdown bars stay labelled — which
is the width R-N8 was already stated at.

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

**R-D2 — Window: 12 Apr – 25 Sep 2026 inclusive, 167 days** (amended 2026-09-10, ticket 66; it
was 12 Apr – 8 Sep, 150 days). April and September are partial and are **flagged as partial** —
not withheld, not pro-rated. April matters: seat cost is a whole month against 19 days of
sessions, so its Cost per completed Task is inflated by construction, and the flag is what stops
that being read as a finding.

**The declared window now runs past today, which is the point of it.** Ticket 62 landed the cut
described below before the data needed it; ticket 66 extended the data past it, so the cut is now
load-bearing on every read rather than a no-op waiting for one.

**The window the product reads is the declared window cut at `now`** (amended 2026-09-10, ticket
62). The declared window is a property of the fixture and may run past today; what any surface
may show is the part of it that has happened. So the end of the window every page reads is the
**earlier** of `window_end` and the civil day `now` falls on in the Organization's timezone
(R-M10), and it is that cut window which is the default period (R-C4), the list `periodOptions`
builds its months from, the bound a free `?from=`/`?to=` range is clipped into, and the `max` on
`/demo/history`'s date inputs. The current month is therefore partial *because it is in
progress*, which is R-E2's third cause and the same flag April carries for its first.

**And the rows are cut with it.** A session is observable at its **end** (`CONTEXT.md` § Session
measures), so a session still running at `now` has no cost, no tokens and no outcome the platform
could have read: it is not yet a row. The product reads the dataset **as of `now`** — every root
whose `ended_at` is after `now` removed, and its children with it — sliced **once**, at the data
boundary, and never by a per-query filter. A root ending exactly at `now` has just been observed
and stays. Until the fixture is extended past today the cut removes nothing on most reads, which
is what makes it safe to have landed before the data needed it.

**R-D3 — Scale.** 4 Teams · 20 Members (18 `human`, 2 `service_account`) · 5 Repositories · 5
WorkTypes · 7 Models across 3 vendors · ~3,600 Tasks · ~7,800 **root** AgentSessions, plus the
child sessions R-D21 fans out from them (~10,900 rows on disk in all). The session count the
product reports is the root count (R-M19). Amended 2026-09-10 by ticket 66, which raised the
volume by an order of magnitude, and again the same day by ticket 67, which put the reviews on
the Tasks they review instead of on Tasks of their own — the session count did not move, and the
Task count fell with it. The committed figures are **3,626 Tasks, 7,761 visible roots, 2,935
visible children and 158 hidden roots — 10,854 rows across the 25 session files**.

**R-D4 — Volume is one to nine root sessions per `human` Member per workday, ramping from
April** (rewritten 2026-09-10, ticket 66). On a workday a Member runs at least one and at most
nine; a weekend day runs about 15% of a workday's rate and is usually empty. The rate rises along
a logistic from ~2.5 sessions per Member-workday in April to ~5 in September, flattening across
August — 2,043 (Member × workday) pairs on the committed data, every one of them inside the
range. R-D10's seat holder is carved out of the result afterwards and is the one exception.

**Weekly session spend is a smooth function of time.** A logistic in dollars sharing the volume
curve's midpoint and steepness, from ~$1,900 per full week in April to a ~$2,650 plateau in
August–September; a week whose first day falls before 1 July sits within ±40% of that curve, and
a week from 1 July within ±20%. The curve is *shallower* than the volume curve — 1.39 against
2.03 — because R-D17's falling frontier share makes the average priced token cheaper as the
sessions get more numerous. There is no separate price ramp: costs are more modest initially by
construction of the volume ramp and of R-D17, and by nothing else.

**The seat fee is a minor share of Total spend**, and it is now stated as a ceiling: seats are
**at most 25%** of Total spend, and on the committed data **7.1%** — $4,212 of seats against
$55,293.74 of session cost. It was ~46% until this ticket, against a fixture deliberately held at
~750 attempts so that it would be, and the volume the product's own claims need is worth more
than the size of that number. What survives is the part that never depended on the magnitude: a
consumption-only model cannot see the seat line at all, because a seat is not a session and
nothing in the session stream implies one.

*(The paragraph that governed a collision with ticket 10's session-cost distribution — median
~$3.20, p95 ~$35 — is **struck**, 2026-09-10. It resolved a contradiction between the old
low-volume ramp and those percentiles; the ramp it defended no longer exists, and ticket 68 sets
the token and cost distribution from here.)*

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

**And that constraint is what fixes the size of the `deploy` population** (added 2026-09-10,
ticket 67). The Repository marginal is 0.6633 and cannot be moved far — 0.78 is the highest rate
on R-D7's list, so even a fixture that ran nothing but `web-console` could not reach 0.75. R-D22
makes `review`, at 0.86, two fifths of every session; something at the bottom of R-D6 has to grow
with it or the WorkType marginal lands at 0.75 and no table exists. `deploy`, at 0.34, is that
something, and the level at which the two marginals meet is 1.96 deploys per implementation —
which is why `deploy` is 29% of the committed sessions and `implementation` 22%. Nothing else in
either list moved. See the ticket 67 comments for the two rejected alternatives.

**R-D7 is a cross-WorkType acceptance figure by construction**, which is the one figure R-M6 and
A21 forbid the product to state. That is not a contradiction: it is a *fixture* property, verified
over raw JSON and never computed through a metric or rendered on a surface. If it ever reaches a
query it becomes an A21 failure.

**R-D8 — Rework 18% of Tasks; Decomposition 12%**, both measured over a Task's **non-review**
sessions (amended 2026-09-10, ticket 67). The rates are unchanged; the population they are read
over is narrowed, because R-D22 puts a review on every Task that had work built on it and an
accepted Job with its accepted review is two accepted root sessions. Without the narrowing every
reviewed Task would be a Decomposition — over half the fixture — and the label would have stopped
meaning "work deliberately split". The same exclusion applies to Rework, so the second attempt at
a Task is still the session that follows the failed one and not the review that found the
problem. `CONTEXT.md` § Work carries the definitions; `src/domain/metrics/efficacy.ts` is where
they are computed, and `TaskSession` carries `work_type` for this and for nothing else. Completed
and Incomplete are **not** narrowed: an accepted review is an accepted root session.

**R-D9 — Incomplete Tasks present in all four age buckets.** 91+ days is reachable inside a
167-day window, so the oldest bucket is not empty by construction.

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

**R-D21 — ~20% of visible roots fan out to one to four child sessions**, weighted toward
`implementation` and `headless` work (added 2026-09-09, ticket 48). Without them R-M19's roll-up
has nothing to act on and ADR-0008's whole argument is untestable.

A child is **small in both dimensions at once**: it holds a fraction of its root's machine
allocation and draws the same fraction of its root's tokens, per Model. Two constraints fix that
sizing and both are asserted by the generator. R-D6's and R-D8's rates are unchanged and must
still hit — they do, exactly, because the fan-out is drawn from finished rows and moves no root.
A child is sized for realism: a sub-agent is handed one slice of its root's work. *(Until ticket
66 the sizing was argued from R-D4's seat share, which a fan-out costing what a root costs would
have diluted out of an authored band. R-D4 no longer has that band, and the argument is
withdrawn with it; the numbers are unchanged.)*

**R-D22 — Every Job that was built is reviewed, on its own Task, by somebody else** (added
2026-09-10, ticket 67).

The session mix follows three ratios stated against `implementation`: **refactors at 17% of
implementations, bug fixes at 29%, and reviews at 122% of the three of them together** — every
`implementation`, `refactor` and `bugfix` session reviewed at least once, and 22% of them twice.
`deploy` is the fourth and is not authored as a ratio: it is the term that reconciles R-D6 against
R-D7 (see the note under R-D7 above). On the committed data that is **1,710 implementations · 495
bug fixes · 291 refactors · 3,047 reviews · 2,218 deploys** across 7,761 visible roots.

A review is **generated from the session it reviews**, and four properties make the linkage real
rather than statistical:

- it carries the **same `task_key`** and the same Repository, so it appears on `/demo/history`
  under the Job it reviewed rather than under a Job of its own;
- it starts **between ten minutes and four days after the reviewed session ends**. Three days was
  asked for and does not fit a five-day working week: a Job finished on a Friday morning has,
  inside three days, only Friday's remaining slots and a weekend running at 15% of a workday's
  rate. Most reviews land inside a day; the generator reports the distribution;
- it is run by a **different `human` Member**, on the author's own Team where one is free — over
  90% of them on the committed data, and never the author;
- it **takes a slot off R-D4's schedule** rather than being appended to it. A review is a session
  somebody ran, so the one-to-nine per human Member per workday is what it was; what changed is
  what those sessions are.

Two consequences are recorded rather than corrected. A Task whose implementation failed and whose
review was submitted is a **Completed Task** — acceptance is per session and the review's
criterion was met (see R-N15) — so the Incomplete population is now carried by the Tasks that
never left `deploy`. And R-D8's two labels are read over non-review sessions, or every reviewed
Task would be a Decomposition.

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
| A8 | A change figure is suppressed when and only when the prior period holds zero, either period is incomplete, or either period has no figure | R-M12, R-M13, R-M18 |
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
| A29 | A ratio over a zero denominator is absent everywhere it appears — a gap in the chart, an em dash in the mirror, "—" and a reason on a headline figure — and never a zero | R-M18, R-V10 |
| A30 | A chart inside a tile renders no axis, no tick, no grid and no legend, and keeps its mirror | R-V11, R-N13 |
| A31 | Every money figure renders with a currency symbol and two decimals, from one formatter; no raw `Member.kind` enum reaches a reader | R-N15, R-T9 |
| A32 | Every control the toolbar does not hold renders in the header of each panel that reads it, bound to the same parameter, producing the same URL a share link carried before the move | R-C6 |
| A33 | All six routes are links in the header nav; no overflow control exists on any surface | R-N2 |
| A34 | `/demo/history` applies its date range on change, with no Apply control, and an out-of-window or incomplete edit does not navigate | R-N20 |
| A35 | Every controlled page states its active filters in one line under the heading, naming the off state of each filter it does not narrow | R-C7 |
| A36 | At `subject=member` every subject-grouped panel renders ranked bars and no line series, with one mirror row per Member; Cost by Repository renders months at every page grain, under the same note Total spend carries | R-V12, R-N9.1 |
| A37 | Every line and area is drawn with the one interpolation constant; no module outside the shared chart config names a curve | R-V13 |
| A38 | Each panel shows one visible paragraph of prose, and the rest of it is reachable, verbatim, behind that panel's "Why this number" disclosure | R-V14 |
| A39 | Every `/[org]` surface carries the as-of stamp in its toolbar, naming the same instant, and that instant is the top row of `/demo/history` | R-N3, R-N3.1 |
| A40 | At 390×844, `document.documentElement.scrollWidth <= 390` on all six authenticated routes, with six nav links still visible, the account switcher reduced to its avatar, and every wide table scrolling inside its own card | R-V15 |
| A41 | A Task worked by one root and its children is neither Rework nor Decomposition, the root's cost is its own plus its children's, and a child session is a row on `/demo/history` and on no other surface | R-M19, R-N20.2, R-D21 |
| A42 | No surface renders a session that has not finished as of `now`: the slice is taken once at the data boundary, no module under `src/data/queries/` and no page reads the uncut dataset, the period menu offers no month past `now` and the History date bounds end on its civil day | R-D2, R-C4, R-N3.1 |

---

## 11. Conflicts resolved

Two settled sources disagreed. Each resolution takes the later decision, and each is recorded
because a future reader will otherwise think the spec drifted.

C1–C8 were settled at the handoff. **C9–C15 were settled on 2026-09-09**, after the unattended build
implemented the spec as written and reported where the spec contradicted itself or its own
reasoning. Those seven take the *better decision* rather than the later one, because in each case
both sides were the same author.

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
**Resolved in favour of the glossary**: `/demo` is month-only (R-N6). Over the fixture window
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

**C11 — The `/demo` breakdown tile does not stack.** R-N8 stacked Completed Tasks by WorkType,
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

The tile also loses its headline figure and change figure, which were built from the Completed
Tasks tile's reading and printed the same number and delta twice. It **moves next to that tile**
under R-N4's amended order, which is where a breakdown belongs: the tile it is a breakdown of is
now the one beside it rather than two cards away.

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

**C13 — Incompleteness withholds the change figure, on either side of the comparison.** R-M13 said
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

**Amended, and the asymmetry withdrawn** (2026-09-09, second round). The half that survived is the
baseline rule above, unchanged. The half that fell is *"a partial current month renders with its
flag"*, and R-N6's month picker is what fell it: **the current month is now the page default**, so
the flagged part-month is not a period the viewer chose to look at but the first thing they see.
Measured on the committed fixture, eight days of September against the whole of August: Total spend
**−46%**, Completed Tasks **−73%**, and Cost per completed Task **+96%**. Every one of those is the
calendar rather than the work, and the last is the worst of them — a whole month of seat cost
(R-M5) over eight days of Tasks reads as the product's central metric nearly doubling, on the
opening claim of the page graded for the ten-second read.

The argument that carried the asymmetry — *the viewer chose this, and it is flagged* — was about
what qualifies a figure. A flag qualifies a figure that is provisional. This one is not
provisional, it is wrong: a whole month's worth of days is missing from one side of a ratio. So a
fourth suppression reason, **`current-period-incomplete`**, joins the closed vocabulary in
`change.ts`, and **every tile shows the "Partial month" flag where its change figure would have
been** (R-N7). Four flags, no percentages — the flag is now the copy for the suppression rather
than a qualifier beside a figure, and the reason is stated once above the row.

The order of the checks is a decision in itself: the prior-period rules are tested first, so a
comparison failing on both sides reports the *baseline*. A period with nothing to compare against
is the more fundamental fact of the two.

Not withdrawn: R-E2. The month is still flagged rather than withheld or pro-rated, and the figures
themselves — the spend, the count, the ratio — are the month so far and are shown as such. What is
withheld is only the comparison, which is what C13 was always about.

---

**C14 — Per-capita on `/demo/spend` is wired, not withdrawn.** R-C1 declared a per-capita control
for `/demo/spend`, but no panel on that page read it, so the control changed nothing — against
R-C1's own ban on controls a page's panels cannot use.

**Resolved by implementing it** (2026-09-09) rather than deleting the declaration. Spend per person
is the page's most defensible normalisation and the denominator already existed in the aggregation
layer. It applies to Total spend and Cost by Repository — the page's two additive money panels —
and to nothing else.

**Total spend stays stackable under the toggle**, which is where this differs from `/demo/work`'s
velocity panel: that one becomes a ratio when divided, and stops stacking. Session cost per Member
and seat cost per Member still sum exactly to total spend per Member, so the part-to-whole claim
survives the division and R-V1 has no reason to veto it. `stackable` is a domain fact either way,
not a preference.

**Corrected while implementing.** An earlier draft of this entry put the denominator at "the humans
who contributed in that bucket and group", and worried about a Member subject grouping dividing by
one. Both were wrong: R-M14 fixes the denominator to the population, for reasons `aggregate.ts`
argues at length, and the subject control does not reach either of the two panels this touches.

---

**C15 — A period with no figure suppresses its change, alongside the zero floor.** R-M12 and A8
both said a change figure is suppressed *when and only when* the prior period holds zero or is
incomplete. R-M18 makes a ratio over a zero denominator `null`, and the query layer coerced that
`null` to `0` on its way to the floor — so a tile printing "—" printed "−100% on the prior period"
beside it, reporting a fall to nothing off a month whose measure was never defined.

**Resolved by widening the vocabulary rather than by coercing the reading** (2026-09-09, ticket 40).
`changeBetween` now takes a *reading* on either side and suppresses with its own reason where one is
absent, so the suppression carries a fact rather than an arithmetic accident. This is not a
magnitude threshold and does not become one: R-M12's floor is still a count of one on the base, and
a *measured* fall to zero is still shown, which is the case a reader most needs.

---

## 12. Open questions

None. Fifteen conflicts have been resolved, C9–C15 of them on 2026-09-09 after the unattended
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

**Onboarding beyond the empty state, demo-mode role-switching UX beyond R-A5, and dark mode**
are unspecified and deliberately so.

**Responsive breakpoints were on that list until 2026-09-09** (ticket 46). What replaced them is
not a breakpoint system: R-V15 states **one** width and **one** measurement at it, and every rule
under it is a mechanism for keeping something rather than a size at which something changes. The
tablet range between 390 and 1440 is still unspecified, and still deliberately so — the two widths
the product is stated at are the phone and the desk.
