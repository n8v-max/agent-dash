Type: implementation
Status: resolved
Blocked by: 51
Label: resolved

# Mutation score on `src/domain`, once

## Scope

Add Stryker with the Vitest runner, scoped to `src/domain/**`. Run once locally. Record the score,
the surviving mutants by module, and the run time in this file. Add a `pnpm test:mutation` script.
No CI gate. Fix any survivor that reveals a missing test in under thirty minutes; list the rest.

## Done when

Score recorded here and in README § Test posture.

## Comments

### 2026-09-09 — implemented (AFK build, wave 11, worktree `agent-dash-t52`)

`lint` 0 errors · `typecheck` clean · `test` **1389** across 63 files · `test:coverage` 98.4% /
88.9% · `build` clean · `PORT=3121 pnpm e2e` **152 passed**. `pnpm test:mutation` is **not** a
gate and is not in `.github/workflows/ci.yml`.

**Score: 96.18%** — 1,306 killed + 4 timed out of **1,362 mutants** over the 16 production
modules of `src/domain/**`, in **7 minutes 7 seconds** wall (10-core M-series, `concurrency: 6`).
Adjusted for the four runner artefacts named below, the honest figure is **96.48%**.

Stryker 10.0.0 with `@stryker-mutator/vitest-runner`, `coverageAnalysis: "perTest"`, configured in
`stryker.config.mjs`. Run twice: once to take the measurement, once to confirm what the tests
written against it actually killed. Both runs are recorded — the first is the reading this ticket
is about, the second is the receipt.

| | mutants | killed | timeout | survived | no coverage | score |
|---|---|---|---|---|---|---|
| **first run** (the measurement) | 1362 | 1272 | 6 | 83 | 1 | **93.83%** |
| **second run** (after the fixes) | 1362 | 1306 | 4 | 52 | 0 | **96.18%** |

Run time was 8m46s and 7m07s; the dry run is 23s of it. 39.6 tests per mutant on average, because
the runner's `related` mode narrows each mutant to the test files that import the module.

#### By module, second run

| module | score | killed | timeout | survived |
|---|---|---|---|---|
| `aggregate.ts` | **100.00** | 117 | 0 | 0 |
| `ratio.ts` | **100.00** | 5 | 0 | 0 |
| `sessions.ts` | 98.77 | 80 | 0 | 1 |
| `access.ts` | 97.81 | 134 | 0 | 3 |
| `metrics/efficacy.ts` | 97.39 | 112 | 0 | 3 |
| `series.ts` | 97.37 | 74 | 0 | 2 |
| `observation.ts` | 96.55 | 28 | 0 | 1 |
| `metrics/duration.ts` | 96.39 | 80 | 0 | 3 |
| `change.ts` | 96.15 | 75 | 0 | 3 |
| `viewmodel.ts` | 96.05 | 146 | 0 | 6 |
| `periods.ts` | 95.90 | 230 | 4 | 10 |
| `metrics/spend.ts` | 95.19 | 99 | 0 | 5 |
| `comparability.ts` | 92.86 | 39 | 0 | 3 |
| `metrics/projection.ts` | 90.48 | 38 | 0 | 4 |
| `metrics/adoption.ts` | 85.96 | 49 | 0 | 8 |

**Ticket 51's seven hand-mutations are confirmed, not contradicted.** `aggregate.ts` (`rollUp`,
`isSeatHolder`) and `ratio.ts` (`ratio`) are at 100% — every mutant Stryker could write in them
died. `capSeries` (`series.ts`), `rollUpSession` (`sessions.ts`) and `taskFacts` (`efficacy.ts`)
each carry survivors, but **none of them is in those functions**: `series.ts`'s two are on a dead
field of the "Other" bucket, `sessions.ts`'s is an empty-input fast path, and `efficacy.ts`'s three
are in `lastEndOf` and `bucketFor`. `bucketRows` likewise has no survivor; `periods.ts`'s ten are
all in range validation and civil-date parsing.

### `src/domain/testing/**` is excluded from mutation

Decided here and written into `stryker.config.mjs`. Those four files are ticket 51's fast-check
generators — test helpers that live under `src/domain` only because the coverage thresholds walk
that directory. Nothing asserts what they emit, so **every mutant in them survives by
construction**: a generator that draws a different distribution is still a valid generator. Adding
them would have inflated the denominator with roughly 300 mutants no test could honestly kill and
dropped the headline score by about ten points while telling a reader nothing. The cost of the
choice is that a generator which quietly stopped producing its interesting case is not caught
here; ticket 51's `tally` counters are what catch that, and they are in the property file itself.

