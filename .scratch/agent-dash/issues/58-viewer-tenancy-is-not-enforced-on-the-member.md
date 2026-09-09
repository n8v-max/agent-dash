Type: implementation
Status: resolved
Blocked by:
Label: resolved

# `resolveViewer` checks the org on the URL and the token, but not on the Member

## Goal

R-A1 and `src/data/accounts.ts` both claim a second Organization is "a fixture change and no code
change". That is false for the sign-in path, and the claim is the kind that gets believed.

## What was found

Ticket 56 read `src/data/viewer.ts` line by line to write `docs/security.md` and found the gap:

- `viewer.ts:47` checks the token's `org_slug` against the `[org]` path segment. Good.
- `viewer.ts:50` then looks the Member up **across the whole dataset**, with no org predicate.

So the acting Member is never checked to belong to the Organization whose data is being served. A
token minted for org A, naming a Member of org B, resolves signed-in against org A.

**It is vacuous today** and that is why no test caught it: the fixture holds one Organization,
`Dataset.organization` is singular (`load.ts:70`), and `Member` carries no organization id at all
(`types.ts:146-157`). There is currently no way to express the bad state, which is exactly why the
"fixture change and no code change" claim reads as true.

## Scope

1. Give `Member` an organization id in the schema and the fixture types, and validate it at load —
   a Member naming an unknown Organization is a `FixtureFault` like any other (ticket 53's format).
2. Make the `viewer.ts:50` lookup org-scoped, so the Member is resolved *within* the Organization
   the path and token already agree on. Keep the 404-not-403 collapse: a Member of another org must
   be indistinguishable from a Member that does not exist.
3. Correct R-A1 and the `accounts.ts` comment. Either the claim becomes true because this ticket
   makes it true, or it is narrowed to say what a second Organization actually costs.
4. A second Organization in the fixture is the only thing that makes the regression test
   non-vacuous. If that is too expensive, say so in `## Comments` and write the test against a
   hand-built two-org `Dataset` in the test file instead — but do not close this ticket with a test
   that cannot fail.

## Done when

- Unit: a viewer token for org A naming a Member of org B resolves to the same `NOT_FOUND` as an
  unknown member id — asserted as *indistinguishable*, not merely as "an error".
- Unit: a Member whose organization id names no Organization fails `load()` with file, row and field.
- `docs/security.md`'s § on tenancy is updated, and the finding paragraph it currently carries is
  replaced by what the code does after this ticket.

## Notes

Found by ticket 56 on 2026-09-09 while writing `docs/security.md`, and deliberately not fixed there
— it was a documentation ticket, and a silent code fix inside one is worse than a recorded finding.
`docs/security.md` carries the finding in full, with line references.

Ticket 56 also recorded a second, smaller discrepancy worth folding in here or closing separately:
`src/data/queries.ts:15-17` states as a **type** guarantee that "a `Viewer` is producible only by
`resolveViewer`", but `Viewer` is a plain structural type (`access.ts:178`) and only convention and
lint enforce it. The enforced half — that no unfiltered query is nameable — is real. Either make the
type claim true with a branded type, or reword the comment to claim only what holds.

## Comments

### 2026-09-10 — scope widened by the human, then built (branch `ticket/58-tenancy`)

**What changed about the ask, before any code.** The ticket as written asked for
`Member.organization_id` — a single Organization per Member. The human widened it to
**many-to-many**, chose a `memberships.json` join file over an array on either side, and asked
that the account switcher be able to re-mint the JWT against another Organization when a Member
holds more than one. Two clarification rounds settled the rest, and the second reversed the first:

- **No second Organization in the fixture.** Asked for and then withdrawn — "single dataset,
  always demo". The slug stays `demo`; the display name becomes **"Equilibrio S.L."**, which
  demonstrates R-A1's point better than a rename would, because slug and name are now visibly
  different strings. No new routes.
- **58-B folded in**, as § Notes offered.
- **Ticket 59 explicitly excluded.** Three rows, closed completely.

**The consequence that had to be said out loud.** With one Organization seeded, no Member can hold
two Memberships, so the switcher's Organization group **never renders in the shipped application**.
That is a deliberate cost of the single-dataset decision, not an oversight. It is carried by unit
tests that hand the component a two-Organization list directly, and it is stated in the component's
own header rather than left for a reader to discover.

#### What was built

| | |
|---|---|
| `memberships.json` | 20 rows, `(organization_id, member_id, role)`. Generated from the same `PEOPLE` table the directory is; `npm run fixtures:generate` reproduces the whole fixture **byte-identically**. |
| `Member` | Loses `role`. A Role held per pairing cannot live on the person — that was the modelling error that made the M2M expressible only by accident. |
| `load.ts` | `Dataset.memberships`, plus three faults, each naming file, row index and field (ticket 53's format): unknown Organization, unknown Member, duplicate pairing. |
| `viewer.ts` | The lookup is now **through** a Membership in the Organization the path and token already agree on. Takes its `Dataset` as a parameter, following the `FixtureReader` precedent, so the two-Organization world is expressible without seeding one. |
| `api/session/route.ts` | The mint path closed on the same terms — `org_slug` is resolved through the Member's own Memberships and never read from the form. Closing only the reading side would have left the artefact issuable. |
| `account-switcher.tsx` | Organization name and Role on every entry; the Organization group gated on holding more than one. Split into `AccountEntry` and `OrganizationGroup` at the lint layer's function-length ceiling. |
| `access.ts` | `Viewer` branded with a non-exported `unique symbol`; `sealViewer` is its only constructor (58-B). |

#### Done-when, checked

- **Indistinguishability** — asserted by deep equality on the *whole* `ViewerResolution`, not by
  "both are errors", so a field that later differed between the two would fail this test.
- **The test can fail.** Verified by removing the Organization predicate from `viewer.ts` and
  re-running: exactly the two tenancy tests fail, the other fourteen pass. § Scope item 4 asked
  for this and it would have been the easy thing to skip.
- **Load faults** — three, each asserted on file, row index and field.
- **`docs/security.md`** — § 6's finding replaced by what the code does now, and § 4's "a
  hand-built `Viewer` genuinely does [typecheck]" corrected, since it no longer does.

#### Decisions taken under the escalation rule

**`Dataset.organization` was not pluralised, though a first reading of the ticket implies it.**
Seventeen call sites read it, and every one means *the Organization being served* — timezone,
window, name. The two-Organization test needs Organization B only as the **target of a Membership**,
never as a served tenant, so pluralising would have touched seventeen files to express something
the test does not need. The cost: a hand-built `Dataset` can hold a Membership pointing at an
Organization the dataset does not serve, which is incoherent as data and is exactly the attack
shape as a test. Stated here because it is the one place the model is deliberately loose.

**The switcher does not name the other account's Member, though the human asked for "user name,
org name and role".** Doing so would put a named individual in the payload of a viewer holding no
identifying scope over them — the leak `T-E4` exists to catch, and `e2e/payload.spec.ts` would
have failed. Delivered instead: the **acting** Member's own name on their own entry, where
R-A3.1's universal `self` grant makes it theirs to read, with Organization and Role on both. The
request minus the one part of it that would have re-opened a tested security property. Asserted
both ways in `account-switcher.test.tsx`, since asserting only the absence would pass against a
menu rendering no names at all.

**Gates:** `lint` · `typecheck` · `test` (1405) · `test:coverage` (98.43 / 89.21 / 98.98 / 99.53) ·
`build` · `e2e` (152, including the T-E4 payload specs) — all green.

**Not done, and not owed here:** `docs/coverage-gaps.md` is stamped "measured on ticket 38,
2026-09-08" and its ranked list is unaffected by this change; regenerating it is that document's
own cadence, not this ticket's.
