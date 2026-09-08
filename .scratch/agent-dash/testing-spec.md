# Testing spec — agent-dash

Status: draft for review
Written: 2026-09-07
Reads with: `spec.md` (requirement + acceptance IDs), `technical-spec.md` (the seam)

**What this document is.** Ticket 09's output, written as requirements rather than as a decision.
Ticket 09 was closed `wontfix` and the map recorded it as *"the discard with the most exposure"* —
test coverage is one of three stated grading criteria, and the ticket that would have drawn the
seam was cut. `technical-spec.md` § 3 drew the seam; this document says what is proved at each
layer, what is deliberately not proved, and why.

**Two things this spec settles that no prior ticket owned:**

1. **The four ADR-0005 replacement targets have no owning ticket.** Ticket 10 named them —
   non-additive Team roll-ups, the comparability intersection, timezone-bounded period edges,
   per-capita denominators excluding service accounts — when it moved cost attribution upstream and
   the project lost its named cleanest unit-test target. They become first-class here (§ 3.2).
2. **What each layer is responsible for proving.** § 2.

Test IDs (`T-U*`, `T-C*`, `T-E*`, `T-F*`) are stable and referenced by the implementation tickets.

---

## 1. Principles

**P1 — Coverage is a property of the architecture, not a number chased afterwards.** The seam in
`technical-spec.md` § 3 exists so that everything worth asserting is reachable without React. If a
metric can only be tested by rendering, that is a seam defect, not a testing problem.

**P2 — Assert output, not presence.** Every chart carries a visually-hidden `<table>` mirror
(R-X1), built in the domain layer and independent of the rendered series (R-T7). It is queryable
DOM, so chart *output* is assertable with no SVG parsing and no fallback to Playwright.

**P3 — Determinism comes from authored, committed fixtures.** Tests read committed JSON and never
run the generator. A test that regenerates its own input tests the generator, not the app (R-T20).

**P4 — Combinatorial surfaces are tested where they are combinatorial.** The permission matrix is
(subject scope × datapoint class). Asserting it by clicking through the UI does not scale; asserting
it as a pure function over rows does.

**P5 — No `Date.now()` in the domain layer.** Every function taking "now" takes it as an argument.
The fixture window ends 2026-09-08, so a test that reads the wall clock passes today and fails
tomorrow. `/demo/projection` and the Incomplete-Task age buckets are the two places this bites.

**P6 — A test that would pass against an empty fixture is not a test.** Each unit target below
names the fixture property (R-D*) that gives it something to fail against.

---

## 2. Layer responsibilities

| Layer | Tool | Proves | Does not touch |
|---|---|---|---|
| **Unit** | Vitest, `src/domain/**` | All arithmetic and all rules: bucketing, permission filtering, aggregation, comparability, capping, change, projection | React, the DOM, fixtures-as-files |
| **Fixture invariant** | Vitest, over committed JSON | The data carries every property the product's claims rest on | Application code |
| **Component** | Vitest + RTL, jsdom | A ViewModel renders faithfully: mirror matches series, series identity is stable, controls serialise, empty states appear | Aggregation — components receive ViewModels (R-T6) |
| **E2E** | Playwright, Chromium | The routes exist, the two accounts differ, enforcement holds, URL state round-trips | Numeric correctness — that is the unit layer's job |

**The division is a consequence of the seam.** Because a component cannot compute (R-T6), there is
no numeric assertion a component test could make that a unit test does not make better. Because
enforcement is server-side (R-A6), there is no permission assertion an E2E test can make about the
*payload* that a unit test makes about the *filter* — but E2E is the only layer that can prove the
payload actually shipped that way, which is why T-E4 exists.

---

## 3. Unit tests — `src/domain/**`

### 3.1 The five targets inherited from tickets 05 and 08

Named by resolved tickets; carried forward unchanged except where ADR-0005 removed one.

**T-U1 — `(rows, timezone, grain) → period buckets`** (`domain/periods.ts`, R-M10)

