Type: implementation
Status: resolved
Blocked by: 66
Label: resolved

# Fixture: every implementation, refactor and bug fix is reviewed on the same Job; refactors 17% and bug fixes 29% of implementations

## Goal

Session mix by WorkType follows the human's ratios, and review sessions are **linked** to the
work they review: every Task holding an `implementation`, `refactor` or `bugfix` session also
holds at least one `review` session with the same `task_key`, and reviews in total number 122% of
those sessions (some Jobs are reviewed twice).

Decided by the human, 2026-09-10. Reading taken of "one above 122%": reviews ≥ 1.22 × (impl +
refactor + bugfix), each of those sessions covered by at least one review on its Task.

## What exists today

- `targets.mts` `WORK_TYPE_SHARE`: implementation .30, bugfix .20, refactor .18, review .12,
  deploy .20. `allocation.mts` closes the R-D6/R-D7 residual by transferring share between
  `review` and `deploy`.
- `tasks.mts` groups slots into Tasks by shape (single / rework / decomposition / both) — all
  sessions of a Task share one Member; Rework = a non-accepted session followed by another,
  Decomposition = more than one accepted (`src/domain/sessions.ts`, CONTEXT.md § Work).
- Committed data: 442 Tasks carry impl/refactor/bugfix; 32 of them also carry a review.

## Scope

1. **Ratios.** With `I` = implementation count: refactor = 0.17·I, bugfix = 0.29·I,
   review = 1.22·(1 + 0.17 + 0.29)·I ≈ 1.78·I, deploy keeps its current ratio to
   implementation (≈ 0.48·I) — stated assumption, deploy was not mentioned. Resulting shares ≈
   implementation 27%, review 48%, deploy 13%, bugfix 8%, refactor 5%. Replace `WORK_TYPE_SHARE`
   with these derived values and assert the three ratios ±2%.
2. **Linkage.** A review session is generated **from** a reviewed session: same `task_key`, same
   Repository, starts 10 min – 3 days after the reviewed session ends, run by a **different human
   Member of the same Team** where one exists (else any other human). Cheaper alternative — the
   same Member reviewing their own work — was rejected because it is visibly unrealistic on
   `/history`. Every impl/refactor/bugfix session gets one review; the extra 22% are second
   reviews drawn at random over the same population.
3. **Rework and Decomposition ignore reviews.** Amend `src/domain/sessions.ts` so the two labels
   are computed over a Task's non-review sessions; otherwise every reviewed Job becomes
   Decomposition. Record this in CONTEXT.md § Work and in R-D8. Rates 18% / 12% stay, measured on
   that basis. `quotaFor` in `tasks.mts` plans the non-review sessions; reviews are appended after.
4. **Acceptance.** Reviews keep R-D6's 0.86; the allocation solver's transfer now moves share
   between `review` and `deploy` over a much larger review pool — re-check `SHARE_TRANSFER_LIMIT`
   and widen with a written reason if the residual cannot close.
5. **Jobs per Member.** A reviewer's accepted review counts as a completed Job for them (present
   semantics of `completedTaskKeys`); note this in the ticket comments and in R-N15's copy if the
   People lede needs a word.
6. Spec § 8: new R-D22 (review linkage and ratios), amend R-D3 counts, fixture README.

## Done when

- Generator asserts: every impl/refactor/bugfix session's `task_key` has ≥ 1 review session;
  review count ≥ 1.22 × those sessions; refactor/impl and bugfix/impl ratios; reviewer ≠ author.
- Fixture-contract test re-derives the same four facts from committed JSON.
- Domain unit: a Task `[implementation accepted, review accepted]` is neither Rework nor
  Decomposition; `[implementation failed, review accepted, implementation accepted]` is Rework.
- All six gates green.

## Comments

**2026-09-10 — implemented.** Five escalations, all of them the cheaper option, all recorded here.

### The one that matters: `deploy` closes R-D6 against R-D7, not a wider transfer

