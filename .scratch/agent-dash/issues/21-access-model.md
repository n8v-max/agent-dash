Type: implementation
Status: resolved
Blocked by: 20
Label: resolved

# Permission matrix as a pure function

## Goal

`src/domain/access.ts` — the two-dimensional access matrix (subject scope × datapoint class)
implemented as a pure row filter, with both shipped presets expressed as data.

## Scope

- Scopes: `self`, `peer`, `team`, `peer-team`, `org`, `org-member`. Classes: `jobs`, `tokens`,
  `cost`, `access`. A permission is one cell; **it is not a level on a single ladder** and must not
  be implemented as one.
- Roles are **data**, not an enum (`CONTEXT.md` § Access).
- Two presets (R-A3):
  - **Open default** — `org-member` over `jobs`, `tokens`, `cost`, `access`.
  - **Restricted** — `self` over `cost`; `team` over `jobs` and `tokens`; **no `access`**.
- **Aggregated vs identified is a separate grant.** `team` resolves totals but not names;
  `org-member` resolves names. This distinction does no work in the default configuration, which is
  exactly why it needs implementing deliberately rather than falling out.
- **The filter runs on rows, before aggregation** (R-T17). Filtering a computed aggregate leaks by
  arithmetic; filtering rows does not.

## Done when

**T-U10** passes: all 24 cells asserted table-driven, both presets cell by cell including the
negatives, the aggregated/identified distinction, row-level filtering asserted on the *input* to
aggregation, and symmetry under the open default.

## Notes

ADR-0003 is the position: individual usage and spend are **open org-wide by default, symmetric, no
minimum-population floor at any scope or class**. The matrix is the *mechanism*, not the default —
it exists so visibility *can* be restricted, and the restricted preset ships precisely so the
mechanism is demonstrable. A grid where every cell is granted is indistinguishable from having no
grid.

Read ADR-0003 in full before implementing. It records two superseded positions, and the reasoning
that lost is the substance of the decision.

## Comments

### 2026-09-07 — implemented (AFK build, wave 3)

Gates green: `lint` · `typecheck` · `test` (186 tests) · `test:coverage` (100% statements /
100% branches; `access.ts` clears its own per-file 95/90 group) · `build`.

`src/domain/access.ts` plus `access.test.ts` (98 tests). The tests use **inline fixtures only** —
they read no file and import nothing from `src/data`, so the matrix is proved as a pure function
over rows exactly as P4 asks.

**Scopes are not a ladder, structurally.** There is no ordering, no comparison and no `>=` in the
module. `SCOPE_RESOLUTION` carries the aggregated/identified dimension as its own explicit table
(`self`/`peer`/`org-member` identified; `team`/`peer-team`/`org` aggregated), derived from nothing.
`scopesCovering(viewer, subject, membership)` is the **population** relation and knows nothing
about any Role — which is what keeps the matrix's two dimensions genuinely independent rather than
one falling out of the other.

**R-A3.1 is an invariant, not preset data.** `holds()` returns true for `self` ahead of consulting
the grant list, so **no Role can express a violation of it**, and a test asserts no preset
*authors* a `self` cell. The two load-bearing consequences are asserted directly: a `team`-only
viewer's `identifiedSubjects` is exactly their own id, so `/demo/people` is not empty; and the
restricted preset reaches `self × access`, so a narrowed viewer can reach the matrix explaining
why.

**T-U10, clause by clause.** A `CELLS` table of 24 explicit rows, each carrying both presets'
expectation, with a guard test proving the table is exactly the cross-product — 24 entries, none
repeated, none missing — so it cannot silently lose a cell. The open default's 16 negative cells
and the restricted preset's 18 are asserted, not skipped. Non-ladder behaviour has its own block
(`org-member` does not imply `org`/`team`/`peer`; a grant on one class does not leak onto another).
Aggregated-vs-identified is shown where it actually bites: `peer` and `team` reach **identical
rows** and differ only in resolution. Symmetry is `it.each` over three membership pairs × four
classes, plus "every Member's `grantMatrix` is identical" — no administrative tier — and a Team of
one is shown rather than suppressed, so there is no minimum-population floor.

**R-T17 is asserted on the input, not the output.** A `vi.fn()` aggregation is called with
`filterRows(...).rows` and the assertion inspects `aggregate.mock.calls[0][0]` — the argument the
aggregation actually received — checking the below-grant row is absent both by id and by object
identity. A companion test shows the post-hoc alternative would have summed 150 where the row
filter yields 10, so the difference between filtering rows and filtering aggregates is a number in
the suite rather than a claim in a comment.

`roleFor()` maps the fixture's `Member.role` strings onto presets and **fails closed** to a
documented `SELF_ONLY_ROLE` floor on anything unrecognised. That floor is explicitly *not* a third
shipped preset; returning `undefined` instead would invite a caller to write
`?? OPEN_DEFAULT_ROLE`, which widens access on a typo.

One lint conflict was resolved structurally rather than waived: a `Record<SubjectScope, fn>` made
`peer-team` and `org-member` object-literal *methods*, which strict `naming-convention` rejects
(the `objectLiteralProperty` exemption does not cover function values). Rewritten as an ordered
tuple array, which also removed a partial-lookup fallback branch.

### This ticket's Scope line is stale — the spec overrides it

The Scope above gives the restricted preset "**no `access`**". `spec.md` § 11 **C6** resolves
exactly this and overrides it: under the literal reading the matrix renders for *nobody*, which
collapses both ADR-0003's "restricted presets ship so the mechanism is demonstrable" and ticket
07's reason for siting the matrix on `/demo/people`. R-A3's own table gives the restricted account
"`self` over all four classes · `team` over `jobs` and `tokens`". Implemented per the spec.
Neither the ticket nor any spec was edited.

### Escalation — A28 and T-E8 contradict R-A10, and this is not ours to settle

`spec.md` acceptance criterion **A28** and `testing-spec.md` **T-E8** both read "the permission
matrix renders for the open account and **not** for the restricted one". That directly contradicts
**R-A10** — *"under R-A3.1 both accounts hold `self` over `access`, so **both see it** — the open
account showing the full matrix, the restricted account showing its own grants"* — and § 11 C6,
which is the later resolution. A28 and T-E8 appear not to have been updated when C6 was settled.

**Owned by tickets 35 and 38** (rendering), not by this one. One hazard worth naming: A28's
traceability row points at **T-U10**, i.e. this ticket's test. T-U10 asserts the domain fact — both
Roles hold `self × access`, and `grantMatrix` differs between them — which is consistent with R-A10
and C6 and inconsistent with A28's prose. **Whoever resolves A28/T-E8 should not expect T-U10 to
back the "not for the restricted one" reading.** Flagged for the human; not re-decided here.
