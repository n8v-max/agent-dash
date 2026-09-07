Type: implementation
Status: ready-for-agent
Blocked by: 23
Label: ready-for-agent

# Spend metrics

## Goal

`src/domain/metrics/spend.ts` — Total spend, Cost per session, Cost per completed Task.

## Scope

- **Cost is read from the session row, never computed** (R-M4, R-T11). Cost is attributed upstream
  by the platform's billing system; this application aggregates it and prices nothing (ADR-0005).
  There is no rate-card arithmetic in this file.
- **Total spend = session Cost + Seat cost**, at **monthly grain and coarser only** (R-M5).
  Apportioning a monthly seat fee across days is invented precision. Seats attach to `human`
  Members only.
- **Cost per completed Task** is the product's central claim. Total Cost over a period divided by
  Completed Tasks in it: attempts that produced nothing sit in the numerator and not in the
  denominator, so waste raises the figure. A period with spend and zero Completed Tasks must not
  divide by zero.
- Cost per session, with the `accepted` filter.

## Done when

**T-U12** and **T-U13** pass. Total spend is unavailable below monthly grain (A25), and April's
whole-month seat charge against 19 days of sessions is asserted as **correct-and-flagged, not
corrected** (R-D2).

## Notes

Seat cost is what makes a low-usage Member legible: a seat held against near-zero usage is the
highest cost per unit of work in the Organization, and a consumption-only model cannot see it.
R-D10 puts one such Member in the fixture — the sharpest finding in the product needs a person to
point at.

April is inflated by construction. The partial flag is what stops that being read as a finding.

## Comments

### 2026-09-08 — implemented (AFK build, wave 5, worktree `agent-dash-t24`)

Gates green: `lint` (0 errors; the one warning is ticket 29's pre-existing T-E4 TODO) · `typecheck`
· `test` (443 tests, 68 new) · `test:coverage` · `build`. `spend.ts` alone is **100%** lines,
branches and functions against its own per-file 95/90 gate. Three files, no shared module and no
config touched.

**T-U12.** Session Cost + Seat cost: April `100 + 117 = 217` pure; over the committed window
`4523.63 + 4212 = 8735.63`. Seats attach to `human` Members only — the pure roster carries a
`service_account` with `seat_active: true` that holds none, which is the row the fixture does not
have and the only thing distinguishing a `kind`-blind implementation. `seatShare` over the window
is asserted at **0.4822**, reproducing R-D4's "~48%" from committed data rather than restating it.

**April is asserted correct-and-flagged, not corrected.** April's month is 01–30 with
`partial: true` while the range starts 04-12 — 19 days — and `seatCost === 702 === May's`, with
`seatMonths === 1`. Total spend per completed Task reads **$64.59** in April against **$24.62** in
May: inflated by construction, flagged, and left alone.

**T-U13.** Waste sits in the numerator and not the denominator: 5 sessions / 3 Tasks / $150 with 2
Tasks completed → **$75**, and `expect(completedTasks).not.toBe(3)` pins the wrong reading. Adding a
failed $90 attempt raises it to $120; flipping that Task to accepted lowers it to $50. In the
fixture, April attempted 28 Tasks and completed 15, with the rejected half's cost asserted present
in the numerator.

**Zero Completed Tasks returns a discriminated `defined: false` reading carrying no `value` field at
all** (`"value" in reading === false`), plus the counts and a message. The reasoning, recorded in
the file: `null` is enough for a viewer and not enough for a type — this is `change.ts`'s
suppressed-change shape, so a renderer that has not narrowed cannot print `Infinity` or `NaN`.
`costPerSession` deliberately *does* use `value: number | null`, because over zero sessions the
numerator is necessarily zero too.

**Monthly-grain-only is unrepresentable, following `periods.ts`'s branded-plan precedent.**
`totalSpend` accepts only a `SeatBearingPeriod`, keyed on a module-private `unique symbol` that is
never exported, so the only expression in the program producing one is `seatBearingPeriod()`
returning `ok`. A day- or week-grain Total spend has no representation to render. "Monthly **and
coarser**" needs no new grain: the gate takes one or more monthly buckets and charges `n` whole
months, counted by distinct key so handing the same month in twice cannot charge twice.

One honest gap, recorded in the test header rather than left implicit: *that*
`totalSpend(weekBucket, …)` fails to compile is the whole of A25, and `ban-ts-comment` is an error
here so there is no `@ts-expect-error` to assert it with. It is asserted from the other side
instead — the brand is a symbol, a public-shaped lookalike carries zero own symbols, and the gate
refuses every finer grain at runtime.

**Mutation-checked; six mutations, all caught**, `spend.ts` verified byte-identical afterwards
(`md5` matched):

| Mutation | Caught by |
|---|---|
| Pro-rate a partial month's seat charge (`× 19/30`) | 18 tests |
| Seat count reads `seat_active` and ignores `kind` | 12 tests |
| Every Member holds a seat | 22 tests |
| Non-accepted sessions in the denominator | 15 tests |
| Let week grain through the A25 gate | 4 tests |
| Never take the zero-Completed-Task branch | 5 tests |

Two lint findings were fixed by changing the code, not the rules: three float `toBe` became
`toBeCloseTo(…, 12)`, and a `naming-convention` rejection of an object-literal method keyed
`"not-accepted"` was resolved by replacing the lookup table with a predicate — `not-accepted` is a
control's URL value and should not bend to a formatting rule.

### Two arguments recorded, neither re-decided

1. **The numerator of "Cost per completed Task" is stated two ways.** `CONTEXT.md` says "Total Cost
   over a period divided by Completed Tasks in it"; R-M1 puts no grain restriction on the metric,
   while this ticket and R-D2 both require April's *seat* charge in that numerator — which is only
   possible at monthly grain. Shipped as **both readings, as two functions**:
   `costPerCompletedTask` (session Cost, every grain) and `totalSpendPerCompletedTask` (Total
   spend, monthly and coarser by construction). So the day-grain figure exists without a seat fee
   and the R-D2 figure cannot exist without one. **A spec sentence naming which one each surface
   shows would close this** — ticket 28 and 33 will have to choose.
2. **"Tasks can span repositories" is not true of the committed fixture** — 0 Tasks have sessions in
   more than one `repository_id`, though 118 span work types. `task_key` is `owner/repo#number`, so
   cross-repo may be structurally impossible. The pure test is the only place that case is
   exercised.

### Integration note for ticket 28

`aggregate.ts` has a private `isSeatHolder` (`kind === "human" && seat_active`) that is
character-for-character R-M5's seat predicate, re-declared here as `holdsSeat` because this wave's
agents were told not to touch shared modules. **Export it from `aggregate.ts` and import it here**,
so the seat charge and the per-capita denominator provably cannot disagree about how many people
the Organization pays for. `MemberFacts` is already imported, so the shape is shared; only the
predicate is duplicated.
