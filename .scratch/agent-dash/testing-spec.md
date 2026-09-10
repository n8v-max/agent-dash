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
The fixture window ends 2026-09-25 and the data runs past today (R-D2, tickets 62 and 66), so a
test that reads the wall clock passes today and fails tomorrow. `/demo/projection` and the Incomplete-Task age buckets are the two places this bites.

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
- **Current period incomplete → suppressed, with its own reason** (R-M13, C13 as amended). The
  earlier rule showed this figure with a flag, and the assertion here was the *asymmetry*; C13's
  amendment withdrew it once the current month became `/demo`'s default period, because eight days
  against a whole month reads as a collapse in spend on the page owning the ten-second read. Three
  claims: it suppresses, it suppresses under `current-period-incomplete` and not under one of the
  prior-period reasons, and a comparison failing on *both* sides reports the baseline. The reasons
  are asserted distinguishable for the same purpose as the pair above — the copy on the tile is
  different in each case.
- **Either period has no figure → suppressed, with its own reason** (R-M18, R-M12, C15). A ratio
  over a zero denominator is `null`, and a `null` read as `0` reports a fall to nothing off a
  period whose measure was never defined. Asserted as *distinguishable* from a measured fall: a
  current period of 0 against a prior of 200 is shown as −100%, and a current period of `null`
  against the same prior is suppressed. A test asserting only "suppressed" would pass against a
  rule that hid the measured fall too, which is the case a reader most needs.
- **None of the suppressions is a magnitude rule.** The sweep over the committed roster asserts
  every month-over-month figure shown when, and only when, its base is non-zero and finished
  **and** the month on screen is finished, so a cut-off placed at any magnitude fails it.

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

  **The cap is the palette's length** (added 2026-09-10, ticket 70). One input of ten series is
  run through `capSeries` twice: with the Model mix palette it emits **ten distinct `colorVar`s
  and no "Other"**, and with the shared palette it still emits five and an "Other" holding six.
  Eleven series against the ten-colour palette still folds into "Other", so the amendment lifts
  the ceiling and does not remove it. `paletteFor` — the one expression that decides which
  palette a grouping takes — is covered over the whole closed `Grouping` union, so a grouping
  added without a palette is a type error rather than a silent fallback to five.
- **T-U12 — Total spend composition** (`domain/metrics/spend.ts`, R-M1, R-M5). Session Cost + Seat
  cost; seats on `human` Members only; **unavailable below monthly grain** (A25). April's whole-
  month seat charge against 19 days of sessions is asserted as correct-and-flagged, not corrected
  (R-D2). **The seat-month count is `seats × months`** and Seat cost is that count times the fee —
  18 seats over 6 months is 108 seat-months and $4,212 — and a test asserts the two counts are not
  the same number, because the panel printed the month count under the seat-month label until
  ticket 41 (R-M5).
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
- **T-U17 — Model mix at three roll-up levels** (R-M7). Every level is a true partition of the
  same tokens and all three sum to one total. **`family` and `tier` are two roll-ups of exact and
  not a chain** (amended 2026-09-10, ticket 70): `OpenAI GPT-5` holds a `fast` model and a
  `balanced` one, so a tier is summed from its **Models**, and a test asserts exactly that — plus
  that the roster holds exactly one straddling family, so the case stays real rather than
  hypothetical. Counts come from the committed `models.json` and are never typed out. **No
  per-session metric can be grouped by or filtered on Model** (A22) — asserted as an absence: no
  query function accepts a Model argument.
- **T-U18 — Tokens processed** (R-M9). The four disjoint classes summed. Disjointness is what makes
  the sum safe, and a test asserts the classes do not overlap in the fixture.
- **T-U19 — Session duration** (R-M1). Median and p95, on a right-skewed distribution. The mean is
  not computed, and a test asserts the API does not expose one.
- **T-U20 — Human-presence spans** (R-N14). The three spans sum to
  `machine_allocation_duration_s`; `headless` sessions are 100% AFK with zero interactive and zero
  idle; the composition is computed over `interactive` sessions only. **Over a population holding
  no machine time the three shares are `null`, not `0`** (R-M18): three spans each reading 0%
  claim a composition that was measured and found empty.
- **T-U21 — Projection** (R-N23, P5). Elapsed-proportional extrapolation with "now" injected. At
  10% elapsed and at 90% elapsed the method is identical and the elapsed fraction differs — both
  asserted, because they are different claims. **No confidence band is produced** (R-N24). Before
  any of the period has elapsed there is no elapsed share to divide by, so the projection is
  `null` (R-M18) and not the actual figure.
- **T-U21.1 — The projection's components** (R-N23.1, R-N23.2, R-M5). The `/demo/projection`
  ViewModel carries `sessionToDate`, `seat`, `projectedSession` and `projectedTotal`, and
  **`projectedTotal === projectedSession + seat`** — asserted as an equality, not a tolerance,
  because the total is *assigned* that sum rather than summed a second time. The seat charge is
  identical in both figures (it is never extrapolated). The daily chart carries **two** series
  (ticket 64), `stackable`, over every civil day of the month: the attributed column sums to
  `sessionToDate` and the two columns together sum to `projectedSession` — and **not** to
  `projectedTotal`, which is how "the seat charge is in neither series" is asserted as arithmetic
  rather than as the absence of a label. The series set is asserted as a *set*, because R-V5
  ranks the two by their whole-range measure and the order is a fact about the month. It sits in
  `src/data/queries.test.ts` because the ViewModel is assembled at the seam; the extrapolation
  itself is T-U21's, in the domain layer.
- **T-U21.2 — The daily projection** (R-N23.2, R-N24, P5). `projectDaily` in the domain layer,
  over a pinned `now`. **`Σ actual + Σ projected` is the projected session cost** at one day
  elapsed, mid-month with today only part spent, and on the last day of the month — where the
  projected series is **all zero**, because a closed month is measured rather than forecast. A
  day before today projects nothing and a day after today has spent nothing; a day with no
  session is a real zero rather than a gap (R-M18). A month that has not begun is **rejected**:
  there is no rate to carry forward, and thirty flat bars would be a forecast of nothing rather
  than the absence of one. R-N24 rides along unchanged — no band, and no field to carry one.
