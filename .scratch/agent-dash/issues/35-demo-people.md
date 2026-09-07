Type: implementation
Status: ready-for-agent
Blocked by: 31
Label: ready-for-agent

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
