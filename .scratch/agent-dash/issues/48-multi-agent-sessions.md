Type: implementation
Status: resolved
Blocked by: 40
Label: resolved

# Multi-agent: child sessions roll up to a root session

## Goal

The model has one agent per AgentSession. A sub-agent fan-out creates extra sessions on the same
Task, which the Rework and Decomposition rules count as retries. On a multi-agent platform the
differentiator metric is wrong.

## Scope

1. **Schema**: `parent_session_id: string | null` on AgentSession. A root has `null`. A child
   inherits Task, Member, Repository, WorkType and `execution_mode` from its root; the fixture
   validator rejects a child that disagrees.
2. **Glossary**: `CONTEXT.md` § Work gains **Root session** and **Child session**. Rework,
   Decomposition, Completed Task, Acceptance rate and Cost per session are defined over root
   sessions. A child never carries `accepted`; the root does.
3. **Domain**: `taskFacts` groups children into their root before deciding rework and
   decomposition. Session cost, tokens and duration of a child roll into the root for every
   aggregate. Session count means root count; a "Agents per session" reading is added to the
   Session duration panel (median, p95).
4. **Fixture generator**: ~20% of roots spawn one to four children, weighted toward
   `implementation` and `headless`. Children start after the root and end before it. Rework and
   Decomposition rates in `targets.mts` are unchanged and must still hit.
5. **History**: a root row expands to show its children indented, each with model mix and tokens.
   Hidden rule applies to children as to roots.
6. **ADR-0008** records the decision and the one it reverses in ticket 08 (one agent per session).

## Done when

- Unit: a Task with one root and three children, root accepted, is neither rework nor decomposition.
- Unit: cost of a root equals its own cost plus its children's.
- Invariant test: every child's parent exists, is a root, and shares the five inherited labels.
- Headline figures on `/demo` for Aug 2026 change only by the roll-up; Completed Jobs is unchanged.
- e2e: History expands a root to show child rows.

## Notes

Decided by the human, 2026-09-09, round 1: multi-agent is built; BYOK is an ADR only (ticket 57).
If the generator cannot hit the rework target with children present, lower the child share and
record the number in this file.

## Comments

### 2026-09-09 — implemented (AFK build, wave 2, straight to `main`)

`lint` clean · `typecheck` clean · `test` **1,348** across 61 files · `test:coverage` 98.3% / 88.8%
· `build` clean · `e2e` **152 passed** across both projects. The regenerated fixture is
byte-identical on a second run (T-F9).

**The child share is 20% of visible roots, one to four children each, and the rework target needed
no lowering.** 148 of 742 roots fan out to 292 children; 1,049 rows on disk. R-D8 came out at
18.1% Rework and 12.1% Decomposition — *exactly* the figures the fixture carried before children
existed — because the fan-out is drawn **last, from finished rows**, and Rework and Decomposition
are arrangements of roots that `tasks.mts` had already fixed. The escape hatch in this ticket's
Notes was not needed and the numbers in `targets.mts` are the authored ones.

**The constraint that actually bit was R-D4's seat share, not R-D8.** A child's cost is real
session spend, and the sharpest finding in the product is a ratio with session spend in its
denominator. A "plausible-looking" sub-agent costing what a root costs would have pushed the share
from 48.2% to ~38% and out of its authored band. So a child is small **in both dimensions at
once** — 12–30% of its root's machine allocation, and that same fraction of its root's tokens,
taken per Model. Session spend rose 8.4% and the seat share landed at **46.2%**, inside the band.
Scaling the token parcels rather than re-drawing them is also what left R-D16's tier shares and
R-D17's monthly frontier trend untouched: a fan-out uses the models its root was already using.

**Where the roll-up happens: once, at parse.** `load.ts` returns roots carrying their children's
cost, tokens and duration spans, plus a `childSessions` map for `/demo/history`. Every other
surface was untouched by the change, which is the point — a per-query fold is a fold somebody
eventually forgets. `taskFacts` *also* drops children on its own, because Rework is defined over
roots and a definition that only holds because of what an upstream caller did is enforced nowhere.

