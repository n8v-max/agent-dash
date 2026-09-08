Type: implementation
Status: resolved
Blocked by:
Label: resolved

# Every ratio emits null when its denominator is zero

## Goal

A bucket that finished nothing has no cost per completed Job. Today it draws $0, and the panel text
promises a gap. Acceptance rate draws 0% for a week with no sessions. Both lie.

## Scope

- One rule in `src/domain`: a ratio with a zero denominator is `null`, never `0`.
- Applies to: Cost per completed Job (all groupings), Cost per session, Acceptance rate (all
  WorkTypes), Rework rate, Decomposition rate, per-capita variants, Projection when no day elapsed.
- Charts break the line at null (Recharts `connectNulls={false}`). Table mirrors show an
  em dash. Headline figures show "—" with the reason "no completed Jobs in this period".
- The restricted account's Cost per completed Job is the acceptance case: weeks 15–17, 20, 21, 23
  must draw nothing.

## Done when

- Unit test per ratio: zero denominator returns null.
- Property test seed: for any bucket, `ratio === null` iff `denominator === 0` (ticket 51 extends).
- e2e: restricted account, Spend, the mirror table for Cost per completed Job holds a dash in
  week 15.

## Notes

Decided by the human, 2026-09-09, round 3: null everywhere, including acceptance rate.

## Comments

**Resolved 2026-09-09.** All six gates green on `ticket/40-null-denominators`: `lint` · `typecheck`
· `test` 1135 passed · `test:coverage` (domain at 95/90 per file, thresholds unchanged) · `build`
· `PORT=3102 pnpm e2e` 106 passed.

### The rule

`src/domain/ratio.ts` — one function, `ratio(numerator, denominator)`, returning `number | null`.
Every ratio in the product divides through it, so the rule has one site, one test file, and a
biconditional a property test can bind to: *`null` if and only if the denominator is zero*. That is
why it carries **no** guard for a `NaN` or infinite denominator — adding one would make the
biconditional false, and no measure here can produce either (every denominator is a count of rows,
of Members or of days, or an elapsed share in `0..1`).

Rewired: `metrics/spend.ts` (Cost per session, Cost per completed Task, the seat share),
`metrics/efficacy.ts` (Acceptance rate, Rework rate, Decomposition rate), `aggregate.ts`
(per-capita), `metrics/projection.ts` (Projection), `metrics/duration.ts` (span shares),
`data/queries/adoption.ts` (Model-mix shares), `data/queries/work.ts` (per-capita velocity).

**Most of these were already `null` and stayed `null`** — the previous waves were careful. What was
new was the *rule*, three coercions that were not, and the rendering, below.

### What was actually broken

Measured before the change, restricted account, `/demo/spend?grain=week`, Cost per completed Job:
weeks 15, 16, 17, 20, 21 and 23 each read **`0`** in the mirror and drew a point on the floor. The
metric module had returned `null` and `aggregationCells` had correctly emitted no cell — and then
`series.ts` filled every series' every bucket with `0` and `viewmodel.ts`'s mirror read
`grid.get(...) ?? 0`. The absence was computed correctly six times and thrown away twice.

Three further coercions, each a zero denominator producing a figure:

1. **`readingOf` in `data/queries/panels.ts` passed `current.value ?? 0` to the change floor.** A
   tile printing "—" therefore printed "−100% on the prior period" beside it: a fall to nothing,
   off a month whose measure was never defined.
2. **`perCapitaDivisor` returned `1` over a zero denominator**, and `/demo/work`'s velocity panel
   read it without checking `available`. A population holding no seat would have rendered its raw
   totals under a "per Member" title.
3. **The human-presence span shares returned `0` over an empty population** — three spans each
   drawn at 0%, claiming a composition that was measured and found empty.

### The rendering seam

`MeasureKind` — which the ViewModel already carried for R-V1 — now decides what a bucket holding no
cell reads as: **`ratio` → `null`, `additive` → `0`**. That is one fact, not two: a Repository that
ran nothing in a week really did cost nothing and its line belongs on the floor, where a week with
no Completed Job has no reading at all. `capSeries` takes an `absent` parameter and `mirrorFrom`
reads the same value, so the two derivation paths R-T7 keeps independent still agree cell for cell
(asserted over every chart of every page for both accounts, `queries.test.ts`).