The one place an off-by-one is both easy to write and invisible in a chart. Cases:

- A session at **23:30 Europe/Madrid** buckets to that local day, not the previous UTC day (A7).
  R-D5 seeds these deliberately; without them the declared-timezone decision is never exercised.
- Week and month boundaries fall in the Organization's timezone, not UTC.
- Day / week / month partition the range with no gaps and no double-counting.
- **Day grain over a range longer than two months is rejected**, not silently rendered (A3, R-M11).
- April and September buckets carry `partial: true` (A26, R-D2).
- **No DST transition falls inside the window** (R-D5), so that case is explicitly *not* covered.
  Recorded here so a future reader does not mistake the gap for an oversight.

**T-U2 — ~~Session pricing over two rate cards~~ — REMOVED by ADR-0005.**

This was the map's named "cleanest unit-test target". Cost is now attributed upstream and stored on
the session row; the application prices nothing (R-M4, R-T11). There is no pricing function to
test. **The four targets in § 3.2 are its replacement**, and they are why the reversal was net
positive for the suite: pricing a session is multiplication, and the interesting failures in this
product are aggregation failures.

**T-U3 — The change-floor rule** (`domain/change.ts`, R-M12)

- Prior period holds zero → the change figure is **suppressed** (A8).
- Prior period holds one → the change figure is **shown**, however large. Two-to-three
  week-over-week is +50% and the product says so.
- The floor is a count of one, not a magnitude threshold. A test asserting a percentage cut-off
  would encode the position the metric set explicitly rejected.
- **Prior period incomplete → suppressed, with its reason** (R-M13, C13). Asserted separately from
  the zero floor, and asserted to be *distinguishable* from it: the two suppressions carry different
  reasons, because "no prior data" and "prior month unfinished" are different facts about the page.
- **Current period incomplete → shown, and flagged** (R-E2). The asymmetry is the assertion. A test
  that only checked `incomplete` was carried would pass against a rule that suppressed both sides,
  which is the rule C13 rejected.

**T-U4 — The `WorkType → artefact kind` comparability intersection** (`domain/comparability.ts`,
R-M8) — also one of the § 3.2 four; stated once here.

- `implementation`, `bugfix`, `refactor` share `pull_request`, `commit`, `file_changed`,
  `line_changed` — comparable with each other.
- `review` produces only `pr_comment` — comparable with **none of the three code WorkTypes**. This
  is the one live case the fixture keeps. (It *does* share `pr_comment` with `deploy`, per the next
  bullet; the earlier wording said "neither of the others", which its own next bullet contradicted.)
- `deploy` produces `commit` and `pr_comment` — shares `commit` with the code types and
  `pr_comment` with `review`, and shares an acceptance criterion with neither.
- The three code WorkTypes share an **acceptance criterion**, so their acceptance rates are
  comparable; `review` and `deploy` are comparable with neither, which is what keeps R-M6 true.
- **Given a datapoint, the function returns the WorkTypes that may be offered** (A23). The UI
  consumes this to build its controls, so an incomparable selection is unrepresentable rather than
  rejected after the fact.

**T-U5 — The hidden-session filter** (`data/load.ts`, R-M2)

The cheapest, sharpest test in the suite: **the same query over the same rows returns different
counts with and without the filter.** R-D12 generates ~2% hidden sessions precisely so the
exclusion rule has something to act on — if they never existed, the rule would be untestable.

- No hidden session appears in any metric, table or chart mirror (A4).
- The exclusion happens **once, at load** — a query cannot opt out of it, and a test asserts there
  is no code path that returns hidden rows.

### 3.2 The four ADR-0005 replacement targets

Named by ticket 10 as the tests that replace the pricing function. They had no owning ticket. They
do now.

**T-U6 — Non-additive Team roll-ups** (`domain/aggregate.ts`, R-V3)

The single most likely place for this product to assert a wrong number confidently.