**Headline figures on `/demo` for Aug 2026 changed only by the roll-up.** Completed Jobs is
**150**, before and after, and August still holds 247 attempts. Verified by reading the committed
JSON at `HEAD` and after regeneration and comparing directly, not by trusting a green test.

### Decisions taken here, with their costs

- **`machine_spec` is inherited by a child, and is not one of the five labels the loader
  enforces.** The ticket names five; a fan-out running on a different machine class is legal in
  the model and simply does not occur in this fixture. Cost: the generator's choice is a shaping
  decision rather than a rule, and `INHERITED_LABELS` says so.
- **The fixture seeds no hidden child.** The Hidden rule is uniform because the strip is on the
  row and not on its parenthood, and the new fault `parent-hidden` makes a *visible* child of a
  hidden root impossible. So the rule holds for children by construction, but the committed data
  exercises it only on roots. Cheaper, and recorded rather than hidden.
- **The folded cost is rounded to whole cents.** `4.23 + 0.09` is `4.32` in the unit money is
  denominated in and `4.319999999999999` in binary, and the folded row stands in for a stored row
  on every surface that reads one. This is not the application pricing anything (R-M4) — it is
  refusing to invent a figure no attribution produced.
- **A child's `prompt_count` is 0 and its `artefacts` are `{}`.** Nobody types at a sub-agent, and
  the artefact is the root's. Neither field is aggregated anywhere, so this is a modelling choice
  with no figure behind it.
- **`.scratch/agent-dash/map.md` was not updated.** It is the wayfinder for the pre-spec phase and
  its ADR list closes at the `/to-spec` handoff; ADR-0008 is a build-phase decision and lives in
  `docs/adr/` and in the three specs. Recorded so the omission reads as a choice.

### Two tests were sharpened rather than loosened, and both were pre-existing fragilities

- **T-C1's mirror equality (`src/data/queries.test.ts`)** started failing on the last decimal place
  of one "Other" cell. The two derivation paths R-T7 exists to keep apart summed the *same* tail of
  sixteen ratios in two *different* orders, and floating-point addition is not associative. Fixed
  at the seam: `capSeries` now carries the swept **keys** in R-V5's ranked order and the mirror
  adds them in that order. The assertion is untouched.
- **T-E9's third assertion** ("no payload carries a literal of every one of the four compute
  rates") became false on `/demo/history` for exactly the reason `e2e/secondary.spec.ts`'s own
  header predicted: 1,034 rows put all four rate *values* on the page as session costs. The claim
  is unchanged and the search was sharpened to the test's own name — the four rates must never
  stand within **one rendered card's length** of each other. The threshold is the leaked card's own
  length, so it cannot drift from what it describes.

**T-E4's search set had to learn the roll-up**, which is a fact about the fixture and not a
concession: a root's serialised cost is now its tree's, and `/demo/history` additionally prints
each child's own cost. `e2e/support/fixture.ts` restates R-M19 as it already restates R-M2 and the
period arithmetic. One further class was subtracted — the **count** quotients (acceptance, Rework,
Decomposition) over the viewer's **Team**, which R-A3 grants over `jobs` — after `/demo/work`, a
page carrying no money figure at all, failed on `0.43` and `0.07`. A count over a count cannot be
a cost, so nothing about the money claim was weakened; the named guards (`24.39` in the set,
the own-aggregate and own-quotient collisions out of it) all still hold, over a set of 384 from
612 candidates.

### Left undone, deliberately

- **A child is never surfaced as its own row anywhere except `/demo/history`.** There is no
  "agents" filter, no fan-out column on the table, and no per-child sorting. R-N19's ten columns
  are a requirement and this ticket did not widen them.
- **Nothing reports on the fan-out as a metric of its own** beyond Agents per session on the
  duration panel — no trend, no per-Repository breakdown. R-M1 is a closed inventory and adding a
  second multi-agent metric is a spec decision, not an implementation one.
- **The tree stays one level deep.** A grandchild is a fixture fault. If sub-agents ever spawn
  sub-agents the roll-up becomes a traversal, and ADR-0008 names `childFaults` as where that
  change would start.
