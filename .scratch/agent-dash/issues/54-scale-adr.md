Type: implementation
Status: resolved
Blocked by:
Label: resolved

# ADR-0009 — what changes at ten million sessions

## Scope

One page. State: today everything is in-process over a static fixture. At 10M sessions per org
per year the seam holds because the domain reads pre-aggregated rows at (day × member × repo ×
work_type × model) grain; History alone reads raw rows, paginated. Name where the pre-aggregation
runs, what stays computed at request time (ratios, top-N, change), and the one query that does
not fit that grain (Rework, which needs Task grouping) and how it is served. Give one number per
claim: row counts, expected p95 for a Spend page read.

## Done when

`docs/adr/0009-scale.md` exists, linked from README.

## Comments

### 2026-09-09 — recorded (AFK build, wave 2, worktree `agent-dash-t54`)

`docs/adr/0009-scale.md`. **0009 was free** — 0010 (BYOK, ticket 57) is numbered above it and the
sequence had a hole at 0009. No spec, testing-spec or ADR identifier was allocated: the document
cites `R-M2`, `R-M7`, `R-M10`–`R-M14`, `R-M18`, `R-M19`, `R-A6`, `R-C2`, `R-N9`, `R-N20`,
`R-N20.1`, `R-T5`, `R-T17`, `R-T36`, `R-V1`, `R-V3`, `R-V4`, `R-V12`, `R-D4` and `R-D19`, all of
which already exist, and introduces none.

**No file under `src/` or `e2e/` is touched.** The diff is one new markdown file.

#### What is recorded

The grain `(day × member × repo × work_type × model)` in the Organization's **civil** day; the
pre-aggregation running on the **write path** in the ingest pipeline, taking R-M2's hidden strip and
R-M19's child roll-up with it; ratios, top-N and change staying at request time with a separate
argument for each; Rework served from a second `(day × task_key)` fact; `/demo/history` moving to a
server-side keyset page; and the line the whole thing rests on — **the store may sum, only the
domain layer may divide, rank, compare or partition.**

#### How each number was derived

Every figure is measured, and the arithmetic is in the document beside it.

**Row counts** were counted over the **post-roll-up** population — the rows `load.ts` actually
produces, hidden dropped and children folded at their *root's* day and labels — not over the 1,034
visible rows, which was the first and wrong reading. On that population: 742 roots, 1,091 distinct
`(attempt × model)` token entries (1.470 per attempt), 733 session-fact cells, 1,075 token-fact
cells, 703 Task-day cells. The three collapse ratios are 1.012, 1.015 and 1.055 — **all
essentially 1**. Scaled to 10M root sessions/org/year that gives 9.9M + 14.5M + 9.5M = **33.9M
rows/org/year, ~92,800/day**, against 28.8M raw rows: the pre-aggregate is **18% larger than the
data it summarises**. That is the headline finding and it is the opposite of what "pre-aggregation"
usually implies, so it is stated rather than buried: the win is the re-keying, not the size. The
ceiling is used for the p95 budget; a density-corrected estimate (~4.3M for the session fact) is
given beside it with its one assumption named.

**The p95** is a four-row budget summing to **150 ms**, against measurements taken in-process under
Vitest on this machine: `readDataset()` 8.20/9.51 ms p50/p95 over 1,049 rows; `spendPage()`
**23.83 ms p50, 24.66 ms p95** over the whole fixture and all seven R-N9 panels; `rollUp(…,
"member")` at 5,000 Members over 1,000 / 60,000 / 200,000 rows, giving 4.33 / 10.34 / 17.05 ms p95
and a **76 ns/row** asymptote. The store term is the only one not measured, and rather than assume
a vendor figure the document states the **pessimistic bound** — the same hash `GROUP BY` in
JavaScript, 13.2M rows/s, which would put the 8.35M-row scan at **635 ms** — and names exactly what
the claim requires: **≥62M rows/s, 4.7× `rollUp`'s rate in V8.** The trigger for a month-grain twin
falls out of the same arithmetic at **about five months** of range.

#### What was checked against the code, and what it changed

