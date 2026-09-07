Type: implementation
Status: resolved
Blocked by: 22
Label: resolved

# Change floor and series capping

## Goal

`src/domain/change.ts` and `src/domain/series.ts` — the two rules that shape every chart in the
product.

## Scope

**Change floor (R-M12).** A change figure is suppressed **only when the prior period holds nothing
at all**. The floor is a count of one, **not a magnitude threshold**.

- Prior period zero → suppressed. Prior period one → shown, however large.
- Two-to-three sessions week-over-week really is +50%, and on a narrow self-view that is the honest
  reading, not noise.
- A test asserting a percentage cut-off encodes the position ticket 05 explicitly rejected. Every
  vendor shipping a magnitude floor ships it to gate **alerts**, and alerting is out of scope here.

**Series cap (R-V4, R-V5, R-V6, R-V7).**

- Top 4 + "Other", **engaging only above five series**. 20 Members → 4 + "Other"; 5 Repositories →
  5 and **no** "Other". An "Other" bucket holding one repository reads as a rendering fault. See
  `spec.md` § 11 C1 — this resolves a conflict between tickets 07 and 10 in favour of the later.
- Ranked by the chart's own measure **across the whole selected range**, then bucketed. Ties break
  by name ascending.
- The set is **identical in every bucket**, recomputed only when range, filters or roll-up level
  change. Per-bucket ranking is forbidden: it makes series identity change mid-chart, which is both
  misleading and the exact input that triggers the `key={index}` legend bug.
- **"Other" is inert** — not clickable, does not expand. Its tooltip lists what it holds.
  **Filtering is how a viewer reaches beyond the top four; the cap never lifts.**
- Four plus "Other" fills `--chart-1..5` exactly. **The palette is never extended** — no
  `--chart-6..N`, no OKLCH generation. Nothing can request a sixth colour, so the silent
  transparent-series failure is unreachable by construction.

## Done when

**T-U3** and **T-U11** pass. T-U11 must include a dataset where per-bucket ranking would differ
from whole-range ranking, asserting the whole-range answer.

## Notes

The cap is the better chart independently of the palette bug: categorical palettes run out of
distinguishable hues around 10–12, so a 20-series chart is unreadable whether or not it is coloured.
Extending the theme would have made a bad chart render instead of making it a good chart.

## Comments

### 2026-09-08 — implemented (AFK build, wave 4)

Gates green: `lint` · `typecheck` · `test` (350 tests) · `test:coverage` (100% statements /
branches / functions / lines; `change.ts` and `series.ts` each clear their own per-file 95/90
group) · `build`.

Six files: `src/domain/change.ts`, `src/domain/series.ts`, pure tests for each, and
`src/data/change.fixture.test.ts` / `src/data/series.fixture.test.ts` proving the same claims
against committed rows (P6). Both modules take `PeriodBucket<Row>` structurally, so `periods.ts`
feeds them with no adapter.

**T-U3.** Zero prior → suppressed, asserted on committed rows (Noelia Gallego's June(0) → July(1)).
Prior of one → shown however large: `1 → {2,10,100,1000}` gives ratios `[1,9,99,999]`, and on the
fixture Elena Sáez's May(1) → June(5) is **+400%, shown**. That it is not a magnitude threshold is
attacked from both ends — `1024 → 1025` (a tenth of a percent) is shown, a 24-cell grid asserts
`shown ⟺ base ≠ 0`, and a sweep of 100 comparisons across all 20 committed Members × 5 adjacent
months finds no exception.

**T-U11.** The cap engages *above* five and not *at* five, asserted from both sides: 5 → 5 with
`other === null`, 6 → 4 + Other, 20 Members → 4 + Other, 5 Repositories and 5 WorkTypes → all five
and no Other. Ranking is by the chart's own measure across the whole range — cost names a different
four than session count on the same rows. Ties break by name ascending, with key only as the final
tiebreak. Capping is lossless: the five emitted series sum to the real monthly session counts.

**The discriminating dataset — six series over three buckets**, whole-range totals
`a 100 · b 90 · c 80 · d 70 · e 60 · f 50`, so the whole-range answer is `a,b,c,d + Other`:

| bucket | its own top four | how it disagrees |
|---|---|---|
| W20 | a · b · **e** · c | `e` named, `d` not |
| W21 | c · d · **e · f** | both whole-range leaders drop out |
| W22 | **e · f** · a · b | the two series Other holds lead the bucket |

**Every bucket discriminates**, so a per-bucket implementation is caught whichever bucket it
happened to rank on. That matters: the first draft used two buckets, and mutation (b1) proved the
first of them did *not* discriminate — the dataset was rebuilt rather than the mutation waved
through. Other's points are `[1, 2, 107]`, and the 107 dwarfing all four named series in W22 is the
visual argument for not re-ranking. The committed fixture turns out to be independently the same
shape: whole-range top four and April's own top four differ in three of four positions.

**Mutation-checked; eight mutations, all caught**, both files verified byte-identical afterwards:

| Mutation | Caught by |
|---|---|
| cap at five instead of above five | 5 tests |
| rank on the first bucket / on the last bucket | 12 / 11 tests |
| suppress when prior < 3 / when \|ratio\| < 20% | 7 / 7 tests |
| break ties by key rather than name | 1 test |
| drop the tail instead of bucketing it | 11 tests |
| add `--chart-6` to the palette | 15 tests |

**The five-colour ceiling, in order of strength.** `ChartColorVar` is a closed union of exactly the
five variables `globals.css` defines, so no expression can *name* a sixth. `SERIES_LIMIT` is
derived from `CHART_COLOR_VARS.length`, so ceiling and palette cannot drift. And `paint` assigns
colours by iterating the **palette**, not the series — a series with no colour to take cannot be
emitted, so `colorVar` is non-optional on the way out and needs no fallback, which is what a
transparent series is made of. Stated honestly: *editing the palette constant* still typechecks;
what is unreachable is a colourless series and any request for a colour the union does not name.
The canary test fails immediately if the constant is edited.

### Six observations recorded, none re-decided

1. **`SeriesViewModel.points[].value` is `number | null` in § 3.1; `capSeries` never emits `null`.**
   A sum over no rows is 0, not unknown, and 0 is what a stacked area needs. A rate-shaped metric
   whose empty bucket is genuinely unknown is not a sum and needs its own producer.
2. **§ 3.1's `SeriesViewModel` sketch has no field for R-V6 inertness.** Components may only
   type-import from `src/domain`, so without one they would have to string-compare `"other"`. An
   `inert: boolean` is emitted per series; **ticket 28 should carry it through rather than drop it.**
3. **`seriesKeysOf` returns an array, not one key** — R-V3's Team dimension is non-additive, and a
   single-key signature would silently undercount a multi-Team Member. Matches `aggregate.ts`'s
   `place`.
4. **R-V4 names no identity for the "Other" bucket.** The key `"other"` is reserved, and the
   collision is a guarded impossibility: a fixture test asserts no committed Member, Team,
   Repository, WorkType, model id, family or tier key equals it.
5. **A8's "the prior period holds zero" is read as the prior *figure*, not the prior row count.**
   They coincide for count measures; they differ for something like an accepted-session count over
   a period with rows but zero acceptances, where the ratio has no base and is suppressed. The
   alternative reading is recorded.
6. **One thing the suite cannot catch.** A "configurable magnitude threshold defaulting to zero"
   would pass every behavioural test above by construction. The defence is structural —
   `changeBetween` takes no options object, `Comparison` is closed, and `CHANGE_SUPPRESSIONS` is a
   closed vocabulary with a canary — plus review. Worth knowing the tests are not the guard there.