- The sum of every Team's figure **exceeds** the Organization figure, because overlapping Members
  are counted in each Team they belong to (A5). R-D14 guarantees at least 3 such Members.
- A Member in two Teams contributes their full figure to **both**, not half to each.
- The **overlap note is computed alongside the total** and states the true count of multi-Team
  Members. A test asserts they cannot disagree — the note is derived from the same grouping pass.
- Organization → Member and Model → family → tier **are** true partitions and *do* sum. Asserted
  as the contrast case, so the Team result reads as a property rather than as a bug nobody fixed.

**T-U7 — Per-capita denominators exclude service accounts** (`domain/aggregate.ts`, R-M14)

- The denominator counts **active human Members only**. R-D3 puts 2 `service_account`s in a roster
  of 20, so a wrong denominator is off by 10% — large enough to catch, small enough that an
  eyeballed chart would not (A6).
- Service accounts still contribute to the **numerator**: their sessions are real work and real
  cost. Only the seat-holding denominator excludes them.
- Per-capita is offered only where more than one Member is aggregated.
- Interaction with T-U6: **Team per-capita uses that Team's human headcount**, and overlapping
  Members are counted in each Team's denominator as well as its numerator.

**T-U8 — Timezone-bounded period edges** — the aggregation-side counterpart of T-U1.

T-U1 proves a row buckets correctly. T-U8 proves the **aggregate over a timezone-bounded range is
right**: a "last month" total in Europe/Madrid contains the 23:30-local sessions that UTC would
have pushed into the adjacent month, and the month's own boundaries move with the Organization's
declared timezone rather than with the server's.

**T-U9 — The comparability intersection** — see T-U4. Listed in both places because ticket 10 names
it as a replacement target and ticket 08 names it as an inherited one. One implementation, one set
of tests.

### 3.3 Permission filtering — the combinatorial surface

**T-U10 — The grant table as a pure function** (`domain/access.ts`, P4, R-A6). Renamed from
"permission matrix" when C9 removed the rendered matrix — this test was never about that surface,
and A28's traceability row citing it was the reason a stale criterion looked covered.

- **Every (subject scope × datapoint class) cell is asserted**: 6 scopes × 4 classes = 24 cells,
  as a table-driven test. This is why it is a unit test and not a click-through.
- **`self` over every class is asserted for both presets** (R-A3.1). This is an invariant of the
  model, not a preset property: a test constructs a Role granting only `team` over `jobs` and
  asserts `self` is still resolved. Without it a restricted account meets `/demo/people` with no
  people on it, because scopes are not a ladder.
- The **open default** additionally grants `org-member` over `jobs`, `tokens`, `cost` and `access`.
- The **restricted preset** additionally grants `team` over `jobs` and `tokens` — asserted cell by
  cell, including the negatives. It holds no `org-member` or `peer` cell, so it resolves **no other
  Member by name**.
- **Aggregated vs identified is a separate grant**: `team` (aggregated) resolves totals but not
  names; `org-member` (identified) resolves names. The distinction does no work in the default
  configuration, which is exactly why it needs a test — nothing else exercises it.
- **The filter runs on rows, before aggregation** (R-T17). A test asserts that a below-grant row is
  absent from the *input* to the aggregation, not merely absent from its output.
- Symmetry (R-A9): under the open default, viewer A's view of B equals viewer B's view of A.

### 3.4 The remaining domain functions

One `T-U*` block each, same shape: the rule, its boundary cases, and the fixture property it fails
against.

- **T-U11 — Series capping and ordering** (`domain/series.ts`, R-V4, R-V5). The cap engages above
  five series and not at five (A13) — 20 Members → 4 + "Other"; 5 Repositories → 5 and **no**
  "Other". Ranking is by the chart's own measure **across the whole selected range**, ties break by
  name ascending, and the set is **identical in every bucket** (A14). A test constructs a dataset
  where per-bucket ranking would differ from whole-range ranking, and asserts the whole-range
  answer — this is the bug R-V5 exists to prevent.
