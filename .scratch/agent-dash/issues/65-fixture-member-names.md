Type: implementation
Status: ready-for-agent
Blocked by: 61
Label: ready-for-agent

# Member names: no shared first or last name, and not every name is three words

## Goal

The twenty Members read as twenty different people at a glance. No two Members share a first
name; no two share a surname token in either position; roughly half the humans carry one first
name and one surname, the rest keep the Spanish two-surname form.

Decided by the human, 2026-09-10.

## What exists today

- `src/fixtures/people.mts` — `PEOPLE` table: every human is `First Surname1 Surname2`.
  Collisions today: **Vidal** (Nuria Castells Vidal, Héctor Camps Vidal) and **Roldán** (Elena
  Sáez Roldán, Silvia Roldán Nieto).
- R-D1: Spanish names, English Team names, logins that do not read off the names.
- R-D20 / `join.mts`: four GitHub users publish no usable email and are matched by normalised
  full name — that path must stay exercised.
- Names appear in copy and tests: sign-in page (ticket 61 makes it read from data),
  `account-switcher.test.tsx`, `people.spec.ts`, `reading.spec.ts`, `payload.spec.ts` name
  scans, `member-profile.test.tsx`, fixture invariants, README.

## Scope

1. Rewrite `PEOPLE` full names so that: (a) first names are pairwise distinct; (b) the set of all
   surname tokens across all Members has no duplicates; (c) at least 8 of the 18 humans are
   two-word names; (d) accents remain on several names (the join's normalisation stays
   exercised); (e) the four rule-2 joins still resolve — keep their `githubName` variants
   (upper-case, accent-stripped) in step with the new names.
2. Keep member ids, emails' local parts, logins, kinds, Teams and GitHub ids **unchanged** so
   sessions.json rows do not change for this ticket (only `members.json` and `memberships.json`
   content moves). Regenerate and confirm the sessions diff is empty.
3. Add a generator assertion (`invariants.mts`) and a fixture-contract test for (a)–(c).
4. Update every test and doc string carrying an old name. The sign-in copy reads from the account
   (ticket 61), so nothing there to edit by hand.
5. README / fixture README: one line noting the naming rule.

## Done when

- `pnpm fixtures:generate` writes only `members.json` / `memberships.json` changes.
- The invariant test fails when two Members are given the same surname (mutation-checked).
- All six gates green.
