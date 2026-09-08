Type: implementation
Status: ready-for-agent
Blocked by: 48
Label: ready-for-agent

# A malformed upstream row never reaches a tile

## Scope

Tests over `src/data/load.ts`: a session with negative cost, unknown work type, child pointing at
a missing root, `ended_at` before `started_at`, or a token usage naming an unknown model must fail
load with the file name, row index and field in the error. One test per case. The query facade
must never be reachable with an invalid dataset: assert `load()` is the only entry.

## Done when

Six failing-row tests pass; the error message format is asserted.
