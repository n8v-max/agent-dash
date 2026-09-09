Type: implementation
Status: resolved
Blocked by: 40, 48
Label: resolved

# Property tests on aggregation invariants

## Scope

Add `fast-check`. Generators for sessions, members, teams, periods in `src/domain/testing/`.
Properties, each its own test:

1. Sum of Team figures ≥ Organization figure, for every additive measure.
2. Period buckets partition the range: no gap, no overlap, in the Organization timezone.
3. Per-capita denominators never count a service account.
4. A ratio is null iff its denominator is zero.
5. Rework ⇒ the Task has ≥2 root sessions; Decomposition ⇒ ≥2 accepted roots.
6. Root cost = own cost + Σ children cost; total cost is invariant to child grouping.
7. Top-N + Other sums to the ungrouped total.

## Done when

All seven pass at 200 runs each in CI. Any failure records the shrunk counterexample in this file.

## Comments

### 2026-09-09 — implemented (AFK build, wave 10, worktree `agent-dash-t51`)

`lint` 0 errors · `typecheck` clean · `test` **1359** across 62 files · `test:coverage` 98.3% /
88.8%, and the four new generator files at **100% lines and 100% branches** each · `build` clean ·
`PORT=3111 pnpm e2e` **152 passed**.

**What landed.** `fast-check@4.9.0` as a dev dependency; generators in `src/domain/testing/`
(`population.ts` — Members and Teams, `sessions.ts` — sessions and trees, `periods.ts` — timezones,
grains, ranges and instants, `series.ts` — buckets and keyed rows); the seven properties as seven
`it`s in `src/domain/properties.test.ts`, **200 runs each**, allocated **T-U26…T-U32**. Spec:
`testing-spec.md` gains § 3.5 naming all seven, and six rows of § 9 (A5, A6, A7, A13, A29, A41)
gain their property alongside the example-based test that already owned them. The IDs were checked
free before allocating — `T-U*` ran to T-U25, `T-C*` to T-C23, `T-E*` to T-E18, `T-F*` to T-F10,
`R-V*` to R-V15, `A*` to A41 — by grepping every `.md`, `.ts`, `.tsx` and `.mts` in the repo, not
by trusting the handover.

**No property found a counterexample.** All seven passed on the first run and on the 20-odd
searches since, so there is no shrunk counterexample to record. Because "it passed" is exactly what
a vacuous property also reports, each one was checked against a deliberate mutation of the code it
is about, and each was caught **by the property that owns it**:

| Mutation | Caught by |
|---|---|
| `rollUp` splits a row's figure across the keys it belongs to instead of counting it whole | T-U26 |
| `bucketRows` buckets on the UTC date instead of the Organization's civil day | T-U27 |
| `isSeatHolder` drops the `kind === "human"` clause and reads the seat flag alone | T-U28 |
| `ratio` returns `null` for a zero *numerator* too | T-U29 (and T-U28, which reads a per-capita value) |
| `taskFacts` stops dropping children from the grouping pass | T-U30 |
| `rollUpSession` folds the children's cost but not the root's own | T-U31 |
| `capSeries` keeps the top four and drops the "Other" bucket | T-U32 |

### How each generator was shown to reach its case

**Every property counts the case it is about and fails if the count is too low.** The counters are
in the test file (`tally`), the thresholds are asserted after `fc.assert` returns, and they are set
to roughly a quarter of the rate measured while the generators were written — low enough that no
seed trips them, high enough that a generator which stopped producing the case fails loudly rather
than reporting green. Measured over one 200-run search, per property:

- **1 — Team is non-additive.** Overlapping Member reached on **136** runs, Team figures summing
  *past* the Organization on **121**, and a roster that happens not to overlap on **64** — the
  contrast case, which is why the assertion is `≥` and the identity is exact rather than strict.
  Reached by 1–4 Teams against 1–12 Members, so multi-Team membership is the common case.
- **2 — period boundaries.** A row whose civil day the Organization's timezone *moved* — the only
  rows that can catch a UTC boundary — on **110** runs; a row outside the range on **88**; a
  partial period on **178**; an empty period between two full ones on **144**; and all three
  grains 61–63 each. The instants are written at offsets unrelated to the zone and biased onto the
  minutes either side of midnight, and two of the six zones (`Asia/Kolkata`, `Pacific/Chatham`)
  are not a whole number of hours off UTC.