- **T-U12 — Total spend composition** (`domain/metrics/spend.ts`, R-M1, R-M5). Session Cost + Seat
  cost; seats on `human` Members only; **unavailable below monthly grain** (A25). April's whole-
  month seat charge against 19 days of sessions is asserted as correct-and-flagged, not corrected
  (R-D2).
- **T-U13 — Cost per completed Task** (R-M1). Non-accepted sessions sit in the numerator and not
  the denominator. A period with spend and zero Completed Tasks does not divide by zero.
- **T-U14 — Acceptance rate is computed within a WorkType only** (R-M6, A21). A cross-WorkType
  figure is not merely unrendered — the function cannot produce one.
- **T-U15 — Rework and Decomposition** (R-M1). Rework is a non-accepted session followed by
  another session on the same Task **of any WorkType** — the same-WorkType clause was dropped, so a
  test asserts the cross-type case counts. Decomposition is >1 accepted session. They are
  **independent labels, not a partition**: a Task exhibiting both is asserted.
- **T-U16 — Incomplete Task age buckets** (R-M16, R-D9). All four buckets — 0–7 · 8–30 · 31–90 ·
  **91+** — with "now" injected (P5). **Boundaries are half-open and a Task aged exactly 90 days
  falls in one bucket only**; the earlier `90+` wording double-covered day 90 in all three sources
  and is the off-by-one this test exists to prevent.
- **T-U17 — Model mix at three roll-up levels** (R-M7). Exact → family → tier is a true partition
  and sums. **No per-session metric can be grouped by or filtered on Model** (A22) — asserted as an
  absence: no query function accepts a Model argument.
- **T-U18 — Tokens processed** (R-M9). The four disjoint classes summed. Disjointness is what makes
  the sum safe, and a test asserts the classes do not overlap in the fixture.
- **T-U19 — Session duration** (R-M1). Median and p95, on a right-skewed distribution. The mean is
  not computed, and a test asserts the API does not expose one.
- **T-U20 — Human-presence spans** (R-N14). The three spans sum to
  `machine_allocation_duration_s`; `headless` sessions are 100% AFK with zero interactive and zero
  idle; the composition is computed over `interactive` sessions only.
- **T-U21 — Projection** (R-N23, P5). Elapsed-proportional extrapolation with "now" injected. At
  10% elapsed and at 90% elapsed the method is identical and the elapsed fraction differs — both
  asserted, because they are different claims. **No confidence band is produced** (R-N24).
- **T-U21.1 — The projection's components** (R-N23.1, R-M5). The `/demo/projection` ViewModel
  carries `sessionToDate`, `seat`, `projectedSession` and `projectedTotal`, and
  **`projectedTotal === projectedSession + seat`** — asserted as an equality, not a tolerance,
  because the total is *assigned* that sum rather than summed a second time. The seat charge is
  identical in both figures (it is never extrapolated), and the daily chart carries one series,
  session Cost, unstacked. It sits in `src/data/queries.test.ts` because the ViewModel is
  assembled at the seam; the extrapolation itself is T-U21's, in the domain layer.

---

## 4. Component tests — RTL + jsdom

**Components receive ViewModels and render them.** There is no aggregation to test here (R-T6), so
these tests are about faithfulness, identity and state.

### 4.1 Setup

**T-C0 — Charts under test render at fixed numeric `width`/`height`, never `initialDimension`**
(R-T29). This settles the one item ticket 09 left genuinely open. Fixed dimensions need zero mocks
and do not interact with `vitest.setup.ts`; `initialDimension` works until a `ResizeObserver`
polyfill lands in the setup file, and then fails **confusingly rather than loudly**. No
`ResizeObserver` polyfill is added; if one appears, this test's failure is the alarm.

### 4.2 The mirror is the assertion target