- **T-U22 — The zero-denominator rule** (`domain/ratio.ts`, R-M18, A29). The rule is one
  expression, so it gets one test rather than nine, and the nine call sites get one assertion each
  that they divide through it:
  - `ratio(n, 0)` is `null` for every `n`, including `n = 0`. `-0` is a zero and is caught by the
    same comparison, so no reading is ever `-Infinity`.
  - **`null` if and only if the denominator is zero**, asserted over a grid of numerators and
    denominators. This is the seed ticket 51 extends into a property at 200 runs; stating it as a
    biconditional is why the function deliberately carries *no* guard for a `NaN` or infinite
    denominator, neither of which any measure in this product can produce.
  - **A measured zero survives.** `ratio(0, 5)` is `0`, an acceptance rate of 0 over five sessions
    renders as `0%`, and a ratio cell holding a real zero is not turned into a gap.
  - Each of Cost per completed Task, Cost per session, Acceptance rate, Rework rate, Decomposition
    rate, per-capita, Projection, the seat share, the Model-mix shares and the span shares returns
    `null` over its own zero denominator (`spend.test.ts`, `efficacy.test.ts`,
    `aggregate.test.ts`, `projection.test.ts`, `duration.test.ts`).
  - **Over the committed fixture** (P6): the restricted account's Cost per completed Job at week
    grain holds no reading in weeks 15–17, 20, 21 and 23, and **no bucket of that chart reads
    zero** — a finished Job cannot have cost nothing, so a zero there could only be the coercion
    this rule removed. `src/data/queries.test.ts`.
- **T-U23 — the dataset's own edge** (`domain/observation.ts`, R-N3.1, A39). The rule is "the
  greatest `ended_at`", and every case is a way of getting that wrong: reading `started_at`
  instead — a long session started before a short one finishes after it, and the two orders
  disagree — taking the last row of an already-ordered list (`load.ts` orders by `started_at`),
  comparing ISO strings rather than instants across two offsets, or letting an unreadable
  timestamp rank as a `NaN`. A genuine tie breaks by id, so the answer is one row and always the
  same row. **No clock is read** (P5): the observation is a property of the rows and takes no
  `now`, so it cannot drift with the day the suite runs.
  - **Over the committed fixture**, in `src/data/clock.test.ts`: `dataAsOf()` names the session
    that ended last out of all 7,761, prints that session's **start** through the one instant
    formatter in the Organization's timezone, lands **inside `window_end`** — which is the reason
    it prints the start rather than the end — and is the same string when the wall clock is moved
    five years forward.
- **T-U24 — the session tree** (`domain/sessions.ts`, R-M19, R-D21, A41, ADR-0008). Two failures,
  and the module is arranged so each is unavailable rather than discouraged.
  - **A child is never a row.** `rollUpSessions` returns roots carrying their children's cost,
    tokens and the four duration fields; the wall clock stays the root's, so the folded row's
    machine allocation legitimately exceeds its duration by *exactly* the children's machine time.
    A child whose root is absent is counted nowhere, on `aggregate.ts`'s own rule for an
    unattributable row.
  - **A child is never an attempt.** `taskFacts` drops children in the grouping pass, so a Task
    with one accepted root and three children is neither Rework nor Decomposition — and the type
    it takes carries `parent_session_id`, so the guard cannot be removed without changing every
    caller. **Over the committed fixture** (P6, `src/data/sessions.fixture.test.ts`): `taskFacts`
    over roots and over every visible row produce *identical* output, and relabelling the children
    as roots moves the Rework rate from 18% to 31% — the error the ticket exists to remove,
    computed rather than argued.
  - **What makes a child well-formed is one expression** (`childFaults`), and each of its five
    faults gets a case: a missing root, a grandchild, each of the five inherited labels
    disagreeing, a child carrying `accepted`, and a visible child under a hidden root. The same
    expression is what `load.ts` throws on (R-T37), asserted there against a doctored fixture.
- **T-U25 — Agents per session** (R-M19, R-N12 item 5). Median and p95 through `duration.ts`'s
  nearest rank — the same order statistic, not a second implementation (A37) — with a root that
  spawned nothing counting **one** agent and an empty population reading `null`, never `0`
  (R-M18). Over the committed fixture: median 1, p95 4, and the agent total equal to the number of
  visible rows on disk.

### 3.5 The fixture contract — `src/data/load.ts` (ticket 53)

Two targets, in `src/data/fixture-contract.test.ts`. They are the same claim from both ends: a
malformed row must fail the load *diagnosably*, and the load must be the only way a row gets in.
Either alone is weak — a loader that faults loudly proves nothing if a panel can import the JSON
beside it, and a boundary nothing bypasses proves nothing if it accepts a negative cost.

**T-U26 — A malformed row fails `load()`, naming the file, the row index and the field.** The
message format is the assertion: every fault reads `<file>[<row index>].<field>: <why>`, read back
as one string rather than as three `toContain`s, because three parts appearing somewhere in a
sentence are not a location. Six cases, one per test, each built **in the test** from committed
rows handed back through an overriding reader — nothing on disk is mutated (P3), because the
committed files are the input to every other test in the suite.

- **Negative cost** — money is corrupt, not small. Already enforced by `nonNegative` (schema).
- **An unknown work type** — no acceptance criterion would define it. Already enforced by `oneOf`.
- **A child naming a root that is not in the fixture** (R-M19, R-T37): the fault names
  `parent_session_id` on the child's own row, not merely the session id.
- **`ended_at` before `started_at`** — a negative span, which nets off against real ones in every
  median and p95. Checked in `schema.ts`, as the one claim spanning two fields of one row;
  timestamps must also *parse*, since an unparseable one ranks as `NaN` rather than throwing.
- **A TokenUsage naming a model `models.json` does not declare.** Cross-file, so it is checked in
  `load.ts`: an id nothing declares has no family and no tier to roll up into (R-M7).
- **The sixth: a row filed under the wrong `(repository × work_type)` pair.** The file name is the
  only place the pair is declared, so a stray row is counted under the wrong repository by every
  surface that groups by one and reads as ordinary data everywhere else.

Two further cases keep the *location* honest rather than the rule: the fault names the row that is
wrong rather than the first row of the file, and the file the row came from rather than the pair
the loader happened to be reading.

**T-U27 — `load()` is the only entry.** Proved three ways, because "the façade cannot be reached
with an invalid dataset" is a claim about reachability and a test that merely calls `load()` and
watches it throw does not make it.

- **Over the façade's own import graph.** The transitive imports of `src/data/queries.ts` are
  walked, and exactly one module in that graph imports `node:fs` — `load.ts` — and none imports a
  `.json`. The graph's size and its reaching of `load.ts` are asserted first, as the control.
- **Over the repository.** No source file outside `src/data/**` and `src/fixtures/**` opens a file
  or imports fixture JSON, which is the zone `eslint.config.mjs` draws, asserted independently of
  ESLint running. Nothing but `load.ts` produces a `Dataset`, and nothing in the façade's graph
  names `readDataset` or `readFixtureFile` — the reader-injectable doors are test-only.
- **At runtime.** With `node:fs` serving one doctored session file, `summaryPage(viewer, params)`
  **faults instead of answering**, for a schema fault and for a cross-row one; over the committed
  fixture, the same call returns tiles. That is what the only-entry claim means operationally.

---

