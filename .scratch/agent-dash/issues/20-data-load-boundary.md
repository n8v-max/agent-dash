Type: implementation
Status: ready-for-agent
Blocked by: 19
Label: ready-for-agent

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
