Type: implementation
Status: ready-for-agent
Blocked by: 51
Label: ready-for-agent

# Mutation score on `src/domain`, once

## Scope

Add Stryker with the Vitest runner, scoped to `src/domain/**`. Run once locally. Record the score,
the surviving mutants by module, and the run time in this file. Add a `pnpm test:mutation` script.
No CI gate. Fix any survivor that reveals a missing test in under thirty minutes; list the rest.

## Done when

Score recorded here and in README § Test posture.
