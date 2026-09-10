Type: implementation
Status: ready-for-agent
Blocked by: 66
Label: ready-for-agent

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