### 3.6 Property tests — the seven aggregation invariants

**T-U28…T-U34** (`src/domain/properties.test.ts`, generators in `src/domain/testing/`, ticket 51).
`fast-check`, **200 runs each**, one property per test.

**Why a seventh layer of the same layer.** The tests above assert a rule against rows a person
wrote, and a person writes the rows the rule is about. These seven assert the same rules against
populations a generator wrote, and the generator does not know which case is interesting — which
is the only way to reach the roster nobody thought to author. ADR-0005 named the four aggregation
failures that replace the pricing function as this product's test target; three of the seven are
those, and the other four are the differentiator metrics ADR-0008 re-defined over roots.

**This does not weaken P3 or P6.** Nothing here asserts a *figure*: every property is a rule that
must hold over any population, so there is no number for a generated input to invent. Every
figure in the product is still asserted against the committed fixture by the `T-F*` tests and by
the `*.fixture.test.ts` files. The generators live under `src/domain/**` and are held to its
determinism rules (P5, R-T5) — no wall clock, no `Math.random()`, no environment; the only
randomness is fast-check's own seeded runner — and to its coverage threshold (T-Q2), which
`vitest.config.mts` applies to `src/domain/testing/` automatically because it walks the directory.

**A property whose generator never reaches its case is worse than no test, because it reads as
coverage.** Each of the seven therefore counts the case it is about and **fails if the count is
too low**: an overlapping Member, a row the timezone moved to another civil day, a service account
holding an active seat, a zero denominator, a Task worked by two roots, a root with two children,
a sixth series. The thresholds sit well under the rates measured when the generators were written.

- **T-U28 — Team figures sum past the Organization's, for every additive measure** (R-V3, A5).
  Session Cost in cents, `prompt_count`, tokens processed and machine allocation, over generated
  rosters of 1–12 Members across 1–4 overlapping Teams. The excess is asserted as an identity
  rather than an inequality: `sumGroups − total` equals `Σ (teamCount(m) − 1) × figure(m)`, which
  is T-U6's fixed case generalised to any multiplicity. Organization is asserted to sum exactly,
  as the contrast. The property holds **because a Member belongs to one or more Teams**
  (`CONTEXT.md` § Organisation & People) — a Member on no Team would make the sum fall *below* —
  so the test restates that precondition as an assertion over the generated roster.
- **T-U29 — period buckets partition the range, in the Organization's timezone** (R-M10, R-M11,
  R-E2, A7). Over six IANA zones including two whose offset is not a whole hour, with instants
  written at offsets that are *not* the Organization's and biased onto the minutes either side of
  midnight. No gap, no overlap, no in-range day uncovered, every in-range row in exactly one
  bucket and every out-of-range row in none. A refused plan is asserted to be R-M11's refusal and
  nothing else.
- **T-U30 — a per-capita denominator never counts a service account** (R-M14, A6). At all three
  roll-up levels and in every group. The sharp case is one the roster never writes: a
  `service_account` carrying `seat_active: true`. Flipping every service account's seat on changes
  no denominator, and dropping them from the population changes no denominator either — while
  their work stays in the numerator, which the property asserts as an equality on the total.
- **T-U31 — a ratio is null if and only if its denominator is zero** (R-M18, A29). T-U22's grid,
  extended to the search: unrestricted doubles on both sides, `-0`, `NaN` and both infinities.
  The biconditional is one expression, and a defined reading is asserted to be the division
  itself — unrounded, unclamped, uncoerced.
- **T-U32 — Rework implies two root sessions; Decomposition implies two accepted roots** (R-M1,
  R-M19, A41). Over Task populations where roots fan out to 0–3 sub-agents each. The case that
  matters is a Task with **one** root and several children: it exhibits neither label, however
  wide the fan-out, which is the error ADR-0008 exists to remove. `taskFacts` over the whole
  population is asserted identical to `taskFacts` over the roots alone.
- **T-U33 — a root's cost is its own plus its children's, and the total survives regrouping**
  (R-M19, A41). Per root: cost in cents, the four duration fields, R-T12's span identity surviving
  the fold, and the wall clock, outcome and prompt count staying the root's own. Then the same
  children re-parented to different roots: a different tree, the same population, and the same
  Organization total to the cent.
