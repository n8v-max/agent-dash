// **R-A5 — the account switcher.** It re-issues the token and reloads *in place*, so the viewer
// stays on the URL they were reading and the difference reads as *the same page with fewer rows*.
//
// A plain `<form method="post">`, exactly as `/sign-in` is: the endpoint answers 303 with a
// `Set-Cookie`, which is a thing a browser does natively. No client component, no `fetch`, and
// therefore nothing to keep in sync with the URL.
//
// **How the current URL survives the round trip.** The form cannot carry the path as a hidden
// field, because a layout is rendered once and preserved across client-side navigations — a field
// written at render time would be right on the first document and stale after the first soft
// navigation. So the return path is taken from the request's own `Referer`, which the browser
// recomputes for every submission and which therefore cannot go stale. `POST /api/session`
// validates it against the account's Organization before honouring it, so it is a *return* path
// and not an open redirect.
//
// **R-A8 — this is the only thing in the header that differs between the two accounts, and it
// differs in what it says, not in what it offers.** Both accounts see both entries.
//
// **The entries name Roles, not people** (R-A6). The switch is a change of *grants*, so the Role
// is the honest label — and it is also the only one that holds: a Member name in this menu would
// be a named individual in the payload of a viewer holding no identifying scope over them, which
// is exactly the leak T-E4 exists to catch. The viewer's own name is on the trigger, where
// R-A3.1's universal `self` grant makes it theirs to see.

import { signInAccounts, type Account } from "@/data/accounts";
import { cn } from "@/lib/utils";

/** Copy for R-A3's two shipped Roles, keyed on the name the preset itself carries. */
const ROLE_LINES: Readonly<Record<string, string>> = {
  "Open default": "Named usage and spend for everyone in the Organization.",
  "Restricted (contractor)": "Their own data, plus their Team's totals for jobs and tokens.",
};

export function AccountSwitcher(props: { readonly account: Account }) {
  const accounts = signInAccounts();

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
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
          {props.account.fullName.slice(0, 2)}
        </span>
        <span className="hidden leading-tight sm:block">
          <span
            data-testid="viewer"
            className="block text-xs font-medium text-foreground"
          >
            {props.account.fullName}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {props.account.roleName}
          </span>
        </span>
        <span aria-hidden className="text-muted-foreground">
          &#9662;
        </span>
      </summary>

      <div
        data-testid="switch-account"
        className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-xl border border-border bg-popover p-1 shadow-lg"
      >
        <p className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Switch account
        </p>
        {accounts.map((candidate) => (
          <form key={candidate.memberId} method="post" action="/api/session">
            <input type="hidden" name="member_id" value={candidate.memberId} />
            <button
              type="submit"
              aria-current={candidate.memberId === props.account.memberId ? "true" : undefined}
              className={cn(
                "block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent",
                candidate.memberId === props.account.memberId && "bg-accent",
              )}
            >
              <span className="block text-sm font-medium text-foreground">
                {candidate.roleName}
              </span>
              <span className="block text-xs text-muted-foreground">
                {ROLE_LINES[candidate.roleName] ?? "A seeded account."}
              </span>
            </button>
          </form>
        ))}
        <p className="border-t border-border/70 px-3 pb-1 pt-2 text-xs leading-snug text-muted-foreground">
          Switching keeps you on this page. Navigation is identical for both accounts; the
          restricted one simply receives fewer rows.
        </p>
      </div>
    </details>
  );
}
