Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

# `/sign-in` reads as a real sign-in page: SSO is a fourth provider link, the demo is a fifth button

## Goal

`/sign-in` still announces itself as a demo twice over: a disabled email input under a `Work
email` label with a line admitting single sign-on is not connected, and the demo action wrapped in
a bordered card carrying a `DEMO ACCOUNT` label, a sentence of explanation and a sentence of
navigation advice. Both are scaffolding described in prose rather than a page.

After this ticket the page is a heading, a sentence, and **five pills in one column**: four
identity links (Google, Apple, GitHub, SSO) and, under a hairline, the one button that works.
Nothing on the page explains itself.

Decided by the human, 2026-09-10. Nothing below is open; do not ask, build.

## What exists today

- `src/app/(public)/sign-in/page.tsx` — `PROVIDERS` (three), `ProviderRow` (`flex-col gap-3
  sm:flex-row`), `Divider`, `SsoBlock` (label + disabled `input[type=email]` + disabled
  `button[type=button]` + the "not connected" line), `DemoCard` (the page's only `<form
  method="post" action="/api/session">`, `aria-labelledby="demo-account"`, inside a bordered
  `--landing-claims` card with a small-caps label, a sentence naming Nuria, the submit button, and
  a closing line about the header switcher). `PILL` and `SMALL_CAPS` are module constants.
- `src/app/(public)/sign-in/provider-glyphs.tsx` — `frame()` plus three `currentColor` marks.
- Counts asserted today: `e2e/smoke.spec.ts` — 4 links, 3 `a[target="_blank"]`, 1 `main form`,
  1 `main button[type=submit]`, and the SSO button disabled; `page.test.tsx` — the same, plus the
  "not connected" sentence and the form reached by its accessible name.
- `docs/landing/img/picture-v2.html` covers `/` only, so no reference render contradicts this.

## Scope

Touch `src/app/(public)/sign-in/**`, the tests named under § Tests, and the docs named under
§ Docs. Nothing else — in particular not `src/app/(public)/page.tsx`, not `globals.css`, and
nothing under `src/domain/**` or `src/data/**`.

1. **SSO becomes the fourth provider.** Delete `SsoBlock` entirely — the label, the disabled
   input, the disabled button and the "Single sign-on is not connected in the demo." line. Add a
   fourth entry to `PROVIDERS`:

   | Label | `href` |
   |---|---|
   | `Continue with SSO` | `https://zencoder.okta.com/` |

   Same `<a target="_blank" rel="noopener noreferrer">` as the other three; nothing is exchanged,
   the link is the whole integration. **The label stays `Continue with SSO`, not "Continue with
   Okta"** — the page reads as a real sign-in and the tenant behind it is only visible to whoever
   clicks. That is the whole joke and it is not explained on the page or in a code comment beyond
   one dry line naming it a placeholder tenant.
2. **An Okta glyph** in `provider-glyphs.tsx`, in the existing house style: one monochrome
   `currentColor` mark on the 24-unit box, `aria-hidden`, no icon library. Okta's mark is a ring;
   a stroked circle is enough (`fill="none"`, `<circle cx="12" cy="12" r="7"
   stroke="currentColor" stroke-width="4">`), and `frame()` already lets a caller override `fill`.
   Check it optically beside the other three at 18px — the ring must not read heavier than the
   GitHub mark.
3. **One column of pills.** Four provider links at 130px each do not fit a 560px column, so
   `ProviderRow` loses `sm:flex-row` and becomes a single stacked list of full-width pills at
   every breakpoint. This is what a real provider page looks like; the side-by-side row was only
   ever possible because there were three.
4. **The demo card becomes a fifth pill.** `DemoCard` keeps exactly one thing — the `<form
   method="post" action="/api/session">` with its hidden `member_id` and its submit button — and
   loses the border, the card surface, the padding, the `DEMO ACCOUNT` label, the sentence naming
   Nuria and the sentence about the header switcher. The `form` becomes a bare block whose only
   child pair is the hidden input and the button; give it `aria-label="Demo account"` so the unit
   test can still reach it by name without rendering a visible label.
   - The button keeps its label **`Sign in to the demo account`** verbatim — `enforcement.spec.ts`
     clicks it by name twice and that behaviour is not in scope.
   - It keeps the `PILL` geometry (same radius, padding, text size) and **keeps the filled-ink
     treatment**: it is the only control on the page that does anything, and a sign-in page marks
     its primary action. "Another button, similar to the previous four" is about shape and rank,
     not about hiding which one works.
5. **The divider moves.** `Divider` ("or") now sits between the four identity pills and the demo
   button, which is what the supporting paragraph already promises: *"Use your organisation's
   identity, or step straight into the demo."* Keep both.
6. `SMALL_CAPS` is left unused once the two labels go — delete the constant, do not leave it for
   lint to find.
7. **The page's file header comment** currently describes the SSO block and the card. Rewrite it
   to describe what is there: five pills, four of which are places and one of which is the only
   action; why the four are anchors and the fifth is a form (an anchor cannot POST without the
   JavaScript this page refuses to ship); and that the restricted account is still not offered.

## What is deliberately lost

The line *"Switch to the restricted contractor view from the header on any page."* goes with the
card. After this ticket the contractor account is discoverable **only** from the header switcher
(R-A5) — which is where README § 2 step 4 already sends a reader, and where `routes.spec.ts` and
`mobile.spec.ts` exercise it. Recorded here so it reads as a decision rather than an oversight.
The unit test asserting the restricted account's name is absent from `/sign-in` gets *stronger*,
not weaker: nothing on the page refers to it at all.

## Tests

**Update — counts and strings only, no new scope:**

- `src/app/(public)/sign-in/page.test.tsx`:
  - the provider test's `expected` table gains `["Continue with SSO", "https://zencoder.okta.com/"]`
    and its title says four pills;
  - the "offers SSO as a disabled button" test is **deleted** — the SSO pill is covered by the row
    above, and there is no "not connected" sentence left to assert;
  - the link-count test goes 4 → **5** (four external, plus `Back` → `/`);
  - the form test still reaches `getByRole("form", { name: /demo account/i })` (now via
    `aria-label`) and still finds one submit named `Sign in to the demo account`;
  - the `member_id` test and the restricted-account-absent test are untouched.
- `e2e/smoke.spec.ts`, the ticket-60 sign-in test: links 4 → **5**; `a[target="_blank"]` 3 → **4**;
  the host loop gains `zencoder.okta.com`; the two disabled-SSO-button assertions are **deleted**;
  `main form` **1** and `main button[type=submit]` **1** are unchanged and are the point — the page
  gained a link, not an action. Update the comment above it.

**Must not change:** `e2e/enforcement.spec.ts` (the button's accessible name is unchanged — run
`grep -rn "Sign in to the demo account" e2e src` and confirm every hit still resolves),
`e2e/mobile.spec.ts` (T-E17 must still pass at 390 — a stacked column is easier than a row, but
verify rather than assume), `e2e/payload.spec.ts`, `e2e/routes.spec.ts`, anything under
`src/domain/**` or `src/data/**`.

## Docs

- `spec.md` § 3 route table, the `/sign-in` row: it still reads *"Two 'continue as' buttons, and a
  link back to `/`"*, which ticket 60 already made false and did not fix. It becomes: *"Four
  identity links (three providers and SSO), one 'sign in to the demo account' button, and a link
  back to `/`"*.
- `spec.md` R-A4: append one dated line after ticket 60's amendment, without renumbering —
  *Amended 2026-09-10, ticket 71: the SSO control is a fourth provider link, and the demo action is
  a bare form button rather than a described card.* R-N1's "one link on `/`" is untouched; the
  count on `/sign-in` goes 4 → 5.
- `docs/security.md` cites `src/app/sign-in/page.tsx` at four places (§ lines 14, 147, 181, 403)
  with a path that ticket 60 moved to `src/app/(public)/sign-in/page.tsx` and line numbers this
  ticket invalidates. Fix the path and re-resolve the line numbers at all four. Do not touch the
  arguments around them; the claims are unchanged — `/sign-in` still hands a session to any
  anonymous visitor, still with no password and no verification.
- Nothing in `testing-spec.md` moves: the smoke file it does not enumerate is where the counts live.

## Done when

- `pnpm lint` · `typecheck` · `test` · `test:coverage` · `build` · `e2e` (both Playwright
  projects) all green. Record the six results in `## Comments`.
- `/sign-in` renders five pills in one column at 1440 and at 390, no horizontal scroll at 390, and
  the forbidden-word regex (`faster|productiv|velocity|ship more|10x`) still passes. Screenshot at
  both widths, light and dark, attached to the ticket.
- Clicking `Continue with SSO` opens `https://zencoder.okta.com/` in a new tab and leaves
  `/sign-in` in place.
- `/sign-in` is still prerendered static in the `pnpm build` output.
- No visible text on the page describes the page.

## Notes

Filed 2026-09-10 as a blocker of [ticket 70](70-model-roster-presence-and-palette.md) so it lands
in the same wave. It is file-disjoint from all of 61–70 — it touches only the two sign-in files,
their two test files and three docs — so it can be taken by whichever session reaches it first.