- **T-U34 — the top four plus "Other" sum to the ungrouped total** (R-V4, R-V5, A13). Over 1–12
  series in 1–5 buckets, with rows carrying several keys (R-V3's Team shape) and rows carrying
  none. The cap engaging and not engaging is asserted as one equality rather than two branches, so
  the five-series case is a stated expectation and not an `else`. Both readings of an absent
  bucket — `0` and `null` — are generated.

### 3.6 The slice (`src/data/as-of.test.ts`, ticket 62)

- **T-U35 — one slice, applied once** (R-D2, R-C4, R-N3.1, A42). Two halves, and the second is
  the one worth the file.

  The rule, over the committed rows (P6) and at instants read off those rows rather than
  invented: `datasetAsOf(now)` drops a root whose `ended_at` is after `now` **together with its
  children**, keeps a root ending **exactly** at `now` (a session is observable at its end), hands
  back the loaded dataset *by identity* where the cut removes nothing, memoises per `now`, and
  faults on a `now` that is not an instant rather than guessing which rows exist. The fan-out
  invariant `sessions.fixture.test.ts` asserts of the committed tree — a child ends before its
  root — is re-read through the slice, which is where it does its work.

  **The absence, in the shape T-C19 asserts its own.** Nothing under `src/data/queries/` and
  nothing under `src/app/` or `src/components/` names `loadDataset`; the five modules that do are
  an allow-list, so a sixth is a decision somebody records here; `datasetAsOf` is called in
  exactly two places, both once-per-page; and no module outside `as-of.ts` compares `ended_at`
  against anything. A behavioural test alone would pass against a product where one page query
  had quietly gone back to the whole dataset, because that query's rows are not the ones under
  test — and that query is precisely the per-query filter somebody forgot.

  `clock.test.ts` carries the rest of the clock's half: the window is the declared window cut at
  `now`'s civil day **in the Organization's timezone**, it never inverts, `AGENT_DASH_NOW`
  substitutes for the wall clock and is clamped by the same ceiling, and the as-of stamp moves
  back with `now` because it is read off the slice.

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

**A `ranked` chart's mirror is transposed** (R-V12, ticket 44) — one row per group, headed by the
grouping, one column per bucket — so the cross-check reads it back the other way round before
comparing. The claim is that the two derivation paths agree about the *figures*; the orientation
is the chart's own, and is itself asserted, because a transposed table is exactly where the two
paths could quietly stop describing the same chart. The ranked pages are swept beside the series
ones in `src/data/queries.test.ts`, over the committed fixture, so the case is covered by real
data and not only by a hand-written ViewModel.

**T-C1.1 — A bucket with no reading renders as an absence, in both places** (A29, R-M18, R-V10).
The mirror cell is an **em dash** and the `line` and `area` marks carry **`connectNulls={false}`**,
so the table and the chart make one claim. Both are asserted, and so is the contrast: a bucket
whose reading really is `0` renders `0`, and a *missing* bucket on an **additive** measure still
renders `0` — a Repository that ran nothing in a week cost nothing. `connectNulls` is Recharts'
own default and is asserted anyway, because a default is not a decision and a future version
flipping it should fail a test rather than change what the product claims.

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
- **T-C6 — The toolbar renders exactly this page's global controls** (R-C1, R-C6), and **no greyed
  control appears anywhere**. Table-driven over the six pages. **Amended again 2026-09-09 (ticket
  45)**: the claim about `/demo/projection` was "no toolbar renders at all", and R-N3.1 puts the
  as-of stamp in every bar. What is asserted there now is the half of R-N3 that carried the
  requirement — the bar renders and holds **no control**, and no link at all — so a page that
  quietly started offering a control its panels cannot use still fails here. Amended 2026-09-09: the claim used
  to read "only its declared controls", and the declared set was the whole of what a page could
  show. R-C6 split it, so both halves are asserted — the bar shows every toolbar control, in order,
  **and** no panel-local one — and a third assertion checks the lists are a *partition* of the
  declared set on every page, so a control cannot be dropped from all of them and pass every file.
  **Amended 2026-09-10 (ticket 63)**: the partition is now three-way — toolbar, panel-local and
  the table's own headings — and `/demo/people`'s bar is asserted as exactly three groups, period
  first, with no Sort menu and no "All data" among its periods. `sort` leaving the bar is only
  safe if it stays a parameter, so `schema.test.ts` asserts the round trip beside it: `?sort=-cost`
  parses, serialises and rebuilds the same href it always did.
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
- **T-C9.2 — Money is one formatter, and a table column reads in its own unit** (A31, R-N15,
  ticket 41). Unit: the money formatter renders a symbol, grouped thousands and **exactly** two
  decimals, and `usd(x)` equals the `usd` and `usd_per_task` tile formatters because it *is* them.
  Component: the People table's Cost cells match `/^\$[\d,]+\.\d{2}$/` and a column carrying no
  unit renders exactly as it did. E2E: the same shape, on the served page.

  **Ticket 69 adds the token half.** Unit: the formatter's band table and its boundaries — 999,
  1,000, 999,999, 1,000,000, 1e9 — with `999,999` reading `1M` rather than `1,000K`, because a
  mantissa that rounds to a full thousand promotes. Component: the People table's Tokens cells
  read `1.2M` / `980K` / `310K` and a billions row reads `2.1B`; the member profile's tile and
  comparator bar read the same figure the column does; `/demo/history`'s expanded row still
  renders full grouped integers, which is what makes T-C9.1's sum checkable; and both Adoption
  measure axes carry a unit letter on their ticks.
- **T-C9.3 — `Member.kind` reaches a reader as words** (A31). Component: no cell in the People
  table contains `service_account`; the Kind column reads "Human" and "Service account". E2E: a
  sweep of all six routes over **`innerText`**, not markup — the enum is legitimately a URL value
  in the kind filter's `href`s (R-C3), and what R-N15 governs is what a reader reads.
- **T-C12 — A chart inside a tile carries no furniture** (A30, R-V11). Asserted over
  `furnitureFor`, the one expression that decides it — the same shape of claim T-C11 makes over
  `stackIdOf`, and for the same reason: an SVG query would depend on jsdom, on a fixed dimension
  and on Recharts' class names, three ways for the test to go quiet without the rule breaking. The
  default arm is the control. Separately, at the panel: the acceptance multiples render five charts
  and **no legend entry**, and each still carries its R-X1 mirror.
- **T-C13 — `/demo/work`'s duration panel is one panel holding two charts** (R-N12 item 5, ticket
  41). The six panel headings are unchanged — the split must not turn R-N12's five into a six —
  the panel carries a median chart and a p95 chart, each with exactly one series and its own
  mirror column, and both magnitudes are stated in the figure strip above them.
- **T-C14 — A panel-local control stands in the header of every panel that reads it, and moving it
  changed no parameter and no URL** (A32, R-C6). Two claims, and the second is the one worth the
  file: placement is easy to assert and easy to get right, while what a rearrangement of this kind
  actually breaks is the *share link*. So the `href`s are asserted against `controlHref` — the one
  expression every control link in the product is built from — rather than against a string typed
  out in the test. The two-panel case (per-capita on Total spend and Cost by Repository,
  `execution_mode` on acceptance and duration) is asserted as an **equality between the two
  copies**, because the interesting failure there is not "one is missing" but "the two disagree
  about one query parameter". The guard is asserted too: a control the page does not declare
  renders nothing, so a panel shared across pages cannot smuggle one in.
- **T-C15 — The active-filter sentence** (A35, R-C7). Every phrase is asserted against a
  `ControlSet` parsed from a query string, so the sentence cannot drift from the controls. The off
  states are asserted as text — "all templates" is *in* the sentence when nothing is chosen — and
  the period and the sort are asserted **absent**. A page that filters nothing renders no element
  at all, which is the difference between absent and empty.
- **T-C16 — The shell nav is six links and no overflow** (A33, R-N2). The claim is an absence, so
  the six labels and `href`s are asserted as an ordered list first: without that, "no disclosure"
  passes against a nav that renders nothing. Secondary is asserted as a **weight** — the two
  secondary items carry a smaller type class and the four primary ones do not, and both secondary
  items are visible links reachable with no interaction.
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
  - **`projection_component` stacks** (ticket 64, R-N23.2): a day's attributed spend beside the
    remainder the method carries onto it. The two are outside each other by construction and
    their sum is the projected session cost exactly, which is the partition R-V1 asks for. The
    forecast mark's fill is asserted as a **pair** — the projected bar carries
    `chart-config.tsx`'s 40% alpha and the attributed bar beside it is solid — with a chart
    naming no forecast as the control, because "the projected bar is lighter" is only a claim if
    something is darker.
  - **The `/demo` WorkType tile is asserted `stackable: false`** (C11). WorkType partitions
    *sessions*; this tile counts *Tasks*, whose sessions may span WorkTypes, so the grouping does
    not partition this measure. The table is keyed on (grouping × measure), not on grouping alone —
    keying it on grouping is what let a true-of-sessions justification carry a Task-grained tile.
  - **The arithmetic is asserted, not just the flag**: the tile's slices are summed and asserted
    **greater** than the Completed Tasks tile against the committed fixture (162 against 150 for the
    open account in August 2026). A future change that made them equal would mean the measure had
    silently been re-keyed, and that should fail here rather than pass quietly.