**T-C1 — Every chart renders a visually-hidden `<table>` mirror** whose values equal the rendered
series (A15). Because the mirror is built in the domain layer independently of the series (R-T7),
this is a real cross-check rather than the same array printed twice.

**T-C2 — Every chart's `aria-label` names the current roll-up level** (A16, R-X2), and changes when
the level changes. The container is a plain `<div>`; this is the one piece of state a screen-reader
user cannot otherwise recover.

### 4.3 The legend identity test

**T-C3 — Series identity is pinned across a roll-up switch** (A14, R-T8).

The most valuable component test in the suite, and the reason it exists is specific: shadcn's
default legend uses `key={index}`, and ticket 14 deferred that patch to encounter. With
`key={index}` live, **React reconciles "Team A" into "Team B" in place** — the DOM node persists,
the colour persists, the label changes, and nothing errors. It is a silent wrong-colour bug on the
product's central interaction.

- Flip a chart from 20 series to 4 and assert the legend entry set changed identity, not just
  length. `getAllByLabelText(/legend icon/)` is the handle.
- Assert the mirror's column headers changed in step with the legend.
- **This test is what converts a deferred patch into a caught bug.** It is written before the patch
  and must fail if `key={index}` is reintroduced.

### 4.4 Controls and states

- **T-C4 — Controls serialise to the query string and round-trip** (A19, R-C3). Every control:
  period, grain, filters, roll-up level, subject, sort. A bare route renders page defaults (R-C4).
- **T-C5 — Invalid control combinations are coerced or rejected, never rendered** (A3) — day grain
  over a range longer than two months is the named case.
- **T-C6 — A page renders only its declared controls** (R-C1), and **no greyed control appears
  anywhere**. Table-driven over the six pages.
- **T-C6.1 — Every declared control changes something** (R-C1, C14). For each page, each declared
  control is toggled and the resulting ViewModel asserted to differ. This is the test that would
  have caught per-capita being declared for `/demo/spend` and read by nothing — T-C6 passed
  throughout, because the control *rendered*; it simply did nothing. The one exemption is written
  as an expectation, not a skip: per-capita under a Member subject grouping divides by one and
  returns identity, asserted as equality on purpose.
- **T-C7 — An emptying filter renders "no data for this selection"** with shell, navigation and
  controls still present (R-V9, A26 adjacent).
- **T-C8 — Team-grouped panels render the overlap statement** (A5, R-V3) with the count the domain
  layer computed.
- **T-C9 — Money labelling** (A17, R-V8): no attributed figure carries "estimated"; Projected cost
  does; the token rate card carries "illustrative rates". Asserted as three separate statements
  because they are three separate claims.
- **T-C9.1 — The `/demo/history` expandable row** (R-N20.1) shows that session's four disjoint
  token class volumes and its Model mix, and the four volumes sum to the row's Tokens processed
  figure. This is the only surface carrying either, so it is the only place they are assertable
  against rendered output rather than only in the domain layer.
- **T-C10 — "Other" is inert** (R-V6): not clickable, does not expand, and its tooltip lists what
  it holds.
- **T-C11 — Chart-shape rules** (A12, R-V1, R-V2). Two claims, asserted differently:
  - **No pie chart is imported anywhere.** A static assertion over the chart modules — a rendering
    test cannot prove an absence across a codebase.
  - **Stacking follows the partition, not the panel.** A chart stacks if and only if its ViewModel
    carries `stackable: true`. Table-driven: WorkType, Model tier/family, execution mode and the
    three duration spans stack; **Team never does**, and a Team-grouped ViewModel asserting
    `stackable: true` is itself a failure. This is the test that keeps R-V1's narrowing honest —
    a blanket `no stackId` assertion would have been easier and would have forbidden a legitimate
    part-to-whole panel.
  - **The `/demo` WorkType tile is asserted `stackable: false`** (C11). WorkType partitions
    *sessions*; this tile counts *Tasks*, whose sessions may span WorkTypes, so the grouping does
    not partition this measure. The table is keyed on (grouping × measure), not on grouping alone —
    keying it on grouping is what let a true-of-sessions justification carry a Task-grained tile.
  - **The arithmetic is asserted, not just the flag**: the tile's slices are summed and asserted
    **greater** than the Completed Tasks tile against the committed fixture (162 against 150 for the
    open account in August 2026). A future change that made them equal would mean the measure had
    silently been re-keyed, and that should fail here rather than pass quietly.