Downstream: `table-mirror.tsx` prints `null` as an em dash (`undefined` — a malformed short row —
still renders blank, deliberately, so the two absences do not read alike); `chart-shapes.tsx` states
`connectNulls={false}` on `Line` and `Area`. That is Recharts' own default and is written out and
tested anyway, because a default is not a decision and a future version flipping it should fail a
test rather than quietly change what the product claims.

**A measured zero is never turned into a gap.** An acceptance rate of 0 over five sessions is a
measurement: the cell exists, so it renders `0`. Asserted directly in `viewmodel.test.ts` and again
over the fixture — *no bucket of the restricted account's Cost per completed Job chart reads zero*,
because a finished Job cannot have cost nothing, so a zero there could only be the old coercion.

### Decisions taken

**A fourth change suppression, rather than a coerced comparison.** `CHANGE_SUPPRESSIONS` gains
`no-figure-to-compare`, and `changeBetween` now takes a `PeriodReading` (value `number | null`) on
either side. The alternative was to keep `?? 0` in the query layer and accept "−100%" under an em
dash, or to reuse `no-prior-period` with a message that would have been false. Cost: R-M12 and A8
were stated as *"suppressed when and only when the prior period holds zero or is incomplete"*, so
both are amended and the reasoning is recorded as **§ 11 C15**. The floor itself is unchanged — it
is still a count of one on the base, still never a magnitude, and a *measured* fall to zero is still
shown, which is asserted beside the new case so the two cannot be conflated.

**The span shares and the Model-mix shares were included, though the ticket's Scope does not list
them.** Both returned `0` over a zero denominator, which is the thing the ticket forbids, and
ticket 51's property would have failed on them. Both changed type to `number | null`; both
consumers already formatted `null` as an em dash, so no copy changed.

**Cost per completed Task keeps its discriminated `defined: false` arm** rather than collapsing to
`value: number | null`. It is the *stronger* statement of the same rule — there is no `value` field
at all to hold the null — and it already carries the sentence R-V10 wants beside the em dash. It now
decides through `ratio()` so the rule still has one site. Collapsing it would have rippled into
`summary.ts` and `summary-tiles.tsx`, which ticket 39 owns in this wave.

**Cost per session gained a `message`**, on that precedent, so its headline em dash has a reason
beside it: *"2026-W17 holds no accepted session to average"*. The filter is named, because "holds no
session" would be false about a period the `accepted` filter emptied.

### Spec edits, in this commit

`spec.md`: **R-M18** (the rule, § 4), **R-V10** (the three renderings, § 6), **A29**, amended
**R-M12** and **A8**, and **§ 11 C15**. `testing-spec.md`: **T-U22**, **T-C1.1**, **T-E10**, amended
**T-U3**, **T-U20** and **T-U21**, and the A29 row of § 9.

### Left undone, deliberately

- **`figures.ts` and the `/demo/projection` panels were not touched** — tickets 41 and 42 own them
  in this wave, and both already render `null` as an em dash, so nothing here needed them.
- **The property test itself is ticket 51's.** `ratio.test.ts` asserts the biconditional over a
  fixed grid of numerators and denominators; 51 replaces the grid with `fast-check` at 200 runs.
- **"Other" over a ratio chart still sums the tail's ratios**, which is arithmetically meaningless
  whether or not any of them is null — sixteen Members' Cost per completed Job do not add up. This
  ticket made the *absence* survive being swept (all-absent tail → `null`) and left the underlying
  question alone: it is R-V4's, not R-M18's, and fixing it means deciding what "Other" *is* on a
  ratio chart, which no spec currently says.
- **`e2e/gaps.spec.ts` asserts the mirror, not the SVG.** Whether the line visually breaks is
  Recharts' business and `connectNulls={false}` is asserted structurally instead; `testing-spec.md`
  § 7 already rules out asserting geometry.