- **T-C17 — The projection tiles print their components** (R-N23.1, R-M5). Both tiles render a
  `Session cost` / `Seat cost` pair under the headline, the seat figure is the **same string in
  both** because it is never extrapolated, and the arithmetic line carries the month's real
  numbers. R-N24's "one figure, no bound" claim is restated rather than dropped: the projected
  tile's money figures are exactly the headline and its two named components, so a fourth number
  fails the test. The seat charge is asserted **beside** the chart, never as a series in it.
  - **Ticket 64 restated R-V8's count as a claim about kind.** The marker now appears on the
    projected tile *and* on the daily chart's forecast series, which are the same forecast said
    twice. "Exactly once on the page" would have been satisfied by deleting one of them, so what
    is asserted instead is: exactly once among the two headline figures, and every other element
    carrying it is text that names the forecast — never an attributed figure. Beside it, the
    panel is asserted to give the chart two legend entries, to mark only the forecast one, and to
    render a day still to come as a projected figure on no attributed one, read off the R-X1
    mirror. That the two marks share a stack id is T-C11's claim, over `stackIdOf`.
- **T-C18 — A ranked ViewModel draws horizontal bars, whatever shape the panel named** (A36,
  R-V12, ticket 44). Asserted over `shapeFor`, the one expression that resolves a form into a
  shape — the same shape of claim T-C11 makes over `stackIdOf` and T-C12 over `furnitureFor`, and
  for the same reason: an SVG query would additionally depend on jsdom, on a fixed dimension and
  on Recharts' class names. Table-driven over all five shapes in both directions: a ranked chart
  overrides every one of them, and a series chart leaves every one of them alone — the second
  half is the control, without which the test would pass against a product that had forgotten
  `line` existed. Two further claims sit with it: a ranked chart's marks are `Bar` and not `Line`
  under a `layout="vertical"` chart, and its one-tick **category axis is hidden while the measure
  axis stays**, because one category carries no reading and the 120px gutter it reserves is what
  makes the bars short.
  - **The domain half is `src/domain/viewmodel.test.ts`'s**, over the real function: `form`
    defaults to `series`, a ranked chart transposes its mirror into one row per group in R-V5's
    order, the capped tail gets its own row summed out of the grid, and R-M18's absence survives
    the transpose. It has to be there — a component test may not import `src/domain` at runtime
    (R-T6) — and `src/data/queries.test.ts` closes the loop by asserting which *subject level*
    the query gives which form.
- **T-C19 — one interpolation, and no panel overrides it** (A37, R-V13, ticket 45). Three claims,
  and the third is the one worth the file. The constant is `linear`; every `line` and `area` mark
  is drawn with it; and **no module anywhere in `src/` names a curve of its own** — which is what
  "no panel overrides it" means, asserted as an absence over the source rather than as a promise
  from thirteen panels. A rendering assertion alone would pass against a product where one panel
  had quietly gone back to a spline, because that panel's chart is not the one rendered in the
  test. The absence is matched as the *shape of the prop* — `type=` followed by a curve name —
  rather than as the bare word, because `step`, `natural` and `linear` are English and appear in
  the prose of modules that draw nothing.
- **T-C20 — one sentence visible, and the fold keeps every word** (A38, R-V14, ticket 45). The
  second claim is the one that matters: "the panel shows one sentence" is satisfiable by
  *deleting* the other three, which is exactly what R-V14 forbids. So the assertion is the **round
  trip** — `lead` plus `rest` is the paragraph that was handed in, word for word — over
  `splitProse`, the one expression that decides the cut, in the same shape T-C11 asserts
  `stackIdOf` and T-C12 asserts `furnitureFor`. Its boundary cases are the ones that would cut a
  figure in half: `42.5`, `p95.` and `30 of 42.` are inside their sentences, because a terminator
  ends a sentence only when whitespace follows it. The rendering half asserts the disclosure is a
  native `<details>` with **no button and no handler**, that the folded paragraph is *in the
  document and not visible* while it is closed, and that clicking the summary reveals it.
- **T-C21 — the as-of stamp stands in the bar** (A39, R-N3.1, ticket 45). Table-driven over the
  six pages, including the one that declares no control. The stamp reads `Data to ` and an instant
  in the Organization's format, and it carries `data-session` — the id of the session it was read
  off — which is what lets T-E15 assert "matches the History top row" as an identity between two
  ids rather than as a coincidence between two formatted strings. An Organization holding no
  session renders **no stamp** rather than a blank one. What the value *is* belongs to T-U23.
- **T-C22 — the period axis thins and the legend wraps** (A40, R-V15, ticket 46). The two
  chart-layer halves of R-V15, asserted over the expressions that decide them — the same shape of
  claim T-C11 makes over `stackIdOf` and T-C12 over `furnitureFor`. The interval constant is
  `equidistantPreserveStart`; `furnitureFor` puts it on the period axis of all four period-shaped
  charts and on neither of a `horizontal-bar`'s axes; and the rendered legend row carries
  `flex-wrap`, asserted on the DOM rather than on the constant because the class has to survive
  shadcn's `cn` merge against `ChartLegendContent`'s own `flex` row to do anything.

  **The negative arm is the one that matters.** A crowded axis is a chart that is hard to read; a
  thinned *category* axis is a chart that lies, because the tick disappears and the bar it named
  does not. So the exclusion is asserted directly rather than left to follow from where the
  constant happens to be applied.

  **The e2e sweep cannot make either claim.** T-E17 asserts the document does not overflow, and
  both of these fit inside a chart that was already clipping them: Recharts' own
  `overflow: hidden` meant a legend running off both edges of the card cost nothing in scroll
  width and silently deleted two of five series names.
- **T-C23 — a root expands to the agents that worked it** (A41, R-N20.2, ticket 48). Three claims,
  and the third is the one that keeps the page honest. A row that fanned out to nothing renders the
  detail panel and **no** child list. A row that fanned out renders one list item per child, each
  with its own tokens, cost and Model mix — asserted on a *different* model from its root's,
  because a sub-agent that reached for a cheaper model is the reading this list exists for. And the
  list says the figures above already hold them, so nothing on the page invites a reader to add a
  child's cost to its root's. The fan-out is also named in the expander's accessible label, which
  is what lets T-E18 find such a row without knowing a session id.

---

## 5. E2E tests — Playwright, Chromium

**Small and structural.** Ticket 07 designed the surface to give the suite a clean target: *"one
request per account per route, asserting rows rather than pixels."*