### Four survivors are a measurement artefact, not a gap

**A mutation that makes a test file fail to *collect* is scored as survived.** Vitest reports the
file as failed but reports **no failing test**, and the runner reads the empty result set as "no
test caught it". Confirmed by hand on all four, one at a time, against the real suite:

| survivor | what the suite actually does |
|---|---|
| `projection.ts` L131 — `projectPeriodSpend`'s whole body → `{}` | `projection.test.ts` fails to collect; 0 of its tests run |
| `duration.ts` L65 — `spansOf` → `() => undefined` | 3 test files fail to collect; 114 tests never run |
| `comparability.ts` L116 — the `peers` map arrow → `() => undefined` | 2 test files fail to collect |
| `comparability.ts` L124 — the `artefacts` map arrow → `() => undefined` | 2 test files fail to collect |

All four are caught by the suite. None is a missing test, and **no test was written for them** —
writing one would be writing a test for a reporting bug. They are why the honest score is 96.48%
rather than 96.18%, and why a mutation score should be read with its survivor list open rather
than as a number on its own.

### What was fixed — three real gaps, about 25 minutes

Each was confirmed by hand before a test was written (apply the mutation, run the suite, watch it
pass) and after (watch the new test fail). No production code was touched.

**1. The table sort was asserted by three rows that could not tell the comparator apart.**
`viewmodel.ts`'s `compareValues` / `compareCells` carried 17 survivors and the run's only
*no-coverage* mutant. The existing fixture is three rows holding `3`, `9` and `null`: every value
positive, so a comparator that **adds** the two values instead of subtracting them lands on the
same order, and `"3"` and `"9"` sort as text the way the numbers do, so a comparator that never
does arithmetic at all also passes. `null` appeared once, on the last row and the last key, so
"withheld sorts last" was true of the input before the sort ran. Four tests added to the same
`describe`, none of them touching the existing four: a numeric column ranked `12 · 7 · 3 · 0` —
where the *text* order is the reverse of the number order — asserted in both directions; two
withheld rows keyed ahead of the figures and handed over out of key order, so sinking them,
floating them and tie-breaking them are three distinguishable answers; the unknown-column case
handed rows in reverse key order, so "as built" and "by key" are no longer the same list; and
`empty` asserted `false` on a populated table, which R-V9 only ever asserted from the empty side.
Kills 16 of the module's 22 survivors, 14 of them inside the comparator itself.

**2. The ISO week key had never met the turn of the year.** `periods.ts`'s `isoWeekKey` reads the
week-numbering year off the week's **Thursday** — the module comment says so and says why — and
`partsOf(monday + 3)` → `partsOf(monday - 3)` survived, as did dropping the `padStart` that makes
a single-digit week `W01`. Both are invisible inside the fixture window (2026-04-12 … 2026-09-08,
weeks 15–37, no year boundary). Two tests over the week beginning Monday 2025-12-29, whose Thursday
is 2026-01-01 and which is therefore `2026-W01` including its three days in 2025.

**3. `priorMonthStart` had no direct test at all.** It is reached only through
`src/data/queries/context.ts`, over April–September dates, so 15 mutants survived in nine lines:
the January year-rollover (`year - 1` → `year + 1` and both arms of both conditionals), the
`month < 1 || month > 12` guard in every operator it has, and **both anchors of its regex**. The
anchors matter here and are unguarded: unlike `parseCivilDate`, which round-trips through
`civilDateOf` and so rejects a malformed date twice, this function's regex is the only check —
`"2026-05-12T00:00:00Z"` would have been accepted and the range silently widened off it. Four
tests, killing 14 of the 15; the fifteenth is the year's `padStart`, equivalent and listed below.

Together these killed **32 survivors**: `viewmodel.ts` 22 → 6, `periods.ts` 26 → 10.

### The 52 that remain, with a judgement each

**Equivalent — the mutation cannot change what the program does.**

- `sessions.ts` L168 — `if (children.size === 0) return sessions` → `false`. An empty-input fast
  path; the general path returns the same rows. Verified by hand: 471 domain tests still pass.
- `viewmodel.ts` L428 — `sign * compareValues(…)` → `sign /`. Division preserves the **sign** of
  every non-zero comparison and `Array.prototype.sort` reads nothing but the sign. It differs only
  on an exact tie, where the outcome is decided by V8's comparator-call order rather than by the
  comparator, and pinning that would be pinning V8.
