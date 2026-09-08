Type: implementation
Status: resolved
Blocked by: 23
Label: resolved

# Efficacy metrics

## Goal

`src/domain/metrics/efficacy.ts` — Acceptance rate, Rework rate, Decomposition rate, Incomplete
Task buckets.

## Scope

- **Acceptance rate is computed within a WorkType only** (R-M6). Each WorkType defines its own
  criterion, so an Organization-level figure averages incommensurable criteria. The function must
  be **unable to produce** a cross-WorkType figure — not merely never asked to.
- **Rework**: a non-accepted session followed by another session on the same Task, **of any
  WorkType**. The same-WorkType clause was dropped in ticket 05 — a failed `review` followed by an
  `implementation` is still a second attempt at the same Task. Consequence accepted: the rate runs
  higher than the strict reading would give.
- **Decomposition**: a Task with more than one **accepted** session — work deliberately split, not
  work repeated.
- **Rework and Decomposition are independent labels, not a partition.** A long Task can exhibit
  both, and the fixture contains such a Task.
- **Incomplete Tasks**: Tasks with no accepted session, bucketed by **age since the last session** —
  0–7 · 8–30 · 31–90 · 90+ days (R-M16). "Now" is injected (P5).

## Done when

**T-U14, T-U15, T-U16** pass. All four age buckets are non-empty (R-D9).

## Notes

Incomplete is an umbrella **on purpose**. It covers work still in flight and work someone gave up
on, and the platform cannot tell them apart because it does not own the external Task's lifecycle.
Rather than invent a cutoff, report the count by age and let the reader conclude. Do not add a
status, a threshold, or an "abandoned" label.

The Task/AgentSession distinction exists so that Rework is *measurable at all* — three retries of
one Task and three first-time-successful Tasks are otherwise indistinguishable.

## Comments

### 2026-09-08 — implemented (AFK build, wave 5, worktree `agent-dash-t25`)

Gates green: `lint` (0 errors; the one warning is ticket 29's pre-existing T-E4 TODO) · `typecheck`
· `test` (432 tests, 57 new) · `test:coverage` · `build`. `efficacy.ts` alone is **100%**
statements / branches / functions against its own per-file 95/90 gate. Three files, no shared
module and no config touched.

**T-U14 — a cross-WorkType acceptance rate is structurally impossible, four ways.**
`acceptanceRateWithin` *requires* a `WorkTypeKey` — the closed five-value union, with no `"all"`,
no `undefined`, no array form — and has arity 2, so there is no one-argument "over everything"
form. It filters internally, so a mixed population cannot yield a mixed figure.
`AcceptanceRate.work_type` is **one key, not a list**, so a two-criterion figure has no shape to be
returned in. And `acceptanceRateByWorkType` returns `Record<WorkTypeKey, AcceptanceRate>` — the key
set *is* the vocabulary, asserted to carry no `total` / `overall` / `organization` / `all` /
`combined` / `average` property. A module-surface test asserts no export matches
`overall|organi[sz]ation|acrossWorkTypes|combinedAcceptance`.

The fixture test computes the forbidden number **in the test** — 493/742 = **0.66** — purely to
show it equals none of the five and that every WorkType's own reading sits more than a percentage
point from it. R-D6 is reproduced exactly: review .86 · bugfix .79 · implementation .71 · refactor
.58 · deploy .34, denominators `[236,142,156,95,113]` summing to 742.

**T-U15.** Rework is `ordered.slice(0,-1).some(s => !s.accepted)`: fail→retry counts, a lone failure
does not (nothing followed it), accept→later-failure does not, and reversing the input gives
identical labels. The cross-WorkType case is asserted **and made structural**: `TaskSession` has no
`work_type` field at all, so the clause ticket 05 dropped has nothing to read. The test rows carry
one anyway, to show a real session shape is accepted and changes nothing. In the fixture **80
Tasks** get their Rework label from a different-WorkType follow-up.

Rework and Decomposition are independent labels, asserted over all four inline combinations; on the
fixture the quadrants are **410 / 57 / 91 / 12**. The Task exhibiting both is
**`equilibrio/api-gateway#632`** — `implementation:false → review:true → bugfix:true`, so its
Rework is itself cross-WorkType. R-D8 reproduced: Rework 103/570 = 0.18, Decomposition 69/570 =
0.12, and **103 + 69 = 172 labels over 160 labelled Tasks** — a partition would give 160, so the
independence is a number rather than a claim.

**T-U16 — the day-90 boundary.** Buckets are declared once as data with an **exclusive** upper edge
(`[0,8) [8,31) [31,91) [91,∞)`) and contiguity is asserted (`fromDays[i] === toDaysExclusive[i-1]`).
**Day 89 → `31-90`, day 90 → `31-90`, day 91 → `91+`**, each asserted individually, plus the 7/8 and
30/31 edges, plus a sweep of every age 0…120 asserting exactly one declared bucket contains it and
that it is the one returned, plus part-day flooring. `now` is injected: the same rows bucket
differently as it moves — on the fixture, `now + 90 days` takes `[14,32,66,34]` to `[0,0,5,141]`.
Fixture buckets are `[14, 32, 66, 34]`, all four non-empty (R-D9), and the fixture really contains
an age-89, an age-90 and an age-92 Task, so the boundary test is not vacuous.

Incomplete stays an umbrella, asserted as an absence: `IncompleteTask`'s keys are exactly
`ageDays`, `bucket`, `lastSessionEndedAt`, `task_key` — no status, no threshold, no "abandoned".

**Mutation-checked; five mutations, all caught**, file verified byte-identical afterwards:

| Mutation | Caught by |
|---|---|
| `31-90` ends at 90 and `91+` starts at 90 (**the ticket's own "90+" wording**) | 8 tests |
| `91+` starts at 90 while `31-90` still ends at 91 (literal double-cover of day 90) | 4 tests |
| Rework restricted to same-WorkType follow-ups | 8 tests |
| Decomposition counts any second session | 6 tests |
| `acceptanceRateWithin` ignores its WorkType argument | 7 tests |

### Three things recorded, none re-decided

1. **This ticket's Scope says `0–7 · 8–30 · 31–90 · 90+`; R-M16 and T-U16 say `91+`.** `91+` is
   implemented, per the spec. T-U16 names the `90+` wording as the exact off-by-one it exists to
   prevent, and the first mutation above shows the suite catches it. **The stale wording is in this
   ticket, and should be corrected here rather than in the spec.**
2. **R-D7 is a cross-WorkType acceptance figure by construction.** "Acceptance rate by Repository:
   web-console 0.78 …" spans all five criteria, so it is precisely the number R-M6 and A21 forbid
   the product to state. It is a **fixture** property and belongs to T-F4, which computes over raw
   JSON rather than through this module — and it is not asserted here, deliberately. Worth naming
   because R-D6 and R-D7 read as a pair while only one of them is a figure any surface may show.
3. Two small decisions recorded in the module docs: **age is an elapsed duration and carries no
   timezone** (R-M10 governs period boundaries, which this is not); and **a `now` earlier than a
   Task's last session ages it 0** rather than rejecting the report — the fixture exercises this,
   since `equilibrio/mobile-app#558` ends past the window end.
