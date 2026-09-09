Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

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