- `viewmodel.ts` L415 ×2 — `typeof left === "number"` → `true`, and the same for `right`. Each
  leaves the *other* half of the conjunction deciding, so a homogeneous column behaves identically.
  Only a column mixing text and numbers would tell them apart, and no measure produces one.
- `viewmodel.ts` L415 — `&&` → `||`. Same reason: distinguishable only by a mixed column.
- `periods.ts` L60 ×2 — the `^` and `$` of `CIVIL_DATE_PATTERN`. `parseCivilDate` validates twice,
  and the second check (`civilDateOf(day) === text`, an exact round trip) rejects everything the
  anchors do. The anchors are belt to the round trip's braces. **Contrast `priorMonthStart` above,
  where the same mutation is load-bearing and is now killed** — the same mutation is a gap in one
  function and equivalent in the other, which is the whole argument for reading survivors
  individually.
- `periods.ts` L156 — the body of `} catch { return undefined; }` → `{}`. An empty catch returns
  `undefined` too.
- `periods.ts` L302 — `String(priorYear).padStart(4, "0")` → `padStart(4, "")`. Equivalent for
  every year with four digits, which is every year this product can hold.
- `metrics/spend.ts` L190 — `[SEAT_BEARING]: true` → `false`. The brand is a **key**; nothing reads
  its value. Only the presence of the symbol carries the R-M5 gate.
- `metrics/efficacy.ts` L215 — `let latest = ""` → a sentinel. The initial value is observable only
  over an empty group, and the comment above it records why a group is never empty: a row is what
  creates it.
- `observation.ts` L65 — `row.id < best.row.id` → `<=`. The two differ only when two *distinct*
  rows share an id.
- `metrics/efficacy.ts` L219 — `at >= latestAt` → `>`. Differs only between two sessions on one Task
  ending at the same instant, and then only if the two rows spell that instant differently.
- `series.ts` L238 ×2 — the `total` of the "Other" tally. `paint` reads `key`, `label` and `values`
  and never `total`, and "Other" is appended *after* the ranking, so its total orders nothing.
  **The field is dead for this one tally.** A test asserting it would be asserting a value no
  surface can reach; deleting it is production work and belongs to whoever next opens `series.ts`.

**Copy, not arithmetic — a test here would pin wording, which is what these mutants are for.**
Nine string-literal survivors, all in operator-facing messages: `change.ts` L224, `periods.ts`
L324/L329/L334, `metrics/spend.ts` L168/L177, `metrics/projection.ts` L137/L146, and
`metrics/duration.ts` L199/L200. Every one of them sits on a result whose *shape* is asserted —
the rejection reason, the `ok: false` discriminant, the presence of a note. `duration.ts` L199/L200
is the one worth a second look: A27 asks that the composition "say so", and the two fragments a
mutant can empty are the middle of a three-part sentence whose first part is asserted. Pinning the
rest would freeze prose in a unit test, and T-C1 reads that sentence through the DOM.

**Real, narrow gaps — listed, not fixed, because none is a rule the product states.**

- `metrics/adoption.ts` L141 — `entry[tokenClass] < 0` → `<= 0`. No test hands the disjointness
  evidence a class holding exactly zero, so "zero is not negative" is unasserted.
- `metrics/adoption.ts` L142 ×2 — the `witnesses` counter's `<` and its `+`. Same shape: evidence
  arithmetic exercised only on data that satisfies it.
- `metrics/adoption.ts` L205/L206 ×4 — `MODEL_LEVELS.every(…)` → `.some(…)`, and the `&&` inside
  it. The `partitions` flag is only ever computed over levels that **do** partition, so nothing
  distinguishes "all of them" from "one of them". Killing these needs a deliberately broken
  distribution, which is fixture-fault work and belongs beside `disjointness`.
- `metrics/projection.ts` L142 and `periods.ts` L232/L389 — three `x === undefined` guards →
  `false`. Each protects against a parse that already failed upstream; no test reaches the site
  with the failure in hand.
- `periods.ts` L372 — `endExclusive - 1 > validated.lastDay` → `false`, one clause of the
  right-hand clip. The other clause is asserted, so the bucket is still clipped; what is unasserted
  is that *this* clause is the one doing it.
- `metrics/spend.ts` L151 ×2 — dropping the `.sort` from the distinct-key list. Nothing asserts
  the order of that list.
- `metrics/efficacy.ts` L342 — the age-bucket search always returning the first bucket. Every
  Incomplete Task the tests carry is young enough to land there, so the half-open edge between
  buckets is unexercised.
- `change.ts` L155 — `prior?.partial ?? false` → `?? true`. No comparison is made against an
  **absent** prior period while the current period is complete.
