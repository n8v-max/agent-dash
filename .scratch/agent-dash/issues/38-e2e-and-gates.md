Type: implementation
Status: ready-for-agent
Blocked by: 32, 33, 34, 35, 36
Label: ready-for-agent

# E2E suite, coverage gates, and CI

## Goal

Close the suite: the structural claims only Playwright can make, plus the gates that keep the seam
and the fixture honest.

## Scope

**E2E (Playwright, Chromium).** Small and structural — ticket 07 designed the surface to give the
suite a clean target: *"one request per account per route, asserting rows rather than pixels."*

Implement **T-E1 through T-E9** per `testing-spec.md` § 5. Asserting rows and counts, never
screenshots.

**Gates:**

- **T-Q2 — `src/domain/**` coverage threshold: 95% statements / 90% branches** (R-T34). The global
  80% is a floor for a codebase that includes glue; the domain layer is pure functions with no I/O
  and no framework. A uniform threshold lets high coverage of trivial rendering code mask thin
  coverage of the arithmetic that decides what the product claims.
- **T-F9 / R-T35 — the fixture-seed check runs in CI**, regenerating into a temp directory and
  diffing, failing the build on drift. **The only place the generator runs in CI.**
- The ESLint domain-boundary rule from ticket 17 runs in CI.
- **T-Q3** — the PR description carries a ranked list of what is *not* covered in `src/domain/**`.
  More useful than the percentage.

## Done when

Every criterion in `spec.md` § 10 has a passing owning test per `testing-spec.md` § 9. **No
criterion is unowned.**

## Notes

**T-E4 is the one that matters most.** It is the only assertion that the access model acts on the
wire rather than in a function — the unit layer proves the filter is correct; only T-E4 proves the
filtered result is what actually shipped. That is the difference between the access model working
and the access model being theatre. **Do not weaken it to a DOM query.**

Read `testing-spec.md` § 7 before adding tests: several things are **deliberately** untested — SVG
geometry, cross-browser rendering, generator internals, DST transitions, visual regression, session
pricing (there is no pricing function). Each is a decision, not a gap to close.

`testing-spec.md` § 10 records the residual exposure: the suite proves the rules, not the design.
Nothing here proves the dashboard is legible in ten seconds, which is ticket 03's actual bar and one
of the three grading criteria. That judgement stays human.

## Comments

### 2026-09-07 — escalated from ticket 21 (AFK build, wave 3)

**A28 and T-E8 contradict R-A10. Do not implement either without reading this.**

- **A28** (`spec.md` § 10) and **T-E8** (`testing-spec.md` § 5) both read: *"The permission matrix
  renders for the open account and **not** for the restricted one."*
- **R-A10** says the opposite, in terms: *"Under R-A3.1 both accounts hold `self` over `access`, so
  **both see it** — the open account showing the full matrix, the restricted account showing its own
  grants."* `spec.md` § 11 **C6** is the resolution that made this so, and it argues the literal
  reading produces "a matrix nobody can see", collapsing ADR-0003's "restricted presets ship so the
  mechanism is demonstrable" and ticket 07's reason for siting the matrix on `/demo/people` at all.

C6 and R-A10 are the later text; A28 and T-E8 read as not having been updated with them. **But the
specs are the fixed point and this is a spec disagreeing with itself, so it is a human decision, not
an implementer's** (AFK handover § 8). Do not resolve it by picking one.

**Ticket 21 is already built and is consistent with R-A10/C6**: `self` over every class is an
invariant enforced ahead of the grant list, so both Roles hold `self × access`, and `grantMatrix`
returns a *different* matrix for each. The domain layer therefore supports "both see it, each seeing
their own grants" and has no way to express "the restricted account holds no `access`".

One hazard: **A28's traceability row cites T-U10** as part of its evidence. T-U10 asserts the domain
fact above, which supports R-A10 and contradicts A28's prose. Do not read T-U10 passing as A28 being
satisfied.

Recommended handling until a human decides: implement R-A10 (both accounts reach the matrix, each
showing its own grants), and leave the T-E8 assertion **unwritten and named** rather than written to
either reading — a test written to the losing side would pin the wrong behaviour.
