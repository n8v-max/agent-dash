Type: implementation
Status: resolved
Blocked by:
Label: resolved

# Account switcher: name and Organization only, one account offered, "Add another account"

## Goal

The header switcher reads like Google's: the acting Member's name, their Organization, and one
action, **Add another account**, which goes to `/sign-in`. Nothing about grants, roles, "fewer
rows", or how switching works. The restricted contractor account is **no longer offered anywhere**
— not on `/sign-in`, not in the switcher — but its Role, its grants and the tests that mint it
directly stay.

Decided by the human, 2026-09-10. The wipe stops at *offering*; it does not delete the preset.

## What exists today

- `src/components/shell/account-switcher.tsx` renders a "Switch account" menu with both seeded
  accounts (`signInAccounts()`), a role line per entry (`ROLE_LINES`), an Organization group, and
  a closing paragraph explaining the mechanics. The trigger shows name + role name.
- `src/data/accounts.ts` `signInAccounts()` returns one account per `SHIPPED_PRESETS` entry.
- `src/app/api/session/route.ts` mints only for accounts in `signInAccounts()`.
- `src/app/(public)/sign-in/page.tsx` hardcodes "You will be Nuria Castells Vidal" and says the
  restricted view is reachable from the header.
- `e2e/support/session.ts` destructures `[openAccount, restrictedAccount]` from `signInAccounts()`
  and throws if there are not two. T-E4 (`e2e/payload.spec.ts`), T-E3 (`enforcement.spec.ts`),
  `people.spec.ts`, `reading.spec.ts`, `controls.spec.ts`, `mobile.spec.ts`, `gaps.spec.ts`,
  `routes.spec.ts` all use `RESTRICTED_ACCOUNT`.

## Scope

1. **Switcher contents.** Trigger: initials avatar + full name (name only, no role line). Menu:
   the acting account as one non-interactive row — name on the first line, Organization name on
   the second — then a hairline, then one link **Add another account** → `/sign-in`. Remove the
   "Switch account" heading, `ROLE_LINES`, the role line, the Organization group, and the closing
   paragraph. No `<form>` remains in the switcher. `data-testid="account-switcher"` and
   `data-testid="viewer"` stay; `switch-account` becomes the menu container; `switch-organization`
   goes.
2. **One offered account.** `signInAccounts()` returns only the open default. Introduce
   `OFFERED_PRESETS` (open default only) beside `SHIPPED_PRESETS` in `src/domain/access.ts`, so
   the Role model is unchanged and the offer is a separate, smaller list. `POST /api/session` keeps
   minting only for offered accounts, so the contractor cannot be signed into through the UI.
3. **Sign-in page.** Read the name from `openDefault.fullName` instead of the literal. Replace
   "Switch to the restricted contractor view from the header on any page." with nothing — delete
   the sentence. The `Add another account` link lands here; when a session already exists the page
   still renders and the demo button simply re-issues the open account (no redirect logic added).
4. **e2e support.** `e2e/support/session.ts` builds `RESTRICTED_ACCOUNT` from the fixture directly
   (the first seat-holding human whose Membership resolves to the restricted preset — move
   `accountFor` out of `accounts.ts` into an exported helper or re-derive it in the support file)
   and mints its token with `useSession`. Every existing restricted-account e2e keeps running
   against a token the product never issues. Add one e2e: the switcher menu contains exactly one
   link, to `/sign-in`, and no form; `/sign-in` still has one form and one submit.
5. **Docs and spec.** Amend R-A4 (one action, nothing else offered), R-A5 (the switcher no longer
   switches; it identifies and links out), R-A8 (unchanged in substance — restate: navigation is
   identical for any account that can be signed in). README's thirty-second path and
   `docs/security.md` § wherever the switcher is cited: the restricted account is demonstrable
   only under test. `docs/roadmap.md`: add "a second signed-in account, switched in place" under
   Next.

## Done when

- Unit: switcher renders name, Organization name, one anchor to `/sign-in`, no form, no role
  string, no "row"/"restricted"/"grant" copy (assert the absence).
- Unit: `signInAccounts()` has length 1; `POST /api/session` with the contractor's id is 400.
- e2e: all existing T-E3/T-E4 cases pass against the directly minted restricted token.
- All six gates green.

## Notes

The account-switcher is a Server Component and must stay one. Landing (`/`) is untouched.

## Comments

**2026-09-10 — implemented on `ticket/61`.**

### Gates (worktree root, `PORT=3101` for e2e)

| Gate | Result | Counts |
|---|---|---|
| `pnpm lint` | pass | 0 errors, 0 warnings |
| `pnpm typecheck` | pass | — |
| `pnpm test` | pass | 64 files, **1429** tests (was 1427 before the ticket's own additions and rewrites) |
| `pnpm test:coverage` | pass | statements 98.4%, branches 89.15%, functions 98.99%, lines 99.53% — every threshold group green |
| `pnpm build` | pass | six `/[org]` routes dynamic; `/`, `/sign-in`, `/_not-found` prerendered |
| `PORT=3101 pnpm e2e` | pass | **163** passed, 0 failed, **45.8s** wall |

### Decisions taken under escalation (cheaper option, cost stated)

1. **The `organizations` prop is gone from `AccountSwitcher` and `AppHeader`, and the `[org]`
   layout no longer calls `organizationsFor`.** The Organization group was that prop's only
   consumer, and Scope 1 removes the group. *Cost:* the two-Organization unit tests that ticket
   58 wrote for the group go with it, so the many-to-many Membership is now observable only in
   `organizationsFor`'s own callers — `POST /api/session` still resolves `org_slug` through it
   and is still tested there. Keeping an unused prop threaded through a layout was the more
   expensive option.
2. **`accountFor` matches a preset by `role.key`, not by reference.** Reference equality made the
   helper unusable from any test that resets modules and imports `@/domain/access` statically —
   which is every test in `src/data/viewer.test.ts`. Keys are the preset's identity (`CONTEXT.md`
   § Access: "Roles are data, not an enum"), so this is the honest comparison. *Cost:* two
   presets sharing a key would now collide; nothing generates keys, and `access.test.ts` asserts
   the shipped pair.