- **T-C12 — The projection tiles print their components** (R-N23.1, R-M5). Both tiles render a
  `Session cost` / `Seat cost` pair under the headline, the seat figure is the **same string in
  both** because it is never extrapolated, and the arithmetic line carries the month's real
  numbers. R-N24's "one figure, no bound" claim is restated rather than dropped: the projected
  tile's money figures are exactly the headline and its two named components, so a fourth number
  fails the test. The seat charge is asserted **beside** the chart, never as a series in it.

---

## 5. E2E tests — Playwright, Chromium

**Small and structural.** Ticket 07 designed the surface to give the suite a clean target: *"one
request per account per route, asserting rows rather than pixels."*

- **T-E1 — Every route renders for both accounts.** 6 authenticated routes × 2 accounts = 12
  navigations, asserting a page landmark and no error boundary. Navigation is identical for both
  (A9, R-A8) — asserted as an equality of nav item sets, not eyeballed.
- **T-E2 — The restricted account receives one row where the open account receives twenty**
  (A9, R-D18, C10). On `/demo/people`, **1 against 20** — the restricted account resolves no other
  Member by name, and C10 declined to restate its aggregated grant as a row in a table of named
  rows. A row count, not a screenshot.
- **T-E2.1 — The people page states the acting account's visibility in words** (A28, R-A10, C9).
  Both accounts render the sentence; the two sentences **differ**, and the restricted one is
  asserted to contain no digits — the point of C10 was to keep an aggregate off this page, and an
  explanation that quotes a figure puts it back. This test replaces T-E8.
- **T-E3 — Enforcement.** A token whose Organization does not match the path segment yields **404,
  not 403** (A11, R-A7). An unknown slug yields 404. No cookie on an `/[org]/**` path redirects to
  `/sign-in`.
- **T-E4 — No ungranted figure reaches the client payload** (A10, R-T18). Fetch the restricted
  account's page and assert the response body contains no Member name or cost figure outside its
  grants. **This is the one assertion only E2E can make** — the unit layer proves the filter is
  correct; only this proves the filtered result is what actually shipped. It is the difference
  between the access model working and the access model being theatre.
- **T-E5 — Control state does not survive navigation** (A20, R-C5). Set a period on `/demo/spend`,
  navigate to `/demo/work`, assert the default.
- **T-E6 — The account switcher re-issues the token and stays on the current URL** (R-A5). Same
  path, fewer rows. (Previously cited "A5/R-A5"; A5 is the Team-overlap criterion and has nothing to
  do with the switcher. R-A5 was always the rule meant.)
- **T-E7 — `/demo` renders four tiles and nothing else**, each linking to its evidence page (A1,
  A2). The one E2E test about layout, because "nothing else" is a structural claim about the page.
  **Three tiles carry a headline figure, not four** (R-N8, C11): the WorkType tile carries a title,
  a breakdown and a link, and asserting a figure on it would re-admit the duplicate of tile 2 that
  C11 removed.
- ~~**T-E8 — The permission matrix renders for the open account and not for the restricted one.**~~
  **Withdrawn 2026-09-09 by C9**, which removes the matrix from the product. It asserted a claim
  (A28) that the spec contradicted in two other places, and it is replaced by T-E2.1. The ID is
  retired rather than reused.
