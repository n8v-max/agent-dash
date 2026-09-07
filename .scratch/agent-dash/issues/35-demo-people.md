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
