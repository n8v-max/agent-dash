Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

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