- **`History alone reads raw rows, paginated` is only half true**, and the document says so.
  `queries/history.ts` builds a `HistoryRow` for *every* readable session in the range and hands the
  whole array to `tableViewModel`; `PAGE_SIZE = 50` is a client slice, and R-T36 says it outright —
  *"paginates client-side at 50 for readability, not for performance"*. At 10M sessions one day is
  ~27,000 rows crossing the RSC boundary, so the ADR records the move to a keyset page rather than
  asserting the pagination already exists.
- **The stated grain is one column short.** `src/data/params.ts` carries two session-level
  *filters* that are not group-bys — `accepted` (read by `/demo/spend`'s Cost per session panel)
  and `executionMode` (`/demo/work`), both R-C2 panel-local controls. A filter has to be in the key
  or it cannot be applied, so the session fact carries both. Measured widening: **1.037×** (707
  cells → 733). This is the correction that only came from reading `params.ts`.
- **Cost cannot sit on a model-keyed row.** `AggregationInput` in `src/domain/aggregate.ts` carries
  no model field, deliberately (R-M7), so the grain is **one key with two measure groups in two
  tables** — money and session measures on the model-free projection, tokens on the full key.
- **ADR-0008's roll-up is not day-local.** A child starts after its root and may cross midnight, so
  its cost belongs to its *root's* civil day. Counted: **11 of 292 children (3.8%) start on a later
  civil day than their root.** A per-day map/reduce partitioning on the child's own timestamp gets
  3.8% of every day-grain cost figure wrong, silently. That is why the ADR fixes an order between
  two pipeline jobs and makes the day cell an upsert.
- **Rework's predicate reduces to sums.** `factsFor` reads
  `ordered.slice(0, -1).some((s) => !s.accepted)`, and the ADR shows that over any range this is
  `N − (lastAccepted ? 0 : 1) > 0` from a `(day × task_key)` fact carrying roots, non-accepted
  roots and the acceptance of the day's last root. Decomposition and Completed fall out of the same
  three columns. The reduction is what makes a *range-independent* fact possible; a materialised
  per-Task boolean is not, and that is recorded as a rejected alternative with its counter-example.

#### Escalated decisions

**Where the store's `GROUP BY` stops and the domain layer starts.** The specs do not settle it, and
letting the store compute the aggregates would make the 200 ms budget trivially safe. Chose the
**cheaper-to-reason-about** option — the store may only collapse dimensions the page does not
display — and recorded the cost in the ADR: the p95 now depends on a store scan rate that is the
one unmeasured number in the budget, where the alternative would have moved R-V3, R-M14, R-V4 and
R-V1 into SQL, out of reach of every unit test in this repository. That reverses ADR-0006 by the
back door and is listed under *Alternatives* as rejected.

**The month-grain twin is not specified, only triggered.** Deciding its exact columns now would fix
a shape against a density nobody has measured. The trigger — a single read's day-grain scan
exceeding ~10M rows, about five months of range — is recorded instead, together with the fact that
it cannot serve week buckets, so a week-grain read over a year is the shape that will break first.

#### Left open

- **The README does not exist** (ticket 49, last in the wave), so the Done-when's *"linked from
  README"* is **not satisfied here** and no README was written. Ticket 49 must link
  `docs/adr/0009-scale.md`. Ticket 55's `docs/ingest.md` links to the same path, which is why it
  did not move.
- **The grain forecloses dimensions not functionally determined by it.** `execution_mode` was
  caught because it is already a filter; the next one added will need a wider key and a full
  backfill. Recorded under *Reversibility* as the thing to argue with before the first backfill.
- **ADR-0009 and ADR-0010 interact at one line.** If BYOK is accepted, its vendor-billed total must
  be summed before a hidden root's tree is discarded — and under this decision "before" means in the
  pipeline, not in `load.ts`. Neither ADR is blocked by the other; the constraint is noted in both
  directions here and under *Consequences* there.

#### Gates

`pnpm lint` clean · `pnpm typecheck` clean · `pnpm test` **1,379 passed across 63 files** ·
`pnpm build` clean, all six `/[org]` routes dynamic as before. `test:coverage` and `e2e` skipped
under the wave rule: the diff contains no file under `src/` or `e2e/`. The measurement harness was
a temporary Vitest file under `src/data/`, run and deleted; `git status` is clean apart from the
new ADR.

