Type: implementation
Status: resolved
Blocked by: 32, 33, 34, 35, 36
Label: resolved

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

### 2026-09-08 — T-E4 will start failing on decimals when charts land (from ticket 30, wave 7)

**Read this before rendering a chart. It is the one thing likely to stop wave 9 being green.**

T-E4's cost assertion scans the **raw response payload** for the fixture's ungranted cost literals.
Any decimal anywhere in that payload can collide with one. Ticket 30 hit this in ordinary shell
work: a Tailwind class of `py-1.5` matched a real ungranted cost of `1.5`, and T-E4 failed on a page
that had leaked nothing at all.

Ticket 30 fixed it **without touching the test** — every decimal was removed from the shell's
Tailwind classes (integer spacing, `text-[11px]`, `calc(100%+8px)`). That works for CSS classes.
**It will not work for charts.** Recharts emits decimal path coordinates, viewBox values, tick
offsets and transforms by the dozen, and those cannot be authored away.

**Do not weaken T-E4 to a DOM query.** `testing-spec.md` § 10 is explicit that doing so makes the
product's central privacy claim untested while appearing tested, and ticket 29 demonstrated the
difference empirically: a probe leaking a name and a cost inside a `hidden` section failed T-E4 and
**passed** a `not.toBeVisible()` check.

**Refine the exclusion, do not relax the claim.** The defensible direction is to keep scanning the
whole payload but subtract the contexts that cannot carry a leaked figure — SVG geometry attributes
(`d`, `points`, `viewBox`, `transform`, `x`/`y`/`cx`/`cy`/`r`/`width`/`height`), `class`/`className`
values, and inline `style`. A cost that has actually leaked arrives either as a raw number in the
RSC props or as rendered text, and both survive that subtraction. Note the opposite temptation —
requiring costs to look like formatted currency (`$24.39`) — **is** a weakening: the RSC flight
payload carries raw props, so a leaked `24.39` would never match.

Whatever is chosen, keep ticket 29's two properties: the **positive control** (the payload does
contain the viewer's *own* name, so the negatives cannot pass vacuously) and the **non-emptiness
guards** on the search sets. And re-run ticket 29's falsification probe afterwards — render a
name and a cost in a `hidden` section and confirm T-E4 still fails — because an exclusion list is
exactly the kind of change that can quietly make an assertion unable to fire.

### 2026-09-08 — implemented (ticket 38)

**Done-when met, with one criterion blocked.** Every criterion in `spec.md` § 10 has a passing
owning test per `testing-spec.md` § 9 except **A28**, which is left blocked on the human decision
recorded in the comment above. It is not written to either side.

**Added:**

- **T-E1** — `e2e/routes.spec.ts`. 6 routes × 2 accounts = 12 navigations, each asserting a 200, the
  `<main>` landmark carrying *that route's* `<h1>`, the header, no Next error surface in the
  rendered text, and no `pageerror`. Plus the A9/R-A8 nav-set equality, now over all six routes and
  comparing `href` and `aria-current` as well as the label.
- The single-route version of that nav equality was **moved out of `enforcement.spec.ts`** rather
  than duplicated. It was placed there as a stand-in while the shell was being built.
- **T-E4's permanent positive control** — `e2e/payload.spec.ts` now asserts that the *open*
  account's `/demo/people` payload carries the nineteen names the restricted account must not
  receive. This is the wave-9 item the file's `TODO` named; the `TODO` is gone and the
  `sonarjs/todo-tag` warning with it. The second item that `TODO` carried — the restricted
  payload's row count — is the recorded T-E2 shortfall and lives in `e2e/people.spec.ts`, where
  the rows are.
- **T-Q3** — `docs/coverage-gaps.md`. A ranked list of eleven unasserted behaviours in
  `src/domain/**`, the § 7 decisions that are deliberately not on it, and why the percentage is not
  the deliverable. The list is produced, not closed: none of its items is an acceptance criterion.

**Gates verified, not changed.** `.github/workflows/ci.yml` already runs `pnpm lint` (the ESLint
domain-boundary rule), the T-F9 / R-T35 fixture-seed regenerate-and-diff, and `pnpm test:coverage`.
T-Q2's per-file domain thresholds were falsified rather than assumed: raising `DOMAIN_THRESHOLDS`
to 99% branches makes `pnpm test:coverage` exit 1 naming `src/domain/viewmodel.ts` by file, which
is the per-file behaviour the generated threshold keys exist for. Reverted.

**T-E4 was not weakened and `e2e/support/costs.ts` and `e2e/support/fixture.ts` were not touched.**