Scope 1's arithmetic does not have a solution. R-D6 and R-D7 are two marginals of one table and
must reconcile to one grand acceptance rate. The Repository marginal is `sum(share_r · rate_r)` =
**0.6633** and cannot be moved far: 0.78 is the highest rate on R-D7's list, so even a fixture
that ran nothing but `web-console` tops out at 0.78 and a realistic reshuffle of the repository
shares moves the figure by about a point. A mix that is 48% `review` at 0.86 puts the WorkType
marginal at **0.749**. No matrix exists with both margins — and the joint distribution cannot
help, because each grand total is a function of its own margin alone.

Scope 4 anticipated the transfer growing and said to widen `SHARE_TRANSFER_LIMIT` with a reason.
Widening it does not work: the transfer moves share out of `review`, and closing 8.6 points of
acceptance needs 0.17 of it, which takes reviews from 1.22× the built population to 0.79× and
deletes the thing the ticket exists to establish. Three options, and the cheapest was taken:

1. **Re-author R-D7's five rates upward by ~0.086** (web-console 0.87, terraform 0.53). Amends a
   spec requirement the ticket did not authorise amending, and moves five headline product
   figures. Rejected.
2. **Widen the transfer until it closes.** Destroys R-D22. Rejected.
3. **Let `deploy` — the one WorkType the ticket itself flags as an unsupported assumption
   ("stated assumption, deploy was not mentioned") — take the level at which the two marginals
   meet.** Taken. `WORK_MIX.deployPerImplementation = 1.9552`, solved once and asserted. The
   three ratios the human gave hold *exactly*; nothing in R-D6 or R-D7 moved; `SHARE_TRANSFER_LIMIT`
   was re-checked at this volume and **left at 0.01**, because the solver's residual is now zero.

The cost is that the mix is not the one the ticket sketched. Realised shares: **implementation
22.0% · review 39.3% · deploy 28.6% · bugfix 6.4% · refactor 3.8%**, against the ticket's
illustrative 27 / 48 / 13 / 8 / 5. `deploy` is the second-largest column and outnumbers
`implementation`. Everything the human actually specified is exact: refactor/implementation
0.170, bugfix/implementation 0.289, reviews/(built) 1.221. Recorded in spec § 8 under R-D7 and in
`targets.mts`.

I also changed the transfer's mechanism: it now moves share into `deploy` from the other four
**in proportion**, so the three ratios are invariant under it at any value. As written it moved
share out of `review` alone, which would have put the 1.22 wherever the residual landed.

### The band is four days, not three

`REVIEW_DELAY_SECONDS.max = 4 days`. Three does not fit a five-workday week: a Job that finishes
Friday morning has, inside three days, only Friday's remaining review slots and a weekend running
at 15% of a workday's rate, and every other Friday Job wants the same handful. The matcher fails
on the committed schedule at anything below **80 hours**; four days is the first round number
above it. Realised: **median delay 16 h**, 236 of 3,047 reviews (7.7%) past three days, none past
four, none sooner than ten minutes. Recorded in R-D22 and in `targets.mts`.

### A review takes a slot; it is not appended to one

Not an escalation so much as the design decision the rest rests on. R-D4 is "one to nine root
sessions per human Member per workday" and ~3,000 appended reviews would have doubled a Member's
day. So `splitSlots` designates which of the slots `schedule.mts` already drew are reviews, and
the review keeps that slot's Member and instant; the matcher's job is then to find, for each Job,
a slot behind it held by somebody else. **R-D4's 2,043 (Member × workday) pairs and April's 630
sessions are byte-for-byte ticket 66's.** The head of the window holds no review (nothing built
yet) and the last day holds nothing else (so the last Jobs have somewhere to be reviewed from).

### `src/domain/sessions.ts` was the wrong file

Scope 3 names it; Rework and Decomposition live in `src/domain/metrics/efficacy.ts`, and that is
where they were amended. `TaskSession` now carries `work_type`, which reverses a documented
decision in that module ("there is no `work_type` here, and that is the point") — the comment is
rewritten to say what the field is now for: naming the one class that is excluded, and nothing
else. Among the four that remain "followed by" is still WorkType-blind, and T-U15 asserts both
claims separately. CONTEXT.md § Work and spec R-D8 record the narrowing; ticket 05's worked
example (a failed `review` followed by an `implementation`) is withdrawn with it.

