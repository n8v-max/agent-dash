Type: implementation
Status: resolved
Blocked by: 31
Label: resolved

# `/demo/people` — who, and how they compare

## Goal

The per-Member table, the member profile, the comparator, and the read-only permission matrix.

## Scope

**The table (R-N15).** Member · Team · kind · Completed Tasks · Sessions · Tokens · Cost. Every
numeric column sortable. **Default sort: Completed Tasks descending.**

**What the restricted account renders here is different in kind, not just shorter.** It holds no
scope resolving another Member by name, so it gets **its own named row plus its Team's aggregate
row** — 2 against 20. Do not implement this as a filtered list of the same shape.

- That is an ordering by **output** rather than by spend, and no percentile label is computed — but
  it is an ordering the product chose, and it is recorded as a decision rather than left as drift.
- **No surface defaults to sort-by-cost, no tile is titled "top spenders", and no Member carries a
  computed percentile label** (R-M15). Ranking exists — the columns sort — and the product declines
  to editorialise an ordering.

**The profile (R-N16).** `?member=…` replaces the list with that Member's profile: the four
headline tiles at their scope, their WorkType mix, and the comparator.

**The comparator (R-N17, R-N18).** Paired bars showing the Member's value beside the comparison
group's median for Completed Tasks per period, Cost per completed Task and Tokens processed, with
the key named in words — e.g. *"api-gateway · implementation, 6 members"*.

- **Keyed on `Repository × WorkType`**, and the population is a glossary term: **Comparison group**
  (`CONTEXT.md` § Aggregation Dimensions) — the Members who worked that pair in the selected period,
  computed per view, never stored. Settled 2026-09-07; see `spec.md` § 11 C4. Ticket 07 specified a
  "cohort comparator" keyed on work domain; ADR-0004 cut `Cohort` and stated *"Repository now
  carries the similarity relation."* Resolved by **re-keying, not cutting** — a comparator is a
  median beside your own value, which no filter produces.
- **Paired bars, not a distribution strip.** A strip shows a position within a spread, which is a
  percentile drawn rather than written.
- **Acceptance rate does not join the comparator** — a Member's group spans several WorkTypes, and
  one acceptance figure would average incommensurable criteria.

**The permission matrix (R-A10).** Rendered **read-only**, collapsed at the foot, **for both
accounts**. Under R-A3.1 every Role holds `self` over every class, including `access`, so the open
account sees the full matrix and the restricted account sees its own grants. Settled 2026-09-07;
see `spec.md` § 11 C6. This is what ticket 07 was reaching for in siting the matrix here — under
ticket 10's grants read literally, the matrix would have rendered for nobody.

## Done when

**T-E2** and **T-E8** pass.

## Notes

This page is where ADR-0003 becomes visible. Individual usage and spend are **open org-wide by
default, symmetric** — if you can see mine, I can see yours, with no administrative tier seeing
more. The Goodhart exposure is **accepted and unmitigated**, and it must be defended as a deliberate
position: Meta's *Claudeonomics* and Amazon's *KiroRank* were both **default-on rankings as the
headline**, and KiroRank induced tokenmaxxing that raised compute spend with no matching value.
What this product relies on instead of a structural rule is **symmetry** plus the refusal to
editorialise. Read ADR-0003 § Consequences before touching the default sort.

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

### 2026-09-08 — implemented (AFK build, wave 9)

All six gates green; 27 component tests and 14 e2e. The matrix is read-only by construction — no
input, button or handler anywhere in it — with each cell carrying `data-scope`/`data-datapoint`/
`data-granted` and a screen-reader word beside the glyph.

