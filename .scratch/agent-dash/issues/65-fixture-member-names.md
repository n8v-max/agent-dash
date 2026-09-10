Type: implementation
Status: resolved
Blocked by: 61
Label: resolved

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

## Comments

**2026-09-10 — implemented on `ticket/65`.**

**The names were repaired, not replaced.** Member ids (`mem_ncastells`) and directory email
locals (`nuria.castells`) both encode *first name + first surname*, and Scope 2 freezes them, so
inventing eighteen new people would have left every id and every mailbox naming somebody who no
longer exists. Every first name and every first surname is therefore kept, and the collisions are
resolved by dropping second surnames: nine humans keep the Spanish two-surname form and nine now
carry one. That satisfies (a)–(e) and leaves ids, emails, logins, kinds, Teams and GitHub ids
byte-identical.

- Two-word now (9): Nuria Castells, Marta Peña, Carmen Cruz, Pablo Herrera, Elena Sáez, Irene
  Vázquez, Tomás Ferrán, Noelia Gallego, Héctor Camps.
- Three-word still (9): Álvaro Ruiz Ortega, Javier Domínguez Lara, Lucía Bermejo Ferrer, Sergio
  Ibáñez Molina, Diego Navarro Prieto, Rubén Marín Cano, Beatriz Lorenzo Pardo, Andrés Quintana
  Rey, Silvia Roldán Nieto.
- **Vidal** and **Roldán** are gone as duplicates; 27 surname tokens, all distinct; 18 distinct
  first names; 12 names keep an accent.
- The `githubName` variants move in step: `Tomas Ferran` and `Elena Saez` are the two that
  changed shape. `ALVARO RUIZ ORTEGA`, `Sergio Ibanez Molina`, `Ruben Marin Cano` and
  `Javier Dominguez Lara` are untouched.

**Sessions did not move.** `pnpm fixtures:generate` writes `members.json` and nothing else —
`git diff --stat src/fixtures/data/sessions/` is empty, and so is the rest of `data/`.
`memberships.json` holds only ids and Roles, so it had nothing to change.

**The invariant bites, mutation-checked.**
- Generator: giving Nuria the surname `Camps` stops `pnpm fixtures:generate` with
  `R-D1: two Members share the surname "camps"`.
- Contract test: the same edit applied to the committed `members.json` fails
  *"repeats no surname token, in either position"* (26 distinct of 27); renaming Marta to
  `Nuria Peña` fails *"gives every human a first name nobody else has"* (17 of 18). Both were
  reverted and the fixture regenerated.
- The comparison folds accents and case, so `Sáez`/`Saez` is one token — the same fold R-D20's
  rule 2 uses.

**R-D20's fallback is now asserted, not just documented.** `assertJoin` counts the users that
reach a Member by name and throws below four; the contract test asserts the same and checks each
one publishes either no email or a `users.noreply` address. Six users take rule 2 (four with no
email, two with `noreply`), which is what the generator now prints — the fixture README said
"four", and that clause was corrected rather than the data changed.

### Escalation choices

1. **The rule is asserted over the 18 humans, not all 20 Members.** Scope 1 says "across all
   Members", but "Equilibrio Deploy Bot" and "Equilibrio Nightly Runner" share `Equilibrio` in
   first position by design — they are the Organization's robots, not two related people — so a
   literal reading would have forced a rename of two service accounts whose names appear in
   `series.fixture.test.ts` and in every legend. Cheaper option taken: exclude service accounts
   and say so in the assertion's message and in both READMEs. Cost: a future third bot named
   `Equilibrio …` would not be caught by this invariant.
2. **No spec amendment.** The ticket directs README lines only (Scope 5), and the rules make the
   specs the fixed point absent an instruction, so `spec.md` R-D1 and `testing-spec.md` § 6 are
   untouched and the new contract test carries no `T-F` id — it is titled by R-D1. Cost: the
   naming rule is stated in `README.md`, `src/fixtures/README.md`, `people.mts` and
   `invariants.mts`, but not in `spec.md`.
3. **`docs/landing/img/picture-v1.html` still shows the old names.** It is a dated render of the
   landing shape ticket 60 replaced; rewriting names inside a historical screenshot would make it
   a picture of something that never existed. Left as is.
4. **`account-switcher.test.tsx` gained a case rather than losing one.** Its initials test used
   `Héctor Camps Vidal` → `HV`, which under the new roster becomes `Héctor Camps` → `HC` — a
   two-part name, where "first and last" and "first and second" agree. A three-part case
   (`Diego Navarro Prieto` → `DP`) was added so the rule is still discriminated.

### Fixture counts (unchanged except the directory)

20 Members (18 human) · 4 Teams · 5 Repositories · 5 WorkTypes · 7 Models from 3 vendors ·
570 Tasks · 1,049 AgentSession rows = 742 visible roots + 292 visible children ·
session cost $4,905.39 against $4,212.00 of seat cost (46.2% of Total spend) ·
20 GitHub users, all joined, 6 by name alone ·
**R-D1: 18 distinct first names, 27 distinct surnames, 9 one-surname, 9 two-surname, 12 accented.**

### Gates — all six green, run from the `ticket/65` worktree

| Gate | Result | Detail |
|---|---|---|
| `pnpm lint` | pass | clean |
| `pnpm typecheck` | pass | `next typegen && tsc --noEmit`, clean |
| `pnpm test` | pass | 65 files, **1515 tests**, 9.5s |
| `pnpm test:coverage` | pass | 1515 tests · statements 98.29%, branches 89.40%, functions 99.02%, lines 99.47% |
| `pnpm build` | pass | 10 routes, static pages generated |
| `PORT=3105 pnpm e2e` | pass | **179 tests**, 48.6s (49.5s wall) |