- `change.ts` L191 — `prior: prior ?? null` → `prior && null`. Nothing asserts that the prior
  period travels onto the result when there is one; the tests read the suppression reason instead.
- `access.ts` L239 — `membership.get(id) ?? []` for a Member on no Team. Ticket 51 already recorded
  that population as one the committed fixture cannot produce (R-D14).
- `access.ts` L162 ×2 — `SELF_ONLY_ROLE`'s `key` and `name`. The constant's labels are read through
  the sign-in flow (T-E1/T-E2), never in a unit test.
- `comparability.ts` L99 — `NO_ARTEFACTS = []` → a sentinel. The fallback for a WorkType key absent
  from the catalogue; the key union is closed, so it is defensive rather than reachable.
- `viewmodel.ts` L233 — dropping the `?.` on `grid.get(group)`. Same shape: the groups come from
  the grid, so the miss cannot arise.
- `viewmodel.ts` L273 — `set.other?.keys ?? []` → a sentinel. The fallback when the cap did not
  engage; the mirror sums an empty tail either way.

**None of the 52 was papered over.** No test in this ticket exists to kill a mutant: each of the
three fixes states a rule (a numeric column ranks by number; a withheld figure sinks; a week
belongs to its Thursday's year; a widened range is a real month) that a reader would want asserted
whether or not Stryker had a name for it.

### Decisions taken without asking

**`pnpm test:mutation` is `stryker run` and nothing else — no threshold flag, no `--incremental`.**
Stryker can fail a build under a score; that switch is deliberately not set, and the config says
why in a comment. The ticket asks for no CI gate, and a threshold in the local script is a gate
waiting for someone to wire it up. Cost: a future regression in the score is invisible until
someone runs it. That is the trade the ticket names.

**`concurrency: 6` and `timeoutMS: 10000` are written into the config rather than left default.**
Six vitest instances on ten cores is what produced the 7-minute run; the default would have used
more of the machine and, on a shared laptop, produced timeouts that are really contention. The
timeout is raised from Stryker's 5s default because `periods.ts` iterates day ranges, so an
off-by-one in a loop bound is *slow* rather than wrong, and a tight budget scores those as killed
for being slow. Four mutants still time out at 10s; those are genuinely non-terminating, and a
timeout is a kill.

**Stryker's plugins are named explicitly (`plugins: ["@stryker-mutator/vitest-runner"]`).** The
default `@stryker-mutator/*` glob does not resolve under pnpm's non-flat `node_modules` — the
runner child process dies with "no TestRunner plugins were loaded". Cost: a future plugin has to be
added to the list.

**No spec file was edited, and no new test identifier was allocated.** The three fixes are added
assertions inside existing `describe` blocks (`viewmodel.test.ts`) or new blocks in the style of
`periods.test.ts`'s own un-numbered `describe("civil days, …")`. `T-U*` runs to T-U34 and `T-Q*` to
T-Q3, both verified free by grepping every `.md`, `.ts`, `.tsx` and `.mts` in the repo; **nothing
new was taken**, so no collision is possible. `testing-spec.md` § 8 has no mutation row: the cheaper
option was to leave the spec alone and record the reading here, where the survivor list is.

### The README dependency, for ticket 49

**Ticket 49 owns § Test posture; nothing was written to `README.md` here** (it does not exist yet,
and 49 writes it last). Its scope item 6 already names "mutation score (from ticket 52)". The line
to carry over:

> **Mutation score: 96.18% over `src/domain/**`** (1,362 mutants, Stryker 10 with the Vitest
> runner, `pnpm test:mutation`, ~7 minutes). Not a CI gate. The surviving mutants are listed with
> a judgement each in `.scratch/agent-dash/issues/52-mutation-testing.md`.

Ticket 49 should quote the figure and the link, not re-run the tool: a score printed without its
survivor list is the number this ticket exists to argue against.

### Left undone

- The score is a snapshot. Nothing re-runs it, so it will drift from the moment the next module
  lands. A nightly or weekly job — not a gate — would keep it honest and has no owner.
- The four collection-failure artefacts are a bug in how the vitest runner reads an errored test
  file. Worth reporting upstream; not done here.
- `series.ts`'s `Tally.total` is dead for the "Other" bucket. Deleting it is production work this
  ticket had no mandate for.
- `metrics/adoption.ts` scores lowest (85.96%) and six of its eight survivors are in the two
  *evidence* functions (`disjointness`, `partitions`). They can only be killed by data that
  violates the property they evidence, which is a fixture-fault exercise in the shape of ticket
  53's, and is the single highest-value follow-up this run identified.