**T-E8 is deliberately incomplete, and that is the correct outcome.** Implemented **R-A10**: the
matrix is on every arm, both accounts reach it, each shows its own grants (verified: the contractor
sees `team × jobs/tokens` granted, `team × cost` and every `org-member` cell not granted, and its
whole `self` row granted). **Written**: the matrix renders for the open account, collapsed, all 24
cells; the `self` row is granted over every class; and the claim that takes no side — *"every
permission cell the ⟨account⟩ renders is its own grant"* — run for **both** accounts as a filter
over the cells actually found, so it is a real check where a matrix renders and vacuously true
where none does, and therefore correct under either reading. Expected grants are transcribed from
`spec.md` § 2 in the test rather than imported from `access.ts`, so the code under test does not
decide what the test allows. **Left unwritten and named** in three places: whether the matrix
renders *at all* for the restricted account. **No `.skip` anywhere.**

**T-E2 does not reach its stated row count, and the shortfall is in the query rather than the
page.** Open account: 20 rows, all named. Restricted: **1 row, not 2** — `peopleTable` in
`src/data/queries/people.ts` emits a row only where `resolvesName` holds and renders the Team
aggregate as a *sentence* instead ("5 Members contribute to the totals on this page through an
aggregated grant, so they are counted and not named"). `src/data/queries.test.ts` already asserts
the one-row shape, so both would have to change together. The e2e therefore asserts **the
difference in kind rather than a number that would pin one design**: exactly one Member is named
and it is the viewer (`ungrantedNames` filtered against the table text is empty); the aggregate
statement is present for the restricted account and absent for the open one; and the count is
asserted as the range `1 ≤ rows ≤ 2` with the shortfall named in a comment, so the test is honest
today and still passes the moment the Team aggregate row lands.

**The comparator's group median degenerates under a grant that does not reach the group.** On the
contractor's own profile, "Cost per completed Job" shows **$4.70 for the Member and $4.70 for the
comparison group median** — the `cost` view holds only its own rows, so the median is taken over a
population of one. It is not a leak (the value is the viewer's own) but **the label claims
something false**. `ComparatorBar.groupMedian` is already `number | null`, so the fix is to withhold
rather than degenerate.

A24 is asserted at two layers: `aria-sort="descending"` on Completed Jobs, **absent on Cost and
Tokens**, exactly one column carrying `aria-sort`, and the rendered column verified in descending
order. R-M15 is asserted as an absence — the rendered text is scanned for `percentile`,
`top spend`, `leaderboard`, `rank(ed|ing)`.

The comparator is **paired bars and not a strip**: the ViewModel carries exactly two numbers per
metric, so there is no spread in scope to draw a position within — and a position within a spread
is a percentile drawn rather than written. It is deliberately **not** a `ChartFrame` chart: three
unlike units (count, $/Job, tokens) have no shared measure axis and no bucket axis, and building a
`ChartViewModel` in a component would mean a runtime `src/domain` import. Every drawn figure is
also written out as text beside it, which is the property R-X1's mirror exists to give.

**Requirement IDs reach user-facing copy** from the data layer — "…(R-A3.1)", "…(R-N18)",
"…(R-A6)". Besides reading oddly to a reviewer, `R-A3.1` is what tripped T-E4's decimal scan before
the regex was given a word-boundary guard on `main`.

**`TableColumn` carries no unit**, so the Cost column renders `746.41` with no currency mark while
the tiles render `$746.41`. No requirement is violated, but the two surfaces disagree in tone.

### 2026-09-09 — resolved by the human: C9 and C10

**The permission matrix does not ship.** A28 said the open account saw it and the restricted one did
not; R-A10 and § 11 C6 said both saw it. The disagreement was about the audience for a table that
should not exist in an MVP — a second information architecture explaining a mechanism the account
switcher already demonstrates. Component, unit test, acceptance criterion and T-E8 are all gone.

**One sentence replaces it**, read off `grantMatrix` rather than keyed on the preset, so a third Role
would get a true sentence without anyone remembering to write one. It carries no digits.

**The restricted account's table is one row.** Not the two `testing-spec.md` described, and not the
row-plus-aggregate-sentence that shipped: the aggregated grant is real and stays legible on
`/demo/work` and `/demo/spend`, but restating it beside a named row in one column set invites the
subtraction R-M17 exists to prevent. T-E2 asserts 1 against 20 exactly, where it asserted a range.
