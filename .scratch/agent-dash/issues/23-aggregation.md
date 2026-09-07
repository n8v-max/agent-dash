Type: implementation
Status: resolved
Blocked by: 21, 22
Label: resolved

# Aggregation: non-additive Team roll-ups and per-capita denominators

**Two of the four ADR-0005 replacement targets.** These had no owning ticket until now.

## Goal

`src/domain/aggregate.ts` — roll-ups across every dimension, handling the one non-additive level
correctly and computing per-capita denominators that exclude service accounts.

## Scope

**Non-additive Team roll-ups (R-V3).** Teams and Members are many-to-many, so Team is a containment
hierarchy, not a partition. There is no primary Team — one was proposed and rejected, because
GitHub teams overlap and a primary would be an invention.

- The sum of every Team's figure **exceeds** the Organization figure.
- A Member in two Teams contributes their **full** figure to both, not half to each.
- The **overlap note is computed alongside the total**, in the same grouping pass, so they cannot
  disagree. It states the true count of multi-Team Members.
- Organization → Member and Model → family → tier **are** true partitions and do sum.

**Per-capita denominators (R-M14).** The denominator counts **active human Members only**. Service
accounts hold no seat and would give the denominator the wrong size.

- Service accounts still contribute to the **numerator** — their sessions are real work and real
  cost. Only the seat-holding denominator excludes them.
- Team per-capita uses that Team's human headcount, and an overlapping Member is counted in each
  Team's denominator as well as its numerator.
- Offered only where more than one Member is aggregated. Raw is the default.

## Done when

**T-U6** and **T-U7** pass, including the partition contrast cases.

## Notes

This is the single most likely place for the product to assert a wrong number confidently, which is
why ADR-0005 named it when it moved cost attribution upstream: *"the interesting failures in this
product are aggregation failures… pricing a session is multiplication."*

R-D14 guarantees at least 3 multi-Team Members, so the non-additive case is real rather than hoped
for. R-D3 puts 2 service accounts in 20 Members, so a wrong denominator is off by 10% — large
enough to catch, small enough that an eyeballed chart would not.

## Comments

### 2026-09-07 — implemented (AFK build, wave 4)

Gates green: `lint` · `typecheck` · `test` (278 tests) · `test:coverage` (100% statements /
branches / functions / lines; `aggregate.ts` clears its own per-file 95/90 group) · `build`.
Nothing in `src/domain/**` is uncovered, so T-Q3's ranked list of what is *not* covered is empty.

`src/domain/aggregate.ts` (191 lines) — `rollUp(input, level)` over `member | team | organization`,
plus `perCapita`, `sumGroups` and `modelMix(input, level)` over `exact | family | tier`. Pure unit
tests inline, and `src/data/aggregate.fixture.test.ts` repeating every claim against the committed
rows, following ticket 22's P6 precedent.

One edit to existing code: `membershipFromTeams` in `access.ts` was widened to accept
`Readonly<Pick<Team, "id" | "member_ids">>[]` so the roll-up **inverts membership through that
function** rather than writing a second inversion. Teams↔Members is many-to-many in exactly one
place, so the permission filter and the Team roll-up cannot reach different conclusions about who
is on a Team. No behaviour change, no test change.

**The overlap note cannot disagree with the total, structurally.** `rollUp` builds one
`Placement: memberId → group keys` map, and that single map decides all three things: which groups
a row's figure lands in, which Members size each group's per-capita denominator, and which Members
are counted more than once. The note is *the multiplicity of the map that did the double counting*,
not a second opinion about the data. `MemberFacts` deliberately omits `team_ids`, so "recount from
the roster" is not expressible in the module. The identity `sumGroups(rollup) − rollup.total ≡
Σ figure(m) × (teams(m) − 1)` is asserted over two measures, three team shapes, a three-way
overlap, and an overlapper with zero rows.

**T-U6** — Team sum exceeds Org (2310 vs 1980 in the unit case; asserted on cost *and* session
count in the fixture). Removing an overlapping Member drops **both** their Teams by the full
figure, not half. Both contrast cases are asserted so the Team result reads as a property rather
than an unfixed bug: Organization → Member sums exactly with `overlap = {[], 0, null}` and every
Member in exactly one group, and Model exact → family → tier carries one identical total at all
three levels.

**T-U7** — the Organization denominator is **18, not 20**: 110 per capita against the 99 a
20-denominator would give, which is exactly the 10% error R-D3 is seeded to make catchable.
Service accounts stay in the numerator (removing their rows drops the total while the denominator
holds at 18). Per-capita returns `available: false` for any single-Member group and `null` rather
than dividing by zero for a robots-only population. The T-U6 × T-U7 interaction is asserted where
it actually bites: `team_d` is 6 members / **4** seats → 205, where a 6-denominator says ~137, and
Σ team denominators = 18 + the overlap count. In the fixture `team_infrastructure` is the same
shape — 6 members, 4 seats, both service accounts.

**Mutation-checked; all four mutations caught**, and `aggregate.ts` verified byte-identical
afterwards:

| Mutation | Caught by |
|---|---|
| Team roll-up splits an overlapping Member's figure (`value / keys.length`) | 13 tests |
| Denominator includes service accounts | 11 tests |
| Note computed apart from the placement (off by one) | 5 tests |
| Team per-capita uses the Organization denominator | 6 tests |

### Four arguments recorded, none re-decided

1. **"Active human Members" is ambiguous** (R-M14): seat-active, or active-in-period? Read as
   *holding an active seat* — the reason `CONTEXT.md` itself gives is that service accounts "hold
   no seat", and the period reading would make the denominator depend on the measure (two metrics
   disagreeing about one population's size) and would delete exactly the low-usage Member R-D10
   seeds as the product's sharpest finding. In the committed roster the two readings coincide
   exactly, so **the fixture cannot discriminate them**; a unit test covers a lapsed-seat human
   directly instead.
2. **R-V3's note is keyed on belonging, not on activity.** A multi-Team Member who ran nothing
   still overlaps two per-capita denominators while adding nothing to the excess. "N Members belong
   to more than one Team" stays literally true and the excess identity still balances at zero.
   Both cases tested.
3. **`partition` is a property of the dimension, not of today's rows.** A Team grouping that
   happens not to overlap under some filter still reports `partition: false`, because it feeds
   `stackable` (R-V1) and stackability must not flicker with the filter set.
4. **R-M7 is respected structurally.** `AggregationInput` has no model field, so no session-grain
   measure can reach one; `modelMix` takes token-grain entries, a roster and a level, and there is
   no Model argument by which a per-session metric could be grouped or filtered. T-U17/A22 will
   hold.
