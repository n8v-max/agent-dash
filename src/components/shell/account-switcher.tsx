// **R-A5 as amended (ticket 61) — the switcher no longer switches.** It *identifies* the acting
// account and *links out*: the trigger is an initials avatar and the Member's own name, the menu
// is that name over their Organization's name, a hairline, and one link — **Add another
// account** — to `/sign-in`.
//
// **Why it stopped switching.** The two seeded accounts were both offered here, so the menu had
// to explain a mechanic no real product has: a control that re-issues your identity in place.
// Ticket 61's decision is that the product offers one account (`OFFERED_PRESETS`), and a menu
// with one destination is not a switcher. What is left is what Google's account menu is when you
// hold one account — who you are, where you are, and a way to add another.
//
// **The restricted contractor is still a Role, and is still demonstrable — under test.** Its
// grants are unchanged in `src/domain/access.ts`, `roleFor` still resolves it, and T-E3/T-E4
// still act as it, from a token minted straight off the fixture (`e2e/support/session.ts`).
// Nothing in the running product mints one, which is why nothing here posts anywhere.
//
// **No `<form>`, and no client component.** The old menu posted to `POST /api/session` so the
// switch could survive without JavaScript; there is nothing to post now, and an anchor is the
// element whose job is "go somewhere". `<details>` keeps the disclosure native, so this stays a
// Server Component: no state, no effect, no hydration boundary in the header.
//
// **R-A8 — this is the only thing in the header that differs between accounts, and it differs in
// what it *says*, not in what it *offers*.** Every account sees the same one link. The name on it
// is always the acting Member's own, which R-A3.1's universal `self` grant makes theirs to read;
// no other person is named here, which is the line T-E4 exists to hold.

import Link from "next/link";
import type { Account } from "@/data/accounts";
import { cn } from "@/lib/utils";

/**
 * The avatar's two letters: the initials of the first and last name-parts — "Diego Navarro
 * Prieto" → "DP", "Nuria Castells" → "NC". Half the roster carries one surname and half two
 * (ticket 65), so first-and-last is the only rule that reads correctly for both. A one-word
 * name has no second initial, so it lends its first two letters rather than rendering a lonely
 * glyph in a circle sized for two.
 */
const initialsOf = (fullName: string): string => {
  const parts = fullName.split(" ").filter((part) => part.length > 0);
  const first = parts.at(0) ?? "";
  const last = parts.at(-1) ?? "";
  return parts.length > 1 ? `${first.slice(0, 1)}${last.slice(0, 1)}` : fullName.slice(0, 2);
};

export function AccountSwitcher(props: { readonly account: Account }) {
  return (
    <details key={props.account.memberId} className="relative" suppressHydrationWarning>
      <summary
        data-testid="account-switcher"
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border",
          "bg-background py-1 pl-3 pr-2 text-left transition-colors hover:bg-accent",
          "marker:hidden [&::-webkit-details-marker]:hidden",
        )}
      >
        <span
          aria-hidden
          className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground"
        >
          {initialsOf(props.account.fullName)}
        </span>
        {/* The name is the header's first casualty on a phone (R-V15): the avatar carries the
            identity there, and the menu still spells it out. */}
        <span
          data-testid="viewer"
          className="hidden text-xs font-medium leading-tight text-foreground sm:block"
        >
          {props.account.fullName}
        </span>
        <span aria-hidden className="text-muted-foreground">
          &#9662;
        </span>
      </summary>

      <div
        data-testid="switch-account"
        className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-xl border border-border bg-popover p-1 shadow-lg"
      >
        {/* Not a button and not a link: the acting account is a statement, and a row that
            highlights on hover would promise an action this menu does not have. */}
        <div className="px-3 pb-2 pt-2">
          <span className="block text-sm font-medium text-foreground">
            {props.account.fullName}
          </span>
          <span className="block text-[11px] text-muted-foreground">{props.account.orgName}</span>
        </div>
        <Link
          href="/sign-in"
          className="block rounded-lg border-t border-border/70 px-3 py-2 text-sm text-foreground no-underline transition-colors hover:bg-accent"
        >
          Add another account
        </Link>
      </div>
    </details>
  );
}
