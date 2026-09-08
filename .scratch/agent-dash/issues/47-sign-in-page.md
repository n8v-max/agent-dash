Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

# `/sign-in` — two cards

## Scope

Two cards in the shell's visual language. Each: full name, role name, one sentence on what the
role sees (reuse the account switcher copy), one button. Keep the plain `<form method="post">`.
No client JavaScript.

## Done when

- e2e sign-in tests unchanged and green.
- Visual: the page shares the app's font, spacing and card style.

## Notes

The landing page (ticket 37) is the human's and is in the working tree. Do not touch `src/app/page.tsx`.
