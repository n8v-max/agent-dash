Type: implementation
Status: resolved
Blocked by:
Label: resolved

# `/sign-in` — reads as part of the landing, not a 90s HTML page

## Goal

Today the page is an unstyled `<h1>`, a paragraph and two bare buttons with the role label
running into the button text. It must look like the second screen of the landing page.

## Scope

- Same frame as `src/app/page.tsx`: centred column, `max-w-3xl`, same font, spacing and colour
  tokens, same heading scale one step down. Read the landing file for its classes; do not edit it.
- Heading: "Continue as". One supporting sentence, `text-muted-foreground`, from the account
  switcher copy: the two accounts differ only in what their Role can see.
- Two cards side by side at `sm:` and stacked below. Each card: avatar initials, full name, role
  name as a small label, one sentence on what the role sees, and one full-width button in the
  landing's button style. The whole card is not a link; the button is.
- A small "Back" link to `/` under the cards.
- Keep the plain `<form method="post">` per card. No client JavaScript.

## Done when

- Existing sign-in e2e tests green with no selector changes.
- Visual: at 1440 and 390 the page shares the landing's typography, spacing and button style.
- e2e: two `<form>` elements, two submit buttons, one link to `/`.

## Notes

Human request, 2026-09-09. The landing page (ticket 37) is the human's and is in the working tree
uncommitted; read it for style, never modify it.

## Comments

### 2026-09-09 — implemented (AFK build, worktree `agent-dash-t47`, branch `ticket/47-sign-in`)

**The frame is the landing's frame, copied rather than abstracted.** `main` is the same
`mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-8 px-6 py-16` column, the heading
carries the same weight/tracking one step down (`text-3xl`/`sm:text-4xl` against the landing's
`text-4xl`/`sm:text-5xl`), the supporting paragraph is the same `max-w-xl … text-muted-foreground`,
and the card button is the landing's `See the dashboard` button verbatim except for `w-full`
replacing `w-fit`. No shared layout component was extracted: `src/app/page.tsx` is out of bounds
for this ticket, and a frame component that only one of the two pages can be refactored into is a
seam nobody asked for. The cost is two copies of five utility classes, and it is the cheaper side.

**Cards.** `ul` is `grid gap-4 sm:grid-cols-2`, so the two cards sit side by side at `sm:` and
stack below it; the `form` *is* the card (`flex h-full flex-col gap-4 rounded-xl border
border-border bg-card p-5`), which is the repo's existing card recipe from `work-section.tsx` and
`summary-tiles.tsx`. `h-full` on the form makes the two cards equal height when the copy lengths
differ, and `flex-1` on the sentence keeps both buttons on the same baseline. The card is not a
link and the button is: an anchor cannot issue a POST without the JavaScript this page refuses to
ship, and wrapping the form in one would nest interactives.

**Role copy, and why it is duplicated instead of shared.** Each card names what the Role reaches,
read off `SHIPPED_PRESETS`: the open default gets *"Every Member of the Organization by name — their
jobs, their tokens, their cost."*, the contractor gets *"Yourself by name; your Team's jobs and
tokens as totals only, and no cost at all."* — the second names the **absence** of `cost`, because
without it the two cards read as the same account twice. `AccountSwitcher` carries a similar
two-entry map, and it was deliberately **not** factored into a shared module: the switcher writes
in the third person (R-A6 keeps named people out of that menu) where sign-in addresses the person
choosing, so the strings genuinely differ, and the shared module would have meant editing a file
outside this ticket while four sibling agents were in the tree. Neither sentence is derivable in
`src/app` anyway — the ViewModel boundary gives components domain *types* only, and `Account`
carries `roleName` without the grants behind it, so a copy map keyed on the name is the shape
available.

**Avatar initials** are the first letter of the first two words. The fixture carries Spanish
two-surname names ("Nuria Castells Vidal"), so first-letter-of-every-word would put three glyphs in
a `size-10` circle. The span is `aria-hidden`: the full name is immediately beside it, and a screen
reader spelling out "NC" first is noise.

**Existing selectors untouched.** The button's accessible name is still exactly
`Continue as {fullName}` and the Role name is still its own text node, so both assertions in
`page.test.tsx` and both clicks in `e2e/enforcement.spec.ts` pass unchanged. No test was edited,
skipped or deleted.

**New coverage.** `e2e/smoke.spec.ts` gains the Done-when assertion — 200, `<h1>` is "Continue as",
two `<form>`s, two `button[type=submit]`, exactly one link and its `href` is `/`. It sits beside the
landing's structural test rather than in `enforcement.spec.ts`, which owns the *behaviour* of
signing in; this is the page's shape. Three unit tests were added for the landmark/heading, the two
Role sentences and the back link. The form's `method`/`action` are still **not** asserted in the
unit layer — that was the original file's recorded reasoning and it still holds.

**Spec amendment.** `spec.md` § 3's route table said `/sign-in` renders *"Two 'continue as'
buttons"*; it now also carries a link back to `/`, so the cell reads *"Two 'continue as' buttons,
and a link back to `/`"*. Nothing in `testing-spec.md` changed: the smoke file it does not
enumerate is where the new assertion went, and no `T-E*` claim moved.

**Visual verification, for real.** `PORT=3105 pnpm dev`, driven with a throwaway Playwright script
(since removed) at 1440×900 and 390×844, screenshotting `/` and `/sign-in` at both and measuring the
two form boxes. At 1440 the cards are `x=360,728 · w=352` on the same `y` — side by side, left edge
flush with the heading inside the shared `max-w-3xl` column. At 390 they are `x=24 · w=342` at
`y=293` and `y=507` — stacked, no overflow, both button labels on one line. Held the two landing
screenshots beside them: same type scale, same rhythm, same button.

**Gates.** `pnpm lint` clean · `pnpm typecheck` clean · `pnpm test` 1105 passed / 52 files ·
`pnpm test:coverage` 97.95% statements, 87.24% branches (over the 80/75 floor) · `pnpm build` clean,
`/sign-in` still prerendered static · `PORT=3105 pnpm e2e` **103 passed, 0 failed**.

**Deliberately left undone.** No dark-mode-specific work — the page uses only semantic tokens
(`border`, `card`, `muted`, `muted-foreground`, `foreground`), so it inherits whatever the theme
does, and the landing does the same. No focus-visible ring beyond the browser default, for the same
reason: the landing's button carries none, and adding one here would make the two screens differ.
No hover state on the card itself; the button is the affordance.
