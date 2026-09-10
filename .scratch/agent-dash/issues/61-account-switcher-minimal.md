Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

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