### Two consequences reported rather than corrected

* **Almost every Task is now Completed.** A Completed Task has an accepted root session and an
  accepted review is one, so a Job whose implementation failed and whose review was submitted
  completes. Incomplete Tasks fell from ~1,540 to **1,058**, all of them now carried by Tasks
  that never left `deploy`; R-D9's four age buckets are filled (54 / 174 / 439 / 405). The
  fixture no longer holds a single Member-month with spend and nothing delivered, which one
  spend test asserted over; that case is now built from a slice of committed rows and says so.
  Scope 5's note is in R-N15.
* **`web-console` saturates.** It must average 0.78 while carrying a `deploy` column at 0.34, so
  its other cells sit against their own counts: review 99.9%, implementation 99.2%, bugfix 99.3%.
  It was already 99.7% on review before this ticket. `allocation.mts` now caps every cell at its
  count less one, so no pair reads a flat 100%.

### Task titles — fixed, not deferred

Ticket 66 handed this over and it was in scope: `issues.mts` composes a title from a verb, a
subject and either an aspect (`the export dialog's empty state`) or, for a deploy, a destination
(`to the canary fleet`). Sixteen subjects and sixteen aspects per Repository. **2,959 distinct
titles over 3,626 Tasks, worst repeat 7** — against about forty before. `assertTitles` makes it a
checked property (worst repeat ≤ 8, distinct ≥ 60% of Tasks) rather than an impression.

### Literal counts in tests

Per the ticket's rule, every count a WorkType mix can move is now **derived from the rows** in
the test that reads it — Task counts, child counts, order statistics, money totals, per-bucket
tallies, the nine week labels `gaps.spec.ts` used to name, and three fixture-derived literals in
`payload.spec.ts`. Counts the *schedule* fixes stay literal: 7,761 visible roots, April's 630
sessions, 20 Members, $4,212 of seats. Recorded as a rule in testing-spec § 6.
`e2e/support/costs.ts` restates Rework and Decomposition for the leak search and was amended to
the same non-review basis, or a rate the page really prints would have read as a leak.

### Fixture counts (committed)

| | ticket 66 | ticket 67 |
|---|---|---|
| Rows on disk | 10,879 | **10,854** |
| Visible roots | 7,761 | **7,761** |
| Visible children | 2,960 | **2,935** |
| Hidden roots | 158 | **158** |
| Tasks | 5,970 | **3,626** |
| implementation / bugfix / refactor / review / deploy (visible roots) | — | **1,710 / 495 / 291 / 3,047 / 2,218** |
| Reviews per Job built | — | **1.221** (726 Tasks reviewed twice) |
| Reviewer on the author's Team | — | **90.2%**; never the author |
| Session cost · seat cost · seat share | $55,293.74 · $4,212 · 7.1% | **$53,104.47 · $4,212 · 7.3%** |
| Median / p95 session cost | $3.62 / $24.04 | **$3.58 / $22.37** |
| Rework / Decomposition (non-review basis) | 18% / 12% | **18.0% / 12.0%** |
| Incomplete Tasks | ~1,538 | **1,058** |
| Distinct Task titles | ~150 | **2,959** (worst repeat 7) |

`pnpm fixtures:generate` was run three times into separate directories and diffed: **byte-stable**,
and identical to what is committed.

### Gates — all six green, run from the worktree root

| Gate | Result |
|---|---|
| `pnpm lint` | **pass**, 0 errors 0 warnings |
| `pnpm typecheck` | **pass** |
| `pnpm test` | **pass** — 1,524 tests in 65 files |
| `pnpm test:coverage` | **pass** — statements 98.29%, branches 89.32%, functions 99.03%, lines 99.47% |
| `pnpm build` | **pass** — 10 routes |
| `PORT=3107 pnpm e2e` | **pass** — 180 tests, 1.5 min wall |
