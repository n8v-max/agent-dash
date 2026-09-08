// R-A4 — two "continue as" buttons, each posting to `POST /api/session`.
//
// Plain `<form method="post">`. No client component, no JavaScript, no fetch: the endpoint
// answers with a 303 and a `Set-Cookie`, which is what a browser does natively. It also means
// the sign-in path is exercised by the e2e suite exactly as a visitor exercises it.
//
// **Ticket 47 — this is the landing's second screen, not a separate design.** The frame is
// `src/app/page.tsx`'s frame, copied deliberately: the same centred `max-w-3xl` column, the same
// vertical rhythm, the same bordered button. The heading sits one step below the landing's
// (`text-3xl`/`sm:text-4xl` against `text-4xl`/`sm:text-5xl`), because a visitor arriving here
// has already read the bigger line and this page asks a smaller question.
//
// **Why the Role copy is duplicated from the account switcher rather than shared.** The switcher
// names Roles in the third person, because R-A6 keeps people out of that menu; here the visitor
// is choosing which account to *be*, so the restricted line is written in the second person and
// the two strings genuinely differ. Neither sentence can be derived here either: `src/app` may
// reach `src/domain` for types only (R-T6), and `Account` carries the Role's display name
// without its grants — so a copy map keyed on that name is the shape available, exactly as the
// switcher does it.
//
// **The card is not a link, the button is.** A card-wide anchor around a `<form>` would nest an
// interactive element inside an interactive element, and the submit is a POST — an anchor cannot
// make one without the JavaScript this page refuses to ship.

import type { Metadata } from "next";
import Link from "next/link";
import { signInAccounts } from "@/data/accounts";

export const metadata: Metadata = {
  title: "Sign in",
};

const SUPPORTING =
  "The two seeded accounts differ only in what their Role can see — the navigation is identical " +
  "for both, and the restricted one simply receives fewer rows.";

/**
 * What each shipped Role resolves, in one sentence, keyed on the name the preset carries.
 *
 * Read against `SHIPPED_PRESETS` in `src/domain/access.ts`: the open default holds `org-member`
 * over all four classes, the contractor holds `team` over `jobs` and `tokens` only — which is
 * why the second line names what it does *not* reach.
 */
const ROLE_LINES: Readonly<Record<string, string>> = {
  "Open default": "Every Member of the Organization by name — their jobs, their tokens, their cost.",
  "Restricted (contractor)":
    "Yourself by name; your Team's jobs and tokens as totals only, and no cost at all.",
};

/**
 * First letters of the first two words of a name. Not every word: the fixture carries Spanish
 * two-surname names, and three letters in a `size-10` circle is a different component.
 */
const initialsOf = (fullName: string): string =>
  fullName
    .split(" ")
    .slice(0, 2)
    .map((word) => word.slice(0, 1))
    .join("");

export default function SignInPage() {
  const accounts = signInAccounts();

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
        Continue as
      </h1>

      <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
        {SUPPORTING}
      </p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {accounts.map((account) => (
          <li key={account.memberId}>
            <form
              method="post"
              action="/api/session"
              className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5"
            >
              <input type="hidden" name="member_id" value={account.memberId} />

              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground"
                >
                  {initialsOf(account.fullName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium leading-tight text-foreground">
                    {account.fullName}
                  </span>
                  <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {account.roleName}
                  </span>
                </span>
              </div>

              <p className="flex-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                {ROLE_LINES[account.roleName] ?? "A seeded account."}
              </p>

              <button
                type="submit"
                className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-foreground/40 hover:bg-muted/40"
              >
                Continue as {account.fullName}
              </button>
            </form>
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="w-fit text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Back
      </Link>
    </main>
  );
}
