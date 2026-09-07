Type: implementation
Status: resolved
Blocked by: 19
Label: resolved

# Data load boundary and the hidden-session invariant

## Goal

`src/data/load.ts` — the only place in the application that reads JSON — parsing, validating and
caching the committed fixtures, with hidden sessions removed once and for all.

## Scope

- Parse and runtime-validate every fixture file against `src/data/schema.ts`. A missing session
  file is a fault, not a valid state (R-D19, T-F1).
- **Strip hidden sessions at parse** (R-M2). This is an invariant of the dataset, not a query
  option: nothing downstream can forget it, and no code path returns a hidden row.
- Cache per process. The dataset is static and committed.
- Domain types per `technical-spec.md` § 4, mirroring `CONTEXT.md` exactly — including the UI
  aliases living in a display map, never in a type name (R-T9). `Task` in code, "Job" in copy;
  `WorkType` in code, "template" in copy.
- `cost` is read, never computed (R-T11). There is no pricing function anywhere in the app.

## Done when

**T-U5** passes: the same query over the same rows returns different counts with and without the
filter, and a test asserts there is no code path returning hidden rows.

## Notes

R-D12 generates ~2% hidden sessions **precisely so the exclusion rule has something to act on**. If
they never existed the rule would be untestable. This is the cheapest, sharpest test in the suite —
do not let it become vacuous by filtering them out of the fixture instead.

## Comments

### 2026-09-07 — implemented (AFK build, wave 2)

Gates green: `lint` · `typecheck` · `test` (88 tests, 6 files) · `test:coverage` · `build`.
Coverage on the new code is 100% statements / 100% branches, so the `src/domain/**` per-file
95/90 group passes with room. No new dependency — `src/data/schema.ts` is ~40 lines of
hand-written combinators.

Created: `src/domain/types.ts`, `src/data/schema.ts`, `src/data/load.ts`, and four test files
(`load.test.ts`, `schema.test.ts`, `types.test.ts`, `boundary.test.ts`).

**T-U5's two halves are both real assertions.**

*(a) The same query over the same rows returns different counts with and without the filter.*
The test reads all 25 session files itself — 757 rows, 15 hidden — and runs two queries
(`countByWorkType`, `totalCost`) over the raw rows and over `loadDataset().sessions`. The
work-type counts differ, the row count is exactly `raw − hidden`, and the cost delta equals the
hidden rows' cost to six places. A guard test asserts the fixture still holds hidden rows at all,
so R-D12 keeps the test from going vacuous — which is the failure mode the ticket's Notes warn
about.

*(b) No code path returns a hidden row.* Four assertions, not a comment:

1. A structural walker recurses any value graph looking for `hidden === true`, and is **first
   proved against the raw rows** — a positive control, so a broken detector cannot silently pass
   everything below it.
2. The module's runtime surface is pinned: the exported functions must be exactly
   `["loadDataset", "readDataset", "readFixtureFile"]`. A new export that could leak lands here.
3. Every dataset-producing path is walked and must hold no hidden row — including a reader dosed
   with a file whose rows are *all* `hidden: true`, which still yields zero.
4. Arity is asserted, so an `includeHidden` flag cannot be added without failing, and a source
   scan asserts `hidden` is read in exactly three files: `domain/types.ts` declares it,
   `data/schema.ts` validates it, `data/load.ts` strips it. Anywhere else fails.

That last one is a deliberate tripwire: a later ticket with a legitimate reason to read the field
will fail it, and that is the point — it forces the decision to be made rather than made in
passing.

**Fault model.** Everything throws `FixtureFault`; nothing is coerced, defaulted or dropped, and
no partial dataset is returned. Expected session filenames are **derived** from
`repositories.json` × `work_types.json`, so the data declares its own matrix and R-D19 is checked
against it rather than against a hardcoded list. `mobile-app__deploy.json` holding `[]` loads
fine, and that contrast is asserted. Beyond shape, two structural checks: a row filed under the
wrong `(repository × work_type)` pair (it would be counted under the wrong repository by every
grouping) and a duplicated session id (it would double-count every measure). Unknown extra keys
are ignored on purpose — R-T19 gives the GitHub-shaped files a simplified envelope, and rejecting
extras would reject the real API's shape.

**`next.config.ts` was modified — the one pre-existing file touched.** Next's file tracing follows
*imports*, and `load.ts` names the fixture path at runtime, so the JSON would not be traced into
the server bundle. Without `outputFileTracingIncludes`, this boundary passes every gate here and
throws its R-D19 fault in production. Nothing imports `load.ts` yet, so the build does not
currently exercise the path; **ticket 28 is the first real test of it** and should confirm the
fixture is present in a production build.

**Two things deliberately not done, both recorded rather than decided:**

- **No third UI alias.** `TERM_DISPLAY` carries `repository`, `member`, `team`, `model` and
  `agent_session` at their unchanged names so "Repository has no alias" reads as a decision rather
  than an omission, and the test asserts exactly two entries are *renamed* (`task` → "Job",
  `work_type` → "template"). `agent_session` was not shortened to "Session": R-T9 says there are
  exactly two aliases, and inventing a third is a glossary change, not a code one.
- **`hidden` stays on the `AgentSession` type.** A separate `VisibleSession` type without the
  field would make the invariant type-level and is tempting, but `technical-spec.md` § 4 lists
  `hidden` on the type and R-T9 says types mirror the spec exactly. Recorded as an option, not
  taken.