- **3 — per-capita denominators.** A population holding a service account on **126** runs, a
  service account with work in the numerator on **77**, and — the case the roster never writes — a
  service account **carrying an active seat** on **79**. That last one is what proves the exclusion
  is keyed on `kind` rather than riding on a seat flag that happens to agree with it.
- **4 — the zero denominator.** Zero on **52** runs, negative zero on **19**, `NaN` on **19** and
  an infinity on **19**, and a *measured* zero — `ratio(0, d)`, which must survive — on **24**.
  `NaN` and the infinities carry weights of their own in the denominator arbitrary because
  `fc.double()` alone reached `NaN` **zero** times in 200 runs; that was the first calibration
  failure, and it is exactly the shape of vacuous coverage this ticket exists to prevent — the
  biconditional is stated *against* those two readings, and neither was ever tried.
- **5 — Rework and Decomposition.** A population holding children on **189** runs, a Task
  exhibiting Rework on **156**, Decomposition on **80**, both at once on **31**, and — the case
  ADR-0008 exists for — a **single-attempt Task that fanned out** on **127**. Three Task keys
  against up to eight roots is what makes a Task with two attempts ordinary rather than rare.
- **6 — the roll-up.** A root that spawned more than one agent on **412** roots, a root that
  spawned nothing on **219**, and a regrouping that actually moved a child on **162** runs.
- **7 — the cap.** The cap engaging on **130** runs and leaving the chart alone on **70**, with
  **exactly five** series (where it must not engage) on 9 and **exactly six** (where it must) on
  25 — both sides of A13's boundary. A row belonging to several series on **142** and to none on
  **129**, because "sums to the ungrouped total" is over (row × key) pairs and a single-key
  generator would never have told the two apart.

### Decisions taken without asking

**Property 1 is stated over rosters where every Member belongs to at least one Team, because
otherwise it is false.** `CONTEXT.md` § Organisation & People says a Member belongs to "one or
more" Teams; `aggregate.ts` nevertheless handles a Member on none, placing them nowhere. Such a
Member is in the Organization figure and in no Team's, so the sum of the Teams falls *below* the
Organization and the ≥ fails. The cheaper option was taken — generate the glossary's population,
and **restate the precondition as an assertion inside the property** so the condition is visible
where the claim is, rather than buried in a generator. Cost: the property says nothing about a
Team-less Member. That row cannot arise from the committed fixture (`R-D14`), and `aggregate.ts`'s
own comment already records what happens to it.

**Money is compared in cents and every measure is integer-valued.** Floating-point addition is not
associative, so a Team sum and an Organization sum over the same rows disagree in the last place
for reasons that have nothing to do with the rule under test. Reading Cost as a whole number of
cents — which is what a stored cost is — makes all seven identities equalities rather than
tolerances. A tolerance would have hidden the one-cent class of error the roll-up actually rounds.

**The seed is not pinned.** fast-check draws one per run and prints it with the shrunk
counterexample on failure. Pinning would turn 200 searches into 200 replays of one. The
determinism `src/domain/**` owes (P5, R-T5) is that the *generators* read no wall clock, no
`Math.random()` and no environment — they are pure functions of what the seeded runner chose — and
that is what the four files in `src/domain/testing/` are written to. The residual risk is a
property that fails on a future seed; that is the technique working, and the failure prints the
counterexample needed to decide whether the code or the property is wrong.

**One existing test was edited, and not weakened.** `src/data/load.test.ts`'s T-U5 ledger asserts —
as an exact list — which files in `src/` mention `hidden`. `src/domain/testing/sessions.ts` now
does, because every generated row is `hidden: false`: the population a property is stated over is
the one R-M2's strip has already run on, and a generator able to emit a hidden row would be handing
the domain layer rows the application never sees. The file was added to the list with that reason
written beside it; the assertion is still an exhaustive equality.

**No coverage rule was touched.** `vitest.config.mts` builds its per-file domain thresholds by
walking `src/domain` recursively, so the four new files picked up the 95%/90% bar the moment they
existed. They sit at 100%/100%, which is the point: an unexercised branch in a generator is a case
the property never tried.

### Left undone

- The properties run at 200 each, which is the Done-when. Nothing runs them at a higher count on a
  schedule; a nightly job at 10 000 runs would be the natural next step and has no owner.
- `childFaults`' five malformed-child cases stay T-U24's. This generator produces only well-formed
  children by construction, so no property here can catch a loader that stopped validating.
- The Model dimension has no property. `modelMix`'s three levels are a true partition and would
  make an eighth; it was out of scope and T-U17 owns the claim over the fixture.