- **T-E9 — The compute rate card appears on no surface** (A18, R-N11). Crawl all six routes for
  the card — its heading, its "illustrative rates" marker and its per-unit labels. An absence across
  the whole product is an E2E claim.

  **Crawling for the bare rate *values* is unsatisfiable against this fixture** and was the earlier
  wording: at 525 money literals in a narrow range, a rate value collides with legitimate figures on
  pages that render no rate card at all. The card is identified by its structure, and its values stay
  in T-E4's search set so that shipping it fails both tests at once.

- **T-E10 — The projection's four numbers are on the page and sum** (R-N23.1). Read off the
  rendered text of `/demo/projection`: session cost to date, the seat charge, the projected
  session cost and the projected total, with the two totals equal to their components to within
  the cent the strings are rounded to. The exact identity is T-U21.1's; what this test adds is
  that the figures a reader can *see* are the ones it holds between.

---

## 6. Fixture invariant tests

Over the committed JSON, no application code. These prove the data carries what the product's
claims rest on — a fixture that quietly loses the 91+ day bucket makes T-U16 pass vacuously (P6).

- **T-F1 — All 25 `(repository × work_type)` session files exist**; empty pairs hold `[]` (R-D19).
  A missing file is a fault, not a valid state.
- **T-F2 — Span sums.** Every session's three duration spans sum exactly to
  `machine_allocation_duration_s` (R-T12).
- **T-F3 — Token classes are disjoint** and non-negative (`CONTEXT.md` § TokenUsage, R-M9, T-U18).
  Disjointness is the property that makes the display sum safe; R-D16 is a separate claim about tier
  *share*.
- **T-F4 — Every required distribution is present**: acceptance by WorkType (R-D6) and by
  Repository (R-D7), Rework 18% / Decomposition 12% (R-D8), all four age buckets non-empty (R-D9),
  the low-usage seat holder (R-D10), ~20 CPU-heavy token-light sessions (R-D11), ~2% hidden
  (R-D12), the interactive service account and headless humans (R-D13), the multi-Team Members and
  the cross-Team Repository (R-D14), 40% multi-Model sessions (R-D15), the frontier share trend
  (R-D17).
- **T-F5 — Both accounts have real sessions** and their views differ (R-D18).
- **T-F6 — Timezone edge rows exist** — sessions between 22:00 and 24:00 Europe/Madrid (R-D5).
  Without this, T-U1's sharpest case has no data.
- **T-F7 — Every Task key is `owner/repo#number`** and resolves to a Repository in the fixture; no
  key is synthetic or absent (R-T10 adjacent, `CONTEXT.md` § Work).
- **T-F8 — Every GitHub user matches a Member** (R-D20). The join is authored; an unmatched user is
  an unreachable state and must not appear.
- **T-F9 — The committed output matches the seed** (R-T21). CI regenerates into a temp directory
  and diffs. The only place the generator runs in CI.

---

## 7. What is deliberately not tested

Stating these is part of the spec. Each is a decision, not an omission.

| Not tested | Why |
|---|---|
| **Session pricing** | There is no pricing function. Cost is attributed upstream and stored (ADR-0005, R-M4) |
| **SVG geometry — paths, coordinates, pixel positions** | The mirror carries the same claim in queryable DOM (P2). Asserting geometry tests Recharts |
| **Cross-browser rendering** | Chromium only. Not what this project demonstrates; committed decision in `playwright.config.ts` |
| **The generator's internals** | Tests read committed output (P3). T-F9 pins the output to the seed; that is the whole contract |
| **A designed zero-data state** | There isn't one (R-E1, ticket 11 `wontfix`). T-C7 covers the filter-empties-a-panel case, which is the only empty state that exists |
| **DST transitions** | No transition falls inside the window (R-D5). Recorded in T-U1 so the gap is visible |
| **Quarter buckets** | `quarter` was dropped (`spec.md` § 11 C7). `CONTEXT.md` defines Period as day, week or month, and nothing implements a quarter |
| **Vendor-shaped token normalisation** | Ticket 13 `wontfix`; no un-normalisable rows exist in the fixture |
| **Visual regression / screenshots** | High maintenance, low signal on a fixture-backed dashboard. The structural claims are asserted directly |
| **Route shells** (`layout`/`error`/`loading`/`not-found`) | They compose and carry no logic. Already excluded from coverage in `vitest.config.mts`; E2E covers that they render |
| **Landing copy** | Unwritten (`spec.md` § 13) |