3. **`src/data/accounts.ts` also exports `restrictedAccount()`, alongside the exported
   `accountFor` the Scope asked for.** `eslint.config.mjs` forbids `src/app/**` from importing
   `@/domain/access` at runtime (R-T6), so the two app-layer tests that must name the contractor
   cannot name `RESTRICTED_ROLE`. `restrictedAccount()` is `accountFor` with its argument
   supplied — one derivation, two entry points. `e2e/support/session.ts`, which sits outside that
   boundary, calls `accountFor(RESTRICTED_ROLE)` directly as the Scope directs. *Cost:* one extra
   named export.
4. **The unit "no form" assertion is `expect(document.forms).toHaveLength(0)`.** An unnamed
   `<form>` carries no ARIA role, so Testing Library cannot query one, and
   `testing-library/no-container` forbids the container query — and buying green with a disable
   comment is out. `document.forms` is the DOM's own registry and is the stronger claim anyway.
   The same absence is asserted end to end over the served document in the new T-E6.
5. **`testing-spec.md`'s T-E6 was amended too, though Scope 5 does not name it.** T-E6 *was*
   R-A5's old mechanic ("re-issues the token and stays on the current URL — same path, fewer
   rows"), and Scope 5 rewrites R-A5. Leaving the test spec asserting a withdrawn requirement
   would have left the specs self-contradictory. The endpoint's in-place return path is unchanged
   and still tested at the unit layer; "fewer rows on the same doors" survives in T-E1 and
   `people.spec.ts`, both against a directly minted token.
6. **The avatar now shows real initials** — first letter of the first and last name-parts,
   "Nuria Castells Vidal" → "NV" — where it previously sliced the first two letters of the first
   name ("NU"). Scope 1 says "initials avatar"; a one-word name still falls back to two letters.
7. **`e2e/controls.spec.ts`'s three T-E6 switching cases became four identify-and-link-out
   cases**, and `e2e/mobile.spec.ts`'s "still switches" case became "still opens". Both were
   testing the mechanic this ticket removes; neither assertion was weakened, both were repointed
   at what R-A5 now requires. `src/app/api/session/route.test.ts`'s 303 case now posts the *open*
   account, because posting the contractor's id is now — correctly — a 400, which is its own new
   case.

### What each Scope item became

1. **Switcher contents.** `src/components/shell/account-switcher.tsx` rewritten. Trigger: initials
   avatar + `data-testid="viewer"` full name, no role line. Menu (`data-testid="switch-account"`):
   a non-interactive `<div>` holding name over Organization name, then one `next/link` to
   `/sign-in` carrying the hairline. `ROLE_LINES`, `AccountEntry`, `OrganizationGroup`, the
   heading and the closing paragraph are gone; no `<form>` and no `<button>` remain. Still a
   Server Component — `<details>`, no state, no `"use client"`.
2. **One offered account.** `OFFERED_PRESETS` added beside `SHIPPED_PRESETS` in
   `src/domain/access.ts`; `SHIPPED_PRESETS`, both Roles and every grant are untouched.
   `signInAccounts()` maps `OFFERED_PRESETS`, so `POST /api/session` refuses the contractor's id
   with 400 without any change to the route handler.
3. **Sign-in page.** `DemoCard` takes `fullName` from `openDefault`; the "Switch to the restricted
   contractor view…" sentence is deleted. No redirect logic added — the page renders with a
   session in place and the demo button re-issues the open account, asserted in the new T-E6.
4. **e2e support.** `RESTRICTED_ACCOUNT` is now `accountFor(RESTRICTED_ROLE)`, the application's
   own derivation off `memberships.json`. `OPEN_ACCOUNT` still comes from `signInAccounts()`.
   T-E3, T-E4, `people.spec.ts`, `reading.spec.ts`, `gaps.spec.ts`, `routes.spec.ts` and
   `mobile.spec.ts` all run unchanged against it. **T-E4 was not touched and was not weakened:**
   `e2e/payload.spec.ts` still inspects the HTML and the RSC flight payload.
5. **Docs and spec.** R-A4, R-A5 and R-A8 amended in `spec.md`; T-E6 amended in
   `testing-spec.md`; README § 2 rewritten (the table gains an "Offered?" column and step 4
   becomes "what it used to be, and where it went"); `docs/security.md` updated at all five
   switcher citations — one form in the product, the contractor refused at the endpoint, the
   CSRF exposure narrowed to a single identity, and a note that the restricted account is
   demonstrable only under test; `docs/roadmap.md` gains "A second signed-in account, switched in
   place" under **Next**.

### Files not touched, by instruction

`src/components/panels/figures.ts`, `e2e/payload.spec.ts`, `e2e/support/costs.ts` (ticket 69) and
`src/domain/metrics/projection.ts`, `src/data/queries/projection.ts`,
`src/components/panels/projection-panel.tsx` (ticket 64). **No change was needed in any of them** —
`payload.spec.ts` reaches the contractor only through `RESTRICTED_ACCOUNT`, whose export name and
type are unchanged. Landing (`src/app/(public)/page.tsx`) is untouched.