**Two projects, one engine, one width each** (added 2026-09-09, ticket 46). `chromium` runs the
suite at the desktop viewport and `mobile-chromium` runs `mobile.spec.ts` at 390×844 — and only
that file, matched by `testMatch` with the desktop project excluding it by `testIgnore`. Running
every spec at both widths would roughly double the suite to re-prove claims a viewport cannot
change: rows, URLs, payload contents and mirror cells read the same at 390 as at 1440. What a
viewport *does* change is the one thing the new file asserts. The two existing tests that need a
second width — T-E7's breakdown tile and T-E12's toolbar — call `setViewportSize` themselves
inside the desktop project, which keeps each width beside the requirement it belongs to.

- **T-E1 — Every route renders for both accounts.** 6 authenticated routes × 2 accounts = 12
  navigations, asserting a page landmark and no error boundary. Navigation is identical for both
  (A9, R-A8) — asserted as an equality of nav item sets, not eyeballed.
- **T-E2 — The restricted account receives one row where the open account receives twenty**
  (A9, R-D18, C10). On `/demo/people`, **1 against 20** — the restricted account resolves no other
  Member by name, and C10 declined to restate its aggregated grant as a row in a table of named
  rows. A row count, not a screenshot.
- **T-E2.2 — `/demo/people` sorted by Tokens shows a spread** (R-D23, ticket 68). The column is
  ordered, every one of the twenty rows carries a figure, and the **top is at least ten times the
  median** — read off the rendered cells and parsed back through ticket 69's K/M/B units, with no
  token figure written into the test. The fixture is regenerated by every ticket in this wave, so
  a literal here would be a number to re-type rather than a property to check.
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

  **The scan is over *bare* decimals, and it excludes two things that only look like one**: a
  decimal inside an identifier (`gemini-3.1-pro`'s `3.1`, and `gpt-5.2`'s `5.2` since ticket 70)
  and a decimal a compact token unit sits
  on (`1.3M`, `9.8K`, `2.1B` — ticket 69, R-N15). A token volume is not a price, and the unit
  letter says so on the wire as plainly as on screen; without the second exclusion the Tokens
  column would fail this test on every page carrying one, because `1.3` is a real session cost in
  the committed fixture. Neither exclusion narrows the search for a leak: an escaped cost reaches
  the wire as `,24.39]`, `"24.39"`, `>24.39<` or `$24.39`, and every one of those still matches.
  **The scanner carries its own tests** — a cost literal found against each of those four
  wrappings, `1.3M` and `9.8K` yielding nothing, and `1.3` still found on its own so the exclusion
  is about the unit and not about the value. A search is only worth what it finds. **And a third
  positive control on the payload itself**: the restricted account's `/people` response carries a
  Tokens cell in compact units, so the exclusion is applied to a real figure on a real route
  rather than kept as a rule with nothing to match.
- **T-E5 — Control state does not survive navigation** (A20, R-C5). Set a period on `/demo/spend`,
  navigate to `/demo/work`, assert the default.
- **T-E6 — The account switcher identifies the acting account and links out** (R-A5 as amended
  by ticket 61). The menu names the acting Member and their Organization, holds **exactly one
  link** — to `/sign-in` — and **no `<form>` and no button**; following it lands on a `/sign-in`
  that still has one form and one submit, with a session already in place. Asserted for the
  restricted account too, from a directly minted token, which is R-A8's "same doors" at the one
  control that differs between accounts. (Previously cited "A5/R-A5"; A5 is the Team-overlap
  criterion and has nothing to do with the switcher. R-A5 was always the rule meant.)

  **It was "re-issues the token and stays on the current URL — same path, fewer rows".** That
  claim died with the mechanic: ticket 61 offers one account, so nothing in the header switches.
  The endpoint's in-place return path is unchanged and is still tested, at the unit layer, in
  `src/app/api/session/route.test.ts`. "Fewer rows on the same doors" survives in T-E1 and in
  `people.spec.ts`, both of which install the restricted token directly.
- **T-E7 — `/demo` renders four tiles and nothing else**, each linking to its evidence page (A1,
  A2). The one E2E test about layout, because "nothing else" is a structural claim about the page.
  **Three tiles carry a headline figure, not four** (R-N8, C11): the WorkType tile carries a title,
  a breakdown and a link, and asserting a figure on it would re-admit the duplicate C11 removed.
  Four further claims about the page belong here for the same reason — they are about the whole
  document, or about the running control:
  - **The tile order is R-N4's**, breakdown third, and the titles are asserted as a list rather
    than searched for.
  - **The period control offers the fixture's months and no "All data"** (R-N6). The whole offered
    list is asserted, so an extra option fails; `?period=window` is asserted to drop to the current
    month here and to be honoured on `/demo/spend`, because "on this page only" is the requirement.
  - **The month in progress carries four flags and no percentage; a finished month carries three
    percentages and no flag** (C13). Both halves, because either alone passes against a page that
    simply lost its change figures.
  - **The breakdown tile draws five labelled bars at 1440px and at 390px**, with no axis element
    at all and every label inside the card. R-N8 states the narrow width, and a clipped label is a
    failure that only appears at one of the two.
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

- **T-E10 — A zero denominator survives the whole stack as an absence** (A29, R-M18, R-V10). The
  restricted account, `/demo/spend?grain=week`, the R-X1 mirror of Cost per completed Job: week 15
  holds an em dash. It is at this layer because every other layer proves a piece — the rule
  (T-U22), the mirror (T-C1.1) — and none of them proves the absence survives the permission
  filter, the bucketing, the ViewModel, the RSC boundary and the renderer to arrive on a running
  page. A week the same account *did* finish work in is asserted to still carry its figure, so a
  panel that rendered nothing could not pass.
- **T-E12 — The controls stand where R-C6 put them, and the URLs did not move with them** (A32,
  A33, A35). At **1440px**, because that is the width R-C6 is stated at: the global bar on
  `/demo/spend` holds five groups and one row, measured against the height a single row occupies
  rather than eyeballed. Each moved toggle is found inside its panel's `region`, and asserted
  absent from the bar. The URL after a toggle click is asserted as a **literal** — `?per_capita=1`,
  `?accepted=accepted`, `?model_level=tier` — because "unchanged from today's" is a claim about
  specific strings and a comparison against the code would pass whatever the code did. The nav is
  swept over four routes for six links, no button and no "⋯", and the active-filter sentence is
  read off two different query strings.
- **T-E13 — `/demo/history` applies its date range on change** (A34, R-N20). The unit layer proves
  the form *asks* to submit and that an incomplete or out-of-window edit does not
  (`auto-submit-form.test.tsx`); only a browser can prove it answered, wrote the query string and
  re-rendered. The carried filter is asserted in the same navigation, because a `GET` form replaces
  the query string wholesale and dropping the page's other parameters is how this feature breaks.
