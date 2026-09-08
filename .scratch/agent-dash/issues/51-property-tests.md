Type: implementation
Status: ready-for-agent
Blocked by: 40, 48
Label: ready-for-agent

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
