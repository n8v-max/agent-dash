Type: implementation
Status: resolved
Blocked by: 48
Label: resolved

# A malformed upstream row never reaches a tile

## Scope

Tests over `src/data/load.ts`: a session with negative cost, unknown work type, child pointing at
a missing root, `ended_at` before `started_at`, or a token usage naming an unknown model must fail
load with the file name, row index and field in the error. One test per case. The query facade
must never be reachable with an invalid dataset: assert `load()` is the only entry.

## Done when

Six failing-row tests pass; the error message format is asserted.

## Comments

### 2026-09-09 — implemented (AFK wave 2, worktree `agent-dash-t53`)

`lint` 0 errors · `typecheck` clean · `test` **1368** across 63 files · `test:coverage` 98.2%
statements / 88.6% branches · `build` clean · `PORT=3112 pnpm e2e` **152 passed**.

Everything lands in `src/data/fixture-contract.test.ts` (new), with the loader changes it needed in
`src/data/load.ts` and `src/data/schema.ts`. `testing-spec.md` gains § 3.5 with **T-U26** (the six
failing rows) and **T-U27** (the only-entry claim) — both IDs verified free; allocation ran to
T-U25.

**What was already validated, and what I added.** Ticket 48 left more of this enforced than the
ticket assumed, so two of the five named cases needed a test and nothing else:

| Case | Before | Change |
|---|---|---|
| Negative cost | `nonNegative` in `schema.ts`, already naming file, row and field | test only |
| Unknown work type | `oneOf(WORK_TYPE_KEYS)`, same | test only |
| Child naming a missing root | `assertSessionTree` faulted, but named only `sessions:` and the session id | the fault now names `<file>[<row>].parent_session_id` |
| `ended_at` before `started_at` | **not checked anywhere** | added to `schema.ts`; both instants must also *parse* |
| TokenUsage naming an unknown model | **not checked anywhere** | added to `load.ts`, which is where both files are in scope |
| Wrong `(repository × work_type)` pair | `assertPair` faulted, naming the file but no row and no field | now names `<file>[<row>].repository_id` |

The mechanism is a `RowSource` map in `load.ts` — row identity → `<file>[<row index>]`, built as
each pair file is parsed. The schema validators were already handed a path and already produced the
three parts; the cross-row checks were handed a flat list and could name only a session id, so they
now carry the same map. `assertUniqueIds` was moved onto it too, which is why the map is keyed by
row identity rather than by session id: two rows sharing an id must still resolve to two places.

**The sixth case I chose: a row filed under the wrong `(repository × work_type)` pair.** The ticket
names five and asks for six. The remaining validation surface in `load.ts` is four checks — the
pair, duplicate ids, the five child faults, and R-D19's missing file — and the pair check is the
only one of them that is *per-row, per-field and per-file* in the way the ticket's message format
demands: the file name is the only place the pair is declared, so the file is not incidental to the
fault, it is the evidence. The other three are weaker fits: a duplicate id is a fault of two rows
rather than one field; the remaining child faults are the same code path as case 3, so a sixth test
there would be a near-duplicate (and all five are already covered by name in `load.test.ts`); a
missing file has no row and no field to name. A stray row is also the fault with the quietest
failure mode — it is counted under the wrong repository by every surface that groups by one and
reads as ordinary data everywhere else.

**`ended_at` went into `schema.ts`, not `load.ts`.** It is a property of one row with nothing else
in scope, and `load.ts`'s cross-row pass runs *after* the roll-up, by which point a negative span
has already been summed into a root. The same change makes both instants parse-checked: an
unparseable timestamp ranks as `NaN` rather than throwing, so it sorts nowhere, buckets nowhere and
prints "Invalid Date" — the failure T-U23 describes for `dataAsOf`.

**How the only-entry half is proved.** "A test that merely calls `load()` and checks it throws does
not prove the only-entry half", so it is proved three ways, none of them a comment:

1. **The façade's import graph is walked.** `src/data/queries.ts`'s transitive local imports are
   resolved (`@/` alias, relative, `.ts`/`.tsx`/`index.ts`) and asserted: exactly one module in
   that graph imports `node:fs` — `load.ts` — and none imports a `.json`. The graph's size and its
   reaching of `load.ts` and `domain/sessions.ts` are asserted first, so the check cannot pass over
   a graph of one file.
2. **The repository, independently of ESLint.** No source outside `src/data/**` and
   `src/fixtures/**` opens a file or imports fixture JSON — the same zone `eslint.config.mjs`
   draws, asserted so the claim survives lint not running. Nothing but `load.ts` produces a
   `Dataset`, and nothing in the façade's graph names `readDataset` or `readFixtureFile`: the
   reader-injectable doors are test-only. Both have their control assertion, so neither can pass
   because a regex matched nothing.
3. **At runtime.** `node:fs` is mocked to serve one doctored session file, the façade is imported
   fresh, and `summaryPage(viewer, params)` **faults instead of answering** — for a schema fault
   and for a cross-row one — while the same call over the committed fixture returns tiles. The
   fault is asserted by `name` and message rather than `instanceof`, because the module registry
   was reset and the class the façade throws is a different object.

**The malformed rows are built in the test.** Committed rows are deep-copied, one field is
doctored, and the result is handed back through the reader override `load.test.ts` already uses
(P3). Nothing on disk is touched; a corrupted committed file would fail the other 62 test files
rather than this one. Two extra cases keep the *location* honest rather than the rule: doctoring
the last row names the last row (not `[0]`), and doctoring a row in a second pair file names that
file.

**No spec IDs collided and no existing test was weakened.** `load.test.ts`'s existing regexes
(`/wrong pair/`, `/duplicate session id/`, the five `childFaults` names) still match, because the
rewritten messages keep their wording and only gain the location prefix.

**Left undone, recorded.** The token rate card's `model_id`s are still not checked against
`models.json` — only session `token_usage` is. A rate naming an absent model would price nothing
and print nothing, so it is a quieter fault than the one this ticket names, but it is the same
class and lives one file away. `assertKnownModels` reports the first unknown model per row rather
than all of them, which matches every other fault here (all of them throw on the first offender).