- **T-E11 — The projection's four numbers are on the page and sum** (R-N23.1). Read off the
  rendered text of `/demo/projection`: session cost to date, the seat charge, the projected
  session cost and the projected total, with the two totals equal to their components to within
  the cent the strings are rounded to. The exact identity is T-U21.1's; what this test adds is
  that the figures a reader can *see* are the ones it holds between.
  - **And the chart says the same thing** (R-N23.2, ticket 64). The daily chart's R-X1 mirror is
    read column by column: its attributed column sums to the session cost to date and both
    columns together sum to the projected session cost, over every civil day of the month. The
    tolerance is the mirror's own rounding — sixty cells each rounded to the cent — and it is the
    only loose comparison in the chain, because every layer below asserts the identity exactly.
    This is the step that proves the two series survive the RSC boundary with the figures the
    tiles above them print, which no unit layer can see.
- **T-E14 — Ranked bars and monthly repositories survive the whole stack** (A36, R-V12, R-N9.1,
  ticket 44). Every layer below proves a piece — the domain layer decides what a ranked table is,
  the query decides which subject level is ranked, `shapeFor` decides what that draws — and none
  of them proves the decision reaches a running page through the RSC boundary and past the shape
  the panel itself named. So: `/demo/spend?subject=member` renders **no line series at all** on
  Cost per completed Job and one bar per Member, its mirror has one row per Member headed by
  "Member" with "Other" last, and `/demo/spend?grain=week` puts month keys in Cost by
  Repository's mirror while the panel beside it still carries the page's weeks.

  **Both halves carry their control**, because each claim is an absence: `?subject=team` is
  asserted to still draw a line and still head its mirror "Period", and Cost per session is
  asserted to still be on weeks. Without them a page that had simply lost its charts, or one that
  had stopped honouring its grain control at all, would pass the file.
- **T-E15 — the as-of stamp reaches every surface, and is checkable** (A39, R-N3, R-N3.1, ticket
  45). Every layer below proves a piece — the domain layer decides which session is the dataset's
  edge, `clock.ts` prints it in the Organization's timezone, the toolbar renders it — and none of
  them proves the same string reaches all **six** routes, or that the claim can be *checked*. So:
  the stamp is in the `page-toolbar` of all six and names one instant across them; on
  `/demo/history` it equals the top row's **Started** cell and carries that row's own session id;
  it **does not move** when a filter narrows the page, because it is the dataset's edge and not
  the selection's; and the restricted account is told the same thing, because a freshness claim
  carries no cost, no name and no count.
- **T-E16 — a panel states one sentence and folds the rest** (A38, R-V14, ticket 45). At the
  panel, over the two panelled surfaces: every panel prose block shows exactly **one** visible
  paragraph, a named panel on each page carries exactly one such block, the "Why this number"
  disclosure exists on more than one panel per page, and opening the first one reveals prose
  rather than a stub. Asserted through the prose block rather than over every `<p>` in the panel,
  because a panel's **figures** are paragraphs too — the acceptance multiples print a rate and a
  denominator above each tile's sparkline, and neither is prose.
- **T-E17 — no surface scrolls sideways on a phone** (A40, R-V15, ticket 46). At 390×844, for
  each of the six authenticated routes, `document.documentElement.scrollWidth <= 390`. It is one
  number per route and it is the whole claim: a page that overflows by a pixel and a page that
  overflows by four hundred fail the same assertion, and no screenshot is compared. The failure
  message names the three widest elements in the document, so a red run says *what* to fix.

  **It is at this layer because there is no other.** Layout is the one thing this product asserts
  that jsdom cannot answer at all — it computes no geometry, so a component test can read a class
  name but never a width. And it is the whole document rather than the elements under it,
  deliberately: a table that overflows *inside its card* is the design (R-V15), and only the
  overflow that reaches `<html>` is the fault.

  **Four claims stand beside the sweep, because each is a mechanism the sweep would not notice
  going wrong.** A nav that fits because two items vanished passes a scroll-width assertion and
  breaks R-A8, so the six links are asserted **visible** at 390 with no button and no "⋯", and
  the nav is asserted not to overflow its own row — a nav that scrolled instead would leave the
  document 390px wide and two of R-N1's surfaces off the edge of a bar nothing says can scroll; the
  account switcher is asserted to have dropped its name and to still open and still offer both
  accounts; `/demo/history`'s table is asserted to **really scroll** — `scrollWidth >
  clientWidth` on the card, so a card that merely clipped its columns would fail; and the
  restricted account is swept over `/demo/people`, whose visibility sentence and one-row table are
  markup the open account never renders.

- **T-E18 — `/demo/history` expands a root to the agents that worked it** (A41, R-N20.2, ticket
  48). The one surface where the session tree is visible as rows; everywhere else the fan-out is
  already inside the figures (R-M19). The row is reached through the expander's own label — which
  names its fan-out — rather than through a session id, so the test survives a regenerated fixture.
- **T-E19 — no surface names an instant later than `now`** (A42, R-D2, R-N3.1, ticket 62). The
  layers below each prove a piece — the slice drops an unfinished session, the window ends on
  `now`'s civil day, the projection reads the rows its own chart draws — and none of them proves
  that the *served document* carries no instant from the future. A page composes eleven query
  results and a toolbar, and a row from the future is exactly the kind of thing that survives
  every unit test and appears on the page.

  So: over all six routes, every instant the document prints — matched as the one shape the
  product's single instant formatter writes, `YYYY-MM-DD HH:MM` — is at or before `now`, with the
  as-of stamp guaranteeing each route prints at least one. On `/demo/history` the Started cells
  are checked directly and T-E15's identity is re-asserted under the pin, because the stamp is the
  last session to *end* and the top row the last to *start*: cutting the rows moves both, and they
  have to move together. The period menu offers no month past `now`'s, and the date inputs' `max`
  is its civil day.

  **The pin is what makes the claim checkable.** `playwright.config.ts` sets `AGENT_DASH_NOW` on
  the server it spawns (`e2e/support/now.ts`), so "later than `now`" is a comparison against a
  literal the suite knows rather than against whenever it happened to run — and every other
  figure the suite asserts becomes a property of the product instead of a property of today. The
  variable is server-side, is set in no committed production config, and is absent on Vercel.
  `e2e/support/fixture.ts` restates the same cut for T-E4's search set, beside R-M2 and R-M19,
  for the reason that file's header gives: what a test *allows* must describe the population the
  page renders.

- **T-E20 — the Model mix draws the whole roster, as a share over time** (R-V7 as amended, R-D17,
  ticket 70). Three layers below prove pieces and none proves the whole: `series.ts` makes a
  palette a cap, `viewmodel.ts` decides which palette a `model` grouping takes, `adoption.ts`
  decides the measure. Only a running page shows that **ten Models arrive in the legend** — that
  the amended cap survived the query, the RSC boundary, the panel's named shape and Recharts —
  and that no "Other" is folded out of a roster the reader is choosing between.

  The legend is read through the swatches' accessible names (`chart-config.tsx`'s
  `legendIconLabel`), and asserted at all three roll-up levels against counts derived from the
  committed `models.json` — ten, eight, three — never typed out. The chart is asserted to hold
  **no bar mark at all**, which is the geometry the ticket replaced. The figures come off the
  R-X1 mirror (P2): at month grain `claude-haiku-4-5` reads **at or below 12%** in the last
  column and at least ten points higher in the first, and `claude-fable-5-1` reads a measured
  **0** in April and above 5% at the close — R-D17's two halves, on the served page.

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

  **R-D17 is asserted in the direction ticket 70 gave it**: the frontier tier's share **rises**
  every month and by at least ten points across the window, and `claude-haiku-4-5` fades by at
  least ten points and ends at or below 12%. The frontier set is read off `models.json` rather
  than named, so a roster edit that moved a model between tiers fails here.
- **T-F5 — Both accounts have real sessions** and their views differ (R-D18).
- **T-F6 — Timezone edge rows exist** — sessions between 22:00 and 24:00 Europe/Madrid (R-D5).
  Without this, T-U1's sharpest case has no data.
- **T-F7 — Every Task key is `owner/repo#number`** and resolves to a Repository in the fixture; no
  key is synthetic or absent (R-T10 adjacent, `CONTEXT.md` § Work).
