Type: implementation
Status: resolved
Blocked by: 40
Label: resolved

# Subject = Member draws ranked bars; Cost by Repository reads months

## Goal

Five overlapping lines plus "Other" is unreadable. Twenty-three groups of five bars is unreadable.

## Scope

1. **Subject = Member** on every time-series panel renders one horizontal bar per Member for the
   selected period, sorted by the panel's measure, top-N plus "Other" as today. No time axis at
   Member subject. Table mirror is one row per Member.
2. **Cost by Repository** ignores the page grain and reads months, with the same one-line note
   Total spend uses.
3. Chart frame gains a `form: "series" | "ranked"` input so the query, not the panel, chooses.

## Done when

- Unit: ViewModel for `subject=member` carries `form: "ranked"` and rows sorted descending.
- e2e: `/demo/spend?subject=member` renders no `<path>` line series and one bar per Member.
- e2e: `/demo/spend?grain=week` Cost by Repository mirror has month keys.

## Notes

Decided by the human, 2026-09-09, rounds 2 and 3.

## Comments

### 2026-09-09 — implemented (AFK build, wave 2, on `main`)

`lint` clean · `typecheck` clean · `test` **1256** across 57 files · `test:coverage` 98.2% statements
/ 88.7% branches · `build` all routes as before · `e2e` **132** passed (128 existing + 4 new).

**Item 3 first, because 1 and 2 fall out of it.** `ChartViewModel` gains `form: "series" |
"ranked"` (`src/domain/viewmodel.ts`, R-V12), supplied by the query exactly as `stackable` is.
`shapeFor` in `chart-shapes.tsx` is the only expression that reads it, and it overrules whatever
shape the panel named — Cost per completed Job still asks for `line`, and at `subject=member` a
line has nothing to run along. `chartElementFor` resolves the form once above its switch, so the
furniture and the marks cannot be laid out for two different shapes.

**The ranked geometry is the one `/demo`'s WorkType tile already ships**, not a second one: the
groups are the bars, painted from the capped series set, over a single bucket, and R-V5's
whole-range ranking is the order. That is why nothing new was written in `chart-shapes.tsx` beyond
the shape override and one axis decision.

**`panels.ts` decides the form once for the three panels the subject control reaches** —
`/demo/spend`'s Cost per completed Job and Cost per session, `/demo/work`'s Completed Jobs per
period — through `FORM_OF` beside the existing `GROUPING_OF`. `subjectAxis` collapses the page's
buckets into one covering the whole selected period for a ranked panel and hands back the page's
own buckets otherwise, so no panel chooses either.

**The R-X1 mirror is transposed for a ranked chart** — one row per Member, headed by the grouping,
which is what the ticket's item 1 asks for. A table of one row and twenty columns would be the
accessible statement of exactly the chart this ticket removes. `queries.test.ts`'s R-T7
cross-check now sweeps the two ranked pages beside the six series ones and reads the transposed
mirror back the other way round before comparing, so the two derivation paths are still checked
against each other over real data.

**Cost by Repository now reads `view.months`** and carries the note. Per-capita still divides it,
it is still flat, and the panel beside it still honours the page's grain — both asserted.

#### Decisions taken under the escalation rule

**The shared monthly note is now one generic sentence, not Total spend's.** The ticket says to
reuse the note rather than write a second one, and the note as it stood named Total spend and gave
the seat-fee reason — false on a repository panel, which *can* be computed weekly and simply reads
badly there. Reusing it verbatim would have put a false sentence on the page. So `MONTHLY_NOTE`
was generalised to state the consequence both panels share ("reads months whatever the page grain
is … reported at monthly grain and coarser only") and each panel's own reason stays in its own
`question` copy, where Total spend's already was. **The cost:** R-M5's seat-fee reasoning is no
longer in the ViewModel's `note` field, only in the panel copy above it. A25's test now asserts the
sentence renders **twice and identically**, which is the difference between reuse and duplication.

**A ranked chart's category axis is hidden; its measure axis is not.** One bucket is one tick, and
the 120px category gutter Recharts reserves for it was a sixth of the panel spent restating a
period the mirror's column header and the page's own filter line both already name. The measure
axis stays, because unlike R-N8's tile this is a full-width panel and five bars of money want a
scale. Recorded here because it is a third axis knob beside `bare` (R-V11) and `axes` (R-N8), and
because it is decided from a domain fact rather than from a prop.

**The period label on a ranked chart is composed from its own bucket labels** — `"Week 15, 2026 –
Week 37, 2026"`, or the single label where the range holds one bucket. It is not a new formatter:
`bucketLabel` never sees the synthetic `range` key. A range the period planner rejects yields no
bucket and no cell, which renders R-V9's empty panel rather than one bar under a blank label.

#### Left undone, deliberately

**`/demo`'s WorkType breakdown tile stays `form: "series"`.** It is geometrically the same chart
this ticket introduces — one bucket, groups as ranked bars — and giving it `form: "ranked"` would
transpose its mirror into five rows, which is arguably the better accessible statement. It was
left alone because it is a shipped surface this ticket does not name, and the change would rewrite
three assertions across `summary-tiles.test.tsx` and `e2e/summary.spec.ts` for no requirement.
The next ticket to touch that tile should take it.

**"Other" on a ranked *ratio* panel is still a sum of averages** (R-V4, R-V6). That is pre-existing
— it was already true of the line chart this replaces — but a single bar makes it more visible: on
`/demo/spend?subject=member` the "Other" bar is the longest on the chart because it adds four
Members' cost-per-Job together. Worth a ticket; out of scope here.

**The legend renders alphabetically while the bars render ranked.** Pre-existing Recharts/shadcn
behaviour, visible identically on `/demo`'s tile today. Colours match, which is what R-T8 and T-C3
protect, so nothing is wrong — but the reading order of the two disagrees.