---

## 8. Coverage

**T-Q1 — Global thresholds stay as committed**: statements 80 / branches 75 / functions 80 /
lines 80, route shells excluded (`vitest.config.mts`).

**T-Q2 — `src/domain/**` carries a raised threshold: 95% statements / 90% branches** (R-T34). The
global figure is a floor for a codebase that includes glue. The domain layer is pure functions with
no I/O and no framework; there is no reason for it to be uncovered, and a uniform threshold lets
high coverage of trivial rendering code mask thin coverage of the arithmetic that decides what the
product claims. Test coverage is one of three grading criteria, and this is where the grade
actually is.

**T-Q3 — Coverage is a floor, not a target.** A ranked list of what is *not* covered in
`src/domain/**` is more useful than the percentage, and belongs in the PR description.

---

## 9. Acceptance criteria → tests

Every criterion in `spec.md` § 10 has an owning test. No criterion is unowned.

| Criterion | Owned by |
|---|---|
| A1 `/demo` is four tiles, each a link | T-E7 |
| A2 `/demo` offers month only | T-E7 |
| A3 Day grain rejected over >2 months | T-U1, T-C5 |
| A4 No hidden session anywhere | T-U5, T-F4 |
| A5 Team totals exceed Org; overlap stated | T-U6, T-C8 |
| A6 Per-capita excludes service accounts | T-U7 |
| A7 00:30 Madrid buckets to the local day | T-U1, T-U8, T-F6 |
| A8 Change suppressed iff prior period is zero or incomplete | T-U3 |
| A9 Restricted account: fewer rows, same nav | T-E1, T-E2 |
| A10 No ungranted figure in the payload | T-E4, T-U10 |
| A11 Org mismatch → 404 | T-E3 |
| A12 Stacking only where the grouping partitions the measure; no pie | T-C11 |
| A13 Cap engages above five, not at five | T-U11 |
| A14 Series identity stable across buckets and roll-up | T-U11, T-C3 |
| A15 Mirror matches rendered series | T-C1 |
| A16 `aria-label` names the roll-up level | T-C2 |
| A17 Money labelling | T-C9 |
| A18 Compute card appears nowhere | T-E9 |
| A19 Controls round-trip; bare route = defaults | T-C4 |
| A20 State does not survive navigation | T-E5 |
| A21 No cross-WorkType acceptance rate | T-U14 |
| A22 No per-session metric grouped by Model | T-U17 |
| A23 Datapoint conditions offered WorkTypes | T-U4 |
| A24 No default sort-by-cost | T-E7, T-C4 |
| A25 Total spend unavailable below monthly | T-U12 |
| A26 April and September flagged partial | T-U1, T-U12 |
| A27 Spans are `interactive`-only and say so | T-U20, T-C1 |
| A28 No matrix anywhere; visibility stated in words | T-E2.1 |

---

## 10. Residual exposure

Recorded rather than discovered.

**The suite proves the rules, not the design.** Every acceptance criterion in `spec.md` is
structural — row counts, identity, absence, arithmetic. Nothing here proves the dashboard is
*legible* in ten seconds, which is ticket 03's actual bar and one of the three grading criteria.
That judgement stays human, and no test substitutes for looking at it.

**T-E4 is load-bearing and singular.** It is the only assertion that the access model acts on the
wire rather than in a function. If it is weakened to a DOM query instead of a payload inspection,
the product's central privacy claim becomes untested while appearing tested.

**Component coverage is thin by design.** Because components cannot compute (R-T6), most of them
are near-trivial and the global 80% threshold will be carried by the domain layer. That is the
intent, and T-Q2 is what stops it from being an accident.