- **T-F8 — Every GitHub user matches a Member** (R-D20). The join is authored; an unmatched user is
  an unreachable state and must not appear.
- **T-F9 — The committed output matches the seed** (R-T21). CI regenerates into a temp directory
  and diffs. The only place the generator runs in CI.
- **T-F10 — The session tree** (R-M19, R-D21, ticket 48). Over the raw JSON: ~20% of visible roots
  carry one to four children; every child's parent **exists, is a root, and shares the five
  inherited labels**; no child carries `accepted`; a child is hidden exactly when its root is; and
  every child is nested inside its root's window — started after it, ended before it. The fan-out
  leans toward `implementation` and `headless`, asserted as a share against the root population
  rather than as a count, so the lean is a property of the draw and not of the fixture's size.
- **T-F11 — The review linkage** (R-D22, ticket 67). Over the raw JSON: every `implementation`,
  `bugfix` and `refactor` root's `task_key` carries at least one `review` root; reviews number at
  least 1.22× that population and some Tasks carry two; refactors run at 17% of implementations
  and bug fixes at 29%; **no review is run by a Member who ran a reviewed session on that Task**,
  every review starts between ten minutes and four days after one of them ended, and over 80% of
  them are run by somebody on the author's own Team. Re-derived from the committed files, never
  from the generator (P3).

- **T-F12 — The token scale** (R-D23, ticket 68). Over the raw JSON: **no root session carries
  fewer than 75,000 tokens** except R-D11's ~20 CPU-heavy ones, which are the named exception and
  are counted rather than assumed; the median human Member-month over the four months lying
  wholly inside the window is **80–130M**, pooled, and each of those months' own median is inside
  ±45% of 100M; the busiest human Member-month in each of the last three of them is **above a
  billion**; and the busiest is at least **10× the median**, which is the spread `/demo/people`
  sorted by Tokens exists to show. Member-month figures roll a child's tokens into its root's
  month (R-M19), which is the population every surface reads.

**Literal counts in the fixture tests are the ones the *schedule* fixes, and no others** (ticket
67). The visible root count, April's session count, the twenty Members and the $4,212 of seats
are authored or structural and stay written down. Everything a WorkType mix can move — Task
counts, child counts, order statistics, money totals, per-bucket tallies — is re-derived from the
rows in the test that reads it. A literal that a fixture change re-types is a literal that has
stopped checking anything.

**The same rule reached T-E4's three named cost literals** (ticket 68). `23.20`, `9.16` and `0.8`
were measurements of one fixture, re-typed by every ticket that regenerated it, and what they
checked was never the value: it was that each subtraction class is non-empty and that removing it
does not reach the costs a leak would be made of. `e2e/support/costs.ts` now derives all three
classes from the committed rows — the dearest ungranted session for the probe, and the two
collision sets for the exclusions — and `payload.spec.ts` asserts over the sets.

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
| **Visual regression / screenshots** | High maintenance, low signal on a fixture-backed dashboard. The structural claims are asserted directly — including R-V15's, which is a **number** (`scrollWidth`) and not an image, so T-E17 is not an exception to this row |
| **Widths between 390 and 1440** | The product is stated at two widths and asserted at both (R-V15, T-E17, T-E12). The tablet range is unspecified, so there is nothing there to assert against |
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
| A5 Team totals exceed Org; overlap stated | T-U6, T-U28, T-C8 |
| A6 Per-capita excludes service accounts | T-U7, T-U30 |
| A7 00:30 Madrid buckets to the local day | T-U1, T-U8, T-U29, T-F6 |
| A8 Change suppressed iff the prior period is zero, or either period is incomplete | T-U3 |
| A9 Restricted account: fewer rows, same nav | T-E1, T-E2 |
| A10 No ungranted figure in the payload | T-E4, T-U10 |
| A11 Org mismatch → 404 | T-E3 |
| A12 Stacking only where the grouping partitions the measure; no pie | T-C11 |
| A13 Cap engages above five, not at five | T-U11, T-U34 |
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
| A29 A zero denominator is an absence, never a zero | T-U22, T-U31, T-C1.1, T-E10 |
| A30 A tile chart carries no axis, tick, grid or legend | T-C12 |
| A31 One money formatter; no raw `Member.kind` enum on screen | T-C9.2, T-C9.3 |
| A32 Panel-local controls stand where they are read, on the same parameters | T-C14, T-E12 |
| A33 Six nav links, no overflow | T-C16, T-E12 |
| A34 The history date range applies on change | T-E13 |
| A35 Every controlled page states its active filters | T-C15, T-E12 |
| A36 `subject=member` is ranked bars with a transposed mirror; Cost by Repository reads months | T-C18, T-C1, T-E14 |
| A37 One interpolation, named in one place and overridden nowhere | T-C19 |
| A38 One visible sentence per panel; the rest folded, verbatim | T-C20, T-E16 |
| A39 The as-of stamp on every surface, matching the History top row | T-U23, T-C21, T-E15 |
| A40 | Every route fits a 390px phone; nothing is hidden to make it fit | T-E17, T-C22 |
| A41 | A child session rolls up into its root, is no attempt of its own, and is a row on `/demo/history` alone | T-U24, T-U25, T-U32, T-U33, T-C23, T-E18, T-F10 |
| A42 | The product reads the data cut at `now`, sliced once, with no per-query filter | T-U35, T-U23, T-E19, T-E15 |
| A43 | Every Job that was built is reviewed on its own Task, by somebody else, and a review is neither Rework nor Decomposition | T-U15, T-F11 |

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
